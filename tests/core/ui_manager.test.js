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

    it('updateAppTheme updates css variables based on level', () => {
        UIManagerModule.updateAppTheme('BI');
        expect(document.documentElement.style.getPropertyValue('--accent-blue')).toBe('#22c55e');

        UIManagerModule.updateAppTheme('BPC');
        expect(document.documentElement.style.getPropertyValue('--accent-blue')).toBe('#8B4513');
    });

    it('loadComponents fetches HTML and inserts it', async () => {
        await UIManagerModule.loadComponents();

        expect(global.fetch).toHaveBeenCalled();
        expect(document.getElementById('app-header').innerHTML).toBe('<header>Mocked Header</header>');
    });
});
