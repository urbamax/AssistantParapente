import { CONSENT_KEY, CONSENT_VERSION } from '../../js/services/consent_store.js';

/** Enregistre le consentement RGPD comme le fait GdprEngine (à rappeler après un localStorage.clear()). */
export function setConsent({ stats = true, firebase = false, gps = false } = {}) {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ stats, firebase, gps, version: CONSENT_VERSION }));
}
