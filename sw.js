// Service Worker de cache offline — réactivation prudente après le kill-switch précédent
// (voir git history) : un ancien SW gardait les utilisateurs bloqués sur une version figée
// même après un hard refresh. Root cause identifiée : cache.addAll() pendant install()
// piochait parfois une réponse déjà présente dans le cache HTTP classique du navigateur
// (pas la CacheStorage du SW), donc une nouvelle version de SW pouvait re-cacher
// indéfiniment le même HTML/JS périmé. Deux garde-fous pour ne pas reproduire ce bug :
//   1. Chaque asset critique est fetché avec {cache: 'reload'} pendant l'install (contourne
//      explicitement le cache HTTP du navigateur, pas seulement la CacheStorage).
//   2. CACHE_NAME est versionné (synchronisé par bump.py avec le ?v= du reste du site) et
//      activate() supprime systématiquement tout cache dont le nom ne correspond pas à la
//      version courante.
const CACHE_NAME = 'parapente-app-v2026.09.20_v1';

// La météo ne doit jamais être servie depuis le cache : une donnée de vent vieille de
// plusieurs heures mais présentée comme "en direct" est un vrai risque sécurité pour un
// outil de volabilité. Uniquement du network-only pour ce domaine, jamais de fallback cache.
const WEATHER_API_HOSTNAME = 'api.open-meteo.com';

// --- Firebase Cloud Messaging : réception des alertes météo en arrière-plan (app fermée) ---
// importScripts (et non `import`) car ce SW est un script classique, pas un module worker.
// Volontairement protégé par try/catch : un échec de chargement (offline à l'installation,
// FCM_VAPID_KEY absent côté client, etc.) ne doit jamais empêcher le reste du SW — cache
// offline et navigation — de fonctionner.
try {
    importScripts('./firebase_config.js');
    importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
    importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

    if (
        typeof firebase !== 'undefined' &&
        typeof FIREBASE_CONFIG !== 'undefined' &&
        typeof IS_FIREBASE_ENABLED !== 'undefined' &&
        IS_FIREBASE_ENABLED
    ) {
        firebase.initializeApp(FIREBASE_CONFIG);
        const messaging = firebase.messaging();

        // Déclenché uniquement quand l'app n'a pas le focus (onglet fermé/en arrière-plan) —
        // au premier plan, la notification est gérée par le SDK côté client si besoin.
        messaging.onBackgroundMessage((payload) => {
            const title = (payload.notification && payload.notification.title) || 'Assistant Parapente';
            const options = {
                body: (payload.notification && payload.notification.body) || '',
                icon: './img/icons/icon-192x192.png',
                badge: './img/icons/icon-192x192.png',
            };
            self.registration.showNotification(title, options);
        });
    }
} catch (e) {
    console.warn('[SW] Firebase Cloud Messaging indisponible (ignoré) :', e.message);
}

const CRITICAL_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './css/base.css',
    './css/components.css',
    './css/header.css',
    './css/footer.css',
    './css/quiz.css',
    './css/library.css',
    './css/sites.css',
    './css/auth.css',
    './css/gdpr.css',
    './css/logbook.css',
    './css/welcome.css',
    './js/core/app_state.js',
    './js/core/base_view.js',
    './js/core/events.js',
    './js/core/main.js',
    './js/core/router.js',
    './js/core/security.js',
    './js/core/start_mode.js',
    './js/core/ui_manager.js',
    './js/services/firebase_service.js',
    './js/services/igc_parser.js',
    './js/services/logbook_service.js',
    './js/services/quiz_service.js',
    './js/services/sites_service.js',
    './js/services/storage.js',
    './js/utils/date_utils.js',
    './js/utils/geo_utils.js',
    './js/utils/math_utils.js',
    './js/utils/text_utils.js',
    './js/views/logbook.js',
    './js/views/manual.js',
    './js/views/quiz.js',
    './js/views/sites.js',
    './js/views/welcome.js',
    './js/components/map_3d.js',
    './js/data/sites_data.json',
    './js/data/courses_data.js',
    './js/data/equipment_config.js',
    './js/data/spotair_widgets.js',
    './js/data/weather_config.js',
    './js/data/qcm_ffvl.csv',
    './js/data/qcm_ffvl_explanations.csv',
    './js/weatherScoring.js',
    './js/gdpr_engine.js',
    './js/firebase_config.js',
    './img/logo.png',
    './img/icons/icon-192x192.png',
    './img/icons/icon-512x512.png',
];

