import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import SitesService from '../../js/services/sites_service.js';
import LogbookService from '../../js/services/logbook_service.js';
import GlobalState from '../../js/core/app_state.js';
import SitesView from '../../js/views/sites.js';
import AccessService, { applyRoleVisibility } from '../../js/services/access_service.js';
import { completeHourWith } from '../fixtures/forecasts.js';

// Sans le rôle « beta » (js/services/access_service.js), la liste et la carte des sites restent
// visibles mais rien de calculé ne l'est : ni verdict, ni créneaux, ni frise, ni comparateur.
const SITE = {
    id: 'arbas-665',
    nom: 'Mont Lambert',
    orientations_vent: ['S'],
    site_sous_type: 'NATUREL',
    alt: 180,
    latitude: 50.7,
    longitude: 1.65,
    flyableHours: 5,
    maxConsecutiveHours: 3,
    flyableSlots: [{ dayLabel: 'Mar', start: 14, end: 16 }],
};

const INDEX = readFileSync('index.html', 'utf8');
const SITES_SCREEN = (() => {
    const tpl = document.createElement('template');
    tpl.innerHTML = INDEX.slice(INDEX.indexOf('<div id="sites-screen"'));
    return tpl.content.getElementById('sites-screen').outerHTML.replace(/<iframe\b[^>]*>\s*<\/iframe>/g, '');
})();

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date('2026-09-30T10:00:00'));
    AccessService.clear();
    document.body.innerHTML = SITES_SCREEN;
    Object.assign(SitesService.state, {
        limitWindMin: 5,
        limitWindMax: 25,
        limitGustDelta: 15,
        filterMode: 'manual',
        forecastOffset: 0,
        forecastMaxRange: 6,
        forecastSource: 'live',
        weatherForecasts: { 'arbas-665': [completeHourWith({ time: '2026-09-30T14:00' })] },
        forecastProvenance: {},
        userLocation: null,
        // Un favori non réduit : la fiche est dépliée, donc la partie météo serait affichée avec le rôle.
        userPreferences: { favoriteSites: ['arbas-665'], minimizedSites: [], savedLocations: [] },
    });
    SitesView.state.showComparator = false;
    vi.spyOn(SitesService, 'getSites').mockReturnValue([SITE]);
    vi.spyOn(SitesService, 'getFilteredAndSortedSites').mockImplementation(() => [{ ...SITE }]);
    vi.spyOn(SitesService, 'getForecastProvenance').mockReturnValue(null);
    vi.spyOn(SitesService, 'getModelAgreement').mockReturnValue(null);
    vi.spyOn(SitesService, 'countSearchMatchesOutsideRadius').mockReturnValue(0);
    vi.spyOn(LogbookService, 'computeEquipmentWear').mockReturnValue({});
    vi.spyOn(GlobalState, 'get').mockReturnValue('BP');
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    AccessService.clear();
});

const list = () => document.getElementById('sites-list-container');

describe('liste des sites sans le rôle « beta »', () => {
    it('montre le site mais aucune météo calculée', () => {
        SitesView.renderList();
        const card = list().textContent;
        expect(card).toContain('Mont Lambert');
        expect(list().querySelector('.site-weather-row')).toBeNull();
        expect(list().querySelector('.ranking-timeline')).toBeNull();
        expect(list().querySelector('.timeline-legend')).toBeNull();
        expect(list().querySelector('.creneaux-list')).toBeNull();
        expect(list().querySelector('.weather-loading')).toBeNull();
        expect(card).not.toMatch(/Créneaux|volable|Chargement/i);
    });

    it('montre toujours les données du site : orientations, type, accès', () => {
        SitesView.renderList();
        expect(list().querySelector('.wind-tag')).not.toBeNull();
        expect(list().querySelector('.gps-btn')).not.toBeNull();
    });

    it('montre la météo calculée dès que le rôle est donné', () => {
        AccessService.setRoles('pilote-A', ['beta']);
        SitesView.renderList();
        expect(list().querySelector('.site-weather-row')).not.toBeNull();
        expect(list().querySelector('.ranking-timeline')).not.toBeNull();
    });

    it('revient de lui-même à la liste si le comparateur était ouvert', () => {
        SitesView.state.showComparator = true;
        SitesView.renderList();
        expect(SitesView.state.showComparator).toBe(false);
        expect(list().querySelector('table')).toBeNull();
    });

    it('cache les réglages du calcul, l’heure de prévision et le comparateur', () => {
        applyRoleVisibility();
        for (const selector of [
            '[data-action="toggleAdvancedSettings"]',
            '.advanced-filters-container',
            '.forecast-sticky-container',
            '#btn-compare-favorites',
        ]) {
            const el = /** @type {HTMLElement} */ (document.querySelector(selector));
            expect(el, selector).not.toBeNull();
            expect(el.hidden, selector).toBe(true);
        }
        // La recherche, le rayon et les filtres restent à disposition.
        expect(/** @type {HTMLElement} */ (document.getElementById('site-search')).closest('[hidden]')).toBeNull();
        expect(/** @type {HTMLElement} */ (document.getElementById('radius-slider')).closest('[hidden]')).toBeNull();
    });
});

describe('SitesService sans le rôle « beta »', () => {
    it("ne demande aucune prévision et n'en garde aucune", async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch');
        expect(await SitesService.fetchWeatherForSites()).toEqual({ success: null, denied: true });
        expect(await SitesService.fetchWeatherForSites({ force: true })).toEqual({ success: null, denied: true });
        expect(await SitesService.restoreForecastSnapshot()).toBe(0);
        expect(await SitesService.fetchModelRunTime('meteofrance')).toBeNull();
        await SitesService.fetchSecondaryModel();
        SitesService.scheduleWeatherRescopeIfNeeded();
        vi.advanceTimersByTime(1000);
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('retire les prévisions en mémoire quand le rôle disparaît en cours de session', () => {
        AccessService.setRoles('pilote-A', ['beta']);
        SitesService.state.weatherForecasts = { 'arbas-665': [completeHourWith({ time: '2026-09-30T14:00' })] };
        const onList = vi.fn();
        const stop = SitesService.on('list', onList);

        AccessService.clear();

        expect(SitesService.state.weatherForecasts).toEqual({});
        expect(SitesService.state.forecastProvenance).toEqual({});
        expect(onList).toHaveBeenCalled();
        stop();
    });

    it('charge les prévisions quand le rôle arrive en cours de session', () => {
        const fetchWeather = vi.spyOn(SitesService, 'fetchWeatherForSites').mockResolvedValue({ success: true });
        SitesService.state.weatherForecasts = {};

        AccessService.setRoles('pilote-A', ['beta']);
        vi.advanceTimersByTime(500);

        expect(fetchWeather).toHaveBeenCalledTimes(1);
    });
});
