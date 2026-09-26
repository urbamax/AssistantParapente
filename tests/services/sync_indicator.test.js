import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import GlobalState from '../../js/core/app_state.js';
import { FirebaseAuthEngine } from '../../js/services/firebase_service.js';

function setOnline(value) {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => value });
}

describe('Voyant de synchronisation', () => {
    beforeEach(async () => {
        document.body.innerHTML = '<div id="sync-active-dot" class="sync-active-dot"></div>';
        FirebaseAuthEngine._changeSeq = 0;
        FirebaseAuthEngine._syncedSeq = 0;
        FirebaseAuthEngine._syncsInFlight = 0;
        FirebaseAuthEngine._debounceSyncTimer = null;
        FirebaseAuthEngine.currentUser = { uid: 'u1' };
        FirebaseAuthEngine.enabled = true;
        setOnline(true);
        await FirebaseAuthEngine.init(); // Firebase désactivé en test : ne fait que brancher le voyant
    });

    afterEach(() => {
        vi.useRealTimers();
        FirebaseAuthEngine.currentUser = null;
        FirebaseAuthEngine.enabled = false;
        setOnline(true);
    });

    const dot = () => document.getElementById('sync-active-dot');

    it('is hidden when everything is in the cloud', () => {
        FirebaseAuthEngine._updateSyncStatus();
        expect(FirebaseAuthEngine.getSyncStatus()).toBe('idle');
        expect(dot().classList.contains('active')).toBe(false);
    });

    it('turns orange when a change is made offline, instead of disappearing', () => {
        vi.useFakeTimers();
        setOnline(false);
        FirebaseAuthEngine.triggerDebouncedSync();
        expect(FirebaseAuthEngine.getSyncStatus()).toBe('syncing'); // délai de regroupement

        vi.advanceTimersByTime(2000);
        expect(FirebaseAuthEngine.getSyncStatus()).toBe('pending');
        expect(dot().classList.contains('active')).toBe(true);
        expect(dot().classList.contains('pending')).toBe(true);
        expect(dot().title).toContain('pas encore envoyées');
    });

    it('stays orange after a failed sync', async () => {
        FirebaseAuthEngine.markUnsyncedChange();
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        // Le SDK Firestore (CDN) n'est pas chargeable en test : la synchro échoue.
        const result = await FirebaseAuthEngine.syncDataWithCloud(true);
        errorSpy.mockRestore();
        expect(result.success).toBe(false);
        expect(FirebaseAuthEngine._syncsInFlight).toBe(0);
        expect(FirebaseAuthEngine.getSyncStatus()).toBe('pending');
    });

    it('flags quiz answers saved while offline', async () => {
        setOnline(false);
        const result = await FirebaseAuthEngine.saveStatsToCloud();
        expect(result.error).toBe('Offline');
        expect(FirebaseAuthEngine.getSyncStatus()).toBe('pending');
    });

    it('shows nothing once logged out, even with unsent changes', () => {
        FirebaseAuthEngine.markUnsyncedChange();
        FirebaseAuthEngine.currentUser = null;
        FirebaseAuthEngine._updateSyncStatus();
        expect(GlobalState.get('syncStatus')).toBe('idle');
        expect(dot().classList.contains('active')).toBe(false);
    });
});
