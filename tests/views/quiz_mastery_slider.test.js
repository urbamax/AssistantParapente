import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import GlobalState from '../../js/core/app_state.js';
import QuizService from '../../js/services/quiz_service.js';
import QuizView from '../../js/views/quiz.js';
import { MASTERY_WINDOW } from '../../js/services/mastery.js';

// Le palier objectif du mode Perfectionnement est un curseur : il démarre 1 point au-dessus de la
// maîtrise actuelle du périmètre (niveau et thème) et va jusqu'à 100 %.
const indexHtml = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');

const QUESTIONS = Array.from({ length: 10 }, (_, i) => ({ code: `S${i + 1}V`, theme: 'Météo', question: `Q${i}` }));
const full = () => Array(MASTERY_WINDOW).fill(1);
const stale = () => [0, ...Array(MASTERY_WINDOW - 1).fill(1)];

// `weak` questions à 90 %, les autres à 100 % : maîtrise actuelle = 100 - 1 × weak (sur 10 questions)
const seed = (weak) => {
    const stats = { themes: {}, questions: {} };
    QUESTIONS.forEach(
        (q, i) => (stats.questions[q.code] = { total: 12, correct: 12, recent: i < weak ? stale() : full() }),
    );
    vi.spyOn(QuizService, 'getPersistentStats').mockReturnValue(stats);
};

const slider = () => /** @type {HTMLInputElement} */ (document.getElementById('mastery-target-slider'));
const text = (id) => document.getElementById(id).textContent;

beforeEach(() => {
    document.body.innerHTML = `
        <div id="mastery-options">
            <output id="mastery-target-value"></output>
            <input type="range" id="mastery-target-slider" min="1" max="100" value="75" />
            <p id="mastery-target-hint"></p>
        </div>`;
    vi.spyOn(GlobalState, 'get').mockImplementation((key) => (key === 'level' ? 'BI' : undefined));
    vi.spyOn(QuizService, 'getQuestions').mockReturnValue(QUESTIONS);
    Object.assign(QuizService.state, { isLoaded: true });
    QuizService.state.qcmConfig.theme = 'ALL';
    QuizService.state.qcmConfig.masteryTarget = 75;
    QuizView._masteryTargetChoice = undefined;
});

afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
});

describe('mastery target slider', () => {
    it('is a range input driven by the input event, not three buttons', () => {
        expect(indexHtml).toMatch(/<input[^>]*type="range"[^>]*id="mastery-target-slider"/s);
        expect(indexHtml).toMatch(/id="mastery-target-slider"[^>]*data-input-action="setMasteryTarget"/s);
        expect(indexHtml).not.toMatch(/data-action="setMasteryTarget"/);
    });

    it('starts one point above the current mastery and goes up to 100', () => {
        seed(4); // 96 %
        QuizView.refreshMasterySlider();
        expect([slider().min, slider().max]).toEqual(['97', '100']);
        expect(slider().value).toBe('97'); // 75 % serait déjà atteint : on prend le minimum
        expect(QuizService.state.qcmConfig.masteryTarget).toBe(97);
        expect(text('mastery-target-value')).toBe('97%');
        expect(text('mastery-target-hint')).toContain('96%');
    });

    it('defaults to 75 % when the current mastery is below it, else to the minimum', () => {
        seed(10); // 90 % : au-dessus de 75, on prend le minimum
        QuizView.refreshMasterySlider();
        expect(slider().value).toBe('91');

        vi.restoreAllMocks();
        vi.spyOn(GlobalState, 'get').mockImplementation((key) => (key === 'level' ? 'BI' : undefined));
        vi.spyOn(QuizService, 'getQuestions').mockReturnValue(QUESTIONS);
        vi.spyOn(QuizService, 'getPersistentStats').mockReturnValue({ themes: {}, questions: {} });
        QuizView.refreshMasterySlider();
        expect([slider().min, slider().value]).toEqual(['1', '75']);
    });

    it('keeps the value the pilot chose, within the new range', () => {
        seed(4);
        QuizView.refreshMasterySlider();
        slider().value = '99';
        QuizService.setMasteryTarget(99); // comme l'action setMasteryTarget de main.js
        QuizView.updateMasteryTargetUI('99');
        expect(text('mastery-target-value')).toBe('99%');

        seed(8); // maîtrise 92 % : 99 reste dans la plage
        QuizView.refreshMasterySlider();
        expect(slider().value).toBe('99');

        seed(0); // maîtrise 100 % : plage réduite à 100
        QuizView.refreshMasterySlider();
        expect(slider().value).toBe('100');
        expect(slider().disabled).toBe(true);

        seed(8); // la plage s'élargit de nouveau : le choix du pilote revient
        QuizView.refreshMasterySlider();
        expect(slider().value).toBe('99');
    });
});
