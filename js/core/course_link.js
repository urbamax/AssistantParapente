/**
 * CORE - Ouverture des cours (PDF)
 * Les cours du site sont affichés dans la visionneuse intégrée (js/views/course_viewer.js,
 * chargée à la demande) avec un bouton « Retour » : l'écran dessous (par exemple la question du QCM)
 * n'est ni quitté ni rechargé, que ce soit sur l'application installée ou dans un onglet de navigateur.
 * Tout autre lien externe est ouvert dans un nouvel onglet.
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
 * Ouvre un lien : un cours (PDF du site) dans la visionneuse intégrée,
 * tout le reste dans un nouvel onglet (sans lien avec la page d'origine).
 * @param {string} url
 */
export function openLink(url) {
    if (isPdfUrl(url) && new URL(url, window.location.href).origin === window.location.origin) {
        import('../views/course_viewer.js').then((viewer) => viewer.openCourseViewer(url));
        return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
}

/** Les liens `<a target="_blank">` vers un cours passent aussi par la visionneuse (fiches Révision par axe). */
export function installCourseLinkInterception() {
    document.addEventListener('click', (event) => {
        if (event.defaultPrevented) return;
        const link = /** @type {Element | null} */ (event.target)?.closest?.('a[target="_blank"][href]');
        if (!link || !isPdfUrl(link.getAttribute('href') || '')) return;
        event.preventDefault();
        openLink(/** @type {HTMLAnchorElement} */ (link).href);
    });
}
