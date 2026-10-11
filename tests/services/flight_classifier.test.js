import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import IGCParser from '../../js/services/igc_parser.js';
import { classifyFlight, CLASSIFICATION } from '../../js/services/flight_classifier.js';
import { buildFlight, thermal, glide } from '../helpers/synthetic_flight.js';

const analysis = (extra = {}) => ({
    thermalCount: 0,
    maxThermalGain: 0,
    freeDistanceKm: 2,
    avgVario: -1.2,
    winch: null,
    ...extra,
});

describe('classifyFlight: the rule table', () => {
    it('suggests nothing without an analysis', () => {
        expect(classifyFlight(null, 30)).toBeNull();
        expect(classifyFlight(undefined, 30)).toBeNull();
    });

    it('a winch tow wins over everything', () => {
        const a = analysis({ winch: { towSeconds: 80 }, thermalCount: 3, maxThermalGain: 400, freeDistanceKm: 40 });
        expect(classifyFlight(a, 90)).toEqual({ type: 'Treuil', reason: 'trace' });
    });

    it('thermals and a long distance make a Cross', () => {
        const a = analysis({ thermalCount: 4, maxThermalGain: 500, freeDistanceKm: CLASSIFICATION.crossMinKm });
        expect(classifyFlight(a, 120)).toEqual({ type: 'Cross', reason: 'traceCross' });
    });

    it('thermals close to the take-off make a Thermique', () => {
        const a = analysis({ thermalCount: 2, maxThermalGain: 300, freeDistanceKm: CLASSIFICATION.crossMinKm - 0.1 });
        expect(classifyFlight(a, 60)).toEqual({ type: 'Thermique', reason: 'traceThermals' });
    });

    it('a thermal that gains too little does not count', () => {
        const a = analysis({ thermalCount: 1, maxThermalGain: CLASSIFICATION.thermalMinGainM - 1, avgVario: -1.5 });
        expect(classifyFlight(a, 12).type).toBe('Plouf');
    });

    it('staying up for a while without thermals is Soaring', () => {
        const a = analysis({ avgVario: CLASSIFICATION.soaringMinAvgVario });
        expect(classifyFlight(a, CLASSIFICATION.soaringMinMinutes)).toEqual({
            type: 'Soaring',
            reason: 'traceSoaring',
        });
    });

    it('a short flight that stays up is not Soaring', () => {
        const a = analysis({ avgVario: -0.1 });
        expect(classifyFlight(a, CLASSIFICATION.soaringMinMinutes - 1).type).toBe('Plouf');
    });

    it('a flight that loses height steadily is a Plouf', () => {
        const a = analysis({ avgVario: CLASSIFICATION.soaringMinAvgVario - 0.1 });
        expect(classifyFlight(a, 30)).toEqual({ type: 'Plouf', reason: 'tracePlouf' });
    });

    it('never suggests Restit, which a trace cannot tell', () => {
        const types = [analysis(), analysis({ thermalCount: 1, maxThermalGain: 90 }), analysis({ avgVario: 0 })].map(
            (a) => classifyFlight(a, 30).type,
        );
        expect(types).not.toContain('Restit');
    });
});

describe('classifyFlight: on traces analysed by the parser', () => {
    const classify = (phases) => {
        const flight = buildFlight(phases);
        const minutes = Math.round((flight.at(-1).timestamp - flight[0].timestamp) / 60000);
        return classifyFlight(IGCParser.analyzeFlight(flight), minutes)?.type;
    };

    it('a straight glide down is a Plouf', () => {
        expect(classify([glide(420)])).toBe('Plouf');
    });

    it('a long ridge flight without circling is Soaring', () => {
        const ridge = (heading) => ({ seconds: 240, glide: { speedKmh: 34, verticalMs: -0.1, headingDeg: heading } });
        expect(classify([ridge(0), ridge(180), ridge(0), ridge(180), ridge(0)])).toBe('Soaring');
    });

    it('circling up in a thermal near the take-off is a Thermique', () => {
        expect(classify([glide(120), thermal(180, 2), glide(120)])).toBe('Thermique');
    });

    it('thermals linked over many kilometres are a Cross', () => {
        const leg = [thermal(240, 3), glide(600)];
        expect(classify([glide(60), ...leg, ...leg, ...leg, ...leg, ...leg])).toBe('Cross');
    });

    it('the real winch track is a Treuil', () => {
        const parsed = IGCParser.parse(readFileSync('tests/fixtures/syride-winch-flight.igc', 'utf8'));
        expect(classifyFlight(parsed.analysis, parsed.duration)?.type).toBe('Treuil');
    });
});
