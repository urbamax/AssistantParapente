import { describe, it, expect } from 'vitest';
import { evaluateSpotForecast } from '../js/weatherScoring.js';

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
