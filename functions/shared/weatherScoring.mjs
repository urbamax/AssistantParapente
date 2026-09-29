// GÉNÉRÉ — ne pas modifier. Copie de js/weatherScoring.js, régénérée par scripts/sync_functions_shared.mjs.
/**
 * weatherScoring.js
 *
 * Module de scoring météo pour les spots de parapente.
 * Combine la validation de sécurité (Kill Switches) et un calcul de score
 * continu de 0 à 100 pour classer les meilleurs spots.
 */

import { getAngularDifference } from './geo_utils.mjs';
import { t } from './i18n.mjs';

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
 * Seuil de CAPE (énergie potentielle convective disponible, J/kg) au-delà duquel une heure est
 * jugée non volable pour risque orageux (spec 001, FR-010/FR-010a).
 *
 * Source : FFVL, Commissions Nationales Sécurité et Technique, « Canicule, vague de chaleur et
 * vol libre », federation.ffvl.fr, 2026-07-31 : une CAPE « dépassant largement la valeur de
 * 1000 » y est présentée comme le signe d'une aérologie brutale et d'une convection explosive.
 * Nuance : la FFVL cite 1000 comme valeur de référence dans un exemple, pas comme une limite
 * réglementaire ; l'application la présente donc comme une estimation à confirmer sur place.
 * Toute modification de cette valeur passe par une modification de la spécification.
 */
export const STORM_CAPE_THRESHOLD = 1000;

const ROUNDED_KINDS = new Set(['windSpeed', 'windGust', 'windDir']);

/**
 * Valide une valeur de prévision brute (spec 001, FR-001). Une valeur absente, vide, non
 * numérique, infinie ou physiquement impossible (négative ; direction hors 0–360°) est
 * « manquante » et renvoyée à null : elle ne doit JAMAIS être remplacée par une valeur par
 * défaut (0 km/h, 0 mm…), sinon un trou de données devient un verdict.
 * @param {unknown} value
 * @param {'windSpeed'|'windGust'|'windDir'|'precipitation'|'cape'} kind
 * @returns {number|null}
 */
export function normalizeForecastValue(value, kind) {
    let num;
    if (typeof value === 'number') num = value;
    else if (typeof value === 'string' && value.trim() !== '') num = Number(value);
    else return null;

    if (!Number.isFinite(num) || num < 0) return null;
    if (kind === 'windDir' && num > 360) return null;
    return ROUNDED_KINDS.has(kind) ? Math.round(num) : num;
}

const KNOWN_ORIENTATIONS = new Set(['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']);

/**
 * Orientations de décollage reconnues d'un site (liste, chaîne séparée par des virgules, ou
 * champ historique `orientation`). Un libellé non reconnu est ignoré ; une liste vide
 * signifie « orientation inconnue » (spec 001, FR-007).
 * @param {any} site
 * @returns {string[]}
 */
export function getSiteOrientations(site) {
    if (!site) return [];
    let raw = [];
    if (Array.isArray(site.orientations_vent)) raw = site.orientations_vent;
    else if (typeof site.orientations_vent === 'string') raw = site.orientations_vent.split(',');
    else if (typeof site.orientation === 'string') raw = site.orientation.split(',');
    return raw.map((v) => String(v).trim().toUpperCase()).filter((v) => KNOWN_ORIENTATIONS.has(v));
}
/**
 * Évalue la météo d'un spot et calcule son score global.
 *
 * Contrat : specs/001-honest-missing-weather/contracts/evaluation.md. Toute valeur requise
 * manquante ou invalide donne un résultat `incomplete` (aucun verdict, aucun défaut inventé).
 *
 * @param {Object} site - Caractéristiques géographiques du spot.
 * @param {string} [site.orientation] - Orientations acceptées séparées par des virgules (ex: "S,SO").
 * @param {string|string[]} [site.orientations_vent] - Orientations acceptées (liste, ou chaîne séparée par des virgules).
 * @param {number} [site.orientation_ideale_deg] - Orientation idéale du site en degrés (le cas échéant).
 *
 * @param {Object} weather - Prévision d'une heure (null = pas encore chargée).
 * @param {boolean|null} [weather.isDaytime] - Jour (true), nuit (false), inconnu (null).
 * @param {number|null} [weather.windSpeed] - Vitesse du vent moyen (km/h).
 * @param {number|null} [weather.windGust] - Vitesse des rafales (km/h).
 * @param {number|string} [weather.windDir] - Direction d'où vient le vent (degrés ou cardinal).
 * @param {number|null} [weather.windDirDeg] - Direction d'où vient le vent en degrés.
 * @param {string|null} [weather.windCard] - Direction cardinale du vent.
 * @param {number|null} [weather.precipitation] - Quantité de précipitations (mm).
 * @param {number|null} [weather.cape] - CAPE / énergie convective disponible (J/kg).
 *
 * @param {Object} userPreferences - Filtres dynamiques issus des champs de l'interface.
 * @param {number} userPreferences.vMin - Vitesse de vent minimale requise.
 * @param {number} userPreferences.vMax - Vitesse de vent maximale autorisée.
 * @param {number} userPreferences.deltaRafaleMax - Écart maximal toléré (rafale - vent moyen).
 * @param {string} [userPreferences.filterMode] - 'hardware' pour filtrer selon les voiles de l'inventaire.
 * @param {Array<{type: string, nom: string, ventMin?: number, ventMax?: number}>} [userPreferences.wings] -
 *   Voiles du pilote (mode 'hardware'), fournies par l'appelant.
 *
 * @returns {Object} Résultat complet du diagnostic pour l'affichage et le tri.
 */
