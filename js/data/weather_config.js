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
