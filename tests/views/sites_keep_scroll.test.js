import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import SitesService from '../../js/services/sites_service.js';
import SitesView from '../../js/views/sites.js';

// Spec 040 : toucher une étiquette de vent ou un type de site dans une fiche applique le filtre,
// mais ne fait plus remonter l'écran tout en haut.
describe('sites: filtering from a card keeps the scroll position (spec 040)', () => {
    let scrollTo;

    beforeEach(() => {
        document.body.innerHTML = '<div id="sites-screen"></div>';
        scrollTo = vi.fn();
        /** @type {any} */ (document.getElementById('sites-screen')).scrollTo = scrollTo;
        SitesService.state.filterWindInclude = [];
        SitesService.state.filterWindExclude = [];
        SitesService.state.filterTypeInclude = [];
        SitesService.state.filterTypeExclude = [];
        vi.spyOn(SitesView, 'updateBadges').mockImplementation(() => {});
        vi.spyOn(SitesView, 'renderDropdowns').mockImplementation(() => {});
        vi.spyOn(SitesView, 'renderList').mockImplementation(() => {});
        vi.spyOn(SitesView, 'updateMapMarkers').mockImplementation(() => {});
        vi.spyOn(SitesService, 'savePreferences').mockImplementation(() => {});
        vi.spyOn(SitesService, 'scheduleWeatherRescopeIfNeeded').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    it('applies a wind filter without scrolling', () => {
        SitesView.filterByTag('NW');
        expect(SitesService.state.filterWindInclude).toEqual(['NW']);
        expect(SitesView.renderList).toHaveBeenCalledTimes(1);
        expect(scrollTo).not.toHaveBeenCalled();
    });

    it('applies a type filter without scrolling', () => {
        SitesView.filterByType('Pente');
        expect(SitesService.state.filterTypeInclude).toEqual(['Pente']);
        expect(SitesView.renderList).toHaveBeenCalledTimes(1);
        expect(scrollTo).not.toHaveBeenCalled();
    });

    it('still brings the map into view with the "Spot it" button, and only with it', () => {
        document.body.innerHTML += '<div id="sites-map-view"></div>';
        const scrollIntoView = vi.fn();
        /** @type {any} */ (document.getElementById('sites-map-view')).scrollIntoView = scrollIntoView;
        vi.spyOn(SitesView, 'switchMapMode').mockImplementation(() => {});
        vi.spyOn(SitesView, 'loadIframeContent').mockImplementation(() => {});
        vi.spyOn(SitesView, 'showSpotItToast').mockImplementation(() => {});

        SitesView.filterByTag('NW');
        SitesView.filterByType('Pente');
        expect(scrollIntoView).not.toHaveBeenCalled();

        SitesView.spotSite(45.1, 6.2, 'Site test', '12');
        expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    });

    it('still scrolls to the top with the back-to-top button', () => {
        SitesView.scrollToTop();
        expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    });

    it('scrolls to the site card and highlights it when clicking a map marker', () => {
        const markerHandlers = {};
        const fakeMarker = {
            bindTooltip: vi.fn().mockReturnThis(),
            on: vi.fn((event, handler) => {
                markerHandlers[event] = handler;
                return fakeMarker;
            }),
        };
        globalThis.L = {
            marker: vi.fn(() => fakeMarker),
            divIcon: vi.fn(() => ({})),
        };
        SitesView.state.map = {};
        SitesView.state.markersGroup = {
            clearLayers: vi.fn(),
            addLayer: vi.fn(),
        };
        SitesView.state.ignoreNextFitBounds = true;
        vi.spyOn(SitesService, 'getSites').mockReturnValue([
            { id: 'arbas-665', nom: 'Arbas', latitude: 42.98, longitude: 0.88 },
        ]);
        vi.spyOn(SitesService, 'getFilteredAndSortedSites').mockReturnValue([
            { id: 'arbas-665', nom: 'Arbas', latitude: 42.98, longitude: 0.88 },
        ]);
        vi.spyOn(SitesView, 'updateMapMarkers').mockRestore();

        document.body.innerHTML += '<div id="site-card-arbas-665" class="site-card"></div>';
        const card = document.getElementById('site-card-arbas-665');
        const cardScrollIntoView = vi.fn();
        /** @type {any} */ (card).scrollIntoView = cardScrollIntoView;

        SitesView.updateMapMarkers();
        expect(markerHandlers.click).toBeTypeOf('function');

        markerHandlers.click();
        expect(cardScrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
        expect(card.classList.contains('highlight-glow')).toBe(true);
    });
});
