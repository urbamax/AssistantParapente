/**
 * CORE - Event Delegator
 * Replaces inline events (onclick, onchange) with a centralized delegation mechanism.
 */

import AppRouter from './router.js';
import GdprEngine from '../gdpr_engine.js';

// Elements whose data-action runs on change, never on click (spec 019).
export const FORM_FIELDS = ['SELECT', 'INPUT', 'TEXTAREA'];

class EventDelegator {
    constructor() {
        this.handlers = new Map();
        this._handledByView = new WeakSet();
    }

    // A view with its own capture-phase delegation (SitesView) runs bare data-action names itself
    // and marks the event: dispatch() then neither warns nor runs a fallback engine for it (spec 016).
    // Registering those names here instead would run view actions twice (a menu toggle would
    // open and close on the same click).
    markHandled(event) {
        if (event) this._handledByView.add(event);
    }

    // data-args: JSON-ish ("['a']", "3") or a bare string. IDs (e.g. Date.now().toString()) look
    // like valid JSON numbers/booleans, so they are kept as strings to keep `===` comparisons
    // against stored string ids working downstream.
    _parseArgs(raw) {
        let args = raw;
        try {
            if (args) {
                const parsed = JSON.parse(args.replace(/'/g, '"'));
                args = typeof parsed === 'number' || typeof parsed === 'boolean' ? args.replace(/'/g, '') : parsed;
            }
        } catch {
            // If it's a simple string or single quote string
            if (args) args = args.replace(/'/g, '');
        }
        return args;
    }

    // Verrouille le zoom de la page. Android (Chrome) respecte la balise viewport ; iOS Safari l'ignore et
    // n'obéit qu'aux événements de geste, d'où ces écouteurs. Les cartes (Leaflet) zooment avec leurs
    // propres événements tactiles, qui ne sont pas des gestes Safari : elles ne sont pas touchées.
    _lockPageZoom() {
        for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
            document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
        }
    }

    init() {
        this._lockPageZoom();

        // Global click delegator
        document.addEventListener('click', (e) => {
            // data-backdrop-action: fires only when the overlay itself (not its content) is clicked.
            const backdrop = /** @type {HTMLElement} */ (e.target).closest('[data-backdrop-action]');
            if (backdrop && e.target === backdrop) {
                this.dispatch(
                    backdrop.getAttribute('data-backdrop-action'),
                    this._parseArgs(backdrop.getAttribute('data-args')),
                    e,
                    backdrop,
                );
            }

            const target = /** @type {HTMLInputElement | null} */ (
                /** @type {HTMLElement} */ (e.target).closest('[data-action]')
            );
            if (!target) return;
            // Menus, fields and checkboxes act on change (see below): a click only opens or focuses
            // them. Dispatching it too ran the action with no value (spec 019).
            if (FORM_FIELDS.includes(target.tagName)) return;
            if (target.hasAttribute('data-prevent-default')) e.preventDefault();

            this.dispatch(
                target.getAttribute('data-action'),
                this._parseArgs(target.getAttribute('data-args')),
                e,
                target,
            );
        });

        // Global change delegator
        document.addEventListener('change', (e) => {
            const changeTarget = /** @type {HTMLInputElement | null} */ (
                /** @type {HTMLElement} */ (e.target).closest('[data-change-action]')
            );
            if (changeTarget) {
                this.dispatch(changeTarget.getAttribute('data-change-action'), changeTarget.value, e, changeTarget);
            }

            const target = /** @type {HTMLInputElement | null} */ (
                /** @type {HTMLElement} */ (e.target).closest('[data-action]')
            );
            if (!target) return;

            this.dispatch(target.getAttribute('data-action'), target.value, e, target);
        });

        // Live typing (search boxes, sliders, form previews)
        document.addEventListener('input', (e) => {
            const target = /** @type {HTMLInputElement | null} */ (
                /** @type {HTMLElement} */ (e.target).closest('[data-input-action]')
            );
            if (target) this.dispatch(target.getAttribute('data-input-action'), target.value, e, target);
        });

        // Clavier (spec 010) : Entrée ou Espace sur un « bouton » non natif (div/span… avec
        // role="button") déclenche son action comme un clic. Les boutons, liens et champs natifs
        // gèrent déjà le clavier eux-mêmes : on ne les traite pas ici (pas de double action).
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            const target = /** @type {HTMLElement | null} */ (
                /** @type {HTMLElement} */ (e.target).closest('[data-action][role="button"]')
            );
            if (!target || target !== e.target) return;
            if (['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
            if (target.tagName === 'A' && target.hasAttribute('href')) return;
            e.preventDefault(); // Espace ne fait pas défiler la page
            this.dispatch(
                target.getAttribute('data-action'),
                this._parseArgs(target.getAttribute('data-args')),
                e,
                target,
            );
        });

        // Enter key on a text field
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter') return;
            const target = /** @type {HTMLInputElement | null} */ (
                /** @type {HTMLElement} */ (e.target).closest('[data-enter-action]')
            );
            if (target) this.dispatch(target.getAttribute('data-enter-action'), target.value, e, target);
        });
    }

    register(actionName, callback) {
        this.handlers.set(actionName, callback);
    }

    dispatch(action, args, event, target) {
        // Core routing actions
        if (action === 'navigate') {
            AppRouter.navigate(args);
            return;
        }

        if (this.handlers.has(action)) {
            const handler = this.handlers.get(action);
            handler(args, event, target);
        } else if (event && this._handledByView.has(event)) {
            return;
        } else {
            // Fallback for Engine methods
            let handled = false;
            const engines = [window.LibraryEngine, window.FirebaseAuthEngine, GdprEngine];

            for (const engine of engines) {
                if (engine && typeof engine[action] === 'function') {
                    engine[action](args, event, target);
                    handled = true;
                    break;
                }
            }

            if (!handled) {
                console.warn(`Unregistered action triggered: ${action}`);
            }
        }
    }
}

const AppEvents = new EventDelegator();
export default AppEvents;
