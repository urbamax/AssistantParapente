/**
 * SERVICE - Journal des réponses
 * Module pur (aucun accès au stockage ni au DOM).
 *
 * Pour chaque question, on garde les dernières réponses sous la forme `[jour, masque]` :
 * `jour` est le nombre de jours depuis 1970 (UTC), `masque` a le bit i à 1 si le choix i
 * (position dans les choix du CSV) était coché.
 *
 * Stockage : Firestore refuse les tableaux imbriqués, donc chaque réponse est enregistrée comme un
 * seul entier `jour * 1024 + masque` dans un tableau plat. En mémoire on manipule des couples
 * `[jour, masque]` (`readAnswerLog`) ; les couples de la première version du journal restent lisibles. Les compteurs `choicePicks` disent combien
 * de fois un piège a été coché ; ce journal dit quand, et si la réponse suivante l'a évité.
 * Tableau plat de petits entiers : sérialisable par Firestore, quelques dizaines d'octets par question.
 */

import { DAY_MS } from './review_scheduler.js';

/** Nombre de réponses conservées par question. */
export const ANSWER_LOG_SIZE = 6;

/** Un masque tient sur 10 bits (5 choix au plus dans le QCM) : l'entier stocké est `jour * 1024 + masque`. */
const MASK_SPACE = 1024;

/** @param {number} [now] */
export function dayNumber(now = Date.now()) {
    return Math.floor(now / DAY_MS);
}

/**
 * Position d'un choix dans les choix de la question telle qu'elle est dans le CSV. Les choix sont
 * mélangés à chaque séance : `question` doit être la question d'origine, jamais la copie mélangée,
 * sinon l'index changerait d'une séance à l'autre. Repli sur le texte si l'objet n'est pas le même.
 * @param {{ choices?: any[] }} question
 * @param {any} choice
 */
export function choiceIndex(question, choice) {
    const choices = question.choices || [];
    const idx = choices.indexOf(choice);
    if (idx >= 0 || !choice || typeof choice.text !== 'string') return idx;
    return choices.findIndex((c) => c && c.text === choice.text);
}

/**
 * @param {{ choices?: any[] }} question question d'origine (ordre du CSV)
 * @param {any[]} selected choix cochés
 * @returns {number}
 */
export function pickMask(question, selected) {
    let mask = 0;
    for (const choice of selected || []) {
        const idx = choiceIndex(question, choice);
        if (idx >= 0) mask |= 1 << idx;
    }
    return mask;
}

/** @param {unknown} v */
function isPair(v) {
    return Array.isArray(v) && v.length === 2 && Number.isInteger(v[0]) && Number.isInteger(v[1]);
}

/**
 * Journal stocké -> couples `[jour, masque]`. Les entrées illisibles sont ignorées.
 * @param {unknown} log
 * @returns {Array<[number, number]>}
 */
export function readAnswerLog(log) {
    if (!Array.isArray(log)) return [];
    /** @type {Array<[number, number]>} */
    const out = [];
    for (const e of log) {
        if (Number.isInteger(e) && e >= 0) out.push([Math.floor(e / MASK_SPACE), e % MASK_SPACE]);
        else if (isPair(e)) out.push([e[0], e[1]]);
    }
    return out;
}

/**
 * Couples `[jour, masque]` -> journal à stocker (tableau plat d'entiers, compatible Firestore).
 * @param {Array<[number, number]>} entries
 * @returns {number[]}
 */
export function encodeAnswerLog(entries) {
    return entries.map(([day, mask]) => day * MASK_SPACE + (mask % MASK_SPACE));
}

/**
 * Ajoute une réponse et renvoie le journal borné aux `ANSWER_LOG_SIZE` plus récentes.
 * @param {unknown} log
 * @param {number} mask
 * @param {number} [now]
 * @returns {number[]}
 */
export function appendAnswer(log, mask, now = Date.now()) {
    /** @type {Array<[number, number]>} */
    const entries = [...readAnswerLog(log), [dayNumber(now), mask]];
    return encodeAnswerLog(entries.slice(-ANSWER_LOG_SIZE));
}

/**
 * Retire la dernière réponse de masque `mask` (examen : réponse corrigée). Sans effet si elle
 * n'est plus dans le journal.
 * @param {unknown} log
 * @param {number} mask
 */
export function removeLastAnswer(log, mask) {
    const entries = readAnswerLog(log);
    for (let i = entries.length - 1; i >= 0; i--) {
        if (entries[i][1] === mask) {
            entries.splice(i, 1);
            break;
        }
    }
    return encodeAnswerLog(entries);
}

/**
 * Fusionne deux journaux (appareil local et cloud). Comme pour les autres compteurs, additionner
 * compterait deux fois les réponses déjà synchronisées : pour chaque couple (jour, masque) on garde
 * le plus grand nombre d'occurrences vu d'un côté ou de l'autre.
 * @param {unknown} a
 * @param {unknown} b
 * @returns {number[]}
 */
export function mergeAnswerLogs(a, b) {
    const count = (entries) => {
        const map = new Map();
        for (const [d, m] of entries) map.set(`${d}:${m}`, (map.get(`${d}:${m}`) || 0) + 1);
        return map;
    };
    const ea = readAnswerLog(a);
    const eb = readAnswerLog(b);
    const ca = count(ea);
    const cb = count(eb);
    const out = [];
    for (const key of new Set([...ca.keys(), ...cb.keys()])) {
        const [d, m] = key.split(':').map(Number);
        const n = Math.max(ca.get(key) || 0, cb.get(key) || 0);
        for (let i = 0; i < n; i++) out.push([d, m]);
    }
    return encodeAnswerLog(out.sort((x, y) => x[0] - y[0]).slice(-ANSWER_LOG_SIZE));
}

/**
 * Remet à plat les journaux enregistrés par la première version (couples `[jour, masque]`), que
 * Firestore refuse. Modifie `stats` en place ; renvoie `true` si quelque chose a changé.
 * @param {{ questions?: Record<string, any> } | null | undefined} stats
 */
export function flattenAnswerLogs(stats) {
    let changed = false;
    for (const q of Object.values(stats?.questions || {})) {
        if (q && Array.isArray(q.answers) && q.answers.some((e) => typeof e !== 'number')) {
            q.answers = encodeAnswerLog(readAnswerLog(q.answers));
            changed = true;
        }
    }
    return changed;
}
