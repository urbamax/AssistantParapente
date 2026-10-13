import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import QuizView from '../../js/views/quiz.js';
import QuizService from '../../js/services/quiz_service.js';
import GlobalState from '../../js/core/app_state.js';

// Spec 035 : le mode Révision dit combien de questions sont à réviser, et pourquoi rien n'est proposé.
const INDEX = readFileSync('index.html', 'utf8');
const SETUP = (() => {
    const tpl = document.createElement('template');
    tpl.innerHTML = INDEX.slice(INDEX.indexOf('<div id="qcm-setup-screen"'));
    return tpl.content.getElementById('qcm-setup-screen').outerHTML.replace(/\s(src|href)="https?:[^"]*"/g, '');
})();

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-09-30T10:00:00').getTime();
const QUESTIONS = [
    { code: 'A01V', theme: 'Météo' },
    { code: 'A02V', theme: 'Météo' },
    { code: 'A03V', theme: 'Météo' },
    { code: 'P01V', theme: 'Pilotage' },
];
const seen = (streak, daysAgo) => ({ total: 4, correct: 4, streak, lastSeen: NOW - daysAgo * DAY });
const line = () => document.getElementById('revision-summary');

function setup(statsByCode, mode = 'REVISION') {
    vi.spyOn(QuizService, 'getQuestions').mockReturnValue(QUESTIONS);
    vi.spyOn(QuizService, 'getPersistentStats').mockReturnValue({ themes: {}, questions: statsByCode });
    QuizService.state.isLoaded = true;
    QuizService.state.qcmConfig.mode = mode;
    QuizService.state.qcmConfig.theme = 'ALL';
    QuizView.updateModeUI(mode, null);
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    document.body.innerHTML = SETUP;
    vi.spyOn(GlobalState, 'get').mockImplementation((key) => (key === 'level' ? 'BI' : undefined));
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('quiz: spaced-repetition summary in Révision mode', () => {
    it('says how many questions are due and how many are new', () => {
        setup({ A01V: seen(2, 40), A02V: seen(5, 2) });
        expect(line().hidden).toBe(false);
        expect(line().textContent).toBe('À réviser : 1 · Nouvelles : 2');
    });

    it('says that nothing is due, with the next due date, when everything was seen recently', () => {
        setup({ A01V: seen(5, 2), A02V: seen(3, 2), A03V: seen(5, 1), P01V: seen(4, 1) });
        expect(line().hidden).toBe(false);
        // A02V : série 3 => 7 jours + ratio 1, vue il y a 2 jours => échéance dans 6 jours
        expect(line().textContent).toContain('Rien à réviser');
        expect(line().textContent).toContain('06/10/2026');
        expect(line().textContent).toContain('les plus proches de leur échéance');
    });

    it('does not claim a date it cannot compute (stats recorded before lastSeen existed)', () => {
        setup({
            A01V: { total: 4, correct: 4 },
            A02V: { total: 4, correct: 4 },
            A03V: { total: 4, correct: 4 },
            P01V: { total: 4, correct: 4 },
        });
        expect(line().textContent).toContain('Rien à réviser');
        expect(line().textContent).not.toMatch(/\d{2}\/\d{2}\/\d{4}/);
    });

    it('follows the chosen theme', () => {
        setup({ A01V: seen(2, 40) });
        QuizService.state.qcmConfig.theme = 'Pilotage';
        QuizView.updateRevisionSummary();
        expect(line().textContent).toBe('À réviser : 0 · Nouvelles : 1');
    });

    it('is hidden in the other modes', () => {
        setup({ A01V: seen(2, 40) });
        QuizService.state.qcmConfig.mode = 'TRAINING';
        QuizView.updateModeUI('TRAINING', null);
        expect(line().hidden).toBe(true);
        expect(line().textContent).toBe('');
    });

    it('the mode description tells that questions come back at growing intervals', () => {
        setup({});
        expect(document.getElementById('mode-description').innerText).toContain('espacée');
    });
});
