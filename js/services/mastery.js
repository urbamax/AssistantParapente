/**
 * Maîtrise d'une question : part de bonnes réponses sur ses `MASTERY_WINDOW` dernières tentatives.
 *
 * Le ratio cumulé `correct / total` ne pouvait pas revenir à 100 % après une seule erreur ; avec une
 * fenêtre glissante, une erreur sort de la fenêtre après `MASTERY_WINDOW` bonnes réponses de suite.
 * Les statistiques gardent `total` et `correct` (affichage, synchro), plus `recent` : les dernières
 * réponses, de la plus ancienne à la plus récente (1 = juste, 0 = fausse).
 *
 * Une question n'est maîtrisée à 100 % qu'après `MASTERY_WINDOW` bonnes réponses : les places encore
 * vides de la fenêtre comptent comme des points manquants (2 bonnes réponses sur 2 tentatives = 2/10).
 * `successRate` donne à part le taux de réussite sur les seules tentatives faites, pour juger si une
 * question est fragile (planification, classement) sans pénaliser celles qui viennent d'être vues.
 */

export const MASTERY_WINDOW = 10;

/**
 * @typedef {{total?: number, correct?: number, streak?: number, recent?: number[]}} QuestionStat
 */

/**
 * Dernières réponses d'une question (au plus `MASTERY_WINDOW`, de la plus ancienne à la plus récente).
 * Les statistiques enregistrées avant `recent` n'ont que `total`, `correct` et `streak` : on
 * reconstitue la fenêtre la plus plausible — la série en cours à la fin, précédée d'une erreur, les
 * réponses plus anciennes se répartissant selon leur taux de réussite.
 * @param {QuestionStat | undefined} stat
 * @returns {number[]}
 */
export function recentAttempts(stat) {
    if (!stat || !(stat.total > 0)) return [];
    if (Array.isArray(stat.recent) && stat.recent.length > 0) return stat.recent.slice(-MASTERY_WINDOW);

    const total = stat.total;
    const correct = Math.min(Math.max(stat.correct || 0, 0), total);
    const size = Math.min(total, MASTERY_WINDOW);
    const streak = Math.min(Math.max(stat.streak || 0, 0), correct, size);
    const older = size - streak;
    const olderTotal = total - streak;
    const olderCorrect = correct - streak;

    let olderRight = older;
    if (olderCorrect < olderTotal) {
        // La réponse juste avant la série en cours était forcément fausse.
        olderRight = Math.min(older - 1, Math.round((older * olderCorrect) / olderTotal));
    }
    return [
        ...Array(Math.max(olderRight, 0)).fill(1),
        ...Array(older - Math.max(olderRight, 0)).fill(0),
        ...Array(streak).fill(1),
    ];
}

/** Ajoute une réponse à la fenêtre d'une question. */
export function pushAttempt(stat, isCorrect) {
    return [...recentAttempts(stat), isCorrect ? 1 : 0].slice(-MASTERY_WINDOW);
}

/** Maîtrise (0 à 1) à partir d'une fenêtre de réponses : bonnes réponses sur `MASTERY_WINDOW`. */
function ratioOf(window) {
    return window.reduce((sum, v) => sum + v, 0) / MASTERY_WINDOW;
}

/**
 * Maîtrise actuelle (0 à 1) d'une question, 0 si elle n'a jamais été tentée. Elle n'atteint 1 qu'après
 * `MASTERY_WINDOW` bonnes réponses sans erreur.
 * @param {QuestionStat | undefined} stat
 */
export function masteryRatio(stat) {
    return ratioOf(recentAttempts(stat));
}

/**
 * Taux de réussite (0 à 1) sur les dernières tentatives réellement faites, 0 si jamais tentée.
 * @param {QuestionStat | undefined} stat
 */
export function successRate(stat) {
    const window = recentAttempts(stat);
    return window.length === 0 ? 0 : window.reduce((sum, v) => sum + v, 0) / window.length;
}

/**
 * Maîtrise qu'aurait la question après `n` bonnes réponses de plus.
 * @param {QuestionStat | undefined} stat
 */
export function masteryRatioAfterCorrect(stat, n = 1) {
    let window = recentAttempts(stat);
    for (let i = 0; i < n; i++) window = [...window, 1].slice(-MASTERY_WINDOW);
    return ratioOf(window);
}
