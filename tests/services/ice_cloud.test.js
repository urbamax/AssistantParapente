import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { FirebaseAuthEngine } from '../../js/services/firebase_service.js';
import IceService, { clampProfile } from '../../js/services/ice_service.js';
import { getIceCloudState, setIceCloudState, disableIceCloud } from '../../js/services/ice_cloud_state.js';
import {
    renderIceCloudCard,
    renderIceTabHtml,
    enableIceCloud,
    disableIceCloud as disableIceCloudView,
    clearIceProfile,
    saveIceProfile,
} from '../../js/views/safety_ice.js';
import { createFakeFirestore } from '../fixtures/fake_firestore.js';

// La fiche d'urgence contient des données de santé : elle ne va dans le profil en ligne (users/{uid}/ice/profile)
// que sur demande expresse du pilote, et seulement là (jamais dans les préférences synchronisées).
const PATH = 'users/u1/ice/profile';
const profile = {
    nom: 'Dupont',
    prenom: 'Thomas',
    birthDate: '1988-03-12',
    contact1Name: 'Sophie',
    contact1Phone: '0612345678',
    bloodGroup: 'O+',
    allergies: 'Pénicilline',
    anticoag: '1',
    pays: 'FR',
    ffvl: '1234567',
    federation: 'FFVL',
};

describe('état local de la sauvegarde en ligne', () => {
    beforeEach(() => localStorage.clear());

    it('est désactivé par défaut', () => {
        expect(getIceCloudState()).toEqual({ enabled: false, consentAt: '', updatedAt: 0, lastSyncedAt: 0 });
    });

    it('garde l’accord et ses dates, et ignore les valeurs douteuses', () => {
        setIceCloudState({ enabled: true, consentAt: '2026-11-09T21:00:00.000Z', updatedAt: 5 });
        expect(getIceCloudState()).toMatchObject({
            enabled: true,
            consentAt: '2026-11-09T21:00:00.000Z',
            updatedAt: 5,
        });
        localStorage.setItem(
            'parapente_ice_cloud',
            JSON.stringify({ enabled: 'oui', updatedAt: 'hier', consentAt: 12 }),
        );
        expect(getIceCloudState()).toEqual({ enabled: false, consentAt: '', updatedAt: 0, lastSyncedAt: 0 });
    });

    it('disableIceCloud retire l’accord mais garde la date de la fiche locale', () => {
        setIceCloudState({ enabled: true, consentAt: 'x', updatedAt: 7, lastSyncedAt: 9 });
        disableIceCloud();
        expect(getIceCloudState()).toEqual({ enabled: false, consentAt: '', updatedAt: 7, lastSyncedAt: 0 });
    });

    it('chaque enregistrement local date la fiche ; une fiche reprise du cloud garde la date du cloud', () => {
        const before = Date.now();
        IceService.saveProfile(profile);
        expect(getIceCloudState().updatedAt).toBeGreaterThanOrEqual(before);
        IceService.saveProfile(profile, { updatedAt: 1234 });
        expect(getIceCloudState().updatedAt).toBe(1234);
    });
});

describe('règles Firestore : la fiche de l’application est exactement ce que les règles acceptent', () => {
    it('les champs de clampProfile + updatedAt + consentAt sont la liste hasOnly des règles', () => {
        const rules = readFileSync('firestore.rules', 'utf8');
        const block = /data\.keys\(\)\.hasOnly\(\[\s*([^\]]+)\]\)/.exec(
            rules.slice(rules.indexOf('function isIceProfile')),
        );
        const allowed = block[1].match(/'([^']+)'/g).map((k) => k.replace(/'/g, ''));
        const sent = [...Object.keys(clampProfile({})), 'updatedAt', 'consentAt'];
        expect(allowed.sort()).toEqual(sent.sort());
    });
});

