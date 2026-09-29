/**
 * VIEW - SitesView
 * Dumb UI strictly focused on DOM and Leaflet Map Rendering.
 */
import GlobalState from '../core/app_state.js';
import SitesService from '../services/sites_service.js';
import LogbookService from '../services/logbook_service.js';
import { WIND_DIRECTIONS } from '../data/weather_config.js';
import { getSpotairWidgetId } from '../data/spotair_widgets.js';
import { escapeHTML } from '../core/security.js';
import GdprEngine from '../gdpr_engine.js';

import BaseView from '../core/base_view.js';
import { t } from '../utils/i18n.js';

// ---------------------------------------------------------------------------------------------
// Affichage des verdicts météo (spec 001, contracts/ui-states.md). Les couleurs et libellés sont
// choisis à partir de `status` / `reasonCode`, jamais en comparant le texte affiché.
// ---------------------------------------------------------------------------------------------

/** Valeur de prévision affichable : « — » quand elle manque, jamais null, NaN ou 0 inventé. */
function forecastValue(value) {
    return value === null || value === undefined || Number.isNaN(value) ? t('weather.missingPlaceholder') : value;
}

/** « Indisponible : vent moyen, rafales » pour une heure incomplète, sinon ''. */
function missingValuesText(status) {
    if (!status || status.status !== 'incomplete' || !status.missing?.length) return '';
    const labels = status.missing.map((code) => t(`weather.missing.${code}`));
    return t('weather.unavailableList', { list: labels.join(', ') });
}

/** Couleur d'un verdict pour le marqueur de carte (`bar: false`) ou la frise horaire. */
function verdictColor(status, { bar = false } = {}) {
    if (!status || status.status === 'loading' || status.status === 'incomplete')
        return bar ? 'transparent' : '#94a3b8';
    if (status.status === 'flyable') return status.warning ? '#eab308' : bar ? 'var(--accent-green)' : '#22c55e';
    if (status.reasonCode === 'NIGHT') return bar ? 'rgba(100,100,120,0.3)' : '#475569';
    if (status.reasonCode === 'RAIN') return '#3b82f6';
    if (status.reasonCode === 'WRONG_ORIENTATION') return '#f97316';
    return '#ef4444';
}

/**
 * Rappel affiché avec chaque verdict (spec 001 FR-010b, constitution principe II) : l'avis de
 * l'application repose sur des prévisions, le risque d'orage est estimé, le pilote décide.
 * Rien quand il n'y a pas de verdict (chargement, prévision incomplète).
 */
function verdictReminderHtml(status) {
    if (status && status.status !== 'flyable' && status.status !== 'unflyable') return '';
    return `<p class="verdict-reminder"><i class="ri-information-line" aria-hidden="true"></i> ${escapeHTML(t('weather.reminder'))}</p>`;
}

/** Libellé court d'un verdict (infobulles, tableau) : raison + données manquantes éventuelles. */
function verdictLabel(status) {
    const missing = missingValuesText(status);
    return missing ? `${status.reason} — ${missing}` : status.reason;
}

class SitesViewClass extends BaseView {
    constructor() {
        super();
        this.state = {
            map: null,
            markersGroup: null,
            tileLayer: null,
            mapResizeObserver: null,
            mapExpanded: true,
            expandedSites: {},
            currentSiteCoords: null,
            _spottedSite: null,
            showComparator: false,
        };
    } // Ends constructor

    async mount(container) {
        console.time('SITES_MOUNT_TOTAL');
        await super.mount(container);
        await SitesService.ensureSitesLoaded();
        console.time('SITES_SERVICE_INIT');
        SitesService.init();
        console.timeEnd('SITES_SERVICE_INIT');

        this.setupEventListeners();
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
            btn.textContent = `Réessayer dans ${mins} min`;
        };
        label();

