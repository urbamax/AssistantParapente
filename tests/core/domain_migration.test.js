import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    CANONICAL_ORIGIN,
    MIGRATION_DONE_KEY,
    buildMigrationFragment,
    receiveMigration,
    redirectFromLegacyOrigin,
} from '../../js/core/domain_migration.js';
import IDBStorage from '../../js/services/idb_storage.js';
import StorageService from '../../js/services/storage.js';
import { CONSENT_KEY, CONSENT_VERSION } from '../../js/services/consent_store.js';

const K = StorageService.KEYS;
const LEGACY = 'https://ancienne.example.org';
const legacyOrigins = [LEGACY];
const CONSENT = { version: CONSENT_VERSION, stats: true, firebase: false, gps: true, date: '2026-10-01' };

/** Text that gzip cannot shrink, to fill the address on purpose. */
function noise(length, seed = 1) {
    let x = seed;
    let out = '';
    while (out.length < length) {
        x = (x * 1103515245 + 12345) % 2147483648;
        out += x.toString(36);
    }
    return out.slice(0, length);
}

function fakeLocation(url) {
    const u = new URL(url);
    return {
        origin: u.origin,
        pathname: u.pathname,
        search: u.search,
        hash: u.hash,
        replace: vi.fn(),
        reload: vi.fn(),
    };
}

function fakeTraces(traces) {
    vi.spyOn(IDBStorage, 'isSupported').mockReturnValue(true);
    vi.spyOn(IDBStorage, 'getTrace').mockImplementation(async (id) => traces[id] || null);
    vi.spyOn(IDBStorage, 'getFlight').mockResolvedValue(null);
    const saved = {};
    vi.spyOn(IDBStorage, 'saveTrace').mockImplementation(async (id, raw) => ((saved[id] = raw), true));
    return saved;
}

/** Runs the old address, then the new domain on an empty device, as the browser would. */
async function moveDevice({ maxChars, referrer = `${LEGACY}/` } = {}) {
    const old = fakeLocation(`${LEGACY}/`);
    expect(await redirectFromLegacyOrigin({ location: old, maxChars, legacyOrigins })).toBe(true);
    const target = old.replace.mock.calls[0][0];

    localStorage.clear(); // another origin: its own, empty storage
    const location = fakeLocation(target);
    const history = { replaceState: vi.fn() };
    const reloaded = await receiveMigration({ location, history, referrer, legacyOrigins });
    return { target, location, history, reloaded };
}

