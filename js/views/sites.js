/**
 * VIEW - SitesView
 * Dumb UI strictly focused on DOM and Leaflet Map Rendering.
 */
import GlobalState from '../core/app_state.js';
import SitesService from '../services/sites_service.js';
import LogbookService from '../services/logbook_service.js';
import { WIND_DIRECTIONS } from '../data/weather_config.js';
import { getSpotairWidgetId } from '../data/spotair_widgets.js';
import { escapeHTML, renderSiteText, safeHttpUrl } from '../core/security.js';
import GdprEngine from '../gdpr_engine.js';

import { SitesMapBase } from './sites_map.js';
import AppEvents, { FORM_FIELDS } from '../core/events.js';
import { t } from '../utils/i18n.js';
import { FR } from '../i18n/fr.js';

import {
    forecastValue,
    missingValuesText,
    verdictColor,
    verdictReminderHtml,
    modelLabel,
    modelAgreementHtml,
    forecastContextInner,
    forecastContextHtml,
    radiusLabel,
    verdictLabel,
    setRefreshFailure,
    getRefreshFailure,
} from './sites_forecast.js';
import { tt, th, tl } from './sites_strings.js';
// Utilisés ailleurs (tests, autres écrans) : on les ré-exporte depuis ici.
export { modelLabel, formatForecastContext, formatAge, radiusLabel } from './sites_forecast.js';

class SitesViewClass extends SitesMapBase {
    async mount(container) {
        console.time('SITES_MOUNT_TOTAL');
        await super.mount(container);
        await SitesService.ensureSitesLoaded();
        console.time('SITES_SERVICE_INIT');
        SitesService.init();
        console.timeEnd('SITES_SERVICE_INIT');

        this.setupEventListeners();
        clearInterval(this._forecastAgeInterval);
        this._forecastAgeInterval = setInterval(() => this.updateForecastAges(), 60 * 1000);
        this.renderSavedLocations();
        console.time('SITES_SHOW_METHOD');
        this.show();
        console.timeEnd('SITES_SHOW_METHOD');
        console.timeEnd('SITES_MOUNT_TOTAL');
    }

    toggleAdvancedSettings() {
        const container = /** @type {HTMLElement} */ (document.querySelector('.advanced-filters-container'));
        const icon = document.getElementById('advanced-settings-toggle-icon');
        if (container) {
            const isHidden = container.classList.contains('hidden');
            if (isHidden) {
                container.classList.remove('hidden');
                container.style.display = 'flex';
                if (icon) icon.style.transform = 'rotate(180deg)';
            } else {
                container.classList.add('hidden');
                container.style.display = 'none';
                if (icon) icon.style.transform = 'rotate(0deg)';
            }
        }
    }

    // Désactive le bouton "Réessayer" de la bannière météo pendant le cooldown (voir
    // SitesService.WEATHER_COOLDOWN_MS) plutôt que de laisser l'utilisateur le re-déclencher
    // aussitôt et re-provoquer le même 429 : Open-Meteo limite par heure, pas par clic.
    _startWeatherRetryCountdown(remainingMs) {
        clearInterval(this._weatherRetryInterval);
        const btn = /** @type {HTMLButtonElement} */ (document.getElementById('weather-retry-btn'));
        if (!btn || remainingMs <= 0) return;

        const label = () => {
            const remaining = Math.max(0, remainingMs);
            const mins = Math.ceil(remaining / 60000);
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
            btn.textContent = tl('weather.retryIn', { minutes: mins });
        };
        label();

        this._weatherRetryInterval = setInterval(() => {
            remainingMs -= 1000;
            if (remainingMs <= 0) {
                clearInterval(this._weatherRetryInterval);
                btn.disabled = false;
                btn.style.opacity = '';
                btn.style.cursor = '';
                btn.textContent = tl('weather.retry');
                return;
            }
            label();
        }, 1000);
    }

    async unmount() {
        await super.unmount();
        clearInterval(this._weatherRetryInterval);
        clearInterval(this._forecastAgeInterval);
        clearTimeout(this._radiusTimeout);
        clearTimeout(this._progZoomTimeout);
        if (this.state.mapResizeObserver) {
            this.state.mapResizeObserver.disconnect();
            this.state.mapResizeObserver = null;
        }
        if (this.state.map) {
            this.state.map.remove();
            this.state.map = null;
        }
        this.state.markersGroup = null;
        this.state.tileLayer = null;
        // Les délégateurs posés sur <body> par setupEventListeners() ne doivent pas survivre à
        // l'écran Sites (mount() les réinstalle) : sinon ils réagissent aux clics des autres écrans.
        if (this._clickHandler) document.body.removeEventListener('click', this._clickHandler, true);
        if (this._changeHandler) document.body.removeEventListener('change', this._changeHandler, true);
        if (this._inputHandler) document.body.removeEventListener('input', this._inputHandler, true);
        if (this._toggleHandler) document.body.removeEventListener('toggle', this._toggleHandler, true);
        this._clickHandler = this._changeHandler = this._inputHandler = this._toggleHandler = null;
    }

