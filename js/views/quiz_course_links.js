import { escapeHTML } from '../core/security.js';
import { unsourcedChoiceIndexes } from '../services/error_diagnostic.js';
import { tq } from './quiz_strings.js';

const COURSE_BUTTON_STYLE =
    'background:var(--accent-orange); color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; font-size:0.75rem; font-weight:700; display:inline-flex; align-items:center; gap:4px;';

/**
 * Boutons « voir dans le cours » du retour de correction : un seul bouton quand la réponse
 * s'appuie sur un seul endroit du cours, un bouton par cours (avec sa page) quand plusieurs bonnes
 * réponses relèvent de cours ou de pages différents.
 */
export function courseLinksHtml(links) {
    if (!links || !links.length) return '';
    if (links.length === 1) {
        return `<button data-action="openUrl" data-url="${escapeHTML(links[0].url)}" style="margin-top:10px; ${COURSE_BUTTON_STYLE}"><i class="ri-book-open-line"></i> ${tq('question.seeCourse')}</button>`;
    }
    const buttons = links
        .map(
            (l) =>
                `<button data-action="openUrl" data-url="${escapeHTML(l.url)}" style="${COURSE_BUTTON_STYLE} text-align:left;"><i class="ri-book-open-line"></i> ${tq('question.seeCourseAt', { title: l.title, page: l.page })}</button>`,
        )
        .join('');
    return `<div class="course-links" style="margin-top:10px; display:flex; flex-wrap:wrap; gap:6px;">${buttons}</div>`;
}

/**
 * Boutons du cours sous une bonne réponse. Le rapprochement entre la question et les pages du cours
 * est établi pour la question entière, pas choix par choix : chaque bonne réponse reprend donc les
 * pages vérifiées de la question. Courts (« Cours · p. 45 ») quand tous viennent du même cours.
 * Pour un choix précis, passer par choiceSourceHtml, qui écarte les choix déclarés sans source.
 */
export function choiceCourseLinksHtml(links) {
    if (!links || !links.length) return '';
    const sameCourse = new Set(links.map((l) => l.title)).size === 1;
    const buttons = links
        .map((l) => {
            const label = sameCourse
                ? tq('question.seeCourseShort', { page: l.page })
                : tq('question.seeCourseAt', { title: l.title, page: l.page });
            return `<button data-action="openUrl" data-url="${escapeHTML(l.url)}" style="${COURSE_BUTTON_STYLE} text-align:left;"><i class="ri-book-open-line"></i> ${label}</button>`;
        })
        .join('');
    return `<div class="course-links" style="margin-top:10px; display:flex; flex-wrap:wrap; gap:6px;">${buttons}</div>`;
}

/**
 * Ce qui s'affiche sous une bonne réponse pour dire d'où elle vient : les boutons du cours, ou la
 * mention « Aucune source trouvée pour le moment. » quand la note de fin de l'explication déclare ce
 * choix sans source. Sans cela, la page vérifiée de la question s'afficherait sous un choix qu'elle ne
 * traite pas, et la note, retirée du découpage par choix, ne serait plus visible nulle part.
 *
 * @param {Array<{ url: string, title: string, page: number | string }>} links pages vérifiées de la question
 * @param {{ choices?: any[], explication?: string }} question question d'origine (ordre du CSV)
 * @param {number} index index du choix dans la question d'origine
 */
export function choiceSourceHtml(links, question, index) {
    if (unsourcedChoiceIndexes(question).has(index)) {
        return `<div class="course-no-source" style="margin-top:10px; font-size:0.75rem; font-style:italic; opacity:0.75;">${tq('question.noSource')}</div>`;
    }
    return choiceCourseLinksHtml(links);
}
