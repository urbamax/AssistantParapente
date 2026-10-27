import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    BACKUP_MAX_BYTES,
    applyBackup,
    buildBackup,
    exportBackup,
    parseBackup,
    readBackupFile,
} from '../../js/services/backup_service.js';
import StorageService from '../../js/services/storage.js';

const K = StorageService.KEYS;
const meta = (extra = {}) => ({
    appName: 'AssistantParapente',
    exportVersion: '1.0',
    exportedAt: '2026-10-01T10:00:00.000Z',
    ...extra,
});
const file = (data) => JSON.stringify({ _meta: meta(), ...data });

describe('Local backup: export', () => {
    beforeEach(() => localStorage.clear());
    afterEach(() => vi.restoreAllMocks());

    it('writes every user key and the pending deletions, whole', () => {
        const stats = { q1: { correct: 3, total: 4, streak: 2, lastSeen: 5, recent: [1, 1, 0, 1] } };
        StorageService.set(K.QCM_STATS, stats);
        StorageService.set(K.LOGBOOK_DATA, [{ id: 'f1' }]);
        StorageService.set(K.EQUIPMENT_DATA, [{ id: 'w1' }]);
        StorageService.set(K.EXAM_HISTORY, { exams: [{ score: 20 }] });
        StorageService.set(K.THEME_MODE, 'dark');
        localStorage.setItem('deleted_flights', JSON.stringify(['f0']));

        const backup = buildBackup();

        expect(backup._meta).toMatchObject({
            appName: 'AssistantParapente',
            exportVersion: '1.0',
            exportedBy: 'anonymous',
        });
        expect(backup[K.QCM_STATS]).toEqual(stats);
        expect(backup[K.LOGBOOK_DATA]).toEqual([{ id: 'f1' }]);
        expect(backup[K.EQUIPMENT_DATA]).toEqual([{ id: 'w1' }]);
        expect(backup[K.EXAM_HISTORY]).toEqual({ exams: [{ score: 20 }] });
        expect(backup[K.THEME_MODE]).toBe('dark');
        expect(backup.deleted_flights).toEqual(['f0']);
    });

    it('never exports the roles granted by the server', () => {
        StorageService.set(K.ACCESS, { roles: ['beta'] });
        expect(buildBackup()).not.toHaveProperty(K.ACCESS);
    });

    it('downloads parapente_backup_<date>.json without any account or network', () => {
        let blob;
        vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => ((blob = b), 'blob:x'));
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
        const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
        const fetchSpy = vi.spyOn(globalThis, 'fetch');

        const name = exportBackup();

        expect(name).toMatch(/^parapente_backup_\d{4}-\d{2}-\d{2}\.json$/);
        expect(click).toHaveBeenCalledOnce();
        expect(blob.type).toBe('application/json');
        expect(fetchSpy).not.toHaveBeenCalled();
    });
});

describe('Local backup: validation', () => {
    it('rejects text that is not JSON', () => {
        expect(parseBackup('<html>')).toEqual({ ok: false, error: 'notJson' });
    });

    it.each([
        ['an array', '[]'],
        ['a missing _meta', JSON.stringify({ [K.LOGBOOK_DATA]: [] })],
        ['another app', JSON.stringify({ _meta: { appName: 'Other' }, [K.LOGBOOK_DATA]: [] })],
    ])('rejects %s', (_name, text) => {
        expect(parseBackup(text)).toEqual({ ok: false, error: 'notBackup' });
    });

    it('rejects a file from a future major version', () => {
        const text = JSON.stringify({ _meta: meta({ exportVersion: '2.0' }), [K.LOGBOOK_DATA]: [{ id: 'a' }] });
        expect(parseBackup(text)).toEqual({ ok: false, error: 'unsupportedVersion' });
    });

    it('accepts files exported before versions were checked, and any 1.x', () => {
        const old = JSON.stringify({
            _meta: { appName: 'AssistantParapente', exportedAt: 'x' },
            [K.LOGBOOK_DATA]: [{ id: 'a' }],
        });
        expect(parseBackup(old).ok).toBe(true);
        expect(
            parseBackup(JSON.stringify({ _meta: meta({ exportVersion: '1.7' }), [K.LOGBOOK_DATA]: [{ id: 'a' }] })).ok,
        ).toBe(true);
    });

    it.each([
        ['logbook not a list', { [K.LOGBOOK_DATA]: { id: 'a' } }],
        ['logbook entry not an object', { [K.LOGBOOK_DATA]: ['<script>alert(1)</script>'] }],
        ['stats not an object', { [K.QCM_STATS]: 'oops' }],
        ['unknown theme', { [K.THEME_MODE]: 'neon' }],
        ['deleted list not an array', { deleted_flights: 'abc' }],
    ])('rejects the whole file when %s', (_name, data) => {
        expect(parseBackup(file(data))).toEqual({ ok: false, error: 'badData' });
    });

    it('rejects a file with nothing to restore', () => {
        expect(parseBackup(file({ [K.LOGBOOK_DATA]: null, somethingElse: 1 }))).toEqual({ ok: false, error: 'empty' });
    });

    it('reports an unreadable export date as unknown', () => {
        const parsed = parseBackup(JSON.stringify({ _meta: meta({ exportedAt: 'nope' }), [K.USER_LEVEL]: 'BI' }));
        expect(parsed).toMatchObject({ ok: true, exportedAt: null });
    });

    it('refuses a file larger than the limit before reading it', async () => {
        const huge = /** @type {Blob} */ ({ size: BACKUP_MAX_BYTES + 1, text: vi.fn() });
        expect(await readBackupFile(huge)).toEqual({ ok: false, error: 'tooLarge' });
        expect(huge.text).not.toHaveBeenCalled();
    });
});

