/**
 * UTILS - Array Utilities
 * Pure functions for array manipulation.
 */

/**
 * Équivalent de `Array.prototype.toSorted` (ES2023) avec repli sur `[...arr].sort()` pour les
 * moteurs qui ne l'implémentent pas encore (ex: Safari < 16, Chrome < 110, Firefox < 115) —
 * `toSorted` est trop récent pour être appelé sans détection sur une app grand public.
 * @param {Array} arr
 * @param {(a: any, b: any) => number} [compareFn]
 * @returns {Array} Une nouvelle liste triée, sans muter `arr`.
 */
export function toSorted(arr, compareFn) {
    return typeof arr.toSorted === 'function' ? arr.toSorted(compareFn) : [...arr].sort(compareFn);
}

/**
 * Copie mélangée de `arr` (Fisher-Yates), sans muter l'original.
 * @param {Array} arr
 * @returns {Array}
 */
export function shuffled(arr) {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}
