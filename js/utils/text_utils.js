/**
 * UTILS - Text Utilities
 * Pure functions for text manipulation, formatting, and sanitization.
 */

/**
 * Met en majuscule la première lettre d'une chaîne de caractères et le reste en minuscules.
 * @param {string} str - La chaîne à formater
 * @returns {string} La chaîne formatée
 */
export function capitalizeFirstLetter(str) {
    if (typeof str !== 'string' || !str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Tronque une chaîne de caractères si elle dépasse une certaine longueur.
 * @param {string} str - La chaîne à tronquer
 * @param {number} length - La longueur maximale
 * @param {string} [suffix="..."] - Le suffixe à ajouter si tronqué
 * @returns {string} La chaîne tronquée
 */
export function truncate(str, length, suffix = "...") {
    if (typeof str !== 'string' || !str) return '';
    if (str.length <= length) return str;
    return str.substring(0, length) + suffix;
}

/**
 * Supprime les accents d'une chaîne de caractères.
 * @param {string} str - La chaîne à nettoyer
 * @returns {string} La chaîne sans accents
 */
export function removeAccents(str) {
    if (typeof str !== 'string' || !str) return '';
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
