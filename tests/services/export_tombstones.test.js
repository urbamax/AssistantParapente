import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FirebaseAuthEngine } from '../../js/services/firebase_service.js';
import LogbookService from '../../js/services/logbook_service.js';
import SitesService from '../../js/services/sites_service.js';
import StorageService from '../../js/services/storage.js';
import { exportBackup } from '../../js/services/backup_service.js';
import QuizView from '../../js/views/quiz.js';
import { createFakeFirestore } from '../fixtures/fake_firestore.js';

// Spec 024 : une liste de suppressions illisible ne doit ni empêcher la sauvegarde complète, ni
// faire supprimer dans le cloud des identifiants inventés.

const flight = { id: 'vol-1', datetime: '2026-09-01T10:00:00Z', site: 'Annecy', updatedAt: 1000 };

describe('Full backup with unreadable deletion lists (spec 024)', () => {
    let blob;

    beforeEach(() => {
        localStorage.clear();
        StorageService.set(StorageService.KEYS.LOGBOOK_DATA, [flight]);
        blob = undefined;
        vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => {
            blob = b;
            return 'blob:backup';
        });
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const exportPayload = async () => {
        exportBackup();
        expect(blob).toBeDefined();
        return JSON.parse(await blob.text());
    };

    it('still downloads the backup when a list is not valid JSON', async () => {
        localStorage.setItem('deleted_flights', '{corrupted');
        localStorage.setItem('deleted_equipment', '[unterminated');

        const payload = await exportPayload();

        expect(payload[StorageService.KEYS.LOGBOOK_DATA]).toEqual([flight]);
        expect(payload.deleted_flights).toEqual([]);
        expect(payload.deleted_equipment).toEqual([]);
    });

    it('exports a list that is not an array as empty', async () => {
        localStorage.setItem('deleted_flights', JSON.stringify({ id: 'vol-9' }));
        localStorage.setItem('deleted_equipment', JSON.stringify('wing'));

        const payload = await exportPayload();

        expect(payload.deleted_flights).toEqual([]);
        expect(payload.deleted_equipment).toEqual([]);
    });

    it('exports valid lists unchanged, keeping only string ids', async () => {
        localStorage.setItem('deleted_flights', JSON.stringify(['vol-2', null, 7, '']));
        localStorage.setItem('deleted_equipment', JSON.stringify(['wing-old']));

        const payload = await exportPayload();

        expect(payload.deleted_flights).toEqual(['vol-2']);
        expect(payload.deleted_equipment).toEqual(['wing-old']);
    });
});

describe('Cloud sync with a deletion list stored as a string (spec 024)', () => {
    const defaultLoadFirestore = FirebaseAuthEngine._loadFirestore;
    let firestore;

    beforeEach(() => {
        localStorage.clear();
        LogbookService.flights = [];
        LogbookService.equipment = [];
        firestore = createFakeFirestore({ 'users/u1/logbook/a': { id: 'a', datetime: '2026-09-02T10:00:00Z' } });
        FirebaseAuthEngine._loadFirestore = async () => firestore.module;
        FirebaseAuthEngine.currentUser = { uid: 'u1' };
        FirebaseAuthEngine.enabled = true;
        vi.spyOn(QuizView, 'renderStats').mockImplementation(() => {});
        vi.spyOn(SitesService, 'loadUserPreferences').mockImplementation(() => {});
        vi.spyOn(SitesService, 'renderList').mockImplementation(() => {});
        vi.spyOn(FirebaseAuthEngine, 'updateModalUI').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
        FirebaseAuthEngine._loadFirestore = defaultLoadFirestore;
        FirebaseAuthEngine.currentUser = null;
        FirebaseAuthEngine.enabled = false;
    });

    it('does not delete anything from the cloud because of the string', async () => {
        localStorage.setItem('deleted_flights', JSON.stringify('abc'));
        localStorage.setItem('deleted_equipment', JSON.stringify('abc'));

        const result = await FirebaseAuthEngine.syncDataWithCloud(true);

        expect(result.success).toBe(true);
        expect(firestore.module.deleteDoc).not.toHaveBeenCalled();
        expect(firestore.docs.has('users/u1/logbook/a')).toBe(true);
    });
});
