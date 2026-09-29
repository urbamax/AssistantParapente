import { describe, it, expect, vi } from 'vitest';
import { t } from '../../js/utils/i18n.js';

describe('i18n t()', () => {
    it('returns the catalogue text for a known key', () => {
        expect(t('weather.night')).toBe('Nuit');
    });

    it('fills {placeholders} from params', () => {
        expect(t('weather.excellent', { score: 92 })).toBe('Excellent (92/100)');
    });

    it('returns the key itself for an unknown key and warns once', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(t('weather.doesNotExist')).toBe('weather.doesNotExist');
        t('weather.doesNotExist');
        expect(warn).toHaveBeenCalledTimes(1);
        warn.mockRestore();
    });

    it('leaves a placeholder untouched when its param is missing', () => {
        expect(t('weather.excellent')).toBe('Excellent ({score}/100)');
    });
});
