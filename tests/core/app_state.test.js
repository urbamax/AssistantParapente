import { describe, it, expect, beforeEach, vi } from 'vitest';
import GlobalState from '../../js/core/app_state.js';
import StorageService from '../../js/services/storage.js';

describe('AppState', () => {

    beforeEach(() => {
        localStorage.clear();
        GlobalState.listeners.clear();
        GlobalState.state = {
            level: 'ALL',
            mode: 'MENU',
            themeMode: 'auto',
            currentCourseId: null,
            lastMode: 'MENU',
            isOnline: true,
            userPreferences: {}
        };
    });

    it('set saves level to StorageService and notifies subscribers', () => {
        const spy = vi.fn();
        GlobalState.subscribe('level', spy);
        
        // Initial call from subscribe
        expect(spy).toHaveBeenCalledWith('ALL');
        
        GlobalState.set('level', 'BP');
        expect(spy).toHaveBeenCalledWith('BP');
        
        expect(StorageService.get(StorageService.KEYS.USER_LEVEL)).toBe('BP');
    });

    it('set saves themeMode to StorageService', () => {
        GlobalState.set('themeMode', 'dark');
        expect(StorageService.get(StorageService.KEYS.THEME_MODE)).toBe('dark');
    });

    it('unsubscribe removes the callback', () => {
        const spy = vi.fn();
        const unsubscribe = GlobalState.subscribe('mode', spy);
        
        expect(spy).toHaveBeenCalledTimes(1); // from initial subscribe
        
        GlobalState.set('mode', 'SITES');
        expect(spy).toHaveBeenCalledTimes(2);
        
        unsubscribe();
        
        GlobalState.set('mode', 'QUIZ');
        expect(spy).toHaveBeenCalledTimes(2); // not called again
    });
});
