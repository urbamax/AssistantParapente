/**
 * CORE - Router
 * Handles navigation and screen lifecycle (mount/unmount)
 */

import GlobalState from './app_state.js';
import StorageService from '../services/storage.js';
import { escapeHTML } from './security.js';
import { t } from '../utils/i18n.js';

class Router {
    constructor() {
        this.routes = new Map();
        this.activeRoute = null;
        this._activeTransition = null;
    }

    register(mode, viewModule) {
        this.routes.set(mode, viewModule);
    }

    getView(mode) {
        return this.routes.get(mode);
    }

    async navigate(mode, params = {}) {
        if (!this.routes.has(mode)) {
            console.error(`Route not found: ${mode}`);
            this.navigate('MENU');
            return;
        }
        console.time('ROUTER_NAVIGATE_TOTAL_' + mode);
        console.time('ROUTER_UNMOUNT_PREVIOUS');
        // Unmount current view
        if (this.activeRoute && this.activeRoute.unmount) {
            try {
                await this.activeRoute.unmount();
            } catch (e) {
                console.error(`Error unmounting ${GlobalState.get('mode')}:`, e);
            }
        }
        console.timeEnd('ROUTER_UNMOUNT_PREVIOUS');

        console.time('ROUTER_HIDE_SCREENS');
        const updateDOM = () => {
            // Hide all screens
            document.querySelectorAll('.mode-screen').forEach((s) => s.classList.remove('active'));

            const screenEl = document.getElementById(`${mode.toLowerCase()}-screen`);
            if (screenEl) {
                screenEl.classList.add('active');
            }
        };

        // Utilise l'API native View Transitions si supportée par le navigateur
        // et non restreinte par prefers-reduced-motion (Accessibilité / performance)
        const prefersReducedMotion =
            typeof window !== 'undefined' &&
            window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (
            !prefersReducedMotion &&
            typeof document !== 'undefined' &&
            typeof document.startViewTransition === 'function'
        ) {
            // Une navigation qui arrive pendant qu'une transition précédente est encore en
            // cours (double clic, navigation rapide) la ferait sinon avorter implicitement :
            // le navigateur rejette `ready` (et potentiellement `updateCallbackDone`/`finished`)
            // avec une AbortError/InvalidStateError, qui remonte comme rejet de promesse non géré
            // (bannière GLOBAL ERROR) si personne ne l'écoute. On l'arrête nous-mêmes
            // explicitement puis on avale ces trois rejets attendus (vérifié en direct : seul
            // `ready` rejetait réellement ici, mais rien ne garantit que ce soit toujours le cas
            // selon le moteur).
            if (this._activeTransition) {
                this._activeTransition.skipTransition();
            }
            const transition = document.startViewTransition(() => updateDOM());
            this._activeTransition = transition;
            transition.ready.catch(() => {});
            transition.finished
                .catch(() => {})
                .finally(() => {
                    if (this._activeTransition === transition) {
                        this._activeTransition = null;
                    }
                });
            // Le callback de transition est asynchrone : on attend qu'il ait basculé les
            // écrans AVANT de monter la vue, sinon il écraserait l'écran activé par mount()
            // (ex. QuizView active qcm-setup-screen, puis le callback réactivait qcm-screen
            // → écran bloqué sur « Chargement… »).
            await transition.updateCallbackDone.catch(() => {});
        } else {
            updateDOM();
        }

        // Update State
        GlobalState.set('lastMode', GlobalState.get('mode'));
        GlobalState.set('mode', mode);
        StorageService.set('LAST_ACTIVE_ROUTE', mode);

        // Mount new view
        const view = this.routes.get(mode);
        this.activeRoute = view;
        const screenEl = document.getElementById(`${mode.toLowerCase()}-screen`);

        console.timeEnd('ROUTER_HIDE_SCREENS');

        if (view.mount) {
            console.time('ROUTER_MOUNT_' + mode);
            try {
                await view.mount(params);
            } catch (e) {
                console.error(`Error mounting ${mode}:`, e);
                if (screenEl) {
                    const safeError = escapeHTML(e.message || String(e));
                    screenEl.innerHTML = `
                        <div class="container" style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 50vh; text-align: center; margin-top: 2rem;">
                            <div class="empty-icon" style="color: var(--danger-color); font-size: 4rem; margin-bottom: 1rem;">🔥</div>
                            <h2 style="margin-bottom: 1rem;">${escapeHTML(t('errors.crashTitle'))}</h2>
                            <p style="margin-bottom: 2rem; color: var(--text-muted);">${escapeHTML(t('errors.crashText')).replace('{module}', `<strong>${escapeHTML(mode)}</strong>`)}</p>
                            <pre style="background: var(--surface-hover, rgba(0,0,0,0.05)); padding: 1rem; border-radius: 8px; text-align: left; max-width: 100%; overflow-x: auto; font-size: 0.8rem; margin-bottom: 2rem; border: 1px solid var(--border-color);">${safeError}</pre>
                            <button class="btn btn-primary" data-action="reloadApp">${escapeHTML(t('errors.reloadApp'))}</button>
                        </div>
                    `;
                }
            }
        }

        // Push/replace state for browser history
        if (params.pushState !== false) {
            const url = new URL(window.location.href);
            const currentModeInUrl = url.searchParams.get('mode');
            url.searchParams.set('mode', mode);
            if (currentModeInUrl === mode) {
                window.history.replaceState({ mode, params }, '', url);
            } else {
                window.history.pushState({ mode, params }, '', url);
            }
        }
        if (view.mount) {
            console.timeEnd('ROUTER_MOUNT_' + mode);
        }
        console.timeEnd('ROUTER_NAVIGATE_TOTAL_' + mode);
    }

    goBack() {
        const lastMode = GlobalState.get('lastMode');
        if (lastMode && lastMode !== 'MENU') {
            this.navigate(lastMode);
        } else {
            this.navigate('MENU');
        }
    }

    initHistory() {
        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.mode) {
                this.navigate(e.state.mode, { ...e.state.params, pushState: false });
            } else {
                this.navigate('MENU', { pushState: false });
            }
        });
    }
}

const AppRouter = new Router();
export default AppRouter;
