import { describe, it, expect, afterEach, vi } from 'vitest';
import { currentForecastIndex, forecastTimeMs } from '../../js/services/sites_forecast_fetch.js';
import SitesService from '../../js/services/sites_service.js';
import IDBStorage from '../../js/services/idb_storage.js';

// Open-Meteo (timezone=auto) donne les heures dans le fuseau du site : La Réunion est à UTC+4,
// la métropole à UTC+1 en hiver. « Maintenant » doit être cherché site par site.
const REUNION = 4 * 3600;
const PARIS_WINTER = 3600;
// 21 novembre 2026, 11:00 UTC = 12:00 à Paris = 15:00 à La Réunion.
const NOW = Date.UTC(2026, 10, 21, 11, 0);
const hours = (from, count) =>
    Array.from({ length: count }, (_, i) => `2026-11-21T${String(from + i).padStart(2, '0')}:00`);

describe('forecast hours in the time zone of the site', () => {
    afterEach(() => vi.restoreAllMocks());

    it('reads an hour of a site with its own UTC offset', () => {
        expect(forecastTimeMs('2026-11-21T15:00', REUNION)).toBe(NOW);
        expect(forecastTimeMs('2026-11-21T12:00', PARIS_WINTER)).toBe(NOW);
    });

    it('finds « now » at 15:00 for La Réunion and at 12:00 for Paris, whatever the phone time zone', () => {
        const times = hours(0, 24);
        expect(times[currentForecastIndex(times, REUNION, NOW)]).toBe('2026-11-21T15:00');
        expect(times[currentForecastIndex(times, PARIS_WINTER, NOW)]).toBe('2026-11-21T12:00');
    });

    it('drops the past hours of a saved forecast in the time zone of its site', async () => {
        vi.spyOn(IDBStorage, 'getValuesByPrefix').mockResolvedValue([
            {
                key: 'forecast:run',
                value: {
                    siteId: 'run',
                    modelKey: 'gfs',
                    fetchedAt: NOW - 3_600_000,
                    utcOffsetSeconds: REUNION,
                    forecasts: hours(13, 5).map((time) => ({ time, windSpeed: 10 })),
                },
            },
        ]);
        vi.spyOn(IDBStorage, 'deleteValues').mockResolvedValue(true);
        vi.spyOn(SitesService, '_setupForecastSlider').mockImplementation(() => {});
        vi.spyOn(SitesService, 'canUseForecast').mockReturnValue(true);
        expect(await SitesService.restoreForecastSnapshot(NOW + 10 * 60_000)).toBe(1);
        expect(SitesService.state.weatherForecasts.run.map((h) => h.time)).toEqual([
            '2026-11-21T15:00',
            '2026-11-21T16:00',
            '2026-11-21T17:00',
        ]);
        expect(SitesService.state.forecastProvenance.run.utcOffsetSeconds).toBe(REUNION);
    });
});
