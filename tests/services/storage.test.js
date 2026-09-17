import { describe, it, expect, beforeEach } from 'vitest';
import StorageService from '../../js/services/storage.js';

describe('StorageService', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('set and get work correctly with JSON data', () => {
        const obj = { prop: 'value', num: 42 };
        StorageService.set(StorageService.KEYS.USER_PREFS, obj);

        const retrieved = StorageService.get(StorageService.KEYS.USER_PREFS);
        expect(retrieved).toEqual(obj);
    });

    it('get returns defaultValue if key is missing', () => {
        const def = { gdpr: true };
        const retrieved = StorageService.get('missing_key', def);
        expect(retrieved).toBe(def);
    });

    it('get handles corrupted JSON gracefully', () => {
        localStorage.setItem(StorageService.KEYS.STATE, '{invalid_json');

        const retrieved = StorageService.get(StorageService.KEYS.STATE, 'fallback');
        // If JSON.parse fails, StorageService falls back to returning the raw string
        expect(retrieved).toBe('{invalid_json');
    });

    it('remove deletes the key', () => {
        StorageService.set('test_key', 'test_val');
        expect(StorageService.get('test_key')).toBe('test_val');

        StorageService.remove('test_key');
        expect(StorageService.get('test_key')).toBeNull();
    });
});
