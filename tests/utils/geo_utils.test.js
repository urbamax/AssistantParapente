import { describe, it, expect } from 'vitest';
import { calculateDistance, normalizeDegree, getAngularDifference, degreesToCardinal } from '../../js/utils/geo_utils.js';

describe('Geo Utils', () => {
    
    it('calculateDistance returns correct Haversine distance', () => {
        // Paris to Lyon (approx 392km)
        const d = calculateDistance(48.8566, 2.3522, 45.7640, 4.8357);
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
});
