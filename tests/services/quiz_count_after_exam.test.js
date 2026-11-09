import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import QuizService from '../../js/services/quiz_service.js';

// Le nombre de questions choisi pour l'entraînement ne doit pas être écrasé par le volume imposé d'un examen.
describe('QuizService : nombre de questions après un examen', () => {
    beforeEach(async () => {
        global.fetch = vi.fn().mockImplementation(async (url) => {
            const content = readFileSync(String(url).replace(/^\.\//, ''), 'utf8');
            return { ok: true, text: async () => content, json: async () => JSON.parse(content) };
        });
        QuizService.setQuestions([]);
        QuizService.state.isLoaded = false;
        await QuizService.init('.');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it.each([
        ['BI', 30],
        ['BP', 60],
    ])('garde le choix du pilote après un examen %s de %i questions', (level, examSize) => {
        QuizService.setCount(10);
        QuizService.setMode('EXAM');
        QuizService.startSession(level);
        expect(QuizService.state.qcmSessionData).toHaveLength(examSize);
        expect(QuizService.state.qcmConfig.count).toBe(10);

        QuizService.setMode('TRAINING');
        QuizService.startSession(level);
        expect(QuizService.state.qcmSessionData).toHaveLength(10);
    });

    it('garde aussi « toutes les questions »', () => {
        QuizService.setCount('ALL');
        QuizService.setMode('EXAM');
        QuizService.startSession('BI');
        expect(QuizService.state.qcmConfig.count).toBe('ALL');
    });
});
