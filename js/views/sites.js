/**
 * VIEW - SitesView
 * Dumb UI strictly focused on DOM and Leaflet Map Rendering.
 */
import SitesService, { SITES_EVENTS } from '../services/sites_service.js';
import { WIND_DIRECTIONS } from '../data/weather_config.js';
import GdprEngine from '../gdpr_engine.js';

import { SitesListBase } from './sites_list.js';
import AppEvents, { FORM_FIELDS } from '../core/events.js';
import { t } from '../utils/i18n.js';

import { forecastContextInner, radiusLabel, setRefreshFailure, getRefreshFailure } from './sites_forecast.js';
import { tt, tl } from './sites_strings.js';
// Utilisés ailleurs (tests, autres écrans) : on les ré-exporte depuis ici.
export { modelLabel, formatForecastContext, formatAge, radiusLabel } from './sites_forecast.js';

class SitesViewClass extends SitesListBase {
    async mount(container) {
        console.time('SITES_MOUNT_TOTAL');
        await super.mount(container);
        await SitesService.ensureSitesLoaded();
        // S'abonner AVANT l'initialisation du service : il peut annoncer des mises à jour dès init().
        this.subscribeToService();
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

    /**
     * Applique les mises à jour d'affichage annoncées par SitesService (SITES_EVENTS). L'abonnement
     * n'existe que pendant que l'écran est ouvert ; un remontage sans fermeture ne le double pas.
     */
    subscribeToService() {
        this.unsubscribeFromService();
        this._serviceSubscriptions = [
            SitesService.on(SITES_EVENTS.LIST, () => this.renderList()),
            SitesService.on(SITES_EVENTS.MARKERS, () => this.updateMapMarkers()),
            SitesService.on(SITES_EVENTS.MAP_TOGGLES, () => this.updateMapTogglesVisibility()),
            SitesService.on(SITES_EVENTS.FORECAST_LABEL, () => this.updateForecastLabel()),
            SitesService.on(SITES_EVENTS.BADGES, () => this.updateBadges()),
            SitesService.on(SITES_EVENTS.DROPDOWNS, () => this.renderDropdowns()),
            SitesService.on(SITES_EVENTS.WEATHER_FETCHED, (result) => this.handleWeatherFetchResult(result)),
        ];
    }

    unsubscribeFromService() {
        for (const unsubscribe of this._serviceSubscriptions ?? []) unsubscribe();
        this._serviceSubscriptions = [];
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
        this.unsubscribeFromService();
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
                statusEl.innerHTML = `<i class="ri-shield-user-line" style="color: var(--text-muted);"></i> ${tt('gps.disabled')} <a href="#" data-action="GdprshowModal" data-args="gdpr-settings-modal" data-prevent-default style="color: var(--accent-orange);">${tt('gps.manage')}</a>`;
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
                    gpsBtn.style.borderColor = 'var(--accent-orange)';
                    gpsBtn.style.color = 'var(--accent-orange)';
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
                        btn.style.color = 'var(--accent-orange)';
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
                'background: rgba(14,165,233,0.15); border: 1px solid rgba(14,165,233,0.3); color: var(--accent-orange); padding: 4px 8px; border-radius: 12px; font-size: 0.8rem; display: flex; align-items: center; gap: 4px; cursor: pointer;';

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
}

const SitesView = new SitesViewClass();
export default SitesView;
