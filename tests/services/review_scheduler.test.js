import { describe, it, expect } from 'vitest';
import {
    DAY_MS,
    DEFAULT_EASE_FACTOR,
    MIN_EASE_FACTOR,
    REVIEW_INTERVALS_DAYS,
    reviewIntervalDays,
    calculateEaseFactor,
    calculateSm2Interval,
    evaluateQuality,
    applySm2Review,
    getQuestionIntervalDays,
    dueScore,
    isDue,
    nextDueAt,
    summarizeReviews,
} from '../../js/services/review_scheduler.js';

const NOW = Date.UTC(2026, 9, 13, 12, 0, 0);
const daysAgo = (n) => NOW - n * DAY_MS;
// Questions réussies à chaque fois (ratio 1) : l'échéance est « intervalle + 1 jour ».
const seen = (streak, lastSeen, { total = 4, correct = 4, easeFactor, interval, repetitions } = {}) => ({
    total,
    correct,
    streak,
    lastSeen,
    easeFactor,
    interval,
    repetitions,
});

describe('SuperMemo SM-2: calculateEaseFactor', () => {
    it('uses DEFAULT_EASE_FACTOR = 2.5 and MIN_EASE_FACTOR = 1.3', () => {
        expect(DEFAULT_EASE_FACTOR).toBe(2.5);
        expect(MIN_EASE_FACTOR).toBe(1.3);
    });

    it('adjusts EF based on quality q in 0..5', () => {
        // q=5: delta = 0.1 - 0 = +0.1 => 2.5 + 0.1 = 2.6
        expect(calculateEaseFactor(2.5, 5)).toBe(2.6);
        // q=4: delta = 0.1 - 1 * (0.08 + 0.02) = 0 => 2.5
        expect(calculateEaseFactor(2.5, 4)).toBe(2.5);
        // q=3: delta = 0.1 - 2 * (0.08 + 0.04) = 0.1 - 0.24 = -0.14 => 2.36
        expect(calculateEaseFactor(2.5, 3)).toBe(2.36);
        // q=2: delta = 0.1 - 3 * (0.08 + 0.06) = 0.1 - 0.42 = -0.32 => 2.18
        expect(calculateEaseFactor(2.5, 2)).toBe(2.18);
        // q=1: delta = 0.1 - 4 * (0.08 + 0.08) = 0.1 - 0.64 = -0.54 => 1.96
        expect(calculateEaseFactor(2.5, 1)).toBe(1.96);
        // q=0: delta = 0.1 - 5 * (0.08 + 0.10) = 0.1 - 0.90 = -0.80 => 1.70
        expect(calculateEaseFactor(2.5, 0)).toBe(1.7);
    });

    it('never drops below MIN_EASE_FACTOR (1.3)', () => {
        expect(calculateEaseFactor(1.35, 0)).toBe(1.3);
        expect(calculateEaseFactor(1.3, 1)).toBe(1.3);
    });

    it('falls back to default EF if previous is undefined or invalid', () => {
        expect(calculateEaseFactor(undefined, 5)).toBe(2.6);
        expect(calculateEaseFactor(NaN, 4)).toBe(2.5);
    });
});

describe('SuperMemo SM-2: calculateSm2Interval', () => {
    it('returns 0 for repetition 0', () => {
        expect(calculateSm2Interval(0, 2.5)).toBe(0);
        expect(calculateSm2Interval(-1, 2.5)).toBe(0);
    });

    it('returns 1 for repetition 1 and 6 for repetition 2', () => {
        expect(calculateSm2Interval(1, 2.5)).toBe(1);
        expect(calculateSm2Interval(2, 2.5)).toBe(6);
        expect(calculateSm2Interval(1, 1.3)).toBe(1);
        expect(calculateSm2Interval(2, 1.3)).toBe(6);
    });

    it('calculates interval from previousInterval * EF for repetition > 2', () => {
        // rep 3 from previous interval 6: round(6 * 2.5) = 15
        expect(calculateSm2Interval(3, 2.5, 6)).toBe(15);
        // rep 4 from previous interval 15: round(15 * 2.5) = 38
        expect(calculateSm2Interval(4, 2.5, 15)).toBe(38);
    });

    it('spaces harder questions (low EF) much more closely', () => {
        // hard question EF = 1.3
        expect(calculateSm2Interval(3, 1.3, 6)).toBe(8); // round(6 * 1.3) = 8
        expect(calculateSm2Interval(4, 1.3, 8)).toBe(10); // round(8 * 1.3) = 10
    });

    it('falls back cleanly if previousInterval is omitted', () => {
        expect(calculateSm2Interval(3, 2.5)).toBe(15); // 6 * 2.5^1 = 15
        expect(calculateSm2Interval(4, 2.5)).toBe(38); // 6 * 2.5^2 = 37.5 => 38
    });
});

