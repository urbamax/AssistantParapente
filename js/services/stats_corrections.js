import { MASTERY_WINDOW } from './mastery.js';

/**
 * Auto-guérison et corrections des statistiques du QCM qui se propagent avec la synchronisation.
 *
 * La fusion local/cloud garde le maximum de chaque compteur (`Math.max`) : retirer un double
 * comptage sur un seul appareil ne suffit pas si le cloud ou un autre appareil réinjecte l'ancien
 * compteur. Chaque copie des statistiques passe donc par `healQcmStats` (à la lecture locale ET sur
 * les deux branches `local` et `cloud` avant `Math.max` dans `mergeQcmStats`), et note les
 * corrections appliquées dans `appliedCorrections` (ainsi que `corrections` pour propager toute
 * correction dynamique entre appareils).
 *
 * Chaque entrée peut préciser `minTotal` : le retrait ne s'applique que si `qStat.total >= minTotal`,
 * ce qui garantit qu'une copie saine (où l'examen n'avait été compté qu'une seule fois) n'est
 * jamais décrémentée à tort.
 */

const EXAM_1794000732892_QUESTIONS = Object.freeze({
    E13B: { total: 1, correct: 1, minTotal: 4, theme: 'Mécavol' },
    E49B: { total: 1, correct: 1, minTotal: 4, theme: 'Mécavol' },
    W62B: { total: 1, correct: 0, minTotal: 4, theme: 'Pilotage' },
    U12B: { total: 1, correct: 1, minTotal: 6, theme: 'Pilotage' },
    L4B: { total: 1, correct: 1, minTotal: 6, theme: 'Matériel' },
    A74B: { total: 1, correct: 1, minTotal: 4, theme: 'Météo' },
    A65B: { total: 1, correct: 0, minTotal: 4, theme: 'Météo' },
    F17BM: { total: 1, correct: 1, minTotal: 7, theme: 'Facteurs humains' },
    S134B: { total: 1, correct: 1, minTotal: 3, theme: 'Réglementation' },
    P22BM: { total: 1, correct: 1, minTotal: 6, theme: 'Milieu naturel' },
    G5B: { total: 1, correct: 1, minTotal: 5, theme: 'Mécavol' },
    F25VBM: { total: 1, correct: 1, minTotal: 14, theme: 'Facteurs humains' },
    A96B: { total: 1, correct: 1, minTotal: 6, theme: 'Météo' },
    A77B: { total: 1, correct: 1, minTotal: 5, theme: 'Météo' },
    U89B: { total: 1, correct: 1, minTotal: 4, theme: 'Pilotage' },
    U75B: { total: 1, correct: 1, minTotal: 4, theme: 'Pilotage' },
    E74B: { total: 1, correct: 0, minTotal: 4, theme: 'Mécavol' },
    P4BM: { total: 1, correct: 1, minTotal: 6, theme: 'Milieu naturel' },
    L14B: { total: 1, correct: 1, minTotal: 4, theme: 'Matériel' },
    S73B: { total: 1, correct: 1, minTotal: 6, theme: 'Réglementation' },
    A60B: { total: 1, correct: 1, minTotal: 6, theme: 'Météo' },
    A57B: { total: 1, correct: 1, minTotal: 5, theme: 'Météo' },
    F5B: { total: 1, correct: 1, minTotal: 4, theme: 'Facteurs humains' },
    S47B: { total: 1, correct: 1, minTotal: 5, theme: 'Réglementation' },
    N23B: { total: 1, correct: 1, minTotal: 4, theme: 'Matériel' },
    P8BM: { total: 1, correct: 1, minTotal: 7, theme: 'Milieu naturel' },
    E40B: { total: 1, correct: 0, minTotal: 5, theme: 'Mécavol' },
    G22B: { total: 1, correct: 0, minTotal: 3, theme: 'Mécavol' },
    W43B: { total: 1, correct: 0, minTotal: 3, theme: 'Pilotage' },
    U18B: { total: 1, correct: 1, minTotal: 3, theme: 'Pilotage' },
    F13BM: { total: 1, correct: 1, minTotal: 5, theme: 'Facteurs humains' },
    U66B: { total: 1, correct: 1, minTotal: 3, theme: 'Pilotage' },
    A71B: { total: 1, correct: 1, minTotal: 5, theme: 'Météo' },
    U31B: { total: 1, correct: 0, minTotal: 4, theme: 'Pilotage' },
    P18BM: { total: 1, correct: 1, minTotal: 6, theme: 'Milieu naturel' },
    A72B: { total: 1, correct: 1, minTotal: 5, theme: 'Météo' },
    E55B: { total: 1, correct: 0, minTotal: 4, theme: 'Mécavol' },
    S84B: { total: 1, correct: 1, minTotal: 4, theme: 'Réglementation' },
    E68B: { total: 1, correct: 1, minTotal: 5, theme: 'Mécavol' },
    N59B: { total: 1, correct: 1, minTotal: 3, theme: 'Matériel' },
    E19B: { total: 1, correct: 1, minTotal: 4, theme: 'Mécavol' },
    G25B: { total: 1, correct: 0, minTotal: 5, theme: 'Mécavol' },
    A35B: { total: 1, correct: 1, minTotal: 4, theme: 'Météo' },
    F22VBM: { total: 1, correct: 1, minTotal: 18, theme: 'Facteurs humains' },
    U63B: { total: 1, correct: 1, minTotal: 4, theme: 'Pilotage' },
    A13B: { total: 1, correct: 1, minTotal: 4, theme: 'Météo' },
    P2BM: { total: 1, correct: 1, minTotal: 7, theme: 'Milieu naturel' },
    W28B: { total: 1, correct: 1, minTotal: 3, theme: 'Pilotage' },
    S77B: { total: 1, correct: 1, minTotal: 4, theme: 'Réglementation' },
    N4B: { total: 1, correct: 1, minTotal: 6, theme: 'Matériel' },
    F16VBM: { total: 1, correct: 1, minTotal: 12, theme: 'Facteurs humains' },
    L15B: { total: 1, correct: 1, minTotal: 6, theme: 'Matériel' },
    P26BM: { total: 1, correct: 1, minTotal: 7, theme: 'Milieu naturel' },
    W30B: { total: 1, correct: 1, minTotal: 5, theme: 'Pilotage' },
    A94B: { total: 1, correct: 1, minTotal: 6, theme: 'Météo' },
    W40B: { total: 1, correct: 1, minTotal: 4, theme: 'Pilotage' },
    A103B: { total: 1, correct: 1, minTotal: 3, theme: 'Météo' },
    E17B: { total: 1, correct: 0, minTotal: 6, theme: 'Mécavol' },
    S100B: { total: 1, correct: 0, minTotal: 3, theme: 'Réglementation' },
    E38B: { total: 1, correct: 1, minTotal: 4, theme: 'Mécavol' },
});

