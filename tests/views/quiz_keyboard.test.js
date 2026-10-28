import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import QuizView from '../../js/views/quiz.js';

// Keyboard shortcuts on the question screen: A-D / 1-4 tick an answer, Enter validates (or moves on
// once corrected), arrows go back / forward. Each key clicks the matching on-screen button.
describe('QCM keyboard shortcuts', () => {
    let clicks;
    let keydown;

    const render = (actions, { active = true } = {}) => {
        document.body.innerHTML = `
            <div id="qcm-screen" class="${active ? 'active' : ''}">
                <button class="qcm-option" data-action="toggle-option" data-idx="0">A</button>
                <button class="qcm-option" data-action="toggle-option" data-idx="1">B</button>
                <button class="qcm-option" data-action="toggle-option" data-idx="2" disabled>C</button>
                <button id="voice">Lire</button>
                <input id="field" />
                <div id="qcm-actions-container">${actions}</div>
            </div>`;
        document.querySelectorAll('button').forEach((b) =>
            b.addEventListener('click', () => clicks.push(b.dataset.action || b.id)),
        );
    };

    const press = (key, target = document.body, init = {}) => {
        const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
        target.dispatchEvent(e);
        return e;
    };

    const QUESTION_ACTIONS =
        '<button data-action="prev-question"></button><button data-action="validate-question"></button>';
    const CORRECTED_ACTIONS =
        '<button data-action="prev-question"></button><button data-action="next-question"></button>';

    beforeEach(() => {
        clicks = [];
        keydown = QuizView.handleKeydown.bind(QuizView); // comme QuizView.mount()
        document.addEventListener('keydown', keydown);
    });

    afterEach(() => {
        document.removeEventListener('keydown', keydown);
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    it('ticks the answer matching a letter or a digit, whatever the case', () => {
        render(QUESTION_ACTIONS);
        press('a');
        press('B');
        press('2');
        expect(clicks).toEqual(['toggle-option', 'toggle-option', 'toggle-option']);
    });

    it('ignores a frozen (corrected) or missing answer', () => {
        render(CORRECTED_ACTIONS);
        press('c');
        press('d');
        expect(clicks).toEqual([]);
    });

    it('Enter validates, then moves on once the answer is corrected', () => {
        render(QUESTION_ACTIONS);
        const e = press('Enter');
        expect(clicks).toEqual(['validate-question']);
        expect(e.defaultPrevented).toBe(true);

        clicks = [];
        render(CORRECTED_ACTIONS);
        press('Enter');
        expect(clicks).toEqual(['next-question']);
    });

    it('arrows go back and forward', () => {
        render(CORRECTED_ACTIONS);
        press('ArrowLeft');
        press('ArrowRight');
        expect(clicks).toEqual(['prev-question', 'next-question']);
    });

    it('Enter on an answer button validates instead of toggling it again', () => {
        render(QUESTION_ACTIONS);
        press('Enter', document.querySelector('.qcm-option'));
        expect(clicks).toEqual(['validate-question']);
    });

    it('leaves the other buttons, text fields and shortcuts with modifiers alone', () => {
        render(QUESTION_ACTIONS);
        press('Enter', document.getElementById('voice'));
        press('a', document.getElementById('field'));
        press('a', document.body, { ctrlKey: true });
        press('r', document.body, { metaKey: true });
        expect(clicks).toEqual([]);
    });

    it('does nothing when the question screen is not shown', () => {
        render(QUESTION_ACTIONS, { active: false });
        press('a');
        press('Enter');
        expect(clicks).toEqual([]);
    });
});
