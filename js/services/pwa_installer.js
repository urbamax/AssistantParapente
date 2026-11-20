/**
 * SERVICE - PWA Installer (spec 051)
 *
 * Gère l'installation de l'application sur l'écran d'accueil :
 * - Installation directe en 1 clic sur Android / Chromium via l'événement beforeinstallprompt
 * - Détection du mode autonome (standalone) pour masquer les boutons si déjà installé
 * - Guidage visuel pour iOS Safari (iPhone / iPad) via une modale dédiée
 */

/** @type {any} */
let deferredPrompt = null;
let isInitialized = false;

/**
 * Détecte si l'application est exécutée en mode autonome (déjà installée sur l'écran d'accueil ou fenêtrée).
 * @param {Window} [win]
 * @returns {boolean}
 */
export function isStandalone(win = typeof window !== 'undefined' ? window : undefined) {
    if (!win) return false;
    try {
        const isStandaloneMedia = win.matchMedia && win.matchMedia('(display-mode: standalone)').matches;
        // @ts-ignore iOS Safari standalone property
        const isIosStandalone = win.navigator && win.navigator.standalone === true;
        const isTwa = typeof win.document?.referrer === 'string' && win.document.referrer.includes('android-app://');
        return Boolean(isStandaloneMedia || isIosStandalone || isTwa);
    } catch {
        return false;
    }
}

/**
 * Détecte si l'utilisateur est sur iOS / iPadOS (Safari).
 * @param {Window} [win]
 * @returns {boolean}
 */
export function isIos(win = typeof window !== 'undefined' ? window : undefined) {
    if (!win || !win.navigator) return false;
    try {
        const ua = win.navigator.userAgent || '';
        const isIosDevice = /iPad|iPhone|iPod/.test(ua);
        // iPadOS 13+ se présente comme MacIntel avec du tactile
        const isIpadOs = win.navigator.platform === 'MacIntel' && win.navigator.maxTouchPoints > 1;
        // @ts-ignore
        const isMsStream = Boolean(win.MSStream);
        return (isIosDevice || isIpadOs) && !isMsStream;
    } catch {
        return false;
    }
}

/**
 * Indique si un prompt natif d'installation est en attente.
 * @returns {boolean}
 */
export function canPromptInstall() {
    return deferredPrompt !== null;
}

/**
 * Indique si l'application peut proposer une installation (native ou guidée).
 * @param {Window} [win]
 * @returns {boolean}
 */
export function canInstall(win = typeof window !== 'undefined' ? window : undefined) {
    if (isStandalone(win)) return false;
    return canPromptInstall() || isIos(win);
}

/**
 * Définit manuellement l'événement avant installation (principalement pour les tests).
 * @param {any} event
 */
export function setDeferredPrompt(event) {
    deferredPrompt = event;
}

/**
 * Retourne le prompt différé actuel.
 * @returns {any}
 */
export function getDeferredPrompt() {
    return deferredPrompt;
}

/**
 * Met à jour l'affichage des éléments d'installation dans le DOM.
 * @param {Document} [doc]
 */
export function updateInstallUI(doc = typeof document !== 'undefined' ? document : undefined) {
    if (!doc) return;

    const installBtn = doc.getElementById('pwa-install-btn');
    const footerLink = doc.getElementById('footer-pwa-install-link');
    const footerSeparator = doc.getElementById('footer-pwa-install-separator');

    const standalone = isStandalone();
    const available = canInstall();

    if (standalone || !available) {
        if (installBtn) installBtn.style.display = 'none';
        if (footerLink) footerLink.style.display = 'none';
        if (footerSeparator) footerSeparator.style.display = 'none';
        return;
    }

    if (installBtn) {
        installBtn.style.display = 'inline-flex';
        if (deferredPrompt) {
            installBtn.classList.add('highlight');
        } else {
            installBtn.classList.remove('highlight');
        }
    }

    if (footerLink) {
        footerLink.style.display = 'inline';
    }
    if (footerSeparator) {
        footerSeparator.style.display = 'inline';
    }
}

/**
 * Ouvre la modale d'aide à l'installation PWA.
 * @param {Document} [doc]
 */
