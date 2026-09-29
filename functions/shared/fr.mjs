// GÉNÉRÉ — ne pas modifier. Copie de js/i18n/fr.js, régénérée par scripts/sync_functions_shared.mjs.
/**
 * Catalogue des textes affichés (français).
 *
 * Constitution, contrainte « Language » : les textes de toute fonctionnalité nouvelle ou
 * retravaillée vivent ici plutôt qu'en dur dans le code, pour permettre une traduction plus
 * tard. Les écrans existants migrent au fil des modifications.
 *
 * Placeholders : {nom} est remplacé par t(clé, { nom: valeur }) (js/utils/i18n.js).
 */
export const FR = Object.freeze({
    weather: Object.freeze({
        loading: 'Chargement...',
        night: 'Nuit',
        rain: 'Pluie ({mm} mm)',
        windOutOfLimits: 'Vent hors limites',
        windOutOfEquipmentLimits: 'Vent hors limites (Matériel)',
        gustOutOfLimits: 'Rafales hors limites',
        stormRisk: 'Risque orageux (CAPE)',
        wrongOrientation: 'Mauvaise orientation',
        excellent: 'Excellent ({score}/100)',
        good: 'Bon ({score}/100)',
        fair: 'Passable ({score}/100)',
        withWings: ' avec {wings}',
        incomplete: 'Prévision incomplète',
        unavailableList: 'Indisponible : {list}',
        orientationUnknown: 'Orientation du décollage inconnue : à vérifier',
        noReliableForecast: 'Aucune prévision fiable pour ce site',
        confidenceUnavailable: 'Indisponible',
        legendIncomplete: 'Prévision incomplète',
        missingPlaceholder: '—',
        reminder:
            'Avis basé sur des prévisions, risque d’orage estimé : la décision vous appartient, vérifiez sur place.',
        missing: Object.freeze({
            windSpeed: 'vent moyen',
            windGust: 'rafales',
            windDir: 'direction du vent',
            precipitation: 'précipitations',
            cape: 'risque d’orage',
            daylight: 'heures de jour',
        }),
    }),
    forecast: Object.freeze({
        models: Object.freeze({
            meteofrance: 'AROME (Météo-France)',
            iconeu: 'ICON-EU (DWD)',
            icon: 'ICON (DWD, global)',
            ecmwf: 'ECMWF (IFS)',
            gfs: 'GFS (NOAA)',
            best_match: 'Sélection automatique (Open-Meteo, multi-modèles)',
        }),
        context: '{model} · récupérée à {time}',
        run: ' · run {component} de {hour}',
        yesterday: 'hier',
        weekdays: Object.freeze(['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.']),
        stale: 'Prévision récupérée il y a {age} — peut être dépassée',
        refresh: 'Actualiser',
        refreshFailed: 'Actualisation impossible : {reason}',
        refreshOffline: 'pas de connexion',
        refreshQuota: 'limite de requêtes Open-Meteo atteinte, réessayez dans {minutes} min',
        refreshError: 'le service météo ne répond pas',
        agree: '✓ {model} d’accord',
        disagree: '⚠ {model} n’est pas d’accord : {verdict}',
        comparisonUnavailable: 'Comparaison {model} indisponible',
        defaultLocationNotice: 'Recherche centrée sur Boulogne-sur-Mer — activez le GPS ou saisissez une adresse.',
        radiusKm: '{km} km',
        searchOutsideRadius:
            '{count} sites correspondent hors du rayon de {km} km — élargissez le rayon ou changez de position.',
        searchOutsideRadiusOne:
            '1 site correspond hors du rayon de {km} km — élargissez le rayon ou changez de position.',
        loading: 'Chargement météo {model}...',
    }),
});
