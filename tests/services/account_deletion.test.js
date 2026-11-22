import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FirebaseAuthEngine } from '../../js/services/firebase_service.js';
import { getIceCloudState, setIceCloudState } from '../../js/services/ice_cloud_state.js';
import { createFakeFirestore } from '../fixtures/fake_firestore.js';

// Suppression du compte et de toutes les données en ligne (spec 059) : faite dans l'application,
// mot de passe redemandé d'abord, synchro suspendue, chaque document de users/{uid} effacé, puis le
// compte Firebase Auth. Les données de l'appareil restent.

const UID = 'u1';
const SUBCOLLECTIONS = ['logbook', 'igcTraces', 'equipment', 'stats', 'preferences', 'ice', 'access', 'pushState'];

function seedDocs() {
    return {
        [`users/${UID}`]: { fcmToken: 'jeton' },
        [`users/${UID}/logbook/f1`]: { id: 'f1', site: 'Annecy' },
        [`users/${UID}/logbook/f2`]: { id: 'f2', deleted: true },
        [`users/${UID}/igcTraces/f1_0`]: { flightId: 'f1', index: 0, total: 2, data: 'a' },
        [`users/${UID}/igcTraces/f1_1`]: { flightId: 'f1', index: 1, total: 2, data: 'b' },
        [`users/${UID}/igcTraces/orphan_0`]: { flightId: 'orphan', index: 0, total: 1, data: 'c' },
        [`users/${UID}/equipment/e1`]: { id: 'e1' },
        [`users/${UID}/stats/qcm_stats`]: { total: 3 },
        [`users/${UID}/stats/exam_history`]: { exams: [] },
        [`users/${UID}/preferences/user_prefs`]: { favoriteSites: [] },
        [`users/${UID}/ice/profile`]: { updatedAt: 1, consentAt: 'x' },
        [`users/${UID}/access/profile`]: { roles: ['beta'] },
        [`users/${UID}/pushState/favoriteSitesFlyable`]: { a: 1 },
        // Un autre pilote : jamais touché.
        'users/u2/logbook/f9': { id: 'f9' },
    };
}

function createFakeAuth({ reauthError = null, deleteError = null, calls } = {}) {
    return {
        EmailAuthProvider: { credential: vi.fn((email, password) => ({ email, password })) },
        reauthenticateWithCredential: vi.fn(async (user, cred) => {
            calls.push('reauth');
            if (reauthError) throw Object.assign(new Error(reauthError), { code: reauthError });
            return { user, cred };
        }),
        deleteUser: vi.fn(async () => {
            calls.push('deleteUser');
            if (deleteError) throw Object.assign(new Error(deleteError), { code: deleteError });
        }),
    };
}

