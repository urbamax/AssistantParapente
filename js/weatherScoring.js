/**
 * weatherScoring.js
 * 
 * Module de scoring météo pour les spots de parapente.
 * Combine la validation de sécurité (Kill Switches) et un calcul de score 
 * continu de 0 à 100 pour classer les meilleurs spots.
 */

// Configuration des pondérations pour le score final (ajustable)
const SCORING_WEIGHTS = {
    WIND_SPEED: 0.5,     // 50% du score basé sur la vitesse du vent
    WIND_DIRECTION: 0.5  // 50% du score basé sur l'alignement du vent avec la pente
};

/**
 * Calcule la différence angulaire absolue la plus courte entre deux caps (en degrés).
 * @param {number} angle1 - Premier angle (0-360)
 * @param {number} angle2 - Deuxième angle (0-360)
 * @returns {number} La différence angulaire entre 0 et 180 degrés.
 */
function getAngularDifference(angle1, angle2) {
    let diff = Math.abs(angle1 - angle2) % 360;
    return diff > 180 ? 360 - diff : diff;
}

/**
 * Évalue la météo d'un spot et calcule son score global.
 * 
 * @param {Object} site - Caractéristiques géographiques du spot.
 * @param {number} site.orientation - Orientation de la pente en degrés (0-360).
 * 
 * @param {Object} weather - Prévisions météo actuelles fournies par l'API.
 * @param {boolean} weather.isDaytime - Indique s'il fait jour.
 * @param {number} weather.windSpeed - Vitesse du vent moyen.
 * @param {number} weather.windGust - Vitesse des rafales.
 * @param {number} weather.windDir - Direction d'où vient le vent en degrés (0-360).
 * @param {number} weather.precipitation - Quantité de précipitations (mm).
 * @param {number} [weather.cape] - (Optionnel) CAPE / Index de stabilité (J/kg).
 * 
 * @param {Object} userPreferences - Filtres dynamiques issus des champs de l'interface.
 * @param {number} userPreferences.vMin - Vitesse de vent minimale requise.
 * @param {number} userPreferences.vMax - Vitesse de vent maximale autorisée.
 * @param {number} userPreferences.deltaRafaleMax - Écart maximal toléré (rafale - vent moyen).
 * 
 * @returns {Object} Résultat complet du diagnostic pour l'affichage et le tri.
 */
function evaluateSpotForecast(site, weather, userPreferences) {
    // ---------------------------------------------------------
    // 1. CAS DE CHARGEMENT OU DONNÉES INCOMPLÈTES
    // ---------------------------------------------------------
    if (!weather) {
        return { score: 0, flyable: false, reason: 'Chargement...', class: 'weather-unknown', icon: 'ri-loader-4-line' };
    }

    // ---------------------------------------------------------
    // 2. VERROUS DE SÉCURITÉ ABSOLUS (Kill Switches)
    // ---------------------------------------------------------

    // A. Gestion de la nuit
    if (!weather.isDaytime) {
        return { score: 0, flyable: false, reason: 'Nuit', class: 'weather-unflyable', icon: 'ri-moon-clear-line' };
    }

    // B. Précipitations (Pluie)
    const precip = weather.precipitation ?? 0;
    if (precip > 0) {
        return { score: 0, flyable: false, reason: `Pluie (${precip.toFixed(1)} mm)`, class: 'weather-unflyable', icon: 'ri-showers-fill' };
    }

    // C. Limites de vitesse du vent moyen (vMin / vMax de l'utilisateur)
    if (weather.windSpeed < userPreferences.vMin || weather.windSpeed > userPreferences.vMax) {
        return { score: 0, flyable: false, reason: 'Vent hors limites', class: 'weather-unflyable', icon: 'ri-close-circle-fill' };
    }

    // D. Limite de la turbulence (delta rafale de l'utilisateur)
    const rafalesEffectives = Math.max(weather.windGust || 0, weather.windSpeed);
    const deltaRafale = rafalesEffectives - weather.windSpeed;
    if (deltaRafale > userPreferences.deltaRafaleMax) {
        return { score: 0, flyable: false, reason: 'Rafales hors limites', class: 'weather-unflyable', icon: 'ri-close-circle-fill' };
    }

    // E. Risque orageux (CAPE)
    if (weather.cape !== undefined && weather.cape > 1000) {
        return { score: 0, flyable: false, reason: 'Risque orageux (CAPE)', class: 'weather-unflyable', icon: 'ri-thunderstorms-line' };
    }

    // F. Orientation du vent (Déphasage angulaire > 45°)
    // Si le site n'a pas d'orientation définie (ex: site 360°), on ignore ce filtre
    const hasOrientation = site.orientation !== undefined && site.orientation !== null;
    let angularDiff = 0;
    
    if (hasOrientation) {
        angularDiff = getAngularDifference(weather.windDir, site.orientation);
        if (angularDiff > 45) {
            return { score: 0, flyable: false, reason: 'Mauvaise orientation', class: 'weather-unflyable', icon: 'ri-close-circle-fill' };
        }
    }

    // ---------------------------------------------------------
    // 3. CALCUL DU SCORE ÉVOLUTIF (Si tous les verrous sont au vert)
    // ---------------------------------------------------------

    // A. Note de Vitesse du Vent (0 à 100)
    const vIdeal = (userPreferences.vMin + userPreferences.vMax) / 2;
    const demiPlage = (userPreferences.vMax - userPreferences.vMin) / 2;
    
    let scoreVentMoyen = 100;
    if (demiPlage > 0) {
        const ecartVent = Math.abs(weather.windSpeed - vIdeal);
        scoreVentMoyen = Math.max(0, 100 * (1 - (ecartVent / demiPlage)));
    } else {
        scoreVentMoyen = weather.windSpeed === vIdeal ? 100 : 0;
    }

    // B. Note d'Orientation (0 à 100)
    // Si pas d'orientation spécifiée, on accorde 100 points par défaut
    const scoreOrientation = hasOrientation ? Math.max(0, 100 * (1 - (angularDiff / 45))) : 100;

    // C. Calcul du score final pondéré
    const finalScore = Math.round(
        (scoreVentMoyen * SCORING_WEIGHTS.WIND_SPEED) + 
        (scoreOrientation * SCORING_WEIGHTS.WIND_DIRECTION)
    );

    // ---------------------------------------------------------
    // 4. RETOUR DU DIAGNOSTIC COMPLET
    // ---------------------------------------------------------
    // On peut définir un seuil (ex: score >= 70) pour dire si le spot est "Idéal" ou simplement "Volable"
    let reasonText = `Excellent (${finalScore}/100)`;
    if (finalScore < 50) reasonText = `Passable (${finalScore}/100)`;
    else if (finalScore < 80) reasonText = `Bon (${finalScore}/100)`;

    return {
        score: finalScore,
        flyable: true,
        reason: reasonText,
        class: 'weather-flyable',
        icon: 'ri-checkbox-circle-fill'
    };
}
