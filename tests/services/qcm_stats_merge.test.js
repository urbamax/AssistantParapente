import { describe, it, expect } from 'vitest';
import { FirebaseAuthEngine } from '../../js/services/firebase_service.js';

const merge = (local, cloud) => FirebaseAuthEngine.mergeQcmStats(local, cloud).questions.W1V;
const stats = (q) => ({ themes: {}, questions: { W1V: q } });

describe('FirebaseAuthEngine.mergeQcmStats (révision espacée)', () => {
    it('keeps lastSeen so the Révision mode still knows when a question is due', () => {
        const merged = merge(
            stats({ total: 3, correct: 3, streak: 3, lastSeen: 2000 }),
            stats({ total: 1, correct: 1 }),
        );
        expect(merged).toEqual({ total: 3, correct: 3, streak: 3, lastSeen: 2000 });
    });

    it('a recent mistake on this device wins over an older streak from the cloud', () => {
        const local = stats({ total: 5, correct: 4, streak: 0, lastSeen: 3000 });
        const cloud = stats({ total: 4, correct: 4, streak: 4, lastSeen: 1000 });
        expect(merge(local, cloud)).toMatchObject({ streak: 0, lastSeen: 3000 });
    });

    it('a more recent answer from another device wins over this one', () => {
        const local = stats({ total: 2, correct: 1, streak: 0, lastSeen: 1000 });
        const cloud = stats({ total: 4, correct: 3, streak: 2, lastSeen: 5000 });
        expect(merge(local, cloud)).toEqual({ total: 4, correct: 3, streak: 2, lastSeen: 5000 });
    });

    it('falls back to the highest streak for stats recorded before lastSeen existed', () => {
        expect(merge(stats({ total: 2, correct: 2, streak: 2 }), stats({ total: 1, correct: 1, streak: 1 }))).toEqual({
            total: 2,
            correct: 2,
            streak: 2,
        });
    });

    it('keeps questions seen on only one side', () => {
        const merged = FirebaseAuthEngine.mergeQcmStats(stats({ total: 1, correct: 0, streak: 0, lastSeen: 10 }), {
            themes: {},
            questions: {},
        });
        expect(merged.questions.W1V).toEqual({ total: 1, correct: 0, streak: 0, lastSeen: 10 });
    });

    it('keeps the recent answers (mastery window) of the most recent device', () => {
        const local = stats({ total: 5, correct: 4, streak: 0, lastSeen: 3000, recent: [1, 1, 1, 1, 0] });
        const cloud = stats({ total: 4, correct: 4, streak: 4, lastSeen: 1000, recent: [1, 1, 1, 1] });
        expect(merge(local, cloud).recent).toEqual([1, 1, 1, 1, 0]);
    });

    it('never writes an undefined `recent` (Firestore refuses undefined fields)', () => {
        const merged = merge(stats({ total: 2, correct: 2, streak: 2, lastSeen: 5 }), stats({ total: 1, correct: 1 }));
        expect('recent' in merged).toBe(false);
    });

    it('heals lagging totalQuestions and totalCorrect from questions and themes totals', () => {
        const local = {
            totalQuestions: 234,
            totalCorrect: 192,
            themes: { Pilotage: { total: 613, correct: 539 } },
            questions: { A1V: { total: 10, correct: 8 } },
        };
        const cloud = {
            totalQuestions: 234,
            totalCorrect: 192,
            themes: { Pilotage: { total: 613, correct: 539 } },
            questions: { A1V: { total: 10, correct: 8 } },
        };
        const merged = FirebaseAuthEngine.mergeQcmStats(local, cloud);
        expect(merged.totalQuestions).toBe(613);
        expect(merged.totalCorrect).toBe(539);
    });
});
