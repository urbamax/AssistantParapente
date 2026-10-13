import { describe, it, expect } from 'vitest';
import {
    DAY_MS,
    REVIEW_INTERVALS_DAYS,
    reviewIntervalDays,
    dueScore,
    isDue,
    nextDueAt,
    summarizeReviews,
} from '../../js/services/review_scheduler.js';

const NOW = Date.UTC(2026, 9, 13, 12, 0, 0);
const daysAgo = (n) => NOW - n * DAY_MS;
// Questions réussies à chaque fois (ratio 1) : l'échéance est « intervalle + 1 jour ».
const seen = (streak, lastSeen, { total = 4, correct = 4 } = {}) => ({ total, correct, streak, lastSeen });

describe('reviewIntervalDays: the interval grows with the streak', () => {
    it('follows 0, 1, 3, 7, 14, 30 days', () => {
        expect(REVIEW_INTERVALS_DAYS).toEqual([0, 1, 3, 7, 14, 30]);
        expect([0, 1, 2, 3, 4, 5].map(reviewIntervalDays)).toEqual([0, 1, 3, 7, 14, 30]);
    });

    it('stays at 30 days beyond the last step, and treats a missing streak as 0', () => {
        expect(reviewIntervalDays(6)).toBe(30);
        expect(reviewIntervalDays(40)).toBe(30);
        expect(reviewIntervalDays(undefined)).toBe(0);
    });
});

describe('dueScore and isDue', () => {
    it('a question never seen is always first', () => {
        expect(dueScore(undefined, NOW)).toBe(Infinity);
        expect(dueScore({ total: 0, correct: 0 }, NOW)).toBe(Infinity);
        expect(isDue(undefined, NOW)).toBe(true);
    });

    it('stats recorded before lastSeen existed fall back on the 75 % success threshold', () => {
        expect(isDue({ total: 4, correct: 2 }, NOW)).toBe(true); // 50 %
        expect(isDue({ total: 4, correct: 3 }, NOW)).toBe(true); // 75 %, boundary
        expect(isDue({ total: 4, correct: 4 }, NOW)).toBe(false); // 100 %
        expect(dueScore({ total: 4, correct: 2 }, NOW)).toBeCloseTo(0.25);
    });

    it('is due once the interval (plus the success ratio, in days) has elapsed', () => {
        // streak 3 => 7 days, ratio 1 => due after 8 days
        expect(isDue(seen(3, daysAgo(8)), NOW)).toBe(true);
        expect(isDue(seen(3, daysAgo(7.5)), NOW)).toBe(false);
        expect(isDue(seen(3, daysAgo(30)), NOW)).toBe(true);
    });

    it('a mistake resets the streak, so the question comes back much sooner', () => {
        const afterMistake = seen(0, daysAgo(1), { total: 4, correct: 2 }); // interval 0, ratio 0.5
        const afterStreak = seen(3, daysAgo(1)); // interval 7
        expect(isDue(afterMistake, NOW)).toBe(true);
        expect(isDue(afterStreak, NOW)).toBe(false);
    });

    it('the more overdue a question is, the higher its score', () => {
        const late = dueScore(seen(2, daysAgo(20)), NOW);
        const slightlyLate = dueScore(seen(2, daysAgo(5)), NOW);
        expect(late).toBeGreaterThan(slightlyLate);
    });
});

describe('nextDueAt', () => {
    it('is the moment the question becomes due', () => {
        const stat = seen(3, daysAgo(2));
        const due = nextDueAt(stat);
        expect(due).toBe(stat.lastSeen + 8 * DAY_MS);
        expect(isDue(stat, due - 1)).toBe(false);
        expect(isDue(stat, due)).toBe(true);
    });

    it('is null for a question never seen and for stats without lastSeen', () => {
        expect(nextDueAt(undefined)).toBeNull();
        expect(nextDueAt({ total: 0, correct: 0 })).toBeNull();
        expect(nextDueAt({ total: 3, correct: 3 })).toBeNull();
    });
});

describe('summarizeReviews', () => {
    const questions = ['A', 'B', 'C', 'D', 'E'].map((code) => ({ code }));

    it('counts new, due and not-yet-due questions and gives the next due date', () => {
        const stats = {
            B: seen(3, daysAgo(20)), // due
            C: seen(3, daysAgo(2)), // not due, due in 6 days
            D: seen(5, daysAgo(1)), // not due, due in 30 days
            E: { total: 4, correct: 2 }, // legacy, 50 % => due
            // A: never seen
        };
        const summary = summarizeReviews(questions, stats, NOW);
        expect(summary).toMatchObject({ total: 5, fresh: 1, due: 2, notDue: 2 });
        expect(summary.nextDueAt).toBe(daysAgo(2) + 8 * DAY_MS);
    });

    it('has no next due date when everything is due or new', () => {
        const summary = summarizeReviews(questions, {}, NOW);
        expect(summary).toEqual({ total: 5, fresh: 5, due: 0, notDue: 0, nextDueAt: null });
    });

    it('handles an empty list', () => {
        expect(summarizeReviews([], {}, NOW)).toEqual({ total: 0, fresh: 0, due: 0, notDue: 0, nextDueAt: null });
    });
});
