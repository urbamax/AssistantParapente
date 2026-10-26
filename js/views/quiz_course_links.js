import { escapeHTML } from '../core/security.js';
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