describe('FirebaseAuthEngine.deleteAccount', () => {
    const defaultLoadFirestore = FirebaseAuthEngine._loadFirestore;
    const defaultLoadAuth = FirebaseAuthEngine._loadAuth;
    let firestore;
    let auth;
    let calls;

    const setup = (authOptions = {}) => {
        calls = [];
        firestore = createFakeFirestore(seedDocs());
        const originalDelete = firestore.module.deleteDoc;
        firestore.module.deleteDoc = vi.fn(async (ref) => {
            calls.push(`delete ${ref.path}`);
            return originalDelete(ref);
        });
        auth = createFakeAuth({ ...authOptions, calls });
        FirebaseAuthEngine._loadFirestore = async () => firestore.module;
        FirebaseAuthEngine._loadAuth = async () => auth;
    };

    beforeEach(() => {
        localStorage.clear();
        setup();
        FirebaseAuthEngine.currentUser = /** @type {any} */ ({ uid: UID, email: 'pilote@example.test' });
        FirebaseAuthEngine.enabled = true;
        FirebaseAuthEngine._accountDeletion = false;
        Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        FirebaseAuthEngine._loadFirestore = defaultLoadFirestore;
        FirebaseAuthEngine._loadAuth = defaultLoadAuth;
        FirebaseAuthEngine.currentUser = null;
        FirebaseAuthEngine.enabled = false;
        FirebaseAuthEngine._accountDeletion = false;
        if (FirebaseAuthEngine._syncInterval) clearInterval(FirebaseAuthEngine._syncInterval);
        FirebaseAuthEngine._syncInterval = null;
    });

    const remainingFor = (uid) =>
        [...firestore.docs.keys()].filter((p) => p === `users/${uid}` || p.startsWith(`users/${uid}/`));

    it('supprime chaque document de chaque sous-collection, le document du compte, puis le compte', async () => {
        const result = await FirebaseAuthEngine.deleteAccount('secret');
        expect(result).toEqual({ success: true, data: expect.any(Object), error: null });
        expect(remainingFor(UID)).toEqual([]);
        expect(remainingFor('u2')).toEqual(['users/u2/logbook/f9']);
        expect(auth.deleteUser).toHaveBeenCalledWith(FirebaseAuthEngine.currentUser ?? expect.anything());
        for (const sub of SUBCOLLECTIONS) {
            expect(calls.some((c) => c.startsWith(`delete users/${UID}/${sub}/`))).toBe(true);
        }
    });

    it('redemande le mot de passe avant toute suppression, et supprime le compte en dernier', async () => {
        await FirebaseAuthEngine.deleteAccount('secret');
        expect(auth.EmailAuthProvider.credential).toHaveBeenCalledWith('pilote@example.test', 'secret');
        expect(calls[0]).toBe('reauth');
        expect(calls.at(-1)).toBe('deleteUser');
        expect(calls.at(-2)).toBe(`delete users/${UID}`);
    });

    it('efface les morceaux de trace par leur identifiant, sans télécharger les traces des vols connus', async () => {
        const getDocs = vi.spyOn(firestore.module, 'getDocs');
        await FirebaseAuthEngine.deleteAccount('secret');
        expect(calls).toContain(`delete users/${UID}/igcTraces/f1_0`);
        expect(calls).toContain(`delete users/${UID}/igcTraces/f2_11`);
        // Le listage final des traces ne voit plus que l'orphelin.
        const traceListings = getDocs.mock.results.filter((_r, i) =>
            getDocs.mock.calls[i][0].path.endsWith('/igcTraces'),
        );
        expect(traceListings).toHaveLength(1);
        expect((await traceListings[0].value).docs.map((d) => d.id)).toEqual(['orphan_0']);
    });

    it('sans mot de passe : rien n’est supprimé', async () => {
        const result = await FirebaseAuthEngine.deleteAccount('');
        expect(result).toEqual({ success: false, data: null, error: 'password-required' });
        expect(calls).toEqual([]);
    });

    it.each([
        ['auth/wrong-password', 'wrong-password'],
        ['auth/invalid-credential', 'wrong-password'],
        ['auth/too-many-requests', 'too-many-requests'],
        ['auth/network-request-failed', 'network'],
    ])('mot de passe refusé (%s) : rien n’est supprimé, erreur %s', async (code, error) => {
        setup({ reauthError: code });
        const result = await FirebaseAuthEngine.deleteAccount('faux');
        expect(result).toMatchObject({ success: false, error });
        expect(calls).toEqual(['reauth']);
        expect(remainingFor(UID)).toHaveLength(Object.keys(seedDocs()).length - 1);
    });

    it('hors ligne : rien n’est tenté', async () => {
        Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
        const result = await FirebaseAuthEngine.deleteAccount('secret');
        expect(result).toMatchObject({ success: false, error: 'offline' });
        expect(calls).toEqual([]);
    });

    it('non connecté : erreur sans appel', async () => {
        FirebaseAuthEngine.currentUser = null;
        expect(await FirebaseAuthEngine.deleteAccount('secret')).toMatchObject({
            success: false,
            error: 'not-signed-in',
        });
        expect(calls).toEqual([]);
    });

    it('une erreur pendant les suppressions : résultat « incomplet », compte gardé, synchro toujours suspendue', async () => {
        firestore.module.deleteDoc = vi.fn(async () => {
            throw Object.assign(new Error('unavailable'), { code: 'unavailable' });
        });
        const result = await FirebaseAuthEngine.deleteAccount('secret');
        expect(result).toMatchObject({ success: false, error: 'incomplete' });
        expect(auth.deleteUser).not.toHaveBeenCalled();
        expect(FirebaseAuthEngine._accountDeletion).toBe(true);
    });

    it('auth/requires-recent-login à la suppression du compte : erreur dédiée, nouvel essai possible', async () => {
        setup({ deleteError: 'auth/requires-recent-login' });
        const result = await FirebaseAuthEngine.deleteAccount('secret');
        expect(result).toMatchObject({ success: false, error: 'requires-recent-login' });
        expect(FirebaseAuthEngine._accountDeletion).toBe(true);
        // Nouvel essai : les données déjà effacées ne gênent pas.
        auth.deleteUser = vi.fn(async () => {});
        expect(await FirebaseAuthEngine.deleteAccount('secret')).toMatchObject({ success: true });
        expect(auth.deleteUser).toHaveBeenCalledTimes(1);
    });

    it('remet à zéro la sauvegarde en ligne de la fiche ICE sur cet appareil, sans toucher aux données locales', async () => {
        setIceCloudState({ enabled: true, consentAt: '2026-11-09T21:00:00.000Z', updatedAt: 5, lastSyncedAt: 9 });
        localStorage.setItem('logbook_sessions', JSON.stringify([{ id: 'f1' }]));
        await FirebaseAuthEngine.deleteAccount('secret');
        expect(getIceCloudState()).toEqual({ enabled: false, consentAt: '', updatedAt: 5, lastSyncedAt: 0 });
        expect(localStorage.getItem('logbook_sessions')).toBe(JSON.stringify([{ id: 'f1' }]));
    });

    it('attend la synchro en cours avant de supprimer', async () => {
        let finishSync;
        FirebaseAuthEngine._activeSyncPromise = new Promise((resolve) => {
            finishSync = () => {
                calls.push('sync done');
                resolve({ success: true });
            };
        });
        const pending = FirebaseAuthEngine.deleteAccount('secret');
        await new Promise((r) => setTimeout(r, 0));
        expect(calls.filter((c) => c.startsWith('delete'))).toEqual([]);
        finishSync();
        await pending;
        FirebaseAuthEngine._activeSyncPromise = null;
        expect(calls.indexOf('sync done')).toBeLessThan(calls.findIndex((c) => c.startsWith('delete')));
    });

    describe('synchro suspendue pendant la suppression', () => {
        beforeEach(() => {
            FirebaseAuthEngine._accountDeletion = true;
        });

        it('aucune synchro complète ni écriture directe ne part', async () => {
            const setDoc = firestore.module.setDoc;
            expect(await FirebaseAuthEngine.syncDataWithCloud(true)).toMatchObject({ success: false });
            for (const method of [
                'saveStatsToCloud',
                'saveHistoryToCloud',
                'savePreferencesToCloud',
                'syncLogbookData',
                'syncEquipmentData',
                'syncEquipmentEntry',
                'syncLogbookEntry',
                'deleteLogbookEntry',
                'deleteEquipmentEntry',
            ]) {
                const result = await FirebaseAuthEngine[method]({ id: 'x' });
                expect(result, method).toMatchObject({ success: false });
            }
            expect(setDoc).not.toHaveBeenCalled();
            expect(firestore.module.deleteDoc).not.toHaveBeenCalled();
        });

        it('la synchro différée n’est pas programmée', () => {
            FirebaseAuthEngine.triggerDebouncedSync();
            expect(FirebaseAuthEngine._debounceSyncTimer).toBeFalsy();
        });

        it('annuler reprend la synchro automatique', () => {
            FirebaseAuthEngine.cancelDeleteAccount();
            expect(FirebaseAuthEngine._accountDeletion).toBe(false);
            expect(FirebaseAuthEngine._syncInterval).toBeTruthy();
        });
    });
});
