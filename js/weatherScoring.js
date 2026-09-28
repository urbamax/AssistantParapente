/**
 * weatherScoring.js
 *
 * Module de scoring météo pour les spots de parapente.
 * Combine la validation de sécurité (Kill Switches) et un calcul de score
 * continu de 0 à 100 pour classer les meilleurs spots.
 */

import { getAngularDifference } from './utils/geo_utils.js';

// Configuration des pondérations pour le score final (ajustable)
const SCORING_WEIGHTS = {
    WIND_SPEED: 0.5, // 50% du score basé sur la vitesse du vent
    WIND_DIRECTION: 0.5, // 50% du score basé sur l'orientation
};

/**
 * Convertit un cap en degrés (0-360) en direction cardinale.
 * @param {number} deg - Cap en degrés
 * @returns {string} Direction cardinale ("N", "NE", "E", "SE", "S", "SO", "O", "NO")
 */
function degreesToCardinal(deg) {
    if (typeof deg !== 'number' || isNaN(deg)) return '';

    // Normaliser les degrés entre 0 et 360
    const normalizedDeg = ((deg % 360) + 360) % 360;

    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
    const index = Math.round(normalizedDeg / 45) % 8;
    return directions[index];
}
/**
 * Évalue la météo d'un spot et calcule son score global.
 *
 * @param {Object} site - Caractéristiques géographiques du spot.
 * @param {string} site.orientation - Orientations acceptées séparées par des virgules (ex: "S,SO").
 * @param {string|string[]} [site.orientations_vent] - Orientations acceptées (liste, ou chaîne séparée par des virgules).
 * @param {number} [site.orientation_ideale_deg] - Orientation idéale du site en degrés (le cas échéant).
 *
 * @param {Object} weather - Prévisions météo actuelles fournies par l'API.
 * @param {boolean} weather.isDaytime - Indique s'il fait jour.
 * @param {number} weather.windSpeed - Vitesse du vent moyen.
 * @param {number} weather.windGust - Vitesse des rafales.
 * @param {number|string} weather.windDir - Direction d'où vient le vent (degrés ou cardinal).
 * @param {number} [weather.windDirDeg] - Direction d'où vient le vent en degrés (degrés).
 * @param {string} [weather.windCard] - Direction cardinale du vent.
 * @param {number} weather.precipitation - Quantité de précipitations (mm).
 * @param {number} [weather.cape] - (Optionnel) CAPE / Index de stabilité (J/kg).
 *
 * @param {Object} userPreferences - Filtres dynamiques issus des champs de l'interface.
 * @param {number} userPreferences.vMin - Vitesse de vent minimale requise.
 * @param {number} userPreferences.vMax - Vitesse de vent maximale autorisée.
 * @param {number} userPreferences.deltaRafaleMax - Écart maximal toléré (rafale - vent moyen).
 * @param {string} [userPreferences.filterMode] - 'hardware' pour filtrer selon les voiles de l'inventaire.
 *
 * @returns {Object} Résultat complet du diagnostic pour l'affichage et le tri.
 */
