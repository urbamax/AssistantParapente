// @ts-check
/**
 * SERVICE - Diagnostic des erreurs (pièges et fausses croyances)
 * Module pur (aucun accès au stockage ni au DOM).
 *
 * Un « piège » est un choix à points négatifs que le pilote a coché au moins une fois. À partir des
 * compteurs `choicePicks` et du journal daté `answers` (voir answer_log.js), on donne à chaque
 * piège un statut. Rien n'est jamais effacé : un piège surmonté garde son historique et redevient
 * actif s'il est recoché (rechute).
 *
 *  - `active`        : coché récemment, pas encore confirmé par des réussites ;
 *  - `consolidating` : au moins 2 réponses entièrement justes depuis, mais pas assez étalées dans le temps ;
 *  - `overcome`      : au moins 3 réponses justes sur 2 jours différents, la dernière à 7 jours ou plus du dernier piège.
 */
import { choiceIndex, pickMask, readAnswerLog } from './answer_log.js';

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
 * @param {{ choicePicks?: number[], answers?: unknown } | undefined} qStat
 * @returns {{ code: string, traps: Trap[], hasActive: boolean }}
 */
export function diagnoseQuestionErrors(question, qStat) {
    const choices = question?.choices || [];
    const log = readAnswerLog(qStat?.answers);
    const counts = Array.isArray(qStat?.choicePicks) ? qStat.choicePicks : [];
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

/**
 * Ce qu'il faut dire au pilote juste après sa réponse, à partir du diagnostic de la question avant
 * et après cette réponse.
 *  - `recurrent` : pièges cochés une nouvelle fois (au moins la 2e), avec rechute éventuelle ;
 *  - `avoided`   : réponse entièrement juste alors qu'un piège actif ou en consolidation existait ;
 *  - `overcome`  : ce piège vient de passer au statut « surmonté ».
 *
 * @param {{ choices?: any[] }} question question d'origine (ordre du CSV)
 * @param {any[]} selected choix cochés
 * @param {{ traps: Trap[] }} before diagnostic avant la réponse
 * @param {{ traps: Trap[] }} after diagnostic après la réponse
 */
export function buildTrapFeedback(question, selected, before, after) {
    const choices = question?.choices || [];
    const pickedTrapIdx = (selected || [])
        .map((c) => choiceIndex(question, c))
        .filter((i) => i >= 0 && choices[i].pts < 0);
    const afterBy = new Map(after.traps.map((t) => [t.choiceIndex, t]));

    const recurrent = pickedTrapIdx
        .map((i) => afterBy.get(i))
        .filter((t) => t && t.count >= 2)
        .map((t) => ({ choiceIndex: t.choiceIndex, text: t.text, count: t.count, relapse: t.relapse }));

    const avoided = [];
    const overcome = [];
    if (isFullyCorrectMask(pickMask(question, selected), choices)) {
        for (const t of before.traps) {
            if (t.status === 'overcome') continue;
            const now = afterBy.get(t.choiceIndex);
            (now?.status === 'overcome' ? overcome : avoided).push({ choiceIndex: t.choiceIndex, text: t.text });
        }
    }
    return { recurrent, avoided, overcome };
}

/**
 * Totaux des pièges sur un ensemble de questions : combien sont actifs, en consolidation ou
 * surmontés, et dans combien de chapitres au moins un piège est actif.
 *
 * @param {any[]} questions
 * @param {Record<string, any>} stats
 * @param {(q: any) => string | null} [axisOf]
 */
export function summarizeTraps(questions, stats, axisOf) {
    const map = questionStats(stats);
    const totals = { active: 0, consolidating: 0, overcome: 0, axes: 0 };
    const axesWithActive = new Set();
    for (const q of Array.isArray(questions) ? questions : []) {
        for (const trap of diagnoseQuestionErrors(q, map[q.code]).traps) {
            totals[trap.status] += 1;
            if (trap.status === 'active') axesWithActive.add(axisOf ? axisOf(q) : q.code);
        }
    }
    totals.axes = axesWithActive.size;
    return totals;
}

/**
 * Pièges rencontrés pendant une série : réponses fausses cochées, avec le nombre de fois où chacune
 * l'a été (statistiques déjà à jour, la série comprise). Une question rejouée compte une seule fois,
 * d'après sa dernière réponse.
 *
 * @param {Array<{ question: { code: string }, selected: any[] }>} results
 * @param {(code: string) => any} originalOf question d'origine (ordre du CSV)
 * @param {Record<string, any>} stats
 * @returns {{ trapped: Array<{ code: string, count: number, status: TrapStatus, relapse: boolean }>, recurrent: number }}
 */
export function summarizeSessionTraps(results, originalOf, stats) {
    const map = questionStats(stats);
    const last = new Map();
    for (const r of Array.isArray(results) ? results : []) if (r?.question) last.set(r.question.code, r);

    /** @type {Array<{ code: string, count: number, status: TrapStatus, relapse: boolean }>} */
    const trapped = [];
    for (const [code, r] of last) {
        const original = originalOf(code);
        if (!original) continue;
        const { traps } = diagnoseQuestionErrors(original, map[code]);
        const picked = new Set((r.selected || []).map((c) => choiceIndex(original, c)));
        for (const trap of traps) {
            if (picked.has(trap.choiceIndex)) {
                trapped.push({ code, count: trap.count, status: trap.status, relapse: trap.relapse });
            }
        }
    }
    trapped.sort((a, b) => b.count - a.count);
    return { trapped, recurrent: trapped.filter((t) => t.count >= 2).length };
}