describe('FirebaseAuthEngine : fiche d’urgence en ligne', () => {
    const defaultLoadFirestore = FirebaseAuthEngine._loadFirestore;
    let firestore;

    const useFirestore = (docs = {}) => {
        firestore = createFakeFirestore(docs);
        FirebaseAuthEngine._loadFirestore = async () => firestore.module;
    };

    beforeEach(() => {
        localStorage.clear();
        useFirestore();
        FirebaseAuthEngine.currentUser = { uid: 'u1' };
        FirebaseAuthEngine.enabled = true;
        Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        FirebaseAuthEngine._loadFirestore = defaultLoadFirestore;
        FirebaseAuthEngine.currentUser = null;
        FirebaseAuthEngine.enabled = false;
    });

    // Le module Firestore chargé par les méthodes ICE est celui du moduleLoader interne : on passe par _syncIceProfile
    // (qui reçoit le module) et par les méthodes publiques en injectant la fausse base via un spy de l'import.
    const enable = (extra = {}) => {
        IceService.saveProfile(profile, { updatedAt: 100 });
        setIceCloudState({ enabled: true, consentAt: '2026-11-09T21:00:00.000Z', ...extra });
    };

    describe('_syncIceProfile', () => {
        it('ne lit ni n’écrit rien sans la demande du pilote', async () => {
            IceService.saveProfile(profile);
            await FirebaseAuthEngine._syncIceProfile(firestore.module, 'u1');
            expect(firestore.module.setDoc).not.toHaveBeenCalled();
            expect(firestore.docs.has(PATH)).toBe(false);
        });

        it('première sauvegarde : envoie la fiche avec sa date et la date de l’accord', async () => {
            enable();
            await FirebaseAuthEngine._syncIceProfile(firestore.module, 'u1');
            const stored = firestore.docs.get(PATH);
            expect(stored).toMatchObject({
                nom: 'Dupont',
                bloodGroup: 'O+',
                updatedAt: 100,
                consentAt: '2026-11-09T21:00:00.000Z',
            });
            expect(getIceCloudState().lastSyncedAt).toBeGreaterThan(0);
        });

        it('la fiche locale plus récente écrase celle du cloud', async () => {
            useFirestore({ [PATH]: { ...profile, nom: 'Ancien', updatedAt: 50, consentAt: 'x' } });
            enable();
            await FirebaseAuthEngine._syncIceProfile(firestore.module, 'u1');
            expect(firestore.docs.get(PATH).nom).toBe('Dupont');
            expect(firestore.docs.get(PATH).updatedAt).toBe(100);
        });

        it('la fiche du cloud plus récente est reprise sur l’appareil, avec sa date', async () => {
            useFirestore({ [PATH]: { ...profile, nom: 'Récent', updatedAt: 500, consentAt: 'x' } });
            enable();
            await FirebaseAuthEngine._syncIceProfile(firestore.module, 'u1');
            expect(IceService.getProfile().nom).toBe('Récent');
            expect(getIceCloudState().updatedAt).toBe(500);
            expect(firestore.module.setDoc).not.toHaveBeenCalled();
        });

        it('deux fiches de même date : rien n’est écrit', async () => {
            useFirestore({ [PATH]: { ...profile, updatedAt: 100, consentAt: 'x' } });
            enable();
            await FirebaseAuthEngine._syncIceProfile(firestore.module, 'u1');
            expect(firestore.module.setDoc).not.toHaveBeenCalled();
        });

        it('une fiche supprimée en ligne depuis un autre appareil n’est pas recréée : la sauvegarde s’arrête', async () => {
            enable({ lastSyncedAt: 90 });
            await FirebaseAuthEngine._syncIceProfile(firestore.module, 'u1');
            expect(firestore.docs.has(PATH)).toBe(false);
            expect(getIceCloudState().enabled).toBe(false);
            expect(IceService.getProfile().nom).toBe('Dupont');
        });

        it('n’envoie jamais autre chose que les champs de la fiche (pas de champ du compte ni des préférences)', async () => {
            localStorage.setItem('parapente_user_prefs', JSON.stringify({ favoriteSites: ['a'], themeMode: 'dark' }));
            enable();
            await FirebaseAuthEngine._syncIceProfile(firestore.module, 'u1');
            const keys = Object.keys(firestore.docs.get(PATH));
            expect(keys.sort()).toEqual([...Object.keys(clampProfile({})), 'updatedAt', 'consentAt'].sort());
        });
    });

    describe('synchro complète', () => {
        it('une erreur de la fiche (règles pas encore publiées) ne fait pas échouer le reste de la synchro', async () => {
            enable();
            const spy = vi
                .spyOn(FirebaseAuthEngine, '_syncIceProfile')
                .mockRejectedValue(new Error('permission-denied'));
            vi.spyOn(FirebaseAuthEngine, 'syncEquipmentData').mockResolvedValue({ success: false });
            vi.spyOn(FirebaseAuthEngine, 'syncLogbookData').mockResolvedValue({ success: false });
            vi.spyOn(FirebaseAuthEngine, 'updateModalUI').mockImplementation(() => {});
            vi.spyOn(console, 'warn').mockImplementation(() => {});
            const result = await FirebaseAuthEngine.syncDataWithCloud(true);
            expect(spy).toHaveBeenCalled();
            expect(result.success).not.toBe(false);
        });

        it('les préférences envoyées au cloud ne contiennent jamais la fiche', () => {
            localStorage.setItem('parapente_user_prefs', JSON.stringify({ iceProfile: 'secret', themeMode: 'dark' }));
            expect(FirebaseAuthEngine.getLocalPreferences().iceProfile).toBeUndefined();
        });
    });

    describe('envoi, lecture et suppression', () => {
        it('envoie la fiche à users/{uid}/ice/profile, relit et supprime cette fiche', async () => {
            enable();
            expect(await FirebaseAuthEngine.saveIceToCloud()).toMatchObject({ success: true });
            expect([...firestore.docs.keys()]).toEqual([PATH]);
            expect(firestore.docs.get(PATH)).toMatchObject({ nom: 'Dupont', updatedAt: 100 });

            const fetched = await FirebaseAuthEngine.fetchIceFromCloud();
            expect(fetched).toMatchObject({ success: true });
            expect(fetched.data.prenom).toBe('Thomas');

            expect(await FirebaseAuthEngine.deleteIceFromCloud()).toMatchObject({ success: true });
            expect(firestore.docs.has(PATH)).toBe(false);
            expect((await FirebaseAuthEngine.fetchIceFromCloud()).data).toBeNull();
        });

        it('une erreur Firestore est rapportée sans lever', async () => {
            enable();
            vi.spyOn(console, 'error').mockImplementation(() => {});
            vi.spyOn(FirebaseAuthEngine, 'markUnsyncedChange').mockImplementation(() => {});
            firestore.module.setDoc.mockRejectedValueOnce(new Error('permission-denied'));
            expect(await FirebaseAuthEngine.saveIceToCloud()).toMatchObject({
                success: false,
                error: 'permission-denied',
            });
            firestore.module.deleteDoc.mockRejectedValueOnce(new Error('permission-denied'));
            expect((await FirebaseAuthEngine.deleteIceFromCloud()).success).toBe(false);
        });

        it('refuse d’envoyer sans la demande du pilote', async () => {
            IceService.saveProfile(profile);
            const result = await FirebaseAuthEngine.saveIceToCloud();
            expect(result).toMatchObject({ success: false, error: 'ice-cloud-disabled' });
        });

        it('refuse d’envoyer sans compte connecté ni synchronisation', async () => {
            enable();
            FirebaseAuthEngine.currentUser = null;
            expect((await FirebaseAuthEngine.saveIceToCloud()).success).toBe(false);
            FirebaseAuthEngine.currentUser = { uid: 'u1' };
            FirebaseAuthEngine.enabled = false;
            expect((await FirebaseAuthEngine.saveIceToCloud()).success).toBe(false);
            expect((await FirebaseAuthEngine.fetchIceFromCloud()).success).toBe(false);
            expect((await FirebaseAuthEngine.deleteIceFromCloud()).success).toBe(false);
        });

        it('hors ligne : rien n’est envoyé, la synchro de rattrapage s’en chargera', async () => {
            enable();
            Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
            const mark = vi.spyOn(FirebaseAuthEngine, 'markUnsyncedChange').mockImplementation(() => {});
            const result = await FirebaseAuthEngine.saveIceToCloud();
            expect(result.error).toBe('Offline');
            expect(mark).toHaveBeenCalled();
            expect((await FirebaseAuthEngine.deleteIceFromCloud()).error).toBe('Offline');
        });
    });
});

