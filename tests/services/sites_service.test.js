import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import SitesService from '../../js/services/sites_service.js';
import {
    aromeTailResponse,
    COMPLETE_HOUR,
    completeHourWith,
    nearestHourIso,
    SITES_AROUND_BOULOGNE,
    metaJson,
} from '../fixtures/forecasts.js';
import { DEFAULT_LOCATION } from '../../js/data/weather_config.js';

function currentHourIso() {
    return nearestHourIso();
}

describe('SitesService', () => {
    beforeEach(() => {
        localStorage.clear();
        SitesService.state.weatherForecasts = {};
        SitesService.state.filterWindInclude = [];
        SitesService.state.filterWindExclude = [];
        SitesService._weatherCache = new Map(); // avoid cross-test hits on the 10-min weather cache
        SitesService._weatherCooldownUntil = 0; // avoid cross-test hits on the post-429 cooldown
        // Spec 002 : le rayon s'applique toujours (Boulogne-sur-Mer sans position). Les sites de
        // test sont à Annecy / Chamonix : on se place à Annecy avec le rayon maximal.
        SitesService.state.userLocation = { lat: 45.9, lng: 6.1 };
        SitesService.state.radiusLimit = 200;
        SitesService.state.searchQuery = '';
        SitesService.state.userPreferences = { ...(SitesService.state.userPreferences || {}), favoriteSites: [] };
        SitesService.setSites([
            {
                id: 1,
                nom: 'Annecy',
                latitude: 45.9,
                longitude: 6.1,
                affiche: true,
                orientations_vent: ['N', 'NE'],
                type_pratique: ['Vol local'],
            },
            {
                id: 2,
                nom: 'Chamonix',
                lat: 45.92,
                lon: 6.86,
                affiche: true,
                orientations_vent: 'S,SO',
                type_pratique: 'Cross',
            },
            { id: 3, nom: 'Hidden', latitude: 0, longitude: 0, affiche: false },
        ]);

        global.fetch = vi.fn();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        SitesService.setSites([]);
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
                    precipitation: [0, 0],
                },
                daily: { sunrise: ['2026-08-22T06:00'], sunset: ['2026-08-22T20:00'] },
            },
            {
                latitude: 45.92,
                longitude: 6.86,
                hourly: {
                    time: ['2026-08-22T00:00', '2026-08-22T01:00'],
                    wind_speed_10m: [5, 10],
                    wind_direction_10m: [180, 200],
                    wind_gusts_10m: [10, 15],
                    precipitation: [0, 1],
                },
                daily: { sunrise: ['2026-08-22T06:00'], sunset: ['2026-08-22T20:00'] },
            },
        ];

        global.fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: vi.fn().mockResolvedValue(mockApiResponse),
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
            {
                latitude: 45.9,
                longitude: 6.1,
                hourly: {
                    time: ['2026-08-22T00:00'],
                    wind_speed_10m: [10],
                    wind_direction_10m: [45],
                    wind_gusts_10m: [20],
                    precipitation: [0],
                },
                daily: { sunrise: ['2026-08-22T06:00'], sunset: ['2026-08-22T20:00'] },
            },
            {
                latitude: 45.92,
                longitude: 6.86,
                hourly: {
                    time: ['2026-08-22T00:00'],
                    wind_speed_10m: [5],
                    wind_direction_10m: [180],
                    wind_gusts_10m: [10],
                    precipitation: [0],
                },
                daily: { sunrise: ['2026-08-22T06:00'], sunset: ['2026-08-22T20:00'] },
            },
        ];
        global.fetch.mockResolvedValue({ ok: true, status: 200, json: vi.fn().mockResolvedValue(mockApiResponse) });

        await SitesService.fetchWeatherForSites();
        await SitesService.fetchWeatherForSites();

        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('fetchWeatherForSites handles network errors gracefully', async () => {
        global.fetch.mockRejectedValue(new Error('Network Error'));

        const result = await SitesService.fetchWeatherForSites();
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();

        // The service should catch the error and not crash
        expect(Object.keys(SitesService.state.weatherForecasts)).toHaveLength(0);
    });

    it('fetchWeatherForSites retries a 429 with backoff and succeeds once the quota frees up', async () => {
        vi.useFakeTimers();
        const mockApiResponse = [{ latitude: 45.9, longitude: 6.1, hourly: { time: [], wind_speed_10m: [] } }];
        global.fetch
            .mockResolvedValueOnce({ ok: false, status: 429 })
            .mockResolvedValueOnce({ ok: true, status: 200, json: vi.fn().mockResolvedValue(mockApiResponse) });

        const pending = SitesService.fetchWeatherForSites();
        await vi.advanceTimersByTimeAsync(3000);
        await pending;

        expect(global.fetch).toHaveBeenCalledTimes(2);
        expect(SitesService.state.weatherForecasts[1]).toBeDefined();
        expect(SitesService.getWeatherCooldownRemainingMs()).toBe(0);
        vi.useRealTimers();
    });

    it('fetchWeatherForSites gives up after 3 attempts and starts a cooldown', async () => {
        vi.useFakeTimers();
        global.fetch.mockResolvedValue({ ok: false, status: 429 });

        const pending = SitesService.fetchWeatherForSites();
        await vi.advanceTimersByTimeAsync(20000);
        const result = await pending;

        expect(global.fetch).toHaveBeenCalledTimes(3);
        expect(result.success).toBe(false);
        expect(result.cooldownRemainingMs).toBeGreaterThan(0);
        vi.useRealTimers();
    });

    it('fetchWeatherForSites skips the network entirely while the cooldown is active', async () => {
        SitesService._weatherCooldownUntil = Date.now() + 60000;

        const result = await SitesService.fetchWeatherForSites();

        expect(global.fetch).not.toHaveBeenCalled();
        expect(result.success).toBe(false);
        expect(result.cooldownRemainingMs).toBeGreaterThan(0);
    });

    it('filter functions update state correctly', () => {
        SitesService.cycleFilterState('wind', 'N');
        SitesService.cycleFilterState('wind', 'NE');
        expect(SitesService.state.filterWindInclude).toContain('N');
        expect(SitesService.state.filterWindInclude).toContain('NE');

        SitesService.toggleFavorite(1);
        const prefs = JSON.parse(localStorage.getItem('parapente_user_prefs') || '{}');
        expect(prefs.favoriteSites).toContain(1);
    });

    it('getSiteById retrieves a site by id in O(1) via internal Map', () => {
        const site1 = SitesService.getSiteById(1);
        expect(site1).toBeDefined();
        expect(site1.nom).toBe('Annecy');

        const site2 = SitesService.getSiteById('2');
        expect(site2).toBeDefined();
        expect(site2.nom).toBe('Chamonix');

        expect(SitesService.getSiteById(999)).toBeNull();
        expect(SitesService.getSiteById(null)).toBeNull();
    });

    it('hideUnflyable hides sites with no flyable hour but keeps sites whose forecast is not loaded', () => {
        const sites = SitesService.getSites().filter((site) => site.affiche !== false);
        vi.spyOn(SitesService, 'getGeoFilteredSites').mockImplementation((data) => data);
        vi.spyOn(SitesService, 'isForecastFlyable').mockReturnValue({ flyable: false });
        SitesService.state.hideUnflyable = true;
        SitesService.state.filterFavoritesOnly = false;
        SitesService.state.weatherForecasts = { 1: [{ time: '2026-09-28T12:00' }] }; // 2 : météo absente

        const ids = SitesService.getFilteredAndSortedSites(sites).map((site) => site.id);
        SitesService.state.hideUnflyable = false;

        expect(ids).not.toContain(1);
        expect(ids).toContain(2);
    });

    describe('missing forecast values (spec 001, US1)', () => {
        const mockOnce = (payload) =>
            global.fetch.mockResolvedValue({ ok: true, status: 200, json: vi.fn().mockResolvedValue(payload) });

        it('stores null, never 0, for values missing at the end of the AROME horizon', async () => {
            const site = aromeTailResponse(currentHourIso(), { complete: 2, empty: 3 });
            mockOnce([site, site]);
            await SitesService.fetchWeatherForSites();

            const hours = SitesService.state.weatherForecasts[1];
            expect(hours.length).toBeGreaterThanOrEqual(5);
            expect(hours[0].windSpeed).toBe(15);
            const empty = hours[3];
            expect(empty.windSpeed).toBeNull();
            expect(empty.windGust).toBeNull();
            expect(empty.windDirDeg).toBeNull();
            expect(empty.windCard).toBeNull();
            expect(empty.precipitation).toBeNull();
        });

        it('stores isDaytime null when sunrise/sunset is missing for that day', async () => {
            const site = aromeTailResponse(currentHourIso(), { complete: 2, empty: 0 });
            site.daily = { time: [], sunrise: [], sunset: [] };
            mockOnce([site, site]);
            await SitesService.fetchWeatherForSites();
            expect(SitesService.state.weatherForecasts[1][0].isDaytime).toBeNull();
        });

        describe('aggregates', () => {
            const site = { id: 42, nom: 'Test', orientations_vent: ['S'], latitude: 45, longitude: 6 };
            const hour = (h, overrides = {}) =>
                completeHourWith({ time: `2026-09-29T${String(h).padStart(2, '0')}:00`, ...overrides });
            const empty = (h) => hour(h, { windSpeed: null, windGust: null });
            const night = (h) => hour(h, { isDaytime: false });

            beforeEach(() => {
                vi.spyOn(SitesService, 'getGeoFilteredSites').mockImplementation((data) => data);
                SitesService.state.hideUnflyable = false;
                SitesService.state.filterFavoritesOnly = false;
                SitesService.state.forecastMaxRange = 24;
                SitesService.state.conditionsStrategy = 'TOTAL';
                SitesService.state.limitWindMin = 5;
                SitesService.state.limitWindMax = 25;
                SitesService.state.limitGustDelta = 15;
                SitesService.state.filterMode = 'manual';
            });

            it('never counts incomplete hours as flyable, and they end a consecutive run', () => {
                SitesService.state.weatherForecasts = {
                    42: [hour(10), hour(11), empty(12), hour(13), night(14), empty(15)],
                };
                const [res] = SitesService.getFilteredAndSortedSites([site]);
                expect(res.flyableHours).toBe(3);
                expect(res.maxConsecutiveHours).toBe(2);
                expect(res.conditionScore).toBe(3);
                expect(res.flyableSlots).toEqual([
                    { dayLabel: 'Mar', start: 10, end: 11 },
                    { dayLabel: 'Mar', start: 13, end: 13 },
                ]);
                expect(res.completeHours).toBe(4);
            });

            it('reports 0 complete hours when every hour is incomplete', () => {
                SitesService.state.weatherForecasts = { 42: [empty(10), empty(11)] };
                const [res] = SitesService.getFilteredAndSortedSites([site]);
                expect(res.flyableHours).toBe(0);
                expect(res.completeHours).toBe(0);
            });

            it('hideUnflyable hides a site whose loaded hours are all incomplete (spec assumption)', () => {
                SitesService.state.hideUnflyable = true;
                SitesService.state.weatherForecasts = { 42: [empty(10), empty(11)] };
                const ids = SitesService.getFilteredAndSortedSites([site]).map((x) => x.id);
                SitesService.state.hideUnflyable = false;
                expect(ids).toEqual([]);
            });
        });

        describe('model agreement', () => {
            const site = { id: 7, orientations_vent: ['S'] };
            beforeEach(() => {
                SitesService.state.forecastOffset = 0;
                SitesService.state.limitWindMin = 5;
                SitesService.state.limitWindMax = 25;
                SitesService.state.limitGustDelta = 15;
                SitesService.state.filterMode = 'manual';
            });

            it('is unavailable (null) when the primary hour is incomplete', () => {
                SitesService.state.weatherForecasts = { 7: [completeHourWith({ windGust: null })] };
                SitesService.state.weatherForecastsSecondary = { 7: COMPLETE_HOUR };
                expect(SitesService.getModelAgreement(site)).toBeNull();
            });

            it('is unavailable (null) when the secondary hour is incomplete', () => {
                SitesService.state.weatherForecasts = { 7: [COMPLETE_HOUR] };
                SitesService.state.weatherForecastsSecondary = { 7: completeHourWith({ windSpeed: null }) };
                expect(SitesService.getModelAgreement(site)).toBeNull();
            });

            it('secondary fetch stores null for missing values', async () => {
                SitesService.setSites([{ id: 7, nom: 'Fav', latitude: 45, longitude: 6, orientations_vent: ['S'] }]);
                SitesService.state.userPreferences = { favoriteSites: [7] };
                const payload = aromeTailResponse(currentHourIso(), { complete: 0, empty: 2 });
                mockOnce(payload);
                await SitesService.fetchSecondaryModelForFavorites();
                const sec = SitesService.state.weatherForecastsSecondary[7];
                expect(sec.windSpeed).toBeNull();
                expect(sec.windGust).toBeNull();
                expect(sec.windCard).toBeNull();
                expect(sec.precipitation).toBeNull();
            });
        });
    });

    describe('unknown orientation (spec 001, US2)', () => {
        beforeEach(() => {
            vi.spyOn(SitesService, 'getGeoFilteredSites').mockImplementation((data) => data);
            SitesService.state.hideUnflyable = false;
            SitesService.state.filterFavoritesOnly = false;
            SitesService.state.forecastMaxRange = 24;
            SitesService.state.conditionsStrategy = 'TOTAL';
            SitesService.state.limitWindMin = 5;
            SitesService.state.limitWindMax = 25;
            SitesService.state.limitGustDelta = 15;
            SitesService.state.filterMode = 'manual';
        });

        it('counts flyable hours for a site without orientation and sorts without crashing on a null score', () => {
            const noOrientation = { id: 50, nom: 'Sans orientation', latitude: 45, longitude: 6 };
            const south = { id: 51, nom: 'Sud', latitude: 45, longitude: 6, orientations_vent: ['S'] };
            const hours = [
                completeHourWith({ time: '2026-09-29T10:00' }),
                completeHourWith({ time: '2026-09-29T11:00' }),
            ];
            SitesService.state.weatherForecasts = { 50: hours, 51: hours };
            const res = SitesService.getFilteredAndSortedSites([noOrientation, south]);
            const byId = Object.fromEntries(res.map((x) => [x.id, x]));
            expect(byId[50].flyableHours).toBe(2);
            expect(byId[51].flyableHours).toBe(2);
            expect(SitesService.isForecastFlyable(noOrientation, hours[0]).score).toBeNull();
        });
    });

    describe('thunderstorm indicator (spec 001, US3)', () => {
        const currentStart = () => nearestHourIso();

        it('requests CAPE in the primary forecast and stores it on each hour', async () => {
            const site = aromeTailResponse(currentStart(), { complete: 2, empty: 1 });
            global.fetch.mockResolvedValue({ ok: true, status: 200, json: vi.fn().mockResolvedValue([site, site]) });
            await SitesService.fetchWeatherForSites();
            const url = global.fetch.mock.calls[0][0];
            expect(new URL(url).searchParams.get('hourly').split(',')).toContain('cape');
            const hours = SitesService.state.weatherForecasts[1];
            expect(hours[0].cape).toBe(100);
            expect(hours[2].cape).toBeNull();
        });

        it('requests CAPE for the secondary (confidence) model too', async () => {
            SitesService.setSites([{ id: 7, nom: 'Fav', latitude: 45, longitude: 6, orientations_vent: ['S'] }]);
            SitesService.state.userPreferences = { favoriteSites: [7] };
            const payload = aromeTailResponse(currentStart(), { complete: 1, empty: 0 });
            global.fetch.mockResolvedValue({ ok: true, status: 200, json: vi.fn().mockResolvedValue(payload) });
            await SitesService.fetchSecondaryModelForFavorites();
            const url = global.fetch.mock.calls[0][0];
            expect(new URL(url).searchParams.get('hourly').split(',')).toContain('cape');
            expect(SitesService.state.weatherForecastsSecondary[7].cape).toBe(100);
        });
    });

    describe('bounded weather requests around the pilot (spec 002, US4)', () => {
        const ids = (sites) => sites.map((x) => x.id).sort((a, b) => a - b);

        beforeEach(() => {
            SitesService.setSites(SITES_AROUND_BOULOGNE.map((x) => ({ ...x })));
            SitesService.state.userLocation = null;
            SitesService.state.radiusLimit = 50;
            SitesService.state.searchQuery = '';
            SitesService.state.userPreferences = { favoriteSites: [] };
        });

        it('uses Boulogne-sur-Mer when no position is known, the real position otherwise', () => {
            expect(SitesService.getEffectiveLocation()).toEqual(DEFAULT_LOCATION);
            SitesService.state.userLocation = { lat: 45.9, lng: 6.1 };
            expect(SitesService.getEffectiveLocation()).toEqual({ lat: 45.9, lng: 6.1 });
        });

        it('applies the radius around Boulogne-sur-Mer when no position is known', () => {
            expect(ids(SitesService.getGeoFilteredSites(SitesService.getSites()))).toEqual([101, 102, 103]);
        });

        it('widens up to 200 km', () => {
            SitesService.state.radiusLimit = 200;
            expect(ids(SitesService.getGeoFilteredSites(SitesService.getSites()))).toEqual([101, 102, 103, 104, 105]);
        });

        it('always keeps favourite sites, even beyond the radius', () => {
            SitesService.state.userPreferences = { favoriteSites: [106] };
            expect(ids(SitesService.getGeoFilteredSites(SitesService.getSites()))).toEqual([101, 102, 103, 106]);
        });

        it('clamps the radius to 10–200 km', () => {
            SitesService.setRadiusLimit(500);
            expect(SitesService.state.radiusLimit).toBe(200);
            SitesService.setRadiusLimit(2);
            expect(SitesService.state.radiusLimit).toBe(10);
        });

        it('requests weather only for the sites in the radius plus favourites', async () => {
            SitesService.state.userPreferences = { favoriteSites: [106] };
            const one = aromeTailResponse(nearestHourIso(), { complete: 2, empty: 0 });
            global.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: vi.fn().mockResolvedValue([one, one, one, one]),
            });
            await SitesService.fetchWeatherForSites();
            const forecastCalls = global.fetch.mock.calls
                .map((c) => String(c[0]))
                .filter((u) => u.includes('latitude='));
            expect(forecastCalls).toHaveLength(1);
            const lats = new URL(forecastCalls[0]).searchParams.get('latitude').split(',');
            expect(lats).toHaveLength(4);
        });

        it('counts search matches outside the radius without requesting them (FR-019)', () => {
            SitesService.state.searchQuery = 'amiens';
            expect(SitesService.getGeoFilteredSites(SitesService.getSites())).toEqual([]);
            expect(SitesService.countSearchMatchesOutsideRadius()).toBe(1);
            SitesService.state.searchQuery = 'wimereux';
            expect(SitesService.countSearchMatchesOutsideRadius()).toBe(0);
        });
    });

    describe('forecast provenance (spec 002, US1)', () => {
        const payload = () => {
            const one = aromeTailResponse(nearestHourIso(), { complete: 2, empty: 0 });
            return [one, one];
        };

        it('records the model and the original retrieval time, unchanged when read from cache', async () => {
            const now = vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
            global.fetch.mockResolvedValue({ ok: true, status: 200, json: vi.fn().mockResolvedValue(payload()) });
            SitesService.state.weatherModel = 'meteofrance';
            await SitesService.fetchWeatherForSites();
            expect(SitesService.getForecastProvenance(1)).toMatchObject({
                modelKey: 'meteofrance',
                fetchedAt: 1_800_000_000_000,
            });

            now.mockReturnValue(1_800_000_000_000 + 5 * 60 * 1000); // 5 min plus tard : servi par le cache
            await SitesService.fetchWeatherForSites();
            expect(global.fetch).toHaveBeenCalledTimes(1);
            expect(SitesService.getForecastProvenance(1).fetchedAt).toBe(1_800_000_000_000);
        });

        it('reads the model run time from Open-Meteo metadata and caches it', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: vi.fn().mockResolvedValue(metaJson({ runAtS: 1_790_000_000 })),
            });
            SitesService._runTimeCache = new Map();
            expect(await SitesService.fetchModelRunTime('meteofrance')).toBe(1_790_000_000_000);
            expect(String(global.fetch.mock.calls[0][0])).toBe(
                'https://api.open-meteo.com/data/meteofrance_arome_france_hd/static/meta.json',
            );
            await SitesService.fetchModelRunTime('meteofrance');
            expect(global.fetch).toHaveBeenCalledTimes(1);
        });

        it('has no run time for the automatic multi-model selection, and never asks for one', async () => {
            SitesService._runTimeCache = new Map();
            expect(await SitesService.fetchModelRunTime('best_match')).toBeNull();
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('returns null (no run time shown) when the metadata request fails', async () => {
            SitesService._runTimeCache = new Map();
            global.fetch.mockResolvedValue({ ok: false, status: 500, json: vi.fn() });
            expect(await SitesService.fetchModelRunTime('gfs')).toBeNull();
            global.fetch.mockRejectedValue(new Error('offline'));
            SitesService._runTimeCache = new Map();
            expect(await SitesService.fetchModelRunTime('gfs')).toBeNull();
        });

        it('exposes the run time in the provenance once known', async () => {
            vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
            global.fetch.mockResolvedValue({ ok: true, status: 200, json: vi.fn().mockResolvedValue(payload()) });
            SitesService.state.weatherModel = 'gfs';
            await SitesService.fetchWeatherForSites();
            expect(SitesService.getForecastProvenance(1).runAt).toBeNull();
            SitesService._runTimeCache = new Map([['gfs', { at: 1_800_000_000_000, value: 1_799_990_000_000 }]]);
            expect(SitesService.getForecastProvenance(1).runAt).toBe(1_799_990_000_000);
        });

        it('uses the automatic selection endpoint for best_match; "meteoblue" no longer exists', () => {
            expect(SitesService._resolveModelEndpoint('best_match').apiEndpoint).toBe('forecast');
            expect(SitesService._resolveModelEndpoint('meteoblue').apiEndpoint).not.toBe('forecast');
        });
    });
});
