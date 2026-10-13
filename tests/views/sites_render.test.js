import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import SitesService from '../../js/services/sites_service.js';
import LogbookService from '../../js/services/logbook_service.js';
import GlobalState from '../../js/core/app_state.js';
import GdprEngine from '../../js/gdpr_engine.js';
import SitesView from '../../js/views/sites.js';
import { completeHourWith } from '../fixtures/forecasts.js';

// Spec 015 : les textes de l'écran des sites passent dans le catalogue sans rien changer à
// l'affichage. Ces instantanés ont été enregistrés AVANT le déplacement ; ils doivent rester identiques.
const INDEX = readFileSync('index.html', 'utf8');
const SCREEN = (() => {
    const tpl = document.createElement('template');
    tpl.innerHTML = INDEX.slice(INDEX.indexOf('<div id="sites-screen"'));
    return (
        ['sites-screen', 'more-maps-bottom-sheet', 'spotair-modal']
            .map((id) => tpl.content.getElementById(id).outerHTML)
            .join('')
            // Aucune carte ni page tierce chargée par le test : les iframes deviennent de simples blocs.
            .replace(/<iframe\b/g, '<div')
            .replace(/<\/iframe>/g, '</div>')
            .replace(/\s(src|href)="https?:[^"]*"/g, '')
    );
})();

const DETAILS = {
    conventionnement: 'Conventionné FFVL',
    praticabilite: 'Pratiquable',
    structure_gestionnaire: 'Club local',
    aerologie_ideale: 'Brise de mer',
    secours_acces: 'Accès pompiers par la route',
    dangers: 'Lignes électriques',
    acces_topo: 'Parking au sommet',
    observations: 'Site école',
    restrictions: 'Pas de vol le dimanche matin',
    reglementation: 'Zone R 45',
};
const SITES = [
    {
        id: 'arbas-665', // site avec balise SpotAiR (badge « Balise »)
        nom: 'Mont Lambert',
        orientations_vent: ['S', 'SO'],
        site_sous_type: 'NATUREL',
        alt: 180,
        latitude: 50.7,
        longitude: 1.65,
        url: 'https://federation.ffvl.fr/terrain/1',
        distance: 3.24,
        flyableHours: 5,
        maxConsecutiveHours: 3,
        flyableSlots: [
            { dayLabel: 'Mar', start: 14, end: 16 },
            { dayLabel: 'Mer', start: 11, end: 12 },
        ],
        affiche: true,
        ...DETAILS,
    },
    { id: 2, nom: 'Dune du Pyla', orientation: 'O', type: ['DUNE'], latitude: 44.6, longitude: -1.2, completeHours: 0 },
    { id: 3, nom: 'Sans météo', orientations_vent: 'N', latitude: 45, longitude: 5 },
    { id: 4, nom: 'Hors couverture', orientations_vent: 'N', latitude: 45, longitude: 5 },
];
const FORECASTS = {
    'arbas-665': [
        completeHourWith({ time: '2026-09-30T14:00' }),
        completeHourWith({ time: '2026-09-30T15:00', precipitation: 3 }),
        completeHourWith({ time: '2026-09-30T16:00', windGust: null }),
        completeHourWith({ time: '2026-09-30T17:00', windCard: 'N', windDirDeg: 0 }),
    ],
    2: [completeHourWith({ time: '2026-09-30T14:00', windGust: null })],
    4: [],
};

const dialogs = [];

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-30T10:00:00'));
    document.body.innerHTML = SCREEN;
    dialogs.length = 0;
    window.alert = (m) => dialogs.push(`alert: ${m}`);
    window.confirm = (m) => (dialogs.push(`confirm: ${m}`), false);
    Element.prototype.scrollIntoView = () => {};
    Object.assign(SitesService.state, {
        limitWindMin: 5,
        limitWindMax: 25,
        limitGustDelta: 15,
        filterMode: 'manual',
        forecastOffset: 0,
        forecastMaxRange: 6,
        forecastSource: 'network',
        weatherForecasts: structuredClone(FORECASTS),
        forecastProvenance: {},
        userLocation: null,
        radiusLimit: 50,
        searchQuery: '',
        filterWindInclude: ['S'],
        filterWindExclude: ['N'],
        filterTypeInclude: ['DUNE'],
        activeMapLayers: ['leaflet', 'windy'],
        userPreferences: {
            favoriteSites: ['arbas-665'],
            minimizedSites: [2, 4],
            savedLocations: [{ name: 'Maison', lat: 50.7, lng: 1.6 }],
        },
    });
    SitesView.state.expandedSites = { 'arbas-665': true };
    SitesView.state.showComparator = false;
    SitesView.state._spottedSite = null;
    SitesView.state.map = null;
    vi.spyOn(SitesService, 'getSites').mockReturnValue(SITES);
    vi.spyOn(SitesService, 'getFilteredAndSortedSites').mockImplementation(() => SITES.map((s) => ({ ...s })));
    vi.spyOn(SitesService, 'getForecastProvenance').mockReturnValue(null);
    vi.spyOn(SitesService, 'getModelAgreement').mockReturnValue(null);
    vi.spyOn(SitesService, 'countSearchMatchesOutsideRadius').mockReturnValue(0);
    vi.spyOn(LogbookService, 'computeEquipmentWear').mockReturnValue({});
    vi.spyOn(GlobalState, 'get').mockReturnValue('BP');
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

