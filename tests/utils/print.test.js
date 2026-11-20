import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { printHtml } from '../../js/utils/print.js';

describe('printHtml', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('creates a hidden iframe, focuses and prints it, then removes it after timeout', async () => {
        const focus = vi.fn();
        const print = vi.fn();

        const promise = printHtml('<html><body>Rapport</body></html>');
        const frame = /** @type {HTMLIFrameElement} */ (document.querySelector('iframe'));
        expect(frame).not.toBeNull();
        expect(frame.getAttribute('aria-hidden')).toBe('true');
        expect(frame.srcdoc).toContain('Rapport');

        Object.defineProperty(frame, 'contentWindow', { value: { focus, print }, configurable: true });
        frame.onload(new Event('load'));

        await promise;
        expect(focus).toHaveBeenCalledTimes(1);
        expect(print).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(60_000);
        expect(document.querySelector('iframe')).toBeNull();
    });

    it('rejects when printing throws an error and still cleans up the iframe', async () => {
        const promise = printHtml('<html><body>Erreur</body></html>');
        const frame = /** @type {HTMLIFrameElement} */ (document.querySelector('iframe'));
        Object.defineProperty(frame, 'contentWindow', {
            value: {
                focus: () => {},
                print: () => {
                    throw new Error('print blocked');
                },
            },
            configurable: true,
        });
        frame.onload(new Event('load'));

        await expect(promise).rejects.toThrow('print blocked');
        vi.advanceTimersByTime(60_000);
        expect(document.querySelector('iframe')).toBeNull();
    });
});
