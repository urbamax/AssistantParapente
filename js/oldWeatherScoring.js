/**
 * oldWeatherScoring.js
 * 
 * Sauvegarde de l'ancien algorithme utilisé pour déterminer si un spot est volable.
 * Cet algorithme était basé sur des vérifications booléennes (isForecastFlyable).
 */

const OldWeatherScoring = {
    // Les limites étaient stockées dans le state du moteur
    state: {
        limitWindMin: 0,
        limitWindMax: 25,
        limitGustDelta: 10
    },

    /**
     * Convertit un cap en degrés vers une direction cardinale
     */
    degreesToCardinal: function (deg) {
        const val = Math.floor((deg / 45) + 0.5);
        const arr = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
        return arr[(val % 8)];
    },

    /**
     * Détermine si les conditions météo permettent de voler sur un site donné.
     * @param {Object} site - L'objet du site (inclut orientations_vent)
     * @param {Object} weather - L'objet météo pour l'heure donnée
     * @returns {Object} { flyable: boolean, reason: string, class: string, icon: string }
     */
    isForecastFlyable: function (site, weather) {
        if (!weather) return { flyable: false, reason: 'Chargement...', class: 'weather-unknown', icon: 'ri-loader-4-line' };
        if (!weather.isDaytime) return { flyable: false, reason: 'Nuit', class: 'weather-unflyable', icon: 'ri-moon-clear-line' };

        const precip = weather.precipitation ?? 0;
        if (precip > 0) return { flyable: false, reason: `Pluie (${precip.toFixed(1)} mm)`, class: 'weather-unflyable', icon: 'ri-showers-fill' };

        const hasOrientations = site.orientations_vent && site.orientations_vent.length > 0;
        const isOriented = hasOrientations ? site.orientations_vent.includes(weather.windCard) : true;
        if (hasOrientations && !isOriented) return { flyable: false, reason: 'Mauvaise orientation', class: 'weather-unflyable', icon: 'ri-close-circle-fill' };

        const windSpeedOk = weather.windSpeed >= this.state.limitWindMin && weather.windSpeed <= this.state.limitWindMax;
        if (!windSpeedOk) return { flyable: false, reason: 'Vent hors limites', class: 'weather-unflyable', icon: 'ri-close-circle-fill' };

        const gustDeltaOk = (weather.windGust - weather.windSpeed) <= this.state.limitGustDelta;
        if (!gustDeltaOk) return { flyable: false, reason: 'Rafales hors limites', class: 'weather-unflyable', icon: 'ri-close-circle-fill' };

        if (!hasOrientations) return { flyable: true, reason: 'Favorable', class: 'weather-flyable', icon: 'ri-checkbox-circle-fill' };

        return { flyable: true, reason: 'Favorable', class: 'weather-flyable', icon: 'ri-checkbox-circle-fill' };
    }
};

export default OldWeatherScoring;
