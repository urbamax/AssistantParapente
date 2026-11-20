import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initAppUpdateNotifier, watchSiteVersion } from '../../js/core/app_update.js';

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

    it('shows one mandatory modal overlay with only the "Mettre à jour" button when a new worker takes over', () => {
        const listeners = stubServiceWorker({});
        initAppUpdateNotifier(Promise.resolve(null));
        listeners.controllerchange();
        listeners.controllerchange();

        const overlay = document.getElementById('app-update-banner');
        expect(document.querySelectorAll('#app-update-banner')).toHaveLength(1);
        expect(overlay.getAttribute('role')).toBe('alertdialog');
        expect(overlay.getAttribute('aria-modal')).toBe('true');
        expect(overlay.textContent.trim()).toBe('Mettre à jour');
        expect(overlay.textContent).not.toContain('Nouvelle version disponible');
        expect(overlay.querySelector('.app-update-dismiss')).toBeNull();
        expect(document.activeElement).toBe(overlay.querySelector('.app-update-reload'));
    });
});

describe('watchSiteVersion (version.json, any change of the repository)', () => {
    /** version.json successives renvoyées par le serveur */
    function serve(...versions) {
        const fetch = vi.fn(async () => {
            const v = versions.length > 1 ? versions.shift() : versions[0];
            if (v instanceof Error) throw v;
            return v === null ? { ok: false } : { ok: true, json: async () => ({ version: v }) };
        });
        vi.stubGlobal('fetch', fetch);
        return fetch;
    }

    beforeEach(() => {
        document.body.innerHTML = '';
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('shows the banner as soon as the site version changes', async () => {
        const fetch = serve('abc', 'abc', 'def');
        const check = await watchSiteVersion({ intervalMs: 0 });
        await check();
        expect(document.getElementById('app-update-banner')).toBeNull();
        await check();
        expect(document.getElementById('app-update-banner')).not.toBeNull();
        // jamais depuis un cache
        expect(fetch.mock.calls[0][1]).toEqual({ cache: 'no-store' });
    });

    it('stays quiet offline or on a site without version.json', async () => {
        serve(null);
        let check = await watchSiteVersion({ intervalMs: 0 });
        await check();
        serve('abc', new Error('offline'));
        check = await watchSiteVersion({ intervalMs: 0 });
        await check();
        expect(document.getElementById('app-update-banner')).toBeNull();
    });

    it('"Mettre à jour" empties the app caches (not the opened courses nor the map tiles) before reloading', async () => {
        serve('abc', 'def');
        const deleted = [];
        vi.stubGlobal('caches', {
            keys: async () => ['parapente-app-v1', 'parapente-courses-v1', 'parapente-tiles-v1'],
            delete: async (k) => deleted.push(k),
        });
        const reload = vi.fn();
        Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, reload } });
        const check = await watchSiteVersion({ intervalMs: 0 });
        await check();
        document.querySelector('.app-update-reload').click();
        await vi.waitFor(() => expect(reload).toHaveBeenCalled());
        expect(deleted).toEqual(['parapente-app-v1']);
    });

    it('preserves app caches if the user clicks "Mettre à jour" after going offline', async () => {
        serve('abc', 'def');
        const deleted = [];
        vi.stubGlobal('caches', {
            keys: async () => ['parapente-app-v1'],
            delete: async (k) => deleted.push(k),
        });
        const reload = vi.fn();
        Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, reload } });
        Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });

        const check = await watchSiteVersion({ intervalMs: 0 });
        await check();
        document.querySelector('.app-update-reload').click();
        await vi.waitFor(() => expect(reload).toHaveBeenCalled());
        expect(deleted).toEqual([]);
        Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
    });

    it('marks #app-header and #app-main as inert when the mandatory update banner is shown', async () => {
        document.body.innerHTML = '<header id="app-header"></header><main id="app-main"></main>';
        serve('abc', 'def');
        const check = await watchSiteVersion({ intervalMs: 0 });
        await check();
        expect(document.getElementById('app-header').hasAttribute('inert')).toBe(true);
        expect(document.getElementById('app-main').hasAttribute('inert')).toBe(true);
    });
});
