/**
 * UTILS - Geo Utilities
 * Pure functions for geographic calculations, distance, and angle normalization.
 */

/**
 * Calcule la distance en kilomètres entre deux points GPS en utilisant la formule de Haversine.
 * @param {number} lat1 
 * @param {number} lon1 
 * @param {number} lat2 
 * @param {number} lon2 
 * @returns {number} Distance en kilomètres
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
    if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) return Infinity;
    const R = 6371; // Rayon de la Terre en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance en km
}

/**
 * Normalise un angle (cap) pour le ramener entre 0 et 360 degrés.
 * @param {number} deg - L'angle en degrés
 * @returns {number} L'angle normalisé (0-360)
 */
export function normalizeDegree(deg) {
    if (typeof deg !== 'number' || isNaN(deg)) return 0;
    return ((deg % 360) + 360) % 360;
}

/**
 * Calcule la différence angulaire absolue la plus courte entre deux caps (en degrés).
 * @param {number} angle1 - Premier angle (0-360)
 * @param {number} angle2 - Deuxième angle (0-360)
 * @returns {number} La différence angulaire entre 0 et 180 degrés.
 */
export function getAngularDifference(angle1, angle2) {
    const diff = Math.abs(angle1 - angle2) % 360;
    return diff > 180 ? 360 - diff : diff;
}

/**
 * Convertit un cap en degrés (0-360) en direction cardinale courte.
 * @param {number} deg - Cap en degrés
 * @returns {string} Direction cardinale ("N", "NE", "E", "SE", "S", "SO", "O", "NO")
 */
export function degreesToCardinal(deg) {
    const normalizedDeg = normalizeDegree(deg);
    const directions = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
    const index = Math.round(normalizedDeg / 45) % 8;
    return directions[index];
}
