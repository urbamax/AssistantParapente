/**
 * Orchestration pure (sans dépendance Firebase SDK) de la Cloud Function
 * `checkFavoriteSitesWeather` : testable directement sous Vitest.
 */

export const DEFAULT_PREFS = { limitWindMin: 0, limitWindMax: 25, limitGustDelta: 10 };

export const DEAD_FCM_ERROR_CODES = new Set([
    'messaging/registration-token-not-registered',
    'messaging/invalid-registration-token',
]);

async function fetchWeatherForSite(site, { forecastUrl, buildHourlyForecast }, fetchImpl) {
    const lat = parseFloat(site.latitude || site.lat);
    const lon = parseFloat(site.longitude || site.lon);
    if (isNaN(lat) || isNaN(lon)) return null;

    const res = await fetchImpl(forecastUrl(lat, lon), { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
    return buildHourlyForecast(await res.json(), Date.now());
}

/**
 * Exécute une passe d'évaluation météo + envoi de notifications push FCM.
 * @param {object} deps
 */
export async function runCheckFavoriteSitesWeather({
    db,
    messaging,
    fieldValueDelete,
    sitesById,
    shared,
    fetchImpl = fetch,
}) {
    // Une seule requête Open-Meteo par site et par exécution, même si plusieurs pilotes l'ont en favori.
    const weatherCache = shared.createSiteWeatherCache((site) => fetchWeatherForSite(site, shared, fetchImpl));
    const usersSnap = await db.collection('users').where('fcmToken', '!=', '').get();

    for (const userDoc of usersSnap.docs) {
        const user = userDoc.data();
        if (!user.fcmToken || typeof user.fcmToken !== 'string') continue;

        // Réservé aux pilotes ayant le rôle « beta » (users/{uid}/access/profile, donné à la main).
        const accessSnap = await db.collection('users').doc(userDoc.id).collection('access').doc('profile').get();
        if (!shared.hasBetaRole(accessSnap.exists ? accessSnap.data() : undefined)) continue;

        const prefsSnap = await db
            .collection('users')
            .doc(userDoc.id)
            .collection('preferences')
            .doc('user_prefs')
            .get();
        const prefs = { ...DEFAULT_PREFS, ...(prefsSnap.exists ? prefsSnap.data() : {}) };
        const favoriteIds = Array.isArray(prefs.favoriteSites) ? prefs.favoriteSites : [];
        if (favoriteIds.length === 0) continue;

        const stateRef = db.collection('users').doc(userDoc.id).collection('pushState').doc('favoriteSitesFlyable');
        const stateSnap = await stateRef.get();
        const previousState = stateSnap.exists ? stateSnap.data() : {};
        const newState = {};
        let tokenInvalidated = false;

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
                if (!tokenInvalidated && shared.shouldNotify(previousState[siteId], outcome)) {
                    await messaging
                        .send({
                            token: user.fcmToken,
                            // Informe sans autoriser : ni « volable », ni certitude (spec 005, audit A3).
                            notification: shared.buildNotification(site, weather, weather.timeMs),
                        })
                        .catch(async (err) => {
                            console.error(`Échec envoi push (${userDoc.id}/${siteId}):`, err.message);
                            if (DEAD_FCM_ERROR_CODES.has(err?.code)) {
                                tokenInvalidated = true;
                                await userDoc.ref.update({ fcmToken: fieldValueDelete() }).catch(() => {});
                            }
                        });
                }
            } catch (e) {
                console.error(`Erreur météo pour le site ${siteId} (utilisateur ${userDoc.id}):`, e.message);
                // Erreur réseau : on garde le dernier état connu plutôt que de l'effacer.
                if (previousState[siteId] !== undefined) newState[siteId] = previousState[siteId];
            }
        }

        await stateRef.set(newState);
    }

    return { weatherRequests: weatherCache.requests, userCount: usersSnap.size };
}
