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
 * Maintenance : functions/sites_data.json est une COPIE de js/data/sites_data.json (les
 * Cloud Functions ne peuvent pas lire les fichiers du site web directement). Si la base de
 * sites est mise à jour, recopier le fichier avant de redéployer.
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const sitesData = require('./sites_data.json');

admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();

const sitesById = new Map(sitesData.map((s) => [s.id, s]));

const DEFAULT_PREFS = { limitWindMin: 0, limitWindMax: 25, limitGustDelta: 10 };

function degreesToCardinal(deg) {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
    const norm = ((deg % 360) + 360) % 360;
    return dirs[Math.round(norm / 45) % 8];
}

// Version simplifiée de js/weatherScoring.js:evaluateSpotForecast, portée en Node. Ne garde
// que les verrous binaires flyable/non-flyable (pas le score fin ni le mode "matériel") —
// suffisant pour détecter une transition "devient volable" et déclencher une notification.
function isFlyable(site, weather, prefs) {
    if (!weather || !weather.isDaytime) return false;
    if ((weather.precipitation ?? 0) > 0) return false;
    if (weather.windSpeed < prefs.limitWindMin || weather.windSpeed > prefs.limitWindMax) return false;

    const gust = Math.max(weather.windGust || 0, weather.windSpeed);
    if ((gust - weather.windSpeed) > prefs.limitGustDelta) return false;

    let orientations = [];
    if (Array.isArray(site.orientations_vent)) orientations = site.orientations_vent;
    else if (typeof site.orientations_vent === 'string') orientations = site.orientations_vent.split(',').map((v) => v.trim());
    else if (typeof site.orientation === 'string') orientations = site.orientation.split(',').map((v) => v.trim());
    if (orientations.length > 0 && !orientations.includes(weather.windCard)) return false;

    return true;
}

async function fetchWeatherForSite(site) {
    const lat = parseFloat(site.latitude || site.lat);
    const lon = parseFloat(site.longitude || site.lon);
    if (isNaN(lat) || isNaN(lon)) return null;

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation&daily=sunrise,sunset&timezone=Europe%2FParis&forecast_days=1`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
    const data = await res.json();

    const hourly = data.hourly;
    const now = Date.now();
    let idx = 0;
    let minDiff = Infinity;
    hourly.time.forEach((t, i) => {
        const diff = Math.abs(new Date(t).getTime() - now);
        if (diff < minDiff) { minDiff = diff; idx = i; }
    });

    let isDaytime = true;
    if (data.daily && data.daily.sunrise && data.daily.sunset) {
        const sunrise = new Date(data.daily.sunrise[0]).getTime();
        const sunset = new Date(data.daily.sunset[0]).getTime();
        // Même marge de 30 min avant lever/après coucher que côté client (sites_service.js).
        isDaytime = now >= sunrise - 30 * 60 * 1000 && now <= sunset - 30 * 60 * 1000;
    }

    return {
        windSpeed: Math.round(hourly.wind_speed_10m[idx]),
        windGust: Math.round(hourly.wind_gusts_10m[idx]),
        windCard: degreesToCardinal(hourly.wind_direction_10m[idx]),
        precipitation: hourly.precipitation ? (hourly.precipitation[idx] ?? 0) : 0,
        isDaytime
    };
}

exports.checkFavoriteSitesWeather = onSchedule('every 30 minutes', async () => {
    const usersSnap = await db.collection('users').get();

    for (const userDoc of usersSnap.docs) {
        const user = userDoc.data();
        if (!user.fcmToken) continue;

        const prefsSnap = await db.collection('users').doc(userDoc.id).collection('preferences').doc('user_prefs').get();
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
                const weather = await fetchWeatherForSite(site);
                const flyable = isFlyable(site, weather, prefs);
                newState[siteId] = flyable;

                // Notification uniquement sur la transition non-volable -> volable, jamais à
                // chaque exécution tant que ça reste volable (sinon spam toutes les 30 min).
                if (flyable && previousState[siteId] === false && weather) {
                    await messaging.send({
                        token: user.fcmToken,
                        notification: {
                            title: `${site.nom || site.name || 'Site favori'} est volable !`,
                            body: `Vent ${weather.windSpeed} km/h (${weather.windCard}), conditions favorables maintenant.`
                        }
                    }).catch((err) => console.error(`Échec envoi push (${userDoc.id}/${siteId}):`, err.message));
                }
            } catch (e) {
                console.error(`Erreur météo pour le site ${siteId} (utilisateur ${userDoc.id}):`, e.message);
            }
        }

        await stateRef.set(newState);
    }
});
