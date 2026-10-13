import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SitesService, { SITES_EVENTS } from '../../js/services/sites_service.js';
import AppRouter from '../../js/core/router.js';
import SitesView from '../../js/views/sites.js';

// Audit : SitesService appelait directement l'écran des sites (AppRouter.getView('SITES').renderList()…).
// Un service « sans état d'affichage » doit seulement annoncer ce qui change ; l'écran, s'il est ouvert, s'y abonne.
const DISPLAY_UPDATES = [
    ['renderList', SITES_EVENTS.LIST],
    ['updateMapMarkers', SITES_EVENTS.MARKERS],
    ['updateMapTogglesVisibility', SITES_EVENTS.MAP_TOGGLES],
    ['updateForecastLabel', SITES_EVENTS.FORECAST_LABEL],
    ['updateBadges', SITES_EVENTS.BADGES],
    ['renderDropdowns', SITES_EVENTS.DROPDOWNS],
];

afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    SitesView.unsubscribeFromService();
});

describe('SitesService annonce les mises à jour d’affichage', () => {
    it.each(DISPLAY_UPDATES)('%s émet « %s » sans connaître l’écran', (method, event) => {
        const getView = vi.spyOn(AppRouter, 'getView');
        const handler = vi.fn();
        const off = SitesService.on(event, handler);
        SitesService[method]();
        off();
        expect(handler).toHaveBeenCalledTimes(1);
        expect(getView).not.toHaveBeenCalled();
    });

    it('n’émet rien d’autre que l’événement correspondant', () => {
        const others = vi.fn();
        const offs = DISPLAY_UPDATES.filter(([m]) => m !== 'renderList').map(([, e]) => SitesService.on(e, others));
        SitesService.renderList();
        offs.forEach((off) => off());
        expect(others).not.toHaveBeenCalled();
    });

    it('sans abonné (écran fermé), les mises à jour ne font rien et ne plantent pas', () => {
        for (const [method] of DISPLAY_UPDATES) expect(() => SitesService[method]()).not.toThrow();
    });

    it('annonce le résultat d’une récupération météo en arrière-plan', async () => {
        vi.useFakeTimers();
        const result = { success: true };
        vi.spyOn(SitesService, 'getSites').mockReturnValue([{ id: 'a' }]);
        vi.spyOn(SitesService, 'getGeoFilteredSites').mockReturnValue([{ id: 'a' }]);
        vi.spyOn(SitesService, 'fetchWeatherForSites').mockResolvedValue(result);
        SitesService.state.weatherForecasts = {};
        const handler = vi.fn();
        const off = SitesService.on(SITES_EVENTS.WEATHER_FETCHED, handler);

        SitesService.scheduleWeatherRescopeIfNeeded();
        await vi.advanceTimersByTimeAsync(400);
        off();

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith(result);
    });
});

describe('SitesView applique ces mises à jour pendant qu’elle est ouverte', () => {
    beforeEach(() => {
        for (const m of [
            'renderList',
            'updateMapMarkers',
            'updateMapTogglesVisibility',
            'updateForecastLabel',
            'updateBadges',
            'renderDropdowns',
            'handleWeatherFetchResult',
        ]) {
            vi.spyOn(SitesView, m).mockImplementation(() => {});
        }
    });

    it.each(DISPLAY_UPDATES)('%s du service rafraîchit l’écran une fois abonné', (method) => {
        SitesView.subscribeToService();
        SitesService[method]();
        expect(SitesView[method]).toHaveBeenCalledTimes(1);
    });

    it('transmet le résultat météo à l’écran', () => {
        SitesView.subscribeToService();
        const result = { success: false, cooldownRemainingMs: 90000 };
        SitesService._events.emit(SITES_EVENTS.WEATHER_FETCHED, result);
        expect(SitesView.handleWeatherFetchResult).toHaveBeenCalledWith(result);
    });

    it('un second abonnement (remontage sans fermeture) ne double pas les rafraîchissements', () => {
        SitesView.subscribeToService();
        SitesView.subscribeToService();
        SitesService.renderList();
        expect(SitesView.renderList).toHaveBeenCalledTimes(1);
    });

    it('la fermeture réelle de l’écran (unmount) le désabonne du service', async () => {
        SitesView.subscribeToService();
        await SitesView.unmount();
        for (const event of Object.values(SITES_EVENTS)) expect(SitesService._events.listenerCount(event)).toBe(0);
        SitesService.renderList();
        expect(SitesView.renderList).not.toHaveBeenCalled();
    });

    it('écran fermé : plus aucun rafraîchissement, et aucun abonné ne reste', () => {
        SitesView.subscribeToService();
        SitesView.unsubscribeFromService();
        for (const [method] of DISPLAY_UPDATES) SitesService[method]();
        for (const [method] of DISPLAY_UPDATES) expect(SitesView[method]).not.toHaveBeenCalled();
        for (const event of Object.values(SITES_EVENTS)) expect(SitesService._events.listenerCount(event)).toBe(0);
    });
});
