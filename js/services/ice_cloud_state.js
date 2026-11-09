/**
 * SERVICE - État local de la sauvegarde en ligne de la fiche d'urgence (ICE).
 *
 * La fiche contient des données de santé : elle reste sur l'appareil sauf si le pilote demande expressément de
 * l'enregistrer dans son profil en ligne (Firestore, users/{uid}/ice/profile). Ce module ne garde que l'état de
 * cette demande, sur l'appareil : l'accord et sa date, la date de la dernière modification locale (pour
 * départager les appareils) et celle de la dernière synchro. Pur (aucun import hormis le stockage) : le service
 * Firebase le lit sans charger le générateur de QR.
 */
import StorageService from './storage.js';

export const ICE_CLOUD_KEY = 'parapente_ice_cloud';

/**
 * @typedef {Object} IceCloudState
 * @property {boolean} enabled le pilote a demandé la sauvegarde en ligne
 * @property {string} consentAt date (ISO) de cet accord exprès, '' sans accord
 * @property {number} updatedAt dernière modification de la fiche sur cet appareil (ms)
 * @property {number} lastSyncedAt dernière synchro réussie (ms), 0 si jamais
 */

/** @returns {IceCloudState} */
export function getIceCloudState() {
    const raw = StorageService.get(ICE_CLOUD_KEY);
    const s = raw && typeof raw === 'object' ? raw : {};
    return {
        enabled: s.enabled === true,
        consentAt: typeof s.consentAt === 'string' ? s.consentAt : '',
        updatedAt: Number.isFinite(s.updatedAt) ? s.updatedAt : 0,
        lastSyncedAt: Number.isFinite(s.lastSyncedAt) ? s.lastSyncedAt : 0,
    };
}

/**
 * @param {Partial<IceCloudState>} patch
 * @returns {IceCloudState}
 */
export function setIceCloudState(patch) {
    const next = { ...getIceCloudState(), ...patch };
    StorageService.set(ICE_CLOUD_KEY, next);
    return next;
}

/** Retire la demande de sauvegarde en ligne (la date de modification locale est conservée). */
export function disableIceCloud() {
    return setIceCloudState({ enabled: false, consentAt: '', lastSyncedAt: 0 });
}
