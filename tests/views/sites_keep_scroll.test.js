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
});
