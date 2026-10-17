/**
 * UTILS - Flight trace codec
 * Prépare une trace IGC pour Cloud Firestore et la relit : texte -> gzip -> base64 -> morceaux.
 * Un document Firestore est limité à 1 Mio : la trace est découpée en morceaux de TRACE_PART_CHARS
 * caractères (un vol de 3 h à 1 Hz tient en un seul morceau une fois compressé, voir
 * specs/037-sync-flight-traces/spec.md). Fonctions pures : aucun accès réseau ni stockage.
 */

/** Taille maximale d'un morceau, en caractères base64 (largement sous la limite de 1 Mio du document). */
export const TRACE_PART_CHARS = 700_000;
/** Une trace qui demanderait plus de morceaux n'est pas envoyée (le vol reste utilisable en local). */
export const TRACE_MAX_PARTS = 12;

export const ENCODING_GZIP = 'gzip-base64';
export const ENCODING_PLAIN = 'identity-base64';

export class TraceTooLargeError extends Error {
    constructor(parts) {
        super(`Trace trop volumineuse pour la synchro : ${parts} morceaux (maximum ${TRACE_MAX_PARTS}).`);
        this.name = 'TraceTooLargeError';
    }
}

/** Identifiant du document Firestore d'un morceau (les identifiants de vol sont des UUID). */
export function traceDocId(flightId, index) {
    return `${flightId}_${index}`;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Fait passer des octets dans un CompressionStream ou un DecompressionStream. */
async function pipe(bytes, stream) {
    const writer = stream.writable.getWriter();
    const writing = writer.write(bytes).then(() => writer.close());
    const [buffer] = await Promise.all([new Response(stream.readable).arrayBuffer(), writing]);
    return new Uint8Array(buffer);
}

function toBase64(bytes) {
    let binary = '';
    // Par blocs : String.fromCharCode(...tout) dépasse la pile d'appels sur une grosse trace.
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary);
}

function fromBase64(text) {
    const binary = atob(text);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

/** Empreinte SHA-256 (32 premiers caractères hexadécimaux) du texte, ou null si le navigateur n'en offre pas. */
export async function traceDigest(text) {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) return null;
    const hash = new Uint8Array(await subtle.digest('SHA-256', encoder.encode(text)));
    return [...hash]
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
        .slice(0, 32);
}

/**
 * @param {string} rawIgc texte de la trace
 * @param {{ partChars?: number }} [options]
 * @returns {Promise<{ encoding: string, parts: string[], bytes: number, digest: string | null }>}
 * @throws {TraceTooLargeError}
 */
export async function encodeTrace(rawIgc, { partChars = TRACE_PART_CHARS } = {}) {
    if (typeof rawIgc !== 'string' || rawIgc.length === 0) throw new Error('Trace vide : rien à envoyer.');
    const bytes = encoder.encode(rawIgc);
    const compressed = typeof CompressionStream === 'function';
    const payload = compressed ? await pipe(bytes, new CompressionStream('gzip')) : bytes;
    const text = toBase64(payload);

    const parts = [];
    for (let i = 0; i < text.length; i += partChars) parts.push(text.slice(i, i + partChars));
    if (parts.length > TRACE_MAX_PARTS) throw new TraceTooLargeError(parts.length);

    return {
        encoding: compressed ? ENCODING_GZIP : ENCODING_PLAIN,
        parts,
        bytes: bytes.length,
        digest: await traceDigest(rawIgc),
    };
}

/**
 * @param {string[]} parts morceaux dans l'ordre
 * @param {string} [encoding]
 * @returns {Promise<string>} le texte de la trace
 * @throws si les données sont corrompues ou si le navigateur ne sait pas décompresser
 */
export async function decodeTrace(parts, encoding = ENCODING_GZIP) {
    const payload = fromBase64(parts.join(''));
    if (encoding === ENCODING_PLAIN) return decoder.decode(payload);
    if (encoding !== ENCODING_GZIP) throw new Error(`Codage de trace inconnu : ${encoding}`);
    if (typeof DecompressionStream !== 'function') {
        throw new Error('Ce navigateur ne sait pas décompresser la trace (DecompressionStream absent).');
    }
    return decoder.decode(await pipe(payload, new DecompressionStream('gzip')));
}
