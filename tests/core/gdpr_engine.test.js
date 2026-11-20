import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import GdprEngine from '../../js/gdpr_engine.js';
import { CONSENT_KEY, CONSENT_VERSION } from '../../js/services/consent_store.js';

describe('GdprEngine', () => {
    beforeEach(() => {
        localStorage.clear();
        document.body.innerHTML = `
            <div id="gdpr-banner"></div>
            <dialog id="gdpr-settings-modal" style="display:none;">
                <input type="checkbox" id="gdpr-toggle-stats" />
                <input type="checkbox" id="gdpr-toggle-firebase" />
                <input type="checkbox" id="gdpr-toggle-gps" />
            </dialog>
            <div id="address-status-message"></div>
            <button id="btn-use-gps"></button>
        `;
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
        window.FirebaseAuthEngine = undefined;
    });

    it('acceptAll grants all categories, saves to localStorage, and hides banner', () => {
        document.getElementById('gdpr-banner').classList.add('active');
        GdprEngine.acceptAll();

        expect(GdprEngine.isConsentGranted('stats')).toBe(true);
        expect(GdprEngine.isConsentGranted('firebase')).toBe(true);
        expect(GdprEngine.isConsentGranted('gps')).toBe(true);
        expect(document.getElementById('gdpr-banner').classList.contains('active')).toBe(false);

        const stored = JSON.parse(localStorage.getItem(CONSENT_KEY));
        expect(stored.version).toBe(CONSENT_VERSION);
        expect(stored.stats).toBe(true);
    });

    it('refuseAll revokes categories, clears declined stats, and signs out Firebase if active', () => {
        localStorage.setItem('parapente_qcm_stats', '{"total":10}');
        localStorage.setItem('parapente_exam_history', '{"exams":[]}');
        const signOut = vi.fn();
        window.FirebaseAuthEngine = {
            enabled: true,
            currentUser: { uid: 'u1' },
            signOut,
            updateHeaderUI: vi.fn(),
            updateModalUI: vi.fn(),
        };

        GdprEngine.refuseAll();

        expect(GdprEngine.isConsentGranted('stats')).toBe(false);
        expect(GdprEngine.isConsentGranted('firebase')).toBe(false);
        expect(GdprEngine.isConsentGranted('gps')).toBe(false);
        expect(localStorage.getItem('parapente_qcm_stats')).toBeNull();
        expect(localStorage.getItem('parapente_exam_history')).toBeNull();
        expect(signOut).toHaveBeenCalledTimes(1);
        expect(window.FirebaseAuthEngine.enabled).toBe(false);
    });

    it('saveCustomSettings persists individual toggle choices', () => {
        /** @type {HTMLInputElement} */ (document.getElementById('gdpr-toggle-stats')).checked = true;
        /** @type {HTMLInputElement} */ (document.getElementById('gdpr-toggle-firebase')).checked = false;
        /** @type {HTMLInputElement} */ (document.getElementById('gdpr-toggle-gps')).checked = true;

        GdprEngine.saveCustomSettings();

        expect(GdprEngine.isConsentGranted('stats')).toBe(true);
        expect(GdprEngine.isConsentGranted('firebase')).toBe(false);
        expect(GdprEngine.isConsentGranted('gps')).toBe(true);
    });

    it('showModal opens settings modal and syncs toggle checkboxes', () => {
        GdprEngine.consent = { stats: true, firebase: false, gps: true, version: CONSENT_VERSION, date: null };
        GdprEngine.showModal('gdpr-settings-modal');

        const modal = document.getElementById('gdpr-settings-modal');
        expect(modal.classList.contains('active')).toBe(true);
        expect(/** @type {HTMLInputElement} */ (document.getElementById('gdpr-toggle-stats')).checked).toBe(true);
        expect(/** @type {HTMLInputElement} */ (document.getElementById('gdpr-toggle-firebase')).checked).toBe(false);
        expect(/** @type {HTMLInputElement} */ (document.getElementById('gdpr-toggle-gps')).checked).toBe(true);

        GdprEngine.hideModal('gdpr-settings-modal');
        expect(modal.classList.contains('active')).toBe(false);
    });

    it('init loads valid stored consent and handles corrupted JSON gracefully', () => {
        localStorage.setItem(
            CONSENT_KEY,
            JSON.stringify({ stats: true, firebase: false, gps: false, version: CONSENT_VERSION, date: '2026-11-20' }),
        );
        GdprEngine.init();
        expect(GdprEngine.isConsentGranted('stats')).toBe(true);

        localStorage.setItem(CONSENT_KEY, '{corrupt');
        expect(() => GdprEngine.init()).not.toThrow();
    });
});
