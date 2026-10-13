/**
 * Cloud Function planifiée : évalue la météo des sites favoris de chaque utilisateur et
 * envoie une notification push (FCM) quand un site passe de non-volable à volable.
 *
 * Ne tourne QUE côté serveur (Firebase). Le client (js/services/firebase_service.js,
 * enablePushNotifications) se contente de récupérer un token FCM et de l'enregistrer dans
 * Firestore ; c'est cette fonction qui décide QUAND envoyer une notification.
 *
 * Prérequis avant déploiement (voir DOCUMENTATION.md / checklist livrée avec cette phase) :
 *   - Passer le projet Firebase au plan Blaze (requis pour les Cloud Functions planifiées).
 *   - Activer Cloud Messaging + générer une clé VAPID dans la console Firebase, et la coller
 *     dans js/firebase_config.js (FCM_VAPID_KEY).
 *   - `firebase deploy --only functions` depuis la racine du projet (dossier functions/).
 *
 * Maintenance : functions/sites_data.json et functions/shared/ sont des COPIES générées de
 * js/ (les Cloud Functions ne peuvent pas lire les fichiers du site web). Elles sont
 * régénérées avant chaque déploiement (predeploy dans firebase.json) ou via
 * `npm run sync:functions` ; tests/functions/shared_copy.test.js vérifie qu'elles sont à jour.
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const sitesData = require('./sites_data.json');

admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();

const sitesById = new Map(sitesData.map((s) => [s.id, s]));

const DEFAULT_PREFS = { limitWindMin: 0, limitWindMax: 25, limitGustDelta: 10 };

// Calcul météo partagé avec l'application (spec 001, US4) : functions/shared/ est une copie
// générée de js/weatherScoring.js (scripts/sync_functions_shared.mjs, lancé avant chaque
// déploiement). Modules ES chargés à la demande depuis ce fichier CommonJS.
let sharedModules = null;
async function loadShared() {
    if (!sharedModules) {
        const [scoring, evaluate] = await Promise.all([
            import('./shared/weatherScoring.mjs'),
            import('./evaluate.mjs'),
        ]);
        sharedModules = { evaluateSpotForecast: scoring.evaluateSpotForecast, ...evaluate };
    }
    return sharedModules;
}

async function fetchWeatherForSite(site, { forecastUrl, buildHourlyForecast }) {
    const lat = parseFloat(site.latitude || site.lat);
    const lon = parseFloat(site.longitude || site.lon);
    if (isNaN(lat) || isNaN(lon)) return null;

    const res = await fetch(forecastUrl(lat, lon));
    if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
    return buildHourlyForecast(await res.json(), Date.now());
}

exports.checkFavoriteSitesWeather = onSchedule('every 30 minutes', async () => {
    const shared = await loadShared();
    // Une seule requête Open-Meteo par site et par exécution, même si plusieurs pilotes l'ont en favori.
    const weatherCache = shared.createSiteWeatherCache((site) => fetchWeatherForSite(site, shared));
    const usersSnap = await db.collection('users').get();

    for (const userDoc of usersSnap.docs) {
        const user = userDoc.data();
        if (!user.fcmToken) continue;

        const prefsSnap = await db
            .collection('users')
            .doc(userDoc.id)
            .collection('preferences')
            .doc('user_prefs')
            .get();
        const prefs = { ...DEFAULT_PREFS, ...(prefsSnap.exists ? prefsSnap.data() : {}) };
        const favoriteIds = prefs.favoriteSites || [];
        if (favoriteIds.length === 0) continue;

        const stateRef = db.collection('users').doc(userDoc.id).collection('pushState').doc('favoriteSitesFlyable');
        const stateSnap = await stateRef.get();
        const previousState = stateSnap.exists ? stateSnap.data() : {};
        const newState = {};

        for (const siteId of favoriteIds) {
            const site = sitesById.get(siteId);
            if (!site) continue;

            try {
                const weather = await weatherCache.get(siteId, site);
                const outcome = shared.evaluateSpotForecast(site, weather, shared.toScoringPrefs(prefs));
                newState[siteId] = shared.nextState(previousState[siteId], outcome);

                // Notification uniquement sur la transition non-volable -> volable, avec des données
                // complètes et une orientation connue (spec 001, FR-011) ; jamais à chaque exécution
                // tant que ça reste volable (sinon spam toutes les 30 min).
                if (shared.shouldNotify(previousState[siteId], outcome)) {
                    await messaging
                        .send({
                            token: user.fcmToken,
                            // Informe sans autoriser : ni « volable », ni certitude (spec 005, audit A3).
                            notification: shared.buildNotification(site, weather, weather.timeMs),
                        })
                        .catch((err) => console.error(`Échec envoi push (${userDoc.id}/${siteId}):`, err.message));
                }
            } catch (e) {
                console.error(`Erreur météo pour le site ${siteId} (utilisateur ${userDoc.id}):`, e.message);
                // Erreur réseau : on garde le dernier état connu plutôt que de l'effacer.
                if (previousState[siteId] !== undefined) newState[siteId] = previousState[siteId];
            }
        }

        await stateRef.set(newState);
    }

    console.log(
        `Météo des favoris : ${weatherCache.requests} site(s) interrogé(s) pour ${usersSnap.size} utilisateur(s).`,
    );
});
