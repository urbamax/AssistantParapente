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
                medical: 'Asthme léger',
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

            // Vérifie la double persistance (ICE_STORAGE_KEY et USER_PREFS)
            const prefs = StorageService.get(StorageService.KEYS.USER_PREFS);
            expect(prefs?.iceProfile?.nom).toBe('Urbaniak');
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
                medical: 'Diabète type 1',
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
            expect(decoded.medical).toBe(original.medical);
            expect(decoded.ffvl).toBe(original.ffvl);
            expect(decoded.insurance).toBe(original.insurance);
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
            expect(formatPhoneDisplay('+33612345678')).toBe('+33612345678');
        });
    });

    describe('QR Code Generation', () => {
        it('generates an SVG string for the profile', () => {
            const svg = IceService.generateQrSvg({ nom: 'Test', contact1Phone: '0600000000' });
            expect(svg).toContain('<svg');
            expect(svg).toContain('<path');
        });
    });
});
