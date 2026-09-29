import { describe, it, expect, vi } from 'vitest';
import { evaluateSpotForecast, normalizeForecastValue, getSiteOrientations } from '../js/weatherScoring.js';
import {
    DEFAULT_PREFS,
    SITE_SOUTH,
    COMPLETE_HOUR,
    completeHourWith,
    REFERENCE_CASES,
    REFERENCE_SITES,
    SITE_NO_ORIENTATION,
    SITE_UNRECOGNISED_ORIENTATION,
} from './fixtures/forecasts.js';

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
        const weather = {
            isDaytime: false,
            precipitation: 0,
            windSpeed: 12,
            windGust: 14,
            windCard: 'E',
            windDirDeg: 90,
        };
        const result = evaluateSpotForecast(baseSite, weather, basePrefs);
        expect(result.flyable).toBe(false);
        expect(result.reason).toContain('Nuit');
    });

    it('returns unflyable if raining', () => {
        const weather = {
            isDaytime: true,
            precipitation: 2.5,
            windSpeed: 12,
            windGust: 14,
            windCard: 'E',
            windDirDeg: 90,
        };
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

describe('incomplete forecasts never produce a verdict (spec 001, US1, FR-002/004/005/006)', () => {
    // Valeur « manquante » pour chaque donnée requise, et le code attendu dans `missing`.
    const MISSING = {
        windSpeed: { windSpeed: null },
        windGust: { windGust: null },
        windDir: { windDirDeg: null, windCard: null },
        precipitation: { precipitation: null },
        daylight: { isDaytime: null },
    };
    const ORDER = ['windSpeed', 'windGust', 'windDir', 'precipitation', 'cape', 'daylight'];
    const codes = Object.keys(MISSING);
    const combos = [...codes.map((c) => [c])];
    for (let i = 0; i < codes.length; i++) for (let j = i + 1; j < codes.length; j++) combos.push([codes[i], codes[j]]);

    it.each(combos.map((c) => [c.join(' + '), c]))('missing %s → incomplete', (_label, missingCodes) => {
        const overrides = Object.assign({}, ...missingCodes.map((c) => MISSING[c]));
        const res = evaluateSpotForecast(SITE_SOUTH, completeHourWith(overrides), DEFAULT_PREFS);
        expect(res.status).toBe('incomplete');
        expect(res.flyable).toBe(false);
        expect(res.score).toBeNull();
        expect(res.reasonCode).toBe('INCOMPLETE');
        expect(res.reason).toBe('Prévision incomplète');
        expect(res.missing).toEqual(ORDER.filter((c) => missingCodes.includes(c)));
        expect(res.class).toBe('weather-incomplete');
    });

    it('reproduces the audit case: missing mean wind is no longer "Passable (0/100)"', () => {
        const res = evaluateSpotForecast(
            { orientations_vent: ['S'] },
            { isDaytime: true, windCard: 'S', windDirDeg: 180, windGust: 60, precipitation: 0 },
            DEFAULT_PREFS,
        );
        expect(res.flyable).toBe(false);
        expect(res.status).toBe('incomplete');
        expect(res.missing).toContain('windSpeed');
    });

    it('never shows a reason that depends on the missing value', () => {
        const noWind = evaluateSpotForecast(SITE_SOUTH, completeHourWith({ windSpeed: null }), DEFAULT_PREFS);
        expect(noWind.reason).not.toContain('Vent hors limites');
        const noDir = evaluateSpotForecast(
            SITE_SOUTH,
            completeHourWith({ windDirDeg: null, windCard: null }),
            DEFAULT_PREFS,
        );
        expect(noDir.reason).not.toContain('Mauvaise orientation');
        const noDaylight = evaluateSpotForecast(SITE_SOUTH, completeHourWith({ isDaytime: null }), DEFAULT_PREFS);
        expect(noDaylight.reason).not.toBe('Nuit');
    });

    it('treats invalid values passed directly as missing (defence in depth, research R1)', () => {
        const cases = [
            [{ windSpeed: -3 }, 'windSpeed'],
            [{ windGust: 'abc' }, 'windGust'],
            [{ precipitation: Infinity }, 'precipitation'],
            [{ windDirDeg: 400, windCard: null }, 'windDir'],
        ];
        for (const [overrides, code] of cases) {
            const res = evaluateSpotForecast(SITE_SOUTH, completeHourWith(overrides), DEFAULT_PREFS);
            expect(res.status).toBe('incomplete');
            expect(res.missing).toContain(code);
        }
    });

    it('is incomplete in equipment mode when the mean wind is missing', () => {
        const prefs = {
            ...DEFAULT_PREFS,
            filterMode: 'hardware',
            wings: [{ type: 'voile', nom: 'V', ventMin: 0, ventMax: 40 }],
        };
        const res = evaluateSpotForecast(SITE_SOUTH, completeHourWith({ windSpeed: null }), prefs);
        expect(res.status).toBe('incomplete');
        expect(res.reason).not.toBe('Vent hors limites (Matériel)');
    });

    it('does not need the wind direction when the site orientation is unknown', () => {
        const res = evaluateSpotForecast({}, completeHourWith({ windDirDeg: null, windCard: null }), DEFAULT_PREFS);
        expect(res.status).not.toBe('incomplete');
    });

    it('returns a loading outcome when there is no forecast object', () => {
        const res = evaluateSpotForecast(SITE_SOUTH, null, DEFAULT_PREFS);
        expect(res.status).toBe('loading');
        expect(res.flyable).toBe(false);
    });

    it('keeps a complete forecast flyable', () => {
        const res = evaluateSpotForecast(SITE_SOUTH, COMPLETE_HOUR, DEFAULT_PREFS);
        expect(res.status).toBe('flyable');
        expect(res.missing).toEqual([]);
    });
});

describe('complete forecasts keep their pre-spec verdicts (spec 001, FR-013, SC-004)', () => {
    it.each(REFERENCE_CASES.map((c, i) => [i, c]))('reference case #%i', (_i, c) => {
        const res = evaluateSpotForecast(REFERENCE_SITES[c.siteName], c.weather, c.prefs);
        expect(res.flyable).toBe(c.expected.flyable);
        expect(res.score).toBe(c.expected.score);
        expect(res.reason).toBe(c.expected.reason);
        expect(res.status).toBe(c.expected.flyable ? 'flyable' : 'unflyable');
    });
});

describe('unknown take-off orientation is never shown as ideal (spec 001, US2, FR-007)', () => {
    const DIRECTIONS = [
        ['N', 0],
        ['NE', 45],
        ['E', 90],
        ['SE', 135],
        ['S', 180],
        ['SO', 225],
        ['O', 270],
        ['NO', 315],
    ];

    it.each([
        ['no orientation field', SITE_NO_ORIENTATION],
        ['unrecognised orientation label', SITE_UNRECOGNISED_ORIENTATION],
    ])('%s: flyable with a notice, never a score or rating', (_label, site) => {
        for (const [card, deg] of DIRECTIONS) {
            const res = evaluateSpotForecast(
                site,
                completeHourWith({ windCard: card, windDirDeg: deg }),
                DEFAULT_PREFS,
            );
            expect(res.status).toBe('flyable');
            expect(res.orientationUnknown).toBe(true);
            expect(res.score).toBeNull();
            expect(res.reasonCode).toBe('ORIENTATION_UNKNOWN');
            expect(res.warning).toBe(true);
            expect(res.reason).toBe('Orientation du décollage inconnue : à vérifier');
            expect(res.reason).not.toMatch(/Excellent|Bon|Passable|\/100/);
        }
    });

    it('still applies every other check', () => {
        const site = SITE_NO_ORIENTATION;
        expect(evaluateSpotForecast(site, completeHourWith({ isDaytime: false }), DEFAULT_PREFS).reasonCode).toBe(
            'NIGHT',
        );
        expect(evaluateSpotForecast(site, completeHourWith({ precipitation: 1 }), DEFAULT_PREFS).reasonCode).toBe(
            'RAIN',
        );
        expect(
            evaluateSpotForecast(site, completeHourWith({ windSpeed: 40, windGust: 45 }), DEFAULT_PREFS).reasonCode,
        ).toBe('WIND_OUT_OF_LIMITS');
        expect(
            evaluateSpotForecast(site, completeHourWith({ windSpeed: 10, windGust: 40 }), DEFAULT_PREFS).reasonCode,
        ).toBe('GUST_OUT_OF_LIMITS');
    });

    it('is not made incomplete by a missing wind direction', () => {
        const res = evaluateSpotForecast(
            SITE_NO_ORIENTATION,
            completeHourWith({ windDirDeg: null, windCard: null }),
            DEFAULT_PREFS,
        );
        expect(res.status).toBe('flyable');
        expect(res.orientationUnknown).toBe(true);
    });

    it('keeps the equipment wing names in the notice', () => {
        const prefs = {
            ...DEFAULT_PREFS,
            filterMode: 'hardware',
            wings: [{ type: 'voile', nom: 'Ma voile', ventMin: 0, ventMax: 40 }],
        };
        const res = evaluateSpotForecast(SITE_NO_ORIENTATION, COMPLETE_HOUR, prefs);
        expect(res.reason).toBe('Orientation du décollage inconnue : à vérifier avec Ma voile');
        expect(res.score).toBeNull();
    });
});
