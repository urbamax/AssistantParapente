/**
 * CORE - Router
 * Handles navigation and screen lifecycle (mount/unmount)
 */

import GlobalState from './app_state.js';
import StorageService from '../services/storage.js';
import { escapeHTML } from './security.js';
import { t } from '../utils/i18n.js';
import AccessService, { ROLES } from '../services/access_service.js';

const LAZY = Symbol('lazyViewModule');

/**
 * Écran chargé à la demande : `importer` est par exemple `() => import('../views/quiz.js')`.
 * Le module n'est téléchargé qu'au premier besoin (premier passage sur l'écran, ou premier clic sur
 * l'une de ses commandes), puis gardé. Plusieurs routes peuvent partager le même descripteur
 * (QCM, QCM_BANK et STATS affichent la même vue : elle n'est chargée qu'une fois).
 * Un échec (réseau coupé) n'est pas gardé : le prochain essai recharge.
 * @param {() => Promise<any>} importer
 */
export function lazyViewModule(importer) {
    let view;
    let pending = null;
    return {
        [LAZY]: true,
        /** @returns {Promise<any>} */
        load() {
            if (view) return Promise.resolve(view);
            pending ??= importer().then(
                (module) => (view = module.default ?? module),
                (error) => {
                    pending = null;
                    throw error;
                },
            );
            return pending;
        },
        /** La vue si elle est déjà chargée, sinon undefined (sans la charger). */
        peek() {
            return view;
        },
    };
}

const isLazy = (entry) => Boolean(entry && entry[LAZY]);

/**
 * Remplace une vue pas encore chargée dans le code qui l'appelle (gestionnaires de clics de main.js) :
 * chaque méthode appelée charge l'écran si besoin, puis l'exécute. Une méthode qui n'existe pas sur la
 * vue renvoie null, comme l'ancien `vue[action] ? vue[action](…) : null`.
 *
 * Si l'écran est déjà chargé, la méthode est appelée TOUT DE SUITE, de façon synchrone, et son résultat
 * est renvoyé tel quel : même déroulement qu'un appel direct (l'événement du navigateur n'est pas fini,
 * `e.preventDefault()` agit, une liste de fichiers vivante n'est pas encore vidée). Seul le premier
 * appel, avant le chargement, est asynchrone : il renvoie alors une promesse (à attendre si l'ordre compte).
 * Dans ce cas, ne pas s'appuyer sur un objet vivant du navigateur (FileList, événement) : le copier avant.
 * @param {ReturnType<typeof lazyViewModule>} module
 * @returns {Record<string, (...args: any[]) => any>} n'importe quelle méthode de la vue (promesse seulement avant le chargement)
 */
export function viewProxy(module) {
    return /** @type {any} */ (
        new Proxy(
            {},
            {
                get(_target, property) {
                    // Jamais « then » ni un symbole : le proxy ne doit pas passer pour une promesse.
                    if (typeof property === 'symbol' || property === 'then') return undefined;
                    return (...args) => {
                        const call = (view) => (typeof view[property] === 'function' ? view[property](...args) : null);
                        const loaded = module.peek();
                        return loaded ? call(loaded) : module.load().then(call);
                    };
                },
            },
        )
    );
}

/** Écran d'erreur affiché à la place d'une vue qui n'a pas pu être chargée ou montée. */
function renderCrashScreen(screenEl, mode, error) {
    if (!screenEl) return;
    // Le détail technique de l'erreur n'est montré qu'à la bêta et au propriétaire.
    const technicalDetails = AccessService.has(ROLES.BETA)
        ? `<pre style="background: var(--surface-hover, rgba(0,0,0,0.05)); padding: 1rem; border-radius: 8px; text-align: left; max-width: 100%; overflow-x: auto; font-size: 0.8rem; margin-bottom: 2rem; border: 1px solid var(--border-color);">${escapeHTML(error.message || String(error))}</pre>`
        : '';
    screenEl.innerHTML = `
                        <div class="container" style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 50vh; text-align: center; margin-top: 2rem;">
                            <div class="empty-icon" style="color: var(--danger-color); font-size: 4rem; margin-bottom: 1rem;">🔥</div>
                            <h2 style="margin-bottom: 1rem;">${escapeHTML(t('errors.crashTitle'))}</h2>
                            <p style="margin-bottom: 2rem; color: var(--text-muted);">${escapeHTML(t('errors.crashText')).replace('{module}', `<strong>${escapeHTML(mode)}</strong>`)}</p>
                            ${technicalDetails}
                            <button class="btn btn-primary" data-action="reloadApp">${escapeHTML(t('errors.reloadApp'))}</button>
                        </div>
                    `;
}

class Router {
    constructor() {
        this.routes = new Map();
        this.activeRoute = null;
        this._activeTransition = null;
    }

    /** @param {string} mode @param {object | ReturnType<typeof lazyViewModule>} viewModule une vue, ou un écran chargé à la demande */
    register(mode, viewModule) {
        this.routes.set(mode, viewModule);
    }

    /** La vue de cette route si elle est disponible ; undefined si elle n'est pas encore chargée. */
    getView(mode) {
        const entry = this.routes.get(mode);
        return isLazy(entry) ? entry.peek() : entry;
    }

    /** La vue de cette route, chargée si besoin. @returns {Promise<any>} */
    async loadView(mode) {
        const entry = this.routes.get(mode);
        if (!entry) throw new Error(`Route not found: ${mode}`);
        return isLazy(entry) ? entry.load() : entry;
    }

    async navigate(mode, params = {}) {
        if (!this.routes.has(mode)) {
            console.error(`Route not found: ${mode}`);
            this.navigate('MENU');
            return;
        }
        console.time('ROUTER_NAVIGATE_TOTAL_' + mode);
        // Le téléchargement de l'écran démarre tout de suite, pendant le démontage de l'écran actuel
        // et la transition ; on n'attend son résultat qu'au moment de monter.
        const viewLoading = this.loadView(mode);
        viewLoading.catch(() => {}); // l'échec est traité plus bas ; évite un rejet non géré en attendant
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
        let view = null;
        let loadError = null;
        try {
            view = await viewLoading;
        } catch (e) {
            loadError = e;
            console.error(`Error loading ${mode}:`, e);
        }
        this.activeRoute = view;
        const screenEl = document.getElementById(`${mode.toLowerCase()}-screen`);

        console.timeEnd('ROUTER_HIDE_SCREENS');

        if (loadError) {
            renderCrashScreen(screenEl, mode, loadError);
        } else if (view.mount) {
            console.time('ROUTER_MOUNT_' + mode);
            try {
                await view.mount(params);
            } catch (e) {
                console.error(`Error mounting ${mode}:`, e);
                renderCrashScreen(screenEl, mode, e);
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
        if (view?.mount) {
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
            // Retour qui ferme la visionneuse de cours : l'écran en dessous reste tel quel (pas de remontage).
            if (document.body.classList.contains('course-viewer-open')) return;
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
