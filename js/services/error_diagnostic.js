// @ts-check
/**
 * SERVICE - Diagnostic des erreurs (pièges et fausses croyances)
 * Module pur (aucun accès au stockage ni au DOM).
 *
 * Un « piège » est un choix à points négatifs que le pilote a coché au moins une fois. À partir des
 * compteurs `pickedChoices` et du journal daté `answers` (voir answer_log.js), on donne à chaque
 * piège un statut. Rien n'est jamais effacé : un piège surmonté garde son historique et redevient
 * actif s'il est recoché (rechute).
 *
 *  - `active`        : coché récemment, pas encore confirmé par des réussites ;
 *  - `consolidating` : au moins 2 réponses entièrement justes depuis, mais pas assez étalées dans le temps ;
 *  - `overcome`      : au moins 3 réponses justes sur 2 jours différents, la dernière à 7 jours ou plus du dernier piège.
 */
import { readAnswerLog } from './answer_log.js';

export const TRAP_THRESHOLDS = Object.freeze({
    consolidatingClean: 2,
    overcomeClean: 3,
    overcomeCleanDays: 2,
    overcomeGapDays: 7,
});

/** @typedef {'active' | 'consolidating' | 'overcome'} TrapStatus */

/** Ordre d'affichage : le plus urgent d'abord. */
export const TRAP_STATUS_RANK = Object.freeze({ active: 0, consolidating: 1, overcome: 2 });

const SOURCE_LINE = /^aucune source trouv/i;

/**
 * Découpe l'explication d'une question en un paragraphe par choix, dans l'ordre des choix.
 * Renvoie `null` pour chaque choix quand le découpage n'est pas fiable (nombre de paragraphes
 * différent du nombre de choix) : l'appelant affiche alors l'explication entière.
 *
 * @param {{ choices?: any[], explication?: string } | undefined} question
 * @returns {Array<string | null>}
 */
export function splitOptionExplanations(question) {
    const choices = question?.choices || [];
    const raw = typeof question?.explication === 'string' ? question.explication : '';
    let parts = raw
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
    if (parts.length === choices.length + 1 && SOURCE_LINE.test(parts[parts.length - 1])) {
        parts = parts.slice(0, -1);
    }
    if (choices.length === 0 || parts.length !== choices.length) return choices.map(() => null);
    return parts;
}

/**
 * Réponse entièrement juste : toutes les bonnes réponses cochées, aucun choix négatif coché.
 * @param {number} mask
 * @param {Array<{ pts: number }>} choices
 */
export function isFullyCorrectMask(mask, choices) {
    return choices.every((c, i) => {
        const ticked = Boolean((mask >> i) & 1);
        if (c.pts > 0) return ticked;
        if (c.pts < 0) return !ticked;
        return true;
    });
}

/**
 * Nombre de réponses justes dans `entries`, jours distincts et écart (en jours) entre le dernier
 * piège et la dernière réponse juste.
 * @param {Array<[number, number]>} entries
 * @param {Array<{ pts: number }>} choices
 * @param {number | null} pickDay
 */
function summarizeClean(entries, choices, pickDay) {
    const clean = entries.filter((e) => isFullyCorrectMask(e[1], choices));
    const days = new Set(clean.map((e) => e[0]));
    const last = clean.length ? clean[clean.length - 1][0] : null;
    const gap = last !== null && pickDay !== null ? last - pickDay : 0;
    return { count: clean.length, days: days.size, gap };
}

/** @param {{ count: number, days: number, gap: number }} s */
function isOvercome(s) {
    return (
        s.count >= TRAP_THRESHOLDS.overcomeClean &&
        s.days >= TRAP_THRESHOLDS.overcomeCleanDays &&
        s.gap >= TRAP_THRESHOLDS.overcomeGapDays
    );
}

/**
 * Statut du piège `index` d'après le journal des réponses.
 * @param {Array<[number, number]>} log
 * @param {number} index
 * @param {Array<{ pts: number }>} choices
 * @returns {{ status: TrapStatus, relapse: boolean, lastPickedDay: number | null, cleanSince: number }}
 */
export function computeTrapStatus(log, index, choices) {
    const picked = (e) => Boolean((e[1] >> index) & 1);
    /** @type {number[]} */
    const pickIdx = [];
    log.forEach((e, k) => {
        if (picked(e)) pickIdx.push(k);
    });
    const last = pickIdx.length ? pickIdx[pickIdx.length - 1] : -1;
    // Dernier piège sorti du journal : on prend le début du journal comme borne basse de sa date.
    const lastPickedDay = last >= 0 ? log[last][0] : null;
    const pickDay = lastPickedDay ?? (log.length ? log[0][0] : null);

    const since = summarizeClean(log.slice(last + 1), choices, pickDay);
    /** @type {TrapStatus} */
    let status = 'active';
    if (isOvercome(since)) status = 'overcome';
    else if (since.count >= TRAP_THRESHOLDS.consolidatingClean) status = 'consolidating';
    else if (last === -1 && log.length > 0) status = 'consolidating';

    let relapse = false;
    if (status === 'active' && pickIdx.length >= 2) {
        const prev = pickIdx[pickIdx.length - 2];
        const between = summarizeClean(log.slice(prev + 1, last), choices, log[prev][0]);
        relapse = isOvercome(between);
    }
    return { status, relapse, lastPickedDay, cleanSince: since.count };
}

