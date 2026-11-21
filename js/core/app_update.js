/**
 * CORE - App Update Notifier
 * sw.js s'active seul (skipWaiting + clients.claim) mais la page ouverte continue de
 * tourner avec l'ancien JS en mémoire. On détecte la prise de contrôle d'un nouveau SW et
 * on demande à l'utilisateur de recharger. L'écran de mise à jour bloque l'application, mais il
 * attend que le pilote ait fini ce qu'il fait (série de questions ou examen en cours, saisie
 * d'un vol) : sinon le rechargement lui ferait perdre son examen ou sa saisie.
 */
import { t } from '../utils/i18n.js';

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

// version.json change à chaque modification du dépôt (écrit par le build pour dist/, ou par le
// hook git du serveur pour un site servi depuis les sources : scripts/install_update_hook.sh).
// Vérifié souvent : c'est un tout petit fichier, jamais mis en cache.
const VERSION_URL = './version.json';
const VERSION_CHECK_INTERVAL_MS = 5 * 60 * 1000;
// Caches de l'application à vider pour que « Mettre à jour » charge vraiment les nouveaux
// fichiers (les caches d'usage — cours ouverts, fonds de carte — sont gardés).
const APP_CACHE_PREFIX = 'parapente-app-';

// Pendant ces activités, l'écran de mise à jour attend : un rechargement les perdrait.
const BUSY_CHECKS = [
    // Une série de questions (entraînement, révision, examen blanc) est affichée.
    () => Boolean(document.getElementById('qcm-screen')?.classList.contains('active')),
    // Le formulaire d'un vol ou d'une session du carnet est ouvert.
    () => isShown(document.getElementById('lb-site')),
];
const BUSY_RECHECK_MS = 15 * 1000;

/** @param {HTMLElement | null} el */
function isShown(el) {
    return Boolean(el && el.isConnected && el.getClientRects().length > 0);
}

/** Vrai si le pilote est en train de faire quelque chose qu'un rechargement lui ferait perdre. */
export function isUserBusy() {
    return BUSY_CHECKS.some((check) => {
        try {
            return check();
        } catch {
            return false;
        }
    });
}

let pendingUpdateTimer = null;

/**
 * Montre l'écran de mise à jour dès que le pilote n'est plus occupé (revérifié toutes les 15 s
 * et à chaque retour sur l'onglet).
 */
function requestUpdateBanner() {
    if (document.getElementById('app-update-banner') || pendingUpdateTimer) return;
    const tryShow = () => {
        if (isUserBusy()) return false;
        if (pendingUpdateTimer) {
            clearInterval(pendingUpdateTimer);
            pendingUpdateTimer = null;
        }
        showUpdateBanner();
        return true;
    };
    if (tryShow()) return;
    pendingUpdateTimer = setInterval(tryShow, BUSY_RECHECK_MS);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && pendingUpdateTimer) tryShow();
    });
}

async function fetchVersion() {
    try {
        const res = await fetch(`${VERSION_URL}?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return null;
        const data = await res.json();
        return data && typeof data.version === 'string' ? data.version : null;
    } catch {
        return null; // hors ligne, ou site sans version.json : pas de bannière
    }
}

async function reloadWithFreshFiles() {
    try {
        if (typeof caches !== 'undefined' && navigator.onLine !== false) {
            const keys = await caches.keys();
            await Promise.all(keys.filter((k) => k.startsWith(APP_CACHE_PREFIX)).map((k) => caches.delete(k)));
        }
        const reg = navigator.serviceWorker && (await navigator.serviceWorker.getRegistration());
        if (reg) await reg.update().catch(() => {});
    } catch {
        // le rechargement se fait quand même
    }
    window.location.reload();
}

function showUpdateBanner() {
    if (document.getElementById('app-update-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'app-update-banner';
    banner.setAttribute('role', 'alertdialog');
    banner.setAttribute('aria-modal', 'true');
    banner.setAttribute('aria-label', t('update.reload'));

    const reloadBtn = document.createElement('button');
    reloadBtn.type = 'button';
    reloadBtn.className = 'app-update-reload';
    reloadBtn.textContent = t('update.reload');
    reloadBtn.addEventListener('click', () => reloadWithFreshFiles());

    banner.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            reloadBtn.focus();
        }
    });

    banner.append(reloadBtn);
    document.getElementById('app-header')?.setAttribute('inert', '');
    document.getElementById('app-main')?.setAttribute('inert', '');
    document.body.appendChild(banner);
    reloadBtn.focus();
}

/**
 * Affiche la bannière dès que version.json annonce une autre version que celle chargée.
 * @returns {Promise<() => Promise<void>>} la vérification (exportée pour les tests)
 */
export async function watchSiteVersion({ intervalMs = VERSION_CHECK_INTERVAL_MS } = {}) {
    const loaded = await fetchVersion();
    if (loaded && typeof document !== 'undefined' && document.documentElement) {
        document.documentElement.dataset.appVersion = loaded;
    }
    let shown = false;
    const check = async () => {
        if (shown || !loaded) return;
        const current = await fetchVersion();
        if (current && current !== loaded) {
            shown = true;
            requestUpdateBanner();
        }
    };
    if (loaded) {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') check();
        });
        if (intervalMs > 0) setInterval(check, intervalMs);
    }
    return check;
}

/** Remet à zéro l'attente de l'écran de mise à jour (tests). */
export function _resetUpdateBannerForTesting() {
    if (pendingUpdateTimer) clearInterval(pendingUpdateTimer);
    pendingUpdateTimer = null;
}

export function initAppUpdateNotifier(registrationPromise) {
    watchSiteVersion();
    if (!('serviceWorker' in navigator)) return;

    // Sans contrôleur à l'ouverture, le premier controllerchange est la toute première
    // installation du SW, pas une mise à jour : pas de bannière.
    const hadController = !!navigator.serviceWorker.controller;
    let bannerShown = false;

    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController || bannerShown) return;
        bannerShown = true;
        requestUpdateBanner();
    });

    // Une PWA peut rester ouverte des jours : on force la vérification de sw.js au retour
    // au premier plan et toutes les heures, en plus du contrôle natif du navigateur.
    registrationPromise
        .then((reg) => {
            if (!reg) return;
            const check = () => reg.update().catch(() => {});
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') check();
            });
            setInterval(check, UPDATE_CHECK_INTERVAL_MS);
        })
        .catch(() => {});
}
