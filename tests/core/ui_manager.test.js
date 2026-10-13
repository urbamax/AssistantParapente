import { describe, it, expect, beforeEach, vi } from 'vitest';
import UIManagerModule from '../../js/core/ui_manager.js';
import GlobalState from '../../js/core/app_state.js';

describe('UIManager', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="app-header"></div>
            <div id="app-footer"></div>
            <div class="nav-menu-btn" data-target="SITES"></div>
        `;
        GlobalState.state.level = 'ALL';
        GlobalState.state.themeMode = 'auto';
        GlobalState.listeners.clear();

        // Mock fetch for loadComponents
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            text: vi.fn().mockResolvedValue('<header>Mocked Header</header>'),
        });
    });

    it('applyThemeMode toggles dark-mode class on body', () => {
        UIManagerModule.applyThemeMode('dark');
        expect(document.body.classList.contains('dark-mode')).toBe(true);

        UIManagerModule.applyThemeMode('light');
        expect(document.body.classList.contains('dark-mode')).toBe(false);
    });

    it('keeps <html> and <body> in agreement when the theme changes after load', () => {
        // The <head> script marks <html> as light before the app boots, e.g. for a light-OS visitor.
        document.documentElement.classList.add('light-mode');

        UIManagerModule.applyThemeMode('dark');
        expect(document.documentElement.classList.contains('light-mode')).toBe(false);
        expect(document.body.classList.contains('dark-theme')).toBe(true);

        UIManagerModule.applyThemeMode('light');
        expect(document.documentElement.classList.contains('light-mode')).toBe(true);
        expect(document.body.classList.contains('light-mode')).toBe(true);
        expect(document.body.classList.contains('dark-theme')).toBe(false);
    });

    it('updateAppTheme updates css variables based on level', () => {
        UIManagerModule.updateAppTheme('BI');
        expect(document.documentElement.style.getPropertyValue('--accent-orange')).toBe('#22c55e');

        UIManagerModule.updateAppTheme('BPC');
        expect(document.documentElement.style.getPropertyValue('--accent-orange')).toBe('#8B4513');
    });

    it('loadComponents fetches HTML and inserts it', async () => {
        await UIManagerModule.loadComponents();

        expect(global.fetch).toHaveBeenCalled();
        expect(document.getElementById('app-header').innerHTML).toBe('<header>Mocked Header</header>');
    });

    it('restoreLevelUI updates global-level-select immediately and returns', () => {
        document.body.innerHTML += `
            <select id="global-level-select">
                <option value="BI">BI</option>
                <option value="BP">BP</option>
                <option value="BPC">BPC</option>
            </select>
        `;
        GlobalState.state.level = 'BP';

        const setTimeoutSpy = vi.spyOn(window, 'setTimeout');
        UIManagerModule.restoreLevelUI();

        const select = document.getElementById('global-level-select');
        expect(select.value).toBe('BP');
        // When found, no trailing timeout should be scheduled
        expect(setTimeoutSpy).not.toHaveBeenCalled();
        setTimeoutSpy.mockRestore();
    });
});