export function evaluateSpotForecast(site, weather, userPreferences) {
    // ---------------------------------------------------------
    // 1. CHARGEMENT (aucune prévision reçue pour ce créneau)
    // ---------------------------------------------------------
    if (!weather) {
        return outcome('loading', 'LOADING', t('weather.loading'), {
            score: 0,
            className: 'weather-unknown',
            icon: 'ri-loader-4-line',
        });
    }

    // ---------------------------------------------------------
    // 2. DONNÉES MANQUANTES → PAS DE VERDICT (spec 001, FR-002/004/005)
    // Une valeur absente ou invalide n'est jamais remplacée par un défaut : l'heure est
    // « incomplète » et toutes les valeurs manquantes sont listées, avant tout contrôle.
    // ---------------------------------------------------------
    const orientations = getSiteOrientations(site);
    const windCard = resolveWindCard(weather);
    const missing = [];
    if (normalizeForecastValue(weather.windSpeed, 'windSpeed') === null) missing.push('windSpeed');
    if (normalizeForecastValue(weather.windGust, 'windGust') === null) missing.push('windGust');
    if (orientations.length > 0 && windCard === null) missing.push('windDir');
    if (normalizeForecastValue(weather.precipitation, 'precipitation') === null) missing.push('precipitation');
    if (normalizeForecastValue(weather.cape, 'cape') === null) missing.push('cape');
    if (typeof weather.isDaytime !== 'boolean') missing.push('daylight');

    if (missing.length > 0) {
        return outcome('incomplete', 'INCOMPLETE', t('weather.incomplete'), {
            missing,
            score: null,
            className: 'weather-incomplete',
            icon: 'ri-question-line',
        });
    }

    // Valeurs validées. On garde la valeur numérique d'origine (non arrondie) pour que les
    // verdicts sur données complètes restent identiques à avant la spec 001 (FR-013).
    const windSpeed = Number(weather.windSpeed);
    const windGust = Number(weather.windGust);
    const precip = Number(weather.precipitation);
    const cape = Number(weather.cape);
    const unflyable = (code, reason, icon = 'ri-close-circle-fill') =>
        outcome('unflyable', code, reason, { score: 0, className: 'weather-unflyable', icon });

    // ---------------------------------------------------------
    // 3. VERROUS DE SÉCURITÉ ABSOLUS (Kill Switches)
    // ---------------------------------------------------------

    // A. Nuit
    if (!weather.isDaytime) return unflyable('NIGHT', t('weather.night'), 'ri-moon-clear-line');

    // B. Précipitations (Pluie)
    if (precip > 0) return unflyable('RAIN', t('weather.rain', { mm: precip.toFixed(1) }), 'ri-showers-fill');

    // C. Limites de vitesse du vent moyen (vMin / vMax de l'utilisateur, ou voiles du pilote)
    let hardwareWingsNames = [];
    if (userPreferences.filterMode === 'hardware') {
        // Les voiles sont fournies par l'appelant (SitesService) : ce module reste pur et
        // partagé avec le serveur, il ne lit aucun stockage (constitution, principe VIII).
        const wings = Array.isArray(userPreferences.wings) ? userPreferences.wings : [];
        const flyableWings = wings.filter(
            (wing) =>
                wing.type === 'voile' &&
                wing.ventMin !== undefined &&
                wing.ventMax !== undefined &&
                windSpeed >= wing.ventMin &&
                windSpeed <= wing.ventMax,
        );
        if (flyableWings.length === 0) {
            return unflyable('WIND_OUT_OF_EQUIPMENT_LIMITS', t('weather.windOutOfEquipmentLimits'));
        }
        hardwareWingsNames = flyableWings.map((w) => w.nom);
    } else if (windSpeed < userPreferences.vMin || windSpeed > userPreferences.vMax) {
        return unflyable('WIND_OUT_OF_LIMITS', t('weather.windOutOfLimits'));
    }

    // D. Limite de la turbulence (delta rafale de l'utilisateur)
    const rafalesEffectives = Math.max(windGust, windSpeed);
    if (rafalesEffectives - windSpeed > userPreferences.deltaRafaleMax) {
        return unflyable('GUST_OUT_OF_LIMITS', t('weather.gustOutOfLimits'));
    }

    // E. Risque orageux (CAPE)
    if (cape > STORM_CAPE_THRESHOLD) {
        return unflyable('STORM_RISK', t('weather.stormRisk'), 'ri-thunderstorms-line');
    }

    // F. Orientation du vent (Filtrage par Point Cardinal - Tolérance Zéro)
    if (orientations.length > 0 && !orientations.includes(windCard)) {
        return unflyable('WRONG_ORIENTATION', t('weather.wrongOrientation'));
    }

    // G. Orientation inconnue (spec 001, FR-007) : on ne suppose jamais qu'elle est idéale.
    // Les contrôles ci-dessus s'appliquent, mais sans score ni appréciation, et avec un
    // avertissement : c'est au pilote de vérifier si le vent convient au décollage.
    if (orientations.length === 0) {
        const wingsSuffix =
            hardwareWingsNames.length > 0 ? t('weather.withWings', { wings: hardwareWingsNames.join(', ') }) : '';
        return outcome('flyable', 'ORIENTATION_UNKNOWN', t('weather.orientationUnknown') + wingsSuffix, {
            score: null,
            className: 'weather-flyable',
            icon: 'ri-compass-discover-line',
            orientationUnknown: true,
            warning: true,
        });
    }

    // ---------------------------------------------------------
    // 4. CALCUL DU SCORE ÉVOLUTIF (Si tous les verrous sont au vert)
    // ---------------------------------------------------------

    // A. Note de Vitesse du Vent (0 à 100)
    const vIdeal = (userPreferences.vMin + userPreferences.vMax) / 2;
    const demiPlage = (userPreferences.vMax - userPreferences.vMin) / 2;

    let scoreVentMoyen;
    if (demiPlage > 0) {
        const ecartVent = Math.abs(windSpeed - vIdeal);
        scoreVentMoyen = Math.max(0, 100 * (1 - ecartVent / demiPlage));
    } else {
        // Protection division par zéro si vMin == vMax
        scoreVentMoyen = windSpeed === vIdeal ? 100 : 0;
    }

    // B. Note d'Orientation (0 à 100)
    // Plus le vent est aligné avec l'orientation de la pente, plus le score est élevé.
    const windDirDeg = resolveWindDirDeg(weather);
    const hasOrientation =
        site.orientation_ideale_deg !== undefined && site.orientation_ideale_deg !== null && windDirDeg !== null;
    let scoreOrientation = 100; // orientations connues mais pas d'orientation idéale en degrés

    if (hasOrientation) {
        const angularDiff = getAngularDifference(windDirDeg, site.orientation_ideale_deg);

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
    // 5. RETOUR DU DIAGNOSTIC COMPLET
    // ---------------------------------------------------------
    let reasonCode = 'EXCELLENT';
    let reasonText = t('weather.excellent', { score: finalScore });
    if (finalScore < 50) {
        reasonCode = 'FAIR';
        reasonText = t('weather.fair', { score: finalScore });
    } else if (finalScore < 80) {
        reasonCode = 'GOOD';
        reasonText = t('weather.good', { score: finalScore });
    }

    if (hardwareWingsNames.length > 0) {
        reasonText += t('weather.withWings', { wings: hardwareWingsNames.join(', ') });
    }

    return outcome('flyable', reasonCode, reasonText, {
        score: finalScore,
        className: 'weather-flyable',
        icon: 'ri-checkbox-circle-fill',
    });
}

/**
 * Construit un résultat d'évaluation (contrat : specs/001-honest-missing-weather/data-model.md).
 * `flyable` est conservé pour compatibilité ; `status` fait foi.
 */
function outcome(
    status,
    reasonCode,
    reason,
    { score, className, icon, missing = [], orientationUnknown = false, warning = false },
) {
    return {
        status,
        flyable: status === 'flyable',
        reasonCode,
        reason,
        missing,
        orientationUnknown,
        score,
        class: className,
        icon,
        warning,
    };
}

/**
 * Direction cardinale du vent : `windCard` si c'est un libellé connu, sinon déduite de
 * `windDirDeg` / `windDir` s'ils sont valides. null si la direction est inconnue.
 * @returns {string|null}
 */
function resolveWindCard(weather) {
    if (weather.windCard !== undefined && weather.windCard !== null) {
        const card = String(weather.windCard).trim().toUpperCase();
        if (KNOWN_ORIENTATIONS.has(card)) return card;
    }
    const deg = resolveWindDirDeg(weather);
    return deg === null ? null : degreesToCardinal(deg);
}

/**
 * Direction du vent en degrés depuis `windDirDeg`, ou `windDir` (degrés ou libellé cardinal),
 * ou `windCard`. null si aucune n'est valide.
 * @returns {number|null}
 */
function resolveWindDirDeg(weather) {
    const deg = normalizeForecastValue(weather.windDirDeg, 'windDir');
    if (deg !== null) return Number(weather.windDirDeg);
    if (weather.windDir !== undefined && weather.windDir !== null) {
        if (normalizeForecastValue(weather.windDir, 'windDir') !== null) return Number(weather.windDir);
        const card = String(weather.windDir).trim().toUpperCase();
        if (card in CARD_TO_DEG) return CARD_TO_DEG[card];
    }
    if (weather.windCard) {
        const card = String(weather.windCard).trim().toUpperCase();
        if (card in CARD_TO_DEG) return CARD_TO_DEG[card];
    }
    return null;
}

const CARD_TO_DEG = Object.freeze({ N: 0, NE: 45, E: 90, SE: 135, S: 180, SO: 225, O: 270, NO: 315 });
