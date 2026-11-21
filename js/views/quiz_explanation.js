import { escapeHTML } from '../core/security.js';
import { splitOptionExplanations } from '../services/error_diagnostic.js';
import { ACRONYMS_DATA } from '../data/acronyms_data.js';
import { COURSES_DATA } from '../data/courses_data.js';
import { tq } from './quiz_strings.js';

// Trié par ordre décroissant de longueur pour faire correspondre les sigles composés en premier (ex: 'SUP AIP' avant 'AIP')
const ACRONYM_KEYS = Object.keys(ACRONYMS_DATA).sort((a, b) => b.length - a.length);
const ACRONYM_REGEX = new RegExp(
    `\\b(${ACRONYM_KEYS.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
    'g',
);

/**
 * Page de la bibliothèque qui explique un sigle : adresse du PDF à la bonne page et libellé du bouton.
 * @param {{ course: string, page: number } | undefined} source
 * @returns {{ url: string, label: string } | null}
 */
export function acronymSource(source) {
    const course = source && COURSES_DATA[source.course];
    if (!course || !course.pdf) return null;
    return {
        url: `${course.pdf}#page=${source.page}`,
        label: tq('acronymSource', { title: course.title, page: source.page }),
    };
}

/**
 * Enveloppe les sigles connus dans des balises <abbr> avec leur définition et leur source.
 * À n'utiliser que sur les explications : jamais sur une question ni sur ses choix (ce serait souffler
 * la réponse).
 * @param {string} escapedText texte déjà échappé par escapeHTML
 * @returns {string}
 */
export function annotateAcronyms(escapedText) {
    if (!escapedText) return '';
    return String(escapedText).replace(ACRONYM_REGEX, (match) => {
        const entry = ACRONYMS_DATA[match];
        if (!entry) return match;
        const source = acronymSource(entry.source);
        const sourceAttrs = source
            ? ` data-source-url="${escapeHTML(source.url)}" data-source-label="${escapeHTML(source.label)}"`
            : '';
        return `<abbr class="qcm-acronym" title="${escapeHTML(entry.def)}" data-acronym="${escapeHTML(match)}"${sourceAttrs} tabindex="0">${match}</abbr>`;
    });
}

/**
 * Explication d'une question en HTML : le texte est échappé, les acronymes sont annotés,
 * puis chaque changement de réponse (retour à la ligne du CSV) devient un saut de ligne.
 */
export function explanationHtml(text) {
    return annotateAcronyms(escapeHTML(String(text || ''))).replace(/\r?\n/g, '<br>');
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
    const body = annotateAcronyms(escapeHTML(String(text || '')));
    return `<details class="qcm-option-explanation" data-kind="${outcome}"${open}><summary aria-label="${escapeHTML(label)}" title="${escapeHTML(label)}"></summary><div>${body}</div>${extraHtml}</details>`;
}
