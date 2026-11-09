import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import IceService, {
    ICE_LIMITS,
    ICE_QR_MAX_BYTES,
    ICE_STORAGE_KEY,
    buildIceVCard,
    clampProfile,
    encodeLocalIce,
    toInternationalPhone,
    normalizeBirthDate,
    formatBirthDate,
    ageOf,
    licenceLine,
    ICE_FEDERATIONS,
    flagEmoji,
    countryName,
    normalizeCountry,
    ICE_COUNTRIES,
} from '../../js/services/ice_service.js';
import { generateQrMatrix } from '../../js/utils/qrcode.js';
import StorageService from '../../js/services/storage.js';
import { FirebaseAuthEngine } from '../../js/services/firebase_service.js';
import GdprEngine from '../../js/gdpr_engine.js';
import { isIceLocation } from '../../js/core/start_mode.js';
import {
    printIceSticker,
    renderIceSticker,
    renderIceStickerCompact,
    renderIceTabHtml,
} from '../../js/views/safety_ice.js';
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

    it("le QR est une fiche contact (vCard) : nom, contacts étiquetés aux numéros nets, notes médicales d'abord", () => {
        const vcard = buildIceVCard(typical);
        const lines = vcard.split('\n');
        expect(lines[0]).toBe('BEGIN:VCARD');
        expect(lines.at(-1)).toBe('END:VCARD');
        expect(vcard).toContain('VERSION:3.0');
        expect(vcard).toContain('N:Dupont;Thomas;;;');
        expect(vcard).toContain('FN:Thomas Dupont');
        expect(vcard).toContain('ORG:URGENCE ICE PARAPENTE');
        expect(vcard).toContain('item1.TEL:+33612345678');
        expect(vcard).toContain('item1.X-ABLabel:Sophie (Conjointe)');
        expect(vcard).toContain('item2.TEL:+33698765432');
        expect(vcard).toContain('item2.X-ABLabel:Pierre (Frère)');
        // Notes : une seule ligne vCard, les retours à la ligne sont écrits « \\n », le sang en premier.
        const note = lines.find((l) => l.startsWith('NOTE:'));
        expect(note.startsWith('NOTE:SANG O+\\n')).toBe(true);
        expect(note).toContain('ALLERGIES: Pénicilline');
        expect(note).toContain('Né 1988');
        expect(note).toContain('ASSURANCE MAIF 123456');
    });

    it('échappe les caractères spéciaux de la vCard (virgule, point-virgule, antislash, retour à la ligne)', () => {
        const vcard = buildIceVCard({ ...typical, nom: 'Du;pont', remarques: 'a,b;c\\d\ne' });
        expect(vcard).toContain('N:Du\\;pont;Thomas;;;');
        expect(vcard).toContain('SANTÉ: a\\,b\\;c\\\\d\\ne');
        // Aucun retour à la ligne parasite dans une valeur : chaque ligne reste une propriété.
        for (const line of vcard.split('\n')) expect(line).toMatch(/^(BEGIN|VERSION|N|FN|ORG|item\d\.|NOTE|END)/);
    });

    it('sans contact, propose le 112 pour garder un bouton d’appel', () => {
        const vcard = buildIceVCard({ prenom: 'Thomas', nom: 'Dupont' });
        expect(vcard).toContain('item1.TEL:112');
        expect(vcard).toContain('item1.X-ABLabel:Secours');
        expect(vcard).not.toContain('NOTE:');
    });

    it('un contact sans nom reçoit une étiquette par défaut', () => {
        const vcard = buildIceVCard({ contact1Phone: '0612345678' });
        expect(vcard).toContain('item1.X-ABLabel:Contact 1');
        expect(vcard).toContain('FN:Pilote');
    });

    it("une fiche usuelle donne un QR d'au plus 73 modules (version 14), lisible sur un casque", () => {
        const svg = IceService.generateQrSvg(typical);
        expect(svg).toContain('<svg');
        expect(
            generateQrMatrix(buildIceVCard({ ...typical, anticoag: '1', tetanos: '2022' })).length,
        ).toBeLessThanOrEqual(73);
    });

    it('la fiche la plus longue permise ne fait jamais échouer le générateur', () => {
        const longest = Object.fromEntries(
            Object.entries(typical).map(([key, value]) => [key, value.padEnd(500, 'é')]),
        );
        const profile = clampProfile(longest);
        expect(() => generateQrMatrix(buildIceVCard(profile))).not.toThrow();
    });

    it('refuse proprement une fiche trop longue pour un QR lisible (mesurée en octets, accents compris)', () => {
        const huge = {
            ...typical,
            allergies: 'a'.repeat(ICE_LIMITS.allergies),
            remarques: 'r'.repeat(ICE_LIMITS.remarques),
        };
        expect(new TextEncoder().encode(buildIceVCard(huge)).length).toBeGreaterThan(ICE_QR_MAX_BYTES);
        expect(IceService.qrFits(huge)).toBe(false);
        expect(() => IceService.generateQrSvg(huge)).toThrow('ice-qr-too-long');

        // Les accents pèsent 2 octets : 120 « é » (+100 pour les allergies) dépassent la limite alors que 80 « e » la respectent.
        expect(IceService.qrFits({ ...typical, remarques: 'e'.repeat(80) })).toBe(true);
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

    it('écrit le sang, les allergies et le contact principal, sans emoji, avec la date de mise à jour', () => {
        const html = renderIceSticker(typical);
        const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
        expect(text).toContain('Thomas Dupont');
        expect(text).toContain('SANG O+');
        expect(text).toContain('ALLERGIES : Pénicilline');
        expect(text).toContain('Sophie : +33 6 12 34 56 78');
        // Contact principal seulement sur l'étiquette : le second est dans le QR.
        expect(text).not.toContain('Pierre');
        expect(text).not.toContain('+33 6 98 76 54 32');
        expect(text).toMatch(/Mis à jour \d{2}\/\d{4}/);
        // La date de naissance complète est écrite sur l'étiquette complète ; plus de texte « SCANNER » en pied.
        expect(text).toContain('Né en 1988');
        expect(text).not.toContain('SCANNER');
        expect(
            renderIceSticker({ ...typical, birthYear: '', birthDate: '1988-03-12' }).replace(/<[^>]+>/g, ' '),
        ).toContain('Né le 12/03/1988');
        expect(html).not.toMatch(/[\u{1F300}-\u{1FAFF}\u2795]/u);
        expect(html).toContain('<svg');
        // En-tête : le numéro d'urgence que compose un témoin, pas une fréquence radio de pilote.
        expect(text).toContain('SOS 112');
        expect(html).not.toContain('143.9875');
    });

    it("sans premier contact, l'étiquette écrit le second ; le QR garde toujours les deux", () => {
        const onlySecond = { ...typical, contact1Phone: '', contact1Name: '' };
        const text = renderIceSticker(onlySecond)
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ');
        expect(text).toContain('Pierre : +33 6 98 76 54 32');
        expect(text).not.toContain('Sophie');
        expect(buildIceVCard(typical)).toContain('Sophie (Conjointe)');
        expect(buildIceVCard(typical)).toContain('Pierre (Frère)');
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

    it("imprime une étiquette complète et deux compactes, puis retire la copie après l'impression", () => {
        document.body.innerHTML = '<div id="ice-sticker-wrapper"></div>';
        IceService.saveProfile(typical);
        document.getElementById('ice-sticker-wrapper').innerHTML =
            renderIceSticker(typical) + renderIceStickerCompact(typical);
        const printSpy = vi.fn(() => {
            expect(document.getElementById('ice-helmet-sticker-compact-copy')).not.toBeNull();
        });
        vi.stubGlobal('print', printSpy);
        window.print = printSpy;
        printIceSticker();
        expect(printSpy).toHaveBeenCalledTimes(1);
        window.dispatchEvent(new Event('afterprint'));
        expect(document.getElementById('ice-helmet-sticker-compact-copy')).toBeNull();
        expect(document.getElementById('ice-helmet-sticker')).not.toBeNull();
        expect(document.getElementById('ice-helmet-sticker-compact')).not.toBeNull();
    });
});

describe("étiquette compacte : URGENCE, le QR et l'identité", () => {
    const text = (html) =>
        html
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

    it('porte URGENCE, le QR, puis le drapeau, le nom et la date de naissance, et rien d’autre', () => {
        const html = renderIceStickerCompact({ ...typical, pays: 'FR', birthYear: '', birthDate: '1988-03-12' });
        expect(text(html)).toBe('URGENCE 🇫🇷 Thomas Dupont Né le 12/03/1988');
        expect(html).toContain('<svg');
        expect(html).toContain('aria-label="France"');
        // Aucune information médicale ni aucun numéro de téléphone en clair : tout cela est dans le QR.
        for (const secret of ['O+', 'Pénicilline', 'Sophie', '+33', 'MAIF', 'ANTICOAGULANT']) {
            expect(html, secret).not.toContain(secret);
        }
    });

    it("sans drapeau ni date : seulement le nom ; ancienne fiche : l'année seule", () => {
        expect(text(renderIceStickerCompact({ prenom: 'Thomas', nom: 'Dupont' }))).toBe('URGENCE Thomas Dupont');
        expect(text(renderIceStickerCompact({ ...typical, birthYear: '1988', birthDate: '' }))).toBe(
            'URGENCE Thomas Dupont Né en 1988',
        );
    });

    it('échappe le nom', () => {
        const html = renderIceStickerCompact({ prenom: '<img src=x onerror=alert(1)>', nom: 'D' });
        expect(html).not.toContain('<img src=x');
        expect(html).toContain('&lt;img');
    });

    it("affiche un message plutôt qu'un QR illisible quand la fiche est trop longue", () => {
        StorageService.set(ICE_STORAGE_KEY, encodeLocalIce({ ...typical, remarques: 'x'.repeat(5000) }));
        expect(() => renderIceStickerCompact(IceService.getProfile())).not.toThrow();
    });

    it("l'aperçu de l'onglet montre les deux formats", () => {
        const html = renderIceTabHtml();
        expect(html).toContain('id="ice-helmet-sticker"');
        expect(html).toContain('id="ice-helmet-sticker-compact"');
    });
});

describe('numéros au format international', () => {
    it('convertit les numéros nationaux français et garde les autres', () => {
        expect(toInternationalPhone('06 12 34 56 78')).toBe('+33612345678');
        expect(toInternationalPhone('06.12.34.56.78')).toBe('+33612345678');
        expect(toInternationalPhone('+33 6 12 34 56 78')).toBe('+33612345678');
        expect(toInternationalPhone('0033 6 12 34 56 78')).toBe('+33612345678');
        expect(toInternationalPhone('+41 79 123 45 67')).toBe('+41791234567');
        expect(toInternationalPhone('112')).toBe('112');
        expect(toInternationalPhone('')).toBe('');
        expect(toInternationalPhone('abc')).toBe('');
        expect(toInternationalPhone('06 12', '33')).toBe('0612');
    });

    it('accepte un autre indicatif pays par défaut', () => {
        expect(toInternationalPhone('079 123 45 67', '41')).toBe('+41791234567');
        expect(toInternationalPhone('0791234567', '41')).toBe('+41791234567');
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

    it('est écrit dans les notes du QR', () => {
        const vcard = buildIceVCard(withMedical);
        expect(vcard).toContain('ANTICOAGULANTS');
        expect(vcard).toContain('TÉTANOS 2022');
        expect(buildIceVCard(typical)).not.toContain('ANTICOAGULANTS');
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

describe('drapeau de la nationalité', () => {
    const withCountry = { ...typical, pays: 'FR' };

    it('transforme un code pays en drapeau et en nom', () => {
        expect(flagEmoji('FR')).toBe('🇫🇷');
        expect(flagEmoji('ch')).toBe('🇨🇭');
        expect(flagEmoji('XYZ')).toBe('');
        expect(flagEmoji('1A')).toBe('');
        expect(flagEmoji('')).toBe('');
        expect(countryName('CH')).toBe('Suisse');
        expect(countryName('nz')).toBe('Nouvelle-Zélande');
        expect(countryName('ZZ')).toBe('ZZ');
        expect(countryName('???')).toBe('');
    });

    it('la liste est cohérente : codes valides, uniques, noms renseignés', () => {
        const codes = ICE_COUNTRIES.map(([code]) => code);
        expect(new Set(codes).size).toBe(codes.length);
        for (const [code, name] of ICE_COUNTRIES) {
            expect(normalizeCountry(code), code).toBe(code);
            expect(name.length, code).toBeGreaterThan(2);
            expect(flagEmoji(code), code).not.toBe('');
        }
        expect(codes[0]).toBe('FR');
    });

    it('ne garde que les codes valides', () => {
        expect(clampProfile({ pays: 'fr' }).pays).toBe('FR');
        expect(clampProfile({ pays: ' de ' }).pays).toBe('DE');
        expect(clampProfile({ pays: 'France' }).pays).toBe('');
        expect(clampProfile({ pays: '<script>' }).pays).toBe('');
        expect(clampProfile({}).pays).toBe('');
    });

    it('survit au lien du lecteur web', () => {
        expect(IceService.decodePayload(IceService.encodePayload(withCountry)).pays).toBe('FR');
        expect(IceService.decodePayload('#v=1&n=Dupont&pa=zz').pays).toBe('ZZ');
        expect(IceService.decodePayload('#v=1&n=Dupont&pa=<img>').pays).toBe('');
        expect(IceService.decodePayload(IceService.encodePayload(typical)).pays).toBe('');
    });

    it('apparaît dans la fiche contact : le drapeau sous le nom (pas de ligne en plus, le QR est plein)', () => {
        const vcard = buildIceVCard({ ...withCountry, pays: 'CH' });
        expect(vcard).toContain('ORG:URGENCE ICE PARAPENTE 🇨🇭');
        expect(vcard).not.toContain('NATIONALITÉ');
        expect(buildIceVCard(typical)).toContain('ORG:URGENCE ICE PARAPENTE\n');
    });

    it('une fiche usuelle avec nationalité tient toujours dans un QR lisible', () => {
        const full = { ...withCountry, anticoag: '1', tetanos: '2022' };
        expect(IceService.qrFits(full)).toBe(true);
        expect(generateQrMatrix(buildIceVCard(full)).length).toBeLessThanOrEqual(81);
    });

    it("l'étiquette complète et l'étiquette compacte affichent le drapeau à côté du nom", () => {
        const html = renderIceSticker(withCountry);
        expect(html).toContain('<span class="ice-sticker-flag" role="img" aria-label="France">🇫🇷</span> Thomas Dupont');
        expect(renderIceSticker(typical)).not.toContain('ice-sticker-flag');
        expect(renderIceStickerCompact(withCountry)).toContain('🇫🇷');
    });

    it('la fiche de secours affiche le drapeau et la nationalité', async () => {
        document.body.innerHTML = '<div id="ice-root"></div>';
        window.history.replaceState({}, '', `/?mode=ICE#${IceService.encodePayload({ ...typical, pays: 'IT' })}`);
        await IceView.mount({});
        const root = document.getElementById('ice-root');
        expect(root.querySelector('.ice-flag').textContent).toBe('🇮🇹');
        expect(root.textContent).toContain('Nationalité : Italie');
        window.history.replaceState({}, '', '/');
    });

    it('le formulaire propose la liste, France par défaut pour une nouvelle fiche, le choix enregistré sinon', () => {
        expect(renderIceTabHtml()).toContain('<option value="FR" selected>🇫🇷 France</option>');
        IceService.saveProfile({ ...typical, pays: 'DE' });
        const html = renderIceTabHtml();
        expect(html).toContain('<option value="DE" selected>🇩🇪 Allemagne</option>');
        expect(html).not.toContain('<option value="FR" selected>');
        // Fiche déjà remplie sans nationalité : on ne devine pas.
        IceService.saveProfile(typical);
        expect(renderIceTabHtml()).toContain('<option value="" selected>Non précisée</option>');
        // Code valide hors liste : conservé.
        IceService.saveProfile({ ...typical, pays: 'ZZ' });
        expect(renderIceTabHtml()).toContain('<option value="ZZ" selected>');
    });
});

describe('date de naissance complète, numéro du pilote, langues', () => {
    const complete = {
        ...typical,
        pays: 'FR',
        birthYear: '',
        birthDate: '1988-03-12',
        tel: '06 00 11 22 33',
        langues: 'Français, Anglais',
        anticoag: '1',
        tetanos: '2022',
    };

    it('valide la date de naissance : jour réel, entre 1900 et aujourd’hui', () => {
        const now = new Date(2026, 10, 9);
        expect(normalizeBirthDate('1988-03-12', now)).toBe('1988-03-12');
        expect(normalizeBirthDate('1988-02-30', now)).toBe('');
        expect(normalizeBirthDate('1988-13-01', now)).toBe('');
        expect(normalizeBirthDate('1899-12-31', now)).toBe('');
        expect(normalizeBirthDate('2027-01-01', now)).toBe('');
        expect(normalizeBirthDate('12/03/1988', now)).toBe('');
        expect(normalizeBirthDate('<script>', now)).toBe('');
        expect(normalizeBirthDate('2000-02-29', now)).toBe('2000-02-29');
        expect(normalizeBirthDate('1900-02-29', now)).toBe('');
        expect(formatBirthDate('1988-03-12')).toBe('12/03/1988');
        expect(formatBirthDate('n’importe quoi')).toBe('');
    });

    it("calcule l'âge en années révolues (anniversaire pas encore passé inclus)", () => {
        expect(ageOf({ birthDate: '1988-03-12' }, new Date(2026, 2, 11))).toBe(37);
        expect(ageOf({ birthDate: '1988-03-12' }, new Date(2026, 2, 12))).toBe(38);
        expect(ageOf({ birthDate: '1988-03-12' }, new Date(2026, 10, 9))).toBe(38);
        // Sans date complète : l'année seule (ancienne fiche).
        expect(ageOf({ birthYear: '1988' }, new Date(2026, 10, 9))).toBe(38);
        expect(ageOf({}, new Date(2026, 10, 9))).toBeNull();
        expect(ageOf({ birthYear: '1800' }, new Date(2026, 10, 9))).toBeNull();
    });

    it("déduit l'année de la date complète et garde l'année seule des anciennes fiches", () => {
        expect(clampProfile({ birthDate: '1988-03-12' }).birthYear).toBe('1988');
        expect(clampProfile({ birthYear: '1990' }).birthYear).toBe('1990');
        expect(clampProfile({ birthDate: 'faux', birthYear: '1990' }).birthDate).toBe('');
    });

    it('survit au lien du lecteur web', () => {
        const decoded = IceService.decodePayload(IceService.encodePayload(complete));
        expect(decoded.birthDate).toBe('1988-03-12');
        expect(decoded.tel).toBe('06 00 11 22 33');
        expect(decoded.langues).toBe('Français, Anglais');
        expect(IceService.decodePayload('#v=1&bd=pas-une-date').birthDate).toBe('');
    });

    it('est écrit dans la fiche contact : numéro du pilote en dernier, langues et date dans les notes', () => {
        const vcard = buildIceVCard(complete);
        expect(vcard).toContain('item3.TEL:+33600112233');
        expect(vcard).toContain('item3.X-ABLabel:Pilote');
        expect(vcard.indexOf('item1.TEL')).toBeLessThan(vcard.indexOf('item3.TEL'));
        expect(vcard).toContain('LANGUES: Français\\, Anglais');
        expect(vcard).toContain('Né 12/03/1988');
        // Ancienne fiche : l'année seule.
        expect(buildIceVCard({ ...typical, birthYear: '1988' })).toContain('Né 1988');
    });

    it('le numéro du pilote ne remplace pas le 112 quand il n’y a aucun contact', () => {
        const vcard = buildIceVCard({ prenom: 'Thomas', tel: '0600112233' });
        expect(vcard).toContain('item1.TEL:112');
        expect(vcard).toContain('item2.TEL:+33600112233');
    });

    it('une fiche avec TOUS les champs remplis tient dans le QR (81 modules au plus)', () => {
        expect(IceService.qrFits(complete)).toBe(true);
        expect(generateQrMatrix(buildIceVCard(complete)).length).toBeLessThanOrEqual(81);
    });

    it('la fiche de secours affiche l’âge exact, le numéro du pilote et les langues', async () => {
        document.body.innerHTML = '<div id="ice-root"></div>';
        window.history.replaceState({}, '', `/?mode=ICE#${IceService.encodePayload(complete)}`);
        await IceView.mount({});
        const root = document.getElementById('ice-root');
        expect(root.textContent).toMatch(/\d+ ans · né le 12\/03\/1988/);
        expect(root.textContent).toContain('Téléphone du pilote');
        expect(root.querySelector('a[href="tel:+33600112233"]')).not.toBeNull();
        expect(root.textContent).toContain('Langues : Français, Anglais');
        window.history.replaceState({}, '', '/');
    });

    it('le formulaire propose la date, le numéro et les langues, préremplis', () => {
        IceService.saveProfile(complete);
        const html = renderIceTabHtml();
        expect(html).toContain('id="ice-birthDate" value="1988-03-12"');
        expect(html).toContain('id="ice-tel"');
        expect(html).toContain('value="06 00 11 22 33"');
        expect(html).toContain('id="ice-langues"');
        expect(html).toContain('value="Français, Anglais"');
        expect(html).not.toContain('id="ice-birthYear"');
    });
});

describe('fédération et numéro de licence', () => {
    const licensed = { ...typical, ffvl: '1234567', federation: 'SHV' };

    it('écrit la licence sur une ligne : « fédération numéro »', () => {
        expect(licenceLine({ ffvl: '1234567', federation: 'FFVL' })).toBe('FFVL 1234567');
        expect(licenceLine({ ffvl: '1234567', federation: 'ÖAeC' })).toBe('ÖAeC 1234567');
        expect(licenceLine({ ffvl: '1234567' })).toBe('LICENCE 1234567');
        expect(licenceLine({ federation: 'FFVL' })).toBe('');
        expect(licenceLine({})).toBe('');
    });

    it('une licence enregistrée avant le champ fédération est une licence FFVL', () => {
        expect(clampProfile({ ffvl: '123456' }).federation).toBe('FFVL');
        expect(clampProfile({ ffvl: '123456', federation: 'DHV' }).federation).toBe('DHV');
        expect(clampProfile({ federation: 'DHV' }).federation).toBe('DHV');
        expect(clampProfile({}).federation).toBe('');
        expect(clampProfile({ federation: 'x'.repeat(50) }).federation).toHaveLength(12);
    });

    it('propose les principales fédérations, FFVL en tête', () => {
        expect(ICE_FEDERATIONS[0]).toBe('FFVL');
        expect(new Set(ICE_FEDERATIONS).size).toBe(ICE_FEDERATIONS.length);
    });

    it('survit au lien du lecteur web', () => {
        const decoded = IceService.decodePayload(IceService.encodePayload(licensed));
        expect(decoded.federation).toBe('SHV');
        expect(decoded.ffvl).toBe('1234567');
    });

    it('est écrit dans les notes du QR avec la fédération', () => {
        expect(buildIceVCard(licensed)).toContain('SHV 1234567');
        expect(buildIceVCard({ ...typical, ffvl: '1234567' })).toContain('FFVL 1234567');
        expect(buildIceVCard(typical)).not.toContain('LICENCE');
    });

    it("est écrit sur l'étiquette complète (pied, à gauche de la mise à jour), pas sur la compacte", () => {
        const text = renderIceSticker(licensed)
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ');
        expect(text).toContain('SHV 1234567');
        expect(text.indexOf('SHV 1234567')).toBeLessThan(text.indexOf('Mis à jour'));
        expect(renderIceStickerCompact(licensed)).not.toContain('SHV');
        // Sans numéro : rien d'écrit (pas de « LICENCE » orphelin).
        expect(renderIceSticker({ ...typical, ffvl: '' }).replace(/<[^>]+>/g, ' ')).not.toContain('LICENCE');
    });

    it('la fiche de secours nomme la fédération', async () => {
        document.body.innerHTML = '<div id="ice-root"></div>';
        window.history.replaceState({}, '', `/?mode=ICE#${IceService.encodePayload(licensed)}`);
        await IceView.mount({});
        const root = document.getElementById('ice-root');
        expect(root.textContent).toContain('Licence SHV');
        expect(root.textContent).toContain('1234567');
        window.history.replaceState({}, '', '/');
    });

    it('le formulaire propose la fédération (FFVL par défaut pour une nouvelle fiche) et le numéro', () => {
        expect(renderIceTabHtml()).toContain('id="ice-federation" list="ice-federations" maxlength="12" value="FFVL"');
        IceService.saveProfile(licensed);
        const html = renderIceTabHtml();
        expect(html).toContain('value="SHV"');
        expect(html).toContain('id="ice-ffvl"');
        expect(html).toContain('<datalist id="ice-federations">');
        // Fiche déjà remplie sans licence : on ne devine pas.
        IceService.saveProfile({ ...typical, ffvl: '', federation: '' });
        expect(renderIceTabHtml()).toContain('id="ice-federation" list="ice-federations" maxlength="12" value=""');
    });

    it('une fiche complète avec fédération tient toujours dans le QR', () => {
        const everything = {
            ...typical,
            pays: 'FR',
            birthYear: '',
            birthDate: '1988-03-12',
            tel: '06 00 11 22 33',
            langues: 'Français, Anglais',
            anticoag: '1',
            tetanos: '2022',
            ffvl: '1234567',
            federation: 'FFVL',
        };
        expect(IceService.qrFits(everything)).toBe(true);
        expect(generateQrMatrix(buildIceVCard(everything)).length).toBeLessThanOrEqual(81);
    });
});
