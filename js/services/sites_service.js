/**
 * SERVICE - SitesService
 * Business logic, GPS calculations, Weather API fetching, and Data Filtering
 */
import StorageService from '../services/storage.js';
import {
    WIND_THRESHOLDS,
    WEATHER_MODELS,
    RADIUS,
    DEFAULT_LOCATION,
    WEATHER_MODEL_INFO,
    STALE_AFTER_MS,
} from '../data/weather_config.js';
import { calculateDistance, getAngularDifference, degreesToCardinal } from '../utils/geo_utils.js';
import { removeAccents } from '../utils/text_utils.js';
import { escapeHTML } from '../core/security.js';
import AppRouter from '../core/router.js';
import { evaluateSpotForecast, normalizeForecastValue, getSiteOrientations } from '../weatherScoring.js';
import { toSorted } from '../utils/array_utils.js';
import IDBStorage from './idb_storage.js';
import { t } from '../utils/i18n.js';

const sitesView = () => AppRouter.getView('SITES');

// Values offered by the sort (#select-sort-mode) and weather model (#weather-model-select) menus.
const SORT_MODES = ['CONDITIONS', 'DISTANCE', 'AZ'];
const WEATHER_MODEL_KEYS = ['meteofrance', 'iconeu', 'icon', 'ecmwf', 'gfs', 'best_match'];

/**
 * Convertit les préférences enregistrées vers les réglages actuels (spec 002, FR-018) :
 * - le rayon « Illimité » (ancienne valeur 210) et tout rayon au-dessus de 200 km → 50 km par
 *   défaut, en dessous de 10 km → 10 km : « Illimité » épuisait le quota Open-Meteo ;
 * - le modèle « meteoblue » → « best_match » : il n'a jamais utilisé Meteoblue, mais la
 *   sélection automatique multi-modèles d'Open-Meteo ;
 * - un tri ou un modèle inconnu (ex. le texte « this.value », enregistré à la simple ouverture de
 *   ces menus — spec 019) est retiré : le réglage par défaut s'applique.
 * Ne modifie pas l'objet reçu.
 * @param {Object} prefs
 * @returns {Object}
 */
export function migrateSitePrefs(prefs) {
    const out = { ...(prefs || {}) };
    const radius = Number(out.radiusLimit);
    if (out.radiusLimit === undefined || !Number.isFinite(radius) || radius > RADIUS.MAX)
        out.radiusLimit = RADIUS.DEFAULT;
    else if (radius < RADIUS.MIN) out.radiusLimit = RADIUS.MIN;
    if (out.weatherModel === 'meteoblue') out.weatherModel = 'best_match';
    if ('sortMode' in out && !SORT_MODES.includes(out.sortMode)) delete out.sortMode;
    if ('weatherModel' in out && !WEATHER_MODEL_KEYS.includes(out.weatherModel)) delete out.weatherModel;
    return out;
}

class SitesService {
    constructor() {
        this.PREFERENCE_KEYS = [
            'limitWindMin',
            'limitWindMax',
            'limitGustDelta',
            'filterWindInclude',
            'filterWindExclude',
            'filterTypeInclude',
            'filterTypeExclude',
            'filterFavoritesOnly',
            'forecastMaxRange',
            'activeMapLayers',
            'hideUnflyable',
            'radiusLimit',
            'sortMode',
            'conditionsStrategy',
            'weatherModel',
            'filterMode',
        ];

        /** @type {Array} Catalogue des sites (sites_data.json), chargé à la demande. */
        this._sites = [];

        this.state = {
            filterWind: [],
            filterType: [],
            filterWindInclude: [],
            filterWindExclude: [],
            filterTypeInclude: [],
            filterTypeExclude: [],
            userLocation: null,
            radiusLimit: /** @type {number} */ (RADIUS.DEFAULT),
            sortMode: 'CONDITIONS',
            conditionsStrategy: 'CONSECUTIVE',
            forecastOffset: 0,
            weatherForecasts: {},
            limitWindMin: WIND_THRESHOLDS.DEFAULT_MIN,
            limitWindMax: WIND_THRESHOLDS.DEFAULT_MAX,
            limitGustDelta: WIND_THRESHOLDS.GUST_DELTA,
            hideUnflyable: false,
            weatherModel: WEATHER_MODELS.AROME,
            searchQuery: '',
            filterFavoritesOnly: false,
            forecastMaxRange: 120,
            /** @type {Record<string, any>} */
            userPreferences: {
                pilotLevel: 'ALL',
                favoriteSites: [],
                minimizedSites: [],
                savedLocations: [],
                forecastMaxRange: 120,
                activeMapLayers: [
                    'leaflet',
                    'windy',
                    'meteoparapente',
                    'paraglidingearth',
                    'paraglidable',
                    'isofronts',
                ],
                limitWindMin: WIND_THRESHOLDS.DEFAULT_MIN,
                limitWindMax: WIND_THRESHOLDS.DEFAULT_MAX,
                limitGustDelta: WIND_THRESHOLDS.GUST_DELTA,
                hideUnflyable: false,
                filterTypeExclude: [],
                radiusLimit: /** @type {number} */ (RADIUS.DEFAULT),
                sortMode: 'CONDITIONS',
                conditionsStrategy: 'CONSECUTIVE',
                weatherModel: WEATHER_MODELS.AROME,
            },
            activeMapLayers: ['leaflet', 'windy', 'meteoparapente', 'paraglidingearth', 'paraglidable', 'isofronts'],
        };
    }

    /**
     * Charge sites_data.json de façon asynchrone (lazy loading / non-bloquant).
     * Partage une même promesse pour éviter tout fetch en double.
     * @returns {Promise<Array>} Tableau des sites chargés
     */
    async ensureSitesLoaded() {
        if (this._sites.length > 0) return this._sites;
        if (this._sitesLoadingPromise) return this._sitesLoadingPromise;
        this._sitesLoadingPromise = (async () => {
            try {
                const response = await fetch('js/data/sites_data.json');
                this.setSites(await response.json());
            } catch (err) {
                console.error('[SitesService] Erreur lors du chargement de sites_data.json:', err);
            } finally {
                this._sitesLoadingPromise = null;
            }
            return this._sites;
        })();
        return this._sitesLoadingPromise;
    }

    /**
     * Remplace le catalogue des sites (chargement, tests).
     * @param {Array} sites
     */
    setSites(sites) {
        this._sites = Array.isArray(sites) ? sites : [];
    }

    /**
     * Retourne le catalogue des sites chargés. SitesService en est l'unique source de vérité.
     * @returns {Array}
     */
    getSites() {
        return this._sites;
    }

    /**
     * Recherche un site par identifiant en temps constant O(1) via Map interne.
     * @param {string|number} id L'identifiant du site
     * @returns {Object|null}
     */
    getSiteById(id) {
        if (!id) return null;
        const sites = this.getSites();
        if (!sites.length) return null;
        if (this._siteMapSource !== sites) {
            this._siteMap = new Map();
            sites.forEach((s) => {
                if (s && s.id !== undefined) this._siteMap.set(String(s.id), s);
            });
            this._siteMapSource = sites;
        }
        return this._siteMap.get(String(id)) || null;
    }

    init() {
        this.loadUserPreferences();
    }

    loadUserPreferences() {
        if (window.FirebaseAuthEngine) {
            this.state.userPreferences = window.FirebaseAuthEngine.getLocalPreferences();
        } else {
            const saved = StorageService.get(StorageService.KEYS.USER_PREFS);
            this.state.userPreferences =
                saved && typeof saved === 'object'
                    ? saved
                    : {
                          pilotLevel: 'ALL',
                          favoriteSites: [],
                          minimizedSites: [],
                          savedLocations: [],
                          forecastMaxRange: 120,
                      };

            const globalLevel = StorageService.get(StorageService.KEYS.USER_LEVEL);
            if (globalLevel) {
                this.state.userPreferences.pilotLevel = globalLevel;
            }
        }

        // Ensure arrays exist
        if (!this.state.userPreferences.savedLocations) this.state.userPreferences.savedLocations = [];
        if (!this.state.userPreferences.forecastMaxRange) this.state.userPreferences.forecastMaxRange = 120;

        // Apply saved limit and filter settings if they exist dynamically.
        // Réglages retirés ou renommés (spec 002) convertis d'abord : rayon « Illimité », modèle « meteoblue ».
        const prefs = migrateSitePrefs(this.state.userPreferences);
        this.state.userPreferences = prefs;
        const typeMapping = {
            Atterrissage: 'ATTERRO',
            'Site Naturel': 'NATUREL',
            Naturel: 'NATUREL',
            Dune: 'DUNE',
            Soaring: 'SOARING',
            Treuil: 'TREUIL',
            'Piste de Treuil': 'TREUIL',
            'Pente école': 'GONFLAGE',
            Gonflage: 'GONFLAGE',
        };

        for (const key of this.PREFERENCE_KEYS) {
            if (prefs[key] !== undefined) {
                let val = prefs[key];
                if ((key === 'filterTypeInclude' || key === 'filterTypeExclude') && Array.isArray(val)) {
                    val = val.map((v) => typeMapping[v] || v);
                }
                this.state[key] = val;
            }
        }

        // Sync UI with state
        const maxInput = /** @type {HTMLInputElement} */ (document.getElementById('limit-wind-max'));
        const gustInput = /** @type {HTMLInputElement} */ (document.getElementById('limit-gust-delta'));
        const forecastRangeSelect = /** @type {HTMLSelectElement} */ (document.getElementById('forecast-range-select'));
        const filterModeSelect = /** @type {HTMLSelectElement} */ (document.getElementById('filter-mode-select'));

        if (maxInput) maxInput.value = String(this.state.limitWindMax);
        if (gustInput) gustInput.value = String(this.state.limitGustDelta);
        if (forecastRangeSelect) forecastRangeSelect.value = String(this.state.forecastMaxRange);
        if (filterModeSelect && this.state.filterMode) filterModeSelect.value = this.state.filterMode;

        this.updateHideUnflyableDuration();

        // UI logic moved to sites.js
        if (this.updateMapTogglesVisibility) {
            this.updateMapTogglesVisibility();
        }
    }

