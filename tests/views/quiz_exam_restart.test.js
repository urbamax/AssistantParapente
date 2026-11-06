import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import QuizView from '../../js/views/quiz.js';
import QuizService from '../../js/services/quiz_service.js';
import GlobalState from '../../js/core/app_state.js';
import GdprEngine from '../../js/gdpr_engine.js';
import AppRouter from '../../js/core/router.js';

const INDEX = readFileSync('index.html', 'utf8');
const SCREENS = (() => {
    const tpl = document.createElement('template');
    tpl.innerHTML = INDEX.slice(INDEX.indexOf('<div id="qcm-setup-screen"'));
    return ['qcm-setup-screen', 'qcm-screen', 'stats-screen', 'qcm-bank-screen']
        .map((id) => tpl.content.getElementById(id).outerHTML)
        .join('')
        .replace(/\s(src|href)="https?:[^"]*"/g, '');
})();

const QUESTIONS = [
    {
        code: 'A1V',
        theme: 'Météo',
        question: 'Q1?',
        choices: [
            { text: 'A', pts: 6 },
            { text: 'B', pts: -3 },
        ],
    },
    {
        code: 'E2V',
        theme: 'Mécavol',
        question: 'Q2?',
        choices: [
            { text: 'C', pts: 6 },
            { text: 'D', pts: -3 },
        ],
    },
];

describe('Quiz Exam Finish and Return to Setup', () => {
    beforeEach(() => {
        document.body.innerHTML = SCREENS;
        vi.spyOn(GlobalState, 'get').mockImplementation((key) => (key === 'level' ? 'BI' : undefined));
        vi.spyOn(GdprEngine, 'isConsentGranted').mockReturnValue(true);
        vi.spyOn(QuizService, 'getQuestions').mockReturnValue(QUESTIONS);
        vi.spyOn(QuizService, 'getLevelQuestions').mockReturnValue(QUESTIONS);
        vi.spyOn(QuizService, 'getQuestionByCode').mockImplementation((c) => QUESTIONS.find((q) => q.code === c));
        vi.spyOn(QuizService, 'getPersistentStats').mockReturnValue({ totalQuestions: 0, questions: {} });
        vi.spyOn(QuizService, 'getExamHistory').mockReturnValue([]);

        QuizService.state.isLoaded = true;
        QuizService.state.qcmConfig.mode = 'TRAINING';
        QuizService.state.qcmConfig.count = 10;
        QuizService.state.qcmConfig.theme = 'ALL';
    });

    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    it('synchronizes setup screen UI with QuizService.state.qcmConfig.mode on showSetupScreen', () => {
        QuizService.state.qcmConfig.mode = 'EXAM';
        QuizView.showSetupScreen();

        expect(document.getElementById('mode-exam').classList.contains('active')).toBe(true);
        expect(document.getElementById('mode-training').classList.contains('active')).toBe(false);
        expect(document.getElementById('training-options').style.opacity).toBe('0.3');
        expect(document.getElementById('training-options').style.pointerEvents).toBe('none');

        QuizService.state.qcmConfig.mode = 'TRAINING';
        QuizView.showSetupScreen();

        expect(document.getElementById('mode-training').classList.contains('active')).toBe(true);
        expect(document.getElementById('mode-exam').classList.contains('active')).toBe(false);
        expect(document.getElementById('training-options').style.opacity).toBe('1');
        expect(document.getElementById('training-options').style.pointerEvents).toBe('auto');
    });

    it('keeps EXAM mode and UI strictly in sync when completing exam and restarting', async () => {
        // Step 1: User clicks EXAM button
        QuizService.setMode('EXAM');
        QuizView.updateModeUI('EXAM');

        expect(document.getElementById('mode-exam').classList.contains('active')).toBe(true);
        expect(QuizService.state.qcmConfig.mode).toBe('EXAM');

        // Step 2: Start session
        QuizView.startSession();
        expect(document.getElementById('qcm-screen').classList.contains('active')).toBe(true);
        expect(document.getElementById('qcm-mode-label').textContent).toContain('EXAMEN');

        // Step 3: Complete exam
        while (QuizService.getCurrentQuestion()) {
            QuizView.handleClick({ target: document.querySelector('.qcm-option') });
            QuizView.validateQuestion();
        }

        // Exam results should be rendered
        expect(document.querySelector('.qcm-results-exit')).not.toBeNull();

        // Step 4: Return to setup via AppRouter.navigate('QCM')
        AppRouter.register('QCM', QuizView);
        await AppRouter.navigate('QCM');

        expect(document.getElementById('mode-exam').classList.contains('active')).toBe(true);
        expect(document.getElementById('mode-training').classList.contains('active')).toBe(false);
        expect(QuizService.state.qcmConfig.mode).toBe('EXAM');

        // Step 5: User clicks "COMMENCER" again -> Must start in EXAM mode
        QuizView.startSession();

        expect(document.getElementById('qcm-mode-label').textContent).toContain('EXAMEN');
        expect(QuizService.state.qcmConfig.mode).toBe('EXAM');

        // Validate first question: should advance directly without feedback
        QuizView.handleClick({ target: document.querySelector('.qcm-option') });
        QuizView.validateQuestion();
        expect(document.getElementById('qcm-feedback').style.display).toBe('none');
    });

    it('synchronizes UI back to TRAINING when workshop was launched then user returns to setup', async () => {
        // Exam was selected previously
        QuizService.setMode('EXAM');
        QuizView.updateModeUI('EXAM');
        expect(document.getElementById('mode-exam').classList.contains('active')).toBe(true);

        // Workshop launched (forces mode = 'TRAINING' in service)
        QuizView.launchWorkshop(QUESTIONS, 'TRAPS');
        expect(QuizService.state.qcmConfig.mode).toBe('TRAINING');

        // User finishes/exits and returns to setup
        QuizView.showSetupScreen();

        // UI must be in sync with TRAINING, not showing stale EXAM
        expect(document.getElementById('mode-training').classList.contains('active')).toBe(true);
        expect(document.getElementById('mode-exam').classList.contains('active')).toBe(false);
        expect(document.getElementById('training-options').style.opacity).toBe('1');
        expect(document.getElementById('training-options').style.pointerEvents).toBe('auto');

        // Launching runs in training mode
        QuizView.startSession();
        expect(document.getElementById('qcm-mode-label').textContent).toContain('ENTRAÎNEMENT');
        expect(QuizService.state.qcmConfig.mode).toBe('TRAINING');
    });

    it('resets _activeWorkshopAxisId when finish-session is clicked', () => {
        QuizView._activeWorkshopAxisId = 'METEO_AXIS';
        const navigateSpy = vi.spyOn(AppRouter, 'navigate').mockImplementation(() => {});

        const fakeButton = document.createElement('button');
        fakeButton.setAttribute('data-action', 'finish-session');
        QuizView.handleClick({ target: fakeButton });

        expect(QuizView._activeWorkshopAxisId).toBeNull();
        expect(navigateSpy).toHaveBeenCalledWith('QCM');
    });
});