describe('Local backup: restore', () => {
    beforeEach(() => localStorage.clear());

    const restore = (data, options) => {
        const parsed = parseBackup(file(data));
        if (!parsed.ok) throw new Error(parsed.error);
        return applyBackup(parsed.backup, options);
    };

    it('copies QCM_STATS whole, including fields added later (recent)', () => {
        const stats = {
            q1: { correct: 5, total: 6, streak: 3, lastSeen: 1700, recent: [1, 1, 0, 1, 1, 1], futureField: { a: 1 } },
        };
        restore({ [K.QCM_STATS]: stats }, { statsAllowed: true });
        expect(StorageService.get(K.QCM_STATS)).toEqual(stats);
    });

    it('restores a round trip: export, wipe, import gives the same data', () => {
        StorageService.set(K.LOGBOOK_DATA, [{ id: 'f1', site: 'Annecy' }]);
        StorageService.set(K.EQUIPMENT_DATA, [{ id: 'w1' }]);
        StorageService.set(K.USER_PREFS, { radius: 30 });
        StorageService.set(K.USER_LEVEL, 'BP');
        StorageService.set(K.THEME_MODE, 'light');
        StorageService.set(K.QCM_STATS, { q: { correct: 1, total: 2, recent: [1, 0] } });
        const exported = JSON.parse(JSON.stringify(buildBackup()));

        localStorage.clear();
        const parsed = parseBackup(JSON.stringify(exported));
        applyBackup(parsed.ok ? parsed.backup : {}, { statsAllowed: true });

        expect(StorageService.get(K.LOGBOOK_DATA)).toEqual([{ id: 'f1', site: 'Annecy' }]);
        expect(StorageService.get(K.EQUIPMENT_DATA)).toEqual([{ id: 'w1' }]);
        expect(StorageService.get(K.USER_PREFS)).toEqual({ radius: 30 });
        expect(StorageService.get(K.USER_LEVEL)).toBe('BP');
        expect(localStorage.getItem(K.THEME_MODE)).toBe('light');
        expect(StorageService.get(K.QCM_STATS)).toEqual({ q: { correct: 1, total: 2, recent: [1, 0] } });
    });

    it('leaves alone the keys the file does not contain', () => {
        StorageService.set(K.EQUIPMENT_DATA, [{ id: 'keep' }]);
        restore({ [K.LOGBOOK_DATA]: [{ id: 'f1' }] });
        expect(StorageService.get(K.EQUIPMENT_DATA)).toEqual([{ id: 'keep' }]);
    });

    it('skips the statistics when their storage was refused, and says so', () => {
        const result = restore(
            { [K.QCM_STATS]: { q: {} }, [K.EXAM_HISTORY]: { exams: [] }, [K.LOGBOOK_DATA]: [{ id: 'f1' }] },
            { statsAllowed: false },
        );
        expect(result.skipped).toEqual([K.QCM_STATS, K.EXAM_HISTORY]);
        expect(localStorage.getItem(K.QCM_STATS)).toBeNull();
        expect(localStorage.getItem(K.EXAM_HISTORY)).toBeNull();
        expect(StorageService.get(K.LOGBOOK_DATA)).toEqual([{ id: 'f1' }]);
    });

    it('does not restore roles, the exporting device route or its sync date', () => {
        localStorage.setItem('LAST_ACTIVE_ROUTE', 'SITES');
        restore({
            [K.ACCESS]: { roles: ['owner'] },
            LAST_ACTIVE_ROUTE: 'LOGBOOK',
            firebase_last_sync: '12:00:00',
            [K.USER_LEVEL]: 'BI',
        });
        expect(localStorage.getItem(K.ACCESS)).toBeNull();
        expect(localStorage.getItem('LAST_ACTIVE_ROUTE')).toBe('SITES');
        expect(localStorage.getItem('firebase_last_sync')).toBeNull();
    });

    it('stores text as data: a hostile value is kept as a string and never run', () => {
        const hostile = '<img src=x onerror="window.__pwned=1">';
        restore({ [K.LOGBOOK_DATA]: [{ id: 'f1', site: hostile }] });
        expect(StorageService.get(K.LOGBOOK_DATA)[0].site).toBe(hostile);
        expect(/** @type {any} */ (window).__pwned).toBeUndefined();
    });

    it('keeps only text ids in pending deletions', () => {
        restore({ deleted_flights: ['a', 7, '', null], deleted_equipment: ['w'] });
        expect(JSON.parse(localStorage.getItem('deleted_flights'))).toEqual(['a']);
        expect(JSON.parse(localStorage.getItem('deleted_equipment'))).toEqual(['w']);
    });

    it('ignores a __proto__ key coming from the file', () => {
        const parsed = parseBackup(
            `{"_meta":{"appName":"AssistantParapente"},"__proto__":{"polluted":true},"${K.USER_LEVEL}":"BI"}`,
        );
        expect(parsed.ok).toBe(true);
        applyBackup(parsed.ok ? parsed.backup : {});
        expect(/** @type {any} */ ({}).polluted).toBeUndefined();
    });
});
