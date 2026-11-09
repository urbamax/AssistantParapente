/**
 * SERVICE - IceService (In Case of Emergency)
 * Gestion de la fiche d'urgence et du générateur d'étiquette pour casque/sellette.
 *
 * Confidentialité :
 * - La fiche reste sur cet appareil (clé `parapente_ice_profile`). Elle n'est JAMAIS copiée dans les
 *   préférences utilisateur : celles-ci sont synchronisées avec le cloud et exportées dans la sauvegarde,
 *   et il s'agit de données de santé (RGPD, catégorie particulière).
 * - Le stockage local est seulement masqué (XOR + base64) pour ne pas l'afficher en clair dans l'inspecteur
 *   du navigateur : ce n'est PAS du chiffrement et il ne protège pas contre un script de la page ou contre
 *   quelqu'un qui a l'appareil en main.
 * - Le QR code du casque contient une fiche contact (vCard) : l'appareil photo d'un téléphone l'ouvre sans
 *   réseau et sans dépendre de ce site (nom, contacts d'urgence, notes médicales). Le lecteur web (`?mode=ICE#...`) reste disponible pour un lien partagé ;
 *   son fragment d'URL (#...) n'est jamais envoyé au serveur HTTP.
 */

import StorageService from './storage.js';
import { generateQrSvg } from '../utils/qrcode.js';

export const ICE_STORAGE_KEY = 'parapente_ice_profile';

