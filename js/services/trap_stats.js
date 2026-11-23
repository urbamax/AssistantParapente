/**
 * SERVICE - Pièges par type (spec 064)
 * Module pur. Compte, pour chaque type de piège, les rencontres (réponses à une question qui porte un
 * piège de ce type) et les chutes (dans une de ces réponses, un choix touché par le piège a été mal
 * traité : choix négatif coché ou choix positif oublié). Les positions des choix sont celles du CSV
 * officiel, comme dans le journal des réponses.
 */
import { readAnswerLog } from './answer_log.js';

/** Types montrés à l'élève (« autre » reste interne). */
export const LEARNER_TRAP_TYPES = Object.freeze([
    'absolu',
    'un_mot',
    'cadre',
    'inversion',
    'vrai_hors_sujet',
    'valeur',
]);

/**
 * @param {Array<{ code: string, choices?: Array<{ pts: number }> }>} questions questions retenues (niveau)
 * @param {Record<string, { answers?: unknown }> | null | undefined} statsByCode statistiques par code
 * @param {Record<string, Array<{ type: string, choices: number[] }>> | null | undefined} trapTypes
 * @returns {Array<{ type: string, falls: number, encounters: number }>} types rencontrés, triés
 */
export function countTrapFalls(questions, statsByCode, trapTypes) {
    if (!statsByCode || !trapTypes) return [];
    /** @type {Map<string, { type: string, falls: number, encounters: number }>} */
    const byType = new Map();
    for (const q of questions || []) {
        const traps = trapTypes[q.code];
        const log = readAnswerLog(statsByCode[q.code]?.answers);
        if (!traps || !traps.length || !log.length) continue;
        const choices = q.choices || [];
        for (const trap of traps) {
            if (!LEARNER_TRAP_TYPES.includes(trap.type)) continue;
            const row = byType.get(trap.type) || { type: trap.type, falls: 0, encounters: 0 };
            for (const [, mask] of log) {
                row.encounters += 1;
                const fell = trap.choices.some((i) => {
                    const pts = Number(choices[i]?.pts) || 0;
                    const ticked = (mask & (1 << i)) !== 0;
                    return (pts < 0 && ticked) || (pts > 0 && !ticked);
                });
                if (fell) row.falls += 1;
            }
            byType.set(trap.type, row);
        }
    }
    const rate = (r) => (r.encounters ? r.falls / r.encounters : 0);
    return [...byType.values()].sort(
        (a, b) =>
            b.falls - a.falls ||
            rate(b) - rate(a) ||
            LEARNER_TRAP_TYPES.indexOf(a.type) - LEARNER_TRAP_TYPES.indexOf(b.type),
    );
}
