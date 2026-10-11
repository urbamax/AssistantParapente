/**
 * SERVICE - Flight classifier
 * Suggère le type d'un vol (Plouf, Thermique, Soaring, Cross, Treuil) d'après l'analyse de sa
 * trace IGC (IGCParser.analyzeFlight). Fonction pure : le pilote garde toujours le dernier mot.
 * « Restit » (vol de restitution à l'école) ne se lit pas dans une trace : jamais suggéré.
 */

/** Seuils (heuristiques) de la classification, regroupés ici pour être réglés au même endroit. */
export const CLASSIFICATION = Object.freeze({
    /** Gain minimal d'un thermique pour qu'il compte (m). */
    thermalMinGainM: 50,
    /** Distance libre à partir de laquelle un vol à thermiques est un cross (km). */
    crossMinKm: 15,
    /** Durée minimale d'un vol de soaring (min). */
    soaringMinMinutes: 10,
    /** Demi-tours minimaux d'un vol de soaring (aller-retours le long de la pente). */
    soaringMinReversals: 3,
    /** Vario moyen minimal d'un vol de soaring : en dessous, le pilote descend (m/s). */
    soaringMinAvgVario: -0.6,
});

/**
 * @param {{winch?: object|null, thermalCount?: number, maxThermalGain?: number,
 *   freeDistanceKm?: number, avgVario?: number, reversals?: number}|null|undefined} analysis
 * @param {number} durationMinutes durée du vol
 * @returns {{type: string, reason: string}|null} le type suggéré et la raison affichée au pilote
 */
export function classifyFlight(analysis, durationMinutes) {
    if (!analysis) return null;
    if (analysis.winch) return { type: 'Treuil', reason: 'trace' };

    const usableThermal =
        (analysis.thermalCount || 0) > 0 && (analysis.maxThermalGain || 0) >= CLASSIFICATION.thermalMinGainM;
    if (usableThermal) {
        return (analysis.freeDistanceKm || 0) >= CLASSIFICATION.crossMinKm
            ? { type: 'Cross', reason: 'traceCross' }
            : { type: 'Thermique', reason: 'traceThermals' };
    }

    const ridgeSoaring =
        durationMinutes >= CLASSIFICATION.soaringMinMinutes &&
        (analysis.avgVario ?? -Infinity) >= CLASSIFICATION.soaringMinAvgVario &&
        (analysis.reversals || 0) >= CLASSIFICATION.soaringMinReversals;
    return ridgeSoaring ? { type: 'Soaring', reason: 'traceSoaring' } : { type: 'Plouf', reason: 'tracePlouf' };
}