export const BLOOD_GROUPS = Object.freeze(['Inconnu', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']);

/**
 * @typedef {Object} IceProfile
 * @property {string} nom
 * @property {string} prenom
 * @property {string} birthYear année de naissance (déduite de birthDate quand elle est connue)
 * @property {string} birthDate date de naissance complète, AAAA-MM-JJ
 * @property {string} tel numéro de téléphone du pilote lui-même
 * @property {string} langues langues parlées (texte libre)
 * @property {string} contact1Name
 * @property {string} contact1Phone
 * @property {string} contact1Rel
 * @property {string} contact2Name
 * @property {string} contact2Phone
 * @property {string} contact2Rel
 * @property {string} bloodGroup
 * @property {string} allergies
 * @property {string} anticoag '1' si le pilote prend un traitement anticoagulant, sinon ''
 * @property {string} tetanos année du dernier rappel antitétanique
 * @property {string} pays code pays ISO 3166-1 alpha-2 (« FR ») : nationalité, affichée en drapeau
 * @property {string} remarques
 * @property {string} [medical]
 * @property {string} ffvl
 * @property {string} insurance
 */

/** @type {IceProfile} */
export const DEFAULT_ICE_PROFILE = Object.freeze({
    nom: '',
    prenom: '',
    birthYear: '',
    birthDate: '',
    tel: '',
    langues: '',
    contact1Name: '',
    contact1Phone: '',
    contact1Rel: '',
    contact2Name: '',
    contact2Phone: '',
    contact2Rel: '',
    bloodGroup: '',
    allergies: '',
    anticoag: '',
    tetanos: '',
    pays: '',
    remarques: '',
    ffvl: '',
    insurance: '',
});

/**
 * Nettoie une chaîne de texte pour éviter les injections ou espaces superflus.
 * @param {*} val
 * @returns {string}
 */
const cleanStr = (val) => (typeof val === 'string' ? val.trim() : '');

/** Longueurs maximales des champs de la fiche (une fiche trop longue ne tient plus dans un QR lisible). */
export const ICE_LIMITS = Object.freeze({
    name: 40,
    relation: 30,
    phone: 20,
    birthYear: 4,
    birthDate: 10,
    langues: 40,
    bloodGroup: 4,
    allergies: 150,
    tetanos: 4,
    pays: 2,
    remarques: 250,
    ffvl: 20,
    insurance: 60,
});

/** Taille maximale (octets UTF-8) du texte du QR code : au-delà, les modules deviennent trop petits pour un casque (version 16, 81 modules). */
export const ICE_QR_MAX_BYTES = 450;

const byteLength = (text) => new TextEncoder().encode(text).length;

const FIELD_LIMIT = Object.freeze({
    nom: ICE_LIMITS.name,
    prenom: ICE_LIMITS.name,
    birthYear: ICE_LIMITS.birthYear,
    birthDate: ICE_LIMITS.birthDate,
    tel: ICE_LIMITS.phone,
    langues: ICE_LIMITS.langues,
    contact1Name: ICE_LIMITS.name,
    contact1Phone: ICE_LIMITS.phone,
    contact1Rel: ICE_LIMITS.relation,
    contact2Name: ICE_LIMITS.name,
    contact2Phone: ICE_LIMITS.phone,
    contact2Rel: ICE_LIMITS.relation,
    bloodGroup: ICE_LIMITS.bloodGroup,
    allergies: ICE_LIMITS.allergies,
    anticoag: 1,
    tetanos: ICE_LIMITS.tetanos,
    pays: ICE_LIMITS.pays,
    remarques: ICE_LIMITS.remarques,
    ffvl: ICE_LIMITS.ffvl,
    insurance: ICE_LIMITS.insurance,
});

/**
 * Pays proposés dans la fiche (code ISO 3166-1 alpha-2, nom en français) : ceux d'où viennent la plupart des
 * pilotes de vol libre en Europe et en voyage. Un code valide absent de la liste reste accepté (lien partagé).
 * @type {ReadonlyArray<readonly [string, string]>}
 */
export const ICE_COUNTRIES = Object.freeze([
    ['FR', 'France'],
    ['CH', 'Suisse'],
    ['BE', 'Belgique'],
    ['LU', 'Luxembourg'],
    ['DE', 'Allemagne'],
    ['AT', 'Autriche'],
    ['IT', 'Italie'],
    ['ES', 'Espagne'],
    ['PT', 'Portugal'],
    ['GB', 'Royaume-Uni'],
    ['IE', 'Irlande'],
    ['NL', 'Pays-Bas'],
    ['DK', 'Danemark'],
    ['NO', 'Norvège'],
    ['SE', 'Suède'],
    ['FI', 'Finlande'],
    ['PL', 'Pologne'],
    ['CZ', 'Tchéquie'],
    ['SK', 'Slovaquie'],
    ['HU', 'Hongrie'],
    ['SI', 'Slovénie'],
    ['HR', 'Croatie'],
    ['RO', 'Roumanie'],
    ['BG', 'Bulgarie'],
    ['GR', 'Grèce'],
    ['TR', 'Turquie'],
    ['RU', 'Russie'],
    ['UA', 'Ukraine'],
    ['MA', 'Maroc'],
    ['DZ', 'Algérie'],
    ['TN', 'Tunisie'],
    ['ZA', 'Afrique du Sud'],
    ['US', 'États-Unis'],
    ['CA', 'Canada'],
    ['MX', 'Mexique'],
    ['BR', 'Brésil'],
    ['AR', 'Argentine'],
    ['CL', 'Chili'],
    ['CO', 'Colombie'],
    ['IN', 'Inde'],
    ['NP', 'Népal'],
    ['JP', 'Japon'],
    ['KR', 'Corée du Sud'],
    ['AU', 'Australie'],
    ['NZ', 'Nouvelle-Zélande'],
]);

/**
 * Code pays valide (deux lettres), en majuscules, sinon ''.
 * @param {unknown} code
 * @returns {string}
 */
export function normalizeCountry(code) {
    const c = typeof code === 'string' ? code.trim().toUpperCase() : '';
    return /^[A-Z]{2}$/.test(c) ? c : '';
}

/**
 * Drapeau (emoji) d'un code pays : « FR » donne le drapeau français. '' si le code n'est pas valide.
 * Sur un système sans police de drapeaux (Windows), le navigateur affiche les deux lettres du code.
 * @param {unknown} code
 * @returns {string}
 */
export function flagEmoji(code) {
    const c = normalizeCountry(code);
    if (!c) return '';
    return String.fromCodePoint(...[...c].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}

/**
 * Nom français d'un pays de la liste (le code lui-même sinon, '' s'il est invalide).
 * @param {unknown} code
 * @returns {string}
 */
export function countryName(code) {
    const c = normalizeCountry(code);
    return ICE_COUNTRIES.find(([k]) => k === c)?.[1] || c;
}

/**
 * Date de naissance valide (AAAA-MM-JJ, jour réel, entre 1900 et aujourd'hui), sinon ''.
 * @param {unknown} value
 * @param {Date} [now]
 * @returns {string}
 */
export function normalizeBirthDate(value, now = new Date()) {
    const v = typeof value === 'string' ? value.trim() : '';
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    if (!m) return '';
    const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const d = new Date(Date.UTC(year, month - 1, day));
    const real = d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
    return real && year >= 1900 && d.getTime() <= now.getTime() ? v : '';
}

/**
 * Date de naissance au format français (12/03/1988).
 * @param {string} birthDate AAAA-MM-JJ
 */
export function formatBirthDate(birthDate) {
    const v = normalizeBirthDate(birthDate);
    return v ? `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)}` : '';
}

/**
 * Âge en années révolues d'après la date de naissance complète, sinon d'après l'année seule. null si inconnu.
 * @param {Partial<IceProfile>} profile
 * @param {Date} [now]
 * @returns {number | null}
 */
export function ageOf(profile, now = new Date()) {
    const full = normalizeBirthDate(profile.birthDate, now);
    if (full) {
        const [y, m, d] = full.split('-').map(Number);
        let age = now.getFullYear() - y;
        if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age -= 1;
        return age;
    }
    if (/^\d{4}$/.test(profile.birthYear || '')) {
        const age = now.getFullYear() - Number(profile.birthYear);
        return age > 0 && age < 120 ? age : null;
    }
    return null;
}

/**
 * Profil nettoyé : textes rognés, tronqués à la longueur maximale de chaque champ, champs inconnus ignorés.
 * @param {Partial<IceProfile> & { medical?: string }} [profile]
 * @returns {IceProfile}
 */
export function clampProfile(profile = {}) {
    const src = profile && typeof profile === 'object' ? profile : {};
    /** @type {Record<string, string>} */
    const out = {};
    for (const [key, max] of Object.entries(FIELD_LIMIT)) {
        const raw = key === 'remarques' ? src.remarques || src.medical : src[key];
        out[key] = cleanStr(typeof raw === 'number' ? String(raw) : raw).slice(0, max);
    }
    // Case à cocher : toute valeur « vraie » (true, '1', 'on') devient '1', le reste ''.
    out.anticoag = [true, '1', 'on', 'true'].includes(/** @type {any} */ (src).anticoag) ? '1' : '';
    out.pays = normalizeCountry(src.pays);
    // Date de naissance complète : l'année s'en déduit ; sans date complète, l'année seule (anciennes fiches).
    out.birthDate = normalizeBirthDate(src.birthDate);
    if (out.birthDate) out.birthYear = out.birthDate.slice(0, 4);
    return /** @type {IceProfile} */ (out);
}

/**
 * Masque les données du profil ICE (XOR + base64) pour ne pas les afficher en clair dans le stockage local.
 * Ce n'est pas du chiffrement : la clé est dans le code.
 * @param {object} data
 * @returns {string}
 */
export function encodeLocalIce(data) {
    if (!data || typeof data !== 'object') return '';
    try {
        const json = JSON.stringify(data);
        const encoded = encodeURIComponent(json);
        let out = '';
        for (let i = 0; i < encoded.length; i++) {
            out += String.fromCharCode(encoded.charCodeAt(i) ^ 0x2b);
        }
        return btoa(out);
    } catch {
        return '';
    }
}

/**
 * Lit le profil ICE stocké localement (masqué, ou objet brut d'une ancienne version).
 * @param {*} raw
 * @returns {Partial<IceProfile>|null}
 */
export function decodeLocalIce(raw) {
    if (!raw) return null;
    if (typeof raw === 'object') return raw;
    if (typeof raw !== 'string') return null;
    try {
        const bin = atob(raw);
        let out = '';
        for (let i = 0; i < bin.length; i++) {
            out += String.fromCharCode(bin.charCodeAt(i) ^ 0x2b);
        }
        const json = decodeURIComponent(out);
        return JSON.parse(json);
    } catch {
        return null;
    }
}

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
 * Numéro au format international (E.164 : +33612345678), pour les liens d'appel et la fiche contact du QR.
 * Un numéro national (06 12 34 56 78) est mal interprété par le téléphone d'un secouriste dont la carte SIM est
 * d'un autre pays : « 00 » devient « + », et un numéro français à 10 chiffres reçoit « +33 ».
 * @param {string} phone
 * @param {string} [defaultCountry] indicatif pays des numéros nationaux (France par défaut)
 * @returns {string} '' si le numéro est vide
 */
export function toInternationalPhone(phone, defaultCountry = '33') {
    const clean = sanitizePhone(phone);
    if (!clean) return '';
    if (clean.startsWith('+')) return clean;
    if (clean.startsWith('00')) return `+${clean.slice(2)}`;
    if (clean.startsWith('0') && clean.length === 10) return `+${defaultCountry}${clean.slice(1)}`;
    return clean;
}

/**
 * Formate un numéro de téléphone pour un affichage plus lisible.
 * @param {string} phone
 * @returns {string}
 */
export function formatPhoneDisplay(phone) {
    if (!phone) return '';
    const clean = phone.trim();
    // Numéro français au format international : +33 6 12 34 56 78
    const intl = clean.replace(/[\s.-]/g, '');
    if (/^\+33[1-9]\d{8}$/.test(intl)) {
        return `+33 ${intl[3]} ${intl.slice(4, 6)} ${intl.slice(6, 8)} ${intl.slice(8, 10)} ${intl.slice(10, 12)}`;
    }
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
    if (normalizeBirthDate(profile.birthDate)) params.set('bd', normalizeBirthDate(profile.birthDate));
    if (profile.tel) params.set('tp', String(profile.tel).trim());
    if (profile.langues) params.set('lg', String(profile.langues).trim());

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
    if (profile.anticoag) params.set('ac', '1');
    if (profile.tetanos) params.set('te', String(profile.tetanos).trim());
    if (normalizeCountry(profile.pays)) params.set('pa', normalizeCountry(profile.pays));
    const rem = profile.remarques || profile.medical;
    if (rem) params.set('rem', rem.trim());
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
        if (params.has('bd')) result.birthDate = normalizeBirthDate(params.get('bd'));
        if (params.has('tp')) result.tel = params.get('tp') || '';
        if (params.has('lg')) result.langues = params.get('lg') || '';

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
        if (params.get('ac') === '1') result.anticoag = '1';
        if (params.has('te')) result.tetanos = params.get('te') || '';
        if (params.has('pa')) result.pays = normalizeCountry(params.get('pa'));
        if (params.has('rem')) result.remarques = params.get('rem') || '';
        else if (params.has('med')) result.remarques = params.get('med') || '';
        if (params.has('ff')) result.ffvl = params.get('ff') || '';
        if (params.has('ins')) result.insurance = params.get('ins') || '';
    } catch (e) {
        console.warn('[IceService] Erreur lors du décodage du payload ICE:', e);
    }

    return clampProfile(result);
}

/** Échappement d'une valeur de fiche contact (vCard 3.0) : \\ ; , et retours à la ligne. */
const vcardEscape = (value) =>
    String(value).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');

/**
 * Fiche contact (vCard 3.0) pour le QR code du casque. L'appareil photo d'un téléphone la reconnaît et ouvre
 * l'écran « contact » SANS réseau : le nom, les contacts d'urgence avec leur étiquette (« Sophie (Conjointe) »,
 * numéros touchables) et un champ Notes qui porte les informations médicales. Un QR de texte brut, lui, ne
 * propose qu'une recherche web (testé sur iPhone).
 * @param {Partial<IceProfile>} profile
 * @returns {string}
 */
export function buildIceVCard(profile = {}) {
    const p = clampProfile(profile);
    const fullName = [p.prenom, p.nom].filter(Boolean).join(' ') || 'Pilote';
    const lines = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `N:${vcardEscape(p.nom)};${vcardEscape(p.prenom)};;;`,
        `FN:${vcardEscape(fullName)}`,
        `ORG:URGENCE ICE PARAPENTE${flagEmoji(p.pays) ? ` ${flagEmoji(p.pays)}` : ''}`,
    ];
    let item = 0;
    const contact = (name, phone, rel, fallback) => {
        const digits = toInternationalPhone(phone);
        if (!digits) return;
        item += 1;
        const label = [name, rel ? `(${rel})` : ''].filter(Boolean).join(' ') || fallback;
        lines.push(`item${item}.TEL:${digits}`, `item${item}.X-ABLabel:${vcardEscape(label)}`);
    };
    contact(p.contact1Name, p.contact1Phone, p.contact1Rel, 'Contact 1');
    contact(p.contact2Name, p.contact2Phone, p.contact2Rel, 'Contact 2');
    if (item === 0) {
        lines.push('item1.TEL:112', 'item1.X-ABLabel:Secours');
        item = 1;
    }
    // Le numéro du pilote lui-même, en dernier : les secours appellent d'abord les contacts d'urgence.
    const pilotPhone = toInternationalPhone(p.tel);
    if (pilotPhone) lines.push(`item${item + 1}.TEL:${pilotPhone}`, `item${item + 1}.X-ABLabel:Pilote`);

    // Les informations vitales d'abord : c'est ce que lit un secouriste.
    const note = [];
    if (p.bloodGroup && p.bloodGroup !== 'Inconnu') note.push(`SANG ${p.bloodGroup}`);
    if (p.anticoag) note.push('ANTICOAGULANTS');
    if (p.allergies) note.push(`ALLERGIES: ${p.allergies}`);
    if (p.remarques) note.push(`SANTÉ: ${p.remarques}`);
    if (p.tetanos) note.push(`TÉTANOS ${p.tetanos}`);
    if (p.langues) note.push(`LANGUES: ${p.langues}`);
    if (p.birthDate) note.push(`Né ${formatBirthDate(p.birthDate)}`);
    else if (p.birthYear) note.push(`Né ${p.birthYear}`);
    if (p.ffvl) note.push(`FFVL ${p.ffvl}`);
    if (p.insurance) note.push(`ASSURANCE ${p.insurance}`);
    if (note.length) lines.push(`NOTE:${note.map(vcardEscape).join('\\n')}`);

    lines.push('END:VCARD');
    return lines.join('\n');
}

/**
 * La fiche tient-elle dans un QR code lisible sur un casque ?
 * @param {Partial<IceProfile>} profile
 */
export function qrFits(profile = {}) {
    return byteLength(buildIceVCard(profile)) <= ICE_QR_MAX_BYTES;
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

/** Retire la copie du profil que la première version rangeait dans les préférences (synchronisées au cloud). */
function removeLegacyPrefsCopy() {
    try {
        const prefs = StorageService.get(StorageService.KEYS.USER_PREFS, {});
        if (prefs && typeof prefs === 'object' && 'iceProfile' in prefs) {
            delete prefs.iceProfile;
            StorageService.set(StorageService.KEYS.USER_PREFS, prefs);
        }
    } catch {
        // préférences illisibles : rien à nettoyer
    }
}

export const IceService = {
    /**
     * Récupère le profil ICE enregistré sur cet appareil.
     * @returns {IceProfile}
     */
    getProfile() {
        const direct = decodeLocalIce(StorageService.get(ICE_STORAGE_KEY));
        if (direct && typeof direct === 'object') return clampProfile(direct);

        // Profil rangé dans les préférences par la première version : on le déplace puis on le retire.
        const prefs = StorageService.get(StorageService.KEYS.USER_PREFS, {});
        const legacy = prefs && typeof prefs === 'object' ? decodeLocalIce(prefs.iceProfile) : null;
        if (legacy && typeof legacy === 'object') {
            const profile = clampProfile(legacy);
            StorageService.set(ICE_STORAGE_KEY, encodeLocalIce(profile));
            removeLegacyPrefsCopy();
            return profile;
        }
        return { ...DEFAULT_ICE_PROFILE };
    },

    /**
     * Sauvegarde le profil ICE sur cet appareil (jamais dans les préférences synchronisées).
     * @param {Partial<IceProfile>} profile
     * @returns {boolean}
     */
    saveProfile(profile) {
        const ok = StorageService.set(ICE_STORAGE_KEY, encodeLocalIce(clampProfile(profile)));
        removeLegacyPrefsCopy();
        return ok;
    },

    /**
     * Efface le profil ICE local.
     */
    clearProfile() {
        StorageService.set(ICE_STORAGE_KEY, null);
        removeLegacyPrefsCopy();
    },

    qrFits,

    /**
     * Génère le QR Code SVG pour le casque : par défaut la fiche contact (lisible hors ligne), ou le lien
     * du lecteur web avec `mode: 'url'`.
     * @param {Partial<IceProfile>} profile
     * @param {object} [options]
     * @param {"vcard"|"url"} [options.mode]
     * @param {string} [options.baseUrl] (mode url)
     * @param {number} [options.size]
     * @param {number} [options.border]
     * @param {"LOW"|"MEDIUM"|"QUARTILE"|"HIGH"} [options.ecc]
     * @returns {string} SVG string
     * @throws {Error} si la fiche est trop longue pour un QR lisible
     */
    generateQrSvg(profile, options = {}) {
        let data;
        if (options.mode === 'url') {
            data = buildIceUrl(profile, options.baseUrl);
        } else {
            data = buildIceVCard(profile);
            if (byteLength(data) > ICE_QR_MAX_BYTES) throw new Error('ice-qr-too-long');
        }
        return generateQrSvg(data, {
            size: options.size || 220,
            border: options.border || 2,
            ecc: options.ecc || 'MEDIUM',
        });
    },

    encodePayload,
    decodePayload,
    buildIceUrl,
    buildIceVCard,
    clampProfile,
    sanitizePhone,
    toInternationalPhone,
    formatPhoneDisplay,
    flagEmoji,
    countryName,
    normalizeCountry,
    normalizeBirthDate,
    formatBirthDate,
    ageOf,
};

export default IceService;
