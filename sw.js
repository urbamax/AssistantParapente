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
const CACHE_NAME = 'parapente-app-v2026.10.01_v20';

// La météo ne doit jamais être servie depuis le cache : une donnée de vent vieille de
// plusieurs heures mais présentée comme "en direct" est un vrai risque sécurité pour un
// outil de volabilité. Uniquement du network-only pour ce domaine, jamais de fallback cache.
const WEATHER_API_HOSTNAME = 'api.open-meteo.com';

// Caches « d'usage » conservés d'une version de l'application à l'autre (spec 008) : seulement ce
// que le pilote a réellement ouvert ou affiché, jamais de téléchargement d'avance.
const COURSE_CACHE = 'parapente-courses-v1'; // cours (PDF) déjà ouverts
const TILE_CACHE = 'parapente-tiles-v1'; // zones de carte déjà affichées
const TILE_CACHE_MAX = 1500; // ≈ 35 Mo à ≈ 23 Ko par morceau ; les plus anciens partent d'abord
const TILE_HOSTNAME = 'server.arcgisonline.com';
const RUNTIME_CACHES = [COURSE_CACHE, TILE_CACHE];

// --- Firebase Cloud Messaging : réception des alertes météo en arrière-plan (app fermée) ---
// importScripts (et non `import`) car ce SW est un script classique, pas un module worker.
// Le SDK est hébergé par l'application (spec 013) : un service worker ne peut pas savoir si le
// visiteur a consenti, et il chargeait auparavant le SDK depuis le CDN de Google pour tout le
// monde. Depuis l'application, aucun serveur tiers n'est contacté ; le SDK n'appelle Google que
// lorsque la page demande un jeton d'alerte, après consentement. Même version que
// FIREBASE_VERSION dans js/services/firebase_service.js (vérifié par tests/core/firebase_sdk.test.js).
// Volontairement protégé par try/catch : un échec de chargement ne doit jamais empêcher le reste
// du SW — cache offline et navigation — de fonctionner.
const FIREBASE_SDK_DIR = './vendor/firebase-12.19.0/';
try {
    importScripts('./js/firebase_config.js');
    importScripts(`${FIREBASE_SDK_DIR}firebase-app-compat.js`, `${FIREBASE_SDK_DIR}firebase-messaging-compat.js`);

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
    './css/fonts.css',
    './vendor/inter/inter-latin.woff2',
    './vendor/remixicon-3.5.0/remixicon.css',
    './vendor/remixicon-3.5.0/remixicon.woff2',
    './vendor/leaflet-1.9.4/leaflet.css',
    './vendor/leaflet-1.9.4/leaflet.js',
    './vendor/firebase-12.19.0/firebase-app.js',
    './vendor/firebase-12.19.0/firebase-auth.js',
    './vendor/firebase-12.19.0/firebase-firestore.js',
    './vendor/firebase-12.19.0/firebase-messaging.js',
    './vendor/firebase-12.19.0/firebase-app-compat.js',
    './vendor/firebase-12.19.0/firebase-messaging-compat.js',
    './img/logos/club-fil-ariane.png',
    './img/logos/ffvl.png',
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
    './css/safety.css',
    './js/core/app_state.js',
    './js/core/app_update.js',
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
    './js/services/idb_storage.js',
    './js/services/quiz_voice.js',
    './js/services/voice_service.js',
    './js/i18n/fr.js',
    './js/utils/array_utils.js',
    './js/utils/date_utils.js',
    './js/utils/geo_utils.js',
    './js/utils/i18n.js',
    './js/utils/math_utils.js',
    './js/utils/text_utils.js',
    './js/views/logbook.js',
    './js/views/manual.js',
    './js/views/quiz.js',
    './js/views/sites.js',
    './js/views/welcome.js',
    './js/views/safety.js',
    './js/components/map_3d.js',
    './js/data/sites_data.json',
    './js/data/courses_data.js',
    './js/data/equipment_config.js',
    './js/data/spotair_widgets.js',
    './js/data/weather_config.js',
    './js/data/qcm_ffvl.csv',
    './js/data/qcm_ffvl_explanations.csv',
    './js/data/question_course_mapping.json',
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
        (async () => {
            // Navigation Preload : amorce la requête réseau en parallèle du démarrage du SW
            if (self.registration.navigationPreload) {
                try {
                    await self.registration.navigationPreload.enable();
                } catch (e) {
                    console.warn('[SW] Navigation Preload indisponible :', e.message);
                }
            }
            const cacheNames = await caches.keys();
            await Promise.all(
                cacheNames.map((name) =>
                    name !== CACHE_NAME && !RUNTIME_CACHES.includes(name) ? caches.delete(name) : null,
                ),
            );
            await self.clients.claim();
        })(),
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return; // laisser passer POST/PUT/DELETE sans interception

    const url = new URL(request.url);

    // Numéro de version du site (bannière « Mettre à jour ») : toujours le réseau, jamais le cache
    if (url.origin === location.origin && url.pathname.endsWith('/version.json')) {
        event.respondWith(fetch(request, { cache: 'no-store' }));
        return;
    }

    if (url.hostname === WEATHER_API_HOSTNAME) {
        event.respondWith(fetch(request));
        return;
    }

    // Cours (PDF) : réseau d'abord ; le document complet est gardé dès qu'il a été ouvert, et servi
    // hors ligne (y compris pour une demande partielle « Range » du lecteur). Jamais index.html à la
    // place d'un PDF : sans copie, erreur réseau normale du navigateur (spec 008, FR-001–FR-003).
    if (url.origin === location.origin && /\.pdf$/i.test(url.pathname)) {
        event.respondWith(serveCourse(event, request, url));
        return;
    }
    // Autres demandes partielles du même site : laissées au navigateur.
    if (url.origin === location.origin && request.headers.has('range')) return;

    // Morceaux de fond de carte : cache d'abord, dans le cache des zones affichées (spec 008).
    if (url.hostname === TILE_HOSTNAME) {
        event.respondWith(serveTile(request));
        return;
    }

    // Navigation (chargement de page) : network-first, pour qu'un déploiement soit visible
    // dès le prochain chargement avec réseau, avec repli sur le HTML en cache si hors-ligne.
    // Uniquement pour le shell de l'app ("/" et "/index.html", les routes passent par ?mode=) :
    // toute autre navigation est laissée au navigateur, sans repli trompeur sur index.html.
    if (request.mode === 'navigate') {
        const isAppShell =
            url.origin === location.origin && (url.pathname === '/' || url.pathname.endsWith('/index.html'));
        if (!isAppShell) return;
        event.respondWith(
            (async () => {
                try {
                    // Utilise la réponse préchargée en parallèle si disponible
                    const preloadResponse = await event.preloadResponse;
                    if (preloadResponse) {
                        const copy = preloadResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                        return preloadResponse;
                    }
                    const response = await fetch(request);
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                    return response;
                } catch {
                    const cached = await caches.match(request);
                    return cached || (await caches.match('./index.html'));
                }
            })(),
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

    // Sur localhost / 127.0.0.1 (développement local) : toujours network-first pour éviter tout
    // déphasage de cache entre modules ES lors des modifications locales. `cache: 'no-cache'` force
    // aussi la revalidation auprès du serveur : sans lui, le cache HTTP du navigateur (Safari, avec
    // un serveur local sans Cache-Control) pouvait resservir un ancien module importé par un module
    // à jour (« Importing binding name 'shuffled' is not found »).
    const isDev = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    const key = dataKey(request, url);
    if (isDev) {
        event.respondWith(
            fetch(request, { cache: 'no-cache' })
                .then((response) => {
                    if (response.ok) {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(key, copy));
                    }
                    return response;
                })
                .catch(() => caches.match(key)),
        );
        return;
    }

    // Fichiers du site (production) : réseau d'abord, cache seulement hors ligne. En cache d'abord,
    // un site servi depuis les sources (nom de cache inchangé d'une version à l'autre) affichait
    // l'ancienne version jusqu'au deuxième rechargement. `cache: 'no-cache'` fait revalider le
    // cache HTTP du navigateur (réponse 304 légère si rien n'a changé). Réseau trop lent (> 4 s) :
    // la copie en cache est servie, la réponse réseau la remplace pour la prochaine fois.
    event.respondWith(
        (async () => {
            const cached = await caches.match(key);
            const network = fetch(request, { cache: 'no-cache' }).then((response) => {
                if (response.ok) {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(key, copy));
                }
                return response;
            });
            if (!cached) return network;
            const slow = new Promise((resolve) => setTimeout(() => resolve(cached), 4000));
            return Promise.race([network, slow]).catch(() => cached);
        })(),
    );
});

