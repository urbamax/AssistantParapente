import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { bootApplication } from '../../js/core/main.js';
import GlobalState from '../../js/core/app_state.js';
import AppEvents from '../../js/core/events.js';
import AppRouter from '../../js/core/router.js';
import AccessService from '../../js/services/access_service.js';
import QuizService from '../../js/services/quiz_service.js';
import UIManager from '../../js/core/ui_manager.js';

describe('main.js — bootApplication & global event handlers', () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        document.body.innerHTML = `
            <div id="app-header"></div>
            <div id="app-footer"></div>
            <div id="welcome-screen" class="mode-screen"></div>
            <div id="start-screen" class="mode-screen"><div class="dashboard-content"></div></div>
            <div id="library-screen" class="mode-screen"></div>
            <div id="sites-screen" class="mode-screen"></div>
            <iframe id="course-pdf-frame" src="about:blank"></iframe>
            <input id="global-igc-input" type="file" />
            <div class="nav-dropdown">
                <button id="nav-theory-btn" data-action="toggleNavSubMenu" aria-expanded="false"></button>
                <div id="nav-theory-menu" class="nav-dropdown-menu"></div>
            </div>
            <input id="other-field" style="display: none" />
            <button id="hidden-click-target" type="button"></button>
        `;
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'time').mockImplementation(() => {});
        vi.spyOn(console, 'timeEnd').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(UIManager, 'init').mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        AccessService.clear();
        window.FirebaseAuthEngine = undefined;
    });

    it('boots application, clears stale reload marker, registers routes and global handlers', async () => {
        sessionStorage.setItem('ap_stale_module_reloaded', '1');
        await bootApplication();

        expect(sessionStorage.getItem('ap_stale_module_reloaded')).toBeNull();
        expect(AppEvents.handlers.has('navigate')).toBe(true);
        expect(AppEvents.handlers.has('changeLevel')).toBe(true);
        expect(AppEvents.handlers.has('goBack')).toBe(true);
        expect(AppEvents.handlers.has('setQcmMode')).toBe(true);
        expect(AppEvents.handlers.has('toggleNavSubMenu')).toBe(true);
        expect(AppEvents.handlers.has('toggleOtherField')).toBe(true);
    });

    it('handles changeLevel, toggleOtherField, triggerClick and toggleNavSubMenu / Escape', async () => {
        await bootApplication();

        const savePrefs = vi.fn();
        const triggerSync = vi.fn();
        window.FirebaseAuthEngine = {
            enabled: true,
            currentUser: { uid: 'u1' },
            savePreferencesToCloud: savePrefs,
            triggerDebouncedSync: triggerSync,
        };

        AppEvents.dispatch('changeLevel', 'BPC', null, null);
        expect(GlobalState.get('level')).toBe('BPC');
        expect(savePrefs).toHaveBeenCalledTimes(1);
        expect(triggerSync).toHaveBeenCalledTimes(1);

        // toggleOtherField
        const toggleTarget = /** @type {HTMLElement} */ ({ dataset: { toggleId: 'other-field' } });
        AppEvents.dispatch('toggleOtherField', 'Autre', null, toggleTarget);
        expect(document.getElementById('other-field').style.display).toBe('block');
        AppEvents.dispatch('toggleOtherField', 'Standard', null, toggleTarget);
        expect(document.getElementById('other-field').style.display).toBe('none');

        // triggerClick
        const clickSpy = vi.fn();
        document.getElementById('hidden-click-target').addEventListener('click', clickSpy);
        AppEvents.dispatch('triggerClick', 'hidden-click-target', null, null);
        expect(clickSpy).toHaveBeenCalledTimes(1);

        // toggleNavSubMenu + Escape close
        const btn = document.getElementById('nav-theory-btn');
        const menu = document.getElementById('nav-theory-menu');
        AppEvents.dispatch('toggleNavSubMenu', 'nav-theory-menu', null, btn);
        expect(menu.classList.contains('active')).toBe(true);
        expect(btn.getAttribute('aria-expanded')).toBe('true');

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(menu.classList.contains('active')).toBe(false);
        expect(btn.getAttribute('aria-expanded')).toBe('false');
    });

    it('enforces setQcmMode fallback to TRAINING on TREUIL level and handles goBack from COURSE', async () => {
        await bootApplication();

        GlobalState.set('level', 'TREUIL');
        const setModeSpy = vi.spyOn(QuizService, 'setMode');
        AppEvents.dispatch('setQcmMode', 'EXAM', null, null);
        expect(setModeSpy).toHaveBeenCalledWith('TRAINING');

        // goBack from COURSE closes PDF frame and navigates to LIBRARY
        const navSpy = vi.spyOn(AppRouter, 'navigate').mockResolvedValue(undefined);
        GlobalState.set('mode', 'COURSE');
        document.body.classList.add('course-open');
        AppEvents.dispatch('goBack', null, null, null);
        expect(document.body.classList.contains('course-open')).toBe(false);
        expect(navSpy).toHaveBeenCalledWith('LIBRARY');
    });

    it('redirects away from restricted route when user loses owner role', async () => {
        await bootApplication();
        AccessService.setRoles('u1', ['owner']);
        GlobalState.set('mode', 'SITES');

        const navSpy = vi.spyOn(AppRouter, 'navigate').mockResolvedValue(undefined);
        AccessService.clear();
        expect(navSpy).toHaveBeenCalledWith('WELCOME');
    });

    it('mounts and unmounts MENU route cleanly', async () => {
        await bootApplication();
        await AppRouter.navigate('MENU', { pushState: false });
        expect(document.getElementById('start-screen').classList.contains('active')).toBe(true);

        await AppRouter.navigate('WELCOME', { pushState: false });
        expect(document.getElementById('start-screen').classList.contains('active')).toBe(false);
    });
});
