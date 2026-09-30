import { describe, it, expect } from 'vitest';
import {
    calculateDistance,
    normalizeDegree,
    getAngularDifference,
    degreesToCardinal,
    formatDecimalDegrees,
    formatDegreesMinutes,
    formatDegreesMinutesSeconds,
    parseCoordinates,
    formatCoordinates,
} from '../../js/utils/geo_utils.js';

describe('Geo Utils', () => {
    it('calculateDistance returns correct Haversine distance', () => {
        // Paris to Lyon (approx 392km)
        const d = calculateDistance(48.8566, 2.3522, 45.764, 4.8357);
        expect(d).toBeCloseTo(392, -1); // Within 10km tolerance

        expect(calculateDistance(0, 0, 0, 0)).toBe(0);
        expect(calculateDistance(undefined, 0, 0, 0)).toBe(Infinity);
    });

    it('normalizeDegree keeps angle between 0 and 360', () => {
        expect(normalizeDegree(360)).toBe(0);
        expect(normalizeDegree(400)).toBe(40);
        expect(normalizeDegree(-45)).toBe(315);
        expect(normalizeDegree(NaN)).toBe(0);
    });

    it('getAngularDifference returns shortest angular distance', () => {
        expect(getAngularDifference(10, 350)).toBe(20);
        expect(getAngularDifference(90, 180)).toBe(90);
        expect(getAngularDifference(350, 10)).toBe(20);
        expect(getAngularDifference(0, 180)).toBe(180);
    });

    it('degreesToCardinal converts properly', () => {
        expect(degreesToCardinal(0)).toBe('N');
        expect(degreesToCardinal(359)).toBe('N');
        expect(degreesToCardinal(45)).toBe('NE');
        expect(degreesToCardinal(180)).toBe('S');
        expect(degreesToCardinal(225)).toBe('SO');
        expect(degreesToCardinal(-45)).toBe('NO');
    });

    describe('coordinate formatting (écran Secours)', () => {
        // Chamonix, déco de Planpraz
        const lat = 45.902061;
        const lon = 6.874283;

        it('formatDecimalDegrees keeps 5 decimals', () => {
            expect(formatDecimalDegrees(lat, lon)).toBe('45.90206, 6.87428');
        });

        it('formatDegreesMinutes uses the aeronautical DD°MM.mmm format', () => {
            expect(formatDegreesMinutes(lat, lon)).toBe("45°54.124' N 006°52.457' E");
        });

        it('formatDegreesMinutesSeconds rounds seconds to a tenth', () => {
            expect(formatDegreesMinutesSeconds(lat, lon)).toBe('45°54\'07.4" N 6°52\'27.4" E');
        });

        it('uses S / W hemispheres for negative values', () => {
            expect(formatDegreesMinutes(-0.5, -70.25)).toBe("00°30.000' S 070°15.000' W");
            expect(formatDegreesMinutesSeconds(-0.5, -70.25)).toBe('0°30\'00.0" S 70°15\'00.0" W');
        });

        it('carries rounded 60 minutes / seconds into the next degree', () => {
            expect(formatDegreesMinutes(45.9999999, 6.9999999)).toBe("46°00.000' N 007°00.000' E");
            expect(formatDegreesMinutesSeconds(45.9999999, 6.9999999)).toBe('46°00\'00.0" N 7°00\'00.0" E');
        });
    });
});

describe('parseCoordinates', () => {
    it('reads decimal coordinates separated by a comma, a space or a semicolon', () => {
        expect(parseCoordinates('50.68123, 1.59234')).toEqual({ lat: 50.68123, lon: 1.59234 });
        expect(parseCoordinates('  45.9   6.12 ')).toEqual({ lat: 45.9, lon: 6.12 });
        expect(parseCoordinates('45,9; 6,12')).toEqual({ lat: 45.9, lon: 6.12 });
        expect(parseCoordinates('-33.5, -70.25')).toEqual({ lat: -33.5, lon: -70.25 });
    });

    it('reads degrees-minutes-seconds with hemispheres, as shown by Google Maps', () => {
        const c = parseCoordinates('50°40\'52.4"N 1°35\'32.4"E');
        expect(c.lat).toBeCloseTo(50.68122, 4);
        expect(c.lon).toBeCloseTo(1.59233, 4);
        const s = parseCoordinates('33°30\'00"S 70°15\'00"W');
        expect(s.lat).toBeCloseTo(-33.5, 6);
        expect(s.lon).toBeCloseTo(-70.25, 6);
    });

    it('reads the @lat,lon part of a Google Maps link', () => {
        expect(parseCoordinates('https://www.google.com/maps/@50.6812,1.5923,15z')).toEqual({
            lat: 50.6812,
            lon: 1.5923,
        });
    });

    it('rejects empty, unreadable or out-of-range input', () => {
        expect(parseCoordinates('')).toBeNull();
        expect(parseCoordinates('   ')).toBeNull();
        expect(parseCoordinates('Equihen')).toBeNull();
        expect(parseCoordinates('50.6')).toBeNull();
        expect(parseCoordinates('91, 2')).toBeNull();
        expect(parseCoordinates('45, 181')).toBeNull();
        expect(parseCoordinates(null)).toBeNull();
    });
});

describe('formatCoordinates', () => {
    it('writes « lat, lon » with 5 decimals', () => {
        expect(formatCoordinates(50.681234567, 1.5)).toBe('50.68123, 1.50000');
    });
});