/**
 * Corrections ponctuelles autonomes (ne nécessitent ni le CSV ni l'historique d'examens pour agir
 * dès la synchronisation initiale au démarrage).
 */
export const STATS_HOTFIXES = Object.freeze([
    Object.freeze({
        id: 'exam-double-replay:exam_1794000732892',
        examId: 'exam_1794000732892',
        questions: EXAM_1794000732892_QUESTIONS,
    }),
]);

function examResultCode(r) {
    if (!r) return '';
    const raw =
        r.question && typeof r.question === 'object'
            ? r.question.code || r.question.id
            : r.code || r.questionCode || (typeof r.question === 'string' ? r.question : '');
    return String(raw || '').trim();
}

/**
 * Construit la correction qui retire une fois les réponses d'un examen.
 * @param {string} id
 * @param {any} exam
 * @param {(code: string) => any} [questionLookup]
 */
export function buildExamRemovalCorrection(id, exam, questionLookup) {
    const questions = {};
    for (const r of Array.isArray(exam?.results) ? exam.results : []) {
        const code = examResultCode(r);
        if (!code) continue;
        const q = (typeof questionLookup === 'function' && questionLookup(code)) || null;
        const entry = questions[code] || { total: 0, correct: 0, theme: q?.theme || r.theme || '' };
        entry.total += 1;
        if (r.isCorrect) entry.correct += 1;
        questions[code] = entry;
    }
    return { id, questions };
}

function trailingStreak(recent) {
    let s = 0;
    for (let i = recent.length - 1; i >= 0 && recent[i] === 1; i--) s++;
    return s;
}

/**
 * Applique une correction à une copie des statistiques (modifiée en place).
 *
 * La fenêtre `recent` ne perd sa dernière réponse que si elle est plus longue que ce que permet le
 * total corrigé : quand la fenêtre était déjà pleine, la réponse en trop a poussé dehors une réponse
 * plus ancienne qu'on ne peut pas reconstituer.
 * @returns {boolean} true si quelque chose a changé
 */
