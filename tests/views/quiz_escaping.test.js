import { describe, it, expect, afterEach, vi } from 'vitest';
import QuizView from '../../js/views/quiz.js';
import QuizService from '../../js/services/quiz_service.js';
import GlobalState from '../../js/core/app_state.js';

// Spec 003 (audit C6) : les textes du QCM (question, choix, explication) sont du texte, jamais
// du code — y compris l'historique des examens relu depuis l'appareil ou le compte.
const PAYLOAD = '<img src=x onerror="window.__xss=1">';

describe('quiz texts are shown as text (spec 003, FR-005)', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
        delete window.__xss;
    });

    it('answer feedback shows the explanation as text', () => {
        document.body.innerHTML = '<div id="qcm-actions-container"></div><div id="qcm-feedback"></div>';
        QuizView._currentChoices = [];
        vi.spyOn(QuizView, 'getCourseUrl').mockReturnValue(null);
        QuizView.showAnswerFeedback(
            { selected: [], isCorrect: false, question: { code: 'X1', explication: `Voir ${PAYLOAD}` } },
            false,
        );
        const feedback = document.getElementById('qcm-feedback');
        expect(feedback.querySelector('img')).toBeNull();
        expect(feedback.textContent).toContain(PAYLOAD);
    });

    it('exam history shows questions, choices and explanations as text', () => {
        vi.spyOn(GlobalState, 'get').mockReturnValue('ALL');
        vi.spyOn(QuizService, 'getExamHistory').mockReturnValue([
            {
                date: '2026-09-29T10:00:00Z',
                level: 'BI',
                score: 0,
                total: 1,
                results: [
                    {
                        isCorrect: false,
                        selected: [],
                        question: {
                            code: 'X1',
                            question: `Question ${PAYLOAD}`,
                            choices: [{ text: `Choix ${PAYLOAD}`, pts: 6 }],
                            explication: `Explication ${PAYLOAD}`,
                        },
                    },
                ],
            },
        ]);
        const div = document.createElement('div');
        div.innerHTML = QuizView.renderExamHistory();
        expect(div.querySelector('img')).toBeNull();
        expect(div.textContent).toContain(`Question ${PAYLOAD}`);
        expect(div.textContent).toContain(`Choix ${PAYLOAD}`);
        expect(div.textContent).toContain(`Explication ${PAYLOAD}`);
    });
});