async function precacheWithFreshNetwork(cache) {
    await Promise.all(
        CRITICAL_ASSETS.map(async (url) => {
            try {
                const response = await fetch(url, { cache: 'reload' });
                if (response.ok) await cache.put(url, response);
            } catch (e) {
                // Un asset manquant/injoignable ne doit pas bloquer l'installation des autres.
                console.warn('[SW] Pré-cache ignoré (échec) :', url, e.message);
            }
        }),
    );
}

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE_NAME).then(precacheWithFreshNetwork));
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((cacheNames) =>
                Promise.all(cacheNames.map((name) => (name !== CACHE_NAME ? caches.delete(name) : null))),
            )
            .then(() => self.clients.claim()),
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return; // laisser passer POST/PUT/DELETE sans interception

    const url = new URL(request.url);

    if (url.hostname === WEATHER_API_HOSTNAME) {
        event.respondWith(fetch(request));
        return;
    }

    // Les PDF de cours (plusieurs Mo, lus par Range par les lecteurs PDF) ne doivent jamais passer
    // par le SW : le navigateur les gère mieux seul, et un échec ici retombait sur index.html servi
    // à l'URL du PDF (app affichée sans CSS, les chemins relatifs ne se résolvant plus).
    if (url.origin === location.origin && (/\.pdf$/i.test(url.pathname) || request.headers.has('range'))) return;

    // Navigation (chargement de page) : network-first, pour qu'un déploiement soit visible
    // dès le prochain chargement avec réseau, avec repli sur le HTML en cache si hors-ligne.
    // Uniquement pour le shell de l'app ("/" et "/index.html", les routes passent par ?mode=) :
    // toute autre navigation est laissée au navigateur, sans repli trompeur sur index.html.
    if (request.mode === 'navigate') {
        const isAppShell =
            url.origin === location.origin && (url.pathname === '/' || url.pathname.endsWith('/index.html'));
        if (!isAppShell) return;
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                    return response;
                })
                .catch(() => caches.match(request).then((cached) => cached || caches.match('./index.html'))),
        );
        return;
    }

    if (url.origin !== location.origin) {
        // Tuiles de carte et autres ressources tierces (CDN) : cache-first pour l'usage
        // hors-ligne des sites déjà consultés, avec mise à jour opportuniste en cache.
        event.respondWith(
            caches.match(request).then((cached) => {
                if (cached) return cached;
                return fetch(request)
                    .then((response) => {
                        if (response.ok) {
                            const copy = response.clone();
                            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                        }
                        return response;
                    })
                    .catch(() => cached);
            }),
        );
        return;
    }

    // Assets statiques same-origin : cache-first avec revalidation réseau en arrière-plan.
    // Si rien n'est en cache ET que le réseau échoue, on ne doit jamais résoudre respondWith()
    // avec `undefined` (le navigateur remonte alors un opaque net::ERR_FAILED, y compris pour
    // du CSS/JS critique — c'est ce qui a cassé la mise en page en local) : on retombe sur un
    // second essai réseau direct pour laisser passer la vraie erreur si celle-ci persiste.
    event.respondWith(
        caches.match(request).then((cached) => {
            const networkFetch = fetch(request)
                .then((response) => {
                    if (response.ok) {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                    }
                    return response;
                })
                .catch(() => cached || fetch(request));
            return cached || networkFetch;
        }),
    );
});
