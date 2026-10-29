import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import QuizService from '../../js/services/quiz_service.js';
import QuizView from '../../js/views/quiz.js';

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
        QuizService.saveExamHistory('BI');
        QuizService.saveExamHistory('BI');
        expect(spy).toHaveBeenCalledTimes(1);
        spy.mockRestore();
    });
});
