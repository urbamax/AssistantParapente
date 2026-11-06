import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FirebaseAuthEngine } from '../../js/services/firebase_service.js';
import SitesService from '../../js/services/sites_service.js';
import AppRouter from '../../js/core/router.js';
import { createFakeFirestore } from '../fixtures/fake_firestore.js';

describe('Firebase silent sync - No unprompted view refresh', () => {
    let firestore;
    const defaultLoadFirestore = FirebaseAuthEngine._loadFirestore;

    beforeEach(() => {
        firestore = createFakeFirestore({});
        FirebaseAuthEngine._loadFirestore = async () => firestore.module;
        FirebaseAuthEngine.currentUser = { uid: 'u1', email: 'pilot@example.com' };
        FirebaseAuthEngine.enabled = true;
    });

    afterEach(() => {
        vi.restoreAllMocks();
        FirebaseAuthEngine._loadFirestore = defaultLoadFirestore;
        FirebaseAuthEngine.currentUser = null;
        FirebaseAuthEngine.enabled = false;
    });

    it('does NOT call renderStats, renderList, or switchTab during silent sync', async () => {
        const statsView = { renderStats: vi.fn() };
        const logbookView = { currentTab: 'history', switchTab: vi.fn() };
        vi.spyOn(AppRouter, 'getView').mockImplementation((route) => {
            if (route === 'STATS') return statsView;
            if (route === 'LOGBOOK') return logbookView;
            return null;
        });
        const renderListSpy = vi.spyOn(SitesService, 'renderList').mockImplementation(() => {});

        // Background automatic sync
        const result = await FirebaseAuthEngine.syncDataWithCloud(true);

        expect(result.success).toBe(true);
        expect(statsView.renderStats).not.toHaveBeenCalled();
        expect(renderListSpy).not.toHaveBeenCalled();
        expect(logbookView.switchTab).not.toHaveBeenCalled();
    });
});