export function evaluateSpotForecast(site, weather, userPreferences) {
    // ---------------------------------------------------------
    // 1. CAS DE CHARGEMENT OU DONNÉES INCOMPLÈTES
    // ---------------------------------------------------------
    if (!weather) {
        return {
            score: 0,
            flyable: false,
            reason: 'Chargement...',
            class: 'weather-unknown',
            icon: 'ri-loader-4-line',
        };
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
        return {
            score: 0,
            flyable: false,
            reason: `Pluie (${precip.toFixed(1)} mm)`,
            class: 'weather-unflyable',
            icon: 'ri-showers-fill',
        };
    }

    // C. Limites de vitesse du vent moyen (vMin / vMax de l'utilisateur)
    let hardwareWingsNames = [];
    if (userPreferences.filterMode === 'hardware') {
        const wings = JSON.parse(localStorage.getItem('tp_equipment_data')) || [];
        const flyableWings = wings.filter(
            (wing) =>
                wing.type === 'voile' &&
                wing.ventMin !== undefined &&
                wing.ventMax !== undefined &&
                weather.windSpeed >= wing.ventMin &&
                weather.windSpeed <= wing.ventMax,
        );

        if (flyableWings.length > 0) {
            hardwareWingsNames = flyableWings.map((w) => w.nom);
        } else {
            return {
                score: 0,
                flyable: false,
                reason: 'Vent hors limites (Matériel)',
                class: 'weather-unflyable',
                icon: 'ri-close-circle-fill',
            };
        }
    } else {
        if (weather.windSpeed < userPreferences.vMin || weather.windSpeed > userPreferences.vMax) {
            return {
                score: 0,
                flyable: false,
                reason: 'Vent hors limites',
                class: 'weather-unflyable',
                icon: 'ri-close-circle-fill',
            };
        }
    }

    // D. Limite de la turbulence (delta rafale de l'utilisateur)
    const rafalesEffectives = Math.max(weather.windGust || 0, weather.windSpeed);
    const deltaRafale = rafalesEffectives - weather.windSpeed;
    if (deltaRafale > userPreferences.deltaRafaleMax) {
        return {
            score: 0,
            flyable: false,
            reason: 'Rafales hors limites',
            class: 'weather-unflyable',
            icon: 'ri-close-circle-fill',
        };
    }

    // E. Risque orageux (CAPE)
    if (weather.cape !== undefined && weather.cape > 1000) {
        return {
            score: 0,
            flyable: false,
            reason: 'Risque orageux (CAPE)',
            class: 'weather-unflyable',
            icon: 'ri-thunderstorms-line',
        };
    }

    // F. Orientation du vent (Filtrage par Point Cardinal - Tolérance Zéro)
    let orientations = [];
    if (Array.isArray(site.orientations_vent)) orientations = site.orientations_vent;
    else if (typeof site.orientations_vent === 'string')
        orientations = site.orientations_vent.split(',').map((v) => v.trim());
    else if (typeof site.orientation === 'string' && site.orientation.length > 0)
        orientations = site.orientation.split(',').map((v) => v.trim());
    if (orientations.length > 0) {
        let ventCardinal = '';

        if (weather.windCard && String(weather.windCard).trim() !== '') {
            ventCardinal = String(weather.windCard);
        } else if (weather.windDir !== undefined && weather.windDir !== null && String(weather.windDir).trim() !== '') {
            ventCardinal = degreesToCardinal(Number(weather.windDir));
        }

        ventCardinal = ventCardinal.trim().toUpperCase();

        if (!orientations.includes(ventCardinal)) {
            return {
                score: 0,
                flyable: false,
                reason: 'Mauvaise orientation',
                class: 'weather-unflyable',
                icon: 'ri-close-circle-fill',
            };
        }
    }

    // ---------------------------------------------------------
    // 3. CALCUL DU SCORE ÉVOLUTIF (Si tous les verrous sont au vert)
    // ---------------------------------------------------------

    // A. Note de Vitesse du Vent (0 à 100)
    const vIdeal = (userPreferences.vMin + userPreferences.vMax) / 2;
    const demiPlage = (userPreferences.vMax - userPreferences.vMin) / 2;

    let scoreVentMoyen;
    if (demiPlage > 0) {
        const ecartVent = Math.abs(weather.windSpeed - vIdeal);
        scoreVentMoyen = Math.max(0, 100 * (1 - ecartVent / demiPlage));
    } else {
        // Protection division par zéro si vMin == vMax
        scoreVentMoyen = weather.windSpeed === vIdeal ? 100 : 0;
    }

    // Extraction et conversion de la direction du vent en degrés
    let windDirDeg = null;
    if (weather.windDirDeg !== undefined && weather.windDirDeg !== null) {
        windDirDeg = Number(weather.windDirDeg);
    } else if (weather.windDir !== undefined && weather.windDir !== null) {
        const parsed = Number(weather.windDir);
        if (!isNaN(parsed)) {
            windDirDeg = parsed;
        } else {
            const CARD_TO_DEG = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SO: 225, O: 270, NO: 315 };
            const cleanCard = String(weather.windDir).trim().toUpperCase();
            if (CARD_TO_DEG[cleanCard] !== undefined) {
                windDirDeg = CARD_TO_DEG[cleanCard];
            }
        }
    }

    if (windDirDeg === null && weather.windCard) {
        const CARD_TO_DEG = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SO: 225, O: 270, NO: 315 };
        const cleanCard = String(weather.windCard).trim().toUpperCase();
        if (CARD_TO_DEG[cleanCard] !== undefined) {
            windDirDeg = CARD_TO_DEG[cleanCard];
        }
    }

    // B. Note d'Orientation (0 à 100)
    // Plus le vent est aligné avec l'orientation de la pente, plus le score est élevé.
    const hasOrientation =
        site.orientation_ideale_deg !== undefined && site.orientation_ideale_deg !== null && windDirDeg !== null;
    let angularDiff;
    let scoreOrientation = 100; // 100 par défaut si pas d'orientation idéale spécifiée

    if (hasOrientation) {
        angularDiff = getAngularDifference(windDirDeg, site.orientation_ideale_deg);

        // Logique de paliers pour le rendement en soaring / thermique
        if (angularDiff <= 11.25) {
            // Zone 1 : Parfait (±11.25°)
            scoreOrientation = 100;
        } else if (angularDiff <= 22.5) {
            // Zone 2 : Bon (décroît de 100 à 70 entre 11.25° et 22.5°)
            const progress = (angularDiff - 11.25) / (22.5 - 11.25);
            scoreOrientation = 100 - progress * 30;
        } else if (angularDiff <= 45) {
            // Zone 3 : Passable (décroît de 70 à 0 entre 22.5° et 45°)
            const progress = (angularDiff - 22.5) / (45 - 22.5);
            scoreOrientation = 70 - progress * 70;
        } else {
            // Zone 4 : Hors-jeu (> 45°)
            scoreOrientation = 0;
        }
    }

    // C. Calcul du score final pondéré
    const finalScore =
        Math.round(scoreVentMoyen * SCORING_WEIGHTS.WIND_SPEED + scoreOrientation * SCORING_WEIGHTS.WIND_DIRECTION) ||
        0;

    // ---------------------------------------------------------
    // 4. RETOUR DU DIAGNOSTIC COMPLET
    // ---------------------------------------------------------
    let reasonText = `Excellent (${finalScore}/100)`;
    if (finalScore < 50) reasonText = `Passable (${finalScore}/100)`;
    else if (finalScore < 80) reasonText = `Bon (${finalScore}/100)`;

    if (hardwareWingsNames && hardwareWingsNames.length > 0) {
        reasonText += ` avec ${hardwareWingsNames.join(', ')}`;
    }

    return {
        score: finalScore,
        flyable: true,
        reason: reasonText,
        class: 'weather-flyable',
        icon: 'ri-checkbox-circle-fill',
    };
}
