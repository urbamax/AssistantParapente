/**
 * Aides pures de la Cloud Function de notifications (spec 001, US4). Aucune I/O ici : la
 * récupération Firestore / Open-Meteo et l'envoi FCM restent dans index.js, ce qui permet de
 * tester ces règles (tests/functions/notifications.test.js).
 *
 * Le calcul lui-même vient de shared/weatherScoring.mjs, copie générée de js/weatherScoring.js :
 * l'application et les notifications jugent donc un site exactement de la même façon.
 */
import { normalizeForecastValue } from './shared/weatherScoring.mjs';
import { degreesToCardinal } from './shared/geo_utils.mjs';
import { t } from './shared/i18n.mjs';

/** Même marge que l'application (sites_service.js) : vol autorisé de lever−30 min à coucher−30 min. */
const LEGAL_MARGIN_S = 30 * 60;

/**
 * Le pilote a-t-il le rôle « beta » (météo calculée), ou « owner », qui les a tous ? `profile` est le contenu du document
 * users/{uid}/access/profile, absent (undefined) pour un compte sans rôle. Même rôle que
 * js/services/access_service.js : sans lui, ni notification ni calcul pour ce pilote.
 * @param {{ roles?: unknown } | undefined} profile
 */
export function hasBetaRole(profile) {
    return Array.isArray(profile?.roles) && (profile.roles.includes('beta') || profile.roles.includes('owner'));
}

/**
 * URL Open-Meteo d'un site. `timeformat=unixtime` : heures, lever et coucher du soleil en
 * secondes UTC, comparables directement à l'heure du serveur (sans ambiguïté de fuseau).
 */
export function forecastUrl(lat, lon) {
    return (
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        '&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,cape' +
        '&daily=sunrise,sunset&timezone=Europe%2FParis&timeformat=unixtime&forecast_days=1'
    );
}

/**
 * Prévision de l'heure la plus proche de `nowMs`, au format attendu par evaluateSpotForecast.
 * Une valeur absente reste null (jamais 0) ; sans lever/coucher du soleil, isDaytime est null.
 * @param {any} data - réponse Open-Meteo (un site, timeformat=unixtime)
 * @param {number} nowMs
 */
export function buildHourlyForecast(data, nowMs) {
    const hourly = data?.hourly;
    if (!hourly || !Array.isArray(hourly.time) || hourly.time.length === 0) return null;

    const nowS = nowMs / 1000;
    let idx = 0;
    let minDiff = Infinity;
    hourly.time.forEach((t, i) => {
        const diff = Math.abs(t - nowS);
        if (diff < minDiff) {
            minDiff = diff;
            idx = i;
        }
    });

    const sunrise = data.daily?.sunrise?.[0];
    const sunset = data.daily?.sunset?.[0];
    const isDaytime =
        Number.isFinite(sunrise) && Number.isFinite(sunset)
            ? nowS >= sunrise - LEGAL_MARGIN_S && nowS <= sunset - LEGAL_MARGIN_S
            : null;

    const windDirDeg = normalizeForecastValue(hourly.wind_direction_10m?.[idx], 'windDir');
    return {
        windSpeed: normalizeForecastValue(hourly.wind_speed_10m?.[idx], 'windSpeed'),
        windGust: normalizeForecastValue(hourly.wind_gusts_10m?.[idx], 'windGust'),
        windDirDeg,
        windCard: windDirDeg === null ? null : degreesToCardinal(windDirDeg),
        precipitation: normalizeForecastValue(hourly.precipitation?.[idx], 'precipitation'),
        cape: normalizeForecastValue(hourly.cape?.[idx], 'cape'),
        isDaytime,
        timeMs: Number(hourly.time[idx]) * 1000,
    };
}

/** Préférences stockées (Firestore) → préférences du calcul. Le mode « matériel » n'existe pas côté serveur. */
export function toScoringPrefs(prefs) {
    return {
        vMin: prefs.limitWindMin,
        vMax: prefs.limitWindMax,
        deltaRafaleMax: prefs.limitGustDelta,
        filterMode: 'manual',
    };
}