describe('Domain migration', () => {
    beforeEach(() => localStorage.clear());
    afterEach(() => vi.restoreAllMocks());

    it('moves the logbook, statistics, preferences and privacy choice to the new domain', async () => {
        StorageService.set(K.LOGBOOK_DATA, [{ id: 'f1', site: 'Planfait' }]);
        StorageService.set(K.EQUIPMENT_DATA, [{ id: 'w1' }]);
        StorageService.set(K.QCM_STATS, { q1: { correct: 2, total: 3 } });
        StorageService.set(K.THEME_MODE, 'dark');
        localStorage.setItem(CONSENT_KEY, JSON.stringify(CONSENT));

        const { target, location, history, reloaded } = await moveDevice();

        expect(target.startsWith(`${CANONICAL_ORIGIN}/#migration=`)).toBe(true);
        expect(history.replaceState).toHaveBeenCalledWith(null, '', '/');
        expect(reloaded).toBe(true);
        expect(location.reload).toHaveBeenCalled();
        expect(StorageService.get(K.LOGBOOK_DATA)).toEqual([{ id: 'f1', site: 'Planfait' }]);
        expect(StorageService.get(K.EQUIPMENT_DATA)).toEqual([{ id: 'w1' }]);
        expect(StorageService.get(K.QCM_STATS)).toEqual({ q1: { correct: 2, total: 3 } });
        expect(StorageService.get(K.THEME_MODE)).toBe('dark');
        expect(JSON.parse(localStorage.getItem(CONSENT_KEY))).toEqual(CONSENT);
        expect(localStorage.getItem(MIGRATION_DONE_KEY)).toEqual(expect.any(String));
    });

    it('carries the GPS traces when they fit', async () => {
        fakeTraces({ f1: 'AXXX demo\nB1200004500000N00600000EA0100001000\n'.repeat(200) });
        StorageService.set(K.LOGBOOK_DATA, [{ id: 'f1' }]);
        expect((await buildMigrationFragment()).level).toBe('full');
    });

    it('leaves the traces, then the flights, out when the address would be too long', async () => {
        fakeTraces({ f1: noise(40_000) });
        StorageService.set(K.LOGBOOK_DATA, [{ id: 'f1', notes: noise(6_000, 7) }]);
        StorageService.set(K.EQUIPMENT_DATA, [{ id: 'w1' }]);

        expect((await buildMigrationFragment(20_000)).level).toBe('noTraces');
        expect((await buildMigrationFragment(2_000)).level).toBe('noFlights');

        const saved = fakeTraces({ f1: noise(40_000) });
        await moveDevice({ maxChars: 2_000 });
        expect(StorageService.get(K.LOGBOOK_DATA)).toBeNull();
        expect(StorageService.get(K.EQUIPMENT_DATA)).toEqual([{ id: 'w1' }]);
        expect(saved).toEqual({});
    });

    it('redirects without data a visitor who has none', async () => {
        const old = fakeLocation(`${LEGACY}/`);
        await redirectFromLegacyOrigin({ location: old, legacyOrigins });
        expect(old.replace).toHaveBeenCalledWith(`${CANONICAL_ORIGIN}/`);
    });

    it('stays on the old address with ?rester, and anywhere that is not the old address', async () => {
        for (const url of [`${LEGACY}/?rester`, 'http://localhost:8000/', `${CANONICAL_ORIGIN}/`]) {
            const location = fakeLocation(url);
            expect(await redirectFromLegacyOrigin({ location, legacyOrigins })).toBe(false);
            expect(location.replace).not.toHaveBeenCalled();
        }
    });

    it('ignores data that does not come from the old address (crafted link)', async () => {
        StorageService.set(K.LOGBOOK_DATA, [{ id: 'f1' }]);
        localStorage.setItem(CONSENT_KEY, JSON.stringify(CONSENT));
        const { history, reloaded } = await moveDevice({ referrer: 'https://evil.example/' });

        expect(reloaded).toBe(false);
        expect(history.replaceState).toHaveBeenCalled();
        expect(localStorage.length).toBe(0);
    });

    it('never overwrites a device that already has its own data, and only receives once', async () => {
        StorageService.set(K.LOGBOOK_DATA, [{ id: 'old' }]);
        const old = fakeLocation(`${LEGACY}/`);
        await redirectFromLegacyOrigin({ location: old, legacyOrigins });
        const target = old.replace.mock.calls[0][0];
        const receive = () =>
            receiveMigration({
                location: fakeLocation(target),
                history: { replaceState: vi.fn() },
                referrer: `${LEGACY}/`,
                legacyOrigins,
            });

        localStorage.clear();
        StorageService.set(K.LOGBOOK_DATA, [{ id: 'new' }]);
        expect(await receive()).toBe(false);
        expect(StorageService.get(K.LOGBOOK_DATA)).toEqual([{ id: 'new' }]);

        localStorage.clear();
        localStorage.setItem(MIGRATION_DONE_KEY, '2026-11-19T10:00:00.000Z');
        expect(await receive()).toBe(false);
        expect(StorageService.get(K.LOGBOOK_DATA)).toBeNull();
    });

    it('does nothing without a migration fragment', async () => {
        const history = { replaceState: vi.fn() };
        const location = fakeLocation(`${CANONICAL_ORIGIN}/#LOGBOOK`);
        expect(await receiveMigration({ location, history, referrer: '', legacyOrigins })).toBe(false);
        expect(history.replaceState).not.toHaveBeenCalled();
    });

    it('rejects a damaged fragment without writing anything', async () => {
        const location = fakeLocation(`${CANONICAL_ORIGIN}/#migration=g.not-base64!`);
        const history = { replaceState: vi.fn() };
        expect(await receiveMigration({ location, history, referrer: `${LEGACY}/`, legacyOrigins })).toBe(false);
        expect(localStorage.length).toBe(0);
    });
});
