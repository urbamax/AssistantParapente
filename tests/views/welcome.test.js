import { describe, it, expect, beforeEach } from 'vitest';
import GlobalState from '../../js/core/app_state.js';
import WelcomeView from '../../js/views/welcome.js';

const LEVELS = ['BI', 'BP', 'BPC', 'ALL'];

function pressed() {
    return LEVELS.filter(
        (l) => document.querySelector(`#welcome-screen [data-level="${l}"]`).getAttribute('aria-pressed') === 'true',
    );
}

describe('WelcomeView', () => {
    beforeEach(() => {
        localStorage.clear();
        GlobalState.state.level = 'ALL';
        document.body.innerHTML = `<div id="welcome-screen">${LEVELS.map(
            (l) => `<button data-level="${l}" aria-pressed="false"></button>`,
        ).join('')}</div>`;
    });

    it('marks the current level as pressed on mount', async () => {
        await WelcomeView.mount({});
        expect(pressed()).toEqual(['ALL']);
        await WelcomeView.unmount();
    });

    it('follows level changes while mounted, and stops after unmount', async () => {
        await WelcomeView.mount({});
        GlobalState.set('level', 'BP');
        expect(pressed()).toEqual(['BP']);

        await WelcomeView.unmount();
        GlobalState.set('level', 'BI');
        expect(pressed()).toEqual(['BP']);
    });
});