/**
 * @typedef {{
 *   choiceIndex: number, text: string, pts: number, count: number,
 *   status: TrapStatus, relapse: boolean, lastPickedDay: number | null, cleanSince: number,
 *   explanation: string | null,
 * }} Trap
 */

/** @param {Trap} a @param {Trap} b */
function compareTraps(a, b) {
    return (
        TRAP_STATUS_RANK[a.status] - TRAP_STATUS_RANK[b.status] ||
        Number(b.relapse) - Number(a.relapse) ||
        b.count - a.count ||
        (b.lastPickedDay ?? 0) - (a.lastPickedDay ?? 0)
    );
}

/**
 * Pièges d'une question : choix à points négatifs déjà cochés, du plus urgent au moins urgent.
 *
 * @param {{ code?: string, choices?: any[], explication?: string }} question
 * @param {{ pickedChoices?: number[], answers?: unknown } | undefined} qStat
 * @returns {{ code: string, traps: Trap[], hasActive: boolean }}
 */
export function diagnoseQuestionErrors(question, qStat) {
    const choices = question?.choices || [];
    const log = readAnswerLog(qStat?.answers);
    const counts = Array.isArray(qStat?.pickedChoices) ? qStat.pickedChoices : [];
    const explanations = splitOptionExplanations(question);

    /** @type {Trap[]} */
    const traps = [];
    choices.forEach((choice, index) => {
        if (!(choice.pts < 0)) return;
        const logged = log.filter((e) => (e[1] >> index) & 1).length;
        const count = Math.max(Number(counts[index]) || 0, logged);
        if (count === 0) return;
        traps.push({
            choiceIndex: index,
            text: choice.text,
            pts: choice.pts,
            count,
            ...computeTrapStatus(log, index, choices),
            explanation: explanations[index] ?? null,
        });
    });
    traps.sort(compareTraps);
    return { code: String(question?.code ?? ''), traps, hasActive: traps.some((t) => t.status === 'active') };
}

/** @param {Record<string, any> | undefined} stats */
function questionStats(stats) {
    if (!stats || typeof stats !== 'object') return {};
    return stats.questions && typeof stats.questions === 'object' ? stats.questions : stats;
}

/**
 * Pièges les plus urgents sur l'ensemble des questions.
 *
 * @param {any[]} questions
 * @param {Record<string, any>} stats
 * @param {{ limit?: number, statuses?: TrapStatus[], axisOf?: (q: any) => string | null }} [options]
 */
export function getTopTraps(questions, stats, options = {}) {
    const limit = options.limit ?? 5;
    const statuses = new Set(options.statuses ?? ['active', 'consolidating']);
    const map = questionStats(stats);
    /** @type {Array<Trap & { code: string, questionText: string, axisId: string | null, fallbackExplanation: string }>} */
    const out = [];
    for (const q of Array.isArray(questions) ? questions : []) {
        const { traps } = diagnoseQuestionErrors(q, map[q.code]);
        for (const trap of traps) {
            if (!statuses.has(trap.status)) continue;
            out.push({
                ...trap,
                code: q.code,
                questionText: q.question,
                axisId: options.axisOf ? options.axisOf(q) : null,
                fallbackExplanation: q.explication || '',
            });
        }
    }
    out.sort(compareTraps);
    return out.slice(0, limit);
}

/**
 * Questions à rejouer pour dépasser leurs pièges : pièges actifs d'abord (rechutes et plus
 * fréquents en tête), puis pièges en consolidation.
 *
 * @param {any[]} questions
 * @param {Record<string, any>} stats
 * @param {{ maxQuestions?: number, axisId?: string, axisOf?: (q: any) => string | null }} [options]
 */
export function pickAntiTrapQuestions(questions, stats, options = {}) {
    const max = options.maxQuestions ?? 8;
    const map = questionStats(stats);
    const scored = [];
    for (const q of Array.isArray(questions) ? questions : []) {
        if (options.axisId && options.axisOf && options.axisOf(q) !== options.axisId) continue;
        const [top] = diagnoseQuestionErrors(q, map[q.code]).traps.filter((t) => t.status !== 'overcome');
        if (top) scored.push({ q, top });
    }
    scored.sort((a, b) => compareTraps(a.top, b.top));
    return scored.slice(0, max).map((s) => s.q);
}
