/**
 * CORE - App Update Notifier
 * sw.js s'active seul (skipWaiting + clients.claim) mais la page ouverte continue de
 * tourner avec l'ancien JS en mémoire. On détecte la prise de contrôle d'un nouveau SW et
 * on propose à l'utilisateur de recharger, sans jamais le faire d'office (quiz en cours,
 * saisie de carnet de vol...).
 */

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

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
    reloadBtn.addEventListener('click', () => window.location.reload());

    const dismissBtn = document.createElement('button');
    dismissBtn.type = 'button';
    dismissBtn.className = 'app-update-dismiss';
    dismissBtn.setAttribute('aria-label', 'Plus tard');
    dismissBtn.textContent = '×';
    dismissBtn.addEventListener('click', () => banner.remove());

    banner.append(label, reloadBtn, dismissBtn);
    document.body.appendChild(banner);
}

export function initAppUpdateNotifier(registrationPromise) {
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
