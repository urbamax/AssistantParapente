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
import { printIceSticker, renderIceSticker, renderIceTabHtml } from '../../js/views/safety_ice.js';
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

describe('étiquette casque : informations vitales en toutes lettres', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('écrit le sang, les allergies et les deux contacts, sans emoji, avec la date de mise à jour', () => {
        const html = renderIceSticker(typical);
        const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
        expect(text).toContain('Thomas Dupont');
        expect(text).toContain('SANG O+');
        expect(text).toContain('ALLERGIES : Pénicilline');
        expect(text).toContain('Sophie : 06 12 34 56 78');
        expect(text).toContain('Pierre : 06 98 76 54 32');
        expect(text).toMatch(/Mis à jour \d{2}\/\d{4}/);
        expect(html).not.toMatch(/[\u{1F300}-\u{1FAFF}\u2795]/u);
        expect(html).toContain('<svg');
    });

    it('sans contact, renvoie vers le 112 plutôt que de laisser un vide', () => {
        const text = renderIceSticker({ prenom: 'Thomas', nom: 'Dupont' }).replace(/<[^>]+>/g, ' ');
        expect(text).toContain('112');
    });

    it('échappe les textes saisis', () => {
        const html = renderIceSticker({ ...typical, allergies: '<img src=x onerror=alert(1)>' });
        expect(html).not.toContain('<img src=x');
        expect(html).toContain('&lt;img');
    });

    it("imprime deux étiquettes (casque et sellette), puis retire la copie après l'impression", () => {
        document.body.innerHTML = '<div id="ice-sticker-wrapper"></div>';
        IceService.saveProfile(typical);
        document.getElementById('ice-sticker-wrapper').innerHTML = renderIceSticker(typical);
        const printSpy = vi.fn(() => {
            expect(document.getElementById('ice-helmet-sticker-copy')).not.toBeNull();
        });
        vi.stubGlobal('print', printSpy);
        window.print = printSpy;
        printIceSticker();
        expect(printSpy).toHaveBeenCalledTimes(1);
        window.dispatchEvent(new Event('afterprint'));
        expect(document.getElementById('ice-helmet-sticker-copy')).toBeNull();
        expect(document.getElementById('ice-helmet-sticker')).not.toBeNull();
    });
});

describe('anticoagulants et rappel antitétanique', () => {
    const withMedical = { ...typical, anticoag: '1', tetanos: '2022' };

    it('normalise la case à cocher', () => {
        expect(clampProfile({ anticoag: true }).anticoag).toBe('1');
        expect(clampProfile({ anticoag: 'on' }).anticoag).toBe('1');
        expect(clampProfile({ anticoag: '1' }).anticoag).toBe('1');
        expect(clampProfile({ anticoag: '' }).anticoag).toBe('');
        expect(clampProfile({ anticoag: false }).anticoag).toBe('');
        expect(clampProfile({ tetanos: '202222222' }).tetanos).toBe('2022');
    });

    it('survit au lien du lecteur web (encodage puis décodage)', () => {
        const decoded = IceService.decodePayload(IceService.encodePayload(withMedical));
        expect(decoded.anticoag).toBe('1');
        expect(decoded.tetanos).toBe('2022');
        expect(IceService.decodePayload(IceService.encodePayload(typical)).anticoag).toBe('');
    });

    it('est écrit dans le texte du QR', () => {
        const text = buildIceText(withMedical);
        expect(text).toContain('ANTICOAGULANTS');
        expect(text).toContain('Tétanos 2022');
        expect(buildIceText(typical)).not.toContain('ANTICOAGULANTS');
    });

    it("l'étiquette affiche une pastille ANTICOAGULANT à côté du groupe sanguin", () => {
        const html = renderIceSticker(withMedical);
        expect(html).toContain('ANTICOAGULANT');
        expect(html).toContain('SANG O+');
        expect(renderIceSticker(typical)).not.toContain('ANTICOAGULANT');
    });

    it('la fiche de secours affiche une alerte anticoagulants et le rappel antitétanique', async () => {
        document.body.innerHTML = '<div id="ice-root"></div>';
        window.history.replaceState({}, '', `/?mode=ICE#${IceService.encodePayload(withMedical)}`);
        await IceView.mount({});
        const text = document.getElementById('ice-root').textContent;
        expect(text).toContain('anticoagulant');
        expect(text).toContain('Dernier rappel antitétanique');
        expect(text).toContain('2022');
        window.history.replaceState({}, '', '/');
    });

    it('le formulaire propose la case et le champ, préremplis', () => {
        IceService.saveProfile(withMedical);
        const html = renderIceTabHtml();
        expect(html).toContain('id="ice-anticoag" checked');
        expect(html).toContain('id="ice-tetanos"');
        expect(html).toContain('value="2022"');
    });
});
