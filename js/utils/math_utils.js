/**
 * UTILS - Math Utilities
 * Pure functions for mathematical operations and unit conversions.
 */

/**
 * Arrondit un nombre à un certain nombre de décimales.
 * @param {number} value - La valeur à arrondir
 * @param {number} decimals - Le nombre de décimales (par défaut 0)
 * @returns {number} La valeur arrondie
 */
export function roundToDecimals(value, decimals = 0) {
    if (typeof value !== 'number' || isNaN(value)) return 0;
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
}

/**
 * Calcule le pourcentage (0-100) d'une valeur par rapport à un total.
 * @param {number} part - La valeur partielle
 * @param {number} total - Le total
 * @returns {number} Le pourcentage arrondi à l'entier
 */
export function calculatePercentage(part, total) {
    if (!total || total <= 0) return 0;
    return Math.round((part / total) * 100);
}
