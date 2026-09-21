import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initAppUpdateNotifier } from '../../js/core/app_update.js';

function stubServiceWorker(controller) {
    const listeners = {};
    Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: {
            controller,
            addEventListener: (type, cb) => (listeners[type] = cb),
        },
    });
    return listeners;
}

describe('initAppUpdateNotifier', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    afterEach(() => {
        delete navigator.serviceWorker;
    });

    it('shows no banner on the very first install (no previous controller)', () => {
        const listeners = stubServiceWorker(null);
        initAppUpdateNotifier(Promise.resolve(null));
        listeners.controllerchange();
        expect(document.getElementById('app-update-banner')).toBeNull();
    });

    it('shows one banner when a new worker takes over an already-controlled page', () => {
        const listeners = stubServiceWorker({});
        initAppUpdateNotifier(Promise.resolve(null));
        listeners.controllerchange();
        listeners.controllerchange();
        expect(document.querySelectorAll('#app-update-banner')).toHaveLength(1);
        expect(document.getElementById('app-update-banner').textContent).toContain('Nouvelle version disponible');
    });

    it('lets the user dismiss the banner without reloading', () => {
        const listeners = stubServiceWorker({});
        initAppUpdateNotifier(Promise.resolve(null));
        listeners.controllerchange();
        document.querySelector('.app-update-dismiss').click();
        expect(document.getElementById('app-update-banner')).toBeNull();
    });
});
