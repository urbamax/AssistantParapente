/**
 * SERVICE - Flight trace sync (Cloud Firestore)
 * Envoi, téléchargement et suppression des traces IGC dans users/{uid}/igcTraces, voir
 * specs/037-sync-flight-traces/spec.md. Les fonctions reçoivent le module Firestore (celui que renvoie
 * FirebaseAuthEngine._loadFirestore), la base et l'uid : aucun état global, testable avec un faux Firestore.
 */
import {
    ENCODING_GZIP,
    TRACE_MAX_PARTS,
    decodeTrace,
    encodeTrace,
    traceDigest,
    traceDocId,
} from '../utils/trace_codec.js';

/** Nombre maximal de vols dont la trace est envoyée à chaque synchro (le reste suit aux synchros suivantes). */
export const TRACE_UPLOADS_PER_SYNC = 2;

/**
 * Le vol sans sa trace brute : c'est ce qui part dans le document du vol. La trace voyage à part, dans
 * igcTraces ; dans le document du vol elle le rendrait énorme (limite de 1 Mio) et serait renvoyée à
 * chaque modification de n'importe quel vol.
 * @template T
 * @param {T & { rawIgc?: string }} flight
 * @returns {T}
 */
export function stripTrace(flight) {
    if (!flight || typeof flight !== 'object' || !('rawIgc' in flight)) return flight;
    const rest = { ...flight };
    delete rest.rawIgc;
    return /** @type {T} */ (rest);
}

/**
 * Faut-il envoyer la trace de ce vol ? Oui si aucune copie n'est dans le cloud, ou si la trace a été
 * remplacée depuis (traceUpdatedAt plus récent que l'envoi).
 * @param {{ traceCloud?: { at?: number }, traceUpdatedAt?: number }} flight
 */
export function needsTraceUpload(flight) {
    if (!flight.traceCloud) return true;
    return (flight.traceUpdatedAt || 0) > (flight.traceCloud.at || 0);
}

/**
 * Écrit tous les morceaux d'une trace. Ne touche pas au document du vol : c'est à l'appelant de n'y
 * inscrire `traceCloud` qu'une fois cette fonction terminée, pour qu'un autre appareil ne voie jamais
 * une trace à moitié envoyée. Retire les morceaux en trop d'une ancienne trace plus longue.
 * @returns {Promise<{ at: number, parts: number, bytes: number, digest: string | null, encoding: string }>}
 */
export async function uploadFlightTrace({ firestore, db, uid, flightId, rawIgc, previousParts = 0 }) {
    const { doc, setDoc, deleteDoc } = firestore;
    const encoded = await encodeTrace(rawIgc);
    const at = Date.now();
    for (let index = 0; index < encoded.parts.length; index++) {
        await setDoc(doc(db, 'users', uid, 'igcTraces', traceDocId(flightId, index)), {
            flightId,
            index,
            total: encoded.parts.length,
            encoding: encoded.encoding,
            data: encoded.parts[index],
            updatedAt: at,
        });
    }
    for (let index = encoded.parts.length; index < previousParts; index++) {
        await deleteDoc(doc(db, 'users', uid, 'igcTraces', traceDocId(flightId, index)));
    }
    return {
        at,
        parts: encoded.parts.length,
        bytes: encoded.bytes,
        digest: encoded.digest,
        encoding: encoded.encoding,
    };
}

/**
 * Relit la trace d'un vol depuis le cloud.
 * @param {{ firestore: any, db: any, uid: string, flightId: string,
 *   traceCloud: { parts: number, digest?: string | null, encoding?: string } }} args
 * @returns {Promise<string>}
 * @throws si un morceau manque, si les données sont corrompues ou si l'empreinte ne correspond pas
 */
export async function downloadFlightTrace({ firestore, db, uid, flightId, traceCloud }) {
    const { doc, getDoc } = firestore;
    const parts = [];
    for (let index = 0; index < traceCloud.parts; index++) {
        const snapshot = await getDoc(doc(db, 'users', uid, 'igcTraces', traceDocId(flightId, index)));
        if (!snapshot.exists()) throw new Error(`Morceau ${index + 1}/${traceCloud.parts} de la trace introuvable.`);
        parts.push(snapshot.data().data);
    }
    const text = await decodeTrace(parts, traceCloud.encoding || ENCODING_GZIP);
    if (traceCloud.digest) {
        const digest = await traceDigest(text);
        if (digest && digest !== traceCloud.digest)
            throw new Error('La trace téléchargée est altérée (empreinte différente).');
    }
    return text;
}

/**
 * Supprime tous les morceaux possibles d'un vol (ils portent des identifiants fixes, de _0 à _11) : supprimer
 * un document qui n'existe pas est sans effet, et cela retire aussi les morceaux orphelins d'un envoi interrompu.
 */
export async function deleteFlightTraceParts({ firestore, db, uid, flightId }) {
    const { doc, deleteDoc } = firestore;
    for (let index = 0; index < TRACE_MAX_PARTS; index++) {
        await deleteDoc(doc(db, 'users', uid, 'igcTraces', traceDocId(flightId, index)));
    }
}
