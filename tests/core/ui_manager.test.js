import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import UIManagerModule from '../../js/core/ui_manager.js';
import GlobalState from '../../js/core/app_state.js';

describe('UIManager', () => {
    afterEach(() => {
        vi.useRealTimers();
    });
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="app-header"></div>
            <div id="app-footer"></div>
            <div class="nav-menu-btn" data-target="SITES"></div>
            <select id="global-level-select">
                <option value="ALL">ALL</option>
                <option value="BI">BI</option>
                <option value="BP">BP</option>
                <option value="BPC">BPC</option>
            </select>
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

    it('shows a single accessible alert banner when parapente:storage-quota fires', async () => {
        await UIManagerModule.init();

        window.dispatchEvent(new CustomEvent('parapente:storage-quota', { detail: { key: 'parapente_logbook' } }));
        window.dispatchEvent(new CustomEvent('parapente:storage-quota', { detail: { key: 'parapente_logbook' } }));

        const alerts = document.querySelectorAll('#storage-quota-alert');
        expect(alerts).toHaveLength(1);
        expect(alerts[0].getAttribute('role')).toBe('alert');
        expect(alerts[0].textContent).toMatch(/stockage/i);

        const closeBtn = alerts[0].querySelector('button');
        expect(closeBtn).not.toBeNull();
        closeBtn.click();
        expect(document.getElementById('storage-quota-alert')).toBeNull();
    });

    it('lazily fetches and injects components/manual_modal.html on first showManual() call', async () => {
        const manualHtml = `
            <dialog id="manual-modal" style="display: none">
                <button id="manual-tab-qcm" class="manual-tab-btn"></button>
                <div id="manual-section-qcm" class="manual-section" style="display: none"></div>
            </dialog>`;
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            text: vi.fn().mockResolvedValue(manualHtml),
        });

        await UIManagerModule.showManual('qcm');

        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(global.fetch).toHaveBeenCalledWith('./components/manual_modal.html');
        expect(document.getElementById('manual-modal')).not.toBeNull();
        expect(document.getElementById('manual-tab-qcm').classList.contains('active')).toBe(true);
        expect(document.getElementById('manual-section-qcm').style.display).toBe('block');

        // Second call reuses the injected modal without re-fetching
        await UIManagerModule.showManual('qcm');
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('toggleTheme cycles auto -> light -> dark -> auto and triggers cloud sync when signed in', () => {
        const savePrefs = vi.fn();
        const triggerSync = vi.fn();
        window.FirebaseAuthEngine = {
            enabled: true,
            currentUser: { uid: 'u1' },
            savePreferencesToCloud: savePrefs,
            triggerDebouncedSync: triggerSync,
        };
        GlobalState.state.themeMode = 'auto';

        UIManagerModule.toggleTheme();
        expect(GlobalState.get('themeMode')).toBe('light');

        UIManagerModule.toggleTheme();
        expect(GlobalState.get('themeMode')).toBe('dark');

        UIManagerModule.toggleTheme();
        expect(GlobalState.get('themeMode')).toBe('auto');
        expect(savePrefs).toHaveBeenCalledTimes(3);
        expect(triggerSync).toHaveBeenCalledTimes(3);
        window.FirebaseAuthEngine = undefined;
    });

    it('updateHeaderNavigation activates THEORY on theory sub-modes and resets sub-menu aria-current', () => {
        document.body.innerHTML += `
            <nav class="desktop-main-nav">
                <button class="nav-menu-btn" data-target="SITES"></button>
                <button class="nav-menu-btn" data-target="THEORY"></button>
                <button class="nav-menu-btn" data-target="LOGBOOK"></button>
            </nav>
            <button data-logbook-tab="flights" aria-current="page"></button>
            <button data-safety-tab="ice" aria-current="page"></button>
        `;

        GlobalState.state.mode = 'REVISION_AXES';
        UIManagerModule.updateHeaderNavigation();

        const theoryBtn = document.querySelector('.desktop-main-nav [data-target="THEORY"]');
        expect(theoryBtn.classList.contains('active')).toBe(true);
        expect(document.querySelector('[data-logbook-tab]').getAttribute('aria-current')).toBe('false');
        expect(document.querySelector('[data-safety-tab]').getAttribute('aria-current')).toBe('false');
    });

    it('showManual("contextual") selects the section matching the active mode-screen and hideManual closes it', async () => {
        vi.useFakeTimers();
        document.body.innerHTML += `
            <div id="safety-screen" class="mode-screen active"></div>
            <dialog id="manual-modal" style="display: none">
                <button id="manual-tab-safety" class="manual-tab-btn"></button>
                <div id="manual-section-safety" class="manual-section" style="display: none"></div>
            </dialog>
        `;

        await UIManagerModule.showManual('contextual');
        const modal = document.getElementById('manual-modal');
        expect(modal.classList.contains('active')).toBe(true);
        expect(document.getElementById('manual-tab-safety').classList.contains('active')).toBe(true);
        expect(document.getElementById('manual-section-safety').style.display).toBe('block');

        UIManagerModule.hideManual();
        expect(modal.classList.contains('active')).toBe(false);
        vi.advanceTimersByTime(350);
        expect(modal.style.display).toBe('none');
        vi.useRealTimers();
    });

    it('loadComponents rewrites relative src/href attributes when basePath is not "."', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            text: vi.fn().mockResolvedValue('<header><img src="img/logo.png"><a href="#top">Top</a></header>'),
        });

        await UIManagerModule.loadComponents('/sub');
        const img = document.querySelector('#app-header img');
        const link = document.querySelector('#app-header a');
        expect(img.getAttribute('src')).toBe('/sub/img/logo.png');
        expect(link.getAttribute('href')).toBe('#top');
    });

    it('updateOfflineIndicator toggles #offline-pill hidden attribute based on online state', () => {
        document.body.innerHTML += '<span id="offline-pill" hidden>Hors ligne</span>';
        const pill = document.getElementById('offline-pill');

        UIManagerModule.updateOfflineIndicator(false);
        expect(pill.hidden).toBe(false);

        UIManagerModule.updateOfflineIndicator(true);
        expect(pill.hidden).toBe(true);
    });
});
