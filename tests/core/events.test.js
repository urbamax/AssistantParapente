import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import AppEvents from '../../js/core/events.js';

// Spec 010 : Entrée et Espace sur un « bouton » non natif déclenchent son action une fois ; Espace
// ne fait pas défiler la page ; les boutons natifs ne sont pas déclenchés deux fois.
describe('keyboard activation of role=button elements (spec 010, FR-002)', () => {
    const calls = [];
    beforeAll(() => {
        AppEvents.init();
        AppEvents.register('spec010Action', (args) => calls.push(args));
    });
    afterEach(() => {
        calls.length = 0;
        document.body.innerHTML = '';
    });

    const press = (el, key) => {
        const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
        el.dispatchEvent(event);
        return event;
    };

    it.each([['Enter'], [' ']])('%j on a div[role=button] runs the action once', (key) => {
        document.body.innerHTML = `<div role="button" tabindex="0" data-action="spec010Action" data-args="'x'">Filtre</div>`;
        const event = press(document.querySelector('div'), key);
        expect(calls).toEqual(['x']);
        if (key === ' ') expect(event.defaultPrevented).toBe(true);
    });

    it('does not handle native buttons (their own Enter/Space already clicks)', () => {
        document.body.innerHTML = `<button data-action="spec010Action" data-args="'y'">OK</button>`;
        press(document.querySelector('button'), 'Enter');
        expect(calls).toEqual([]);
    });

    it('ignores other keys', () => {
        document.body.innerHTML = `<div role="button" tabindex="0" data-action="spec010Action">Filtre</div>`;
        press(document.querySelector('div'), 'a');
        expect(calls).toEqual([]);
    });
});
