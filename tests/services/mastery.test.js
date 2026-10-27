import { describe, it, expect } from 'vitest';
import {
    MASTERY_WINDOW,
    recentAttempts,
    pushAttempt,
    masteryRatio,
    masteryRatioAfterCorrect,
    successRate,
} from '../../js/services/mastery.js';

describe('mastery (fenêtre glissante)', () => {
    it('is 0 for a question never attempted', () => {
        expect(masteryRatio(undefined)).toBe(0);
        expect(masteryRatio({ total: 0, correct: 0 })).toBe(0);
    });

    it('uses the recorded recent answers when they exist', () => {
        expect(masteryRatio({ total: 40, correct: 20, recent: [0, 1, 1, 1] })).toBe(0.3);
    });

    it('is not 100 % before a full cycle of MASTERY_WINDOW correct answers', () => {
        expect(masteryRatio({ total: 2, correct: 2, recent: [1, 1] })).toBe(0.2);
        expect(masteryRatio({ total: 9, correct: 9, recent: Array(9).fill(1) })).toBe(0.9);
        expect(masteryRatio({ total: 10, correct: 10, recent: Array(10).fill(1) })).toBe(1);
    });

    it('successRate only looks at the attempts actually made', () => {
        expect(successRate(undefined)).toBe(0);
        expect(successRate({ total: 2, correct: 2, recent: [1, 1] })).toBe(1);
        expect(successRate({ total: 40, correct: 20, recent: [0, 1, 1, 1] })).toBe(0.75);
    });

    it('an old mistake leaves the window after MASTERY_WINDOW correct answers in a row', () => {
        let stat = { total: 1, correct: 0, streak: 0, recent: [0] };
        for (let i = 1; i < MASTERY_WINDOW; i++) {
            stat = { ...stat, recent: pushAttempt(stat, true) };
            expect(masteryRatio(stat)).toBeLessThan(1);
        }
        stat = { ...stat, recent: pushAttempt(stat, true) };
        expect(stat.recent).toHaveLength(MASTERY_WINDOW);
        expect(masteryRatio(stat)).toBe(1);
    });

    it('a mistake costs a question its 100 % again', () => {
        const full = { total: 12, correct: 12, recent: Array(MASTERY_WINDOW).fill(1) };
        expect(masteryRatio({ ...full, recent: pushAttempt(full, false) })).toBe(0.9);
    });

    it('reconstructs a plausible window for stats recorded before `recent` existed', () => {
        // jamais d'erreur : tout juste
        expect(masteryRatio({ total: 3, correct: 3, streak: 0 })).toBe(0.3);
        expect(masteryRatio({ total: 40, correct: 40, streak: 40 })).toBe(1);
        // une erreur juste avant la série en cours de 4 : 9 juste sur 10
        const recent = recentAttempts({ total: 5, correct: 4, streak: 4 });
        expect(recent).toEqual([0, 1, 1, 1, 1]);
        // série de 2 après des erreurs plus anciennes : la réponse juste avant la série est fausse
        const mixed = recentAttempts({ total: 20, correct: 10, streak: 2 });
        expect(mixed).toHaveLength(MASTERY_WINDOW);
        expect(mixed.slice(-2)).toEqual([1, 1]);
        expect(mixed[MASTERY_WINDOW - 3]).toBe(0);
    });

    it('never builds a window longer than MASTERY_WINDOW', () => {
        expect(recentAttempts({ total: 500, correct: 400, streak: 3 })).toHaveLength(MASTERY_WINDOW);
        expect(pushAttempt({ total: 12, correct: 12, recent: Array(MASTERY_WINDOW).fill(1) }, true)).toHaveLength(
            MASTERY_WINDOW,
        );
    });

    it('masteryRatioAfterCorrect simulates further correct answers without changing the stat', () => {
        const stat = { total: 2, correct: 1, recent: [0, 1] };
        expect(masteryRatioAfterCorrect(stat)).toBeCloseTo(0.2);
        expect(masteryRatioAfterCorrect(stat, 2)).toBeCloseTo(0.3);
        expect(stat.recent).toEqual([0, 1]);
    });
});
