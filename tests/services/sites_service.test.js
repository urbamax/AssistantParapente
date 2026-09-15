import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import SitesService from '../../js/services/sites_service.js';
import StorageService from '../../js/services/storage.js';

describe('SitesService', () => {

    beforeEach(() => {
        localStorage.clear();
        SitesService.state.weatherForecasts = {};
        SitesService.state.filterWindInclude = [];
        SitesService.state.filterWindExclude = [];
        SitesService._weatherCache = new Map(); // avoid cross-test hits on the 10-min weather cache
        global.SITES_DATA = [
            { id: 1, nom: 'Annecy', latitude: 45.9, longitude: 6.1, affiche: true, orientations_vent: ['N', 'NE'], type_pratique: ['Vol local'] },
            { id: 2, nom: 'Chamonix', lat: 45.92, lon: 6.86, affiche: true, orientations_vent: 'S,SO', type_pratique: 'Cross' },
            { id: 3, nom: 'Hidden', latitude: 0, longitude: 0, affiche: false }
        ];

        global.fetch = vi.fn();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete global.SITES_DATA;
    });

    it('fetchWeatherForSites sets weatherForecasts on success', async () => {
        const mockApiResponse = [
            {
                latitude: 45.9,
                longitude: 6.1,
                hourly: {
                    time: ['2026-08-22T00:00', '2026-08-22T01:00'],
                    wind_speed_10m: [10, 15],
                    wind_direction_10m: [45, 90],
                    wind_gusts_10m: [20, 25],
                    precipitation: [0, 0]
                },
                daily: { sunrise: ['2026-08-22T06:00'], sunset: ['2026-08-22T20:00'] }
            },
            {
                latitude: 45.92,
                longitude: 6.86,
                hourly: {
                    time: ['2026-08-22T00:00', '2026-08-22T01:00'],
                    wind_speed_10m: [5, 10],
                    wind_direction_10m: [180, 200],
                    wind_gusts_10m: [10, 15],
                    precipitation: [0, 1]
                },
                daily: { sunrise: ['2026-08-22T06:00'], sunset: ['2026-08-22T20:00'] }
            }
        ];

        global.fetch.mockResolvedValue({
            json: vi.fn().mockResolvedValue(mockApiResponse)
        });

        await SitesService.fetchWeatherForSites();

        expect(global.fetch).toHaveBeenCalledTimes(1);
        const url = global.fetch.mock.calls[0][0];
        expect(url).toContain('latitude=45.9,45.92');
        expect(url).toContain('longitude=6.1,6.86');

        expect(Object.keys(SitesService.state.weatherForecasts)).toHaveLength(2);
        expect(SitesService.state.weatherForecasts[1]).toBeDefined();
        expect(SitesService.state.weatherForecasts[2]).toBeDefined();
    });

    it('fetchWeatherForSites serves cached forecasts within the TTL without re-fetching', async () => {
        const mockApiResponse = [
            { latitude: 45.9, longitude: 6.1, hourly: { time: ['2026-08-22T00:00'], wind_speed_10m: [10], wind_direction_10m: [45], wind_gusts_10m: [20], precipitation: [0] }, daily: { sunrise: ['2026-08-22T06:00'], sunset: ['2026-08-22T20:00'] } },
            { latitude: 45.92, longitude: 6.86, hourly: { time: ['2026-08-22T00:00'], wind_speed_10m: [5], wind_direction_10m: [180], wind_gusts_10m: [10], precipitation: [0] }, daily: { sunrise: ['2026-08-22T06:00'], sunset: ['2026-08-22T20:00'] } }
        ];
        global.fetch.mockResolvedValue({ json: vi.fn().mockResolvedValue(mockApiResponse) });

        await SitesService.fetchWeatherForSites();
        await SitesService.fetchWeatherForSites();

        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('fetchWeatherForSites handles network errors gracefully', async () => {
        global.fetch.mockRejectedValue(new Error("Network Error"));
        
        const result = await SitesService.fetchWeatherForSites();
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        
        // The service should catch the error and not crash
        expect(Object.keys(SitesService.state.weatherForecasts)).toHaveLength(0);
    });

    it('filter functions update state correctly', () => {
        SitesService.cycleFilterState('wind', 'N');
        SitesService.cycleFilterState('wind', 'NE');
        expect(SitesService.state.filterWindInclude).toContain('N');
        expect(SitesService.state.filterWindInclude).toContain('NE');
        
        SitesService.toggleFavorite(1);
        let prefs = JSON.parse(localStorage.getItem('parapente_user_prefs') || '{}');
        expect(prefs.favoriteSites).toContain(1);
    });
});
