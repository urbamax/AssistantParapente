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
 * Explications d'une question découpées par choix, dans l'ordre d'origine du CSV. `null` quand
 * l'explication ne se découpe pas fiablement : l'appelant affiche alors l'explication entière.
 *
 * @param {{ choices?: any[], explication?: string }} question question d'origine (ordre du CSV)
 * @returns {string[] | null}
 */
export function optionExplanations(question) {
    const parts = splitOptionExplanations(question);
    return parts.length > 0 && parts.every((p) => p !== null) ? /** @type {string[]} */ (parts) : null;
}

/**
 * Ce que le pilote a fait d'un choix, pour décider de l'affichage de son explication :
 *  - `incorrect` : réponse fausse cochée ;
 *  - `missed`    : bonne réponse oubliée ;
 *  - `ok`        : bien traité (bonne réponse cochée, ou fausse réponse laissée de côté).
 *
 * @param {{ pts: number }} choice
 * @param {boolean} selected
 * @returns {'incorrect' | 'missed' | 'ok'}
 */
export function optionOutcome(choice, selected) {
    if (choice.pts < 0 && selected) return 'incorrect';
    if (choice.pts > 0 && !selected) return 'missed';
    return 'ok';
}

/**
 * Explication affichée sous un choix après la correction. Toujours repliable : ouverte d'office sous
 * une faute (fausse réponse cochée, bonne réponse oubliée), repliée sous ce qui est bien traité.
 *
 * @param {string} text
 * @param {'incorrect' | 'missed' | 'ok'} outcome
 * @param {string} label nom du pli pour les lecteurs d'écran et l'infobulle : le pli n'affiche qu'une flèche
 * @param {string} [extraHtml] HTML déjà prêt ajouté sous le texte (boutons du cours)
 * @returns {string}
 */
export function optionExplanationHtml(text, outcome, label, extraHtml = '') {
    const open = outcome === 'ok' ? '' : ' open';
    return `<details class="qcm-option-explanation" data-kind="${outcome}"${open}><summary aria-label="${escapeHTML(label)}" title="${escapeHTML(label)}"></summary><div>${escapeHTML(String(text || ''))}</div>${extraHtml}</details>`;
}
