import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { importBackupAction, exportBackupAction } from '../../js/core/backup_ui.js';
import StorageService from '../../js/services/storage.js';
import GdprEngine from '../../js/gdpr_engine.js';

const K = StorageService.KEYS;
const backupFile = (data, meta = {}) =>
    new File(
        [
            JSON.stringify({
                _meta: { appName: 'AssistantParapente', exportedAt: '2026-10-01T10:00:00.000Z', ...meta },
                ...data,
            }),
        ],
        'b.json',
    );

describe('Local backup UI (no account, no Firebase consent)', () => {
    let reload;
    let confirm;

    beforeEach(() => {
        localStorage.clear();
        document.body.innerHTML = '<div class="backup-status"></div><div class="backup-status"></div>';
        reload = vi.fn();
        confirm = vi.fn(() => true);
        window.FirebaseAuthEngine = undefined;
        GdprEngine.consent = { stats: true, firebase: false, gps: false, date: null };
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    const status = () => [...document.querySelectorAll('.backup-status')].map((el) => el.textContent);

    it('restores after confirmation, shows the result everywhere, then reloads', async () => {
        await importBackupAction(backupFile({ [K.LOGBOOK_DATA]: [{ id: 'f1' }] }), { confirm, reload });

        expect(confirm).toHaveBeenCalledOnce();
        expect(confirm.mock.calls[0][0]).toContain('remplacées');
        expect(StorageService.get(K.LOGBOOK_DATA)).toEqual([{ id: 'f1' }]);
        expect(status()).toEqual([expect.stringContaining('restaurées'), expect.stringContaining('restaurées')]);
        expect(reload).not.toHaveBeenCalled();
        vi.advanceTimersByTime(2000);
        expect(reload).toHaveBeenCalledOnce();
    });

    it('writes nothing and does not reload when the user declines', async () => {
        confirm.mockReturnValue(false);
        await importBackupAction(backupFile({ [K.LOGBOOK_DATA]: [{ id: 'f1' }] }), { confirm, reload });
        expect(StorageService.get(K.LOGBOOK_DATA)).toBeNull();
        vi.advanceTimersByTime(2000);
        expect(reload).not.toHaveBeenCalled();
    });

    it('shows an error and asks nothing for a foreign file', async () => {
        await importBackupAction(new File(['{"hello":1}'], 'x.json'), { confirm, reload });
        expect(confirm).not.toHaveBeenCalled();
        expect(status()[0]).toContain('pas une sauvegarde');
        expect(document.querySelector('.backup-status').className).toContain('error');
    });

    it('asks for a file when none is given', async () => {
        await importBackupAction(null, { confirm, reload });
        expect(status()[0]).toContain('Aucun fichier');
    });

    it('does not touch the cloud when nobody is signed in', async () => {
        const syncDataWithCloud = vi.fn();
        window.FirebaseAuthEngine = /** @type {any} */ ({ currentUser: null, enabled: true, syncDataWithCloud });
        await importBackupAction(backupFile({ [K.USER_LEVEL]: 'BI' }), { confirm, reload });
        expect(syncDataWithCloud).not.toHaveBeenCalled();
    });

    it('syncs once, silently, when the user is signed in', async () => {
        const syncDataWithCloud = vi.fn().mockResolvedValue({ success: true });
        window.FirebaseAuthEngine = /** @type {any} */ ({
            currentUser: { uid: 'u' },
            enabled: true,
            syncDataWithCloud,
        });
        await importBackupAction(backupFile({ [K.USER_LEVEL]: 'BI' }), { confirm, reload });
        expect(syncDataWithCloud).toHaveBeenCalledOnce();
        expect(syncDataWithCloud).toHaveBeenCalledWith(true);
    });

    it('tells the user when statistics were not restored because of their privacy choice', async () => {
        GdprEngine.consent = { stats: false, firebase: false, gps: false, date: null };
        await importBackupAction(backupFile({ [K.QCM_STATS]: { q: {} }, [K.USER_LEVEL]: 'BI' }), { confirm, reload });
        expect(localStorage.getItem(K.QCM_STATS)).toBeNull();
        expect(status()[0]).toContain('statistiques');
    });

    it('exports with a confirmation message and no sign-in', async () => {
        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
        await exportBackupAction();
        expect(status()[0]).toMatch(/parapente_backup_\d{4}-\d{2}-\d{2}\.json/);
    });

    it('restores the GPS traces and reports how many', async () => {
        const IDBStorage = (await import('../../js/services/idb_storage.js')).default;
        const { encodeTrace } = await import('../../js/utils/trace_codec.js');
        vi.spyOn(IDBStorage, 'isSupported').mockReturnValue(true);
        const saveTrace = vi.spyOn(IDBStorage, 'saveTrace').mockResolvedValue(true);
        const encoded = await encodeTrace('AXXX demo\n', { partChars: Infinity });

        await importBackupAction(
            backupFile({
                [K.LOGBOOK_DATA]: [{ id: 'f1' }],
                igc_traces: { f1: { encoding: encoded.encoding, data: encoded.parts[0] } },
            }),
            { confirm, reload },
        );

        expect(saveTrace).toHaveBeenCalledWith('f1', 'AXXX demo\n');
        expect(status()[0]).toContain('Traces GPS restaurées : 1');
    });
});
