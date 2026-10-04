import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FirebaseAuthEngine } from '../../js/services/firebase_service.js';
import LogbookService from '../../js/services/logbook_service.js';
import SitesService from '../../js/services/sites_service.js';
import StorageService from '../../js/services/storage.js';
import QuizView from '../../js/views/quiz.js';
import { createFakeFirestore } from '../fixtures/fake_firestore.js';

// Spec 027 : un vol supprimé ne doit pas être ramené par la synchro cloud, que la suppression
// cloud immédiate ait échoué avant la synchro ou que la suppression ait lieu pendant la synchro.

const oldFlight = { id: 'vol-old', datetime: '2026-08-01T10:00:00Z', site: 'Annecy', updatedAt: 1000 };
const newFlight = { id: 'vol-new', datetime: '2026-08-02T10:00:00Z', site: 'Chamonix', updatedAt: 2000 };
const cloudFlight = { id: 'vol-cloud', datetime: '2026-08-03T10:00:00Z', site: 'Saint-Hilaire', updatedAt: 3000 };

const localFlightIds = () => (StorageService.get(StorageService.KEYS.LOGBOOK_DATA) || []).map((f) => f.id).sort();
const pendingDeletions = () => JSON.parse(localStorage.getItem('deleted_flights') || '[]');

describe('Deleted flights and cloud sync (spec 027)', () => {
    const defaultLoadFirestore = FirebaseAuthEngine._loadFirestore;
    let firestore;

    beforeEach(() => {
        localStorage.clear();
        LogbookService.equipment = [];
        LogbookService.flights = [structuredClone(oldFlight), structuredClone(newFlight)];
        StorageService.set(StorageService.KEYS.LOGBOOK_DATA, LogbookService.flights);

        firestore = createFakeFirestore({
            'users/u1/logbook/vol-old': structuredClone(oldFlight),
            'users/u1/logbook/vol-new': structuredClone(newFlight),
            'users/u1/logbook/vol-cloud': structuredClone(cloudFlight),
        });
        FirebaseAuthEngine._loadFirestore = async () => firestore.module;
        FirebaseAuthEngine.currentUser = { uid: 'u1' };
        FirebaseAuthEngine.enabled = true;
        window.FirebaseAuthEngine = FirebaseAuthEngine;

        // La suppression cloud immédiate échoue en silence (hors ligne, connexion pas prête).
        vi.spyOn(FirebaseAuthEngine, 'deleteLogbookEntry').mockResolvedValue({
            success: false,
            data: null,
            error: 'Offline',
        });
        vi.spyOn(FirebaseAuthEngine, 'syncLogbookData').mockResolvedValue({ success: false });
        vi.spyOn(FirebaseAuthEngine, 'syncEquipmentData').mockResolvedValue({ success: false });
        vi.spyOn(FirebaseAuthEngine, 'triggerDebouncedSync').mockImplementation(() => {});
        // Rafraîchissements d'écran en fin de synchro : hors sujet ici.
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
        window.FirebaseAuthEngine = undefined;
    });

    it('does not bring back a flight deleted while the cloud delete failed', async () => {
        LogbookService.deleteFlight('vol-old');

        const result = await FirebaseAuthEngine.syncDataWithCloud(true);

        expect(result.success).toBe(true);
        expect(localFlightIds()).toEqual(['vol-cloud', 'vol-new']);
        expect(firestore.docs.has('users/u1/logbook/vol-old')).toBe(false);
        expect(pendingDeletions()).toEqual([]);
    });

    it('does not replay deletions on the next sync', async () => {
        LogbookService.deleteFlight('vol-old');
        await FirebaseAuthEngine.syncDataWithCloud(true);
        firestore.module.deleteDoc.mockClear();

        await FirebaseAuthEngine.syncDataWithCloud(true);

        expect(firestore.module.deleteDoc).not.toHaveBeenCalled();
        expect(localFlightIds()).toEqual(['vol-cloud', 'vol-new']);
    });

    it('keeps pending deletions when the cloud delete fails during the sync', async () => {
        LogbookService.deleteFlight('vol-old');
        firestore.module.deleteDoc.mockRejectedValueOnce(new Error('unavailable'));
        vi.spyOn(console, 'error').mockImplementation(() => {});

        const result = await FirebaseAuthEngine.syncDataWithCloud(true);

        expect(result.success).toBe(false);
        expect(pendingDeletions()).toEqual(['vol-old']);
        expect(localFlightIds()).not.toContain('vol-old');
    });

    it('does not bring back a flight deleted while the sync is running', async () => {
        // Le pilote supprime le vol pendant que la synchro lit le cloud.
        const getDocs = firestore.module.getDocs;
        firestore.module.getDocs = async (col) => {
            if (col.path === 'users/u1/logbook') LogbookService.deleteFlight('vol-old');
            return getDocs(col);
        };

        await FirebaseAuthEngine.syncDataWithCloud(true);
        expect(localFlightIds()).toEqual(['vol-cloud', 'vol-new']);
        expect(pendingDeletions()).toEqual(['vol-old']);

        // La synchro suivante termine la suppression dans le cloud, sans renvoyer le vol.
        firestore.module.getDocs = getDocs;
        await FirebaseAuthEngine.syncDataWithCloud(true);
        expect(localFlightIds()).toEqual(['vol-cloud', 'vol-new']);
        expect(firestore.docs.has('users/u1/logbook/vol-old')).toBe(false);
    });
});
