/**
 * UTILS - Array Utilities
 * Pure functions for array manipulation.
 */

/**
 * Équivalent de `Array.prototype.toSorted` (ES2023) avec repli sur `[...arr].sort()` pour les
 * moteurs qui ne l'implémentent pas encore (ex: Safari < 16, Chrome < 110, Firefox < 115) —
 * `toSorted` est trop récent pour être appelé sans détection sur une app grand public.
 * @param {Array} arr
 * @param {Function} [compareFn]
 * @returns {Array} Une nouvelle liste triée, sans muter `arr`.
 */
export function toSorted(arr, compareFn) {
    return typeof arr.toSorted === 'function' ? arr.toSorted(compareFn) : [...arr].sort(compareFn);
}
