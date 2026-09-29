import { describe, it, expect, vi } from 'vitest';
import { evaluateSpotForecast, normalizeForecastValue, getSiteOrientations } from '../js/weatherScoring.js';

describe('weatherScoring.js', () => {
    const basePrefs = {
        filterMode: 'manual',
        vMin: 5,
        vMax: 20,
        deltaRafaleMax: 10,
    };

    const baseSite = {
        orientation_ideale_deg: 90,
        orientations_vent: ['E', 'SE'],
    };

    it('returns unflyable if it is night', () => {
        const result = evaluateSpotForecast(baseSite, { isDaytime: false }, basePrefs);
        expect(result.flyable).toBe(false);
        expect(result.reason).toContain('Nuit');
    });

    it('returns unflyable if raining', () => {
        const weather = { isDaytime: true, precipitation: 2.5 };
        const result = evaluateSpotForecast(baseSite, weather, basePrefs);
        expect(result.flyable).toBe(false);
        expect(result.reason).toContain('Pluie');
    });

    it('returns unflyable if wind speed is out of limits', () => {
        const weatherHigh = {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 25,
            windGust: 25,
            windDirCard: 'E',
            windDirDeg: 90,
        };
        const resHigh = evaluateSpotForecast(baseSite, weatherHigh, basePrefs);
        expect(resHigh.flyable).toBe(false);
        expect(resHigh.reason).toContain('Vent hors limites');

        const weatherLow = {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 2,
            windGust: 2,
            windDirCard: 'E',
            windDirDeg: 90,
        };
        const resLow = evaluateSpotForecast(baseSite, weatherLow, basePrefs);
        expect(resLow.flyable).toBe(false);
    });

    it('returns unflyable if wind gust delta is too high', () => {
        const weather = {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 15,
            windGust: 30,
            windDirCard: 'E',
            windDirDeg: 90,
        };
        const result = evaluateSpotForecast(baseSite, weather, basePrefs);
        expect(result.flyable).toBe(false);
        expect(result.reason).toContain('Rafales hors limites');
    });

    it('returns unflyable if orientation is wrong', () => {
        const weather = {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 10,
            windGust: 12,
            windCard: 'N',
            windDirDeg: 0,
        };
        const result = evaluateSpotForecast(baseSite, weather, basePrefs);
        expect(result.flyable).toBe(false);
        expect(result.reason).toContain('Mauvaise orientation');
    });

    it('returns flyable with score for perfect conditions', () => {
        // Perfect wind is average of vMin and vMax: (5+20)/2 = 12.5
        // Perfect direction is 90
        const weather = {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 12.5,
            windGust: 12.5,
            windCard: 'E',
            windDirDeg: 90,
        };
        const result = evaluateSpotForecast(baseSite, weather, basePrefs);
        expect(result.flyable).toBe(true);
        expect(result.score).toBe(100);
    });
});

describe('equipment ("hardware") mode (spec 001, research R6)', () => {
    const site = { orientations_vent: ['S'] };
    const weather = {
        isDaytime: true,
        precipitation: 0,
        windSpeed: 15,
        windGust: 18,
        windDirDeg: 180,
        windCard: 'S',
        cape: 50,
    };

    it('uses the wings passed in the preferences and never reads localStorage', () => {
        const getItem = vi.spyOn(Storage.prototype, 'getItem');
        const prefs = {
            filterMode: 'hardware',
            vMin: 0,
            vMax: 40,
            deltaRafaleMax: 15,
            wings: [{ type: 'voile', nom: 'Ma voile', ventMin: 10, ventMax: 20 }],
        };
        const ok = evaluateSpotForecast(site, weather, prefs);
        expect(ok.flyable).toBe(true);
        expect(ok.reason).toContain('avec Ma voile');

        const tooStrong = evaluateSpotForecast(site, { ...weather, windSpeed: 25, windGust: 26 }, prefs);
        expect(tooStrong.flyable).toBe(false);
        expect(tooStrong.reason).toBe('Vent hors limites (Matériel)');

        expect(getItem).not.toHaveBeenCalled();
        getItem.mockRestore();
    });

    it('treats missing wings as "no wing fits"', () => {
        const res = evaluateSpotForecast(site, weather, {
            filterMode: 'hardware',
            vMin: 0,
            vMax: 40,
            deltaRafaleMax: 15,
        });
        expect(res.flyable).toBe(false);
        expect(res.reason).toBe('Vent hors limites (Matériel)');
    });
});

describe('normalizeForecastValue (spec 001, FR-001)', () => {
    const KINDS = ['windSpeed', 'windGust', 'windDir', 'precipitation', 'cape'];

    it.each(KINDS)('treats absent, empty, non-numeric and non-finite values as missing (%s)', (kind) => {
        for (const value of [null, undefined, '', '  ', 'abc', NaN, Infinity, -Infinity, {}, [], true]) {
            expect(normalizeForecastValue(value, kind)).toBeNull();
        }
    });

    it.each(KINDS)('treats negative values as missing (%s)', (kind) => {
        expect(normalizeForecastValue(-0.1, kind)).toBeNull();
        expect(normalizeForecastValue(-3, kind)).toBeNull();
    });

    it('treats wind directions outside 0–360° as missing', () => {
        expect(normalizeForecastValue(360.4, 'windDir')).toBeNull();
        expect(normalizeForecastValue(400, 'windDir')).toBeNull();
        expect(normalizeForecastValue(360, 'windDir')).toBe(360);
        expect(normalizeForecastValue(0, 'windDir')).toBe(0);
    });

    it('rounds wind values to integers, keeps precipitation and CAPE as is', () => {
        expect(normalizeForecastValue(12.4, 'windSpeed')).toBe(12);
        expect(normalizeForecastValue(12.5, 'windGust')).toBe(13);
        expect(normalizeForecastValue(179.6, 'windDir')).toBe(180);
        expect(normalizeForecastValue(0.35, 'precipitation')).toBe(0.35);
        expect(normalizeForecastValue(812.7, 'cape')).toBe(812.7);
        expect(normalizeForecastValue(0, 'windSpeed')).toBe(0);
    });

    it('accepts numeric strings', () => {
        expect(normalizeForecastValue('12.4', 'windSpeed')).toBe(12);
        expect(normalizeForecastValue('0.2', 'precipitation')).toBe(0.2);
    });
});

describe('getSiteOrientations (spec 001)', () => {
    it('reads an array field', () => {
        expect(getSiteOrientations({ orientations_vent: ['S', 'SO'] })).toEqual(['S', 'SO']);
    });

    it('reads a comma-separated string, trimming and upper-casing', () => {
        expect(getSiteOrientations({ orientations_vent: ' s , so,NO ' })).toEqual(['S', 'SO', 'NO']);
    });

    it('falls back to the legacy orientation field', () => {
        expect(getSiteOrientations({ orientation: 'N,NE' })).toEqual(['N', 'NE']);
    });

    it('keeps only the eight recognised labels', () => {
        expect(getSiteOrientations({ orientations_vent: ['S', 'Sud-Ouest', 'X', 'E'] })).toEqual(['S', 'E']);
    });

    it('returns [] when the orientation is missing, empty or unrecognised', () => {
        expect(getSiteOrientations({})).toEqual([]);
        expect(getSiteOrientations({ orientations_vent: [] })).toEqual([]);
        expect(getSiteOrientations({ orientations_vent: '' })).toEqual([]);
        expect(getSiteOrientations({ orientation: '' })).toEqual([]);
        expect(getSiteOrientations({ orientations_vent: ['Sud-Ouest'] })).toEqual([]);
        expect(getSiteOrientations(null)).toEqual([]);
    });
});