describe('SuperMemo SM-2: evaluateQuality', () => {
    it('respects explicit quality rating if given', () => {
        expect(evaluateQuality({ explicitQuality: 4 })).toBe(4);
        expect(evaluateQuality({ explicitQuality: 10 })).toBe(5);
        expect(evaluateQuality({ explicitQuality: -2 })).toBe(0);
    });

    it('evaluates incorrect answers (partial vs zero)', () => {
        expect(evaluateQuality({ isCorrect: false })).toBe(1);
        expect(evaluateQuality({ isCorrect: false, userScore: 1, maxScore: 2 })).toBe(2);
    });

    it('evaluates correct answers with hesitation/timing', () => {
        expect(evaluateQuality({ isCorrect: true, timeTakenMs: 8000 })).toBe(5);
        expect(evaluateQuality({ isCorrect: true, timeTakenMs: 20000 })).toBe(4);
        expect(evaluateQuality({ isCorrect: true, timeTakenMs: 40000 })).toBe(3);
        expect(evaluateQuality({ isCorrect: true })).toBe(5);
    });
});

describe('SuperMemo SM-2: applySm2Review', () => {
    it('handles first successful attempt', () => {
        const stat = { total: 0, correct: 0 };
        const result = applySm2Review(stat, { isCorrect: true, now: NOW });
        expect(result.repetitions).toBe(1);
        expect(result.interval).toBe(1);
        expect(result.easeFactor).toBe(2.6); // 2.5 + 0.1
        expect(result.lastSeen).toBe(NOW);
    });

    it('progresses through repetitions 1 -> 2 -> 3', () => {
        const s1 = applySm2Review({}, { isCorrect: true, now: NOW });
        expect(s1.repetitions).toBe(1);
        expect(s1.interval).toBe(1);

        const s2 = applySm2Review(s1, { isCorrect: true, now: NOW });
        expect(s2.repetitions).toBe(2);
        expect(s2.interval).toBe(6);

        const s3 = applySm2Review(s2, { isCorrect: true, now: NOW });
        expect(s3.repetitions).toBe(3);
        expect(s3.interval).toBe(Math.round(6 * s3.easeFactor));
    });

    it('resets repetitions and interval on failure, while reducing EF', () => {
        const mastered = {
            easeFactor: 2.6,
            interval: 16,
            repetitions: 3,
            streak: 3,
        };
        const failed = applySm2Review(mastered, { isCorrect: false, now: NOW });
        expect(failed.repetitions).toBe(0);
        expect(failed.interval).toBe(0);
        expect(failed.easeFactor).toBeLessThan(mastered.easeFactor);
    });
});

describe('getQuestionIntervalDays', () => {
    it('returns stat.interval when present', () => {
        expect(getQuestionIntervalDays({ interval: 15, streak: 1 })).toBe(15);
        expect(getQuestionIntervalDays({ interval: 0, streak: 3 })).toBe(0);
    });

    it('computes SM-2 interval if easeFactor is present without interval', () => {
        expect(getQuestionIntervalDays({ easeFactor: 2.5, streak: 2 })).toBe(6);
        expect(getQuestionIntervalDays({ easeFactor: 2.5, repetitions: 3 })).toBe(15);
    });

    it('falls back to legacy reviewIntervalDays when neither is present', () => {
        expect(getQuestionIntervalDays({ streak: 3 })).toBe(7);
        expect(getQuestionIntervalDays(undefined)).toBe(0);
    });
});

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

    it('supports SM-2 interval in dueScore and isDue', () => {
        // interval 15 days, ratio 1 => due after 16 days
        const sm2Stat = seen(3, daysAgo(15.5), { interval: 15, easeFactor: 2.5 });
        expect(isDue(sm2Stat, NOW)).toBe(false);
        const sm2Due = seen(3, daysAgo(16.5), { interval: 15, easeFactor: 2.5 });
        expect(isDue(sm2Due, NOW)).toBe(true);
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

    it('calculates nextDueAt with SM-2 interval', () => {
        const stat = seen(3, daysAgo(2), { interval: 15 });
        const due = nextDueAt(stat);
        expect(due).toBe(stat.lastSeen + 16 * DAY_MS); // 15 + 1
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
