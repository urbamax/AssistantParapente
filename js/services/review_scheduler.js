/**
 * SERVICE - Review scheduler
 * Répétition espacée du mode « Révision » du QCM. Module pur (aucun accès au stockage ni au DOM).
 *
 * Chaque question mémorise sa série de bonnes réponses consécutives (`streak`) et la date de sa
 * dernière présentation (`lastSeen`, en ms). L'intervalle avant la prochaine révision grandit avec
 * la série et repart de zéro à la moindre erreur. Une question jamais vue passe toujours en
 * premier ; parmi les autres, la plus en retard sur son échéance passe d'abord (la maîtrise sur
 * les dernières réponses sert à départager, et retarde un peu l'échéance d'une question bien réussie).
 */

import { successRate } from './mastery.js';

/** Intervalle (jours) avant la prochaine révision, selon la série de bonnes réponses. */
export const REVIEW_INTERVALS_DAYS = [0, 1, 3, 7, 14, 30];
export const DAY_MS = 24 * 60 * 60 * 1000;

/** Seuil de réussite des statistiques enregistrées avant l'existence de `lastSeen`. */
const LEGACY_SUCCESS_THRESHOLD = 0.75;

/**
 * @typedef {{total?: number, correct?: number, streak?: number, lastSeen?: number, recent?: number[]}} QuestionStat
 */

/** @param {number|undefined} streak */
export function reviewIntervalDays(streak) {
    const step = Math.min(streak || 0, REVIEW_INTERVALS_DAYS.length - 1);
    return REVIEW_INTERVALS_DAYS[step];
}

/**
 * Priorité d'une question : >= 0 si elle est à réviser, d'autant plus grand qu'elle est en retard.
 * @param {QuestionStat|undefined} stat
 * @param {number} [now]
 * @returns {number} Infinity si la question n'a jamais été tentée
 */
export function dueScore(stat, now = Date.now()) {
    if (!stat || !stat.total) return Infinity;
    const ratio = successRate(stat);
    if (!stat.lastSeen) {
        // Statistique antérieure au suivi temporel : on garde l'ancien critère de seuil de ratio
        // pour ne pas casser l'historique tant que la question n'a pas été retentée.
        return LEGACY_SUCCESS_THRESHOLD - ratio;
    }
    const daysSinceSeen = (now - stat.lastSeen) / DAY_MS;
    return daysSinceSeen - reviewIntervalDays(stat.streak) - ratio;
}

/** @param {QuestionStat|undefined} stat @param {number} [now] */
export function isDue(stat, now = Date.now()) {
    return dueScore(stat, now) >= 0;
}

/**
 * Moment (ms) où la question devient à réviser ; null si elle n'a jamais été tentée ou si ses
 * statistiques n'ont pas de `lastSeen` (échéance alors fondée sur le seul ratio).
 * @param {QuestionStat|undefined} stat
 * @returns {number|null}
 */
export function nextDueAt(stat) {
    if (!stat || !stat.total || !stat.lastSeen) return null;
    const ratio = successRate(stat);
    return stat.lastSeen + (reviewIntervalDays(stat.streak) + ratio) * DAY_MS;
}

/**
 * Bilan d'un ensemble de questions : nouvelles, à réviser, pas encore à réviser, et la prochaine
 * échéance parmi celles qui ne sont pas encore à réviser.
 * @param {Array<{code: string}>} questions
 * @param {Record<string, QuestionStat>} statsByCode
 * @param {number} [now]
 * @returns {{total: number, fresh: number, due: number, notDue: number, nextDueAt: number|null}}
 */
export function summarizeReviews(questions, statsByCode, now = Date.now()) {
    const summary = { total: questions.length, fresh: 0, due: 0, notDue: 0, nextDueAt: null };
    for (const { code } of questions) {
        const stat = statsByCode[code];
        if (!stat || !stat.total) {
            summary.fresh++;
        } else if (isDue(stat, now)) {
            summary.due++;
        } else {
            summary.notDue++;
            const at = nextDueAt(stat);
            if (at !== null && (summary.nextDueAt === null || at < summary.nextDueAt)) summary.nextDueAt = at;
        }
    }
    return summary;
}
