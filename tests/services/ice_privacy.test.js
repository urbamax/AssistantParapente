import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import IceService, {
    ICE_LIMITS,
    ICE_QR_MAX_BYTES,
    ICE_STORAGE_KEY,
    buildIceText,
    clampProfile,
    encodeLocalIce,
} from '../../js/services/ice_service.js';
import { generateQrMatrix } from '../../js/utils/qrcode.js';
import StorageService from '../../js/services/storage.js';
import { FirebaseAuthEngine } from '../../js/services/firebase_service.js';
import GdprEngine from '../../js/gdpr_engine.js';
import { isIceLocation } from '../../js/core/start_mode.js';
import { renderIceSticker, renderIceTabHtml } from '../../js/views/safety_ice.js';
import IceView from '../../js/views/ice_viewer.js';

const typical = {
    nom: 'Dupont',
    prenom: 'Thomas',
    birthYear: '1988',
    contact1Name: 'Sophie',
    contact1Phone: '06 12 34 56 78',
    contact1Rel: 'Conjointe',
    contact2Name: 'Pierre',
    contact2Phone: '06 98 76 54 32',
    contact2Rel: 'Frère',
    bloodGroup: 'O+',
    allergies: 'Pénicilline',
    remarques: 'Asthme, Ventoline',
    ffvl: '123456',
    insurance: 'MAIF 123456',
};

beforeEach(() => {
    localStorage.clear();
});

describe('fiche ICE : longueurs et QR', () => {
    it('rogne chaque champ à sa longueur maximale', () => {
        const clean = clampProfile({ ...typical, remarques: 'x'.repeat(5000), nom: `  ${'n'.repeat(100)}  ` });
        expect(clean.remarques).toHaveLength(ICE_LIMITS.remarques);
        expect(clean.nom).toHaveLength(ICE_LIMITS.name);
        expect(clean.prenom).toBe('Thomas');
    });

    it('enregistre le profil rogné', () => {
        IceService.saveProfile({ ...typical, remarques: 'x'.repeat(5000) });
        expect(IceService.getProfile().remarques).toHaveLength(ICE_LIMITS.remarques);
    });

    it('le texte du QR contient les informations vitales et des numéros nets', () => {
        const text = buildIceText(typical);
        expect(text).toContain('Thomas Dupont 1988');
        expect(text).toContain('Sang O+');
        expect(text).toContain('Allergies: Pénicilline');
        expect(text).toContain('1: Sophie (Conjointe) 0612345678');
        expect(text).toContain('2: Pierre (Frère) 0698765432');
        expect(text).toContain('SOS 112');
    });

    it('une fiche typique donne un QR petit, donc lisible sur un casque', () => {
        const svg = IceService.generateQrSvg(typical);
        expect(svg).toContain('<svg');
        expect(generateQrMatrix(buildIceText(typical)).length).toBeLessThanOrEqual(57); // version 10 au plus
    });

    it('la fiche la plus longue permise ne fait jamais échouer le générateur', () => {
        const longest = Object.fromEntries(
            Object.entries(typical).map(([key, value]) => [key, value.padEnd(500, 'é')]),
        );
        const profile = clampProfile(longest);
        expect(() => generateQrMatrix(buildIceText(profile))).not.toThrow();
    });

    it('refuse proprement une fiche trop longue pour un QR lisible (mesurée en octets, accents compris)', () => {
        const huge = {
            ...typical,
            allergies: 'a'.repeat(ICE_LIMITS.allergies),
            remarques: 'r'.repeat(ICE_LIMITS.remarques),
        };
        expect(new TextEncoder().encode(buildIceText(huge)).length).toBeGreaterThan(ICE_QR_MAX_BYTES);
        expect(IceService.qrFits(huge)).toBe(false);
        expect(() => IceService.generateQrSvg(huge)).toThrow('ice-qr-too-long');

        // Les accents pèsent 2 octets : 200 « é » dépassent la limite alors que 200 « e » la respectent.
        expect(IceService.qrFits({ ...typical, remarques: 'e'.repeat(120) })).toBe(true);
        expect(IceService.qrFits({ ...typical, remarques: 'é'.repeat(120), allergies: 'é'.repeat(100) })).toBe(false);
        expect(IceService.qrFits(typical)).toBe(true);
    });

    it("l'onglet et l'étiquette ne plantent pas avec une fiche trop longue déjà enregistrée", () => {
        // Contourne les limites comme le ferait une fiche enregistrée par une ancienne version.
        StorageService.set(ICE_STORAGE_KEY, encodeLocalIce({ ...typical, remarques: 'x'.repeat(5000) }));
        expect(() => renderIceTabHtml()).not.toThrow();
        expect(() => renderIceSticker(IceService.getProfile())).not.toThrow();
    });

    it('le formulaire pose les longueurs maximales', () => {
        const html = renderIceTabHtml();
        expect(html).toContain(`id="ice-remarques" maxlength="${ICE_LIMITS.remarques}"`);
        expect(html).toContain(`id="ice-allergies" maxlength="${ICE_LIMITS.allergies}"`);
    });
});

