// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';

// Les bibliothèques de vendor/ sont gardées d'une version de l'application à l'autre. Une bibliothèque
// mise à jour va dans un nouveau dossier : l'ancien est retiré du cache à l'activation du SW.
const SW_SOURCE = readFileSync('sw.js', 'utf8');

function loadServiceWorker(vendorCache) {
    const sandbox = {
        console: { warn: vi.fn(), log: vi.fn(), error: vi.fn() },
        URL,
        Response,
        Request,
        location: new URL('https://app.example/'),
        caches: { open: async () => vendorCache },
        fetch: vi.fn(),
        importScripts: () => {
            throw new Error('skip firebase');
        },
    };
    sandbox.self = { addEventListener: () => {}, registration: {}, clients: {}, skipWaiting: () => {} };
    vm.createContext(sandbox);
    vm.runInContext(SW_SOURCE, sandbox);
    return sandbox;
}

function fakeCache(urls) {
    const set = new Set(urls);
    return {
        set,
        keys: async () => [...set].map((url) => new Request(url)),
        delete: async (request) => set.delete(request.url),
    };
}

describe('cache des bibliothèques (vendor/)', () => {
    it('VENDOR_DIRS liste exactement les dossiers de vendor/', () => {
        const sw = loadServiceWorker(fakeCache([]));
        const dirs = readdirSync('vendor', { withFileTypes: true })
            .filter((d) => d.isDirectory())
            .map((d) => d.name)
            .sort();
        expect([...vm.runInContext('VENDOR_DIRS', sw)].sort()).toEqual(dirs);
    });

    it('retire à l’activation les fichiers d’une ancienne version, garde les actuels', async () => {
        const current = 'https://app.example/vendor/leaflet-1.9.4/leaflet.js';
        const old = 'https://app.example/vendor/firebase-12.0.0/firebase-app.js';
        const cache = fakeCache([current, old]);
        const sw = loadServiceWorker(cache);
        await sw.pruneOldVendorFiles();
        expect([...cache.set]).toEqual([current]);
    });
});