    savePreferences() {
        if (!this.state.userPreferences)
            this.state.userPreferences = { pilotLevel: 'ALL', favoriteSites: [], minimizedSites: [] };

        // Save all dynamic preferences
        for (const key of this.PREFERENCE_KEYS) {
            this.state.userPreferences[key] = this.state[key];
        }
        // savedLocations is mutated directly in the array, but let's be sure

        StorageService.set(StorageService.KEYS.USER_PREFS, this.state.userPreferences);
        if (window.FirebaseAuthEngine && window.FirebaseAuthEngine.currentUser) {
            window.FirebaseAuthEngine.savePreferencesToCloud().catch((error) =>
                console.warn('Échec de la synchro Cloud en arrière-plan :', error),
            );
        }
    }

    removeAccents(str) {
        return removeAccents(str);
    }

    escapeHtml(str) {
        return str.replace(/["]/g, '&quot;').replace(/[']/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    isForecastFlyable(site, weather) {
        // 1. Construire l'objet des préférences de l'utilisateur
        const userPrefs = {
            vMin: this.state.limitWindMin,
            vMax: this.state.limitWindMax,
            deltaRafaleMax: this.state.limitGustDelta,
            filterMode: this.state.filterMode,
            wings:
                this.state.filterMode === 'hardware'
                    ? StorageService.get(StorageService.KEYS.EQUIPMENT_DATA, []) || []
                    : [],
        };

        // 2. Déterminer la meilleure orientation du site par rapport au vent actuel
        let bestOrientation = undefined;

        const orientations = getSiteOrientations(site);
        if (orientations.length > 0 && weather && weather.windDirDeg !== null && weather.windDirDeg !== undefined) {
            const CARD_TO_DEG = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SO: 225, O: 270, NO: 315 };
            let minDiff = 180;

            orientations.forEach((card) => {
                const deg = CARD_TO_DEG[card];
                if (deg !== undefined) {
                    // Trouver la différence angulaire
                    const diff = getAngularDifference(weather.windDirDeg, deg);

                    if (diff < minDiff) {
                        minDiff = diff;
                        bestOrientation = deg;
                    }
                }
            });
        }

        // 3. Préparer l'objet site pour l'évaluateur (on ne modifie pas l'objet original)
        const siteGeometry = {
            ...site,
            orientation_ideale_deg: bestOrientation,
        };

        // 4. Appel du nouveau module de scoring
        return evaluateSpotForecast(siteGeometry, weather, userPrefs);
    }

    // Résout le endpoint Open-Meteo + paramètre de modèle pour une clé de modèle donnée.
    // Extrait de fetchWeatherForSites pour être réutilisé par le fetch du modèle secondaire
    // (indice de confiance multi-modèles).
    _resolveModelEndpoint(modelKey) {
        let apiEndpoint = WEATHER_MODELS.AROME; // default AROME
        if (modelKey === 'icon' || modelKey === 'iconeu') apiEndpoint = 'dwd-icon';
        else if (modelKey === 'gfs') apiEndpoint = 'gfs';
        else if (modelKey === 'ecmwf') apiEndpoint = 'ecmwf';
        // Sélection automatique multi-modèles d'Open-Meteo (anciennement libellée « Meteoblue »,
        // qu'elle n'a jamais utilisé — spec 002, FR-008).
        else if (modelKey === 'best_match') apiEndpoint = 'forecast';

        let modelParam = '';
        if (modelKey === 'iconeu') modelParam = '&models=icon_eu';
        else if (modelKey === 'icon') modelParam = '&models=icon_global';

        return { apiEndpoint, modelParam };
    }

    // Récupère un 2e modèle météo (différent de celui choisi par l'utilisateur) pour les seuls
    // sites favoris, au créneau actuel — sert uniquement à calculer un indice de confiance
    // ("modèles d'accord/en désaccord") dans le comparateur multi-sites. Volontairement léger
    // (2 jours, pas de chunking) puisque limité aux favoris, contrairement au fetch principal
    // qui couvre tous les sites actifs sur toute la fenêtre de prévision.
    /** Second modèle de la comparaison : GFS, ou AROME quand GFS est le modèle principal. */
    getSecondaryModelKey() {
        return this.state.weatherModel === 'gfs' ? 'meteofrance' : 'gfs';
    }

    /**
     * Charge le second modèle pour les mêmes sites que le modèle principal (sites du rayon +
     * favoris) et les mêmes heures, pour comparer l'heure affichée (spec 002, US3, FR-009/010).
     * Mêmes lots de 400 sites, même cache de 10 min et même pause après un refus d'Open-Meteo
     * que le modèle principal (FR-010a) : pendant cette pause, rien n'est demandé et la
     * comparaison est simplement indisponible.
     * `weatherForecastsSecondary[id]` est un tableau aligné sur `weatherForecasts[id]` (même
     * index = même heure, appariées par leur date-heure).
     */
    async fetchSecondaryModel() {
        const secondaryModelKey = this.getSecondaryModelKey();
        if (secondaryModelKey === this.state.weatherModel) {
            this.state.weatherForecastsSecondary = {};
            return { success: true };
        }
        if (this.getWeatherCooldownRemainingMs() > 0) return { success: false, reason: this._failureReason() };

        const sites = this.getGeoFilteredSites(this.getSites()).filter(
            (site) => (this.state.weatherForecasts[site.id] || []).length > 0,
        );
        if (sites.length === 0) {
            this.state.weatherForecastsSecondary = {};
            return { success: true };
        }

        const { apiEndpoint, modelParam } = this._resolveModelEndpoint(secondaryModelKey);
        if (!this._weatherCache) this._weatherCache = new Map();
        const CHUNK_SIZE = 400;
        const secondary = {};
        try {
            for (let i = 0; i < sites.length; i += CHUNK_SIZE) {
                const chunkSites = sites.slice(i, i + CHUNK_SIZE);
                const lats = chunkSites.map((x) => parseFloat(x.latitude || x.lat)).join(',');
                const lons = chunkSites.map((x) => parseFloat(x.longitude || x.lon)).join(',');
                const url = `https://api.open-meteo.com/v1/${apiEndpoint}?latitude=${lats}&longitude=${lons}&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,cape&timezone=Europe%2FParis&forecast_days=8${modelParam}`;

                let results;
                const cached = this._weatherCache.get(url);
                if (cached && Date.now() - cached.timestamp < SitesService.WEATHER_CACHE_TTL_MS) {
                    results = cached.results;
                } else {
                    const response = await this._fetchWithBackoff(url);
                    if (response.status === 429) {
                        this._weatherCooldownUntil = Date.now() + SitesService.WEATHER_COOLDOWN_MS;
                    }
                    if (!response.ok) throw new Error(`Open-Meteo HTTP ${response.status} (modèle de comparaison)`);
                    const data = await response.json();
                    results = Array.isArray(data) ? data : [data];
                    this._weatherCache.set(url, { timestamp: Date.now(), results });
                }

                chunkSites.forEach((site, index) => {
                    const hourly = results[index]?.hourly;
                    if (!hourly || !Array.isArray(hourly.time)) return;
                    const indexByTime = new Map(hourly.time.map((time, idx) => [time, idx]));
                    secondary[site.id] = (this.state.weatherForecasts[site.id] || []).map((primaryHour) => {
                        const idx = indexByTime.get(primaryHour.time);
                        if (idx === undefined) return null;
                        // Valeurs validées : une donnée absente reste null, jamais 0 (spec 001).
                        const dirDeg = normalizeForecastValue(hourly.wind_direction_10m?.[idx], 'windDir');
                        return {
                            time: hourly.time[idx],
                            windSpeed: normalizeForecastValue(hourly.wind_speed_10m?.[idx], 'windSpeed'),
                            windGust: normalizeForecastValue(hourly.wind_gusts_10m?.[idx], 'windGust'),
                            windDirDeg: dirDeg,
                            windCard: dirDeg === null ? null : degreesToCardinal(dirDeg),
                            precipitation: normalizeForecastValue(hourly.precipitation?.[idx], 'precipitation'),
                            cape: normalizeForecastValue(hourly.cape?.[idx], 'cape'),
                        };
                    });
                });
            }
            this.state.weatherForecastsSecondary = secondary;
            this.state.secondaryModelKey = secondaryModelKey;
            return { success: true };
        } catch (e) {
            console.error('Erreur météo (modèle de comparaison):', e);
            return { success: false, error: e, reason: this._failureReason() };
        }
    }

    /**
     * Accord entre le modèle principal et le second modèle pour UNE heure (par défaut l'heure
     * affichée) — les deux modèles à la même heure (spec 002, FR-009). N'altère jamais le
     * verdict principal (FR-011).
     * @returns {{state: 'agree'|'disagree'|'unavailable'|'not_compared', secondaryModelKey: string, secondaryOutcome: {reason: string, reasonCode: string}|null}}
     */
    getModelAgreement(site, offset = this.state.forecastOffset) {
        const secondaryModelKey = this.getSecondaryModelKey();
        const result = (state, secondaryOutcome = null) => ({ state, secondaryModelKey, secondaryOutcome });
        if (secondaryModelKey === this.state.weatherModel) return result('not_compared');

        const primaryForecast = (this.state.weatherForecasts[site.id] || [])[offset];
        const secondaryForecast = ((this.state.weatherForecastsSecondary || {})[site.id] || [])[offset];
        if (!primaryForecast || !secondaryForecast) return result('unavailable');

        // Le jour/la nuit ne dépend pas du modèle : la requête du second modèle ne demande pas les
        // heures de lever/coucher, on reprend celles du modèle principal pour la même heure.
        const primary = this.isForecastFlyable(site, primaryForecast);
        const secondary = this.isForecastFlyable(site, { ...secondaryForecast, isDaytime: primaryForecast.isDaytime });
        // Une prévision incomplète ne permet pas de comparer : jamais présentée comme un accord.
        if (primary.status === 'incomplete' || secondary.status === 'incomplete') return result('unavailable');
        return result(primary.flyable === secondary.flyable ? 'agree' : 'disagree', secondary);
    }

    static WEATHER_CACHE_TTL_MS = 10 * 60 * 1000;

    // Après un lot rejeté par Open-Meteo malgré les 3 tentatives ci-dessous, on arrête
    // d'appeler l'API pendant ce délai : réessayer plus vite ne fait que reproduire le même
    // 429 (le quota par IP est horaire, pas minute), et ça vide le quota un peu plus à chaque
    // tentative ratée. sites.js désactive "Réessayer" et affiche un compte à rebours pendant
    // ce temps ; getWeatherCooldownRemainingMs() lui permet de le calculer.
    static WEATHER_COOLDOWN_MS = 3 * 60 * 1000;

    getWeatherCooldownRemainingMs() {
        return Math.max(0, (this._weatherCooldownUntil || 0) - Date.now());
    }

    // Un seul essai supplémentaire à +2s ne laisse pas le temps au quota par minute de
    // se reconstituer : Open-Meteo a déjà re-rejeté ce deuxième essai en pratique (cf. #22
    // pour le même correctif côté carnet de vol). 3 tentatives avec un backoff croissant
    // (immédiat, +3s, +12s) restent sous un délai total raisonnable pour un lot, tout en
    // laissant une vraie chance au quota de se libérer.
    async _fetchWithBackoff(url, signal) {
        const delaysMs = [0, 3000, 12000];
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        let response;
        for (let attempt = 0; attempt < delaysMs.length; attempt++) {
            if (delaysMs[attempt]) await sleep(delaysMs[attempt]);
            response = await fetch(url, { signal });
            if (response.status !== 429) return response;
        }
        return response;
    }

    // -----------------------------------------------------------------------------------------
    // Dernière prévision disponible hors ligne (spec 007)
    // -----------------------------------------------------------------------------------------

    /** Active le curseur d'heure pour `hoursAvailable` heures de prévision. */
    _setupForecastSlider(hoursAvailable) {
        const slider = /** @type {HTMLInputElement} */ (document.getElementById('forecast-slider'));
        if (!slider) return;
        slider.disabled = false;
        const maxVal = Math.max(0, hoursAvailable - 1);
        const sliderMax = Math.min(maxVal, this.state.forecastMaxRange || 120);
        slider.max = String(sliderMax);
        // Adjust offset if it exceeds new max
        if (this.state.forecastOffset > sliderMax) this.state.forecastOffset = sliderMax;
        slider.value = String(this.state.forecastOffset);
        const percentage = sliderMax > 0 ? (this.state.forecastOffset / sliderMax) * 100 : 0;
        slider.style.background = `linear-gradient(to right, var(--accent-orange) 0%, var(--accent-orange) ${percentage}%, rgba(255,255,255,0.1) ${percentage}%, rgba(255,255,255,0.1) 100%)`;
    }

    /**
     * Enregistre sur l'appareil la prévision de chaque site (modèle, heure de récupération, heures)
     * après un chargement réussi (FR-001). Un échec du stockage est sans conséquence (FR-007).
     */
    async saveForecastSnapshot() {
        if (this.state.forecastSource !== 'live') return;
        const entries = Object.entries(this.state.weatherForecasts || {})
            .filter(([siteId]) => this.state.forecastProvenance && this.state.forecastProvenance[siteId])
            .map(([siteId, forecasts]) => {
                const { modelKey, fetchedAt } = this.state.forecastProvenance[siteId];
                return { key: `forecast:${siteId}`, value: { siteId, modelKey, fetchedAt, forecasts } };
            });
        if (entries.length === 0) return;
        try {
            await IDBStorage.setValues(entries);
        } catch (e) {
            console.warn('Prévision non enregistrée sur l’appareil :', e);
        }
    }

    /**
     * Restaure les prévisions enregistrées (FR-002/003/005/006) : heures passées retirées, modèle et
     * heure de récupération d'origine conservés, enregistrements sans heure à venir supprimés,
     * comparaison de modèles vidée (indisponible hors ligne).
     * @returns {Promise<number>} nombre de sites restaurés
     */
    async restoreForecastSnapshot(now = Date.now()) {
        let records;
        try {
            records = await IDBStorage.getValuesByPrefix('forecast:');
        } catch (e) {
            console.warn('Prévisions enregistrées illisibles :', e);
            return 0;
        }
        // Heure courante au format des prévisions (« AAAA-MM-JJTHH:00 », heure locale).
        const d = new Date(now);
        const pad = (n) => String(n).padStart(2, '0');
        const currentHour = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;

        const forecasts = {};
        const provenance = {};
        const expired = [];
        for (const record of records) {
            const value = record && record.value;
            const future = (value?.forecasts || []).filter((hour) => String(hour.time) >= currentHour);
            if (!value || future.length === 0) {
                expired.push(record.key);
                continue;
            }
            forecasts[value.siteId] = future;
            provenance[value.siteId] = { modelKey: value.modelKey, fetchedAt: value.fetchedAt };
        }
        if (expired.length > 0) {
            IDBStorage.deleteValues(expired).catch(() => {});
        }
        const count = Object.keys(forecasts).length;
        if (count === 0) return 0;

        this.state.weatherForecasts = forecasts;
        this.state.forecastProvenance = provenance;
        this.state.weatherForecastsSecondary = {};
        this.state.forecastSource = 'saved';
        this.state.forecastOffset = 0;
        this._setupForecastSlider(Math.max(...Object.values(forecasts).map((f) => f.length)));
        return count;
    }

    /** Résultat d'échec complété par la restauration des prévisions enregistrées, si rien n'est en mémoire. */
    async _withSavedForecast(result) {
        if (Object.keys(this.state.weatherForecasts || {}).length > 0) return result;
        return { ...result, restored: await this.restoreForecastSnapshot() };
    }

    /** Prévision récupérée il y a plus de 3 h (spec 002, FR-005). */
    isForecastStale(siteId, now = Date.now()) {
        const p = this.state.forecastProvenance && this.state.forecastProvenance[siteId];
        return !!p && now - p.fetchedAt > STALE_AFTER_MS;
    }

    /** Raison d'un échec de récupération, en français, pour l'afficher au pilote (FR-006). */
    _failureReason() {
        const cooldownMs = this.getWeatherCooldownRemainingMs();
        if (cooldownMs > 0) return t('forecast.refreshQuota', { minutes: Math.max(1, Math.ceil(cooldownMs / 60000)) });
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return t('forecast.refreshOffline');
        return t('forecast.refreshError');
    }

    /**
     * @param {{force?: boolean}} [options] force : ignorer le cache (bouton « Actualiser »).
     */
    async fetchWeatherForSites({ force = false } = {}) {
        // Plusieurs déclencheurs (show(), changeWeatherModel(), scheduleWeatherRescopeIfNeeded())
        // peuvent chacun poser cet indicateur puis retourner tôt (cooldown, aucun site) ou
        // s'annuler mutuellement : sans ce nettoyage à chaque sortie, il reste bloqué à l'écran
        // dès que ce n'est pas l'appel qui l'avait créé qui termine en dernier.
        const clearLoadingIndicator = () => {
            document.getElementById('weather-loading-indicator')?.remove();
        };

        const allSites = this.getSites();
        if (allSites.length === 0) {
            clearLoadingIndicator();
            return;
        }

        const cooldownRemaining = this.getWeatherCooldownRemainingMs();
        if (cooldownRemaining > 0) {
            clearLoadingIndicator();
            return this._withSavedForecast({
                success: false,
                error: { message: t('sites.service.saturated') },
                cooldownRemainingMs: cooldownRemaining,
                reason: this._failureReason(),
            });
        }

        // On ne récupère la météo QUE pour les sites que les filtres actuels
        // (recherche, rayon, favoris, orientation, type) laissent réellement
        // candidats à l'affichage — pas la base entière (~1800 sites dans le monde)
        // à chaque fois. Un rayon de 50km autour de l'utilisateur peut réduire ça
        // à quelques dizaines de sites, ce qui évite de saturer le quota Open-Meteo
        // et rend le chargement bien plus rapide.
        const activeSites = this.getGeoFilteredSites(allSites);
        if (activeSites.length === 0) {
            clearLoadingIndicator();
            return;
        }

        // Open-Meteo (derrière nginx) répond 414 "Request-URI Too Large" au-delà
        // d'environ 8-9 Ko d'URL (~500-600 sites en une seule requête). On découpe
        // donc en lots pour rester largement sous cette limite, quelle que soit la
        // taille de la base de sites.
        const CHUNK_SIZE = 400;
        const chunks = [];
        for (let i = 0; i < activeSites.length; i += CHUNK_SIZE) {
            chunks.push(activeSites.slice(i, i + CHUNK_SIZE));
        }

        const { apiEndpoint, modelParam } = this._resolveModelEndpoint(this.state.weatherModel);

        // Cache court (10 min) : le vent ne change pas assez vite pour justifier un
        // re-fetch complet à chaque montage de vue ou changement rapide de modèle.
        const WEATHER_CACHE_TTL_MS = SitesService.WEATHER_CACHE_TTL_MS;
        if (!this._weatherCache) this._weatherCache = new Map();

        if (this.abortController) {
            this.abortController.abort();
        }
        const controller = new AbortController();
        this.abortController = controller;

        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

        let results;
        /** @type {number[]} heure de récupération de chaque résultat (même index que results) */
        let resultsFetchedAt = [];
        try {
            // Séquentiel (pas Promise.all) : 5 lots tirés en même temps se sont déjà
            // fait rejeter en bloc par Open-Meteo avec un 429 "Hourly API request
            // limit exceeded" — un seul lot à la fois, avec une pause entre chaque
            // et un backoff sur 429 (voir _fetchWithBackoff), reste sous ce seuil.
            const chunkResults = [];
            const chunkFetchedAt = [];
            for (const chunkSites of chunks) {
                const chunkLats = chunkSites.map((s) => parseFloat(s.latitude || s.lat)).join(',');
                const chunkLons = chunkSites.map((s) => parseFloat(s.longitude || s.lon)).join(',');
                // forecast_days=8 (et non 6) pour garder ~168h (7 jours) de marge même quand
                // l'heure courante tombe tard dans la journée 1 (cf. digest 7 jours, forecastMaxRange=168).
                const url = `https://api.open-meteo.com/v1/${apiEndpoint}?latitude=${chunkLats}&longitude=${chunkLons}&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,cape&daily=sunrise,sunset&timezone=Europe%2FParis&forecast_days=8${modelParam}`;

                const cached = this._weatherCache.get(url);
                if (!force && cached && Date.now() - cached.timestamp < WEATHER_CACHE_TTL_MS) {
                    chunkResults.push(cached.results);
                    // Heure de la récupération d'origine, jamais celle de la relecture du cache
                    // (spec 002, FR-004).
                    chunkFetchedAt.push(...cached.results.map(() => cached.timestamp));
                    continue;
                }

                const response = await this._fetchWithBackoff(url, controller.signal);
                if (response.status === 429) {
                    this._weatherCooldownUntil = Date.now() + SitesService.WEATHER_COOLDOWN_MS;
                }
                if (!response.ok) {
                    throw new Error(`Open-Meteo HTTP ${response.status} pour un lot de ${chunkSites.length} sites`);
                }
                const data = await response.json();
                const chunkArr = Array.isArray(data) ? data : [data];
                const fetchedAt = Date.now();
                this._weatherCache.set(url, { timestamp: fetchedAt, results: chunkArr });
                chunkResults.push(chunkArr);
                chunkFetchedAt.push(...chunkArr.map(() => fetchedAt));

                if (chunks.length > 1) await sleep(250);
            }
            results = chunkResults.flat();
            resultsFetchedAt = chunkFetchedAt;
        } catch (e) {
            // Un appel plus récent à fetchWeatherForSites() (filtre changé, GPS mis à jour,
            // modèle météo changé...) a annulé celui-ci pour prendre le relais : ce n'est pas
            // un vrai échec réseau. Le laisser afficher "Météo indisponible" ici écraserait
            // (ou courrait après) le résultat de l'appel plus récent, qui gère déjà l'UI.
            if (e.name === 'AbortError' && this.abortController !== controller) {
                return { success: null };
            }
            clearLoadingIndicator();
            console.error('Erreur lors de la récupération météo:', e);
            return this._withSavedForecast({
                success: false,
                error: e,
                cooldownRemainingMs: this.getWeatherCooldownRemainingMs(),
                reason: this._failureReason(),
            });
        }

        try {
            this.state.weatherForecasts = {};
            this.state.forecastProvenance = {};

            // Find current time index in hourly forecast to align offset=0 with current hour
            const now = new Date();
            let currentHourIndex = 0;
            if (results[0]?.hourly?.time) {
                const times = results[0].hourly.time;
                const currentTimestamp = now.getTime();
                let minDiff = Infinity;
                times.forEach((t, i) => {
                    const diff = Math.abs(new Date(t).getTime() - currentTimestamp);
                    if (diff < minDiff) {
                        minDiff = diff;
                        currentHourIndex = i;
                    }
                });
            }

            activeSites.forEach((site, index) => {
                try {
                    const hourly = results[index]?.hourly;
                    if (hourly) {
                        const forecasts = [];
                        const windSpeedKey =
                            Object.keys(hourly).find((k) => k.startsWith('wind_speed_10m')) || 'wind_speed_10m';
                        const windDirKey =
                            Object.keys(hourly).find((k) => k.startsWith('wind_direction_10m')) || 'wind_direction_10m';
                        const windGustKey =
                            Object.keys(hourly).find((k) => k.startsWith('wind_gusts_10m')) || 'wind_gusts_10m';
                        const precipKey =
                            Object.keys(hourly).find((k) => k.startsWith('precipitation')) || 'precipitation';
                        const capeKey = Object.keys(hourly).find((k) => k.startsWith('cape')) || 'cape';

                        // Keep up to 168 hours (7 jours, cf. digest hebdo) starting from currentHourIndex
                        for (let i = 0; i <= 168; i++) {
                            const idx = currentHourIndex + i;
                            if (idx < hourly.time.length) {
                                // Valeurs validées : une donnée absente (ex. au-delà de l'horizon
                                // AROME, ~108 h) reste null, jamais 0 (spec 001, FR-005).
                                const dirDeg = normalizeForecastValue(hourly[windDirKey]?.[idx], 'windDir');
                                const card = dirDeg === null ? null : degreesToCardinal(dirDeg);

                                let sunriseText = '';
                                let sunsetText = '';
                                let legalStartText = '';
                                let legalEndText = '';
                                // Inconnu tant que lever/coucher du soleil ne sont pas fournis pour ce
                                // jour : on ne suppose plus qu'il fait jour (spec 001, FR-002).
                                /** @type {boolean|null} */
                                let isDaytime = null;

                                const daily = results[index]?.daily;
                                if (daily && daily.time) {
                                    const datePart = hourly.time[idx].substring(0, 10);
                                    const dailyIdx = daily.time.indexOf(datePart);

                                    if (dailyIdx !== -1) {
                                        const sunriseStr = daily.sunrise ? daily.sunrise[dailyIdx] : null;
                                        const sunsetStr = daily.sunset ? daily.sunset[dailyIdx] : null;

                                        if (sunriseStr && sunsetStr) {
                                            sunriseText = sunriseStr.substring(11, 16).replace(':', 'h');
                                            sunsetText = sunsetStr.substring(11, 16).replace(':', 'h');

                                            const forecastHour = parseInt(hourly.time[idx].substring(11, 13));
                                            const forecastMin = parseInt(hourly.time[idx].substring(14, 16));
                                            const forecastMins = forecastHour * 60 + forecastMin;

                                            const sunriseHour = parseInt(sunriseStr.substring(11, 13));
                                            const sunriseMin = parseInt(sunriseStr.substring(14, 16));
                                            const sunriseMins = sunriseHour * 60 + sunriseMin;

                                            const sunsetHour = parseInt(sunsetStr.substring(11, 13));
                                            const sunsetMin = parseInt(sunsetStr.substring(14, 16));
                                            const sunsetMins = sunsetHour * 60 + sunsetMin;

                                            const legalStartMins = sunriseMins - 30;
                                            const legalEndMins = sunsetMins - 30;

                                            const formatMinsToTime = (totalMins) => {
                                                const normalized = (totalMins + 1440) % 1440;
                                                const hh = String(Math.floor(normalized / 60)).padStart(2, '0');
                                                const mm = String(normalized % 60).padStart(2, '0');
                                                return `${hh}h${mm}`;
                                            };

                                            legalStartText = formatMinsToTime(legalStartMins);
                                            legalEndText = formatMinsToTime(legalEndMins);

                                            isDaytime = forecastMins >= legalStartMins && forecastMins <= legalEndMins;
                                        }
                                    }
                                }

                                forecasts.push({
                                    time: hourly.time[idx],
                                    windSpeed: normalizeForecastValue(hourly[windSpeedKey]?.[idx], 'windSpeed'),
                                    windGust: normalizeForecastValue(hourly[windGustKey]?.[idx], 'windGust'),
                                    windDirDeg: dirDeg,
                                    windCard: card,
                                    precipitation: normalizeForecastValue(hourly[precipKey]?.[idx], 'precipitation'),
                                    cape: normalizeForecastValue(hourly[capeKey]?.[idx], 'cape'),
                                    sunriseText: sunriseText,
                                    sunsetText: sunsetText,
                                    legalStartText: legalStartText,
                                    legalEndText: legalEndText,
                                    isDaytime: isDaytime,
                                });
                            }
                        }
                        this.state.weatherForecasts[site.id] = forecasts;
                        this.state.forecastProvenance[site.id] = {
                            modelKey: this.state.weatherModel,
                            fetchedAt: resultsFetchedAt[index],
                        };
                    }
                } catch (siteErr) {
                    console.error(`Erreur lors du traitement météo pour le site ${site.nom}:`, siteErr);
                }
            });

            this._setupForecastSlider((results[0]?.hourly?.time?.length || 121) - currentHourIndex);
            this.state.forecastSource = 'live';
            // Enregistrée sur l'appareil pour le hors-ligne, sans retarder l'affichage (spec 007).
            setTimeout(() => this.saveForecastSnapshot(), 0);
            clearLoadingIndicator();
            return { success: true };
        } catch (e) {
            clearLoadingIndicator();
            console.error('Erreur lors de la récupération météo:', e);
            return { success: false, error: e };
        }
    }

    // La météo n'est plus chargée que pour les sites du périmètre courant (voir
    // getGeoFilteredSites) : quand ce périmètre change (recherche, rayon, GPS,
    // filtres vent/type/favoris), certains sites nouvellement affichés peuvent
    // ne pas avoir encore de prévisions. On revérifie après un court debounce
    // (pour ne pas spammer Open-Meteo à chaque frappe clavier) et on ne relance
    // un fetch que si des sites du périmètre manquent vraiment de données.
    scheduleWeatherRescopeIfNeeded() {
        clearTimeout(this._weatherRescopeTimer);
        this._weatherRescopeTimer = setTimeout(() => {
            const allSites = this.getSites();
            if (allSites.length === 0) return;
            const candidates = this.getGeoFilteredSites(allSites);
            const missing = candidates.some((s) => !this.state.weatherForecasts[s.id]);
            if (!missing) return;

            this.fetchWeatherForSites().then((result) => {
                if (sitesView()?.handleWeatherFetchResult) {
                    sitesView().handleWeatherFetchResult(result);
                    return;
                }
                sitesView()?.renderList?.();
            });
        }, 400);
    }

    // Tous les filtres qui NE dépendent PAS de la météo (recherche, favoris,
    // orientation, type, rayon). Sert à la fois pour l'affichage et pour savoir
    // pour quels sites récupérer la météo — inutile d'interroger Open-Meteo
    // pour 1800 sites dans le monde entier quand le rayon/la recherche n'en
    // laissent que quelques dizaines de candidats à l'écran.
    /**
     * Provenance de la prévision d'un site (spec 002, US1) : modèle, heure de récupération
     * d'origine et heure de calcul du modèle si Open-Meteo la fournit (sinon null).
     * @returns {{modelKey: string, fetchedAt: number, runAt: number|null} | null}
     */
    getForecastProvenance(siteId) {
        const p = this.state.forecastProvenance && this.state.forecastProvenance[siteId];
        if (!p) return null;
        const cachedRun = this._runTimeCache && this._runTimeCache.get(p.modelKey);
        return { modelKey: p.modelKey, fetchedAt: p.fetchedAt, runAt: cachedRun ? cachedRun.value : null };
    }

    /**
     * Heure de calcul (run) du modèle, lue dans les métadonnées Open-Meteo
     * (`/data/{metaModel}/static/meta.json`), gardée 30 min. null si le modèle n'a pas d'heure de
     * calcul unique (sélection automatique) ou si la demande échoue : rien n'est alors affiché
     * plutôt qu'une heure inventée (spec 002, FR-003).
     * @param {string} modelKey
     * @returns {Promise<number|null>}
     */
    async fetchModelRunTime(modelKey) {
        const info = WEATHER_MODEL_INFO[modelKey];
        if (!info || !info.metaModel) return null;
        if (!this._runTimeCache) this._runTimeCache = new Map();
        const cached = this._runTimeCache.get(modelKey);
        if (cached && Date.now() - cached.at < SitesService.RUN_TIME_CACHE_MS) return cached.value;
        let value = null;
        try {
            const response = await fetch(`https://api.open-meteo.com/data/${info.metaModel}/static/meta.json`);
            if (response.ok) {
                const meta = await response.json();
                const seconds = Number(meta && meta.last_run_initialisation_time);
                if (Number.isFinite(seconds) && seconds > 0) value = seconds * 1000;
            }
        } catch {
            value = null;
        }
        this._runTimeCache.set(modelKey, { at: Date.now(), value });
        return value;
    }

    static RUN_TIME_CACHE_MS = 30 * 60 * 1000;

    /**
     * Position de référence des distances : celle du pilote (GPS ou adresse), sinon
     * Boulogne-sur-Mer (spec 002, FR-017) — le filtre du rayon s'applique donc toujours.
     * @returns {{lat: number, lng: number, name?: string, isDefault?: boolean}}
     */
    getEffectiveLocation() {
        return this.state.userLocation || DEFAULT_LOCATION;
    }

    /** Distance (km) d'un site à la position de référence, mémorisée tant que celle-ci ne change pas. */
    _distanceFromReference(site) {
        const ref = this.getEffectiveLocation();
        const key = `${ref.lat},${ref.lng}`;
        if (site.distance === undefined || site._distanceFrom !== key) {
            site.distance = calculateDistance(
                ref.lat,
                ref.lng,
                parseFloat(site.latitude || site.lat),
                parseFloat(site.longitude || site.lon),
            );
            site._distanceFrom = key;
        }
        return site.distance;
    }

    _isFavorite(site) {
        const favs = this.state.userPreferences?.favoriteSites || [];
        return favs.includes(site.id);
    }

    /**
     * Sites qui correspondent à la recherche en cours mais sont hors du rayon (hors favoris) :
     * ni affichés ni interrogés, seulement comptés pour le signaler (spec 002, FR-019).
     */
    countSearchMatchesOutsideRadius() {
        if (!this.state.searchQuery || !this.state.searchQuery.trim()) return 0;
        return this.getGeoFilteredSites(this.getSites(), { applyRadius: false }).filter(
            (site) => !this._isFavorite(site) && this._distanceFromReference(site) > this.state.radiusLimit,
        ).length;
    }

    getGeoFilteredSites(sitesData, { applyRadius = true } = {}) {
        let activeSites = sitesData.filter(
            (s) =>
                s.affiche !== false &&
                !isNaN(parseFloat(s.latitude || s.lat)) &&
                !isNaN(parseFloat(s.longitude || s.lon)),
        );

        // Cette application est dédiée au parapente : les spots FFVL exclusivement
        // dédiés au kite/cerf-volant (aucun type parapente : ATTERRO/NATUREL/DUNE/
        // SOARING/GONFLAGE/TREUIL) ne sont jamais pertinents et sont toujours exclus.
        activeSites = activeSites.filter((site) => {
            const st = site.site_sous_type || site.type || [];
            const siteTypes = Array.isArray(st) ? st : [st];
            if (!siteTypes.includes('KITE')) return true;
            const PARAGLIDING_TYPES = ['ATTERRO', 'NATUREL', 'DUNE', 'SOARING', 'GONFLAGE', 'TREUIL'];
            return siteTypes.some((t) => PARAGLIDING_TYPES.includes(t));
        });

        if (this.state.searchQuery) {
            const queryCleaned = removeAccents(this.state.searchQuery.trim().toLowerCase());
            activeSites = activeSites.filter((site) => {
                const name = removeAccents(site.nom || '').toLowerCase();
                const city = removeAccents(site.ville || '').toLowerCase();
                const zip = (site.code_postal || '').toLowerCase();

                let dept = '';
                if (site.departement && typeof site.departement === 'object') {
                    const deptNom = site.departement.nom || '';
                    const deptCode = site.departement.code || '';
                    dept = removeAccents(`${deptNom} ${deptCode}`).toLowerCase();
                } else if (Array.isArray(site.departement)) {
                    dept = removeAccents(site.departement.join(' ')).toLowerCase();
                } else if (typeof site.departement === 'string') {
                    dept = removeAccents(site.departement).toLowerCase();
                }
                const region = removeAccents(site.region || '').toLowerCase();
                const obs = removeAccents(site.observations || '').toLowerCase();
                const topo = removeAccents(site.acces_topo || '').toLowerCase();
                const dangers = removeAccents(site.dangers || '').toLowerCase();
                const practice = removeAccents(site.praticabilite || '').toLowerCase();

                return (
                    name.includes(queryCleaned) ||
                    city.includes(queryCleaned) ||
                    zip.includes(queryCleaned) ||
                    dept.includes(queryCleaned) ||
                    region.includes(queryCleaned) ||
                    obs.includes(queryCleaned) ||
                    topo.includes(queryCleaned) ||
                    dangers.includes(queryCleaned) ||
                    practice.includes(queryCleaned)
                );
            });
        }

        if (this.state.filterFavoritesOnly) {
            activeSites = activeSites.filter((site) => this.state.userPreferences.favoriteSites.includes(site.id));
        }

        if (this.state.filterWindExclude && this.state.filterWindExclude.length > 0) {
            activeSites = activeSites.filter((s) => {
                let orientations = [];
                if (Array.isArray(s.orientations_vent)) orientations = s.orientations_vent;
                else if (typeof s.orientations_vent === 'string')
                    orientations = s.orientations_vent.split(',').map((v) => v.trim());
                else if (s.orientation) orientations = s.orientation.split(',').map((v) => v.trim());
                return !orientations.some((w) => this.state.filterWindExclude.includes(w));
            });
        }
        if (this.state.filterWindInclude && this.state.filterWindInclude.length > 0) {
            activeSites = activeSites.filter((s) => {
                let orientations = [];
                if (Array.isArray(s.orientations_vent)) orientations = s.orientations_vent;
                else if (typeof s.orientations_vent === 'string')
                    orientations = s.orientations_vent.split(',').map((v) => v.trim());
                else if (s.orientation) orientations = s.orientation.split(',').map((v) => v.trim());
                return orientations.some((w) => this.state.filterWindInclude.includes(w));
            });
        }

        activeSites = activeSites.filter((site) => {
            const st = site.site_sous_type || site.type || 'Inconnu';
            const siteTypes = Array.isArray(st) ? st : [st];
            const isLandingOnly = siteTypes.includes('ATTERRO') && siteTypes.every((t) => t === 'ATTERRO');
            if (isLandingOnly && !(this.state.filterTypeInclude || []).includes('ATTERRO')) {
                return false;
            }
            const hasIncludedType =
                this.state.filterTypeInclude &&
                this.state.filterTypeInclude.length > 0 &&
                siteTypes.some((t) => this.state.filterTypeInclude.includes(t));
            const hasExcludedType =
                this.state.filterTypeExclude &&
                this.state.filterTypeExclude.length > 0 &&
                siteTypes.some((t) => this.state.filterTypeExclude.includes(t));

            if (this.state.filterTypeInclude && this.state.filterTypeInclude.length > 0) {
                if (hasIncludedType) return true;
                return false;
            }
            if (hasExcludedType) return false;
            return true;
        });

        // Rayon toujours appliqué autour de la position de référence (GPS, adresse, ou
        // Boulogne-sur-Mer) : la météo n'est demandée que pour ces sites, jamais pour toute la
        // base (spec 002, FR-016). Les favoris restent visibles quelle que soit leur distance.
        if (applyRadius) {
            activeSites = activeSites.filter(
                (site) => this._isFavorite(site) || this._distanceFromReference(site) <= this.state.radiusLimit,
            );
        }

        return activeSites;
    }

    getFilteredAndSortedSites(sitesData) {
        let activeSites = this.getGeoFilteredSites(sitesData);

        if (this.state.hideUnflyable) {
            activeSites = activeSites.filter((site) => {
                const forecasts = this.state.weatherForecasts[site.id] || [];
                // Météo pas (encore) chargée pour ce site : inconnu n'est pas « non volable ».
                // Sans ça, un échec ou un chargement en cours vidait toute la liste.
                if (forecasts.length === 0) return true;
                let hours = 0;
                for (let i = 0; i < Math.min(forecasts.length, this.state.forecastMaxRange || 120); i++) {
                    if (this.isForecastFlyable(site, forecasts[i]).flyable) hours++;
                }
                return hours > 0;
            });
        }

        // Compute flyable hours and scores for ALL sites (needed for UI badges and sorting)
        const limit = this.state.forecastMaxRange || 120;
        activeSites.forEach((site) => {
            const forecasts = this.state.weatherForecasts[site.id] || [];
            let totalFlyable = 0;
            let completeHours = 0;
            let maxConsecutive = 0;
            let currentConsecutive = 0;
            let score = 0;

            site.flyableSlots = [];
            let currentSlot = null;
            const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

            for (let i = 0; i < limit; i++) {
                if (forecasts[i]) {
                    // Une heure « incomplète » n'est ni volable ni non volable : elle n'est pas
                    // comptée, mais elle interrompt un créneau (spec 001, FR-008).
                    const status = this.isForecastFlyable(site, forecasts[i]).status;
                    const isFlyable = status === 'flyable';
                    if (status !== 'incomplete') completeHours++;
                    const date = new Date(forecasts[i].time);
                    const h = date.getHours();
                    const dayLabel = days[date.getDay()];

                    if (isFlyable) {
                        totalFlyable++;
                        currentConsecutive++;
                        maxConsecutive = Math.max(maxConsecutive, currentConsecutive);

                        if (!currentSlot) {
                            currentSlot = { dayLabel, start: h, end: h };
                        } else {
                            if (currentSlot.dayLabel === dayLabel && currentSlot.end === h - 1) {
                                currentSlot.end = h;
                            } else {
                                site.flyableSlots.push(currentSlot);
                                currentSlot = { dayLabel, start: h, end: h };
                            }
                        }
                    } else {
                        currentConsecutive = 0;
                        if (currentSlot) {
                            site.flyableSlots.push(currentSlot);
                            currentSlot = null;
                        }
                    }

                    if (this.state.conditionsStrategy === 'TOTAL' && isFlyable) score++;
                    else if (this.state.conditionsStrategy === 'HALF_DAY' && isFlyable && h >= 12 && h <= 18) score++;
                    else if (
                        this.state.conditionsStrategy === 'DAILY' &&
                        isFlyable &&
                        (h === 10 || h === 14 || h === 18)
                    )
                        score++;
                } else {
                    currentConsecutive = 0;
                    if (currentSlot) {
                        site.flyableSlots.push(currentSlot);
                        currentSlot = null;
                    }
                }
            }
            if (currentSlot) site.flyableSlots.push(currentSlot);

            if (this.state.conditionsStrategy === 'CONSECUTIVE') score = maxConsecutive;

            site.flyableHours = totalFlyable;
            site.completeHours = completeHours;
            site.maxConsecutiveHours = maxConsecutive;
            site.conditionScore = score;
        });

        // Apply Sorting
        activeSites.sort((a, b) => {
            const isAFav =
                this.state.userPreferences && this.state.userPreferences.favoriteSites
                    ? this.state.userPreferences.favoriteSites.includes(a.id)
                    : false;
            const isBFav =
                this.state.userPreferences && this.state.userPreferences.favoriteSites
                    ? this.state.userPreferences.favoriteSites.includes(b.id)
                    : false;

            if (isAFav && !isBFav) return -1;
            if (!isAFav && isBFav) return 1;

            if (this.state.sortMode === 'DISTANCE' && this.state.userLocation) {
                return (a.distance || Infinity) - (b.distance || Infinity);
            } else if (this.state.sortMode === 'AZ') {
                return (a.nom || '').localeCompare(b.nom || '');
            } else {
                // Default CONDITIONS
                const sA = a.conditionScore || 0;
                const sB = b.conditionScore || 0;

                if (sB !== sA) return sB - sA;

                if (this.state.userLocation) return (a.distance || Infinity) - (b.distance || Infinity);
                return (a.nom || '').localeCompare(b.nom || '');
            }
        });

        return activeSites;
    }
    changeForecastMaxRange(value) {
        const range = parseInt(value);
        if (!isNaN(range)) {
            this.state.forecastMaxRange = range;

            const slider = /** @type {HTMLInputElement} */ (document.getElementById('forecast-slider'));
            if (slider) {
                slider.max = String(range);
                let currentOffset = this.state.forecastOffset;
                if (currentOffset > range) {
                    currentOffset = range;
                }
                this.setForecastOffset(currentOffset);
            }

            this.updateHideUnflyableDuration();
            this.savePreferences();
        }
    }

    updateWindLimits() {
        const filterModeSelect = /** @type {HTMLSelectElement} */ (document.getElementById('filter-mode-select'));
        let filterMode = filterModeSelect ? filterModeSelect.value : 'manual';
        const warningNotice = document.getElementById('hardware-warning-notice');

        if (filterMode === 'hardware') {
            const wings = JSON.parse(localStorage.getItem('tp_equipment_data')) || [];
            const hasValidData =
                wings.length > 0 &&
                wings.some((wing) => wing.type === 'voile' && wing.ventMin !== undefined && wing.ventMax !== undefined);

            if (!hasValidData) {
                if (warningNotice) {
                    warningNotice.textContent = t('sites.service.noWingWindRange');
                    warningNotice.style.display = 'block';
                }
                if (filterModeSelect) filterModeSelect.value = 'manual';
                filterMode = 'manual';
            } else {
                if (warningNotice) warningNotice.style.display = 'none';
            }
        } else {
            if (warningNotice) warningNotice.style.display = 'none';
        }

        const manualFiltersDiv = document.getElementById('manual-wind-filters');
        if (manualFiltersDiv) {
            manualFiltersDiv.style.opacity = filterMode === 'manual' ? '1' : '0.5';
            manualFiltersDiv.style.pointerEvents = filterMode === 'manual' ? 'auto' : 'none';
        }

        this.state.filterMode = filterMode;

        const minVal =
            parseFloat(/** @type {HTMLInputElement} */ (document.getElementById('limit-wind-min')).value) || 0;
        const maxVal =
            parseFloat(/** @type {HTMLInputElement} */ (document.getElementById('limit-wind-max')).value) || 25;
        const deltaVal =
            parseFloat(/** @type {HTMLInputElement} */ (document.getElementById('limit-gust-delta')).value) || 10;
        this.state.limitWindMin = minVal;
        this.state.limitWindMax = maxVal;
        this.state.limitGustDelta = deltaVal;

        this.savePreferences();
        this.renderList();
        if (sitesView()?.state?.mapExpanded) this.updateMapMarkers();
    }

    toggleHideUnflyable(checked) {
        this.state.hideUnflyable = checked;
        this.savePreferences();
        this.renderList();
        if (sitesView()?.state?.mapExpanded) this.updateMapMarkers();
    }

    setRadiusLimit(value) {
        const parsed = parseInt(value);
        if (isNaN(parsed)) return;
        // 10–200 km : « Illimité » a été retiré (spec 002, FR-015).
        const radius = Math.min(RADIUS.MAX, Math.max(RADIUS.MIN, parsed));
        this.state.radiusLimit = radius;

        const slider = /** @type {HTMLInputElement} */ (document.getElementById('radius-slider'));
        if (slider) {
            slider.value = String(radius);
        }

        const label = document.getElementById('radius-val-label');
        if (label) {
            label.textContent = radius === 210 ? t('sites.service.unlimited') : t('forecast.radiusKm', { km: radius });
        }

        this.savePreferences();
        this.renderList();
        this.scheduleWeatherRescopeIfNeeded();
        if (sitesView()?.state?.mapExpanded) {
            this.updateMapMarkers();
        }
    }

    changeSortMode(mode) {
        this.state.sortMode = mode;

        const strategyPanel = document.getElementById('conditions-strategy-panel');
        if (strategyPanel) {
            strategyPanel.style.display = mode === 'CONDITIONS' ? 'flex' : 'none';
        }

        this.savePreferences();

        if (mode === 'DISTANCE') {
            if (this.state.userLocation) {
                this.renderList();
                if (sitesView()?.state?.map) {
                    this.updateMapMarkers();
                }
            } else {
                sitesView()?.requestGpsLocation();
            }
        } else {
            this.renderList();
            if (sitesView()?.state?.map) {
                this.updateMapMarkers();
            }
        }
    }

    changeStrategy(strategy) {
        this.state.conditionsStrategy = strategy;

        const strategies = ['CONSECUTIVE', 'HALF_DAY', 'DAILY', 'TOTAL'];
        strategies.forEach((s) => {
            const btn = document.getElementById(`strat-${s}`);
            if (btn) {
                if (s === strategy) {
                    btn.classList.add('active');
                    btn.style.background = 'rgba(14,165,233,0.15)';
                    btn.style.borderColor = 'rgba(14,165,233,0.3)';
                    btn.style.color = 'var(--accent-orange)';
                } else {
                    btn.classList.remove('active');
                    btn.style.background = 'rgba(255,255,255,0.03)';
                    btn.style.borderColor = 'var(--border-color)';
                    btn.style.color = 'var(--text-secondary)';
                }
            }
        });

        this.savePreferences();
        this.renderList();
        if (sitesView()?.state?.mapExpanded) {
            this.updateMapMarkers();
        }
    }

    changeWeatherModel(model) {
        this.state.weatherModel = model;

        // Show non-destructive loading state
        const container = document.getElementById('sites-list-container');
        if (container && !document.getElementById('weather-loading-indicator')) {
            const loadingHtml = `
            <div id="weather-loading-indicator" style="display: flex; align-items: center; justify-content: center; gap: 8px; padding: 16px; margin-bottom: 16px; font-size: 1rem; color: var(--text-secondary); background: rgba(255,255,255,0.03); border-radius: 8px;">
                <i class="ri-loader-4-line" style="animation: spin 1s linear infinite; font-size: 1.2rem;"></i>
                <span>${escapeHTML(t('sites.service.modelChanging', { model: model.toUpperCase() }))}</span>
            </div>
        `;
            container.parentNode.insertBefore(document.createRange().createContextualFragment(loadingHtml), container);
        }

        this.savePreferences();
        return this.fetchWeatherForSites();
    }

    toggleFilterFavoritesOnly() {
        this.state.filterFavoritesOnly = !this.state.filterFavoritesOnly;

        const btn = document.getElementById('btn-filter-favorites');
        if (btn) {
            if (this.state.filterFavoritesOnly) {
                btn.classList.add('active');
                btn.innerHTML = `<i class="ri-star-fill" style="color: #fbbf24;"></i> ${escapeHTML(t('sites.service.favorites'))}`;
                btn.style.background = 'rgba(251, 191, 36, 0.15)';
                btn.style.borderColor = 'rgba(251, 191, 36, 0.3)';
            } else {
                btn.classList.remove('active');
                btn.innerHTML = `<i class="ri-star-line"></i> ${escapeHTML(t('sites.service.favorites'))}`;
                btn.style.background = 'rgba(255,255,255,0.03)';
                btn.style.borderColor = 'var(--border-color)';
            }
        }

        this.savePreferences();
        this.renderList();
        this.scheduleWeatherRescopeIfNeeded();
        if (sitesView()?.state?.mapExpanded) this.updateMapMarkers();
    }

    toggleFavorite(siteId) {
        if (!this.state.userPreferences)
            this.state.userPreferences = { pilotLevel: 'ALL', favoriteSites: [], minimizedSites: [] };
        const idx = this.state.userPreferences.favoriteSites.indexOf(siteId);
        if (idx > -1) {
            this.state.userPreferences.favoriteSites.splice(idx, 1);
        } else {
            this.state.userPreferences.favoriteSites.push(siteId);
        }

        this.savePreferences();
        this.renderList();
        if (sitesView()?.state?.mapExpanded) this.updateMapMarkers();
    }

    toggleMinimize(siteId) {
        if (!this.state.userPreferences)
            this.state.userPreferences = { pilotLevel: 'ALL', favoriteSites: [], minimizedSites: [] };
        if (!this.state.userPreferences.minimizedSites) this.state.userPreferences.minimizedSites = [];
        const idx = this.state.userPreferences.minimizedSites.indexOf(siteId);
        if (idx > -1) {
            this.state.userPreferences.minimizedSites.splice(idx, 1);
        } else {
            this.state.userPreferences.minimizedSites.push(siteId);
        }

        this.savePreferences();
        this.renderList();
    }

    updateSearchQuery(val) {
        this.state.searchQuery = val || '';
        this.renderList();
        this.scheduleWeatherRescopeIfNeeded();
        if (sitesView()?.state?.map) {
            this.updateMapMarkers();
        }
    }

    /** Durée du filtre « Masquer les sites sans créneau volable » : celle des prévisions affichées. */
    updateHideUnflyableDuration() {
        const durationSpan = document.getElementById('hide-unflyable-duration');
        if (!durationSpan) return;
        const range = this.state.forecastMaxRange || 120;
        durationSpan.textContent =
            range >= 120
                ? t('sites.filters.rangeDays', { days: range / 24 })
                : t('sites.filters.rangeHours', { hours: range });
    }

    setForecastOffset(value) {
        const offset = parseInt(value);
        if (isNaN(offset)) return;
        this.state.forecastOffset = offset;

        // Synchronize HTML range slider position in the DOM
        const slider = /** @type {HTMLInputElement} */ (document.getElementById('forecast-slider'));
        if (slider) {
            slider.value = String(offset);
            const maxVal = parseInt(slider.max) || 120;
            const percentage = maxVal > 0 ? (offset / maxVal) * 100 : 0;
            slider.style.background = `linear-gradient(to right, var(--accent-orange) 0%, var(--accent-orange) ${percentage}%, rgba(255,255,255,0.1) ${percentage}%, rgba(255,255,255,0.1) 100%)`;
        }

        const view = sitesView();
        if (view) {
            view.updateForecastLabel();
            view.renderList();
            if (view.state && view.state.map) {
                view.updateMapMarkers();
            }
        }
    }

    cycleFilterState(category, value) {
        if (category === 'wind') {
            const isInclude = this.state.filterWindInclude.includes(value);
            const isExclude = this.state.filterWindExclude.includes(value);

            if (!isInclude && !isExclude) {
                // State 0 (Neutral) -> State 1 (Include)
                this.state.filterWindInclude.push(value);
            } else if (isInclude) {
                // State 1 (Include) -> State 2 (Exclude)
                this.state.filterWindInclude = this.state.filterWindInclude.filter((w) => w !== value);
                this.state.filterWindExclude.push(value);
            } else {
                // State 2 (Exclude) -> State 0 (Neutral)
                this.state.filterWindExclude = this.state.filterWindExclude.filter((w) => w !== value);
            }
            this.state.filterWind = this.state.filterWindInclude;
        } else if (category === 'type') {
            const isInclude = this.state.filterTypeInclude.includes(value);

            if (!isInclude) {
                this.state.filterTypeInclude.push(value);
                this.state.filterTypeExclude = this.state.filterTypeExclude.filter((t) => t !== value); // Just in case
            } else {
                this.state.filterTypeInclude = this.state.filterTypeInclude.filter((t) => t !== value);
            }
            this.state.filterType = this.state.filterTypeInclude;
        }

        this.updateBadges();
        this.renderDropdowns();
        this.savePreferences();
        this.renderList();
        this.scheduleWeatherRescopeIfNeeded();
        if (sitesView()?.state?.map) {
            this.updateMapMarkers();
        }
    }

    toggleMapLayer(layerId) {
        const idx = this.state.activeMapLayers.indexOf(layerId);
        if (idx >= 0) {
            this.state.activeMapLayers.splice(idx, 1);
        } else {
            this.state.activeMapLayers.push(layerId);
        }

        // Fallback: If no maps are active, activate leaflet by default
        if (this.state.activeMapLayers.length === 0) {
            this.state.activeMapLayers.push('leaflet');
        }

        // Save to preferences and cloud
        this.savePreferences();

        // Update map buttons visibility
        this.updateMapTogglesVisibility();

        // Re-render the dropdown menu
        this.renderDropdowns();
    }

    geocodeAddress(query) {
        if (!query || query.trim() === '') {
            alert(t('sites.service.addressRequired'));
            return;
        }

        const statusEl = document.getElementById('address-status-message');
        const gpsBtn = document.getElementById('btn-use-gps');
        const btnSave = document.getElementById('btn-save-location');

        if (statusEl) {
            statusEl.innerHTML = `<i class="ri-loader-4-line" style="animation: spin 1s linear infinite;"></i> ${escapeHTML(t('sites.service.addressSearching'))}`;
            statusEl.style.color = 'var(--text-muted)';
        }

        // Fetch up to 15 candidates with address details to check country codes
        fetch(
            `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(query)}&limit=15`,
        )
            .then((res) => res.json())
            .then((data) => {
                if (data && data.length > 0) {
                    // Rank logic:
                    // 1 = France (fr)
                    // 2 = Bordering countries (be, lu, de, ch, it, es, ad, mc)
                    // 3 = Other countries
                    const getCountryRank = (item) => {
                        let cc =
                            item.address && item.address.country_code ? item.address.country_code.toLowerCase() : '';
                        if (!cc && item.display_name) {
                            const nameLower = item.display_name.toLowerCase();
                            if (nameLower.includes('france')) {
                                cc = 'fr';
                            } else if (
                                nameLower.includes('belgique') ||
                                nameLower.includes('belgium') ||
                                nameLower.includes('belgië')
                            ) {
                                cc = 'be';
                            } else if (nameLower.includes('luxembourg')) {
                                cc = 'lu';
                            } else if (
                                nameLower.includes('deutschland') ||
                                nameLower.includes('germany') ||
                                nameLower.includes('allemagne')
                            ) {
                                cc = 'de';
                            } else if (
                                nameLower.includes('schweiz') ||
                                nameLower.includes('switzerland') ||
                                nameLower.includes('suisse')
                            ) {
                                cc = 'ch';
                            } else if (
                                nameLower.includes('italia') ||
                                nameLower.includes('italy') ||
                                nameLower.includes('italie')
                            ) {
                                cc = 'it';
                            } else if (
                                nameLower.includes('españa') ||
                                nameLower.includes('spain') ||
                                nameLower.includes('espagne')
                            ) {
                                cc = 'es';
                            } else if (nameLower.includes('andorra') || nameLower.includes('andorre')) {
                                cc = 'ad';
                            } else if (nameLower.includes('monaco')) {
                                cc = 'mc';
                            }
                        }
                        if (cc === 'fr') return 1;
                        if (['be', 'lu', 'de', 'ch', 'it', 'es', 'ad', 'mc'].includes(cc)) return 2;
                        return 3;
                    };

                    // Stable sort prioritizing French and bordering countries' locations (ES2023 toSorted)
                    const result = toSorted(data, (a, b) => getCountryRank(a) - getCountryRank(b))[0];
                    const lat = parseFloat(result.lat);
                    const lng = parseFloat(result.lon);

                    // Clear cached distances on sites data to force recalculation with new reference coordinates
                    this.getSites().forEach((s) => {
                        delete s.distance;
                    });

                    this.state.userLocation = { lat, lng };

                    if (statusEl) {
                        statusEl.innerHTML = `<i class="ri-checkbox-circle-line" style="color: var(--accent-green);"></i> ${escapeHTML(t('sites.service.addressFound', { name: result.display_name }))}`;
                        statusEl.style.color = 'var(--accent-green)';
                    }
                    if (btnSave) btnSave.style.display = 'inline-block';
                    if (gpsBtn) {
                        gpsBtn.style.borderColor = '';
                        gpsBtn.style.color = '';
                    }

                    this.renderList();
                    this.scheduleWeatherRescopeIfNeeded();
                    const map = sitesView()?.state?.map;
                    if (map) {
                        this.updateMapMarkers();
                        map.setView([lat, lng], 10);
                    }
                } else {
                    if (statusEl) {
                        statusEl.innerHTML = `<i class="ri-error-warning-line" style="color: var(--accent-red);"></i> ${escapeHTML(t('sites.service.addressNotFound'))}`;
                        statusEl.style.color = 'var(--accent-red)';
                    }
                }
            })
            .catch((err) => {
                console.error('Geocoding error:', err);
                if (statusEl) {
                    statusEl.innerHTML = `<i class="ri-error-warning-line" style="color: var(--accent-red);"></i> ${escapeHTML(t('sites.service.addressServiceError'))}`;
                    statusEl.style.color = 'var(--accent-red)';
                }
            });
    }

    saveCurrentLocation() {
        if (!this.state.userLocation) return;
        const inputEl = /** @type {HTMLInputElement} */ (document.getElementById('address-input'));
        const name =
            inputEl.value ||
            (inputEl.placeholder !== t('html.sitesScreen.placeholderAdresseOuVille')
                ? inputEl.placeholder
                : t('sites.service.newPlace'));
        const newLoc = {
            name: name,
            lat: this.state.userLocation.lat,
            lng: this.state.userLocation.lng,
        };

        // Check if it already exists by name or coordinates
        const exists = this.state.userPreferences.savedLocations.some(
            (l) => l.name === name || (Math.abs(l.lat - newLoc.lat) < 0.001 && Math.abs(l.lng - newLoc.lng) < 0.001),
        );

        if (!exists) {
            this.state.userPreferences.savedLocations.push(newLoc);
            this.savePreferences();
            // UI logic moved to sites.js
        }
    }

    loadSavedLocation(index) {
        const loc = this.state.userPreferences.savedLocations[index];
        if (loc) {
            this.state.userLocation = { lat: loc.lat, lng: loc.lng, name: loc.name };
            /** @type {HTMLInputElement} */ (document.getElementById('address-input')).value = loc.name;
            /** @type {HTMLInputElement} */ (document.getElementById('address-input')).placeholder = t(
                'html.sitesScreen.placeholderAdresseOuVille',
            );
            document.getElementById('address-status-message').innerHTML =
                '<i class="ri-check-line"></i> Lieu favori chargé';
            const btnSave = document.getElementById('btn-save-location');
            if (btnSave) btnSave.style.display = 'inline-block';

            this.renderList();
            this.scheduleWeatherRescopeIfNeeded();
            if (sitesView()?.state?.mapExpanded) this.updateMapMarkers();
        }
    }

    removeSavedLocation(index) {
        this.state.userPreferences.savedLocations.splice(index, 1);
        this.savePreferences();
    }

    // Forward UI updates to SitesView if it exists (legacy code adaptation)
    renderList() {
        sitesView()?.renderList();
    }
    updateMapMarkers() {
        sitesView()?.updateMapMarkers();
    }
    updateMapTogglesVisibility() {
        sitesView()?.updateMapTogglesVisibility();
    }
    updateForecastLabel() {
        sitesView()?.updateForecastLabel();
    }
    updateBadges() {
        sitesView()?.updateBadges();
    }
    renderDropdowns() {
        sitesView()?.renderDropdowns();
    }
}
export default new SitesService();
