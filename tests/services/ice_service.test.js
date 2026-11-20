import { describe, it, expect, beforeEach } from 'vitest';
import IceService, {
    DEFAULT_ICE_PROFILE,
    encodePayload,
    decodePayload,
    buildIceUrl,
    sanitizePhone,
    formatPhoneDisplay,
} from '../../js/services/ice_service.js';
import StorageService from '../../js/services/storage.js';

describe('IceService (js/services/ice_service.js)', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    describe('Profile storage', () => {
        it('returns DEFAULT_ICE_PROFILE when nothing is stored', () => {
            const profile = IceService.getProfile();
            expect(profile).toEqual(DEFAULT_ICE_PROFILE);
        });

        it('saves and retrieves an ICE profile', () => {
            const testProfile = {
                nom: 'Urbaniak',
                prenom: 'Maxime',
                birthYear: '1990',
                contact1Name: 'Sophie',
                contact1Phone: '06 12 34 56 78',
                contact1Rel: 'Conjointe',
                bloodGroup: 'O+',
                allergies: 'Pénicilline',
                remarques: 'Asthme léger',
                ffvl: '1234567',
                insurance: 'Europ Assistance FFVL',
            };

            const ok = IceService.saveProfile(testProfile);
            expect(ok).toBe(true);

            const retrieved = IceService.getProfile();
            expect(retrieved.nom).toBe('Urbaniak');
            expect(retrieved.prenom).toBe('Maxime');
            expect(retrieved.bloodGroup).toBe('O+');
            expect(retrieved.contact1Name).toBe('Sophie');
            expect(retrieved.remarques).toBe('Asthme léger');

            // Vérifie que le stockage est obfusqué (non clair)
            const rawStored = StorageService.get(IceService.ICE_STORAGE_KEY || 'parapente_ice_profile');
            expect(typeof rawStored).toBe('string');
            expect(rawStored).not.toContain('Asthme léger');
        });

        it('clears the profile', () => {
            IceService.saveProfile({ nom: 'Test' });
            expect(IceService.getProfile().nom).toBe('Test');

            IceService.clearProfile();
            expect(IceService.getProfile().nom).toBe('');
        });
    });

    describe('Encoding and Decoding (Roundtrip)', () => {
        it('losslessly encodes and decodes full ICE profile', () => {
            const original = {
                nom: 'Dupont',
                prenom: 'Jean-Marc',
                birthYear: '1982',
                contact1Name: 'Claire Dupont',
                contact1Phone: '+33612345678',
                contact1Rel: 'Épouse',
                contact2Name: 'Pierre',
                contact2Phone: '0698765432',
                contact2Rel: 'Frère',
                bloodGroup: 'AB-',
                allergies: 'Arachides, Iode',
                remarques: 'Diabète type 1',
                ffvl: '9876543A',
                insurance: 'Rapatriement Mondial Assistance',
            };

            const encoded = encodePayload(original);
            expect(encoded).toContain('n=Dupont');
            expect(encoded).toContain('p=Jean-Marc');
            expect(encoded).toContain('bg=AB-');

            const decoded = decodePayload(encoded);
            expect(decoded.nom).toBe(original.nom);
            expect(decoded.prenom).toBe(original.prenom);
            expect(decoded.birthYear).toBe(original.birthYear);
            expect(decoded.contact1Name).toBe(original.contact1Name);
            expect(decoded.contact1Phone).toBe(original.contact1Phone);
            expect(decoded.contact1Rel).toBe(original.contact1Rel);
            expect(decoded.contact2Name).toBe(original.contact2Name);
            expect(decoded.contact2Phone).toBe(original.contact2Phone);
            expect(decoded.contact2Rel).toBe(original.contact2Rel);
            expect(decoded.bloodGroup).toBe(original.bloodGroup);
            expect(decoded.allergies).toBe(original.allergies);
            expect(decoded.remarques).toBe(original.remarques);
            expect(decoded.ffvl).toBe(original.ffvl);
            expect(decoded.insurance).toBe(original.insurance);
        });

        it('supports legacy med param for backwards compatibility', () => {
            const decoded = decodePayload('n=Test&med=Diabete');
            expect(decoded.remarques).toBe('Diabete');
        });

        it('handles hash prefix and URL formats cleanly', () => {
            const rawHash = '#v=1&n=Martin&p=Paul&bg=O%2B';
            const decoded = decodePayload(rawHash);
            expect(decoded.nom).toBe('Martin');
            expect(decoded.prenom).toBe('Paul');
            expect(decoded.bloodGroup).toBe('O+');
        });

        it('handles empty or malformed inputs without crashing', () => {
            expect(decodePayload('')).toEqual(DEFAULT_ICE_PROFILE);
            expect(decodePayload(null)).toEqual(DEFAULT_ICE_PROFILE);
            expect(decodePayload('gibberish_without_equal_sign')).toEqual(DEFAULT_ICE_PROFILE);
        });
    });

    describe('URL Building', () => {
        it('builds a mode=ICE URL with hash payload', () => {
            const profile = { nom: 'Lemoine', prenom: 'Lucas', bloodGroup: 'A+' };
            const url = buildIceUrl(profile, 'https://test.app/');
            expect(url.startsWith('https://test.app/?mode=ICE#')).toBe(true);
            expect(url).toContain('n=Lemoine');
            expect(url).toContain('p=Lucas');
            expect(url).toContain('bg=A%2B');
        });
    });

    describe('Phone formatting', () => {
        it('sanitizes phone numbers for tel: links', () => {
            expect(sanitizePhone('06 12 34 56 78')).toBe('0612345678');
            expect(sanitizePhone('+33 (0)6.12.34-56.78')).toBe('+330612345678');
            expect(sanitizePhone('')).toBe('');
        });

        it('formats 10-digit French phone numbers with spaces', () => {
            expect(formatPhoneDisplay('0612345678')).toBe('06 12 34 56 78');
            expect(formatPhoneDisplay('+33612345678')).toBe('+33 6 12 34 56 78');
            // Autre pays : laissé tel quel.
            expect(formatPhoneDisplay('+41791234567')).toBe('+41791234567');
        });
    });

    describe('QR Code Generation', () => {
        it('generates an SVG string for the profile', () => {
            const svg = IceService.generateQrSvg({ nom: 'Test', contact1Phone: '0600000000' });
            expect(svg).toContain('<svg');
            expect(svg).toContain('<path');
        });
    });

    describe('Robustness & edge cases (audit P2)', () => {
        it('removes localStorage key cleanly in clearProfile()', () => {
            IceService.saveProfile({ nom: 'Dupont', contact1Phone: '0601020304' });
            IceService.clearProfile();
            expect(localStorage.getItem('parapente_ice_profile')).toBeNull();
        });

        it('strips CR (\\r) characters when building vCard', () => {
            const vcard = IceService.buildIceVCard({ nom: 'Test', remarques: 'Ligne 1\r\nLigne 2' });
            expect(vcard).not.toContain('\r');
        });

        it('prevents pipe (|) in contact name from corrupting phone on encode/decode round-trip', () => {
            const encoded = IceService.encodePayload({
                contact1Name: 'Marie | Secours',
                contact1Phone: '0612345678',
                contact1Rel: 'Conjointe',
            });
            const decoded = IceService.decodePayload(encoded);
            expect(decoded.contact1Phone).toBe('0612345678');
            expect(decoded.contact1Rel).toBe('Conjointe');
        });

        it('uses profile.pays calling code in vCard instead of forcing +33 on Swiss/Belgian national numbers', () => {
            const chVcard = IceService.buildIceVCard({
                nom: 'Müller',
                pays: 'CH',
                contact1Phone: '079 123 45 67',
                tel: '078 987 65 43',
            });
            expect(chVcard).toContain('TEL:+41791234567');
            expect(chVcard).toContain('TEL:+41789876543');
            expect(chVcard).not.toContain('+33');

            const beVcard = IceService.buildIceVCard({
                nom: 'Peeters',
                pays: 'BE',
                contact1Phone: '0470 12 34 56',
            });
            expect(beVcard).toContain('TEL:+32470123456');
        });

        it('strips internal + signs in sanitizePhone while preserving a leading +', () => {
            expect(sanitizePhone('06+12+34')).toBe('061234');
            expect(sanitizePhone('+41 79+123')).toBe('+4179123');
        });

        it('handles trunk (0) in international format and preserves Italian landline leading 0', () => {
            expect(IceService.toInternationalPhone('+33 (0)6 12 34 56 78', '33')).toBe('+33612345678');
            expect(IceService.toInternationalPhone('02 1234 5678', '39')).toBe('+390212345678');
            expect(IceService.toInternationalPhone('0151 12345678', '49')).toBe('+4915112345678');
        });

        it('uses profile.pays calling code in IceViewer web page for Swiss/Belgian pilots', async () => {
            const { IceViewClass } = await import('../../js/views/ice_viewer.js');
            const view = new IceViewClass();
            view.profile = {
                nom: 'Müller',
                prenom: 'Hans',
                pays: 'CH',
                tel: '078 987 65 43',
                contact1Name: 'Heidi',
                contact1Phone: '079 123 45 67',
                contact2Name: 'Peter',
                contact2Phone: '076 111 22 33',
            };
            const html = view.renderPage();
            expect(html).toContain('href="tel:+41789876543"');
            expect(html).toContain('href="tel:+41791234567"');
            expect(html).toContain('href="tel:+41761112233"');
            expect(html).not.toContain('tel:+33');
        });
    });
});
