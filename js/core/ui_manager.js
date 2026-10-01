/**
 * CORE - UI Manager
 * Handles loading of shared HTML components (header, footer),
 * theme logic (dark/light mode), and global navigation UI updates.
 */

import GlobalState from './app_state.js';
import StorageService from '../services/storage.js';
import { capitalizeFirstLetter } from '../utils/text_utils.js';

class UIManager {
    constructor() {
        this.basePath = '.';
    }

    async init() {
        // Apply initial theme based on State
        this.applyThemeMode(GlobalState.get('themeMode'));
        this.updateAppTheme(GlobalState.get('level'));

        // Listen for state changes
        GlobalState.subscribe('themeMode', (mode) => this.applyThemeMode(mode));
        GlobalState.subscribe('level', (level) => {
            this.updateAppTheme(level);
            this.restoreLevelUI();
        });
        GlobalState.subscribe('mode', () => this.updateHeaderNavigation());

        // Load Header and Footer
        await this.loadComponents();
    }

    async loadComponents(basePath = '.') {
        this.basePath = basePath;

        // Add cache buster to bypass old components cache
        const v = '?v=2026.07.10_v10';

        const componentMap = [
            { id: 'app-header', url: basePath + '/components/header.html' + v },
            { id: 'app-footer', url: basePath + '/components/footer.html' + v, selector: '.app-footer-placeholder' },
        ];

        for (const comp of componentMap) {
            try {
                const fetchUrl = `${comp.url}&t=${Date.now()}`;
                const response = await fetch(fetchUrl);
                if (!response.ok) throw new Error(`Network response was not ok for ${comp.url}`);
                const html = await response.text();

                const targets = comp.selector
                    ? document.querySelectorAll(comp.selector)
                    : document.getElementById(comp.id)
                      ? [document.getElementById(comp.id)]
                      : [];

                targets.forEach((el) => {
                    el.innerHTML = html;

                    // Path correction if not at root
                    if (basePath !== '.') {
                        el.querySelectorAll('[src], [href]').forEach((node) => {
                            const attr = node.hasAttribute('src') ? 'src' : 'href';
                            const val = node.getAttribute(attr);
                            if (!val.match(/^(http|\/\/|#|mailto:)/)) {
                                node.setAttribute(attr, basePath + '/' + val);
                            }
                        });
                    }
                });
            } catch (error) {
                console.warn('Error loading component:', comp.url, error);
            }
        }

        // Post-load initialization
        this.updateHeaderNavigation();
        this.applyThemeMode(GlobalState.get('themeMode'));
        this.restoreLevelUI();

        if (window.FirebaseAuthEngine && typeof window.FirebaseAuthEngine.updateHeaderUI === 'function') {
            window.FirebaseAuthEngine.updateHeaderUI();
        }
    }

    toggleTheme() {
        const current = GlobalState.get('themeMode');
        const modes = ['auto', 'light', 'dark'];
        const next = modes[(modes.indexOf(current) + 1) % modes.length];

        StorageService.set(StorageService.KEYS.THEME_MODE, next);
        GlobalState.set('themeMode', next);

        if (window.FirebaseAuthEngine && window.FirebaseAuthEngine.enabled && window.FirebaseAuthEngine.currentUser) {
            window.FirebaseAuthEngine.savePreferencesToCloud();
            // Mise à jour en temps réel de "Dernière synchro" après changement de thème
            if (typeof window.FirebaseAuthEngine.triggerDebouncedSync === 'function') {
                window.FirebaseAuthEngine.triggerDebouncedSync();
            }
        }
    }

    applyThemeMode(mode) {
        const body = document.body;
        const iconSun = /** @type {HTMLElement} */ (document.querySelector('.ri-sun-line'));
        const iconMoon = /** @type {HTMLElement} */ (document.querySelector('.ri-moon-line'));
        const btn = document.getElementById('theme-toggle');

        // Le <head> pose `light-mode` sur <html> au chargement (anti-flash) et personne ne le retirait :
        // après un passage en sombre à l'exécution (bouton ou OS), les jetons clairs de html.light-mode
        // restaient actifs pendant que body.dark-theme appliquait les règles sombres (header, nav).
        // <html> et <body> doivent toujours dire la même chose.
        const root = document.documentElement;
        root.classList.remove('light-mode', 'dark-theme', 'dark-mode');
        body.classList.remove('light-mode', 'dark-mode', 'dark-theme');
        if (iconSun) iconSun.style.opacity = '0.5';
        if (iconMoon) iconMoon.style.opacity = '0.5';

        let effectiveMode = mode;
        if (effectiveMode === 'auto') {
            const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            effectiveMode = systemDark ? 'dark' : 'light';
            if (btn) btn.title = 'Mode: Auto';
            if (iconSun && iconMoon) {
                iconSun.style.opacity = '1';
                iconMoon.style.opacity = '1';
            }
        } else {
            if (btn) btn.title = 'Mode: ' + capitalizeFirstLetter(effectiveMode);
            if (effectiveMode === 'light') {
                if (iconSun) iconSun.style.opacity = '1';
            } else {
                if (iconMoon) iconMoon.style.opacity = '1';
            }
        }

        root.style.colorScheme = effectiveMode;

        if (effectiveMode === 'dark') {
            body.classList.add('dark-mode', 'dark-theme');
            root.classList.add('dark-theme');
        } else {
            body.classList.add('light-mode');
            root.classList.add('light-mode');
        }
    }

    updateAppTheme(level) {
        const root = document.documentElement;
        let color = '#0ea5e9'; // Default Blue (BP)

        if (level === 'BI')
            color = '#22c55e'; // Green
        else if (level === 'BPC')
            color = '#8B4513'; // Brown
        else if (level === 'TREUIL')
            color = '#6366f1'; // Indigo
        else if (level === 'ALL') color = '#64748b'; // Slate

        root.style.setProperty('--accent-blue', color);
    }

    updateHeaderNavigation() {
        const navSlot = document.querySelector('.header-nav-slot');
        const currentMode = GlobalState.get('mode');

        if (navSlot) {
            navSlot.innerHTML = '';
            // The back button has been removed from smartphone mode as requested.
        }

        // Update Desktop Nav Active State
        const desktopNavBtns = document.querySelectorAll('.desktop-main-nav .nav-menu-btn');
        if (desktopNavBtns.length > 0) {
            desktopNavBtns.forEach((btn) => {
                btn.classList.remove('active');
                if (btn.getAttribute('data-target') === currentMode) {
                    btn.classList.add('active');
                }
            });

            // Handle sub-modes that map to parent modes
            if (['QCM', 'QCM_BANK', 'LIBRARY', 'COURSE', 'STATS', 'ADVENTURE'].includes(currentMode)) {
                const theoryBtn = document.querySelector('.desktop-main-nav .nav-menu-btn[data-target="THEORY"]');
                if (theoryBtn) theoryBtn.classList.add('active');
            }
        }
    }

    restoreLevelUI(attempts = 0) {
        const levelSelect = /** @type {HTMLSelectElement} */ (document.getElementById('global-level-select'));
        const currentLevel = GlobalState.get('level');

        if (levelSelect && currentLevel) {
            levelSelect.value = currentLevel;
            const targetOption = /** @type {HTMLOptionElement} */ (
                levelSelect.querySelector(`option[value="${currentLevel}"]`)
            );
            if (targetOption) targetOption.selected = true;
            return;
        }

        // If the header component is still loading, retry at most 3 times (150ms max)
        if (attempts < 3) {
            setTimeout(() => this.restoreLevelUI(attempts + 1), 50);
        }
    }

    showManual(section = 'about') {
        if (section === 'contextual') {
            const activeScreen = document.querySelector('.mode-screen.active');
            if (activeScreen) {
                const id = activeScreen.id;
                if (id.includes('sites')) section = 'sites';
                else if (id.includes('logbook')) section = 'logbook';
                else if (id.includes('safety')) section = 'safety';
                else if (id.includes('library') || id.includes('course')) section = 'library';
                else if (id.includes('qcm')) section = 'qcm';
                else if (id.includes('stats')) section = 'stats';
                else section = 'about';
            } else {
                section = 'about';
            }
        }

        const modal = /** @type {HTMLDialogElement & { _cancelBound?: boolean }} */ (
            document.getElementById('manual-modal')
        );
        if (modal) {
            if (typeof modal.showModal === 'function' && !modal.open) {
                modal.showModal();
                if (!modal._cancelBound) {
                    modal._cancelBound = true;
                    modal.addEventListener('cancel', (e) => {
                        e.preventDefault();
                        this.hideManual();
                    });
                }
            }
            modal.style.display = 'flex';
            void modal.offsetWidth;
            modal.classList.add('active');
            this.showManualSection(section);
        }
    }

    hideManual() {
        const modal = /** @type {HTMLDialogElement & { _cancelBound?: boolean }} */ (
            document.getElementById('manual-modal')
        );
        if (modal) {
            modal.classList.remove('active');
            setTimeout(() => {
                if (!modal.classList.contains('active')) {
                    if (typeof modal.close === 'function' && modal.open) {
                        modal.close();
                    }
                    modal.style.display = 'none';
                }
            }, 300);
        }
    }

    showManualSection(section) {
        document.querySelectorAll('.manual-tab-btn').forEach((btn) => btn.classList.remove('active'));
        const tab = document.getElementById(`manual-tab-${section}`);
        if (tab) tab.classList.add('active');

        /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('.manual-section')).forEach(
            (sec) => (sec.style.display = 'none'),
        );
        const sec = document.getElementById(`manual-section-${section}`);
        if (sec) sec.style.display = 'block';
    }
}

export default new UIManager();
