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

// Calcul météo partagé avec l'application (spec 001, US4) : functions/shared/ est une copie
// générée de js/weatherScoring.js (scripts/sync_functions_shared.mjs, lancé avant chaque
// déploiement). Modules ES chargés à la demande depuis ce fichier CommonJS.
let sharedModules = null;
async function loadShared() {
    if (!sharedModules) {
        const [scoring, evaluate, runner] = await Promise.all([
            import('./shared/weatherScoring.mjs'),
            import('./evaluate.mjs'),
            import('./runner.mjs'),
        ]);
        sharedModules = {
            evaluateSpotForecast: scoring.evaluateSpotForecast,
            runCheckFavoriteSitesWeather: runner.runCheckFavoriteSitesWeather,
            ...evaluate,
        };
    }
    return sharedModules;
}

exports.checkFavoriteSitesWeather = onSchedule(
    { schedule: 'every 30 minutes', timeoutSeconds: 300, memory: '512MiB' },
    async () => {
        const shared = await loadShared();
        const { weatherRequests, userCount } = await shared.runCheckFavoriteSitesWeather({
            db,
            messaging,
            fieldValueDelete: () => admin.firestore.FieldValue.delete(),
            sitesById,
            shared,
        });
        console.log(`Météo des favoris : ${weatherRequests} site(s) interrogé(s) pour ${userCount} utilisateur(s).`);
    },
);