        this._weatherRetryInterval = setInterval(() => {
            remainingMs -= 1000;
            if (remainingMs <= 0) {
                clearInterval(this._weatherRetryInterval);
                btn.disabled = false;
                btn.style.opacity = '';
                btn.style.cursor = '';
                btn.textContent = 'Réessayer';
                return;
            }
            label();
        }, 1000);
    }

    async unmount() {
        await super.unmount();
        clearInterval(this._weatherRetryInterval);
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
            if (btn) {
                if (btn.tagName === 'A' && btn.getAttribute('href') === '#') e.preventDefault();
                const action = btn.getAttribute('data-action');
                const args = btn.getAttribute('data-args');

                if (typeof SitesService[action] === 'function') {
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
                    if (args !== null) this[action](...args.split(',').map((a) => a.trim().replace(/'/g, '')), btn);
                    else this[action](btn);
                }
            }
        };

        this._changeHandler = (e) => {
            const el = e.target;
            const action = el.getAttribute('data-action');
            if (action && typeof SitesService[action] === 'function') {
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
                this[action](el.value);
            }
        };

        this._inputHandler = (e) => {
            const el = e.target;
            if (el.id === 'radius-slider') {
                SitesService.setRadiusLimit(el.value);
                const label = document.getElementById('radius-val-label');
                if (label) label.textContent = Number(el.value) === 210 ? 'Illimité' : `${el.value} km`;
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
                const openSettings = confirm(
                    'Vous devez autoriser la géolocalisation dans vos options de confidentialité.',
                );
                if (openSettings) GdprEngine.showModal('gdpr-settings-modal');
            }
            if (statusEl)
                statusEl.innerHTML = `<i class="ri-shield-user-line" style="color: var(--text-muted);"></i> Géolocalisation désactivée. <a href="#" data-action="GdprshowModal" data-args="gdpr-settings-modal" data-prevent-default style="color: var(--accent-blue);">Gérer</a>`;
            return;
        }

        if (!navigator.geolocation) return;

        if (statusEl) {
            statusEl.innerHTML = `<i class="ri-loader-4-line" style="animation: spin 1s linear infinite;"></i> Récupération GPS...`;
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
                    inputEl.placeholder = 'Ma position GPS';
                }
                if (statusEl) {
                    statusEl.innerHTML = `<i class="ri-checkbox-circle-line" style="color: var(--accent-green);"></i> Position GPS actuelle activée.`;
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
                if (!isInitialLoad) alert("Impossible d'obtenir votre position GPS.");
                if (statusEl) {
                    statusEl.innerHTML = `<i class="ri-error-warning-line" style="color: var(--accent-red);"></i> Position GPS indisponible.`;
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
            const radiusLabel = document.getElementById('radius-val-label');

            if (minInput) minInput.value = String(SitesService.state.limitWindMin);
            if (maxInput) maxInput.value = String(SitesService.state.limitWindMax);
            if (deltaInput) deltaInput.value = String(SitesService.state.limitGustDelta);
            if (hideUnflyableCheckbox) hideUnflyableCheckbox.checked = SitesService.state.hideUnflyable;
            if (modelSelect) modelSelect.value = SitesService.state.weatherModel;
            if (sortSelect) sortSelect.value = SitesService.state.sortMode;
            if (radiusSlider) radiusSlider.value = String(SitesService.state.radiusLimit);
            if (radiusLabel)
                radiusLabel.textContent =
                    SitesService.state.radiusLimit === 210 ? 'Illimité' : `${SitesService.state.radiusLimit} km`;

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
                    <span>Calcul météo en cours...</span>
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

        if (result && result.success === false) {
            this.renderList();
            // Sans météo, le curseur d'heure reste désactivé : le dire au lieu de laisser
            // « Chargement des prévisions... » indéfiniment (sauf si une météo antérieure reste affichée).
            const timeLabel = document.getElementById('forecast-time-label');
            if (timeLabel && Object.keys(SitesService.state.weatherForecasts).length === 0) {
                timeLabel.textContent = 'Météo indisponible';
            }
            const container = document.getElementById('sites-list-container');
            if (container) {
                const errorHtml = `
                <div style="color:var(--accent-red, #ef4444); font-size: 0.95rem; text-align: center; padding: 16px; margin-bottom: 16px; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); border-radius: var(--radius-lg); width: 100%;">
                    <i class="ri-error-warning-line" style="font-size: 1.2rem; vertical-align: middle; margin-right: 8px;"></i>
                    <strong>Météo indisponible :</strong> ${result.error?.message || 'Erreur réseau'}
                    <button id="weather-retry-btn" data-action="fetchWeatherForSites" class="action-btn-primary" style="margin-left: 12px; padding: 4px 12px; font-size: 0.8rem; border-radius: var(--radius-pill);">Réessayer</button>
                </div>
            `;
                container.insertAdjacentHTML('afterbegin', errorHtml);
                this._startWeatherRetryCountdown(result.cooldownRemainingMs || 0);
            }
        } else {
            this.updateForecastLabel();
            this.renderList();
            this.updateMapMarkers();
        }
    }

    initMap() {
        if (this.state.map) return;
        this.state.map = L.map('sites-map-canvas');
        this.updateMapTiles();
        this.state.markersGroup = L.featureGroup().addTo(this.state.map);
        this.updateMapMarkers();

        // Fix Leaflet tile loading issue on mobile/resize using ResizeObserver
        const mapCanvas = document.getElementById('sites-map-canvas');
        if (mapCanvas && window.ResizeObserver) {
            this.state.mapResizeObserver = new ResizeObserver(() => {
                if (this.state.map) {
                    this.state.map.invalidateSize();
                }
            });
            this.state.mapResizeObserver.observe(mapCanvas);
        }

        try {
            const bounds = this.state.markersGroup.getBounds();
            this.state.isProgrammaticZoom = true;
            if (bounds.isValid()) this.state.map.fitBounds(bounds, { padding: [30, 30] });
            else this.state.map.setView([50.5, 2.5], 9);
            if (this._progZoomTimeout) clearTimeout(this._progZoomTimeout);
            this._progZoomTimeout = setTimeout(() => {
                this.state.isProgrammaticZoom = false;
            }, 1000);
        } catch {
            this.state.map.setView([50.5, 2.5], 9);
        }

        this.bindMapSync();
    }

    bindMapSync() {
        if (!this.state.map) return;

        this.state.map.off('zoomend moveend');
        this.state.map.on('zoomend moveend', (e) => {
            if (this.state.isProgrammaticZoom) return;

            try {
                let radius;
                const bounds = this.state.map.getBounds();
                if (!bounds || !bounds.isValid()) return;

                if (SitesService.state.userLocation && SitesService.state.userLocation.lat !== undefined) {
                    const userLatLng = L.latLng(
                        SitesService.state.userLocation.lat,
                        SitesService.state.userLocation.lng,
                    );
                    const corners = [
                        bounds.getNorthWest(),
                        bounds.getNorthEast(),
                        bounds.getSouthWest(),
                        bounds.getSouthEast(),
                    ];
                    let maxDistance = 0;
                    for (const corner of corners) {
                        const dist = userLatLng.distanceTo(corner) / 1000;
                        if (dist > maxDistance) maxDistance = dist;
                    }
                    radius = Math.round(maxDistance / 10) * 10;
                } else {
                    const center = this.state.map.getCenter();
                    const northEast = bounds.getNorthEast();
                    radius = Math.round(center.distanceTo(northEast) / 1000 / 10) * 10;
                }

                if (radius > 200) radius = 210;
                if (radius < 10) radius = 10;

                if (SitesService.state.radiusLimit !== radius) {
                    this.state.ignoreNextFitBounds = true;
                    const slider = /** @type {HTMLInputElement} */ (document.getElementById('radius-slider'));
                    if (slider) {
                        slider.value = radius;
                        slider.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                    setTimeout(() => {
                        this.state.ignoreNextFitBounds = false;
                    }, 600);
                }
            } catch (err) {
                console.error('Map sync error', err);
            }
        });
    }

    updateMapTiles() {
        if (!this.state.map) return;

        // Toggle dark-map class based on current theme mode
        const mapCanvas = document.getElementById('sites-map-canvas');
        if (mapCanvas) {
            const isLightMode = document.body.classList.contains('light-mode');
            if (isLightMode) {
                mapCanvas.classList.remove('dark-map');
            } else {
                mapCanvas.classList.add('dark-map');
            }
        }

        if (this.state.tileLayer) return; // No need to recreate the tile layer!

        // 1. Couche de base (Esri World Topo Map) - Rendu beaucoup plus "dessin/vectoriel" et épuré que OpenTopoMap
        this.state.tileLayer = L.tileLayer(
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
            {
                attribution: 'Tiles &copy; Esri',
                maxZoom: 17,
                maxNativeZoom: 15, // Astuce Ligne Claire : Étire les tuiles (lignes épaisses, pas de lissage)
            },
        ).addTo(this.state.map);

        // 2. On supprime la surcouche de relief car Esri intègre déjà un relief très doux et plat
        if (SitesService.state.hillshadeLayer) {
            this.state.map.removeLayer(SitesService.state.hillshadeLayer);
            SitesService.state.hillshadeLayer = null;
        }
    }
    // Génère l'URL de l'icône SVG officielle FFVL/SpotAir pour un site (type de pratique +
    // secteurs de vent favorables), voir ideas_roadmap.md section 1 pour la spec de l'API.
    updateMapMarkers() {
        if (!this.state.map || !this.state.markersGroup) return;
        this.state.markersGroup.clearLayers();

        const activeSites = SitesService.getFilteredAndSortedSites(SitesService.getSites());

        activeSites.forEach((site) => {
            let flyableClass = 'weather-unknown';
            const weather = (SitesService.state.weatherForecasts[site.id] || [])[SitesService.state.forecastOffset];
            const status = weather ? SitesService.isForecastFlyable(site, weather) : null;
            if (status) flyableClass = status.class;
            const color = verdictColor(status);
            const isIncomplete = status?.status === 'incomplete';
            // Pas de pulsation pour un site dont l'orientation est inconnue (spec 001, US2).
            const isCurrentlyFlyable = status?.flyable && !status.warning;
            const pulseHtml = isCurrentlyFlyable
                ? `<div class="marker-pulse" style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background: ${color}; opacity: 0.35; animation: marker-pulse-anim 1.8s infinite ease-out;"></div>`
                : '';
            const iconHtml = `<div class="custom-map-marker ${flyableClass}" style="position: relative; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;" title="${escapeHTML(site.nom)}">${pulseHtml}${
                isIncomplete
                    ? `<div class="marker-core marker-core--incomplete" title="${escapeHTML(verdictLabel(status))}">?</div>`
                    : `<div class="marker-core" style="width: 14px; height: 14px; border-radius: 50%; background: ${color}; border: 2px solid var(--bg-surface); box-shadow: 0 2px 6px rgba(0,0,0,0.4); z-index: 2; transition: background-color 0.3s;"></div>`
            }</div>`;
            const marker = L.marker([parseFloat(site.latitude || site.lat), parseFloat(site.longitude || site.lon)], {
                icon: L.divIcon({
                    html: iconHtml,
                    className: 'leaflet-custom-icon',
                    iconSize: [30, 30],
                    iconAnchor: [15, 15],
                }),
                title: site.nom,
            });
            marker.bindTooltip(site.nom, { direction: 'top', offset: [0, -15], opacity: 0.9 });
            marker.on('click', (e) => {
                this.spotSite(
                    parseFloat(site.latitude || site.lat),
                    parseFloat(site.longitude || site.lon),
                    site.nom,
                    site.reference_terrain || site.id || '',
                );
            });
            this.state.markersGroup.addLayer(marker);
        });

        if (activeSites.length > 0 && this.state.map && !this.state.ignoreNextFitBounds) {
            const coords = activeSites.map((s) => [parseFloat(s.latitude || s.lat), parseFloat(s.longitude || s.lon)]);
            this.state.isProgrammaticZoom = true;
            this.state.map.fitBounds(coords, { padding: [30, 30] });
            if (this._progZoomTimeout) clearTimeout(this._progZoomTimeout);
            this._progZoomTimeout = setTimeout(() => {
                this.state.isProgrammaticZoom = false;
            }, 1000);
        }
    }
    buildWeatherPopupHtml(weather, color, site) {
        const status = SitesService.isForecastFlyable(site, weather);
        const missing = missingValuesText(status);
        return `<div style="margin-top: 8px; padding: 8px; border-radius: 6px; background: rgba(0,0,0,0.1); border: 1px solid var(--border-color); font-size: 0.85rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; gap: 8px;">
                <span style="font-weight: 700; white-space: nowrap;"><i class="ri-windy-line"></i> ${escapeHTML(String(forecastValue(weather.windCard)))} ${escapeHTML(String(forecastValue(weather.windSpeed)))} km/h</span>
                <span style="color: ${status.status === 'incomplete' ? 'var(--text-muted)' : color}; font-weight: bold; font-size: 0.75rem;"><i class="${status.icon}"></i> ${escapeHTML(status.reason)}</span>
            </div>
            <div style="opacity: 0.8; font-size: 0.8rem;">Rafales : ${escapeHTML(String(forecastValue(weather.windGust)))} km/h</div>
            ${missing ? `<div class="weather-missing-values" style="margin-top: 4px; font-size: 0.8rem;">${escapeHTML(missing)}</div>` : ''}
            ${verdictReminderHtml(status)}
        </div>`;
    }

    buildMapPopupHtml(site, weatherPopupHtml) {
        return `<div class="map-popup-card" style="font-family: var(--font-main); color: var(--text-main); width: 220px;">
            <h4 style="margin: 0 0 4px 0; font-size: 1rem; font-weight: 700;">${escapeHTML(site.nom)}</h4>
            ${weatherPopupHtml}
            <div style="display: flex; gap: 6px; margin-top: 10px;">
                ${
                    site.url
                        ? `
                <a class="action-btn-secondary ffvl-btn" href="${site.url}" target="_blank" rel="noopener noreferrer" style="padding: 6px 8px; display: inline-flex; align-items: center; justify-content: center; text-decoration: none;" title="Fiche FFVL">
                    <img src="https://federation.ffvl.fr/sites/all/themes/ffvl/favicon.ico" alt="FFVL" style="width: 14px; height: 14px; border-radius: 2px;">
                </a>
                `
                        : ''
                }
                <button class="action-btn-primary" data-action="openGpsMenu" data-args="'${parseFloat(site.latitude || site.lat)}', '${parseFloat(site.longitude || site.lon)}'" style="flex: 1; padding: 6px 10px; font-size: 0.8rem; justify-content: center;">
                    <i class="ri-navigation-line"></i> S'y rendre
                </button>
                <button class="action-btn-secondary windy-btn" data-action="focusSiteWindy" data-args="'${parseFloat(site.latitude || site.lat)}', '${parseFloat(site.longitude || site.lon)}', '${escapeHTML(site.nom)}'" style="padding: 6px 8px;" title="Afficher le vent sur le radar">
                    <i class="ri-windy-line"></i>
                </button>
                <button class="action-btn-secondary paraglidable-btn" data-action="focusSiteMap" data-args="'paraglidable', '${parseFloat(site.latitude || site.lat)}', '${parseFloat(site.longitude || site.lon)}', '${escapeHTML(site.nom)}'" style="padding: 6px 8px;" title="Afficher sur Paraglidable">
                    <i class="ri-flight-takeoff-line"></i>
                </button>
            </div>
        </div>`;
    }

    openGpsMenu(lat, lng) {
        this.state.currentSiteCoords = { lat, lng };
        const sheet = document.getElementById('gps-bottom-sheet');
        if (sheet) sheet.classList.add('active');
    }

    closeGpsMenu() {
        const sheet = document.getElementById('gps-bottom-sheet');
        if (sheet) sheet.classList.remove('active');
        this.state.currentSiteCoords = null;
    }

    openSpotairModal(spotairId, siteId) {
        const modal = /** @type {HTMLDialogElement & { _cancelBound?: boolean }} */ (
            document.getElementById('spotair-modal')
        );
        const iframe = /** @type {HTMLIFrameElement} */ (document.getElementById('spotair-modal-iframe'));
        const titleEl = document.getElementById('spotair-modal-title');
        if (!modal || !iframe) return;

        const site = SitesService.getSiteById(siteId);
        if (titleEl) titleEl.textContent = site ? `Vent en direct — ${site.nom}` : 'Vent en direct — SpotAiR';
        iframe.src = `https://www.spotair.mobi/page/wind/ffvl/${spotairId}`;

        if (typeof modal.showModal === 'function' && !modal.open) {
            modal.showModal();
            if (!modal._cancelBound) {
                modal._cancelBound = true;
                modal.addEventListener('cancel', (e) => {
                    e.preventDefault();
                    this.closeSpotairModal();
                });
            }
        }
        modal.style.display = 'flex';
        void modal.offsetWidth;
        modal.classList.add('active');
    }

    closeSpotairModal() {
        const modal = /** @type {HTMLDialogElement & { _cancelBound?: boolean }} */ (
            document.getElementById('spotair-modal')
        );
        const iframe = /** @type {HTMLIFrameElement} */ (document.getElementById('spotair-modal-iframe'));
        if (!modal) return;
        modal.classList.remove('active');
        setTimeout(() => {
            if (!modal.classList.contains('active')) {
                if (typeof modal.close === 'function' && modal.open) {
                    modal.close();
                }
                modal.style.display = 'none';
                if (iframe) iframe.src = '';
            }
        }, 300);
    }

    launchGps(app) {
        const coords = this.state.currentSiteCoords;
        if (!coords) return;
        const { lat, lng } = coords;
        let url = '';
        if (app === 'waze') {
            url = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
        } else if (app === 'gmaps') {
            url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
        } else if (app === 'apple') {
            url = `http://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
        }
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
        this.closeGpsMenu();
    }

    switchMapMode(mode) {
        const modes = ['leaflet', 'windy', 'meteoparapente', 'paraglidingearth', 'paraglidable', 'isofronts'];

        // Toggle buttons
        modes.forEach((m) => {
            const btn = document.getElementById(`map-toggle-${m}`);
            if (btn) {
                if (m === mode) {
                    btn.className = 'action-btn-primary map-toggle-btn';
                    btn.style.color = '';
                    btn.style.borderColor = '';
                } else {
                    btn.className = 'action-btn-secondary map-toggle-btn';
                    btn.style.color = 'var(--text-secondary)';
                    btn.style.borderColor = 'var(--border-color)';
                }
            }
        });

        // Toggle canvases
        const canvases = {
            leaflet: document.getElementById('sites-map-canvas'),
            windy: document.getElementById('sites-windy-canvas'),
            meteoparapente: document.getElementById('sites-meteoparapente-canvas'),
            paraglidingearth: document.getElementById('sites-paraglidingearth-canvas'),
            paraglidable: document.getElementById('sites-paraglidable-canvas'),
            isofronts: document.getElementById('sites-isofronts-canvas'),
        };

        Object.keys(canvases).forEach((k) => {
            const canvas = canvases[k];
            if (canvas) {
                canvas.style.display = k === mode ? 'block' : 'none';
            }
        });

        // Special behavior per mode
        if (mode === 'leaflet') {
            if (this.state.map) {
                // Reset spotted site when returning to base map
                this.state._spottedSite = null;
                this.state.map.closePopup();

                setTimeout(() => {
                    this.state.map.invalidateSize();
                    if (this.state.markersGroup) {
                        const bounds = this.state.markersGroup.getBounds();
                        if (bounds.isValid()) {
                            this.state.map.fitBounds(bounds, { padding: [30, 30] });
                        }
                    }
                }, 150);
            }
        } else {
            // Load default/current coordinates if not switching to Leaflet
            let lat = 46.5;
            let lon = 2.2;
            let name = 'France';
            let extraId = '';
            let isGeneric = true;

            if (this.state._spottedSite) {
                lat = this.state._spottedSite.lat;
                lon = this.state._spottedSite.lon;
                name = this.state._spottedSite.siteName;
                extraId = this.state._spottedSite.extraId || '';
                isGeneric = false;
            } else if (SitesService.state.userLocation) {
                lat = SitesService.state.userLocation.lat;
                lon = SitesService.state.userLocation.lng;
                isGeneric = false;
            }

            if (mode === 'isofronts') {
                this.initIsofronts();
            } else {
                this.loadIframeContent(mode, lat, lon, name, extraId, isGeneric);
            }
        }
    }

    loadIframeContent(mode, lat, lon, siteName, extraId, isGeneric) {
        const nameLabels = {
            windy: document.getElementById('windy-active-spot-name'),
            meteoparapente: document.getElementById('meteoparapente-active-spot-name'),
            paraglidingearth: document.getElementById('paraglidingearth-active-spot-name'),
            paraglidable: document.getElementById('paraglidable-active-spot-name'),
        };
        if (nameLabels[mode]) {
            nameLabels[mode].textContent = siteName ? siteName.toUpperCase() : 'Général';
        }

        const iframes = {
            windy: document.getElementById('windy-embed-iframe'),
            meteoparapente: document.getElementById('meteoparapente-embed-iframe'),
            paraglidingearth: document.getElementById('paraglidingearth-embed-iframe'),
            paraglidable: document.getElementById('paraglidable-embed-iframe'),
        };

        const openLinks = {
            windy: document.getElementById('windy-open-link'),
            meteoparapente: document.getElementById('meteoparapente-open-link'),
            paraglidingearth: document.getElementById('paraglidingearth-open-link'),
            paraglidable: document.getElementById('paraglidable-open-link'),
        };

        const zoom = isGeneric ? 6 : 11;
        const paraglidableZoom = isGeneric ? 6 : 8;

        // Calculate URLs
        const urls = {
            windy: `https://embed.windy.com/embed2.html?lat=${lat}&lon=${lon}&detailLat=${lat}&detailLon=${lon}&width=100%&height=400&zoom=${zoom}&level=surface&overlay=wind&product=ecmwf&menu=&message=true&marker=${isGeneric ? 'false' : 'true'}&calendar=now&pressure=&type=map&location=coordinates&metricWind=km%2Fh&metricTemp=default&radarRange=`,
            meteoparapente: `https://meteo-parapente.com/#/${lat},${lon},${zoom}`,
            paraglidingearth: `https://www.paraglidingearth.com/?latlng=${lat},${lon}`,
            paraglidable: `https://paraglidable.com/?lat=${lat}&lon=${lon}&zoom=${paraglidableZoom}`,
        };

        const iframe = iframes[mode];
        if (iframe) {
            if (iframe.src !== urls[mode]) {
                iframe.src = urls[mode];
            }
        }

        const openLink = openLinks[mode];
        if (openLink) {
            let linkUrl = urls[mode];
            if (mode === 'windy') {
                linkUrl = `https://www.windy.com/${lat}/${lon}?${lat},${lon},${zoom}`;
            } else if (mode === 'meteoparapente') {
                linkUrl = `https://meteo-parapente.com/#/${lat},${lon},${zoom}`;
            } else if (mode === 'paraglidingearth') {
                linkUrl = `https://www.paraglidingearth.com/?latlng=${lat},${lon}`;
            } else if (mode === 'paraglidable') {
                linkUrl = `https://paraglidable.com/?lat=${lat}&lon=${lon}&zoom=${paraglidableZoom}`;
            }
            openLink.href = linkUrl;
        }
    }

    focusSiteMap(mode, lat, lon, siteName, extraId) {
        const externalModes = ['meteoblue', 'windfinder', 'spotair', 'paraglidingmap'];
        if (externalModes.includes(mode)) {
            let url = '';
            if (mode === 'meteoblue') {
                const latVal = Math.abs(lat);
                const lonVal = Math.abs(lon);
                const latDir = lat >= 0 ? 'N' : 'S';
                const lonDir = lon >= 0 ? 'E' : 'W';
                url = `https://www.meteoblue.com/fr/meteo/semaine/${latVal}${latDir}${lonVal}${lonDir}`;
            } else if (mode === 'windfinder') {
                url = `https://fr.windfinder.com/#11/${lat}/${lon}`;
            } else if (mode === 'spotair') {
                url = extraId ? `https://www.spotair.mobi/spot/ffvl/${extraId}` : `https://www.spotair.mobi/`;
            } else if (mode === 'paraglidingmap') {
                url = `https://www.paraglidingmap.com/app/?lat=${lat}&lng=${lon}&zoom=11`;
            }
            if (url) {
                window.open(url, '_blank', 'noopener,noreferrer');
            }
            return;
        }

        this.switchMapMode(mode);
        this.loadIframeContent(mode, lat, lon, siteName, extraId);

        const mapView = document.getElementById('sites-map-view');
        if (mapView) {
            mapView.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    focusSiteWindy(lat, lon, siteName) {
        this.focusSiteMap('windy', lat, lon, siteName);
    }

    toggleFullscreen() {
        const mapView = document.getElementById('sites-map-view');
        const fsBtn = document.getElementById('map-toggle-fullscreen');
        if (!mapView || !fsBtn) return;

        const isFullscreen = mapView.classList.toggle('map-view-fullscreen');

        let placeholder = document.getElementById('map-view-placeholder');
        if (!placeholder) {
            placeholder = document.createElement('div');
            placeholder.id = 'map-view-placeholder';
            placeholder.style.display = 'none';
            mapView.parentNode.insertBefore(placeholder, mapView);
        }

        if (isFullscreen) {
            document.body.appendChild(mapView);
            document.body.style.overflow = 'hidden';
            document.documentElement.style.overflow = 'hidden';
            fsBtn.innerHTML = '<i class="ri-fullscreen-exit-line"></i> <span>Réduire</span>';
            fsBtn.classList.add('active-fs');
            if (this.state.map && document.getElementById('sites-map-canvas').style.display !== 'none') {
                setTimeout(() => {
                    this.state.map.invalidateSize();
                    if (this.state.markersGroup) {
                        const bounds = this.state.markersGroup.getBounds();
                        if (bounds.isValid()) {
                            this.state.map.fitBounds(bounds, { padding: [30, 30] });
                        }
                    }
                }, 150);
            }
        } else {
            if (placeholder && placeholder.parentNode) {
                placeholder.parentNode.insertBefore(mapView, placeholder);
            }
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
            fsBtn.innerHTML = '<i class="ri-fullscreen-line"></i> <span>Plein écran</span>';
            fsBtn.classList.remove('active-fs');
            if (this.state.map && document.getElementById('sites-map-canvas').style.display !== 'none') {
                setTimeout(() => {
                    this.state.map.invalidateSize();
                    if (this.state.markersGroup) {
                        const bounds = this.state.markersGroup.getBounds();
                        if (bounds.isValid()) {
                            this.state.map.fitBounds(bounds, { padding: [30, 30] });
                        }
                    }
                }, 150);
            }
        }
    }

    initIsofronts() {
        // Panneau statique Météo-France — rien à charger dynamiquement
    }

    spotSite(lat, lon, siteName, extraId) {
        // 1. Scroll to the top map view
        const mapView = document.getElementById('sites-map-view');
        if (mapView) {
            mapView.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        // 2. Switch to Windy as main visible map
        this.switchMapMode('windy');

        // 3. Load all iframe maps with the site coordinates
        ['windy', 'meteoparapente', 'paraglidingearth', 'paraglidable'].forEach((mode) => {
            this.loadIframeContent(mode, lat, lon, siteName, extraId);
        });

        // 4. Update the leaflet marker focus
        if (this.state.map) {
            this.state.map.setView([lat, lon], 13, { animate: true });
        }

        // 5. Store last spotted site for the "Plus" dropdown
        this.state._spottedSite = { lat: lat, lon: lon, siteName: siteName, extraId: extraId };

        // 6. Show a brief toast feedback
        this.showSpotItToast(siteName);
    }

    showSpotItToast(siteName) {
        /** @type {HTMLElement & { _hideTimer?: ReturnType<typeof setTimeout> }} */
        let toast = document.getElementById('spot-it-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'spot-it-toast';
            toast.className = 'spot-it-toast';
            document.body.appendChild(toast);
        }
        toast.innerHTML =
            '<i class="ri-focus-3-line"></i> Cartes centrees sur <strong>' + escapeHTML(siteName) + '</strong>';
        toast.classList.add('visible');
        clearTimeout(toast._hideTimer);
        toast._hideTimer = setTimeout(function () {
            toast.classList.remove('visible');
        }, 2500);
    }

    openMoreMapsDropdown() {
        const sheet = document.getElementById('more-maps-bottom-sheet');
        if (!sheet) return;

        const spotted = this.state._spottedSite || null;
        let lat = null;
        let lon = null;
        let siteName = null;
        let extraId = null;

        if (spotted) {
            lat = spotted.lat || spotted.latitude;
            lon = spotted.lon || spotted.longitude;
            siteName = spotted.siteName || spotted.nom;
            extraId = spotted.extraId || spotted.id;
        } else if (this.state.map) {
            const center = this.state.map.getCenter();
            lat = center.lat;
            lon = center.lng;
        }

        let mbUrl = 'https://www.meteoblue.com/';
        if (lat && lon) {
            const latVal = Math.abs(lat);
            const lonVal = Math.abs(lon);
            const latDir = lat >= 0 ? 'N' : 'S';
            const lonDir = lon >= 0 ? 'E' : 'W';
            mbUrl = 'https://www.meteoblue.com/fr/meteo/semaine/' + latVal + latDir + lonVal + lonDir;
        }

        const links = [
            {
                label: 'Meteoblue',
                icon: 'ri-temp-hot-line',
                cls: 'mb-btn',
                url: mbUrl,
            },
            {
                label: 'Windfinder',
                icon: 'ri-compass-line',
                cls: 'wf-btn',
                url: lat ? 'https://fr.windfinder.com/#11/' + lat + '/' + lon : 'https://www.windfinder.com/',
            },
            {
                label: 'Paragliding Map',
                icon: 'ri-map-pin-line',
                cls: 'pm-btn',
                url: lat
                    ? 'https://www.paraglidingmap.com/app/?lat=' + lat + '&lng=' + lon + '&zoom=11'
                    : 'https://www.paraglidingmap.com/',
            },
        ];

        if (extraId) {
            links.splice(2, 0, {
                label: 'Spotair',
                icon: 'ri-radar-line',
                cls: 'sa-btn',
                url: 'https://www.spotair.mobi/spot/ffvl/' + extraId,
            });
        }

        const togglableMaps = [
            { id: 'leaflet', label: 'Cartographie', icon: 'ri-map-2-line', url: '#' },
            {
                id: 'windy',
                label: 'Windy',
                icon: 'ri-windy-line',
                url: lat ? 'https://www.windy.com/?' + lat + ',' + lon + ',12' : 'https://www.windy.com/',
            },
            {
                id: 'meteoparapente',
                label: 'Météo-P.',
                icon: 'ri-cloud-windy-line',
                url: lat ? 'https://meteo-parapente.com/?lat=' + lat + '&lon=' + lon : 'https://meteo-parapente.com/',
            },
            {
                id: 'paraglidingearth',
                label: 'PG Earth',
                icon: 'ri-earth-line',
                url: 'https://www.paraglidingearth.com/',
            },
            {
                id: 'paraglidable',
                label: 'Paraglidable',
                icon: 'ri-flight-takeoff-line',
                url: lat ? 'https://paraglidable.com/?lat=' + lat + '&lon=' + lon : 'https://paraglidable.com/',
            },
            {
                id: 'isofronts',
                label: 'Fronts & Isobares',
                icon: 'ri-cloud-line',
                url: 'https://meteofrance.com/isofronts',
            },
        ];

        togglableMaps.forEach(function (m) {
            if (!SitesService.state.activeMapLayers.includes(m.id)) {
                links.push({
                    label: m.label,
                    icon: m.icon,
                    cls: 'internal-map-btn',
                    url: m.url,
                });
            }
        });

        const grid = document.getElementById('more-maps-grid');
        if (grid) {
            grid.innerHTML = links
                .map(function (link) {
                    if (link.onclick) {
                        return (
                            '<a href="#" class="external-link-btn ' +
                            link.cls +
                            ' more-map-link" ' +
                            link.onclick +
                            '>' +
                            '<i class="' +
                            link.icon +
                            '"></i> ' +
                            link.label +
                            '</a>'
                        );
                    }
                    return (
                        '<a href="' +
                        link.url +
                        '" target="_blank" rel="noopener noreferrer" class="external-link-btn ' +
                        link.cls +
                        ' more-map-link" data-action="closeMoreMapsDropdown">' +
                        '<i class="' +
                        link.icon +
                        '"></i> ' +
                        link.label +
                        '</a>'
                    );
                })
                .join('');
        }

        const title = document.getElementById('more-maps-title');
        if (title) {
            title.textContent = siteName ? siteName.toUpperCase() : 'CARTES EXTERNES';
        }

        const subtitle = document.getElementById('more-maps-subtitle');
        if (subtitle) {
            subtitle.textContent = siteName
                ? 'Ouvrir dans un nouvel onglet sur ce spot'
                : 'Sélectionnez une carte supplémentaire';
        }

        sheet.classList.add('active');
    }

    closeMoreMapsDropdown() {
        const sheet = document.getElementById('more-maps-bottom-sheet');
        if (sheet) sheet.classList.remove('active');
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
        const types = [
            { id: 'ATTERRO', label: 'Atterrissage' },
            { id: 'NATUREL', label: 'Site Naturel' },
            { id: 'DUNE', label: 'Dune' },
            { id: 'TREUIL', label: 'Piste de Treuil' },
            { id: 'GONFLAGE', label: 'Gonflage' },
        ];

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
                        iconClass = 'ri-close-box-fill';
                    }
                    return `
                    <label class="filter-option state-${stateName}" data-action="cycleFilterState" data-args="'wind', '${w}'">
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
                    <label class="filter-option" data-action="cycleFilterState" data-args="'type', '${t.id}'" style="display:flex; align-items:center; cursor:pointer;">
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
                { id: 'leaflet', label: 'Cartographie', icon: 'ri-map-2-line' },
                { id: 'windy', label: 'Windy', icon: 'ri-windy-line' },
                { id: 'meteoparapente', label: 'Météo-Parapente', icon: 'ri-temp-hot-line' },
                { id: 'paraglidingearth', label: 'PG Earth', icon: 'ri-earth-line' },
                { id: 'paraglidable', label: 'Paraglidable', icon: 'ri-flight-takeoff-line' },
                { id: 'isofronts', label: 'Fronts & Isobares', icon: 'ri-cloud-line' },
            ];

            mapMenu.innerHTML = maps
                .map((m) => {
                    const isActive = SitesService.state.activeMapLayers.includes(m.id);
                    const iconClass = isActive ? 'ri-checkbox-fill' : 'ri-checkbox-blank-line';
                    return `
                    <label class="filter-option" style="cursor:pointer;" data-action="toggleMapLayer" data-args="'${m.id}'">
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
            text = 'Maintenant';
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
            label.setAttribute('aria-label', `Charger le lieu : ${loc.name}`);

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
            btnRemove.setAttribute('aria-label', `Supprimer le lieu : ${loc.name}`);

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
                btn.innerHTML = `<i class="ri-table-line" style="color: var(--accent-blue);"></i> Comparer`;
                btn.style.background = 'rgba(59, 130, 246, 0.15)';
                btn.style.borderColor = 'rgba(59, 130, 246, 0.3)';
            } else {
                btn.classList.remove('active');
                btn.innerHTML = `<i class="ri-table-line"></i> Comparer`;
                btn.style.background = 'transparent';
                btn.style.borderColor = 'var(--border-color)';
            }
        }
        this.renderList();

        if (this.state.showComparator) {
            // Fetch best-effort : si ça échoue, getModelAgreement renverra simplement null
            // (colonne "Confiance" affichée comme indisponible) sans bloquer le reste du tableau.
            SitesService.fetchSecondaryModelForFavorites()
                .then(() => this.renderList())
                .catch(() => {});
        }
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
            listDiv.innerHTML =
                '<div class="card" style="text-align: center; padding: 20px;">Aucun site favori à comparer. Ajoutez des favoris avec l\'étoile ⭐ sur une fiche site.</div>';
            return;
        }

        const rows = favoriteSites
            .map((site) => {
                const forecasts = SitesService.state.weatherForecasts[site.id] || [];
                const weather = forecasts[SitesService.state.forecastOffset];
                const status = weather ? SitesService.isForecastFlyable(site, weather) : null;
                const statusHtml = status
                    ? `<span class="${status.class}" style="display: inline-flex; align-items: center; gap: 4px; font-weight: 600;"><i class="${status.icon}"></i> ${escapeHTML(verdictLabel(status))}</span>`
                    : '<span style="color: var(--text-muted);">Chargement...</span>';

                // Meilleur créneau à venir = le plus long slot volable de flyableSlots (déjà groupé
                // par jour par getFilteredAndSortedSites) sur toute la fenêtre de prévision choisie
                // (jusqu'à 7 jours) — c'est le digest "meilleure fenêtre à venir".
                const slots = site.flyableSlots || [];
                const bestSlot = slots.reduce((best, s) => {
                    const duration = s.end - s.start;
                    return !best || duration > best.end - best.start ? s : best;
                }, null);
                const bestSlotHtml = bestSlot
                    ? `${escapeHTML(bestSlot.dayLabel)} ${bestSlot.start}h-${bestSlot.end + 1}h`
                    : '<span style="color: var(--text-muted);">Aucun</span>';

                const agreement = SitesService.getModelAgreement(site);
                // Indice calculable seulement sur deux prévisions complètes (spec 001) : si les deux
                // modèles sont chargés mais qu'il reste null, c'est qu'une prévision est incomplète.
                const secondaryLoaded = !!SitesService.state.weatherForecastsSecondary?.[site.id];
                const confidenceUnavailable =
                    agreement === null && (status?.status === 'incomplete' || (secondaryLoaded && !!weather));
                const confidenceHtml =
                    agreement === null
                        ? confidenceUnavailable
                            ? `<span style="color: var(--text-muted);" title="${escapeHTML(t('weather.incomplete'))}">${escapeHTML(t('weather.confidenceUnavailable'))}</span>`
                            : '<span style="color: var(--text-muted);">—</span>'
                        : agreement
                          ? '<span style="color: var(--accent-green);" title="Le modèle principal et le modèle de référence sont d\'accord sur la volabilité actuelle"><i class="ri-shield-check-line"></i> Fiable</span>'
                          : '<span style="color: #f59e0b;" title="Les modèles météo divergent sur la volabilité actuelle : prudence"><i class="ri-error-warning-line"></i> Incertain</span>';

                return `
                <tr>
                    <td style="padding: 10px; font-weight: 700;">${escapeHTML(site.nom || site.name || '')}</td>
                    <td style="padding: 10px;">${statusHtml}</td>
                    <td style="padding: 10px; text-align: center;">${site.flyableHours || 0}h</td>
                    <td style="padding: 10px; text-align: center;">${bestSlotHtml}</td>
                    <td style="padding: 10px;">${confidenceHtml}</td>
                </tr>
            `;
            })
            .join('');

        listDiv.innerHTML = `
            <div class="card" style="padding: 16px; overflow-x: auto;">
                ${verdictReminderHtml(null)}
                <table style="width: 100%; border-collapse: collapse; min-width: 480px;">
                    <thead>
                        <tr style="border-bottom: 1px solid var(--border-color); text-align: left;">
                            <th style="padding: 10px;">Site</th>
                            <th style="padding: 10px;">Météo (créneau affiché)</th>
                            <th style="padding: 10px; text-align: center;" title="Sur la fenêtre de prévision actuelle">Volable</th>
                            <th style="padding: 10px;" title="Le créneau continu le plus long sur toute la fenêtre de prévision">Meilleur créneau</th>
                            <th style="padding: 10px;" title="Accord entre le modèle principal et un modèle de référence sur le créneau actuel">Confiance</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
                <p style="margin: 12px 0 0; font-size: 0.8rem; color: var(--text-muted);">Astuce : choisis "7 Jours" dans les paramètres de calcul météo ci-dessus pour élargir la fenêtre du meilleur créneau.</p>
            </div>
        `;
    }

    renderList() {
        const listDiv = document.getElementById('sites-list-container');
        if (!listDiv) return;

        const activeSites = SitesService.getFilteredAndSortedSites(SitesService.getSites());

        if (this.state.showComparator) {
            this.renderComparator(activeSites);
            return;
        }

        listDiv.innerHTML = '';
        if (activeSites.length === 0) {
            listDiv.style.display = 'block';
            listDiv.innerHTML =
                '<div class="card" style="text-align: center; padding: 20px;">Aucun site trouvé pour ces critères</div>';
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
                            `<span class="wind-tag" data-action="SitesfilterByTag" data-args="${escapeHTML(w)}" title="Filtrer par vent ${w}">${w}</span>`,
                    )
                    .join('');

                const st = site.site_sous_type || site.type || 'Inconnu';
                const siteTypes = Array.isArray(st) ? st : [st];
                const typeLabel = siteTypes
                    .map((t) => {
                        return `<span class="site-coords-badge site-type-badge" data-action="SitesfilterByType" data-args="${escapeHTML(t)}" style="cursor: pointer;" title="Filtrer par type ${t}">${t}</span>`;
                    })
                    .join(' ');

                let distanceHtml = '';
                if (site.distance !== undefined) {
                    distanceHtml = `
                        <span class="site-coords-badge site-dist-badge">
                            <i class="ri-navigation-fill"></i> ${site.distance.toFixed(1)} km
                        </span>
                    `;
                }

                const flyableHoursHtml = `
                    <span class="site-coords-badge" style="background: ${site.flyableHours > 0 ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.03)'}; border-color: ${site.flyableHours > 0 ? 'rgba(34,197,94,0.3)' : 'var(--border-color)'}; color: ${site.flyableHours > 0 ? 'var(--accent-green)' : 'var(--text-muted)'}; font-weight: 700;">
                        <i class="ri-time-line"></i> ${site.flyableHours || 0}h volables ${(site.maxConsecutiveHours || 0) > 0 ? `(${site.maxConsecutiveHours}h conséc.)` : ''}
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
                                    <span>Vent <b>${escapeHTML(String(forecastValue(weather.windCard)))}</b> (${escapeHTML(String(forecastValue(weather.windDirDeg)))}°) : <b>${escapeHTML(String(forecastValue(weather.windSpeed)))} km/h</b> (raf. <b>${escapeHTML(String(forecastValue(weather.windGust)))}</b>)</span>
                                </span>
                                <span style="display: flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; text-transform: uppercase;">
                                    <i class="${status.icon}"></i> ${escapeHTML(status.reason)}
                                </span>
                            </div>
                            ${missingValuesText(status) ? `<div class="weather-missing-values" style="font-size: 0.8rem;">${escapeHTML(missingValuesText(status))}</div>` : ''}
                        </div>
                        ${verdictReminderHtml(status)}
                    `;
                } else if (hasWeatherEntry) {
                    weatherHtml = `
                        <div class="weather-loading">
                            <i class="ri-error-warning-line"></i>
                            <span>Météo indisponible pour ce site</span>
                        </div>
                    `;
                } else {
                    weatherHtml = `
                        <div class="weather-loading">
                            <i class="ri-loader-4-line" style="animation: spin 1s linear infinite;"></i>
                            <span>Chargement météo ${SitesService.state.weatherModel.toUpperCase()}...</span>
                        </div>
                    `;
                }

                let slotsTextHtml = '';
                if (site.flyableSlots && site.flyableSlots.length > 0) {
                    const groupedByDay = {};
                    site.flyableSlots.forEach((slot) => {
                        if (!groupedByDay[slot.dayLabel]) groupedByDay[slot.dayLabel] = [];
                        groupedByDay[slot.dayLabel].push(`${slot.start}h - ${slot.end}h`);
                    });
                    const slotsDetails = Object.keys(groupedByDay)
                        .map((day) => {
                            return `<span><b>${day}</b> (${groupedByDay[day].join(', ')})</span>`;
                        })
                        .join(' | ');
                    slotsTextHtml = `
                        <div class="creneaux-list good">
                            <i class="ri-calendar-todo-line"></i> Prochains créneaux : ${slotsDetails}
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
                            <i class="ri-error-warning-line"></i> Aucun créneau favorable dans les prochaines ${maxRange} heures
                        </div>
                    `;
                }

                let timelineBarsHtml = '';
                const maxRange = SitesService.state.forecastMaxRange || 120;
                const forecastsToUse = forecasts.slice(0, maxRange);
                for (let j = 0; j < maxRange; j++) {
                    const w = forecastsToUse[j];
                    let barColor = 'rgba(255,255,255,0.05)';
                    let statusLabel = 'Inconnu';
                    let timeStr = `+${j}h`;
                    let dotClass = 'timeline-hour-dot';

                    if (w) {
                        const status = SitesService.isForecastFlyable(site, w);
                        const date = new Date(w.time);
                        const h = String(date.getHours()).padStart(2, '0');
                        const m = String(date.getMinutes()).padStart(2, '0');
                        const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
                        timeStr = `${days[date.getDay()]} ${h}:${m}`;
                        barColor = verdictColor(status, { bar: true });
                        if (status.status === 'incomplete') {
                            dotClass += ' timeline-hour-dot--incomplete';
                            statusLabel = verdictLabel(status);
                        } else if (status.flyable) {
                            statusLabel = status.warning
                                ? `${forecastValue(w.windCard)} ${forecastValue(w.windSpeed)} km/h — ${status.reason}`
                                : `Volable — ${forecastValue(w.windCard)} ${forecastValue(w.windSpeed)} km/h (raf. ${forecastValue(w.windGust)})`;
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
                    timelineBarsHtml += `<div class="${dotClass}" style="${dotStyle}" title="${escapeHTML(`${timeStr} : ${statusLabel}`)}" data-action="SitessetForecastOffset" data-args="${j}"></div>`;
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
            listDiv.innerHTML = html;
        }

        this.updateBadges();
    }
    // Brief pré-vol : rappelle le niveau de brevet actuellement sélectionné (à confronter avec
    // la praticabilité/les dangers du site affichés juste en dessous dans le même panneau — la
    // base FFVL ne fournit pas de niveau requis structuré par site, donc pas de verdict
    // compatible/incompatible fabriqué ici) et l'état du matériel du pilote, en réutilisant
    // LogbookService.computeEquipmentWear() (déjà utilisé pour le badge de révision du Carnet).
    buildPreFlightBriefHtml() {
        const LEVEL_LABELS = {
            ALL: 'Tous niveaux',
            BI: 'Brevet Initial',
            BP: 'Brevet Pilote',
            BPC: 'Brevet Pilote Confirmé',
            TREUIL: 'Treuil',
        };
        const level = GlobalState.get('level') || 'ALL';
        const levelLabel = LEVEL_LABELS[level] || level;

        let equipmentHtml = '<span style="color: var(--text-muted);">Aucun équipement enregistré</span>';
        try {
            const wear = LogbookService.computeEquipmentWear();
            const alertCount = Object.values(wear).filter((s) => s.alerts.dateAlert || s.alerts.hoursAlert).length;
            if (alertCount > 0) {
                equipmentHtml = `<span style="color: #f59e0b; font-weight: 600;">${alertCount} équipement${alertCount > 1 ? 's' : ''} à réviser</span>`;
            } else if (Object.keys(wear).length > 0) {
                equipmentHtml = '<span style="color: var(--accent-green); font-weight: 600;">Matériel à jour</span>';
            }
        } catch {
            // Carnet non disponible : on garde le message par défaut plutôt que de faire planter la carte.
        }

        return `
        <div class="rich-detail-item default" style="background: rgba(59, 130, 246, 0.06); border-radius: 8px;">
            <i class="ri-flight-takeoff-line rich-detail-icon blue"></i>
            <div>
                <strong class="rich-detail-label muted">Brief pré-vol</strong>
                <span class="rich-detail-value">Niveau sélectionné : <b>${escapeHTML(levelLabel)}</b> — à confronter à la praticabilité et aux dangers ci-dessous.</span>
                <div style="margin-top: 4px; font-size: 0.9rem;">Matériel : ${equipmentHtml}</div>
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
            title="Voir le vent en direct (SpotAiR)">
            <i class="ri-windy-line"></i> Balise
        </button>
    `
            : '';

        return `
            <div class="site-card-header site-card-header-row">
                <div class="site-info site-info-row">
                    <div class="site-title-row">
                        <button class="favorite-toggle-btn" data-action="toggleFavorite" data-args="'${site.id}'" title="Ajouter aux favoris" style="background: none; border: none; font-size: 1.4rem; color: ${starColor}; cursor: pointer; padding: 0;">
                            <i class="${starIcon}"></i>
                        </button>
                        <button class="minimize-toggle-btn" data-action="toggleMinimize" data-args="'${site.id}'" title="Réduire/Agrandir ce site" style="background: none; border: none; font-size: 1.4rem; color: var(--text-muted); cursor: pointer; padding: 0;">
                            <i class="${minIcon}"></i>
                        </button>
                        <h3 class="site-card-title">${escapeHTML(site.nom)}</h3>
                    </div>
                    <div class="site-badges-row">
                        ${
                            site.alt
                                ? `
                        <span class="site-coords-badge site-altitude-badge" title="Altitude du site">
                            <i class="ri-landscape-fill"></i> ${site.alt} m
                        </span>
                        `
                                : ''
                        }
                        <div class="site-wind-tags site-wind-tags-row">${windTags}</div>
                        ${typeLabel}
                        ${spotairBadgeHtml}
                        <button class="site-coords-badge copy-coords-btn" data-action="copyCoords" data-args="'${parseFloat(site.latitude || site.lat)}', '${parseFloat(site.longitude || site.lon)}'" title="Copier les coordonnées">
                            <i class="ri-map-pin-2-line"></i> <span class="coords-text">${parseFloat(site.latitude || site.lat)}, ${parseFloat(site.longitude || site.lon)}</span>
                        </button>
                        ${distanceHtml}
                        ${flyableHoursHtml}
                    </div>
                </div>
                <div class="site-actions-container">
                    ${
                        site.url
                            ? `
                    <a class="action-btn-secondary ffvl-btn" href="${site.url}" target="_blank" rel="noopener noreferrer" title="Fiche officielle FFVL">
                        <img src="https://federation.ffvl.fr/sites/all/themes/ffvl/favicon.ico" alt="FFVL"> FFVL
                    </a>
                    `
                            : ''
                    }
                    <button class="action-btn-spot spot-it-btn" data-action="spotSite" data-args="'${parseFloat(site.latitude || site.lat)}', '${parseFloat(site.longitude || site.lon)}', '${escapeHTML(site.nom)}', '${site.id || ''}'" title="Spot It — Paramétrer toutes les cartes sur ce site">
                        <i class="ri-focus-3-line"></i> Spot It
                    </button>
                    <button class="action-btn-primary gps-btn" data-action="openGpsMenu" data-args="'${parseFloat(site.latitude || site.lat)}', '${parseFloat(site.longitude || site.lon)}'">
                        <i class="ri-navigation-line"></i> S'y rendre
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
                    <span>Maintenant</span><span>Prévisions (${SitesService.state.forecastMaxRange || 120}h)</span><span>Dans ${(SitesService.state.forecastMaxRange || 120) / 24} jours</span>
                </div>
                <div class="ranking-timeline">
                    ${timelineBarsHtml}
                </div>
                <div class="timeline-legend">
                    <span class="legend-item"><span class="legend-color" style="background:#22c55e;"></span> Volable</span>
                    <span class="legend-item"><span class="legend-color" style="background:#eab308;"></span> Orientation inconnue</span>
                    <span class="legend-item"><span class="legend-color" style="background:#ef4444;"></span> Vent / Rafales</span>
                    <span class="legend-item"><span class="legend-color" style="background:#f97316;"></span> Mauvaise orientation</span>
                    <span class="legend-item"><span class="legend-color" style="background:#3b82f6;"></span> Pluie</span>
                    <span class="legend-item"><span class="legend-color" style="background:rgba(100,100,120,0.5);"></span> Nuit</span>
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
                const toggleText = this.state.expandedSites[site.id] ? 'Masquer les détails' : "Voir plus d'infos";

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
                                    <strong class="rich-detail-label muted">Conventionnement</strong>
                                    <span class="rich-detail-value">${site.conventionnement}</span>
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
                                    <strong class="rich-detail-label muted">Praticabilité</strong>
                                    <span class="rich-detail-value">${site.praticabilite}</span>
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
                                    <strong class="rich-detail-label muted">Structure Gestionnaire</strong>
                                    <span class="rich-detail-value">${site.structure_gestionnaire}</span>
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
                                    <strong class="rich-detail-label muted">Aérologie Idéale</strong>
                                    <span class="rich-detail-value">${site.aerologie_ideale}</span>
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
                                    <strong class="rich-detail-label muted">Accès Secours</strong>
                                    <span class="rich-detail-value">${site.secours_acces}</span>
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
                                    <strong class="rich-detail-label red">Dangers Signalés</strong>
                                    <span class="rich-detail-value">${site.dangers}</span>
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
                                    <strong class="rich-detail-label muted">Accès & Topo</strong>
                                    <span class="rich-detail-value">${site.acces_topo}</span>
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
                                    <strong class="rich-detail-label muted">Observations</strong>
                                    <span class="rich-detail-value">${site.observations}</span>
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
                                    <strong class="rich-detail-label red">Restrictions</strong>
                                    <span class="rich-detail-value">${site.restrictions}</span>
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
                                    <strong class="rich-detail-label muted">Réglementation</strong>
                                    <span class="rich-detail-value">${site.reglementation}</span>
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
                    btnRef.innerHTML =
                        '<i class="ri-check-line" style="color: var(--accent-green);"></i> <span style="color: var(--accent-green);">Copié !</span>';
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
                btnRef.innerHTML =
                    '<i class="ri-check-line" style="color: var(--accent-green);"></i> <span style="color: var(--accent-green);">Copié !</span>';
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
            toggleTextEl.textContent = detailsEl.open ? 'Masquer les détails' : "Voir plus d'infos";
        }
    }
}

const SitesView = new SitesViewClass();
export default SitesView;
