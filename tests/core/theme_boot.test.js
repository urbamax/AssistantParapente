import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const THEME_BOOT_SRC = readFileSync('js/theme_boot.js', 'utf8');

function runThemeBoot() {
    runInNewContext(THEME_BOOT_SRC, { localStorage, window, document });
}

describe('theme_boot.js (anti-flash theme bootstrap)', () => {
    beforeEach(() => {
        document.documentElement.className = '';
        document.documentElement.style.colorScheme = '';
        localStorage.clear();
        vi.restoreAllMocks();
    });

    it('applies light-mode when localStorage themeMode is "light"', () => {
        localStorage.setItem('themeMode', 'light');
        runThemeBoot();
        expect(document.documentElement.classList.contains('light-mode')).toBe(true);
        expect(document.documentElement.classList.contains('dark-theme')).toBe(false);
        expect(document.documentElement.style.colorScheme).toBe('light');
    });

    it('applies dark-theme when localStorage themeMode is "dark"', () => {
        localStorage.setItem('themeMode', 'dark');
        runThemeBoot();
        expect(document.documentElement.classList.contains('dark-theme')).toBe(true);
        expect(document.documentElement.classList.contains('light-mode')).toBe(false);
        expect(document.documentElement.style.colorScheme).toBe('dark');
    });

    it('follows prefers-color-scheme: dark when themeMode is auto/unset', () => {
        window.matchMedia = vi.fn().mockReturnValue({ matches: true });
        runThemeBoot();
        expect(document.documentElement.classList.contains('dark-theme')).toBe(true);
        expect(document.documentElement.style.colorScheme).toBe('dark');
    });

    it('follows prefers-color-scheme: light when themeMode is auto/unset', () => {
        window.matchMedia = vi.fn().mockReturnValue({ matches: false });
        runThemeBoot();
        expect(document.documentElement.classList.contains('light-mode')).toBe(true);
        expect(document.documentElement.style.colorScheme).toBe('light');
    });

    it('silently ignores localStorage exceptions (private browsing mode)', () => {
        vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
            throw new DOMException('Blocked', 'SecurityError');
        });
        expect(() => runThemeBoot()).not.toThrow();
    });
});
