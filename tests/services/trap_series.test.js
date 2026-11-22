import { describe, it, expect } from 'vitest';
import { orderTrapSeries } from '../../js/services/trap_series.js';

// Spec 063 : série « Questions à piège », les erreurs d'abord, puis l'inédit, puis le reste.
const Q = (code) => ({ code });
const identity = (a) => [...a];
const reverse = (a) => [...a].reverse();

describe('orderTrapSeries (spec 063)', () => {
    const questions = ['A', 'B', 'C', 'D', 'E', 'F'].map(Q);
    const stats = {
        A: { total: 3, correct: 3, streak: 3 }, // réussie
        B: { total: 2, correct: 1, streak: 0 }, // ratée, pas réussie depuis
        C: { total: 2, correct: 1, streak: 1 }, // ratée puis réussie : plus « ratée »
        E: { total: 1, correct: 0, streak: 0 }, // ratée
        F: { total: 0, correct: 0, streak: 0 }, // jamais tentée (entrée vide)
    };

    it('puts missed questions first, never-attempted next, the rest last', () => {
        const codes = orderTrapSeries(questions, stats, identity).map((q) => q.code);
        expect(codes.slice(0, 2).sort()).toEqual(['B', 'E']);
        expect(codes.slice(2, 4).sort()).toEqual(['D', 'F']);
        expect(codes.slice(4).sort()).toEqual(['A', 'C']);
    });

    it('keeps every question exactly once', () => {
        const codes = orderTrapSeries(questions, stats, identity).map((q) => q.code);
        expect([...codes].sort()).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
    });

    it('shuffles inside each group with the given function', () => {
        const codes = orderTrapSeries(questions, stats, reverse).map((q) => q.code);
        expect(codes).toEqual(['E', 'B', 'F', 'D', 'C', 'A']);
    });

    it('treats every question as never attempted without statistics', () => {
        expect(orderTrapSeries(questions, null, identity).map((q) => q.code)).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
        expect(orderTrapSeries([], stats, identity)).toEqual([]);
    });
});
