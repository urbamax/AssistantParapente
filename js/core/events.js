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

    init() {
        // Global click delegator
        document.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) return;

            const action = target.getAttribute('data-action');
            let args = target.getAttribute('data-args');
            try {
                if (args) {
                    const parsed = JSON.parse(args.replace(/'/g, '"'));
                    // IDs (e.g. Date.now().toString()) are passed unquoted and look like
                    // valid JSON numbers/booleans to JSON.parse. Keep them as strings so
                    // downstream `===` comparisons against stored string ids still match.
                    args = typeof parsed === 'number' || typeof parsed === 'boolean' ? args.replace(/'/g, '') : parsed;
                }
            } catch {
                // If it's a simple string or single quote string
                if (args) args = args.replace(/'/g, '');
            }

            this.dispatch(action, args, e, target);
        });

        // Global change delegator
        document.addEventListener('change', (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) return;

            const action = target.getAttribute('data-action');
            const args = target.value;

            this.dispatch(action, args, e, target);
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
            const engines = [
                window.SitesEngine,
                window.LogbookEngine,
                window.QuizEngine,
                window.LibraryEngine,
                window.FirebaseAuthEngine,
                GdprEngine,
            ];

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
