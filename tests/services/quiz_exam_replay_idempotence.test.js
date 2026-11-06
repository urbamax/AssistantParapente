import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import QuizService, { compactExam } from '../../js/services/quiz_service.js';
import StorageService from '../../js/services/storage.js';
import { FirebaseAuthEngine } from '../../js/services/firebase_service.js';
import { STATS_HOTFIXES, healQcmStats } from '../../js/services/stats_corrections.js';

// Un examen ne doit être rejoué qu'une seule fois dans les statistiques, quels que soient les
// allers-retours de l'historique (compaction, synchro cloud, import, identifiants numériques).
describe('Rétroactivité des examens : jamais de double comptage', () => {
    const question = {
        code: 'P1V',
        theme: 'Météo',
        question: 'Q',
        choices: [
            { text: 'vrai', pts: 6 },
            { text: 'faux', pts: -6 },
        ],
    };
    const exam = (overrides = {}) => ({
        id: 'exam_1794000732892',
        date: '2026-11-06T21:32:12.892Z',
        level: 'BP',
        score: 6,
        total: 6,
        results: [{ code: 'P1V', isCorrect: true, selected: [0] }],
        ...overrides,
    });
    const p1v = () => StorageService.get(StorageService.KEYS.QCM_STATS).questions.P1V;

    beforeEach(() => {
        QuizService.setQuestions([question]);
        StorageService.set(StorageService.KEYS.QCM_STATS, { themes: {}, questions: {} });
    });

    afterEach(() => {
        QuizService.setQuestions([]);
    });

    it('compactExam conserve le marqueur appliedToStats', () => {
        expect(compactExam(exam({ appliedToStats: true })).appliedToStats).toBe(true);
    });

    it("ne rejoue pas un examen déjà appliqué dont le marqueur a disparu de l'historique", () => {
        StorageService.set(StorageService.KEYS.EXAM_HISTORY, { exams: [exam()] });
        QuizService.getExamHistory();
        expect(p1v().total).toBe(1);

        // L'historique revient (synchro cloud, ancienne version…) sans appliedToStats.
        StorageService.set(StorageService.KEYS.EXAM_HISTORY, { exams: [exam()] });
        QuizService.getExamHistory();
        expect(p1v().total).toBe(1);
    });

    it('reconnaît un identifiant numérique enregistré en texte (et inversement)', () => {
        const numeric = exam({ id: 1779271797639, date: '2026-05-20T10:09:57.639Z' });
        StorageService.set(StorageService.KEYS.QCM_STATS, {
            themes: {},
            questions: {},
            appliedExamIds: ['1779271797639'],
        });
        StorageService.set(StorageService.KEYS.EXAM_HISTORY, { exams: [numeric] });
        QuizService.getExamHistory();
        expect(StorageService.get(StorageService.KEYS.QCM_STATS).questions.P1V).toBeUndefined();
    });

    it('reconnaît un examen déjà appliqué par sa date si son identifiant a changé', () => {
        StorageService.set(StorageService.KEYS.QCM_STATS, {
            themes: {},
            questions: {},
            appliedExamIds: ['2026-11-06T21:32:12.892Z'],
        });
        StorageService.set(StorageService.KEYS.EXAM_HISTORY, { exams: [exam({ id: undefined })] });
        QuizService.getExamHistory();
        expect(StorageService.get(StorageService.KEYS.QCM_STATS).questions.P1V).toBeUndefined();
    });

    it('rejoue bien deux examens différents du même jour contenant la même question', () => {
        StorageService.set(StorageService.KEYS.EXAM_HISTORY, {
            exams: [exam(), exam({ id: 'exam_1793986347234', date: '2026-11-06T17:32:27.234Z' })],
        });
        QuizService.getExamHistory();
        expect(p1v().total).toBe(2);
        expect(p1v().correct).toBe(2);
    });

    it('la fusion cloud conserve appliedToStats et normalise les identifiants appliqués', () => {
        const merged = FirebaseAuthEngine.mergeExamHistory(
            { exams: [exam({ appliedToStats: true })] },
            { exams: [exam()] },
        );
        expect(merged.exams[0].appliedToStats).toBe(true);

        const stats = FirebaseAuthEngine.mergeQcmStats(
            { questions: {}, themes: {}, appliedExamIds: [1779271797639] },
            { questions: {}, themes: {}, appliedExamIds: ['1779271797639'] },
        );
        expect(stats.appliedExamIds).toEqual(['1779271797639']);
    });

    it("auto-guérit le doublon de l'examen exam_1794000732892 localement et empêche le cloud ou un autre appareil de le réintroduire", () => {
        const hotfixQuestions = STATS_HOTFIXES[0].questions;
        const makePollutedStats = () => {
            const questions = {};
            const themes = {};
            let totalQuestions = 0;
            let totalCorrect = 0;
            for (const [code, d] of Object.entries(hotfixQuestions)) {
                questions[code] = {
                    total: d.minTotal,
                    correct: d.correct ? d.minTotal - 1 : 1,
                    streak: d.correct ? 2 : 0,
                    recent: Array.from({ length: Math.min(d.minTotal, 10) }, () => (d.correct ? 1 : 0)),
                    lastSeen: 1794000732892,
                };
                if (!themes[d.theme]) themes[d.theme] = { total: 0, correct: 0 };
                themes[d.theme].total += d.minTotal;
                themes[d.theme].correct += d.correct ? d.minTotal - 1 : 1;
                totalQuestions += d.minTotal;
                totalCorrect += d.correct ? d.minTotal - 1 : 1;
            }
            return {
                totalQuestions,
                totalCorrect,
                themes,
                questions,
                appliedExamIds: ['exam_1794000732892'],
            };
        };

        const pollutedLocal = makePollutedStats();
        const initialTotal = pollutedLocal.totalQuestions;
        const initialCorrect = pollutedLocal.totalCorrect;

        // 1. Guérison directe : retire exactement les 60 tentatives et 49 bonnes réponses en trop
        expect(healQcmStats(pollutedLocal)).toBe(true);
        expect(pollutedLocal.totalQuestions).toBe(initialTotal - 60);
        expect(pollutedLocal.totalCorrect).toBe(initialCorrect - 49);
        expect(pollutedLocal.questions.E13B.total).toBe(3);
        expect(pollutedLocal.questions.S100B.total).toBe(2);

        // 2. Idempotence : un second passage sur une copie déjà saine ne retire plus rien
        expect(healQcmStats(pollutedLocal)).toBe(false);
        expect(pollutedLocal.totalQuestions).toBe(initialTotal - 60);

        // 3. Si le cloud (ou un second appareil) possède encore la version polluée sans appliedCorrections,
        // mergeQcmStats guérit le cloud AVANT Math.max : le doublon ne revient jamais.
        const stillPollutedCloud = makePollutedStats();
        const merged = FirebaseAuthEngine.mergeQcmStats(pollutedLocal, stillPollutedCloud);
        expect(merged.totalQuestions).toBe(initialTotal - 60);
        expect(merged.totalCorrect).toBe(initialCorrect - 49);
        expect(merged.questions.E13B.total).toBe(3);
        expect(merged.questions.S100B.total).toBe(2);
        expect(merged.appliedCorrections).toContain('exam-double-replay:exam_1794000732892');

        // 4. getPersistentStats() auto-guérit directement le localStorage au premier accès
        StorageService.set(StorageService.KEYS.QCM_STATS, makePollutedStats());
        const fromStorage = QuizService.getPersistentStats();
        expect(fromStorage.totalQuestions).toBe(initialTotal - 60);
        expect(fromStorage.totalCorrect).toBe(initialCorrect - 49);
        expect(StorageService.get(StorageService.KEYS.QCM_STATS).totalQuestions).toBe(initialTotal - 60);
    });
});