    setupEventListeners() {
        // Clean old listeners safely
        if (this._clickHandler) document.body.removeEventListener('click', this._clickHandler, true);
        if (this._changeHandler) document.body.removeEventListener('change', this._changeHandler, true);
        if (this._inputHandler) document.body.removeEventListener('input', this._inputHandler, true);
        if (this._toggleHandler) document.body.removeEventListener('toggle', this._toggleHandler, true);

        this._clickHandler = (e) => {
            const btn = e.target.closest('[data-action]');
            // Menus act on change (_changeHandler): opening one must not run its action (spec 019).
            if (btn && !FORM_FIELDS.includes(btn.tagName)) {
                if (btn.tagName === 'A' && btn.getAttribute('href') === '#') e.preventDefault();
                const action = btn.getAttribute('data-action');
                const args = btn.getAttribute('data-args');

                if (typeof SitesService[action] === 'function') {
                    AppEvents.markHandled(e);
                    let result;
                    if (args !== null)
                        result = SitesService[action](...args.split(',').map((a) => a.trim().replace(/'/g, '')));
                    else result = SitesService[action]();

                    const updateUI = (resolved) => {
                        // Le bouton "Réessayer" de la bannière d'erreur météo repasse par ce
                        // dispatcheur générique : sans ce cas particulier, un nouvel échec (ex.
                        // toujours saturé) se contentait de re-render sans rien expliquer,
                        // laissant les cartes sur "Chargement météo..." indéfiniment.
                        if (action === 'fetchWeatherForSites') {
                            this.handleWeatherFetchResult(resolved);
                            return;
                        }
                        this.renderList();
                        this.updateMapMarkers();
                        if (action === 'cycleFilterState') {
                            this.updateBadges();
                            this.renderDropdowns();
                        }
                        if (action === 'saveCurrentLocation' || action === 'removeSavedLocation') {
                            this.renderSavedLocations();
                        }
                    };
                    if (result instanceof Promise) {
                        result.then(updateUI).catch(console.error);
                    } else {
                        updateUI();
                    }
                } else if (typeof this[action] === 'function') {
                    AppEvents.markHandled(e);
                    if (args !== null) this[action](...args.split(',').map((a) => a.trim().replace(/'/g, '')), btn);
                    else this[action](btn);
                }
            }
        };

        this._changeHandler = (e) => {
            const el = e.target;
            const action = el.getAttribute('data-action');
            if (action && typeof SitesService[action] === 'function') {
                AppEvents.markHandled(e);
                let result;
                if (el.type === 'checkbox') result = SitesService[action](el.checked);
                else result = SitesService[action](el.value);

                const updateUI = (resolved) => {
                    // Même raison que pour _clickHandler : changer de modèle météo relance un
                    // fetch qui peut échouer (429...), et sans ce cas particulier ça se
                    // contentait de re-render sans jamais l'expliquer.
                    if (action === 'changeWeatherModel') {
                        this.handleWeatherFetchResult(resolved);
                        return;
                    }
                    this.renderList();
                    this.updateMapMarkers();
                };
                if (result instanceof Promise) {
                    result.then(updateUI).catch(console.error);
                } else {
                    updateUI();
                }
            } else if (action && typeof this[action] === 'function') {
                AppEvents.markHandled(e);
                this[action](el.value);
            }
        };

        this._inputHandler = (e) => {
            const el = e.target;
            if (el.id === 'radius-slider') {
                SitesService.setRadiusLimit(el.value);
                const label = document.getElementById('radius-val-label');
                if (label) label.textContent = radiusLabel(SitesService.state.radiusLimit);
                // Debounce rendering
                clearTimeout(this._radiusTimeout);
                this._radiusTimeout = setTimeout(() => {
                    this.renderList();
                    this.updateMapMarkers();
                }, 300);
            } else if (el.id === 'forecast-slider') {
                SitesService.setForecastOffset(parseInt(el.value));
                this.updateForecastLabel();
                this.updateMapMarkers();
                this.renderList();
            } else if (el.id === 'address-input' || el.id === 'search-site-input') {
                const action = el.getAttribute('data-action');
                if (action && typeof SitesService[action] === 'function') {
                    const result = SitesService[action](el.value);
                    const updateUI = () => {
                        this.renderList();
                        this.updateMapMarkers();
                    };
                    if (result instanceof Promise) {
                        result.then(updateUI).catch(console.error);
                    } else {
                        updateUI();
                    }
                }
            }
        };

        this._toggleHandler = (e) => {
            if (e.target && e.target.classList && e.target.classList.contains('site-details-toggle')) {
                const siteId = e.target.getAttribute('data-site-id');
                if (siteId) {
                    this.handleDetailsToggle(siteId, e.target);
                }
            }
        };

        document.body.addEventListener('click', this._clickHandler, true);
        document.body.addEventListener('change', this._changeHandler, true);
        document.body.addEventListener('input', this._inputHandler, true);
        document.body.addEventListener('toggle', this._toggleHandler, true);
    }

    requestGpsLocation(isInitialLoad = false) {
        const statusEl = document.getElementById('address-status-message');
        const inputEl = /** @type {HTMLInputElement} */ (document.getElementById('address-input'));
        const gpsBtn = document.getElementById('btn-use-gps');

        if (!GdprEngine.isConsentGranted('gps')) {
            if (!isInitialLoad) {
                const openSettings = confirm(tl('gps.consentConfirm'));
                if (openSettings) GdprEngine.showModal('gdpr-settings-modal');
            }
            if (statusEl)
                statusEl.innerHTML = `<i class="ri-shield-user-line" style="color: var(--text-muted);"></i> ${tt('gps.disabled')} <a href="#" data-action="GdprshowModal" data-args="gdpr-settings-modal" data-prevent-default style="color: var(--accent-blue);">${tt('gps.manage')}</a>`;
            return;
        }

        if (!navigator.geolocation) return;

        if (statusEl) {
            statusEl.innerHTML = `<i class="ri-loader-4-line" style="animation: spin 1s linear infinite;"></i> ${tt('gps.locating')}`;
            statusEl.style.color = 'var(--text-muted)';
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                SitesService.getSites().forEach((s) => {
                    delete s.distance;
                }); // reset cache

                SitesService.state.userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                };
                if (inputEl) {
                    inputEl.value = '';
                    inputEl.placeholder = tl('gps.inputPlaceholder');
                }
                if (statusEl) {
                    statusEl.innerHTML = `<i class="ri-checkbox-circle-line" style="color: var(--accent-green);"></i> ${tt('gps.active')}`;
                    statusEl.style.color = 'var(--accent-green)';
                }
                if (gpsBtn) {
                    gpsBtn.style.borderColor = 'var(--accent-blue)';
                    gpsBtn.style.color = 'var(--accent-blue)';
                }

                this.renderList();
                SitesService.scheduleWeatherRescopeIfNeeded();
                if (this.state.map) this.updateMapMarkers();
            },
            () => {
                if (!isInitialLoad) alert(tl('gps.failedAlert'));
                if (statusEl) {
                    statusEl.innerHTML = `<i class="ri-error-warning-line" style="color: var(--accent-red);"></i> ${tt('gps.unavailable')}`;
                    statusEl.style.color = 'var(--accent-red)';
                }
            },
        );
    }
    show() {
        if (!this.initialized) {
            this.setupDropdowns();

            // Prefill limits inputs and select from state
            const minInput = /** @type {HTMLInputElement} */ (document.getElementById('limit-wind-min'));
            const maxInput = /** @type {HTMLInputElement} */ (document.getElementById('limit-wind-max'));
            const deltaInput = /** @type {HTMLInputElement} */ (document.getElementById('limit-gust-delta'));
            const hideUnflyableCheckbox = /** @type {HTMLInputElement} */ (
                document.getElementById('hide-unflyable-checkbox')
            );
            const modelSelect = /** @type {HTMLSelectElement} */ (document.getElementById('weather-model-select'));
            const sortSelect = /** @type {HTMLSelectElement} */ (document.getElementById('select-sort-mode'));
            const radiusSlider = /** @type {HTMLInputElement} */ (document.getElementById('radius-slider'));
            const radiusLabelEl = document.getElementById('radius-val-label');

            if (minInput) minInput.value = String(SitesService.state.limitWindMin);
            if (maxInput) maxInput.value = String(SitesService.state.limitWindMax);
            if (deltaInput) deltaInput.value = String(SitesService.state.limitGustDelta);
            if (hideUnflyableCheckbox) hideUnflyableCheckbox.checked = SitesService.state.hideUnflyable;
            if (modelSelect) modelSelect.value = SitesService.state.weatherModel;
            if (sortSelect) sortSelect.value = SitesService.state.sortMode;
            if (radiusSlider) radiusSlider.value = String(SitesService.state.radiusLimit);
            if (radiusLabelEl) radiusLabelEl.textContent = radiusLabel(SitesService.state.radiusLimit);

            // Adjust strategy display panel & strategy buttons active classes
            const strategyPanel = document.getElementById('conditions-strategy-panel');
            if (strategyPanel) {
                strategyPanel.style.display = SitesService.state.sortMode === 'CONDITIONS' ? 'flex' : 'none';
            }

            const strategies = ['CONSECUTIVE', 'HALF_DAY', 'DAILY', 'TOTAL'];
            strategies.forEach((s) => {
                const btn = document.getElementById(`strat-${s}`);
                if (btn) {
                    if (s === SitesService.state.conditionsStrategy) {
                        btn.classList.add('active');
                        btn.style.background = 'rgba(14, 165, 233, 0.15)';
                        btn.style.borderColor = 'rgba(14, 165, 233, 0.3)';
                        btn.style.color = 'var(--accent-blue)';
                    } else {
                        btn.classList.remove('active');
                        btn.style.background = 'rgba(255, 255, 255, 0.03)';
                        btn.style.borderColor = 'var(--border-color)';
                        btn.style.color = 'var(--text-secondary)';
                    }
                }
            });

            console.time('SITES_FETCH_WEATHER');
            // Show local loading state before fetching weather
            const container = document.getElementById('sites-list-container');
            if (container && !document.getElementById('weather-loading-indicator')) {
                const loadingHtml = `
                <div id="weather-loading-indicator" style="display: flex; align-items: center; justify-content: center; gap: 8px; padding: 16px; margin-bottom: 16px; font-size: 1rem; color: var(--text-secondary); background: rgba(255,255,255,0.03); border-radius: 8px;">
                    <i class="ri-loader-4-line" style="animation: spin 1s linear infinite; font-size: 1.2rem;"></i>
                    <span>${tt('weather.computing')}</span>
                </div>
            `;
                container.parentNode.insertBefore(
                    document.createRange().createContextualFragment(loadingHtml),
                    container,
                );
            }

            SitesService.fetchWeatherForSites().then((result) => {
                console.timeEnd('SITES_FETCH_WEATHER');
                this.handleWeatherFetchResult(result);
            });
            this.initialized = true;
        }
        console.time('SITES_INIT_MAP');
        this.initMap();
        console.timeEnd('SITES_INIT_MAP');
        if (this.state.map)
            setTimeout(() => {
                this.state.map.invalidateSize();
            }, 100);

        // Trigger central GPS request
        console.time('SITES_GPS_REQUEST');
        this.requestGpsLocation(true);

        console.time('SITES_RENDER_LIST');
        this.renderList();
        console.timeEnd('SITES_RENDER_LIST');

        this.updateMapTogglesVisibility();
        this.switchMapMode('leaflet');
    }

    /**
     * Point d'entrée unique pour réagir à la fin d'un fetchWeatherForSites(), quel que soit
     * le déclencheur (chargement initial, changement de modèle météo, re-scope après un
     * changement de filtre/rayon/GPS). Sans ce point commun, seul show() affichait la
     * bannière d'erreur sur un vrai échec (429, réseau...) — les deux autres déclencheurs se
     * contentaient de re-render, laissant les cartes tourner sur "Chargement météo..." sans
     * jamais expliquer pourquoi en cas d'échec réel.
     */
    handleWeatherFetchResult(result) {
        // success === null : cet appel a été annulé par un appel plus récent (filtre, GPS ou
        // modèle météo changé entre-temps) — pas un échec, on laisse cet appel plus récent
        // gérer seul le spinner et la bannière d'erreur éventuelle.
        if (result && result.success === null) return;

        const indicator = document.getElementById('weather-loading-indicator');
        if (indicator) indicator.remove();

        // Échec du téléchargement mais dernière prévision restaurée depuis l'appareil (spec 007) :
        // affichage normal, avec le message « hors ligne » et sans comparaison de modèles.
        if (result && result.success === false && result.restored > 0) {
            this.updateForecastLabel();
            this.renderList();
            this.updateMapMarkers();
            return;
        }

        if (result && result.success === false) {
            this.renderList();
            // Sans météo, le curseur d'heure reste désactivé : le dire au lieu de laisser
            // « Chargement des prévisions... » indéfiniment (sauf si une météo antérieure reste affichée).
            const timeLabel = document.getElementById('forecast-time-label');
            if (timeLabel && Object.keys(SitesService.state.weatherForecasts).length === 0) {
                timeLabel.textContent = tl('weather.unavailable');
            }
            const container = document.getElementById('sites-list-container');
            if (container) {
                const errorHtml = `
                <div style="color:var(--accent-red, #ef4444); font-size: 0.95rem; text-align: center; padding: 16px; margin-bottom: 16px; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); border-radius: var(--radius-lg); width: 100%;">
                    <i class="ri-error-warning-line" style="font-size: 1.2rem; vertical-align: middle; margin-right: 8px;"></i>
                    <strong>${tt('weather.unavailableTitle')}</strong> ${result.error?.message || tt('weather.networkError')}
                    <button id="weather-retry-btn" data-action="fetchWeatherForSites" class="action-btn-primary" style="margin-left: 12px; padding: 4px 12px; font-size: 0.8rem; border-radius: var(--radius-pill);">${tt('weather.retry')}</button>
                </div>
            `;
                container.insertAdjacentHTML('afterbegin', errorHtml);
                this._startWeatherRetryCountdown(result.cooldownRemainingMs || 0);
            }
        } else {
            this.updateForecastLabel();
            this.renderList();
            this.updateMapMarkers();
            // Heure de calcul du modèle (spec 002, FR-003) : demandée à part, sans bloquer ni
            // faire échouer l'affichage ; on ne ré-affiche que si elle est connue.
            SitesService.fetchModelRunTime(SitesService.state.weatherModel).then((runAt) => {
                if (runAt) this.renderList();
            });
            this.loadModelComparison();
        }
    }

    /**
     * Charge le second modèle (même sites, mêmes heures) puis ré-affiche : sans lui, la
     * comparaison est simplement indiquée comme indisponible (spec 002, US3).
     */
    loadModelComparison() {
        SitesService.fetchSecondaryModel()
            .then(() => {
                this.renderList();
                this.updateMapMarkers();
            })
            .catch(() => {});
    }

    setupDropdowns() {
        document.addEventListener('click', (e) => {
            if (!(/** @type {HTMLElement} */ (e.target).closest('.filter-dropdown-container'))) {
                document.querySelectorAll('.filter-dropdown-menu.show').forEach((m) => m.classList.remove('show'));
            }
        });
        this.renderDropdowns();
    }

    renderDropdowns() {
        const winds = WIND_DIRECTIONS;
        const types = ['ATTERRO', 'NATUREL', 'DUNE', 'TREUIL', 'GONFLAGE'].map((id) => ({
            id,
            label: tl(`filters.types.${id}`),
        }));

        const windMenu = document.getElementById('menu-wind');
        if (windMenu) {
            windMenu.innerHTML = winds
                .map((w) => {
                    let stateName = 'neutral';
                    let iconClass = 'ri-checkbox-blank-line';
                    if (SitesService.state.filterWindInclude.includes(w)) {
                        stateName = 'include';
                        iconClass = 'ri-checkbox-fill';
                    } else if (SitesService.state.filterWindExclude.includes(w)) {
                        stateName = 'exclude';
                        iconClass = 'ri-close-circle-fill';
                    }
                    return `
                    <label role="button" tabindex="0" class="filter-option state-${stateName}" data-action="cycleFilterState" data-args="'wind', '${w}'">
                        <span class="custom-filter-icon"><i class="${iconClass}"></i></span>
                        <span class="filter-label">${w}</span>
                    </label>
                `;
                })
                .join('');
        }

        const typeMenu = document.getElementById('menu-type');
        if (typeMenu) {
            typeMenu.innerHTML = types
                .map((t) => {
                    const isChecked = SitesService.state.filterTypeInclude.includes(t.id);
                    return `
                    <label role="button" tabindex="0" class="filter-option" data-action="cycleFilterState" data-args="'type', '${t.id}'" style="display:flex; align-items:center; cursor:pointer;">
                        <input type="checkbox" ${isChecked ? 'checked' : ''} style="margin-right:8px; pointer-events:none;">
                        <span class="filter-label">${t.label}</span>
                    </label>
                `;
                })
                .join('');
        }

        const mapMenu = document.getElementById('menu-map-settings');
        if (mapMenu) {
            const maps = [
                { id: 'leaflet', label: tl('maps.labels.leaflet'), icon: 'ri-map-2-line' },
                { id: 'windy', label: tl('maps.labels.windy'), icon: 'ri-windy-line' },
                { id: 'meteoparapente', label: tl('maps.labels.meteoparapente'), icon: 'ri-temp-hot-line' },
                { id: 'paraglidingearth', label: tl('maps.labels.paraglidingearth'), icon: 'ri-earth-line' },
                { id: 'paraglidable', label: tl('maps.labels.paraglidable'), icon: 'ri-flight-takeoff-line' },
                { id: 'isofronts', label: tl('maps.labels.isofronts'), icon: 'ri-cloud-line' },
            ];

            mapMenu.innerHTML = maps
                .map((m) => {
                    const isActive = SitesService.state.activeMapLayers.includes(m.id);
                    const iconClass = isActive ? 'ri-checkbox-fill' : 'ri-checkbox-blank-line';
                    return `
                    <label role="button" tabindex="0" class="filter-option" style="cursor:pointer;" data-action="toggleMapLayer" data-args="'${m.id}'">
                        <span class="custom-filter-icon"><i class="${iconClass}"></i></span>
                        <span class="filter-label" style="display:flex; align-items:center; gap:8px;"><i class="${m.icon}"></i> ${m.label}</span>
                    </label>
                `;
                })
                .join('');
        }
    }

    toggleDropdown(type) {
        const menu = document.getElementById('menu-' + type);
        document.querySelectorAll('.filter-dropdown-menu.show').forEach((m) => {
            if (m !== menu) m.classList.remove('show');
        });
        if (menu) menu.classList.toggle('show');
    }

    updateBadges() {
        const badgeWind = document.getElementById('badge-wind');
        const badgeType = document.getElementById('badge-type');

        const activeWindsCount =
            SitesService.state.filterWindInclude.length + SitesService.state.filterWindExclude.length;
        const activeTypesCount = SitesService.state.filterTypeInclude.length;

        if (badgeWind) {
            badgeWind.textContent = String(activeWindsCount);
            badgeWind.classList.toggle('active', activeWindsCount > 0);
        }
        if (badgeType) {
            badgeType.textContent = String(activeTypesCount);
            badgeType.classList.toggle('active', activeTypesCount > 0);
        }
    }

    filterByTag(wind) {
        // Force the wind to "Include" state and remove from "Exclude" state
        SitesService.state.filterWindExclude = SitesService.state.filterWindExclude.filter((w) => w !== wind);
        if (!SitesService.state.filterWindInclude.includes(wind)) {
            SitesService.state.filterWindInclude.push(wind);
        }
        SitesService.state.filterWind = SitesService.state.filterWindInclude;

        this.updateBadges();
        this.renderDropdowns();
        SitesService.savePreferences();
        this.renderList();
        SitesService.scheduleWeatherRescopeIfNeeded();
        if (this.state.map) {
            this.updateMapMarkers();
        }

        const screen = document.getElementById('sites-screen');
        if (screen) screen.scrollTo({ top: 0, behavior: 'smooth' });
    }

    filterByType(type) {
        SitesService.state.filterTypeExclude = SitesService.state.filterTypeExclude.filter((t) => t !== type);
        if (!SitesService.state.filterTypeInclude.includes(type)) {
            SitesService.state.filterTypeInclude.push(type);
        }
        SitesService.state.filterType = SitesService.state.filterTypeInclude;

        this.updateBadges();
        this.renderDropdowns();
        SitesService.savePreferences();
        this.renderList();
        SitesService.scheduleWeatherRescopeIfNeeded();
        if (this.state.map) {
            this.updateMapMarkers();
        }

        const screen = document.getElementById('sites-screen');
        if (screen) screen.scrollTo({ top: 0, behavior: 'smooth' });
    }

    updateMapTogglesVisibility() {
        const maps = ['leaflet', 'windy', 'meteoparapente', 'paraglidingearth', 'paraglidable', 'isofronts'];
        let firstVisible = null;

        maps.forEach((m) => {
            const btn = document.getElementById(`map-toggle-${m}`);
            if (btn) {
                if (SitesService.state.activeMapLayers.includes(m)) {
                    btn.style.display = '';
                    if (!firstVisible) firstVisible = m;
                } else {
                    btn.style.display = 'none';
                }
            }
        });

        // Check if the currently active tab is hidden, if so, switch to first visible
        maps.forEach((m) => {
            const btn = document.getElementById(`map-toggle-${m}`);
            if (btn && btn.classList.contains('action-btn-primary') && btn.style.display === 'none') {
                if (firstVisible) {
                    this.switchMapMode(firstVisible);
                }
            }
        });
    }

    updateForecastLabel() {
        const label = document.getElementById('forecast-time-label');
        if (!label) return;

        const offset = SitesService.state.forecastOffset;
        let text = `+${offset}h`;
        if (offset === 0) {
            text = tl('list.now');
        } else {
            // N'importe quel site dont la météo est chargée donne l'heure de cette échéance
            // (toutes les séries horaires partent de la même heure).
            const forecasts = Object.values(SitesService.state.weatherForecasts).find((f) => f && f[offset]);
            if (forecasts) {
                const date = new Date(forecasts[offset].time);
                const day = date.toLocaleDateString('fr-FR', { weekday: 'short' });
                const hour = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                text = `${day.charAt(0).toUpperCase()}${day.slice(1)} ${hour}:${minutes} (+${offset}h)`;
            }
        }
        label.textContent = text;
        const slider = document.getElementById('forecast-slider');
        if (slider) slider.setAttribute('aria-valuetext', text);
    }

    renderSavedLocations() {
        const container = document.getElementById('saved-locations-list');
        if (!container) return;

        const locations = SitesService.state.userPreferences.savedLocations || [];
        container.innerHTML = '';

        locations.forEach((loc, index) => {
            const pill = document.createElement('div');
            pill.style.cssText =
                'background: rgba(14,165,233,0.15); border: 1px solid rgba(14,165,233,0.3); color: var(--accent-blue); padding: 4px 8px; border-radius: 12px; font-size: 0.8rem; display: flex; align-items: center; gap: 4px; cursor: pointer;';

            const label = document.createElement('span');
            label.textContent = loc.name;
            label.setAttribute('role', 'button');
            label.setAttribute('tabindex', '0');
            label.setAttribute('aria-label', tl('places.load', { name: loc.name }));

            const handleLoad = () => SitesService.loadSavedLocation(index);
            label.addEventListener('click', handleLoad);
            label.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleLoad();
                }
            });

            const btnRemove = document.createElement('i');
            btnRemove.className = 'ri-close-line';
            btnRemove.style.cursor = 'pointer';
            btnRemove.style.fontSize = '1rem';
            btnRemove.setAttribute('role', 'button');
            btnRemove.setAttribute('tabindex', '0');
            btnRemove.setAttribute('aria-label', tl('places.remove', { name: loc.name }));

            const handleRemove = (e) => {
                e.stopPropagation();
                SitesService.removeSavedLocation(index);
                this.renderSavedLocations();
            };
            btnRemove.addEventListener('click', handleRemove);
            btnRemove.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleRemove(e);
                }
            });

            pill.appendChild(label);
            pill.appendChild(btnRemove);
            container.appendChild(pill);
        });
    }

    isFieldFilled(val) {
        if (val === null || val === undefined) return false;
        if (typeof val !== 'string') return !!val;
        const cleaned = val.trim().toLowerCase();
        if (cleaned === '' || cleaned === '-' || cleaned === '--') return false;

        const placeholders = [
            'non renseigné',
            'non renseigne',
            'ras',
            'r.a.s.',
            'r.a.s',
            'rien',
            'néant',
            'neant',
            'n/a',
            'na',
            'aucun',
            'aucun danger',
            'aucun danger particulier',
            'aucun danger signalé',
            'aucun danger signale',
        ];
        return !placeholders.includes(cleaned);
    }

    initScrollLogic() {
        const screen = document.getElementById('sites-screen');
        if (screen) {
            screen.addEventListener('scroll', function () {
                const btn = document.getElementById('btn-back-to-top');
                if (btn) {
                    if (this.scrollTop > 100) {
                        btn.classList.add('show');
                    } else {
                        btn.classList.remove('show');
                    }
                }

                // JS fallback for broken CSS position: sticky on mobile Safari/Chrome
                const stickyContainer = /** @type {HTMLElement} */ (
                    document.querySelector('.forecast-sticky-container')
                );
                if (stickyContainer) {
                    if (window.innerWidth <= 768) {
                        // Mobile: apply JS fixed positioning
                        // 150px is roughly when the container reaches the header
                        if (this.scrollTop > 150) {
                            if (!stickyContainer.classList.contains('js-fixed')) {
                                const parent = stickyContainer.parentElement;
                                const rect = parent.getBoundingClientRect();
                                const style = window.getComputedStyle(parent);
                                const paddingLeft = parseFloat(style.paddingLeft);
                                const paddingRight = parseFloat(style.paddingRight);

                                // Create placeholder to prevent content jump and remember original position
                                let placeholder = document.getElementById('sticky-placeholder');
                                if (!placeholder) {
                                    placeholder = document.createElement('div');
                                    placeholder.id = 'sticky-placeholder';
                                    placeholder.style.height = stickyContainer.offsetHeight + 'px';
                                    placeholder.style.marginBottom =
                                        window.getComputedStyle(stickyContainer).marginBottom;
                                    parent.insertBefore(placeholder, stickyContainer);
                                }

                                stickyContainer.style.width = rect.width - paddingLeft - paddingRight + 'px';
                                stickyContainer.style.left = rect.left + paddingLeft + 'px';
                                stickyContainer.classList.add('js-fixed');

                                // Move to body to completely escape any CSS transform/stacking context bugs
                                if (stickyContainer.parentNode !== document.body) {
                                    document.body.appendChild(stickyContainer);
                                }
                            }
                        } else {
                            stickyContainer.classList.remove('js-fixed');
                            stickyContainer.style.width = '';
                            stickyContainer.style.left = '';

                            const placeholder = document.getElementById('sticky-placeholder');
                            if (placeholder) {
                                // Restore original position
                                if (stickyContainer.parentNode === document.body) {
                                    placeholder.parentNode.insertBefore(stickyContainer, placeholder);
                                }
                                placeholder.remove();
                            }
                        }
                    } else {
                        // Desktop: rely on native CSS sticky
                        if (stickyContainer.classList.contains('js-fixed')) {
                            stickyContainer.classList.remove('js-fixed');
                            stickyContainer.style.width = '';
                            stickyContainer.style.left = '';

                            const placeholder = document.getElementById('sticky-placeholder');
                            if (placeholder) {
                                // Restore original position
                                if (stickyContainer.parentNode === document.body) {
                                    placeholder.parentNode.insertBefore(stickyContainer, placeholder);
                                }
                                placeholder.remove();
                            }
                        }
                    }
                }
            });
        }
    }

    scrollToTop() {
        const screen = document.getElementById('sites-screen');
        if (screen) {
            screen.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }
    toggleSitesComparator() {
        this.state.showComparator = !this.state.showComparator;
        const btn = document.getElementById('btn-compare-favorites');
        if (btn) {
            if (this.state.showComparator) {
                btn.classList.add('active');
                btn.innerHTML = `<i class="ri-table-line" style="color: var(--accent-blue);"></i> ${tt('comparator.button')}`;
                btn.style.background = 'rgba(59, 130, 246, 0.15)';
                btn.style.borderColor = 'rgba(59, 130, 246, 0.3)';
            } else {
                btn.classList.remove('active');
                btn.innerHTML = `<i class="ri-table-line"></i> ${tt('comparator.button')}`;
                btn.style.background = 'transparent';
                btn.style.borderColor = 'var(--border-color)';
            }
        }
        this.renderList();
    }

    // Tableau côte-à-côte des sites favoris pour le créneau actuellement affiché (même offset
    // que la liste normale). Ne recalcule rien : réutilise flyableHours/maxConsecutiveHours
    // (déjà calculés par SitesService.getFilteredAndSortedSites pour les badges de la liste)
    // et isForecastFlyable pour le statut météo du créneau en cours.
    renderComparator(activeSites) {
        const listDiv = document.getElementById('sites-list-container');
        if (!listDiv) return;

        const favoriteIds =
            (SitesService.state.userPreferences && SitesService.state.userPreferences.favoriteSites) || [];
        const favoriteSites = activeSites.filter((s) => favoriteIds.includes(s.id));

        listDiv.style.display = 'block';

        if (favoriteSites.length === 0) {
            listDiv.innerHTML = `<div class="card" style="text-align: center; padding: 20px;">${tt('comparator.empty')}</div>`;
            return;
        }

        // Contexte des prévisions (spec 002) : une seule ligne si tous les favoris viennent de la
        // même récupération, sinon une par ligne du tableau.
        const provenanceKeys = new Set(
            favoriteSites.map((site) => {
                const p = SitesService.getForecastProvenance(site.id);
                return p ? `${p.modelKey}|${p.fetchedAt}` : 'none';
            }),
        );
        const sharedContext = provenanceKeys.size === 1;
        const tableContextHtml = sharedContext && favoriteSites.length ? forecastContextHtml(favoriteSites[0].id) : '';

        const rows = favoriteSites
            .map((site) => {
                const forecasts = SitesService.state.weatherForecasts[site.id] || [];
                const weather = forecasts[SitesService.state.forecastOffset];
                const status = weather ? SitesService.isForecastFlyable(site, weather) : null;
                const statusHtml = status
                    ? `<span class="${status.class}" style="display: inline-flex; align-items: center; gap: 4px; font-weight: 600;"><i class="${status.icon}"></i> ${escapeHTML(verdictLabel(status))}</span>`
                    : `<span style="color: var(--text-muted);">${tt('comparator.loading')}</span>`;

                // Meilleur créneau à venir = le plus long slot volable de flyableSlots (déjà groupé
                // par jour par getFilteredAndSortedSites) sur toute la fenêtre de prévision choisie
                // (jusqu'à 7 jours) — c'est le digest "meilleure fenêtre à venir".
                const slots = site.flyableSlots || [];
                const bestSlot = slots.reduce((best, s) => {
                    const duration = s.end - s.start;
                    return !best || duration > best.end - best.start ? s : best;
                }, null);
                const bestSlotHtml = bestSlot
                    ? tt('comparator.slot', { day: bestSlot.dayLabel, start: bestSlot.start, end: bestSlot.end + 1 })
                    : `<span style="color: var(--text-muted);">${tt('comparator.none')}</span>`;

                // Accord du second modèle pour l'heure affichée (spec 002, US3).
                const confidenceHtml = modelAgreementHtml(site) || '<span style="color: var(--text-muted);">—</span>';

                return `
                <tr>
                    <td style="padding: 10px; font-weight: 700;">${escapeHTML(site.nom || site.name || '')}</td>
                    <td style="padding: 10px;">${statusHtml}${sharedContext ? '' : forecastContextHtml(site.id)}</td>
                    <td style="padding: 10px; text-align: center;">${tt('comparator.hours', { hours: site.flyableHours || 0 })}</td>
                    <td style="padding: 10px; text-align: center;">${bestSlotHtml}</td>
                    <td style="padding: 10px;">${confidenceHtml}</td>
                </tr>
            `;
            })
            .join('');

        listDiv.innerHTML = `
            <div class="card" style="padding: 16px; overflow-x: auto;">
                ${tableContextHtml}
                ${verdictReminderHtml(null)}
                <table style="width: 100%; border-collapse: collapse; min-width: 480px;">
                    <thead>
                        <tr style="border-bottom: 1px solid var(--border-color); text-align: left;">
                            <th style="padding: 10px;">${tt('comparator.site')}</th>
                            <th style="padding: 10px;">${tt('comparator.weather')}</th>
                            <th style="padding: 10px; text-align: center;" title="${tt('comparator.flyableTitle')}">${tt('comparator.flyable')}</th>
                            <th style="padding: 10px;" title="${tt('comparator.bestSlotTitle')}">${tt('comparator.bestSlot')}</th>
                            <th style="padding: 10px;" title="${tt('comparator.confidenceTitle')}">${tt('comparator.confidence')}</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
                <p style="margin: 12px 0 0; font-size: 0.8rem; color: var(--text-muted);">${tt('comparator.tip')}</p>
            </div>
        `;
    }

    /**
     * Bouton « Actualiser » d'une prévision ancienne : récupère à nouveau la météo en ignorant
     * le cache. En cas d'échec, l'ancienne prévision reste affichée, signalée, avec la raison.
     */
    async refreshWeather() {
        const result = await SitesService.fetchWeatherForSites({ force: true });
        if (result && result.success === null) return; // remplacé par un appel plus récent
        setRefreshFailure(result && result.success === false ? result.reason || t('forecast.refreshError') : '');
        this.updateForecastLabel();
        this.renderList();
        this.updateMapMarkers();
        if (!getRefreshFailure()) this.loadModelComparison();
    }

    /**
     * Met à jour chaque minute l'âge et l'avertissement des lignes de contexte déjà affichées,
     * sans ré-afficher la liste (spec 002, FR-007).
     */
    updateForecastAges(now = Date.now()) {
        document.querySelectorAll('.forecast-context[data-fetched-at]').forEach((el) => {
            const element = /** @type {HTMLElement} */ (el);
            const provenance = {
                modelKey: element.dataset.modelKey,
                fetchedAt: Number(element.dataset.fetchedAt),
                runAt: element.dataset.runAt ? Number(element.dataset.runAt) : null,
            };
            const { html, stale } = forecastContextInner(provenance, now);
            element.innerHTML = html;
            element.classList.toggle('forecast-context--stale', stale);
        });
    }

    /**
     * Message « Recherche centrée sur Boulogne-sur-Mer » tant qu'aucune position (GPS, adresse)
     * n'est connue (spec 002, FR-017). Appelé à chaque rendu de la liste.
     */
    renderLocationContext() {
        const notice = document.getElementById('default-location-notice');
        if (!notice) return;
        const isDefault = !!SitesService.getEffectiveLocation().isDefault;
        notice.hidden = !isDefault;
        notice.textContent = isDefault ? t('forecast.defaultLocationNotice') : '';
    }

    /**
     * Message affiché tant que la liste montre des prévisions restaurées depuis l'appareil
     * (spec 007, FR-004) : hors ligne ou service indisponible, et date de récupération.
     */
    buildOfflineForecastNotice() {
        if (SitesService.state.forecastSource !== 'saved') return '';
        const times = Object.values(SitesService.state.forecastProvenance || {}).map((p) => p.fetchedAt);
        if (times.length === 0) return '';
        const oldest = new Date(Math.min(...times));
        const now = new Date();
        const sameDay = oldest.toDateString() === now.toDateString();
        const time = `${String(oldest.getHours()).padStart(2, '0')} h ${String(oldest.getMinutes()).padStart(2, '0')}`;
        const when = sameDay
            ? tl('notice.today', { time })
            : tl('notice.otherDay', {
                  date: oldest.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
                  time,
              });
        const key = navigator.onLine === false ? 'forecast.offlineSaved' : 'forecast.serviceDownSaved';
        return `<p id="offline-forecast-notice" class="location-notice offline-forecast-notice" role="status"><i class="ri-wifi-off-line" aria-hidden="true"></i> ${escapeHTML(t(key, { when }))}</p>`;
    }

    /** Sites trouvés par la recherche mais hors du rayon : signalés, jamais interrogés (FR-019). */
    buildSearchOutsideNotice() {
        const count = SitesService.countSearchMatchesOutsideRadius();
        if (!count) return '';
        const km = SitesService.state.radiusLimit;
        const text =
            count === 1
                ? t('forecast.searchOutsideRadiusOne', { km })
                : t('forecast.searchOutsideRadius', { count, km });
        return `<p class="location-notice search-outside-notice" role="status">${escapeHTML(text)}</p>`;
    }

    renderList() {
        const listDiv = document.getElementById('sites-list-container');
        if (!listDiv) return;

        const activeSites = SitesService.getFilteredAndSortedSites(SitesService.getSites());
        this.renderLocationContext();

        if (this.state.showComparator) {
            this.renderComparator(activeSites);
            return;
        }

        listDiv.innerHTML = '';
        if (activeSites.length === 0) {
            listDiv.style.display = 'block';
            listDiv.innerHTML =
                this.buildOfflineForecastNotice() +
                this.buildSearchOutsideNotice() +
                `<div class="card" style="text-align: center; padding: 20px;">${tt('list.empty')}</div>`;
        } else {
            listDiv.style.display = 'flex';
            let html = '';
            // Limit render to 50 for performance
            for (let i = 0; i < Math.min(activeSites.length, 50); i++) {
                const site = activeSites[i];
                let orientations = [];
                if (Array.isArray(site.orientations_vent)) orientations = site.orientations_vent;
                else if (typeof site.orientations_vent === 'string')
                    orientations = site.orientations_vent.split(',').map((v) => v.trim());
                else if (site.orientation) orientations = site.orientation.split(',').map((v) => v.trim());

                const windTags = orientations
                    .map(
                        (w) =>
                            `<span role="button" tabindex="0" class="wind-tag" data-action="SitesfilterByTag" data-args="${escapeHTML(w)}" title="${tt('filters.windTitle', { wind: w })}">${w}</span>`,
                    )
                    .join('');

                const st = site.site_sous_type || site.type || tl('list.unknownType');
                const siteTypes = Array.isArray(st) ? st : [st];
                const typeLabel = siteTypes
                    .map((t) => {
                        return `<span role="button" tabindex="0" class="site-coords-badge site-type-badge" data-action="SitesfilterByType" data-args="${escapeHTML(t)}" style="cursor: pointer;" title="${tt('filters.typeTitle', { type: t })}">${t}</span>`;
                    })
                    .join(' ');

                let distanceHtml = '';
                if (site.distance !== undefined) {
                    distanceHtml = `
                        <span class="site-coords-badge site-dist-badge">
                            <i class="ri-navigation-fill"></i> ${tt('list.distance', { km: site.distance.toFixed(1) })}
                        </span>
                    `;
                }

                const flyableHoursHtml = `
                    <span class="site-coords-badge" style="background: ${site.flyableHours > 0 ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.03)'}; border-color: ${site.flyableHours > 0 ? 'rgba(34,197,94,0.3)' : 'var(--border-color)'}; color: ${site.flyableHours > 0 ? 'var(--accent-green)' : 'var(--text-muted)'}; font-weight: 700;">
                        <i class="ri-time-line"></i> ${tt('list.flyableHours', { hours: site.flyableHours || 0 })} ${(site.maxConsecutiveHours || 0) > 0 ? tt('list.consecutive', { hours: site.maxConsecutiveHours }) : ''}
                    </span>
                `;

                let weatherHtml;
                let weather = null;
                // Distingue "jamais interrogé" (weatherForecasts[site.id] absent) de "requête
                // terminée mais Open-Meteo n'a renvoyé aucune heure exploitable pour ce site"
                // (entrée présente mais vide, ex: coordonnées hors couverture) : sans ça, ce
                // deuxième cas réaffiche indéfiniment "Chargement météo..." puisque plus rien
                // ne vient jamais la remplacer.
                const hasWeatherEntry = Object.prototype.hasOwnProperty.call(
                    SitesService.state.weatherForecasts,
                    site.id,
                );
                const forecasts = SitesService.state.weatherForecasts[site.id] || [];
                if (forecasts && forecasts[SitesService.state.forecastOffset]) {
                    weather = forecasts[SitesService.state.forecastOffset];
                }
                if (weather) {
                    const status = SitesService.isForecastFlyable(site, weather);
                    weatherHtml = `
                        <div class="site-weather-row ${status.class}" style="display: flex; flex-direction: column; gap: 6px; margin-top: 12px; padding: 8px 12px; border-radius: 8px; font-size: 0.9rem; font-weight: 500;">
                            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%;">
                                <span style="display: flex; align-items: center; gap: 6px;">
                                    <i class="ri-windy-line"></i>
                                    <span>${th('list.windRow', {
                                        card: `<b>${escapeHTML(String(forecastValue(weather.windCard)))}</b>`,
                                        deg: escapeHTML(String(forecastValue(weather.windDirDeg))),
                                        speed: `<b>${tt('list.speed', { value: forecastValue(weather.windSpeed) })}</b>`,
                                        gust: `<b>${escapeHTML(String(forecastValue(weather.windGust)))}</b>`,
                                    })}</span>
                                </span>
                                <span style="display: flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; text-transform: uppercase;">
                                    <i class="${status.icon}"></i> ${escapeHTML(status.reason)}
                                </span>
                            </div>
                            ${missingValuesText(status) ? `<div class="weather-missing-values" style="font-size: 0.8rem;">${escapeHTML(missingValuesText(status))}</div>` : ''}
                        </div>
                        ${status.status === 'incomplete' ? '' : modelAgreementHtml(site)}
                        ${forecastContextHtml(site.id)}
                        ${verdictReminderHtml(status)}
                    `;
                } else if (SitesService.state.forecastSource === 'saved') {
                    // Hors ligne : ce site n'a pas de prévision enregistrée sur l'appareil (spec 007).
                    weatherHtml = `
                        <div class="weather-loading">
                            <i class="ri-wifi-off-line"></i>
                            <span>${escapeHTML(t('forecast.unavailableOffline'))}</span>
                        </div>
                    `;
                } else if (hasWeatherEntry) {
                    weatherHtml = `
                        <div class="weather-loading">
                            <i class="ri-error-warning-line"></i>
                            <span>${tt('weather.unavailableForSite')}</span>
                        </div>
                    `;
                } else {
                    weatherHtml = `
                        <div class="weather-loading">
                            <i class="ri-loader-4-line" style="animation: spin 1s linear infinite;"></i>
                            <span>${escapeHTML(t('forecast.loading', { model: modelLabel(SitesService.state.weatherModel) }))}</span>
                        </div>
                    `;
                }

                let slotsTextHtml = '';
                if (site.flyableSlots && site.flyableSlots.length > 0) {
                    const groupedByDay = {};
                    site.flyableSlots.forEach((slot) => {
                        if (!groupedByDay[slot.dayLabel]) groupedByDay[slot.dayLabel] = [];
                        groupedByDay[slot.dayLabel].push(tl('list.slotRange', { start: slot.start, end: slot.end }));
                    });
                    const slotsDetails = Object.keys(groupedByDay)
                        .map((day) => {
                            return `<span><b>${day}</b> (${groupedByDay[day].join(', ')})</span>`;
                        })
                        .join(' | ');
                    slotsTextHtml = `
                        <div class="creneaux-list good">
                            <i class="ri-calendar-todo-line"></i> ${th('list.nextSlots', { slots: slotsDetails })}
                        </div>
                    `;
                } else if (forecasts.length > 0 && site.completeHours === 0) {
                    // Aucune heure complète : ne pas laisser croire que les conditions sont
                    // mauvaises, il n'y a simplement pas de prévision fiable (spec 001, FR-009).
                    slotsTextHtml = `
                        <div class="creneaux-list incomplete">
                            <i class="ri-question-line"></i> ${escapeHTML(t('weather.noReliableForecast'))}
                        </div>
                    `;
                } else if (!site.flyableHours) {
                    const maxRange = SitesService.state.forecastMaxRange || 120;
                    slotsTextHtml = `
                        <div class="creneaux-list bad">
                            <i class="ri-error-warning-line"></i> ${tt('list.noSlot', { hours: maxRange })}
                        </div>
                    `;
                }

                let timelineBarsHtml = '';
                const maxRange = SitesService.state.forecastMaxRange || 120;
                const forecastsToUse = forecasts.slice(0, maxRange);
                for (let j = 0; j < maxRange; j++) {
                    const w = forecastsToUse[j];
                    let barColor = 'rgba(255,255,255,0.05)';
                    let statusLabel = tl('list.unknownStatus');
                    let timeStr = `+${j}h`;
                    let dotClass = 'timeline-hour-dot';

                    if (w) {
                        const status = SitesService.isForecastFlyable(site, w);
                        const date = new Date(w.time);
                        const h = String(date.getHours()).padStart(2, '0');
                        const m = String(date.getMinutes()).padStart(2, '0');
                        const days = FR.sites.list.weekdays;
                        timeStr = `${days[date.getDay()]} ${h}:${m}`;
                        barColor = verdictColor(status, { bar: true });
                        if (status.status === 'incomplete') {
                            dotClass += ' timeline-hour-dot--incomplete';
                            statusLabel = verdictLabel(status);
                        } else if (status.flyable) {
                            statusLabel = status.warning
                                ? tl('list.warningTooltip', {
                                      card: forecastValue(w.windCard),
                                      speed: forecastValue(w.windSpeed),
                                      reason: status.reason,
                                  })
                                : tl('list.flyableTooltip', {
                                      card: forecastValue(w.windCard),
                                      speed: forecastValue(w.windSpeed),
                                      gust: forecastValue(w.windGust),
                                  });
                        } else {
                            statusLabel = status.reason;
                        }
                    }
                    // Une heure incomplète garde le fond hachuré de sa classe CSS (pas de couleur).
                    const background = dotClass.includes('--incomplete') ? '' : ` background: ${barColor};`;
                    let dotStyle = `flex: 1; height: 100%;${background} transition: all 0.2s; cursor: pointer;`;
                    if (j === SitesService.state.forecastOffset) {
                        dotStyle += ` outline: 1.5px solid var(--text-main); transform: scaleY(1.3); z-index: 5; box-shadow: 0 0 6px var(--accent-blue);`;
                    }
                    timelineBarsHtml += `<div role="button" tabindex="0" class="${dotClass}" style="${dotStyle}" title="${escapeHTML(`${timeStr} : ${statusLabel}`)}" data-action="SitessetForecastOffset" data-args="${j}"></div>`;
                }

                const isFav =
                    SitesService.state.userPreferences &&
                    SitesService.state.userPreferences.favoriteSites &&
                    SitesService.state.userPreferences.favoriteSites.includes(site.id);
                const userToggled =
                    SitesService.state.userPreferences &&
                    SitesService.state.userPreferences.minimizedSites &&
                    SitesService.state.userPreferences.minimizedSites.includes(site.id);

                const isMinimized = isFav ? userToggled : !userToggled;

                html +=
                    `<div class="site-card ${isMinimized ? 'minimized' : ''}">` +
                    this.buildSiteCardHtml(
                        site,
                        windTags,
                        typeLabel,
                        distanceHtml,
                        flyableHoursHtml,
                        weatherHtml,
                        timelineBarsHtml,
                        slotsTextHtml,
                        isMinimized,
                    ) +
                    `</div>`;
            }
            listDiv.innerHTML = this.buildOfflineForecastNotice() + this.buildSearchOutsideNotice() + html;
        }

        this.updateBadges();
    }
    // Brief pré-vol : rappelle le niveau de brevet actuellement sélectionné (à confronter avec
    // la praticabilité/les dangers du site affichés juste en dessous dans le même panneau — la
    // base FFVL ne fournit pas de niveau requis structuré par site, donc pas de verdict
    // compatible/incompatible fabriqué ici) et l'état du matériel du pilote, en réutilisant
    // LogbookService.computeEquipmentWear() (déjà utilisé pour le badge de révision du Carnet).
    buildPreFlightBriefHtml() {
        const level = GlobalState.get('level') || 'ALL';
        const levelLabel = FR.sites.brief.levels[level] || level;

        let equipmentHtml = `<span style="color: var(--text-muted);">${tt('brief.noEquipment')}</span>`;
        try {
            const wear = LogbookService.computeEquipmentWear();
            const alertCount = Object.values(wear).filter((s) => s.alerts.dateAlert || s.alerts.hoursAlert).length;
            if (alertCount > 0) {
                equipmentHtml = `<span style="color: #f59e0b; font-weight: 600;">${tt(alertCount > 1 ? 'brief.toReviewMany' : 'brief.toReviewOne', { count: alertCount })}</span>`;
            } else if (Object.keys(wear).length > 0) {
                equipmentHtml = `<span style="color: var(--accent-green); font-weight: 600;">${tt('brief.upToDate')}</span>`;
            }
        } catch {
            // Carnet non disponible : on garde le message par défaut plutôt que de faire planter la carte.
        }

        return `
        <div class="rich-detail-item default" style="background: rgba(59, 130, 246, 0.06); border-radius: 8px;">
            <i class="ri-flight-takeoff-line rich-detail-icon blue"></i>
            <div>
                <strong class="rich-detail-label muted">${tt('brief.title')}</strong>
                <span class="rich-detail-value">${th('brief.level', { level: `<b>${escapeHTML(levelLabel)}</b>` })}</span>
                <div style="margin-top: 4px; font-size: 0.9rem;">${th('brief.equipment', { equipment: equipmentHtml })}</div>
            </div>
        </div>
    `;
    }

    buildSiteCardHtml(
        site,
        windTags,
        typeLabel,
        distanceHtml,
        flyableHoursHtml,
        weatherHtml,
        timelineBarsHtml,
        slotsTextHtml,
        isMinimized,
    ) {
        const isFav =
            SitesService.state.userPreferences && SitesService.state.userPreferences.favoriteSites.includes(site.id);
        const starIcon = isFav ? 'ri-star-fill' : 'ri-star-line';
        const starColor = isFav ? '#fbbf24' : 'var(--text-muted)';
        const minIcon = isMinimized ? 'ri-add-line' : 'ri-subtract-line';

        // Pas de widget iframe tiers dans la carte (rendu blanc non maîtrisable,
        // impossible à intégrer proprement dans le thème sombre) : un simple badge
        // natif, cohérent avec les autres badges de la carte, qui ouvre le détail
        // complet (graphique, rose des vents) dans la modale au clic.
        const spotairId = !isMinimized ? getSpotairWidgetId(site) : null;
        const spotairBadgeHtml = spotairId
            ? `
        <button class="site-coords-badge site-spotair-badge" data-spotair-id="${spotairId}" data-site-id="${site.id}"
            data-action="SitesopenSpotairModal"
            title="${tt('card.spotairTitle')}">
            <i class="ri-windy-line"></i> ${tt('card.spotairBadge')}
        </button>
    `
            : '';

        return `
            <div class="site-card-header site-card-header-row">
                <div class="site-info site-info-row">
                    <div class="site-title-row">
                        <button class="favorite-toggle-btn" data-action="toggleFavorite" data-args="'${site.id}'" title="${tt('card.favorite')}" style="background: none; border: none; font-size: 1.4rem; color: ${starColor}; cursor: pointer; padding: 0;">
                            <i class="${starIcon}"></i>
                        </button>
                        <button class="minimize-toggle-btn" data-action="toggleMinimize" data-args="'${site.id}'" title="${tt('card.minimize')}" style="background: none; border: none; font-size: 1.4rem; color: var(--text-muted); cursor: pointer; padding: 0;">
                            <i class="${minIcon}"></i>
                        </button>
                        <h3 class="site-card-title">${escapeHTML(site.nom)}</h3>
                    </div>
                    <div class="site-badges-row">
                        ${
                            site.alt
                                ? `
                        <span class="site-coords-badge site-altitude-badge" title="${tt('card.altitudeTitle')}">
                            <i class="ri-landscape-fill"></i> ${tt('card.altitude', { alt: site.alt })}
                        </span>
                        `
                                : ''
                        }
                        <div class="site-wind-tags site-wind-tags-row">${windTags}</div>
                        ${typeLabel}
                        ${spotairBadgeHtml}
                        <button class="site-coords-badge copy-coords-btn" data-action="copyCoords" data-args="'${parseFloat(site.latitude || site.lat)}', '${parseFloat(site.longitude || site.lon)}'" title="${tt('card.copyTitle')}">
                            <i class="ri-map-pin-2-line"></i> <span class="coords-text">${parseFloat(site.latitude || site.lat)}, ${parseFloat(site.longitude || site.lon)}</span>
                        </button>
                        ${distanceHtml}
                        ${flyableHoursHtml}
                    </div>
                </div>
                <div class="site-actions-container">
                    ${
                        safeHttpUrl(site.url)
                            ? `
                    <a class="action-btn-secondary ffvl-btn" href="${escapeHTML(safeHttpUrl(site.url))}" target="_blank" rel="noopener noreferrer" title="${tt('card.ffvlTitle')}">
                        <img src="img/logos/ffvl.png" alt="${tt('card.ffvl')}"> ${tt('card.ffvl')}
                    </a>
                    `
                            : ''
                    }
                    <button class="action-btn-spot spot-it-btn" data-action="spotSite" data-args="'${parseFloat(site.latitude || site.lat)}', '${parseFloat(site.longitude || site.lon)}', '${escapeHTML(site.nom)}', '${site.id || ''}'" title="${tt('card.spotItTitle')}">
                        <i class="ri-focus-3-line"></i> ${tt('card.spotIt')}
                    </button>
                    <button class="action-btn-primary gps-btn" data-action="openGpsMenu" data-args="'${parseFloat(site.latitude || site.lat)}', '${parseFloat(site.longitude || site.lon)}'">
                        <i class="ri-navigation-line"></i> ${tt('card.goThere')}
                    </button>
                </div>
            </div>
            ${
                isMinimized
                    ? ''
                    : `
            ${weatherHtml}
            <div style="margin-top: 14px;">
                <div class="timeline-labels">
                    <span>${tt('list.now')}</span><span>${tt('list.forecasts', { hours: SitesService.state.forecastMaxRange || 120 })}</span><span>${tt('list.inDays', { days: (SitesService.state.forecastMaxRange || 120) / 24 })}</span>
                </div>
                <div class="ranking-timeline">
                    ${timelineBarsHtml}
                </div>
                <div class="timeline-legend">
                    <span class="legend-item"><span class="legend-color" style="background:#22c55e;"></span> ${tt('list.legend.flyable')}</span>
                    <span class="legend-item"><span class="legend-color" style="background:#eab308;"></span> ${tt('list.legend.unknownOrientation')}</span>
                    <span class="legend-item"><span class="legend-color" style="background:#ef4444;"></span> ${tt('list.legend.wind')}</span>
                    <span class="legend-item"><span class="legend-color" style="background:#f97316;"></span> ${tt('list.legend.wrongOrientation')}</span>
                    <span class="legend-item"><span class="legend-color" style="background:#3b82f6;"></span> ${tt('list.legend.rain')}</span>
                    <span class="legend-item"><span class="legend-color" style="background:rgba(100,100,120,0.5);"></span> ${tt('list.legend.night')}</span>
                    <span class="legend-item"><span class="legend-color legend-color--incomplete"></span> ${escapeHTML(t('weather.legendIncomplete'))}</span>
                </div>
            </div>
            ${slotsTextHtml}
            ${(() => {
                const showConv = this.isFieldFilled(site.conventionnement);
                const showPrat = this.isFieldFilled(site.praticabilite);
                const showGest = this.isFieldFilled(site.structure_gestionnaire);
                const showAero = this.isFieldFilled(site.aerologie_ideale);
                const showSec = this.isFieldFilled(site.secours_acces);
                const showDang = this.isFieldFilled(site.dangers);
                const showTopo = this.isFieldFilled(site.acces_topo);

                const showObs = this.isFieldFilled(site.observations);
                const showRes = this.isFieldFilled(site.restrictions);
                const showReg = this.isFieldFilled(site.reglementation);

                const isOpen = this.state.expandedSites[site.id] ? 'open' : '';
                const toggleText = tt(this.state.expandedSites[site.id] ? 'card.lessInfo' : 'card.moreInfo');

                return `
                    <details class="site-details-toggle" ${isOpen} data-site-id="${site.id}">
                        <summary>
                            <span class="toggle-text">${toggleText}</span>
                            <i class="ri-arrow-down-s-line"></i>
                        </summary>
                        <div class="site-rich-details">

                            ${this.buildPreFlightBriefHtml()}

                            ${
                                showConv
                                    ? `
                            <div class="rich-detail-item default">
                                <i class="ri-shield-check-line rich-detail-icon blue"></i>
                                <div>
                                    <strong class="rich-detail-label muted">${tt('details.conventionnement')}</strong>
                                    <span class="rich-detail-value">${renderSiteText(site.conventionnement)}</span>
                                </div>
                            </div>
                            `
                                    : ''
                            }
                            ${
                                showPrat
                                    ? `
                            <div class="rich-detail-item default">
                                <i class="ri-checkbox-circle-line rich-detail-icon ${site.affiche ? 'green' : 'red'}"></i>
                                <div>
                                    <strong class="rich-detail-label muted">${tt('details.praticabilite')}</strong>
                                    <span class="rich-detail-value">${renderSiteText(site.praticabilite)}</span>
                                </div>
                            </div>
                            `
                                    : ''
                            }
                            ${
                                showGest
                                    ? `
                            <div class="rich-detail-item default">
                                <i class="ri-group-line rich-detail-icon secondary"></i>
                                <div>
                                    <strong class="rich-detail-label muted">${tt('details.gestionnaire')}</strong>
                                    <span class="rich-detail-value">${renderSiteText(site.structure_gestionnaire)}</span>
                                </div>
                            </div>
                            `
                                    : ''
                            }
                            ${
                                showAero
                                    ? `
                            <div class="rich-detail-item default">
                                <i class="ri-compass-3-line rich-detail-icon blue"></i>
                                <div>
                                    <strong class="rich-detail-label muted">${tt('details.aerologie')}</strong>
                                    <span class="rich-detail-value">${renderSiteText(site.aerologie_ideale)}</span>
                                </div>
                            </div>
                            `
                                    : ''
                            }
                            ${
                                showSec
                                    ? `
                            <div class="rich-detail-item default">
                                <i class="ri-first-aid-kit-line rich-detail-icon green"></i>
                                <div>
                                    <strong class="rich-detail-label muted">${tt('details.secours')}</strong>
                                    <span class="rich-detail-value">${renderSiteText(site.secours_acces)}</span>
                                </div>
                            </div>
                            `
                                    : ''
                            }
                            ${
                                showDang
                                    ? `
                            <div class="rich-detail-item danger">
                                <i class="ri-error-warning-line rich-detail-icon red"></i>
                                <div>
                                    <strong class="rich-detail-label red">${tt('details.dangers')}</strong>
                                    <span class="rich-detail-value">${renderSiteText(site.dangers)}</span>
                                </div>
                            </div>
                            `
                                    : ''
                            }
                            ${
                                showTopo
                                    ? `
                            <div class="rich-detail-item default full-width">
                                <i class="ri-walk-line rich-detail-icon secondary"></i>
                                <div>
                                    <strong class="rich-detail-label muted">${tt('details.topo')}</strong>
                                    <span class="rich-detail-value">${renderSiteText(site.acces_topo)}</span>
                                </div>
                            </div>
                            `
                                    : ''
                            }
                            ${
                                showObs
                                    ? `
                            <div class="rich-detail-item obs">
                                <i class="ri-information-line rich-detail-icon blue"></i>
                                <div>
                                    <strong class="rich-detail-label muted">${tt('details.observations')}</strong>
                                    <span class="rich-detail-value">${renderSiteText(site.observations)}</span>
                                </div>
                            </div>
                            `
                                    : ''
                            }
                            ${
                                showRes
                                    ? `
                            <div class="rich-detail-item danger">
                                <i class="ri-forbid-line rich-detail-icon red"></i>
                                <div>
                                    <strong class="rich-detail-label red">${tt('details.restrictions')}</strong>
                                    <span class="rich-detail-value">${renderSiteText(site.restrictions)}</span>
                                </div>
                            </div>
                            `
                                    : ''
                            }
                            ${
                                showReg
                                    ? `
                            <div class="rich-detail-item obs">
                                <i class="ri-article-line rich-detail-icon blue"></i>
                                <div>
                                    <strong class="rich-detail-label muted">${tt('details.reglementation')}</strong>
                                    <span class="rich-detail-value">${renderSiteText(site.reglementation)}</span>
                                </div>
                            </div>
                            `
                                    : ''
                            }
                        </div>
                    </details>
                `;
            })()}
            `
            }
        `;
    }

    copyCoords(lat, lng, btnRef) {
        const coords = lat + ', ' + lng;
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard
                .writeText(coords)
                .then(() => {
                    const originalHtml = btnRef.innerHTML;
                    btnRef.innerHTML = `<i class="ri-check-line" style="color: var(--accent-green);"></i> <span style="color: var(--accent-green);">${tt('card.copied')}</span>`;
                    btnRef.style.borderColor = 'var(--accent-green)';
                    setTimeout(() => {
                        btnRef.innerHTML = originalHtml;
                        btnRef.style.borderColor = '';
                    }, 2000);
                })
                .catch((err) => {
                    console.error('Failed to copy: ', err);
                });
        } else {
            const textarea = document.createElement('textarea');
            textarea.value = coords;
            textarea.style.position = 'fixed';
            document.body.appendChild(textarea);
            textarea.select();
            try {
                document.execCommand('copy');
                const originalHtml = btnRef.innerHTML;
                btnRef.innerHTML = `<i class="ri-check-line" style="color: var(--accent-green);"></i> <span style="color: var(--accent-green);">${tt('card.copied')}</span>`;
                btnRef.style.borderColor = 'var(--accent-green)';
                setTimeout(() => {
                    btnRef.innerHTML = originalHtml;
                    btnRef.style.borderColor = '';
                }, 2000);
            } catch (err) {
                console.error('Fallback copy failed', err);
            }
            document.body.removeChild(textarea);
        }
    }

    jumpToSiteCard(siteId) {
        const target = document.getElementById(`site-card-${siteId}`);
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            target.classList.add('highlight-glow');
            setTimeout(() => {
                target.classList.remove('highlight-glow');
            }, 2000);
        }
    }

    handleDetailsToggle(siteId, detailsEl) {
        if (!this.state.expandedSites) {
            this.state.expandedSites = {};
        }
        this.state.expandedSites[siteId] = detailsEl.open;
        const toggleTextEl = detailsEl.querySelector('.toggle-text');
        if (toggleTextEl) {
            toggleTextEl.textContent = tl(detailsEl.open ? 'card.lessInfo' : 'card.moreInfo');
        }
    }
}

const SitesView = new SitesViewClass();
export default SitesView;
