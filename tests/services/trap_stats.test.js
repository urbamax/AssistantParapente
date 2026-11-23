import { describe, it, expect } from 'vitest';
import { countTrapFalls } from '../../js/services/trap_stats.js';
import { encodeAnswerLog } from '../../js/services/answer_log.js';

// Spec 064 : chutes et rencontres par type de piège, à partir du journal des réponses.
const Q = (code, pts) => ({ code, choices: pts.map((p, i) => ({ text: `c${i}`, pts: p })) });
const log = (...masks) => ({ answers: encodeAnswerLog(masks.map((m, i) => [20000 + i, m])) });

const questions = [Q('A1B', [3, -6, 3]), Q('A2B', [-6, 6]), Q('A3B', [2, -6])];
const types = {
    A1B: [
        { type: 'absolu', choices: [1] },
        { type: 'un_mot', choices: [0, 2] },
    ],
    A2B: [{ type: 'absolu', choices: [0] }],
    A3B: [{ type: 'valeur', choices: [1] }],
};

describe('countTrapFalls (spec 064)', () => {
    it('counts encounters and falls per type from the answer log', () => {
        const stats = {
            // A1B : 1re réponse coche le piège (choix 1) et oublie le choix 2 ; 2e réponse parfaite.
            A1B: log(0b011, 0b101),
            // A2B : coche le choix 0 (piège absolu).
            A2B: log(0b001),
        };
        const rows = countTrapFalls(questions, stats, types);
        expect(rows).toEqual([
            { type: 'absolu', falls: 2, encounters: 3 },
            { type: 'un_mot', falls: 1, encounters: 2 },
        ]);
    });

    it('treats a positive touched choice left unticked as a fall', () => {
        const rows = countTrapFalls(questions, { A1B: log(0b001) }, types);
        expect(rows.find((r) => r.type === 'un_mot')).toEqual({ type: 'un_mot', falls: 1, encounters: 1 });
        expect(rows.find((r) => r.type === 'absolu')).toEqual({ type: 'absolu', falls: 0, encounters: 1 });
    });

    it('sorts by falls, then by fall rate', () => {
        const rows = countTrapFalls(questions, { A2B: log(0b010, 0b010), A3B: log(0b10) }, types);
        expect(rows.map((r) => r.type)).toEqual(['valeur', 'absolu']);
    });

    it('only counts the given questions and ignores missing data', () => {
        expect(countTrapFalls([questions[0]], { A2B: log(0b001) }, types)).toEqual([]);
        expect(countTrapFalls(questions, null, types)).toEqual([]);
        expect(countTrapFalls(questions, { A1B: log(0b011) }, null)).toEqual([]);
    });
});
