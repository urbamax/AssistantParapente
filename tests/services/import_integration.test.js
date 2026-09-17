import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { FirebaseAuthEngine } from '../../js/services/firebase_service.js';
import StorageService from '../../js/services/storage.js';

// Mock de FileReader car l'implémentation native peut varier avec l'asynchronisme dans les tests
class MockFileReader {
    constructor() {
        this.onload = null;
        this.result = null;
    }
    readAsText(file) {
        // On utilise la propriété "content" injectée sur notre faux objet File
        this.result = file.content;
        if (this.onload) {
            // L'appel déclenche le onload de importAllData()
            this.onload({ target: { result: this.result } });
        }
    }
}

describe('Integration - JSON Import (FirebaseAuthEngine.importAllData)', () => {
    const originalFileReader = global.FileReader;
    const originalConfirm = window.confirm;

    beforeEach(() => {
        // Nettoyage complet
        localStorage.clear();

        // Mocks
        global.FileReader = MockFileReader;
        window.confirm = vi.fn();

        // Espions sur FirebaseAuthEngine
        vi.spyOn(FirebaseAuthEngine, 'showAlert').mockImplementation(() => {});
        vi.spyOn(FirebaseAuthEngine, 'showStatus').mockImplementation(() => {});
        vi.spyOn(FirebaseAuthEngine, 'syncDataWithCloud').mockResolvedValue(true);

        // Par défaut, l'utilisateur n'est pas connecté
        FirebaseAuthEngine.currentUser = null;
        FirebaseAuthEngine.enabled = true;
    });

    afterEach(() => {
        // Restauration
        global.FileReader = originalFileReader;
        window.confirm = originalConfirm;
        vi.restoreAllMocks();
    });

    it('Scénario 1 : Fichier Invalide (Sécurité Zod) - Absence de _meta.appName', async () => {
        const invalidJSON = JSON.stringify({
            tp_logbook_data: [{ id: 'vol-123' }],
            // L'objet _meta manque intentionnellement
        });

        const fakeFile = { name: 'backup.json', content: invalidJSON };

        FirebaseAuthEngine.importAllData(fakeFile);
        await new Promise((resolve) => setTimeout(resolve, 0)); // Flush promises

        // Assertions
        expect(FirebaseAuthEngine.showAlert).toHaveBeenCalledWith(
            expect.stringContaining("ce n'est pas un backup AssistantParapente"),
            'error',
        );
        expect(window.confirm).not.toHaveBeenCalled();
        expect(StorageService.get(StorageService.KEYS.LOGBOOK_DATA)).toBeNull();
    });

    it('Scénario 2 : Annulation Utilisateur (window.confirm retourne false)', async () => {
        const validJSON = JSON.stringify({
            _meta: { appName: 'AssistantParapente', exportedAt: new Date().toISOString() },
            tp_logbook_data: [{ id: 'vol-123' }],
        });
        const fakeFile = { name: 'backup.json', content: validJSON };

        // L'utilisateur annule
        window.confirm.mockReturnValue(false);

        FirebaseAuthEngine.importAllData(fakeFile);
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Assertions
        expect(FirebaseAuthEngine.showAlert).not.toHaveBeenCalled();
        expect(window.confirm).toHaveBeenCalled();

        // Vérifie que les données n'ont pas été écrasées
        expect(StorageService.get(StorageService.KEYS.LOGBOOK_DATA)).toBeNull();
    });

    it('Scénario 3 : Happy Path - JSON valide, confirmation à true et synchro Cloud', async () => {
        const validJSON = JSON.stringify({
            _meta: { appName: 'AssistantParapente', exportedAt: new Date().toISOString() },
            [StorageService.KEYS.LOGBOOK_DATA]: [{ id: 'vol-123', site: 'Annecy' }],
            [StorageService.KEYS.USER_PREFS]: { themeMode: 'dark' },
            firebase_last_sync: '12:00:00', // Clé système directe
        });
        const fakeFile = { name: 'backup.json', content: validJSON };

        // L'utilisateur valide
        window.confirm.mockReturnValue(true);

        // On connecte un faux utilisateur pour déclencher la synchro
        FirebaseAuthEngine.currentUser = { uid: 'user123' };

        FirebaseAuthEngine.importAllData(fakeFile);
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Assertions UI
        expect(window.confirm).toHaveBeenCalled();
        expect(FirebaseAuthEngine.showStatus).toHaveBeenCalledWith('Restauration en cours...', 'info');

        // Assertions StorageService (données métiers parsées)
        const restoredLogbook = StorageService.get(StorageService.KEYS.LOGBOOK_DATA);
        expect(restoredLogbook).toHaveLength(1);
        expect(restoredLogbook[0].id).toBe('vol-123');

        const restoredPrefs = StorageService.get(StorageService.KEYS.USER_PREFS);
        expect(restoredPrefs.themeMode).toBe('dark');

        // Assertions Clés système brutes (non parsées)
        expect(localStorage.getItem('firebase_last_sync')).toBe('12:00:00');

        // Assertion Synchro Cloud
        expect(FirebaseAuthEngine.syncDataWithCloud).toHaveBeenCalledWith(false);
    });
});
