/**
 * CORE - App Update Notifier
 * sw.js s'active seul (skipWaiting + clients.claim) mais la page ouverte continue de
 * tourner avec l'ancien JS en mémoire. On détecte la prise de contrôle d'un nouveau SW et
 * on propose à l'utilisateur de recharger, sans jamais le faire d'office (quiz en cours,
 * saisie de carnet de vol...).
 */

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

// version.json change à chaque modification du dépôt (écrit par le build pour dist/, ou par le
// hook git du serveur pour un site servi depuis les sources : scripts/install_update_hook.sh).
// Vérifié souvent : c'est un tout petit fichier, jamais mis en cache.
const VERSION_URL = './version.json';
const VERSION_CHECK_INTERVAL_MS = 5 * 60 * 1000;
// Caches de l'application à vider pour que « Mettre à jour » charge vraiment les nouveaux
// fichiers (les caches d'usage — cours ouverts, fonds de carte — sont gardés).
const APP_CACHE_PREFIX = 'parapente-app-';

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
        if (typeof caches !== 'undefined') {
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
    banner.setAttribute('role', 'status');

    const label = document.createElement('span');
    label.textContent = 'Nouvelle version disponible';

    const reloadBtn = document.createElement('button');
    reloadBtn.type = 'button';
    reloadBtn.className = 'app-update-reload';
    reloadBtn.textContent = 'Mettre à jour';
    reloadBtn.addEventListener('click', () => reloadWithFreshFiles());

    const dismissBtn = document.createElement('button');
    dismissBtn.type = 'button';
    dismissBtn.className = 'app-update-dismiss';
    dismissBtn.setAttribute('aria-label', 'Plus tard');
    dismissBtn.textContent = '×';
    dismissBtn.addEventListener('click', () => banner.remove());

    banner.append(label, reloadBtn, dismissBtn);
    document.body.appendChild(banner);
}

/**
 * Affiche la bannière dès que version.json annonce une autre version que celle chargée.
 * @returns {Promise<() => Promise<void>>} la vérification (exportée pour les tests)
 */
export async function watchSiteVersion({ intervalMs = VERSION_CHECK_INTERVAL_MS } = {}) {
    const loaded = await fetchVersion();
    let shown = false;
    const check = async () => {
        if (shown || !loaded) return;
        const current = await fetchVersion();
        if (current && current !== loaded) {
            shown = true;
            showUpdateBanner();
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
        showUpdateBanner();
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
