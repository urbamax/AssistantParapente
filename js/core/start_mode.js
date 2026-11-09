/**
 * CORE - Start mode
 * Décide de l'écran affiché au démarrage.
 */

export const FIRST_VISIT_MODE = 'WELCOME';

/**
 * Lien direct (?mode= ou hash #ice) > dernière page ouverte > écran d'accueil de première visite.
 * L'accueil n'est donc affiché que tant qu'aucune autre page n'a jamais été ouverte
 * (LAST_ACTIVE_ROUTE est écrit par le routeur dès la première navigation).
 */
export function resolveStartMode(urlMode, lastActiveRoute, hash = '') {
    if (urlMode) return urlMode;
    if (typeof hash === 'string' && (hash.startsWith('#ice') || hash.startsWith('#v='))) return 'ICE';
    return lastActiveRoute || FIRST_VISIT_MODE;
}

/**
 * L'adresse courante est-elle celle de la fiche d'urgence (lecteur ICE) ? Un témoin qui scanne le QR du casque
 * doit voir la fiche tout de suite, sans bandeau par-dessus.
 * @param {string} [search] window.location.search
 * @param {string} [hash] window.location.hash
 */
export function isIceLocation(search = '', hash = '') {
    return new URLSearchParams(search).get('mode') === 'ICE' || hash.startsWith('#ice') || hash.startsWith('#v=');
}
