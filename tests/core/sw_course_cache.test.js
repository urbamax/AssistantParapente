// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Les cours (PDF, jusqu'à ≈ 23 Mo chacun) sont gardés hors ligne une fois ouverts : sans plafond,
// quelques ouvertures suffisent à remplir le stockage d'un téléphone. Les plus anciens partent d'abord.
const SW_SOURCE = readFileSync('sw.js', 'utf8');

function loadServiceWorker() {
    const sandbox = {
        console: { warn: vi.fn(), log: vi.fn(), error: vi.fn() },
        URL,
        Response,
        Request,
        location: new URL('https://app.example/'),
        caches: {},
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

/** Cache minimal : garde l'ordre d'insertion comme CacheStorage. */
function fakeCache(entries) {
    const map = new Map(entries.map(([url, bytes]) => [url, new Response(new Uint8Array(bytes))]));
    return {
        map,
        keys: async () => [...map.keys()].map((url) => new Request(url)),
        match: async (request) => map.get(request.url)?.clone(),
        delete: async (request) => map.delete(request.url),
    };
}

const MB = 1024 * 1024;
const A = 'https://app.example/courses/a.pdf';
const B = 'https://app.example/courses/b.pdf';
const C = 'https://app.example/courses/c.pdf';

describe('plafond du cache des cours', () => {
    it('est fixé à une valeur raisonnable pour un téléphone', () => {
        const sw = loadServiceWorker();
        const max = vm.runInContext('COURSE_CACHE_MAX_BYTES', sw);
        expect(max).toBeGreaterThanOrEqual(40 * MB);
        expect(max).toBeLessThanOrEqual(120 * MB);
    });

    it("retire les plus anciens jusqu'à repasser sous la limite", async () => {
        const sw = loadServiceWorker();
        const cache = fakeCache([
            [A, 10 * MB],
            [B, 10 * MB],
            [C, 10 * MB],
        ]);
        await sw.trimCacheBySize(cache, 25 * MB, C);
        expect([...cache.map.keys()]).toEqual([B, C]);
    });

    it('ne touche à rien sous la limite', async () => {
        const sw = loadServiceWorker();
        const cache = fakeCache([
            [A, 5 * MB],
            [B, 5 * MB],
        ]);
        await sw.trimCacheBySize(cache, 25 * MB, B);
        expect([...cache.map.keys()]).toEqual([A, B]);
    });

    it("garde toujours le document qui vient d'être enregistré, même seul au-dessus de la limite", async () => {
        const sw = loadServiceWorker();
        const cache = fakeCache([
            [A, 5 * MB],
            [B, 30 * MB],
        ]);
        await sw.trimCacheBySize(cache, 10 * MB, B);
        expect([...cache.map.keys()]).toEqual([B]);
    });
});
