import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import SitesView, { radiusLabel, formatForecastContext } from '../../js/views/sites.js';
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

describe('SitesView location and radius (spec 002, US4)', () => {
    beforeEach(() => {
        document.body.innerHTML = '<p id="default-location-notice" hidden></p>';
    });

    afterEach(() => {
        SitesService.state.userLocation = null;
        SitesService.state.searchQuery = '';
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    it('shows the Boulogne-sur-Mer notice when no position is known', () => {
        SitesService.state.userLocation = null;
        SitesView.renderLocationContext();
        const el = document.getElementById('default-location-notice');
        expect(el.hidden).toBe(false);
        expect(el.textContent).toContain('Recherche centrée sur Boulogne-sur-Mer');
    });

    it('hides the notice once a real position is known', () => {
        SitesService.state.userLocation = { lat: 45.9, lng: 6.1 };
        SitesView.renderLocationContext();
        expect(document.getElementById('default-location-notice').hidden).toBe(true);
    });

    it('labels the radius in km, never « Illimité »', () => {
        expect(radiusLabel(50)).toBe('50 km');
        expect(radiusLabel(200)).toBe('200 km');
        expect(radiusLabel(210)).toBe('200 km');
    });

    it('says how many searched sites are outside the radius (FR-019)', () => {
        vi.spyOn(SitesService, 'countSearchMatchesOutsideRadius').mockReturnValue(3);
        SitesService.state.radiusLimit = 50;
        const html = SitesView.buildSearchOutsideNotice();
        expect(html).toContain('3 sites correspondent hors du rayon de 50 km');
    });

    it('shows nothing when no searched site is outside the radius', () => {
        vi.spyOn(SitesService, 'countSearchMatchesOutsideRadius').mockReturnValue(0);
        expect(SitesView.buildSearchOutsideNotice()).toBe('');
    });
});

describe('forecast context line (spec 002, US1)', () => {
    const at = (y, mo, d, h, mi) => new Date(y, mo - 1, d, h, mi).getTime();
    const NOW = at(2026, 9, 30, 15, 0);

    it('names the model, the retrieval time and the run time', () => {
        const text = formatForecastContext(
            { modelKey: 'meteofrance', fetchedAt: at(2026, 9, 30, 14, 5), runAt: at(2026, 9, 30, 8, 0) },
            NOW,
        );
        expect(text).toBe('AROME (Météo-France) · récupérée à 14 h 05 · run AROME de 08 h');
    });

    it('shows no run time when it is unknown', () => {
        const text = formatForecastContext(
            { modelKey: 'best_match', fetchedAt: at(2026, 9, 30, 14, 5), runAt: null },
            NOW,
        );
        expect(text).toBe('Sélection automatique (Open-Meteo, multi-modèles) · récupérée à 14 h 05');
        expect(text).not.toContain('run');
    });

    it('prefixes the day when it is not today', () => {
        const yesterday = formatForecastContext(
            { modelKey: 'gfs', fetchedAt: at(2026, 9, 29, 23, 40), runAt: at(2026, 9, 29, 20, 0) },
            NOW,
        );
        expect(yesterday).toBe('GFS (NOAA) · récupérée hier à 23 h 40 · run GFS d’hier 20 h');
        const older = formatForecastContext({ modelKey: 'gfs', fetchedAt: at(2026, 9, 27, 9, 0), runAt: null }, NOW);
        expect(older).toBe('GFS (NOAA) · récupérée dim. à 09 h 00');
    });

    it('appears once in the popup, the site card weather block and the comparison table', () => {
        SitesService.state.weatherModel = 'meteofrance';
        SitesService.state.limitWindMin = 5;
        SitesService.state.limitWindMax = 25;
        SitesService.state.limitGustDelta = 15;
        SitesService.state.forecastOffset = 0;
        vi.spyOn(SitesService, 'getForecastProvenance').mockReturnValue({
            modelKey: 'meteofrance',
            fetchedAt: Date.now(),
            runAt: null,
        });
        const site = { id: 91, nom: 'Contexte', ...SITE_SOUTH };
        const popup = SitesView.buildWeatherPopupHtml(completeHourWith(), '#22c55e', site);
        expect(popup.split('forecast-context').length - 1).toBe(1);
        expect(popup).toContain('AROME (Météo-France) · récupérée à');

        document.body.innerHTML = '<div id="sites-list-container"></div>';
        SitesService.state.userPreferences = { favoriteSites: [91] };
        SitesService.state.weatherForecasts = { 91: [completeHourWith()] };
        SitesView.renderComparator([site]);
        const table = document.getElementById('sites-list-container').innerHTML;
        expect(table.split('forecast-context').length - 1).toBe(1);
        vi.restoreAllMocks();
    });
});
