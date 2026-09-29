import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import SitesView from '../../js/views/sites.js';
import SitesService from '../../js/services/sites_service.js';
import { completeHourWith, SITE_SOUTH } from '../fixtures/forecasts.js';

// Spec 001, US3 (FR-010b) + constitution principe II : chaque affichage d'un verdict rappelle
// que c'est une estimation à partir de prévisions et que la décision revient au pilote.
const REMINDER = 'la décision vous appartient, vérifiez sur place';

describe('SitesView verdict reminder (spec 001, US3)', () => {
    beforeEach(() => {
        SitesService.state.limitWindMin = 5;
        SitesService.state.limitWindMax = 25;
        SitesService.state.limitGustDelta = 15;
        SitesService.state.filterMode = 'manual';
        SitesService.state.forecastOffset = 0;
    });

    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    it('shows the reminder in the map popup of a flyable and of an unflyable verdict', () => {
        for (const weather of [completeHourWith(), completeHourWith({ precipitation: 2 })]) {
            const html = SitesView.buildWeatherPopupHtml(weather, '#22c55e', SITE_SOUTH);
            expect(html).toContain(REMINDER);
        }
    });

    it('does not show the reminder when there is no verdict (incomplete hour)', () => {
        const html = SitesView.buildWeatherPopupHtml(completeHourWith({ windGust: null }), '#94a3b8', SITE_SOUTH);
        expect(html).not.toContain(REMINDER);
        expect(html).toContain('Indisponible : rafales');
    });

    it('shows the reminder once above the favourites comparison table', () => {
        document.body.innerHTML = '<div id="sites-list-container"></div>';
        const site = { id: 90, nom: 'Favori', ...SITE_SOUTH };
        SitesService.state.userPreferences = { favoriteSites: [90] };
        SitesService.state.weatherForecasts = { 90: [completeHourWith()] };
        SitesView.renderComparator([site]);
        const text = document.getElementById('sites-list-container').textContent;
        expect(text.split(REMINDER).length - 1).toBe(1);
    });
});
