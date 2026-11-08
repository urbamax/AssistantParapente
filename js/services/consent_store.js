/**
 * SERVICE - Lecture du consentement RGPD enregistré (module pur : aucun import, aucun DOM).
 *
 * GdprEngine (js/gdpr_engine.js) écrit le consentement dans localStorage dès que le pilote le modifie.
 * Les services qui doivent savoir s'ils ont le droit de stocker des données (statistiques QCM, historique
 * d'examens) le relisent ici plutôt que d'importer GdprEngine, qui dépend du routeur et des vues.
 */

export const CONSENT_KEY = 'parapente_gdpr_consent';
/** À changer quand les catégories de consentement changent : l'ancien choix n'est alors plus valable. */
export const CONSENT_VERSION = 2026;

/**
 * Le pilote a-t-il accepté la catégorie `stats`, `firebase` ou `gps` ? Faux sans choix enregistré.
 * @param {'stats' | 'firebase' | 'gps'} category
 * @returns {boolean}
 */
export function isConsentGranted(category) {
    try {
        const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(CONSENT_KEY) : null;
        if (!stored) return false;
        const parsed = JSON.parse(stored);
        return Boolean(parsed) && parsed.version === CONSENT_VERSION && parsed[category] === true;
    } catch {
        return false;
    }
}

export const isStatsConsentGranted = () => isConsentGranted('stats');
