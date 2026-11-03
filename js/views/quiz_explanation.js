import { escapeHTML } from '../core/security.js';
import { splitOptionExplanations } from '../services/error_diagnostic.js';

/**
 * Explication d'une question en HTML : le texte est échappé, puis chaque changement de réponse
 * (retour à la ligne du CSV) devient un saut de ligne.
 */
export function explanationHtml(text) {
    return escapeHTML(String(text || '')).replace(/\r?\n/g, '<br>');
}

/**
 * Explication avec, en surbrillance, le paragraphe des réponses fausses que le pilote a cochées.
 * Renvoie `null` quand l'explication ne se découpe pas fiablement par choix : l'appelant affiche
 * alors l'explication entière, sans surbrillance.
 *
 * @param {{ choices?: any[], explication?: string }} question question d'origine (ordre du CSV)
 * @param {Set<number>} pickedIdx index (ordre du CSV) des réponses fausses cochées
 * @returns {string | null}
 */
export function highlightedExplanationHtml(question, pickedIdx) {
    if (!pickedIdx || pickedIdx.size === 0) return null;
    const parts = splitOptionExplanations(question);
    if (parts.length === 0 || parts.some((p) => p === null)) return null;
    return parts
        .map((p, i) => {
            const html = escapeHTML(p);
            return pickedIdx.has(i) ? `<mark class="explanation-picked">${html}</mark>` : html;
        })
        .join('<br>');
}
