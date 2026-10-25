import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const source = readFileSync('js/error_overlay.js', 'utf8');

function dispatchError(init) {
    const event = new Event('error');
    Object.assign(event, init);
    window.dispatchEvent(event);
}

describe('error_overlay', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        new Function(source)();
    });

    it('shows the banner for an error with a source location', () => {
        dispatchError({
            message: 'boom',
            filename: 'http://localhost/app.js',
            lineno: 3,
            colno: 4,
            error: new Error('boom'),
        });
        expect(document.body.textContent).toContain('GLOBAL ERROR: boom');
    });

    it('ignores the opaque "Script error." of a cross-origin script and logs it instead', () => {
        dispatchError({ message: 'Script error.', filename: '', lineno: 0, colno: 0, error: null });
        expect(document.body.textContent).toBe('');
        expect(console.warn).toHaveBeenCalled();
    });
});
