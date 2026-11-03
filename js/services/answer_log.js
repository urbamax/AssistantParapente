/**
 * SERVICE - Journal des réponses
 * Module pur (aucun accès au stockage ni au DOM).
 *
 * Pour chaque question, on garde les dernières réponses sous la forme `[jour, masque]` :
 * `jour` est le nombre de jours depuis 1970 (UTC), `masque` a le bit i à 1 si le choix i
 * (position dans `question.choices`) était coché. Les compteurs `pickedChoices` disent combien
 * de fois un piège a été coché ; ce journal dit quand, et si la réponse suivante l'a évité.
 * Tableau plat de petits entiers : sérialisable par Firestore, quelques dizaines d'octets par question.
 */

import { DAY_MS } from './review_scheduler.js';

/** Nombre de réponses conservées par question. */
export const ANSWER_LOG_SIZE = 6;

/** @param {number} [now] */
export function dayNumber(now = Date.now()) {
    return Math.floor(now / DAY_MS);
}

/**
 * @param {{ choices?: any[] }} question
 * @param {any[]} selected choix cochés (objets de `question.choices`)
 * @returns {number}
 */
export function pickMask(question, selected) {
    const choices = question.choices || [];
    let mask = 0;
    for (const choice of selected || []) {
        const idx = choices.indexOf(choice);
        if (idx >= 0) mask |= 1 << idx;
    }
    return mask;
}

/** @param {unknown} v */
function isEntry(v) {
    return Array.isArray(v) && v.length === 2 && Number.isInteger(v[0]) && Number.isInteger(v[1]);
}

/**
 * @param {unknown} log
 * @returns {Array<[number, number]>}
 */
export function readAnswerLog(log) {
    return Array.isArray(log) ? log.filter(isEntry).map((e) => [e[0], e[1]]) : [];
}

/**
 * Ajoute une réponse et renvoie le journal borné aux `ANSWER_LOG_SIZE` plus récentes.
 * @param {unknown} log
 * @param {number} mask
 * @param {number} [now]
 */
export function appendAnswer(log, mask, now = Date.now()) {
    return [...readAnswerLog(log), [dayNumber(now), mask]].slice(-ANSWER_LOG_SIZE);
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
    return entries;
}

/**
 * Fusionne deux journaux (appareil local et cloud). Comme pour les autres compteurs, additionner
 * compterait deux fois les réponses déjà synchronisées : pour chaque couple (jour, masque) on garde
 * le plus grand nombre d'occurrences vu d'un côté ou de l'autre.
 * @param {unknown} a
 * @param {unknown} b
 * @returns {Array<[number, number]>}
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
    return out.sort((x, y) => x[0] - y[0]).slice(-ANSWER_LOG_SIZE);
}