/**
 * Clé de cache d'une requête du site. Les fichiers de données (questions du QCM, sites…) sont
 * demandés avec « ?v=<heure> » pour contourner le cache HTTP du navigateur : chaque visite a une
 * adresse différente, que le cache ne retrouvait jamais hors ligne (QCM vide sans réseau). Pour
 * eux, la clé est l'adresse sans cette suite, celle sous laquelle l'installation les a rangés.
 */
function dataKey(request, url) {
    return url.origin === location.origin && url.pathname.includes('/js/data/')
        ? `${url.origin}${url.pathname}`
        : request;
}

/** Clé de cache d'un cours : l'adresse sans l'ancre (#page=N), commune aux ouvertures complètes et partielles. */
function courseKey(url) {
    return `${url.origin}${url.pathname}`;
}

async function serveCourse(event, request, url) {
    const cache = await caches.open(COURSE_CACHE);
    const key = courseKey(url);
    try {
        const response = await fetch(request);
        if (response.status === 200) {
            cache.put(key, response.clone()).catch(() => {});
        } else if (response.status === 206) {
            // Le lecteur ne demande que des morceaux : on garde une fois le document entier.
            event.waitUntil(
                (async () => {
                    if (await cache.match(key)) return;
                    const full = await fetch(key);
                    if (full.status === 200) await cache.put(key, full);
                })().catch(() => {}),
            );
        }
        return response;
    } catch {
        const cached = await cache.match(key);
        return cached || Response.error();
    }
}

async function serveTile(request) {
    const cache = await caches.open(TILE_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    // Seules les réponses lisibles (CORS) sont gardées : une réponse « opaque » occupe beaucoup
    // de place et ne peut pas être vérifiée.
    if (response.ok && response.type !== 'opaque') {
        await cache.put(request, response.clone());
        trimCache(cache, TILE_CACHE_MAX);
    }
    return response;
}

/** Limite le nombre d'entrées : les plus anciennes (ordre d'insertion) sont retirées d'abord. */
async function trimCache(cache, max) {
    const keys = await cache.keys();
    for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}
