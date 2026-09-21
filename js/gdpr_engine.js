/**
 * GDPR (RGPD) Engine - France 2026
 * Handles user data privacy consent banner, detailed preferences settings modal,
 * and legal document overlays (Mentions Légales & Politique de Confidentialité).
 */

const GdprEngine = {
    consentKey: 'parapente_gdpr_consent',
    consentVersion: 2026,

    // Default consent settings
    consent: {
        stats: false, // progression stats and QCM history
        firebase: false, // online firebase synchronization
        gps: false, // geolocation for flight sites distance
        date: null,
    },

    init: function () {
        console.log('GdprEngine: Initializing...');

        // Load consent from localStorage
        const stored = localStorage.getItem(this.consentKey);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (parsed && parsed.version === this.consentVersion) {
                    this.consent = parsed;
                    console.log('GdprEngine: Consent loaded', this.consent);
                    this.applyConsentGuards();
                    return;
                }
            } catch (e) {
                console.warn('GdprEngine: Corrupt consent in localStorage, resetting.', e);
            }
        }

        // If no valid consent found, show the banner with a short delay
        setTimeout(() => {
            this.showBanner();
        }, 800);
    },

    showBanner: function () {
        const banner = document.getElementById('gdpr-banner');
        if (banner) {
            banner.classList.add('active');
        }
    },

    hideBanner: function () {
        const banner = document.getElementById('gdpr-banner');
        if (banner) {
            banner.classList.remove('active');
        }
    },

    showModal: function (modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');

            // If it's the settings modal, synchronize toggles
            if (modalId === 'gdpr-settings-modal') {
                this.syncTogglesToState();
            }
        }
    },

    hideModal: function (modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
        }
    },

    // Accept all cookies / tracking / data features
    acceptAll: function () {
        this.consent = {
            stats: true,
            firebase: true,
            gps: true,
            version: this.consentVersion,
            date: new Date().toISOString(),
        };
        this.saveConsent();
        this.hideBanner();
        this.hideModal('gdpr-settings-modal');
        this.applyConsentGuards();
    },

    // Refuse all non-essential data features
    refuseAll: function () {
        this.consent = {
            stats: false,
            firebase: false,
            gps: false,
            version: this.consentVersion,
            date: new Date().toISOString(),
        };
        this.saveConsent();
        this.hideBanner();
        this.hideModal('gdpr-settings-modal');
        this.applyConsentGuards();
        this.clearDeclinedData();
    },

    // Save custom settings from toggles
    saveCustomSettings: function () {
        const statsVal = document.getElementById('gdpr-toggle-stats')?.checked || false;
        const firebaseVal = document.getElementById('gdpr-toggle-firebase')?.checked || false;
        const gpsVal = document.getElementById('gdpr-toggle-gps')?.checked || false;

        this.consent = {
            stats: statsVal,
            firebase: firebaseVal,
            gps: gpsVal,
            version: this.consentVersion,
            date: new Date().toISOString(),
        };

        this.saveConsent();
        this.hideBanner();
        this.hideModal('gdpr-settings-modal');
        this.applyConsentGuards();

        // Clean up data if toggled off
        this.clearDeclinedData();
    },

    saveConsent: function () {
        localStorage.setItem(this.consentKey, JSON.stringify(this.consent));
        console.log('GdprEngine: Consent saved', this.consent);
    },

    // Sync toggle switches in the settings modal to current consent state
    syncTogglesToState: function () {
        const toggleStats = document.getElementById('gdpr-toggle-stats');
        const toggleFirebase = document.getElementById('gdpr-toggle-firebase');
        const toggleGps = document.getElementById('gdpr-toggle-gps');

        if (toggleStats) toggleStats.checked = this.consent.stats;
        if (toggleFirebase) toggleFirebase.checked = this.consent.firebase;
        if (toggleGps) toggleGps.checked = this.consent.gps;
    },

    // Helper to query consent state from other scripts
    isConsentGranted: function (category) {
        return this.consent && this.consent[category] === true;
    },

    // Apply logic controls immediately after consent state changes
    applyConsentGuards: async function () {
        // 1. Firebase Guard
        if (this.isConsentGranted('firebase')) {
            // Enable Firebase engine if not already enabled
            if (window.FirebaseAuthEngine && !window.FirebaseAuthEngine.enabled) {
                console.log('GdprEngine: Enabling Firebase sync engine...');
                window.FirebaseAuthEngine.init();
            }
        } else {
            // If Firebase was enabled, log out user and turn off Firebase
            if (window.FirebaseAuthEngine && window.FirebaseAuthEngine.enabled) {
                console.log('GdprEngine: Consent revoked for Firebase. Signing out user...');
                // Force logout
                if (window.FirebaseAuthEngine.currentUser) {
                    window.FirebaseAuthEngine.signOut();
                }
                window.FirebaseAuthEngine.enabled = false;
                window.FirebaseAuthEngine.updateHeaderUI();
                window.FirebaseAuthEngine.updateModalUI();
            }
        }

        // 2. GPS Guard
        // window.SitesEngine n'existe plus (ancien nom, remplacé par SitesService/SitesView
        // lors du refactor) : SitesService n'étant exporté qu'en module ES, on y accède ici
        // via import() dynamique (valide même dans ce script classique).
        const { default: SitesService } = await import('./services/sites_service.js');
        const gpsStatusEl = document.getElementById('address-status-message');
        const gpsBtn = document.getElementById('btn-use-gps');
        if (!this.isConsentGranted('gps')) {
            // Nullify user position in sites engine to clean UI
            if (SitesService && SitesService.state) {
                SitesService.state.userLocation = null;
            }
            if (gpsStatusEl) {
                gpsStatusEl.innerHTML = `<i class="ri-shield-user-line" style="color: var(--text-muted);"></i> Géolocalisation désactivée par vos choix de confidentialité.`;
                gpsStatusEl.style.color = 'var(--text-muted)';
            }
            if (gpsBtn) {
                gpsBtn.style.borderColor = 'var(--border-color)';
                gpsBtn.style.color = 'var(--text-muted)';
            }
        } else {
            // If GPS is approved and we are in SITES mode, attempt to fetch position if not set
            if (SitesService && SitesService.state && window.Engine && window.Engine.state.mode === 'SITES') {
                if (!SitesService.state.userLocation && window.SitesView) {
                    window.SitesView.requestGpsLocation(true);
                }
            }
        }
    },

    // Clean up local data if a user revokes consent for it
    clearDeclinedData: function () {
        // If stats consent revoked, clear QCM stats & history
        if (!this.isConsentGranted('stats')) {
            console.log('GdprEngine: Clearing progression statistics & exam history from localStorage.');
            localStorage.removeItem('parapente_qcm_stats');
            localStorage.removeItem('parapente_exam_history');

            // Refresh QCM UI if stats screen is active
            if (
                window.QuizEngine &&
                typeof window.QuizEngine.renderStats === 'function' &&
                window.Engine &&
                window.Engine.state.mode === 'STATS'
            ) {
                window.QuizEngine.renderStats();
            }
        }
    },
};

// Les gestionnaires inline (onclick="window.GdprEngine...") du HTML en ont encore besoin.
window.GdprEngine = GdprEngine;

// Même timing qu'avec le script classique : init au DOMContentLoaded, avant le boot de main.js.
if (document.readyState === 'complete') {
    GdprEngine.init();
} else {
    document.addEventListener('DOMContentLoaded', () => GdprEngine.init());
}

export default GdprEngine;