export function openInstallModal(doc = typeof document !== 'undefined' ? document : undefined) {
    if (!doc) return;
    const modal = /** @type {HTMLDialogElement | null} */ (doc.getElementById('pwa-install-modal'));
    if (!modal) return;

    const iosSection = doc.getElementById('pwa-install-ios-instructions');
    const genericSection = doc.getElementById('pwa-install-generic-instructions');

    const onIos = isIos();
    if (iosSection) iosSection.style.display = onIos ? 'flex' : 'none';
    if (genericSection) genericSection.style.display = onIos ? 'none' : 'flex';

    if (typeof modal.showModal === 'function' && !modal.open) {
        modal.showModal();
    }
    modal.style.display = 'flex';
    void modal.offsetWidth;
    modal.classList.add('active');
}

/**
 * Ferme la modale d'aide à l'installation PWA.
 * @param {Document} [doc]
 */
export function closeInstallModal(doc = typeof document !== 'undefined' ? document : undefined) {
    if (!doc) return;
    const modal = /** @type {HTMLDialogElement | null} */ (doc.getElementById('pwa-install-modal'));
    if (!modal) return;

    modal.classList.remove('active');
    setTimeout(() => {
        if (!modal.classList.contains('active')) {
            modal.style.display = 'none';
            if (typeof modal.close === 'function' && modal.open) {
                modal.close();
            }
        }
    }, 250);
}

/**
 * Déclenche l'action d'installation :
 * - Si le prompt natif est disponible : affiche le dialogue du navigateur.
 * - Si sur iOS : affiche la modale d'accompagnement visuel.
 * - Sinon (autre navigateur sans prompt capturé) : affiche la modale avec instructions génériques.
 * @returns {Promise<{ success: boolean, outcome?: string, platform: 'native' | 'ios' | 'generic' | 'none', reason?: string }>}
 */
export async function promptInstall() {
    if (isStandalone()) {
        updateInstallUI();
        return { success: false, platform: 'none', reason: 'already_installed' };
    }

    if (deferredPrompt) {
        try {
            const promptEvent = deferredPrompt;
            deferredPrompt = null;
            updateInstallUI();

            await promptEvent.prompt();
            const choice = await promptEvent.userChoice;
            const accepted = choice?.outcome === 'accepted';
            return {
                success: accepted,
                outcome: choice?.outcome || 'unknown',
                platform: 'native',
            };
        } catch (error) {
            console.warn('[PwaInstaller] Erreur lors de prompt():', error);
            openInstallModal();
            return { success: false, outcome: 'error', platform: 'native' };
        }
    }

    if (isIos()) {
        openInstallModal();
        return { success: true, outcome: 'instructions', platform: 'ios' };
    }

    openInstallModal();
    return { success: true, outcome: 'instructions', platform: 'generic' };
}

/**
 * Initialise le service d'installation PWA et écoute les événements du navigateur.
 * @param {Window} [win]
 */
export function initPwaInstaller(win = typeof window !== 'undefined' ? window : undefined) {
    if (!win) return;
    if (isInitialized) {
        updateInstallUI(win.document);
        return;
    }
    isInitialized = true;

    try {
        win.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            updateInstallUI(win.document);
        });

        win.addEventListener('appinstalled', () => {
            deferredPrompt = null;
            updateInstallUI(win.document);
        });

        // Détection de changement de mode d'affichage
        if (win.matchMedia) {
            const media = win.matchMedia('(display-mode: standalone)');
            if (typeof media.addEventListener === 'function') {
                media.addEventListener('change', () => updateInstallUI(win.document));
            } else if (typeof media.addListener === 'function') {
                media.addListener(() => updateInstallUI(win.document));
            }
        }

        // Fermeture automatique sur clic backdrop
        const doc = win.document;
        const modal = doc?.getElementById('pwa-install-modal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closeInstallModal(doc);
                }
            });
            modal.addEventListener('cancel', (e) => {
                e.preventDefault();
                closeInstallModal(doc);
            });
        }
    } catch (e) {
        console.warn('[PwaInstaller] Erreur initialisation:', e);
    }

    updateInstallUI(win.document);
}

/**
 * Réinitialise l'état pour les tests unitaires.
 */
export function resetPwaInstallerForTests() {
    deferredPrompt = null;
    isInitialized = false;
}
