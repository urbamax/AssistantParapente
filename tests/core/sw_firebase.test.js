// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Spec 013 : le service worker ne charge le SDK Firebase que depuis l'application (aucun serveur
// tiers, donc rien avant consentement), et affiche toujours les alertes reçues en arrière-plan.
const SW_SOURCE = readFileSync('sw.js', 'utf8');

/** Exécute sw.js dans un bac à sable ; importScripts est simulé (URL enregistrées). */
function runServiceWorker({ firebaseEnabled = true, importFails = false } = {}) {
    const imported = [];
    const listeners = {};
    let backgroundHandler = null;
    const showNotification = vi.fn();
    const initializeApp = vi.fn();
    const sandbox = {
        console: { warn: vi.fn(), log: vi.fn(), error: vi.fn() },
        URL,
        Response,
        location: new URL('https://app.example/'),
        caches: {
            open: vi.fn(() => Promise.resolve({ put: vi.fn() })),
            keys: vi.fn(),
            match: vi.fn(() => Promise.resolve(undefined)),
        },
        fetch: vi.fn(() => Promise.resolve(new Response('', { status: 200 }))),
    };
    sandbox.self = {
        addEventListener: (type, fn) => (listeners[type] = fn),
        registration: { showNotification },
        clients: { claim: vi.fn() },
        skipWaiting: vi.fn(),
    };
    sandbox.addEventListener = sandbox.self.addEventListener;
    sandbox.importScripts = (...urls) => {
        imported.push(...urls);
        if (importFails) throw new Error('network');
        for (const url of urls) {
            if (url.endsWith('firebase_config.js')) {
                vm.runInContext(
                    `var FIREBASE_CONFIG = { projectId: 'demo' }; var IS_FIREBASE_ENABLED = ${firebaseEnabled};`,
                    sandbox,
                );
            }
            if (url.endsWith('firebase-app-compat.js')) {
                sandbox.firebase = {
                    initializeApp,
                    messaging: () => ({ onBackgroundMessage: (fn) => (backgroundHandler = fn) }),
                };
            }
        }
    };
    vm.createContext(sandbox);
    vm.runInContext(SW_SOURCE, sandbox);
    return { imported, listeners, showNotification, initializeApp, background: () => backgroundHandler };
}

describe('service worker loads Firebase only from the app (spec 013, FR-001, FR-002)', () => {
    it('imports only same-origin scripts, never gstatic', () => {
        const { imported } = runServiceWorker();
        expect(imported.length).toBeGreaterThan(0);
        for (const url of imported) {
            expect(url, url).toMatch(/^\.\//);
            expect(url).not.toContain('gstatic');
        }
        expect(imported).toContain('./vendor/firebase-12.19.0/firebase-app-compat.js');
        expect(imported).toContain('./vendor/firebase-12.19.0/firebase-messaging-compat.js');
    });

    it('does not start Firebase when it is disabled in the configuration', () => {
        const { initializeApp } = runServiceWorker({ firebaseEnabled: false });
        expect(initializeApp).not.toHaveBeenCalled();
    });

    it('a failed import does not stop the rest of the worker (cache, navigation)', () => {
        const { listeners } = runServiceWorker({ importFails: true });
        expect(typeof listeners.install).toBe('function');
        expect(typeof listeners.fetch).toBe('function');
    });
});

describe('background alerts (spec 013, FR-008)', () => {
    it('shows the title and text sent by the server', () => {
        const run = runServiceWorker();
        run.background()({ notification: { title: 'Dune du Pyla : conditions favorables', body: 'Prévision à 14 h' } });
        expect(run.showNotification).toHaveBeenCalledWith('Dune du Pyla : conditions favorables', {
            body: 'Prévision à 14 h',
            icon: './img/icons/icon-192x192.png',
            badge: './img/icons/icon-192x192.png',
        });
    });

    it('falls back to the app name and an empty text', () => {
        const run = runServiceWorker();
        run.background()({});
        expect(run.showNotification).toHaveBeenCalledWith('Assistant Parapente', expect.objectContaining({ body: '' }));
    });
});

describe('Firebase network requests are left to the browser', () => {
    const fetchEvent = (url) => ({
        request: { method: 'GET', url, mode: 'cors', headers: new Headers() },
        respondWith: vi.fn(),
    });

    it.each([
        ['https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?VER=8&t=1'],
        ['https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?VER=8&t=2'],
        ['https://identitytoolkit.googleapis.com/v1/accounts:lookup'],
    ])('%s is not intercepted (no cache, no Safari access-control errors)', (url) => {
        const { listeners } = runServiceWorker();
        const event = fetchEvent(url);
        listeners.fetch(event);
        expect(event.respondWith).not.toHaveBeenCalled();
    });

    it('other third-party files are still served for offline use', async () => {
        const { listeners } = runServiceWorker();
        const event = fetchEvent('https://mt1.google.com/vt/lyrs=y&x=1&y=2&z=3');
        listeners.fetch(event);
        expect(event.respondWith).toHaveBeenCalled();
        await event.respondWith.mock.calls[0][0];
    });
});
