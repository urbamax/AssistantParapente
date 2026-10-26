import { escapeHTML } from '../core/security.js';

/**
 * Explication d'une question en HTML : le texte est échappé, puis chaque changement de réponse
 * (retour à la ligne du CSV) devient un saut de ligne.
 */
export function explanationHtml(text) {
    return escapeHTML(String(text || '')).replace(/\r?\n/g, '<br>');
}
