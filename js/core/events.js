/**
 * CORE - Event Delegator
 * Replaces inline events (onclick, onchange) with a centralized delegation mechanism.
 */

import AppRouter from './router.js';
import GdprEngine from '../gdpr_engine.js';

class EventDelegator {
    constructor() {
        this.handlers = new Map();
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

    init() {
        // Global click delegator
        document.addEventListener('click', (e) => {
            // data-backdrop-action: fires only when the overlay itself (not its content) is clicked.
            const backdrop = e.target.closest('[data-backdrop-action]');
            if (backdrop && e.target === backdrop) {
                this.dispatch(
                    backdrop.getAttribute('data-backdrop-action'),
                    this._parseArgs(backdrop.getAttribute('data-args')),
                    e,
                    backdrop,
                );
            }

            const target = e.target.closest('[data-action]');
            if (!target) return;
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
            const changeTarget = e.target.closest('[data-change-action]');
            if (changeTarget) {
                this.dispatch(changeTarget.getAttribute('data-change-action'), changeTarget.value, e, changeTarget);
            }

            const target = e.target.closest('[data-action]');
            if (!target) return;

            this.dispatch(target.getAttribute('data-action'), target.value, e, target);
        });

        // Live typing (search boxes, sliders, form previews)
        document.addEventListener('input', (e) => {
            const target = e.target.closest('[data-input-action]');
            if (target) this.dispatch(target.getAttribute('data-input-action'), target.value, e, target);
        });

        // Enter key on a text field
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter') return;
            const target = e.target.closest('[data-enter-action]');
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
