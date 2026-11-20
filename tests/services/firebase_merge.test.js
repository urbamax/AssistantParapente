import { describe, it, expect, beforeEach } from 'vitest';
import {
    latestReviewState,
    mergeChoicePicks,
    mergeChoiceMisses,
    mergeQcmStats,
    mergeExamHistory,
    mergePreferences,
    getLocalQcmStats,
    getLocalExamHistory,
    getLocalPreferences,
} from '../../js/services/firebase_merge.js';

describe('firebase_merge.js pure merge & local state helpers', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('latestReviewState picks the most recently seen device state and preserves SM-2 fields', () => {
        const older = { streak: 5, lastSeen: 1000, easeFactor: 2.5, interval: 10, repetitions: 3 };
        const newer = { streak: 0, lastSeen: 2000, recent: [false] };
        const merged = latestReviewState(older, newer);
        expect(merged.streak).toBe(0);
        expect(merged.lastSeen).toBe(2000);
        expect(merged.recent).toEqual([false]);
        expect(merged.easeFactor).toBe(2.5);
    });

    it('mergeChoicePicks and mergeChoiceMisses take element-wise maximums', () => {
        expect(mergeChoicePicks([1, 4], [3, 2, 5])).toEqual({ choicePicks: [3, 4, 5] });
        expect(mergeChoiceMisses(null, undefined)).toEqual({});
    });

    it('mergeQcmStats combines questions, themes and appliedExamIds without double-counting', () => {
        const local = {
            totalQuestions: 5,
            totalCorrect: 4,
            questions: { Q1: { total: 3, correct: 2, streak: 1, lastSeen: 100 } },
            themes: { Météo: { total: 3, correct: 2 } },
            appliedExamIds: ['e1'],
        };
        const cloud = {
            totalQuestions: 6,
            totalCorrect: 5,
            questions: {
                Q1: { total: 5, correct: 4, streak: 3, lastSeen: 200 },
                Q2: { total: 2, correct: 2, streak: 2, lastSeen: 150 },
            },
            themes: { Météo: { total: 5, correct: 4 } },
            appliedExamIds: ['e1', 'e2'],
        };
        const res = mergeQcmStats(local, cloud);
        expect(res.questions.Q1.total).toBe(5);
        expect(res.questions.Q1.streak).toBe(3);
        expect(res.questions.Q2.correct).toBe(2);
        expect(res.totalQuestions).toBe(7);
        expect(res.appliedExamIds).toEqual(['e1', 'e2']);
    });

    it('mergeExamHistory filters tombstoned exams and keeps the higher qcmRevision', () => {
        const local = {
            exams: [
                { id: 'ex1', date: '2026-11-10T10:00:00Z', score: 50, qcmRevision: 1, appliedToStats: true },
                { id: 'ex-del', date: '2026-11-09T10:00:00Z', score: 40 },
            ],
            deletedExamIds: [],
        };
        const cloud = {
            exams: [{ id: 'ex1', date: '2026-11-10T10:00:00Z', score: 54, qcmRevision: 2 }],
            deletedExamIds: ['ex-del'],
        };
        const res = mergeExamHistory(local, cloud);
        expect(res.exams).toHaveLength(1);
        expect(res.exams[0].score).toBe(54);
        expect(res.exams[0].appliedToStats).toBe(true);
        expect(res.deletedExamIds).toContain('ex-del');
    });

    it('mergePreferences unions favoriteSites, strips iceProfile and migrates legacy site prefs', () => {
        const local = { favoriteSites: ['s1'], iceProfile: { nom: 'Secret' }, localOnlyFlag: true };
        const cloud = { favoriteSites: ['s2'], weatherModel: 'meteoblue', radiusLimit: 'Illimité' };
        const merged = mergePreferences(local, cloud);
        expect(merged.favoriteSites).toEqual(['s1', 's2']);
        expect(merged.localOnlyFlag).toBe(true);
        expect(merged.iceProfile).toBeUndefined();
        expect(merged.weatherModel).not.toBe('meteoblue');
    });

    it('getLocalQcmStats, getLocalExamHistory and getLocalPreferences return clean defaults', () => {
        expect(getLocalQcmStats()).toEqual({ totalQuestions: 0, totalCorrect: 0, themes: {}, questions: {} });
        expect(getLocalExamHistory()).toEqual({ exams: [], deletedExamIds: [] });
        const prefs = getLocalPreferences();
        expect(prefs.pilotLevel).toBe('ALL');
        expect(Array.isArray(prefs.favoriteSites)).toBe(true);
    });

    it('mergeQcmStats guards against missing total/correct fields without producing NaN', () => {
        const local = { questions: { Q1: { streak: 1 } }, themes: { Météo: {} } };
        const cloud = { questions: { Q1: { total: 4, correct: 3 } }, themes: { Météo: { total: 4 } } };
        const res = mergeQcmStats(local, cloud);
        expect(res.questions.Q1.total).toBe(4);
        expect(res.questions.Q1.correct).toBe(3);
        expect(res.themes.Météo.total).toBe(4);
        expect(res.themes.Météo.correct).toBe(0);
    });

    it('mergePreferences preserves newer local scalar preferences when local.updatedAt > cloud.updatedAt (numeric or ISO)', () => {
        const local = { limitWindMax: 35, updatedAt: 2000 };
        const cloud = { limitWindMax: 25, updatedAt: 1000 };
        const merged = mergePreferences(local, cloud);
        expect(merged.limitWindMax).toBe(35);

        const isoLocal = { limitWindMax: 32, updatedAt: '2026-11-20T22:00:00.000Z' };
        const isoCloud = { limitWindMax: 20, updatedAt: '2026-11-20T20:00:00.000Z' };
        expect(mergePreferences(isoLocal, isoCloud).limitWindMax).toBe(32);
    });

    it('mergeQcmStats and mergeExamHistory avoid NaN on corrupted strings and do not mutate inputs', () => {
        const res = mergeQcmStats(
            { totalQuestions: 'abc', totalCorrect: 'xyz', questions: { Q1: { streak: 'bad', lastSeen: 'bad' } } },
            {
                totalQuestions: 5,
                totalCorrect: 4,
                questions: { Q1: { total: 5, correct: 4, streak: 2, lastSeen: 10 } },
            },
        );
        expect(res.totalQuestions).toBe(5);
        expect(res.totalCorrect).toBe(4);
        expect(res.questions.Q1.streak).toBe(2);

        const localExam = Object.freeze({
            id: 'ex1',
            date: '2026-11-20T10:00:00Z',
            qcmRevision: 1,
            appliedToStats: true,
        });
        const cloudExam = Object.freeze({ id: 'ex1', date: '2026-11-20T10:00:00Z', qcmRevision: 2 });
        const history = mergeExamHistory({ exams: [localExam] }, { exams: [cloudExam] });
        expect(history.exams[0].appliedToStats).toBe(true);
    });
});