describe('fiche ICE : données de santé, jamais dans les préférences synchronisées', () => {
    it("n'écrit pas la fiche dans les préférences", () => {
        IceService.saveProfile(typical);
        const prefs = StorageService.get(StorageService.KEYS.USER_PREFS, {}) || {};
        expect(prefs.iceProfile).toBeUndefined();
        expect(IceService.getProfile().nom).toBe('Dupont');
    });

    it('déplace une fiche rangée dans les préférences par la première version, puis la retire', () => {
        StorageService.set(StorageService.KEYS.USER_PREFS, {
            themeMode: 'dark',
            iceProfile: encodeLocalIce(typical),
        });
        expect(IceService.getProfile().prenom).toBe('Thomas');
        const prefs = StorageService.get(StorageService.KEYS.USER_PREFS);
        expect(prefs.iceProfile).toBeUndefined();
        expect(prefs.themeMode).toBe('dark');
        // Elle est maintenant à sa place.
        expect(StorageService.get(ICE_STORAGE_KEY)).toBeTruthy();
    });

    it('efface aussi la copie des préférences', () => {
        StorageService.set(StorageService.KEYS.USER_PREFS, { iceProfile: encodeLocalIce(typical) });
        IceService.clearProfile();
        expect(StorageService.get(StorageService.KEYS.USER_PREFS).iceProfile).toBeUndefined();
        expect(IceService.getProfile().nom).toBe('');
    });

    it("ne l'envoie jamais au cloud et ne la reprend jamais du cloud", () => {
        StorageService.set(StorageService.KEYS.USER_PREFS, { iceProfile: 'secret', themeMode: 'dark' });
        expect(FirebaseAuthEngine.getLocalPreferences().iceProfile).toBeUndefined();
        const merged = FirebaseAuthEngine.mergePreferences({ themeMode: 'dark' }, { iceProfile: 'depuis-le-cloud' });
        expect(merged.iceProfile).toBeUndefined();
    });
});

describe('page ICE : rien ne masque les informations vitales', () => {
    afterEach(() => {
        window.history.replaceState({}, '', '/');
        vi.unstubAllGlobals();
    });

    it("reconnaît l'adresse du lecteur d'urgence", () => {
        expect(isIceLocation('?mode=ICE', '')).toBe(true);
        expect(isIceLocation('', '#v=1&n=Dupont')).toBe(true);
        expect(isIceLocation('', '#ice?n=Dupont')).toBe(true);
        expect(isIceLocation('?mode=STATS', '')).toBe(false);
        expect(isIceLocation('', '')).toBe(false);
    });

    it("n'affiche pas le bandeau de confidentialité sur la fiche d'urgence", () => {
        document.body.innerHTML = '<div id="gdpr-banner"></div>';
        window.history.replaceState({}, '', '/?mode=ICE');
        GdprEngine.showBanner();
        expect(document.getElementById('gdpr-banner').classList.contains('active')).toBe(false);

        window.history.replaceState({}, '', '/?mode=STATS');
        GdprEngine.showBanner();
        expect(document.getElementById('gdpr-banner').classList.contains('active')).toBe(true);
    });

    it('demande avant de remplacer sa propre fiche par une fiche scannée', () => {
        IceService.saveProfile(typical);
        IceView.profile = { ...typical, nom: 'Autre', prenom: 'Personne' };
        const confirmSpy = vi.fn(() => false);
        vi.stubGlobal('confirm', confirmSpy);
        vi.stubGlobal('alert', vi.fn());

        IceView.importToProfile();
        expect(confirmSpy).toHaveBeenCalled();
        expect(IceService.getProfile().nom).toBe('Dupont');

        confirmSpy.mockReturnValue(true);
        IceView.importToProfile();
        expect(IceService.getProfile().nom).toBe('Autre');
    });

    it("n'a rien à confirmer quand on n'a pas encore de fiche", () => {
        IceView.profile = { ...typical };
        const confirmSpy = vi.fn(() => false);
        vi.stubGlobal('confirm', confirmSpy);
        vi.stubGlobal('alert', vi.fn());
        IceView.importToProfile();
        expect(confirmSpy).not.toHaveBeenCalled();
        expect(IceService.getProfile().nom).toBe('Dupont');
    });
});