const html = (id) => document.getElementById(id).innerHTML;
const text = (id) => document.getElementById(id).textContent;

describe('sites renders (spec 015: identical before and after moving the texts)', () => {
    it('site list', () => {
        SitesView.renderList();
        expect(html('sites-list-container')).toMatchSnapshot();
    });

    it('site list, nothing found and offline notice', () => {
        SitesService.getFilteredAndSortedSites.mockReturnValue([]);
        SitesService.state.forecastSource = 'saved';
        SitesService.state.forecastProvenance = { 1: { fetchedAt: new Date('2026-09-28T08:05:00').getTime() } };
        SitesView.renderList();
        const otherDay = html('sites-list-container');
        SitesService.state.forecastProvenance = { 1: { fetchedAt: new Date('2026-09-30T08:05:00').getTime() } };
        SitesView.renderList();
        expect({ otherDay, sameDay: html('sites-list-container') }).toMatchSnapshot();
    });

    it('site list offline, card without saved forecast', () => {
        SitesService.state.forecastSource = 'saved';
        SitesService.getFilteredAndSortedSites.mockReturnValue([{ ...SITES[2] }]);
        SitesService.state.userPreferences.minimizedSites = [3];
        SitesView.renderList();
        expect(html('sites-list-container')).toMatchSnapshot();
    });

    it('comparator, empty and with favourites', () => {
        SitesView.renderComparator([]);
        const empty = html('sites-list-container');
        SitesService.state.userPreferences.favoriteSites = ['arbas-665', 2, 3];
        SitesView.renderComparator(SITES);
        expect({ empty, full: html('sites-list-container') }).toMatchSnapshot();
    });

    it('comparator button', () => {
        SitesView.toggleSitesComparator();
        const on = html('btn-compare-favorites');
        SitesView.toggleSitesComparator();
        expect({ on, off: html('btn-compare-favorites') }).toMatchSnapshot();
    });

    it('pre-flight brief reports a rescue opened and not repacked, like the Carnet badge', () => {
        LogbookService.computeEquipmentWear.mockReturnValue({ rescue: { alerts: { openedAlert: 'red' } } });
        const brief = SitesView.buildPreFlightBriefHtml();
        expect(brief).toContain('1 équipement à réviser');
        expect(brief).not.toContain('Matériel à jour');
    });

    it('pre-flight brief', () => {
        const none = SitesView.buildPreFlightBriefHtml();
        LogbookService.computeEquipmentWear.mockReturnValue({ a: { alerts: {} } });
        const ok = SitesView.buildPreFlightBriefHtml();
        LogbookService.computeEquipmentWear.mockReturnValue({
            a: { alerts: { dateAlert: 'red' } },
            b: { alerts: { hoursAlert: 'orange' } },
        });
        const two = SitesView.buildPreFlightBriefHtml();
        LogbookService.computeEquipmentWear.mockReturnValue({ a: { alerts: { dateAlert: 'red' } } });
        GlobalState.get.mockReturnValue(undefined);
        expect({ none, ok, two, one: SitesView.buildPreFlightBriefHtml() }).toMatchSnapshot();
    });

    it('map popup', () => {
        const weather = SitesView.buildWeatherPopupHtml(FORECASTS['arbas-665'][0], '#22c55e', SITES[0]);
        // Comparé tel que le navigateur l'affiche (une apostrophe échappée s'affiche à l'identique).
        const popup = document.createElement('div');
        popup.innerHTML = SitesView.buildMapPopupHtml(SITES[0], weather);
        expect(popup.innerHTML).toMatchSnapshot();
    });

    it('GPS messages', () => {
        vi.spyOn(GdprEngine, 'isConsentGranted').mockReturnValue(false);
        SitesView.requestGpsLocation(false);
        const refused = html('address-status-message');
        GdprEngine.isConsentGranted.mockReturnValue(true);
        let success;
        let failure;
        Object.defineProperty(navigator, 'geolocation', {
            configurable: true,
            value: { getCurrentPosition: (ok, ko) => ((success = ok), (failure = ko)) },
        });
        vi.spyOn(SitesService, 'scheduleWeatherRescopeIfNeeded').mockImplementation(() => {});
        SitesView.requestGpsLocation(false);
        const searching = html('address-status-message');
        success({ coords: { latitude: 50.7, longitude: 1.6 } });
        const found = {
            status: html('address-status-message'),
            placeholder: /** @type {HTMLInputElement} */ (document.getElementById('address-input')).placeholder,
        };
        failure();
        expect({ refused, searching, found, failed: html('address-status-message'), dialogs }).toMatchSnapshot();
    });

    it('weather download failure and retry countdown', () => {
        vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
        SitesService.state.weatherForecasts = {};
        SitesView.handleWeatherFetchResult({ success: false, error: new Error('429'), cooldownRemainingMs: 90000 });
        const withReason = { list: html('sites-list-container'), time: text('forecast-time-label') };
        vi.advanceTimersByTime(90000);
        const ready = text('weather-retry-btn');
        SitesView.handleWeatherFetchResult({ success: false, cooldownRemainingMs: 0 });
        expect({ withReason, ready, noReason: html('sites-list-container') }).toMatchSnapshot();
    });

    it('forecast time label', () => {
        SitesView.updateForecastLabel();
        const now = text('forecast-time-label');
        SitesService.state.forecastOffset = 2;
        SitesView.updateForecastLabel();
        expect({
            now,
            later: text('forecast-time-label'),
            aria: document.getElementById('forecast-slider').getAttribute('aria-valuetext'),
        }).toMatchSnapshot();
    });

    it('filter menus and saved places', () => {
        SitesView.renderDropdowns();
        SitesView.renderSavedLocations();
        expect({
            wind: html('menu-wind'),
            type: html('menu-type'),
            maps: html('menu-map-settings'),
            saved: html('saved-locations-list'),
        }).toMatchSnapshot();
    });

    it('more maps sheet, with and without a spotted site', () => {
        SitesView.openMoreMapsDropdown();
        const generic = {
            grid: html('more-maps-grid'),
            title: text('more-maps-title'),
            sub: text('more-maps-subtitle'),
        };
        SitesView.state._spottedSite = { lat: 50.7, lon: 1.65, siteName: 'Mont Lambert', extraId: '1' };
        SitesView.openMoreMapsDropdown();
        expect({
            generic,
            spotted: { grid: html('more-maps-grid'), title: text('more-maps-title'), sub: text('more-maps-subtitle') },
        }).toMatchSnapshot();
    });

    it('fullscreen button, toast, SpotAiR title, embedded map label', () => {
        SitesView.toggleFullscreen();
        const reduce = html('map-toggle-fullscreen');
        SitesView.toggleFullscreen();
        const full = html('map-toggle-fullscreen');
        SitesView.showSpotItToast('Mont Lambert');
        const toast = html('spot-it-toast');
        vi.spyOn(SitesService, 'getSiteById').mockReturnValueOnce(SITES[0]).mockReturnValueOnce(null);
        SitesView.openSpotairModal('67', 1);
        const titled = text('spotair-modal-title');
        SitesView.openSpotairModal('67', 99);
        const generic = text('spotair-modal-title');
        SitesView.loadIframeContent('windy', 46.5, 2.2, '', '', true);
        expect({ reduce, full, toast, titled, generic, windy: text('windy-active-spot-name') }).toMatchSnapshot();
    });

    it('details toggle and copied coordinates', async () => {
        const details = document.createElement('details');
        details.innerHTML = '<summary><span class="toggle-text"></span></summary>';
        details.open = true;
        SitesView.handleDetailsToggle('1', details);
        const open = details.querySelector('.toggle-text').textContent;
        details.open = false;
        SitesView.handleDetailsToggle('1', details);
        const closed = details.querySelector('.toggle-text').textContent;
        const btn = document.createElement('button');
        Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText: () => Promise.resolve() },
        });
        SitesView.copyCoords('50.7', '1.65', btn);
        await Promise.resolve();
        await Promise.resolve();
        expect({ open, closed, copied: btn.innerHTML }).toMatchSnapshot();
    });
});
