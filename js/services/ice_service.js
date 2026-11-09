/**
 * SERVICE - IceService (In Case of Emergency)
 * Gestion de la fiche d'urgence et du générateur d'étiquette pour casque/sellette.
 *
 * Confidentialité & Sécurité :
 * - Les données encodées dans le QR Code utilisent le fragment d'URL (#hash),
 *   qui n'est JAMAIS envoyé au serveur HTTP (spécification standard W3C).
 * - En mode lecture seule (secours), aucune donnée n'est envoyée ni modifiée sans action explicite.
 */

import StorageService from './storage.js';
import { generateQrSvg } from '../utils/qrcode.js';

export const ICE_STORAGE_KEY = 'parapente_ice_profile';

export const BLOOD_GROUPS = Object.freeze(['Inconnu', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']);

/**
 * @typedef {Object} IceProfile
 * @property {string} nom
 * @property {string} prenom
 * @property {string} birthYear
 * @property {string} contact1Name
 * @property {string} contact1Phone
 * @property {string} contact1Rel
 * @property {string} contact2Name
 * @property {string} contact2Phone
 * @property {string} contact2Rel
 * @property {string} bloodGroup
 * @property {string} allergies
 * @property {string} medical
 * @property {string} ffvl
 * @property {string} insurance
 */

/** @type {IceProfile} */
export const DEFAULT_ICE_PROFILE = Object.freeze({
    nom: '',
    prenom: '',
    birthYear: '',
    contact1Name: '',
    contact1Phone: '',
    contact1Rel: '',
    contact2Name: '',
    contact2Phone: '',
    contact2Rel: '',
    bloodGroup: '',
    allergies: '',
    medical: '',
    ffvl: '',
    insurance: '',
});

/**
 * Nettoie une chaîne de texte pour éviter les injections ou espaces superflus.
 * @param {*} val
 * @returns {string}
 */
const cleanStr = (val) => (typeof val === 'string' ? val.trim() : '');

/**
 * Nettoie un numéro de téléphone pour un lien tel:.
 * @param {string} phone
 * @returns {string}
 */
export function sanitizePhone(phone) {
    if (!phone || typeof phone !== 'string') return '';
    return phone.replace(/[^\d+]/g, '');
}

/**
 * Formate un numéro de téléphone pour un affichage plus lisible.
 * @param {string} phone
 * @returns {string}
 */
export function formatPhoneDisplay(phone) {
    if (!phone) return '';
    const clean = phone.trim();
    // Format français standard à 10 chiffres (06 12 34 56 78)
    if (/^0[1-9]\d{8}$/.test(clean.replace(/\s+/g, ''))) {
        const digits = clean.replace(/\s+/g, '');
        return digits.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
    }
    return clean;
}

/**
 * Encode un profil ICE en chaîne compacte pour URL.
 * Format URL-safe : utilise des abréviations pour minimiser la taille du QR code.
 * @param {Partial<IceProfile>} profile
 * @returns {string}
 */
export function encodePayload(profile = {}) {
    const params = new URLSearchParams();
    params.set('v', '1');

    if (profile.nom) params.set('n', profile.nom.trim());
    if (profile.prenom) params.set('p', profile.prenom.trim());
    if (profile.birthYear) params.set('y', String(profile.birthYear).trim());

    if (profile.contact1Phone) {
        const c1 = [
            cleanStr(profile.contact1Name),
            cleanStr(profile.contact1Phone),
            cleanStr(profile.contact1Rel),
        ].join('|');
        params.set('c1', c1);
    }

    if (profile.contact2Phone) {
        const c2 = [
            cleanStr(profile.contact2Name),
            cleanStr(profile.contact2Phone),
            cleanStr(profile.contact2Rel),
        ].join('|');
        params.set('c2', c2);
    }

    if (profile.bloodGroup && profile.bloodGroup !== 'Inconnu') {
        params.set('bg', profile.bloodGroup.trim());
    }

    if (profile.allergies) params.set('al', profile.allergies.trim());
    if (profile.medical) params.set('med', profile.medical.trim());
    if (profile.ffvl) params.set('ff', profile.ffvl.trim());
    if (profile.insurance) params.set('ins', profile.insurance.trim());

    return params.toString();
}

/**
 * Décode une chaîne compacte (hash ou query string) en profil ICE.
 * @param {string} rawString
 * @returns {IceProfile}
 */
export function decodePayload(rawString = '') {
    const result = { ...DEFAULT_ICE_PROFILE };
    if (!rawString || typeof rawString !== 'string') return result;

    let clean = rawString.trim();
    // Nettoie les éventuels préfixes #, ?, ou #ice?
    clean = clean.replace(/^[#?]+/, '');
    if (clean.startsWith('ice?')) clean = clean.substring(4);
    if (clean.startsWith('ice&')) clean = clean.substring(4);

    try {
        const params = new URLSearchParams(clean);

        if (params.has('n')) result.nom = params.get('n') || '';
        if (params.has('p')) result.prenom = params.get('p') || '';
        if (params.has('y')) result.birthYear = params.get('y') || '';

        if (params.has('c1')) {
            const [name, phone, rel] = (params.get('c1') || '').split('|');
            result.contact1Name = name || '';
            result.contact1Phone = phone || '';
            result.contact1Rel = rel || '';
        }

        if (params.has('c2')) {
            const [name, phone, rel] = (params.get('c2') || '').split('|');
            result.contact2Name = name || '';
            result.contact2Phone = phone || '';
            result.contact2Rel = rel || '';
        }

        if (params.has('bg')) result.bloodGroup = params.get('bg') || '';
        if (params.has('al')) result.allergies = params.get('al') || '';
        if (params.has('med')) result.medical = params.get('med') || '';
        if (params.has('ff')) result.ffvl = params.get('ff') || '';
        if (params.has('ins')) result.insurance = params.get('ins') || '';
    } catch (e) {
        console.warn('[IceService] Erreur lors du décodage du payload ICE:', e);
    }

    return result;
}

/**
 * Construit l'URL complète pour le QR Code.
 * Utilise le fragment (#) pour que les données médicales restent strictement côté client.
 * @param {Partial<IceProfile>} profile
 * @param {string} [baseUrl]
 * @returns {string}
 */
export function buildIceUrl(profile, baseUrl) {
    let base = baseUrl;
    if (!base) {
        if (typeof window !== 'undefined' && window.location && window.location.origin) {
            const pathname = window.location.pathname || '';
            base = `${window.location.origin}${pathname}`;
        } else {
            base = 'https://assistant-parapente.web.app/';
        }
    }

    // Assure que l'URL se termine bien sans slash redondant avant les params
    const payload = encodePayload(profile);
    const separator = base.includes('?') ? '&' : '?';
    return `${base}${separator}mode=ICE#${payload}`;
}

export const IceService = {
    /**
     * Récupère le profil ICE enregistré sur cet appareil.
     * @returns {IceProfile}
     */
    getProfile() {
        const direct = StorageService.get(ICE_STORAGE_KEY);
        if (direct && typeof direct === 'object') {
            return { ...DEFAULT_ICE_PROFILE, ...direct };
        }
        const prefs = StorageService.get(StorageService.KEYS.USER_PREFS, {});
        if (prefs?.iceProfile && typeof prefs.iceProfile === 'object') {
            return { ...DEFAULT_ICE_PROFILE, ...prefs.iceProfile };
        }
        return { ...DEFAULT_ICE_PROFILE };
    },

    /**
     * Sauvegarde le profil ICE sur cet appareil.
     * @param {Partial<IceProfile>} profile
     * @returns {boolean}
     */
    saveProfile(profile) {
        const clean = {
            nom: cleanStr(profile.nom),
            prenom: cleanStr(profile.prenom),
            birthYear: cleanStr(profile.birthYear),
            contact1Name: cleanStr(profile.contact1Name),
            contact1Phone: cleanStr(profile.contact1Phone),
            contact1Rel: cleanStr(profile.contact1Rel),
            contact2Name: cleanStr(profile.contact2Name),
            contact2Phone: cleanStr(profile.contact2Phone),
            contact2Rel: cleanStr(profile.contact2Rel),
            bloodGroup: cleanStr(profile.bloodGroup),
            allergies: cleanStr(profile.allergies),
            medical: cleanStr(profile.medical),
            ffvl: cleanStr(profile.ffvl),
            insurance: cleanStr(profile.insurance),
        };

        const ok1 = StorageService.set(ICE_STORAGE_KEY, clean);

        // Met également à jour USER_PREFS pour la compatibilité backup & sync
        try {
            const prefs = StorageService.get(StorageService.KEYS.USER_PREFS, {}) || {};
            prefs.iceProfile = clean;
            StorageService.set(StorageService.KEYS.USER_PREFS, prefs);
        } catch {
            // tolérance si USER_PREFS n'est pas modifiable
        }

        return ok1;
    },

    /**
     * Efface le profil ICE local.
     */
    clearProfile() {
        StorageService.set(ICE_STORAGE_KEY, null);
        try {
            const prefs = StorageService.get(StorageService.KEYS.USER_PREFS, {}) || {};
            delete prefs.iceProfile;
            StorageService.set(StorageService.KEYS.USER_PREFS, prefs);
        } catch {}
    },

    /**
     * Génère le QR Code SVG pour le casque.
     * @param {Partial<IceProfile>} profile
     * @param {object} [options]
     * @param {string} [options.baseUrl]
     * @param {number} [options.size]
     * @param {number} [options.border]
     * @param {"LOW"|"MEDIUM"|"QUARTILE"|"HIGH"} [options.ecc]
     * @returns {string} SVG string
     */
    generateQrSvg(profile, options = {}) {
        const url = buildIceUrl(profile, options.baseUrl);
        return generateQrSvg(url, {
            size: options.size || 220,
            border: options.border || 2,
            ecc: options.ecc || 'MEDIUM',
        });
    },

    encodePayload,
    decodePayload,
    buildIceUrl,
    sanitizePhone,
    formatPhoneDisplay,
};

export default IceService;
