/**
 * CORE - Start mode
 * Décide de l'écran affiché au démarrage.
 */

export const FIRST_VISIT_MODE = 'WELCOME';

/**
 * Lien direct (?mode=) > dernière page ouverte > écran d'accueil de première visite.
 * L'accueil n'est donc affiché que tant qu'aucune autre page n'a jamais été ouverte
 * (LAST_ACTIVE_ROUTE est écrit par le routeur dès la première navigation).
 */
export function resolveStartMode(urlMode, lastActiveRoute) {
    return urlMode || lastActiveRoute || FIRST_VISIT_MODE;
}