/**
 * Notifier « devenu volable » uniquement sur la transition non volable → volable, avec des
 * données complètes et une orientation connue (spec 001, FR-011).
 * @param {boolean|'unknown'|undefined} previous - dernier état connu enregistré
 */
export function shouldNotify(previous, outcome) {
    return outcome?.status === 'flyable' && !outcome.orientationUnknown && previous === false;
}

/**
 * État à enregistrer après une évaluation. Une heure incomplète ne compte ni comme volable ni
 * comme non volable : on garde le dernier état connu ('unknown' s'il n'y en a pas). Un site
 * d'orientation inconnue n'est jamais « volable » pour les notifications.
 * @returns {boolean|'unknown'}
 */
export function nextState(previous, outcome) {
    if (!outcome || outcome.status === 'incomplete' || outcome.status === 'loading') {
        return previous === true || previous === false ? previous : 'unknown';
    }
    if (outcome.status === 'flyable') return outcome.orientationUnknown ? 'unknown' : true;
    return false;
}

/** Source des prévisions du serveur : point d'accès « beta » d'Open-Meteo (sélection automatique). */
const NOTIFICATION_SOURCE_KEY = 'forecast.models.best_match';

const PARIS_HOUR = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', hourCycle: 'h23' });

/**
 * Texte de la notification « conditions favorables » (spec 005, audit A3) : jamais « volable »,
 * avec l'heure de prévision (heure de Paris), le vent, la source et le rappel que la décision
 * revient au pilote, à vérifier sur place (constitution, principe II).
 * @param {{nom?: string, name?: string}} site
 * @param {{windSpeed: number|null, windGust: number|null, windCard: string|null}} weather
 * @param {number} forecastTimeMs
 * @returns {{title: string, body: string}}
 */
export function buildNotification(site, weather, forecastTimeMs) {
    const value = (v) => (v === null || v === undefined ? '—' : String(v));
    const name = (site && (site.nom || site.name)) || t('notification.defaultSite');
    // Heure seule, en chiffres (« 14 ») : le texte ajoute lui-même « à … h ».
    const hourNumber = PARIS_HOUR.formatToParts(new Date(forecastTimeMs)).find((p) => p.type === 'hour').value;
    const hour = t('notification.hour', { hour: hourNumber });
    return {
        title: t('notification.title', { site: name }),
        body: t('notification.body', {
            hour,
            card: value(weather && weather.windCard),
            speed: value(weather && weather.windSpeed),
            gust: value(weather && weather.windGust),
            source: t(NOTIFICATION_SOURCE_KEY),
            reminder: t('notification.reminder'),
        }),
    };
}

/**
 * Mémorise la prévision de chaque site pour la durée d'une exécution de la fonction planifiée.
 *
 * Sans cela, un site présent dans les favoris de N pilotes était demandé N fois à Open-Meteo à
 * chaque passage (toutes les 30 minutes) : risque de dépasser le quota gratuit et de saturer la
 * fonction. Avec ce cache, chaque site n'est demandé qu'une fois, quel que soit le nombre de
 * pilotes. La promesse est mémorisée (pas seulement le résultat) : deux pilotes qui demandent le
 * même site en même temps partagent la même requête, et une erreur réseau est partagée au lieu
 * d'être retentée pour chaque pilote. Le cache ne doit pas survivre à l'exécution : la météo
 * serait périmée au passage suivant.
 * @param {(site: object) => Promise<any>} fetchWeather
 * @returns {{get: (siteId: string, site: object) => Promise<any>, readonly requests: number}}
 */
export function createSiteWeatherCache(fetchWeather) {
    const byId = new Map();
    return {
        get(siteId, site) {
            if (!byId.has(siteId)) byId.set(siteId, fetchWeather(site));
            return byId.get(siteId);
        },
        get requests() {
            return byId.size;
        },
    };
}
