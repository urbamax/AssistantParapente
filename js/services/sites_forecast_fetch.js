/**
 * SERVICE - SitesService, récupération des prévisions (Open-Meteo)
 * Ces fonctions sont les méthodes réseau du service des sites (`this` = SitesService). Elles sont
 * téléchargées au premier besoin (sites_service.js, `forecastFetch`) : au démarrage, seul le reste
 * du service est chargé.
 */
import { WEATHER_MODEL_INFO } from '../data/weather_config.js';
import { degreesToCardinal } from '../utils/geo_utils.js';
import { normalizeForecastValue } from '../weatherScoring.js';
import IDBStorage from './idb_storage.js';
import { t } from '../utils/i18n.js';

/**
 * Charge le second modèle pour les mêmes sites que le modèle principal (sites du rayon +
 * favoris) et les mêmes heures, pour comparer l'heure affichée (spec 002, US3, FR-009/010).
 * Mêmes lots de 400 sites, même cache de 10 min et même pause après un refus d'Open-Meteo
 * que le modèle principal (FR-010a) : pendant cette pause, rien n'est demandé et la
 * comparaison est simplement indisponible.
 * `weatherForecastsSecondary[id]` est un tableau aligné sur `weatherForecasts[id]` (même
 * index = même heure, appariées par leur date-heure).
 */
export async function fetchSecondaryModel() {
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
            if (cached && Date.now() - cached.timestamp < this.constructor.WEATHER_CACHE_TTL_MS) {
                results = cached.results;
            } else {
                const response = await this._fetchWithBackoff(url);
                if (response.status === 429) {
                    this._weatherCooldownUntil = Date.now() + this.constructor.WEATHER_COOLDOWN_MS;
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

// Un seul essai supplémentaire à +2s ne laisse pas le temps au quota par minute de
// se reconstituer : Open-Meteo a déjà re-rejeté ce deuxième essai en pratique (cf. #22
// pour le même correctif côté carnet de vol). 3 tentatives avec un backoff croissant
// (immédiat, +3s, +12s) restent sous un délai total raisonnable pour un lot, tout en
// laissant une vraie chance au quota de se libérer.
export async function _fetchWithBackoff(url, signal) {
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

/**
 * Enregistre sur l'appareil la prévision de chaque site (modèle, heure de récupération, heures)
 * après un chargement réussi (FR-001). Un échec du stockage est sans conséquence (FR-007).
 */
export async function saveForecastSnapshot() {
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
export async function restoreForecastSnapshot(now = Date.now()) {
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

/**
 * @param {{force?: boolean}} [options] force : ignorer le cache (bouton « Actualiser »).
 */
export async function fetchWeatherForSites({ force = false } = {}) {
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
    const WEATHER_CACHE_TTL_MS = this.constructor.WEATHER_CACHE_TTL_MS;
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
                this._weatherCooldownUntil = Date.now() + this.constructor.WEATHER_COOLDOWN_MS;
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
                    const precipKey = Object.keys(hourly).find((k) => k.startsWith('precipitation')) || 'precipitation';
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

/**
 * Heure de calcul (run) du modèle, lue dans les métadonnées Open-Meteo
 * (`/data/{metaModel}/static/meta.json`), gardée 30 min. null si le modèle n'a pas d'heure de
 * calcul unique (sélection automatique) ou si la demande échoue : rien n'est alors affiché
 * plutôt qu'une heure inventée (spec 002, FR-003).
 * @param {string} modelKey
 * @returns {Promise<number|null>}
 */
export async function fetchModelRunTime(modelKey) {
    const info = WEATHER_MODEL_INFO[modelKey];
    if (!info || !info.metaModel) return null;
    if (!this._runTimeCache) this._runTimeCache = new Map();
    const cached = this._runTimeCache.get(modelKey);
    if (cached && Date.now() - cached.at < this.constructor.RUN_TIME_CACHE_MS) return cached.value;
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
