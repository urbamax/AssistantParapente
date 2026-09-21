import { describe, it, expect } from 'vitest';
import { resolveStartMode, FIRST_VISIT_MODE } from '../../js/core/start_mode.js';

describe('resolveStartMode', () => {
    it('shows the welcome screen on the very first visit (nothing stored, no deep link)', () => {
        expect(resolveStartMode(null, null)).toBe(FIRST_VISIT_MODE);
        expect(FIRST_VISIT_MODE).toBe('WELCOME');
    });

    it('restores the last opened page for a returning visitor', () => {
        expect(resolveStartMode(null, 'SITES')).toBe('SITES');
    });

    it('lets a deep link win over the stored page', () => {
        expect(resolveStartMode('LIBRARY', 'SITES')).toBe('LIBRARY');
        expect(resolveStartMode('QCM', null)).toBe('QCM');
    });

    it('keeps the welcome screen until the visitor actually leaves it', () => {
        expect(resolveStartMode(null, 'WELCOME')).toBe('WELCOME');
    });
});
