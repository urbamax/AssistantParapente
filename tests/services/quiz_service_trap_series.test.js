import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import QuizService from '../../js/services/quiz_service.js';

// Spec 063 : option « Questions à piège » du mode Entraînement.
const Q = (code, theme) => ({
    code,
    theme,
    question: `Question ${code}`,
    choices: [
        { text: 'oui', pts: 3 },
        { text: 'non', pts: -6 },
    ],
});
const QUESTIONS = [Q('A1B', 'Météo'), Q('A2B', 'Météo'), Q('A3B', 'Météo'), Q('E1B', 'Mécavol'), Q('E2B', 'Mécavol')];
const TRAPS = { A1B: ['Un.'], A3B: ['Trois.'], E1B: ['Quatre.'] };

describe('QuizService - trap series (spec 063)', () => {
    beforeEach(() => {
        QuizService.setQuestions(QUESTIONS);
        QuizService.state.isLoaded = true;
        Object.assign(QuizService.state.qcmConfig, { mode: 'TRAINING', count: 10, theme: 'ALL' });
        vi.spyOn(QuizService, 'getLevelQuestions').mockImplementation(() => QUESTIONS);
        vi.spyOn(QuizService, 'getQuestionTraps').mockImplementation((c) => Object.freeze(TRAPS[c] || []));
        vi.spyOn(QuizService, 'getPersistentStats').mockReturnValue({
            questions: { A3B: { total: 2, correct: 1, streak: 0 }, A1B: { total: 1, correct: 1, streak: 1 } },
        });
    });
    afterEach(() => {
        QuizService.setTrapsOnly(false);
        vi.restoreAllMocks();
    });

    const codes = () => QuizService.state.qcmSessionData.map((q) => q.code);

    it('is off by default and the training draw keeps every question', () => {
        expect(QuizService.state.qcmConfig.trapsOnly).toBe(false);
        QuizService.startSession('BI');
        expect(codes().sort()).toEqual(['A1B', 'A2B', 'A3B', 'E1B', 'E2B']);
    });

    it('keeps only trap questions, missed first', () => {
        QuizService.setTrapsOnly(true);
        QuizService.startSession('BI');
        expect(codes()[0]).toBe('A3B');
        expect(codes().sort()).toEqual(['A1B', 'A3B', 'E1B']);
    });

    it('respects the theme and the count', () => {
        QuizService.setTrapsOnly(true);
        QuizService.setTheme('Météo');
        QuizService.setCount(1);
        QuizService.startSession('BI');
        expect(codes()).toEqual(['A3B']);
    });

    it('refuses to start when no trap question matches', () => {
        QuizService.setTrapsOnly(true);
        QuizService.getQuestionTraps.mockImplementation(() => Object.freeze([]));
        expect(() => QuizService.startSession('BI')).toThrow('Aucune question à piège pour ce niveau et ce thème.');
    });

    it('is ignored outside training mode', () => {
        QuizService.setTrapsOnly(true);
        QuizService.setMode('REVISION');
        QuizService.startSession('BI');
        expect(codes()).toContain('A2B');
    });

    it('tells whether trap data is loaded', () => {
        QuizService.getQuestionTraps.mockRestore();
        QuizService._questionTraps = {};
        expect(QuizService.hasQuestionTraps()).toBe(false);
        QuizService._questionTraps = { A1B: ['Un.'] };
        expect(QuizService.hasQuestionTraps()).toBe(true);
    });
});
