/**
 * VIEW - Encart « À lire de près » (spec 061)
 * Dans la correction d'une question déjà répondue, signale ce qui la rend délicate : le mot de
 * l'énoncé ou d'un choix qui fait basculer la réponse. Les phrases viennent de
 * js/data/qcm_question_traps.json (QuizService.getQuestionTraps). Jamais affiché avant la réponse :
 * seules les vues de correction appellent ce gabarit.
 */
import { escapeHTML } from '../core/security.js';
import { tq } from './quiz_strings.js';

/**
 * @param {readonly string[] | null | undefined} sentences
 * @returns {string} HTML de l'encart, ou '' quand la question n'a pas de phrase
 */
export function readCloselyHtml(sentences) {
    if (!Array.isArray(sentences) || sentences.length === 0) return '';
    const items = sentences.map((s) => `<p class="quiz-read-closely-text">${escapeHTML(String(s))}</p>`).join('');
    return `<aside class="quiz-read-closely" role="note" aria-label="${tq('question.readCloselyAria')}"><div class="quiz-read-closely-title"><i class="ri-eye-line" aria-hidden="true"></i> ${tq('question.readCloselyTitle')}</div>${items}</aside>`;
}
