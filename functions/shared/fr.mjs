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
});
