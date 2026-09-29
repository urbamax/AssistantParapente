/**
 * UTILS - i18n
 * Accès au catalogue de textes (js/i18n/fr.js). Module pur : aucune dépendance au navigateur,
 * il est aussi copié côté serveur (functions/shared/, voir scripts/sync_functions_shared.mjs).
 */
import { FR } from '../i18n/fr.js';

const warnedKeys = new Set();

/**
 * Renvoie le texte associé à une clé pointée (ex. 'weather.night'), en remplaçant les
 * {placeholders} par les valeurs de params. Une clé inconnue est renvoyée telle quelle
 * (avec un avertissement unique en console) plutôt que de faire planter l'affichage.
 * @param {string} key
 * @param {Object<string, string|number>} [params]
 * @returns {string}
 */
export function t(key, params = {}) {
    /** @type {any} */
    let node = FR;
    for (const part of key.split('.')) {
        node = node && typeof node === 'object' ? node[part] : undefined;
    }
    if (typeof node !== 'string') {
        if (!warnedKeys.has(key)) {
            warnedKeys.add(key);
            console.warn(`i18n : clé inconnue « ${key} »`);
        }
        return key;
    }
    return node.replace(/\{(\w+)\}/g, (match, name) =>
        Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
    );
}
