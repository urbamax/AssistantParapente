/**
 * CORE - Ouverture des cours (PDF)
 * Application installée (écran d'accueil du téléphone) : pas de barre d'adresse ni de bouton retour,
 * un PDF ouvert « normalement » remplace l'application sans moyen d'y revenir. Elle l'affiche donc dans
 * sa propre visionneuse (js/views/course_viewer.js, chargée à la demande) avec un bouton « Retour ».
 * Dans un onglet de navigateur, le lecteur PDF du navigateur reste le meilleur choix : inchangé.
 */

/** @param {string} url */
function isPdfUrl(url) {
    try {
        return /\.pdf$/i.test(new URL(url, window.location.href).pathname);
    } catch {
        return false;
    }
}

/** Vrai quand l'application tourne sans interface de navigateur (installée sur l'écran d'accueil). */
export function isInstalledApp() {
    // @ts-ignore : navigator.standalone n'existe que sur Safari iOS
    if (window.navigator.standalone === true) return true;
    return ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay'].some(
        (mode) => window.matchMedia?.(`(display-mode: ${mode})`).matches,
    );
}

/**
 * Ouvre un lien : un cours (PDF du site) dans la visionneuse quand l'application est installée,
 * tout le reste dans un nouvel onglet (sans lien avec la page d'origine).
 * @param {string} url
 */
export function openLink(url) {
    if (isInstalledApp() && isPdfUrl(url) && new URL(url, window.location.href).origin === window.location.origin) {
        import('../views/course_viewer.js').then((viewer) => viewer.openCourseViewer(url));
        return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
}

/** Les liens `<a target="_blank">` vers un cours passent aussi par la visionneuse (fiches Révision par axe). */
export function installCourseLinkInterception() {
    document.addEventListener('click', (event) => {
        if (event.defaultPrevented || !isInstalledApp()) return;
        const link = /** @type {Element | null} */ (event.target)?.closest?.('a[target="_blank"][href]');
        if (!link || !isPdfUrl(link.getAttribute('href') || '')) return;
        event.preventDefault();
        openLink(/** @type {HTMLAnchorElement} */ (link).href);
    });
}