export function applyStatsCorrection(stats, correction) {
    if (!stats || !correction || !correction.questions) return false;
    if (!stats.questions) stats.questions = {};
    if (!stats.themes) stats.themes = {};
    let changed = false;

    for (const [code, delta] of Object.entries(correction.questions)) {
        const qStat = stats.questions[code];
        if (!qStat) continue;
        const dTotal = Number(delta?.total) || 0;
        const dCorrect = Number(delta?.correct) || 0;
        const minTotal = Number(delta?.minTotal) || 0;
        if (minTotal > 0 && (qStat.total || 0) < minTotal) continue;

        qStat.total = Math.max(0, (qStat.total || 0) - dTotal);
        qStat.correct = Math.min(qStat.total, Math.max(0, (qStat.correct || 0) - dCorrect));
        if (Array.isArray(qStat.recent)) {
            for (let i = 0; i < dTotal && qStat.recent.length > Math.min(qStat.total, MASTERY_WINDOW); i++) {
                qStat.recent.pop();
            }
            qStat.streak = trailingStreak(qStat.recent);
        }
        changed = true;

        const tStat = delta?.theme ? stats.themes[delta.theme] : null;
        if (tStat) {
            tStat.total = Math.max(0, (tStat.total || 0) - dTotal);
            tStat.correct = Math.min(tStat.total, Math.max(0, (tStat.correct || 0) - dCorrect));
        }
        if (typeof stats.totalQuestions === 'number') {
            stats.totalQuestions = Math.max(0, stats.totalQuestions - dTotal);
        }
        if (typeof stats.totalCorrect === 'number') {
            stats.totalCorrect = Math.min(stats.totalQuestions ?? Infinity, Math.max(0, stats.totalCorrect - dCorrect));
        }
    }
    return changed;
}

/**
 * Applique à `stats` les corrections de `corrections` qu'elle n'a pas encore reçues, et les y
 * enregistre. Idempotent.
 * @returns {boolean} true si `stats` a changé
 */
export function applyPendingCorrections(stats, corrections = stats?.corrections) {
    if (!stats || !Array.isArray(corrections) || corrections.length === 0) return false;
    const applied = new Set((stats.appliedCorrections || []).map(String));
    const known = new Map((stats.corrections || []).map((c) => [String(c.id), c]));
    let changed = false;
    for (const correction of corrections) {
        if (!correction || !correction.id) continue;
        const id = String(correction.id);
        if (!known.has(id)) {
            known.set(id, correction);
            changed = true;
        }
        if (applied.has(id)) continue;
        applyStatsCorrection(stats, correction);
        applied.add(id);
        changed = true;
    }
    if (changed) {
        stats.corrections = Array.from(known.values());
        stats.appliedCorrections = Array.from(applied);
    }
    return changed;
}

/** Union des corrections de plusieurs copies (par identifiant). */
export function unionCorrections(...lists) {
    const map = new Map();
    for (const list of lists) {
        for (const c of Array.isArray(list) ? list : []) {
            if (c && c.id && !map.has(String(c.id))) map.set(String(c.id), c);
        }
    }
    return Array.from(map.values());
}

/**
 * Applique les corrections ponctuelles connues (`STATS_HOTFIXES`) et toute correction en attente
 * sur `stats`. Autonome : fonctionne dès l'initialisation Firebase avant même le chargement du CSV.
 * @returns {boolean} true si `stats` a changé
 */
export function healQcmStats(stats, hotfixes = STATS_HOTFIXES) {
    if (!stats || typeof stats !== 'object') return false;
    let changed = applyPendingCorrections(stats, stats.corrections);
    const appliedCorrections = new Set((stats.appliedCorrections || []).map(String));
    const appliedExams = new Set((stats.appliedExamIds || []).map(String));

    for (const fix of hotfixes) {
        if (!fix || !fix.id || appliedCorrections.has(String(fix.id))) continue;
        const hasExam = !fix.examId || appliedExams.has(String(fix.examId));
        const hasDoubledQuestions =
            fix.questions &&
            Object.entries(fix.questions).every(([code, d]) => {
                const q = stats.questions?.[code];
                return q && (q.total || 0) >= (d.minTotal || 1);
            });
        if (!hasExam && !hasDoubledQuestions) continue;

        applyStatsCorrection(stats, fix);
        appliedCorrections.add(String(fix.id));
        stats.appliedCorrections = Array.from(appliedCorrections);
        changed = true;
    }
    return changed;
}
