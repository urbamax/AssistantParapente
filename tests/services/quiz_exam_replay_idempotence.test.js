import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import QuizService, { compactExam } from '../../js/services/quiz_service.js';
import StorageService from '../../js/services/storage.js';
import { FirebaseAuthEngine } from '../../js/services/firebase_service.js';

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
});
