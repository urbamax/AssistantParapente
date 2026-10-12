import { describe, it, expect } from 'vitest';
import IGCParser from '../../js/services/igc_parser.js';
import { buildIgc, GROUND, FLIGHT_10MIN } from '../helpers/synthetic_igc.js';

// Vario allumé ou éteint pendant le vol : la trace commence ou finit en l'air.
const parse = (phases) => IGCParser.parse(buildIgc(phases));

describe('IGCParser: trace starting or ending in the air', () => {
    it('flags neither end when the trace covers ground, flight and ground', () => {
        const parsed = parse([GROUND, FLIGHT_10MIN, GROUND]);
        expect(parsed.startsAirborne).toBe(false);
        expect(parsed.endsAirborne).toBe(false);
    });

    it('flags the start when the vario was switched on in flight', () => {
        const parsed = parse([FLIGHT_10MIN, GROUND]);
        expect(parsed.startsAirborne).toBe(true);
        expect(parsed.endsAirborne).toBe(false);
    });

    it('flags the end when the vario was switched off in flight', () => {
        const parsed = parse([GROUND, FLIGHT_10MIN]);
        expect(parsed.startsAirborne).toBe(false);
        expect(parsed.endsAirborne).toBe(true);
    });

    it('flags both ends for a trace recorded only in flight', () => {
        const parsed = parse([FLIGHT_10MIN]);
        expect(parsed.startsAirborne).toBe(true);
        expect(parsed.endsAirborne).toBe(true);
    });

    it('does not flag a very short trace', () => {
        expect(IGCParser.isAirborneAtStart([])).toBe(false);
        expect(IGCParser.isAirborneAtEnd([{ lat: 45, lon: 6, alt: 1000, timestamp: 0 }])).toBe(false);
    });
});
