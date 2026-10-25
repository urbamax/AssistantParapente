/**
 * SERVICE - AccessService
 * Rôles du pilote connecté. Un rôle est donné à la main dans Firestore, dans le document
 * users/{uid}/access/profile (champ `roles`, par exemple ["beta"]) : les règles Firestore le
 * laissent lire à son propriétaire mais refusent toute écriture depuis l'application.
 *
 * Rôle « beta » : la météo calculée par l'application (verdict volable / non volable, créneaux,
 * frise horaire, comparateur, réglages du calcul, notifications). Sans ce rôle, y compris sans
 * compte, la liste et la carte des sites restent visibles mais rien de calculé n'est affiché.
 *
 * Rôle « owner » (propriétaire) : a tous les droits des autres rôles, présents et à venir.
 *
 * Les rôles lus sont gardés sur l'appareil pour que l'écran reste cohérent hors ligne et au
 * redémarrage, avant que Firebase ne soit chargé. Ils sont effacés à la déconnexion.
 */
import StorageService from './storage.js';
import { createEmitter } from '../utils/emitter.js';

export const ROLES = Object.freeze({
    BETA: 'beta',
    OWNER: 'owner', // le propriétaire de l'application : a tous les droits des autres rôles
});

export const ACCESS_EVENTS = Object.freeze({
    CHANGED: 'changed', // l'ensemble des rôles a changé
});

const emitter = createEmitter();

/** @returns {{ uid: string | null, roles: Set<string> }} */
function readCache() {
    const saved = StorageService.get(StorageService.KEYS.ACCESS);
    if (!saved || typeof saved !== 'object' || typeof saved.uid !== 'string' || !Array.isArray(saved.roles)) {
        return { uid: null, roles: new Set() };
    }
    return { uid: saved.uid, roles: new Set(saved.roles.filter((role) => typeof role === 'string')) };
}

let { uid: currentUid, roles: currentRoles } = readCache();

function sameRoles(a, b) {
    return a.size === b.size && [...a].every((role) => b.has(role));
}

function commit(uid, roles) {
    const changed = !sameRoles(roles, currentRoles);
    currentUid = uid;
    currentRoles = roles;
    if (roles.size === 0 && uid === null) StorageService.remove(StorageService.KEYS.ACCESS);
    else StorageService.set(StorageService.KEYS.ACCESS, { uid, roles: [...roles] });
    if (changed) emitter.emit(ACCESS_EVENTS.CHANGED, [...roles]);
}

const AccessService = {
    /** @param {string} role */
    has(role) {
        return currentRoles.has(role) || currentRoles.has(ROLES.OWNER);
    },

    canUseForecast() {
        return this.has(ROLES.BETA);
    },

    /** @returns {string[]} */
    getRoles() {
        return [...currentRoles];
    },

    /**
     * Rôles lus dans Firestore pour ce compte. Toute valeur qui n'est pas une liste de textes
     * compte comme « aucun rôle ».
     * @param {string} uid
     * @param {unknown} roles
     */
    setRoles(uid, roles) {
        const list = Array.isArray(roles) ? roles.filter((role) => typeof role === 'string') : [];
        commit(uid, new Set(list));
    },

    /**
     * Un compte se connecte : les rôles gardés sur l'appareil ne valent que pour le même compte.
     * @param {string} uid
     */
    expectUser(uid) {
        if (currentUid !== uid) commit(uid, new Set());
    },

    /** Déconnexion : plus aucun rôle. */
    clear() {
        commit(null, new Set());
    },

    /**
     * @param {string} event
     * @param {(payload?: any) => void} handler
     * @returns {() => void} fonction de désabonnement
     */
    on(event, handler) {
        return emitter.on(event, handler);
    },

    /** Relit le cache de l'appareil (tests). */
    _reloadFromStorage() {
        ({ uid: currentUid, roles: currentRoles } = readCache());
    },
};

/**
 * Affiche ou cache les éléments de la page selon les rôles :
 * `data-requires-role="beta"` n'apparaît qu'avec ce rôle, `data-hidden-with-role="beta"`
 * n'apparaît que sans lui.
 * @param {ParentNode} [root]
 */
export function applyRoleVisibility(root = document) {
    for (const el of root.querySelectorAll('[data-requires-role]')) {
        /** @type {HTMLElement} */ (el).hidden = !AccessService.has(el.getAttribute('data-requires-role'));
    }
    for (const el of root.querySelectorAll('[data-hidden-with-role]')) {
        /** @type {HTMLElement} */ (el).hidden = AccessService.has(el.getAttribute('data-hidden-with-role'));
    }
}

export default AccessService;