describe('carte « Sauvegarde en ligne » et boutons', () => {
    let engine;

    beforeEach(() => {
        localStorage.clear();
        document.body.innerHTML = '<div id="safety-panel-ice"></div>';
        engine = {
            enabled: true,
            currentUser: { uid: 'u1' },
            fetchIceFromCloud: vi.fn(async () => ({ success: true, data: null, error: null })),
            saveIceToCloud: vi.fn(async () => ({ success: true, data: null, error: null })),
            deleteIceFromCloud: vi.fn(async () => ({ success: true, data: null, error: null })),
        };
        window.FirebaseAuthEngine = engine;
        vi.stubGlobal('alert', vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        delete window.FirebaseAuthEngine;
    });

    it('explique que la fiche reste sur l’appareil quand la synchro est désactivée, sans bouton', () => {
        engine.enabled = false;
        const html = renderIceCloudCard();
        expect(html).toContain('uniquement sur cet appareil');
        expect(html).not.toContain('SafetyenableIceCloud');
        expect(html).not.toContain('SafetydisableIceCloud');
    });

    it('invite à se connecter sans compte', () => {
        engine.currentUser = null;
        const html = renderIceCloudCard();
        expect(html).toContain('Connectez-vous');
        expect(html).not.toContain('SafetyenableIceCloud');
    });

    it('propose le bouton d’activation, puis celui de suppression une fois activée', () => {
        expect(renderIceCloudCard()).toContain('data-action="SafetyenableIceCloud"');
        setIceCloudState({ enabled: true, consentAt: 'x', lastSyncedAt: new Date(2026, 10, 9, 21, 5).getTime() });
        const html = renderIceCloudCard();
        expect(html).toContain('data-action="SafetydisableIceCloud"');
        expect(html).toContain('09/11/2026 21:05');
        expect(html).not.toContain('SafetyenableIceCloud');
        expect(renderIceTabHtml()).toContain('id="ice-cloud-card"');
    });

    it('sans accord exprès, rien n’est activé ni envoyé', async () => {
        vi.stubGlobal(
            'confirm',
            vi.fn(() => false),
        );
        await enableIceCloud();
        expect(getIceCloudState().enabled).toBe(false);
        expect(engine.fetchIceFromCloud).not.toHaveBeenCalled();
        expect(engine.saveIceToCloud).not.toHaveBeenCalled();
    });

    it('l’accord est demandé avec la mention des données de santé, puis daté', async () => {
        const confirmSpy = vi.fn(() => true);
        vi.stubGlobal('confirm', confirmSpy);
        IceService.saveProfile(profile);
        await enableIceCloud();
        expect(confirmSpy.mock.calls[0][0]).toContain('données de santé');
        expect(confirmSpy.mock.calls[0][0]).toContain('accord exprès');
        // Transparence : l'éditeur a techniquement accès à la base, on ne promet pas « lisible par vous seul ».
        expect(confirmSpy.mock.calls[0][0]).toContain('l’éditeur de l’application');
        expect(confirmSpy.mock.calls[0][0]).not.toContain('lisible uniquement par vous');
        const state = getIceCloudState();
        expect(state.enabled).toBe(true);
        expect(Date.parse(state.consentAt)).not.toBeNaN();
        expect(engine.saveIceToCloud).toHaveBeenCalledTimes(1);
    });

    it('sans compte, ne propose même pas l’accord', async () => {
        engine.currentUser = null;
        const confirmSpy = vi.fn(() => true);
        vi.stubGlobal('confirm', confirmSpy);
        await enableIceCloud();
        expect(confirmSpy).not.toHaveBeenCalled();
        expect(getIceCloudState().enabled).toBe(false);
    });

    it('reprend la fiche du profil en ligne quand cet appareil n’en a pas', async () => {
        vi.stubGlobal(
            'confirm',
            vi.fn(() => true),
        );
        engine.fetchIceFromCloud.mockResolvedValue({
            success: true,
            data: { ...profile, nom: 'EnLigne', updatedAt: 777, consentAt: 'x' },
            error: null,
        });
        await enableIceCloud();
        expect(IceService.getProfile().nom).toBe('EnLigne');
        expect(getIceCloudState()).toMatchObject({ enabled: true, updatedAt: 777 });
        expect(engine.saveIceToCloud).not.toHaveBeenCalled();
    });

    it('fiche locale ET fiche en ligne : le pilote choisit laquelle garder', async () => {
        IceService.saveProfile({ ...profile, nom: 'Locale' }, { updatedAt: 10 });
        engine.fetchIceFromCloud.mockResolvedValue({
            success: true,
            data: { ...profile, nom: 'EnLigne', updatedAt: 777, consentAt: 'x' },
            error: null,
        });
        // 1er confirm : l'accord ; 2e confirm : « OK » = garder la fiche de cet appareil.
        vi.stubGlobal('confirm', vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(true));
        await enableIceCloud();
        expect(IceService.getProfile().nom).toBe('Locale');
        expect(engine.saveIceToCloud).toHaveBeenCalledTimes(1);

        // « Annuler » au 2e confirm = reprendre la fiche en ligne.
        setIceCloudState({ enabled: false, consentAt: '' });
        engine.saveIceToCloud.mockClear();
        vi.stubGlobal('confirm', vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false));
        await enableIceCloud();
        expect(IceService.getProfile().nom).toBe('EnLigne');
        expect(engine.saveIceToCloud).not.toHaveBeenCalled();
    });

    it('si l’envoi échoue, la demande est annulée et le pilote prévenu', async () => {
        vi.stubGlobal(
            'confirm',
            vi.fn(() => true),
        );
        IceService.saveProfile(profile);
        engine.saveIceToCloud.mockResolvedValue({ success: false, data: null, error: 'permission-denied' });
        await enableIceCloud();
        expect(getIceCloudState().enabled).toBe(false);
        expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('a échoué'));
    });

    it('si le profil en ligne est injoignable, rien n’est activé', async () => {
        vi.stubGlobal(
            'confirm',
            vi.fn(() => true),
        );
        engine.fetchIceFromCloud.mockResolvedValue({ success: false, data: null, error: 'Offline' });
        await enableIceCloud();
        expect(getIceCloudState().enabled).toBe(false);
        expect(engine.saveIceToCloud).not.toHaveBeenCalled();
    });

    it('supprimer la fiche en ligne : la copie du cloud est effacée, celle de l’appareil reste', async () => {
        IceService.saveProfile(profile);
        setIceCloudState({ enabled: true, consentAt: 'x', lastSyncedAt: 5 });
        vi.stubGlobal(
            'confirm',
            vi.fn(() => true),
        );
        await disableIceCloudView();
        expect(engine.deleteIceFromCloud).toHaveBeenCalledTimes(1);
        expect(getIceCloudState().enabled).toBe(false);
        expect(IceService.getProfile().nom).toBe('Dupont');
    });

    it('si la suppression en ligne échoue (hors ligne), la sauvegarde reste active', async () => {
        setIceCloudState({ enabled: true, consentAt: 'x', lastSyncedAt: 5 });
        vi.stubGlobal(
            'confirm',
            vi.fn(() => true),
        );
        engine.deleteIceFromCloud.mockResolvedValue({ success: false, data: null, error: 'Offline' });
        await disableIceCloudView();
        expect(getIceCloudState().enabled).toBe(true);
        expect(window.alert).toHaveBeenCalled();
    });

    it('réinitialiser la fiche supprime aussi sa copie en ligne, et prévient', async () => {
        IceService.saveProfile(profile);
        setIceCloudState({ enabled: true, consentAt: 'x', lastSyncedAt: 5 });
        const confirmSpy = vi.fn(() => true);
        vi.stubGlobal('confirm', confirmSpy);
        await clearIceProfile();
        expect(confirmSpy.mock.calls[0][0]).toContain('profil en ligne sera aussi supprimée');
        expect(engine.deleteIceFromCloud).toHaveBeenCalled();
        expect(IceService.getProfile().nom).toBe('');
        expect(getIceCloudState().enabled).toBe(false);
    });

    it('réinitialiser la fiche garde la fiche locale si la copie en ligne n’a pas pu être supprimée', async () => {
        IceService.saveProfile(profile);
        setIceCloudState({ enabled: true, consentAt: 'x', lastSyncedAt: 5 });
        vi.stubGlobal(
            'confirm',
            vi.fn(() => true),
        );
        engine.deleteIceFromCloud.mockResolvedValue({ success: false, data: null, error: 'Offline' });
        await clearIceProfile();
        expect(IceService.getProfile().nom).toBe('Dupont');
        expect(getIceCloudState().enabled).toBe(true);
    });

    it('enregistrer la fiche l’envoie en ligne seulement si la sauvegarde est active', () => {
        document.body.innerHTML += '<input id="ice-prenom" value="Thomas" /><input id="ice-nom" value="Dupont" />';
        saveIceProfile();
        expect(engine.saveIceToCloud).not.toHaveBeenCalled();
        setIceCloudState({ enabled: true, consentAt: 'x' });
        saveIceProfile();
        expect(engine.saveIceToCloud).toHaveBeenCalledTimes(1);
    });
});
