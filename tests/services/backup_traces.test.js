import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    BACKUP_TRACES_KEY,
    applyBackupTraces,
    buildFullBackup,
    parseBackup,
} from '../../js/services/backup_service.js';
import IDBStorage from '../../js/services/idb_storage.js';
import StorageService from '../../js/services/storage.js';
import { ENCODING_PLAIN, encodeTrace } from '../../js/utils/trace_codec.js';

const K = StorageService.KEYS;
const IGC = 'AXXX demo\nHFDTE280926\nB1200004500000N00600000EA0100001000\n'.repeat(50);
const meta = { appName: 'AssistantParapente', exportedAt: '2026-10-01T10:00:00.000Z' };

/** In-memory stand-in for the IndexedDB traces store. */
function fakeIdb(initial = {}) {
    const traces = new Map(Object.entries(initial));
    vi.spyOn(IDBStorage, 'isSupported').mockReturnValue(true);
    vi.spyOn(IDBStorage, 'getTrace').mockImplementation(async (id) => traces.get(id) || null);
    vi.spyOn(IDBStorage, 'getFlight').mockResolvedValue(null);
    vi.spyOn(IDBStorage, 'saveTrace').mockImplementation(async (id, raw) => (traces.set(id, raw), true));
    return traces;
}

describe('Local backup: GPS traces', () => {
    beforeEach(() => localStorage.clear());
    afterEach(() => vi.restoreAllMocks());

    it('exports the trace of every flight that has one, compressed', async () => {
        fakeIdb({ f1: IGC });
        StorageService.set(K.LOGBOOK_DATA, [{ id: 'f1' }, { id: 'f2' }]);

        const backup = await buildFullBackup();

        expect(Object.keys(backup[BACKUP_TRACES_KEY])).toEqual(['f1']);
        expect(backup[BACKUP_TRACES_KEY].f1.data).toEqual(expect.any(String));
        expect(JSON.stringify(backup).length).toBeLessThan(IGC.length);
    });

    it('falls back on the trace kept in the flights store', async () => {
        fakeIdb();
        vi.spyOn(IDBStorage, 'getFlight').mockResolvedValue({ id: 'f1', rawIgc: IGC });
        StorageService.set(K.LOGBOOK_DATA, [{ id: 'f1' }]);
        expect(Object.keys((await buildFullBackup())[BACKUP_TRACES_KEY])).toEqual(['f1']);
    });

    it('adds no traces key when there is nothing to export or no IndexedDB', async () => {
        fakeIdb();
        StorageService.set(K.LOGBOOK_DATA, [{ id: 'f1' }]);
        expect(await buildFullBackup()).not.toHaveProperty(BACKUP_TRACES_KEY);

        vi.spyOn(IDBStorage, 'isSupported').mockReturnValue(false);
        expect(await buildFullBackup()).not.toHaveProperty(BACKUP_TRACES_KEY);
    });

    it('round trip: the restored trace is byte for byte the original', async () => {
        fakeIdb({ f1: IGC });
        StorageService.set(K.LOGBOOK_DATA, [{ id: 'f1' }]);
        const exported = JSON.parse(JSON.stringify(await buildFullBackup()));

        const target = fakeIdb();
        const parsed = parseBackup(JSON.stringify(exported));
        expect(parsed.ok).toBe(true);
        const result = await applyBackupTraces(parsed.ok ? parsed.backup : {});

        expect(result).toEqual({ restored: 1, failed: 0 });
        expect(target.get('f1')).toBe(IGC);
    });

    it('restores only traces of flights listed in the backup, and counts unreadable ones', async () => {
        const target = fakeIdb();
        const good = await encodeTrace(IGC, { partChars: Infinity });
        const backup = {
            [K.LOGBOOK_DATA]: [{ id: 'a' }, { id: 'b' }],
            [BACKUP_TRACES_KEY]: {
                a: { encoding: good.encoding, data: good.parts[0] },
                b: { encoding: ENCODING_PLAIN, data: '***not base64***' },
                orphan: { encoding: good.encoding, data: good.parts[0] },
            },
        };
        const result = await applyBackupTraces(backup);
        expect(result).toEqual({ restored: 1, failed: 1 });
        expect([...target.keys()]).toEqual(['a']);
    });

    it.each([
        ['not an object', 'oops'],
        ['an entry without data', { f1: { encoding: ENCODING_PLAIN } }],
        ['an unknown encoding', { f1: { encoding: 'rot13', data: 'abc' } }],
    ])('rejects the whole file when the traces are %s', (_name, traces) => {
        const text = JSON.stringify({ _meta: meta, [K.USER_LEVEL]: 'BI', [BACKUP_TRACES_KEY]: traces });
        expect(parseBackup(text)).toEqual({ ok: false, error: 'badData' });
    });

    it('accepts a file exported before traces were included', () => {
        expect(parseBackup(JSON.stringify({ _meta: meta, [K.USER_LEVEL]: 'BI' })).ok).toBe(true);
    });
});
