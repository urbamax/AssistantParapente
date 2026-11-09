/**
 * SERVICE - Review scheduler
 * Répétition espacée du mode « Révision » du QCM avec l'algorithme SuperMemo SM-2 complet.
 * Module pur (aucun accès au stockage ni au DOM).
 *
 * Chaque question mémorise :
 * - `easeFactor` (EF, défaut 2.5, min 1.3) : facteur de facilité individuel.
 * - `interval` : intervalle calculé en jours avant la prochaine présentation.
 * - `repetitions` : nombre de présentations consécutives réussies (q >= 3).
 * - `streak` : série de bonnes réponses consécutives (rétrocompatibilité).
 * - `lastSeen` : date de la dernière présentation (en ms).
 *
 * Formule SM-2 :
 * EF' = max(1.3, EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)))
 * Intervalles :
 * I(1) = 1 jour
 * I(2) = 6 jours
 * I(n) = round(I(n-1) * EF')
 *
 * En cas d'erreur (q < 3) : répétitions = 0, intervalle = 0 (revient au prochain cycle / lendemain).
 */

import { successRate } from './mastery.js';

export const DEFAULT_EASE_FACTOR = 2.5;
export const MIN_EASE_FACTOR = 1.3;

/** Intervalle historique (jours) avant la prochaine révision, selon la série de bonnes réponses. */
export const REVIEW_INTERVALS_DAYS = [0, 1, 3, 7, 14, 30];
export const DAY_MS = 24 * 60 * 60 * 1000;

/** Seuil de réussite des statistiques enregistrées avant l'existence de `lastSeen`. */
const LEGACY_SUCCESS_THRESHOLD = 0.75;

/**
 * @typedef {{
 *   total?: number,
 *   correct?: number,
 *   streak?: number,
 *   repetitions?: number,
 *   easeFactor?: number,
 *   interval?: number,
 *   lastSeen?: number,
 *   recent?: number[],
 *   choicePicks?: number[],
 *   answers?: number[]
 * }} QuestionStat
 */

/**
 * Calcule le nouveau Facteur de Facilité (Ease Factor) selon la formule SuperMemo SM-2.
 * EF' = max(1.3, EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)))
 *
 * @param {number} [previousEf=DEFAULT_EASE_FACTOR]
 * @param {number} [quality=5] Qualité de rappel entre 0 et 5
 * @returns {number} Nouveau facteur de facilité arrondi à 2 décimales
 */
export function calculateEaseFactor(previousEf = DEFAULT_EASE_FACTOR, quality = 5) {
    const ef = typeof previousEf === 'number' && !isNaN(previousEf) ? previousEf : DEFAULT_EASE_FACTOR;
    const q = Math.max(0, Math.min(5, Math.round(Number(quality) || 0)));
    const diff = 5 - q;
    const delta = 0.1 - diff * (0.08 + diff * 0.02);
    const updated = Math.max(MIN_EASE_FACTOR, ef + delta);
    return Math.round(updated * 100) / 100;
}

/**
 * Calcule l'intervalle en jours pour une répétition donnée avec SM-2.
 * I(1) = 1
 * I(2) = 6
 * I(n) = round(I(n-1) * EF)
 *
 * @param {number} repetition Nombre de répétitions consécutives réussies
 * @param {number} [easeFactor=DEFAULT_EASE_FACTOR]
 * @param {number} [previousInterval] Intervalle précédent en jours
 * @returns {number} Intervalle en jours
 */
export function calculateSm2Interval(repetition, easeFactor = DEFAULT_EASE_FACTOR, previousInterval) {
    const rep = Math.max(0, Math.floor(Number(repetition) || 0));
    if (rep <= 0) return 0;
    if (rep === 1) return 1;
    if (rep === 2) return 6;
    const ef =
        typeof easeFactor === 'number' && !isNaN(easeFactor)
            ? Math.max(MIN_EASE_FACTOR, easeFactor)
            : DEFAULT_EASE_FACTOR;
    if (typeof previousInterval === 'number' && previousInterval >= 1) {
        return Math.max(1, Math.round(previousInterval * ef));
    }
    return Math.max(1, Math.round(6 * Math.pow(ef, rep - 2)));
}

