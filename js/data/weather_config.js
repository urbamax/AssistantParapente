// js/data/weather_config.js

export const WEATHER_MODELS = {
    AROME: 'meteofrance',
    ICON: 'icon',
    GFS: 'gfs',
    ECMWF: 'ecmwf',
};

export const WIND_DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];

export const EXTENDED_WIND_DIRECTIONS = [
    'N',
    'NNE',
    'NE',
    'ENE',
    'E',
    'ESE',
    'SE',
    'SSE',
    'S',
    'SSW',
    'SW',
    'WSW',
    'W',
    'WNW',
    'NW',
    'NNW',
];

export const WIND_THRESHOLDS = {
    DEFAULT_MIN: 0,
    DEFAULT_MAX: 25,
    GUST_DELTA: 10,
};

export const WEATHER_EMOJIS = {
    SUN: '☀️',
    PARTLY_CLOUDY: '🌤️',
    CLOUDY: '☁️',
    FOG: '🌫️',
    RAIN: '🌧️',
    SNOW: '❄️',
    SHOWERS: '🌦️',
    STORM: '⛈️',
};

// ---------------------------------------------------------------------------------------------
// Spec 002 : contexte des prévisions et limitation des requêtes Open-Meteo.
// ---------------------------------------------------------------------------------------------

/** Position de référence sans GPS ni adresse : Boulogne-sur-Mer, origine de l'application. */
export const DEFAULT_LOCATION = Object.freeze({ lat: 50.7264, lng: 1.6147, name: 'Boulogne-sur-Mer', isDefault: true });

/**
 * Rayon de recherche (km). « Illimité » a été retiré : il demandait la météo de ~2 000 sites
 * d'un coup et épuisait à lui seul le quota horaire d'Open-Meteo. LEGACY_UNLIMITED est
 * l'ancienne valeur « Illimité », convertie au chargement des préférences.
 */
export const RADIUS = Object.freeze({ MIN: 10, MAX: 200, DEFAULT: 50, STEP: 10, LEGACY_UNLIMITED: 210 });

/** Au-delà, une prévision est signalée comme ancienne (≈ rythme de calcul d'AROME). */
export const STALE_AFTER_MS = 3 * 60 * 60 * 1000;

/**
 * Modèles proposés : libellé (clé du catalogue js/i18n/fr.js) et modèle Open-Meteo dont on lit
 * l'heure de calcul (`/data/{metaModel}/static/meta.json`). Pour les points d'accès « seamless »,
 * c'est le composant haute résolution ; metaModel null = pas d'heure de calcul unique.
 */
export const WEATHER_MODEL_INFO = Object.freeze({
    meteofrance: Object.freeze({
        labelKey: 'forecast.models.meteofrance',
        metaModel: 'meteofrance_arome_france_hd',
        runLabel: 'AROME',
    }),
    iconeu: Object.freeze({ labelKey: 'forecast.models.iconeu', metaModel: 'dwd_icon_eu', runLabel: 'ICON-EU' }),
    icon: Object.freeze({ labelKey: 'forecast.models.icon', metaModel: 'dwd_icon', runLabel: 'ICON' }),
    ecmwf: Object.freeze({ labelKey: 'forecast.models.ecmwf', metaModel: 'ecmwf_ifs025', runLabel: 'ECMWF' }),
    gfs: Object.freeze({ labelKey: 'forecast.models.gfs', metaModel: 'ncep_gfs025', runLabel: 'GFS' }),
    best_match: Object.freeze({ labelKey: 'forecast.models.best_match', metaModel: null, runLabel: null }),
});
