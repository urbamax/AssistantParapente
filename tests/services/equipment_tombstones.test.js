import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FirebaseAuthEngine } from '../../js/services/firebase_service.js';
import LogbookService from '../../js/services/logbook_service.js';
import SitesService from '../../js/services/sites_service.js';
import StorageService from '../../js/services/storage.js';
import QuizView from '../../js/views/quiz.js';

// Spec 015 : un équipement supprimé ne doit pas être ramené par la synchro cloud, même si la
// suppression cloud immédiate n'a pas abouti (hors ligne, connexion pas prête).

/** Firestore en mémoire : juste ce que syncDataWithCloud utilise. */
function createFakeFirestore(initialDocs = {}) {
    const docs = new Map(Object.entries(initialDocs));
    const ref = (_db, ...segments) => ({ path: segments.join('/') });
    return {
        docs,
        module: {
            doc: ref,
            collection: ref,
            getDoc: async (r) => ({ exists: () => docs.has(r.path), data: () => docs.get(r.path) }),
            setDoc: async (r, data) => {
                docs.set(r.path, JSON.parse(JSON.stringify(data)));
            },
            deleteDoc: vi.fn(async (r) => {
                docs.delete(r.path);
            }),
            getDocs: async (col) => {
                const prefix = `${col.path}/`;
                const matches = [...docs.entries()].filter(
                    ([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes('/'),
                );
                return { forEach: (cb) => matches.forEach(([, data]) => cb({ data: () => data })) };
            },
        },
    };
}

const oldWing = { id: 'wing-old', nom: 'Vieille voile', type: 'voile', statut: 'actif', updatedAt: 1000 };
const newWing = { id: 'wing-new', nom: 'Nouvelle voile', type: 'voile', statut: 'actif', updatedAt: 2000 };
const cloudHarness = { id: 'harness-cloud', nom: 'Sellette', type: 'sellette', statut: 'actif', updatedAt: 3000 };

const localEquipmentIds = () => (StorageService.get(StorageService.KEYS.EQUIPMENT_DATA) || []).map((e) => e.id);
const pendingDeletions = () => JSON.parse(localStorage.getItem('deleted_equipment') || '[]');

describe('Deleted equipment and cloud sync (spec 015)', () => {
    const defaultLoadFirestore = FirebaseAuthEngine._loadFirestore;
    let firestore;

    beforeEach(() => {
        localStorage.clear();
        LogbookService.flights = [];
        LogbookService.equipment = [structuredClone(oldWing), structuredClone(newWing)];
        LogbookService.saveEquipment();

        firestore = createFakeFirestore({
            'users/u1/equipment/wing-old': structuredClone(oldWing),
            'users/u1/equipment/wing-new': structuredClone(newWing),
            'users/u1/equipment/harness-cloud': structuredClone(cloudHarness),
        });
        FirebaseAuthEngine._loadFirestore = async () => firestore.module;
        FirebaseAuthEngine.currentUser = { uid: 'u1' };
        FirebaseAuthEngine.enabled = true;
        window.FirebaseAuthEngine = FirebaseAuthEngine;

        // La suppression cloud immédiate échoue en silence (hors ligne, connexion pas prête).
        vi.spyOn(FirebaseAuthEngine, 'deleteEquipmentEntry').mockResolvedValue({
            success: false,
            data: null,
            error: 'Offline',
        });
        vi.spyOn(FirebaseAuthEngine, 'syncEquipmentData').mockResolvedValue({ success: false });
        vi.spyOn(FirebaseAuthEngine, 'syncLogbookData').mockResolvedValue({ success: false });
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

    it('does not bring back an item deleted while the cloud delete failed', async () => {
        LogbookService.deleteEquipment('wing-old');
        expect(localEquipmentIds()).toEqual(['wing-new']);

        const result = await FirebaseAuthEngine.syncDataWithCloud(true);

        expect(result.success).toBe(true);
        expect(localEquipmentIds()).not.toContain('wing-old');
        expect(firestore.docs.has('users/u1/equipment/wing-old')).toBe(false);
        // Les autres équipements sont fusionnés comme avant.
        expect(localEquipmentIds().sort()).toEqual(['harness-cloud', 'wing-new']);
        expect(pendingDeletions()).toEqual([]);
    });

    it('does not replay deletions on the next sync', async () => {
        LogbookService.deleteEquipment('wing-old');
        await FirebaseAuthEngine.syncDataWithCloud(true);
        firestore.module.deleteDoc.mockClear();

        await FirebaseAuthEngine.syncDataWithCloud(true);

        expect(firestore.module.deleteDoc).not.toHaveBeenCalled();
        expect(localEquipmentIds().sort()).toEqual(['harness-cloud', 'wing-new']);
    });

    it('keeps pending deletions when the cloud delete fails during the sync', async () => {
        LogbookService.deleteEquipment('wing-old');
        firestore.module.deleteDoc.mockRejectedValueOnce(new Error('unavailable'));
        vi.spyOn(console, 'error').mockImplementation(() => {});

        const result = await FirebaseAuthEngine.syncDataWithCloud(true);

        expect(result.success).toBe(false);
        expect(pendingDeletions()).toEqual(['wing-old']);
        expect(localEquipmentIds()).not.toContain('wing-old');
    });

    it('records each deleted id once and survives a corrupted list', () => {
        localStorage.setItem('deleted_equipment', '{corrupted');
        LogbookService.deleteEquipment('wing-old');
        LogbookService.deleteEquipment('wing-old');
        expect(pendingDeletions()).toEqual(['wing-old']);
    });
});

describe('Pending equipment deletions in backup and restore (spec 015)', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('exports pending equipment deletions', async () => {
        localStorage.clear();
        localStorage.setItem('deleted_equipment', JSON.stringify(['wing-old']));
        let blob;
        vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => {
            blob = b;
            return 'blob:backup';
        });
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
        vi.spyOn(FirebaseAuthEngine, 'showAlert').mockImplementation(() => {});

        FirebaseAuthEngine.exportAllData();

        const payload = JSON.parse(await blob.text());
        expect(payload.deleted_equipment).toEqual(['wing-old']);
    });

    it('restores pending equipment deletions', async () => {
        localStorage.clear();
        const originalFileReader = global.FileReader;
        global.FileReader = class {
            readAsText(file) {
                this.onload({ target: { result: file.content } });
            }
        };
        const originalConfirm = window.confirm;
        window.confirm = vi.fn(() => true);
        vi.spyOn(FirebaseAuthEngine, 'showAlert').mockImplementation(() => {});
        vi.spyOn(FirebaseAuthEngine, 'showStatus').mockImplementation(() => {});
        FirebaseAuthEngine.currentUser = null;

        const content = JSON.stringify({
            _meta: { appName: 'AssistantParapente', exportedAt: new Date().toISOString() },
            deleted_equipment: ['wing-old'],
        });
        FirebaseAuthEngine.importAllData(/** @type {any} */ ({ name: 'backup.json', content }));
        await new Promise((resolve) => setTimeout(resolve, 0));
        global.FileReader = originalFileReader;
        window.confirm = originalConfirm;

        expect(JSON.parse(localStorage.getItem('deleted_equipment'))).toEqual(['wing-old']);
    });
});