/**
 * Évalue la qualité d'une réponse (0 à 5) pour l'algorithme SM-2.
 * @param {object} [params={}]
 * @param {boolean} [params.isCorrect]
 * @param {number} [params.userScore]
 * @param {number} [params.maxScore]
 * @param {number} [params.timeTakenMs] Temps passé sur la question (ms)
 * @param {number} [params.explicitQuality] Note explicite éventuelle (0-5)
 * @returns {number} Qualité de rappel entière entre 0 et 5
 */
export function evaluateQuality({ isCorrect, userScore, maxScore, timeTakenMs, explicitQuality } = {}) {
    if (typeof explicitQuality === 'number' && !isNaN(explicitQuality)) {
        return Math.max(0, Math.min(5, Math.round(explicitQuality)));
    }
    if (!isCorrect) {
        // En cas d'erreur :
        // Si points partiels obtenus sans score négatif : "Presque" => q = 2
        if (typeof userScore === 'number' && typeof maxScore === 'number' && maxScore > 0 && userScore > 0) {
            return 2;
        }
        return 1; // Erreur classique
    }
    // Réponse correcte :
    if (typeof timeTakenMs === 'number' && timeTakenMs > 0) {
        if (timeTakenMs > 30000) return 3; // Correct mais laborieux (> 30s)
        if (timeTakenMs > 15000) return 4; // Correct avec hésitation (> 15s)
        return 5; // Réponse fluide et rapide (<= 15s)
    }
    return 5;
}

/**
 * Met à jour les métriques SM-2 d'une statistique de question après une réponse.
 *
 * @param {QuestionStat} [stat={}]
 * @param {object} [result={}]
 * @param {boolean} [result.isCorrect]
 * @param {number} [result.userScore]
 * @param {number} [result.maxScore]
 * @param {number} [result.timeTakenMs]
 * @param {number} [result.explicitQuality]
 * @param {number} [result.now]
 * @returns {{easeFactor: number, interval: number, repetitions: number, quality: number, lastSeen: number}}
 */
export function applySm2Review(stat = {}, result = {}) {
    const quality = evaluateQuality(result);
    const oldEf =
        typeof stat.easeFactor === 'number' && !isNaN(stat.easeFactor) ? stat.easeFactor : DEFAULT_EASE_FACTOR;
    const newEf = calculateEaseFactor(oldEf, quality);
    const oldReps =
        typeof stat.repetitions === 'number' ? stat.repetitions : typeof stat.streak === 'number' ? stat.streak : 0;

    const isSuccess = quality >= 3;
    const newReps = isSuccess ? oldReps + 1 : 0;
    const newInterval = isSuccess ? calculateSm2Interval(newReps, newEf, stat.interval) : 0;

    const lastSeen = typeof result.now === 'number' ? result.now : Date.now();

    return {
        easeFactor: newEf,
        interval: newInterval,
        repetitions: newReps,
        quality,
        lastSeen,
    };
}

/**
 * Retourne l'intervalle effectif en jours avant la prochaine révision d'une question.
 * @param {QuestionStat|undefined} stat
 * @returns {number}
 */
export function getQuestionIntervalDays(stat) {
    if (!stat) return 0;
    if (typeof stat.interval === 'number' && !isNaN(stat.interval)) {
        return Math.max(0, stat.interval);
    }
    if (typeof stat.easeFactor === 'number' && !isNaN(stat.easeFactor)) {
        const reps = stat.repetitions ?? stat.streak ?? 0;
        return calculateSm2Interval(reps, stat.easeFactor);
    }
    return reviewIntervalDays(stat.streak);
}

/**
 * Intervalle historique en jours selon la série de bonnes réponses.
 * @param {number|undefined} streak
 * @returns {number}
 */
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
    const intervalDays = getQuestionIntervalDays(stat);
    return daysSinceSeen - intervalDays - ratio;
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
    const intervalDays = getQuestionIntervalDays(stat);
    return stat.lastSeen + (intervalDays + ratio) * DAY_MS;
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
