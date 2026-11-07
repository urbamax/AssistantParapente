import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import QuizService from '../../js/services/quiz_service.js';
import QuizView from '../../js/views/quiz.js';
import StorageService from '../../js/services/storage.js';

// L'examen n'est invalidé qu'après un vrai départ de la page (délai de grâce), une seule fois,
// et une session d'examen ne laisse qu'une entrée d'historique.
const setHidden = (hidden) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    document.dispatchEvent(new Event('visibilitychange'));
};

describe('quiz exam: leaving the page', () => {
    let invalidate;

    beforeEach(() => {
        vi.useFakeTimers();
        document.body.innerHTML = '<div id="qcm-screen" class="active"></div>';
        QuizService.state.qcmConfig.mode = 'EXAM';
        QuizService.state.qcmSessionData = [{ code: 'A1V' }, { code: 'A2V' }];
        QuizService.state.examResults = [];
        QuizService.state.invalidated = false;
        QuizService.state.examSaved = false;
        invalidate = vi.spyOn(QuizView, 'invalidateExam').mockImplementation(() => {});
    });

    afterEach(() => {
        setHidden(false);
        vi.useRealTimers();
        vi.restoreAllMocks();
        document.body.innerHTML = '';
        QuizService.state.qcmConfig.mode = 'TRAINING';
    });

    it('does not invalidate when the student comes back within the grace period', () => {
        setHidden(true);
        vi.advanceTimersByTime(5000);
        setHidden(false);
        vi.advanceTimersByTime(60000);
        expect(invalidate).not.toHaveBeenCalled();
    });

    it('invalidates once the page stayed hidden past the grace period', () => {
        setHidden(true);
        vi.advanceTimersByTime(20000);
        expect(invalidate).toHaveBeenCalledTimes(1);
    });

    it('does not invalidate an exam already saved or finished', () => {
        QuizService.state.examSaved = true;
        setHidden(true);
        vi.advanceTimersByTime(20000);
        expect(invalidate).not.toHaveBeenCalled();
    });
});

describe('quiz exam: history', () => {
    it('saves a session only once', () => {
        const spy = vi.spyOn(QuizService, 'getExamHistory').mockReturnValue([]);
        QuizService.state.examResults = [];
        QuizService.state.qcmSessionData = [];
        QuizService.state.examSaved = false;
        QuizService.state.invalidated = false;
        QuizService.saveExamHistory('BI');
        QuizService.saveExamHistory('BI');
        expect(spy).toHaveBeenCalledTimes(1);
        spy.mockRestore();
    });

    it('does not record stats or history when an exam is cut short in the middle', () => {
        const q1 = {
            code: 'A1V',
            theme: 'Météo',
            question: 'Q1',
            choices: [
                { text: 'Vrai', pts: 6 },
                { text: 'Faux', pts: -6 },
            ],
        };
        const q2 = {
            code: 'A2V',
            theme: 'Météo',
            question: 'Q2',
            choices: [
                { text: 'Vrai', pts: 6 },
                { text: 'Faux', pts: -6 },
            ],
        };
        document.body.innerHTML = `
            <div id="qcm-setup-screen"></div>
            <div id="qcm-screen" class="active">
                <div id="qcm-mode-label"></div>
                <div id="qcm-question-text"></div>
                <div id="qcm-choices"></div>
                <div id="qcm-actions-container"></div>
                <div id="qcm-feedback"></div>
            </div>
        `;
        StorageService.set(StorageService.KEYS.QCM_STATS, { themes: {}, questions: {} });
        StorageService.set(StorageService.KEYS.EXAM_HISTORY, { exams: [] });

        QuizService.state.qcmConfig.mode = 'EXAM';
        QuizService.state.qcmSessionData = [q1, q2];
        QuizService.state.qcmIndex = 0;
        QuizService.state.examResults = [];
        QuizService.state.examSaved = false;
        QuizService.state.invalidated = false;
        QuizService.state.currentQcmSelection = new Set([q1.choices[0]]);

        // Validation de la 1re question sur 2, puis invalidation en plein milieu
        QuizService.validate();
        QuizView.invalidateExam();

        expect(StorageService.get(StorageService.KEYS.QCM_STATS).questions.A1V).toBeUndefined();
        expect(StorageService.get(StorageService.KEYS.QCM_STATS).totalQuestions || 0).toBe(0);
        expect(StorageService.get(StorageService.KEYS.EXAM_HISTORY).exams).toHaveLength(0);
    });
});
