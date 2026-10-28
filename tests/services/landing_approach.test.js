import { describe, it, expect } from 'vitest';
import IGCParser from '../../js/services/igc_parser.js';
import { detectLandingApproach, turnSwings } from '../../js/services/landing_approach.js';
import { buildIgc, GROUND, FLIGHT_10MIN } from '../helpers/synthetic_igc.js';

// Une glisse jusqu'à ~300 m au-dessus du posé, puis la descente finale en phases de 1 m/s (120 m
// en 120 s) à 36 km/h, suivie d'une pause au sol. Les virages sont à 6°/s (90° en 15 s).
const straight = (seconds) => ({ seconds, speedKmh: 36, verticalMs: -1 });
const turn = (seconds, turnDegPerS = 6) => ({ ...straight(seconds), turnDegPerS });
const approach = (...finalPhases) => [GROUND, FLIGHT_10MIN, ...finalPhases, GROUND];
const detect = (phases) => IGCParser.parse(buildIgc(phases)).landingApproach;

describe('Landing approach detection', () => {
    it('reads a straight final as Directe', () => {
        expect(detect(approach(straight(120)))).toEqual({ pattern: 'Directe', turns: [] });
    });

    it('reads downwind, base and final turning the same way as En U', () => {
        const result = detect(approach(straight(40), turn(15), straight(10), turn(15), straight(40)));
        expect(result.pattern).toBe('En U');
        expect(result.turns).toHaveLength(1);
        expect(result.turns[0]).toBeGreaterThan(150);
    });

    it('reads a U turning to the left the same way', () => {
        const result = detect(approach(straight(40), turn(15, -6), straight(10), turn(15, -6), straight(40)));
        expect(result.pattern).toBe('En U');
        expect(result.turns[0]).toBeLessThan(-150);
    });

    it('reads alternating turns as En S', () => {
        const result = detect(approach(straight(30), turn(20), straight(5), turn(20, -6), straight(45)));
        expect(result.pattern).toBe('En S');
        expect(result.turns.map(Math.sign)).toEqual([1, -1]);
    });

    it('reads two alternating near-full loops as En huit', () => {
        const result = detect(approach(straight(40), turn(30, 9), turn(30, -9), straight(20)));
        expect(result.pattern).toBe('En huit');
    });

    it('does not guess on a full spiral', () => {
        expect(detect(approach(straight(30), turn(60, 6), straight(30)))).toBeNull();
    });

    it('does not guess on a single short turn', () => {
        expect(detect(approach(straight(60), turn(13), straight(47)))).toBeNull();
    });

    it('does not guess when the flight never got 100 m above the landing', () => {
        const hop = { seconds: 60, speedKmh: 36, verticalMs: -1 };
        expect(detect([GROUND, hop, GROUND])).toBeNull();
    });

    it('does not guess when the trace stops in the air', () => {
        expect(detect([GROUND, FLIGHT_10MIN, straight(120)])).toBeNull();
    });

    it('ignores a turn made after the 10 m flare height', () => {
        // 90° dans les 6 dernières secondes, sous 10 m : l'arrondi, pas la prise de terrain
        expect(detect(approach(straight(114), turn(6)))).toEqual({ pattern: 'Directe', turns: [] });
    });

    it('returns null for an empty or very short flight', () => {
        expect(detectLandingApproach([])).toBeNull();
        expect(detectLandingApproach(null)).toBeNull();
    });
});

describe('turnSwings', () => {
    it('merges turns of the same direction and splits at a reversal', () => {
        expect(turnSwings([0, 40, 100, 160, 100, 20, -60])).toEqual([160, -220]);
    });

    it('ignores wiggles smaller than the minimum turn', () => {
        expect(turnSwings([0, 20, -10, 30, 0, 25])).toEqual([]);
    });

    it('keeps a final turn that has not been reversed', () => {
        expect(turnSwings([0, 90, 180])).toEqual([180]);
    });
});
