import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import SdfParser from '../../js/services/sdf_parser.js';
import IGCParser from '../../js/services/igc_parser.js';

// Vol réel Syride SYS'Nav V3, anonymisé (position décalée, date changée) : le .sdf et le .igc exportés ensemble.
const sdf = readFileSync('tests/fixtures/syride-winch-flight.sdf');
const igc = IGCParser.parse(readFileSync('tests/fixtures/syride-winch-flight.igc', 'utf8'));

describe('SdfParser', () => {
    const records = SdfParser.parse(sdf);

    it('reads one record per second, with the same positions as the IGC', () => {
        expect(records).toHaveLength(339);
        expect(records[0]).toMatchObject({ alt: 166, speedKmh: 15, satellites: 17, temperature: 27 });
        expect(records[0].lat).toBeCloseTo(igc.points[0].lat, 4);
        expect(records[0].lon).toBeCloseTo(igc.points[0].lon, 4);
        expect(records[80].alt).toBe(igc.points[80].alt);
        expect(records[0].g).toEqual([1.1, 1.1, 1.1, 1.1, 1.1]);
    });

    it('reads the vario and the temperature drop with altitude', () => {
        expect(records[24].vario).toBeCloseTo(2.2, 1); // treuil : ~+2 à +3 m/s
        expect(records[90].vario).toBeLessThan(0); // après le largage
        expect(records[150].temperature).toBeLessThan(records[0].temperature);
    });

    it('aligns on the IGC track and sums up the flight', () => {
        const offset = SdfParser.alignToTrace(records, igc.points);
        expect(offset).toBe(0);
        const summary = SdfParser.summarize(records, offset + igc.takeoffIndex, offset + igc.landingIndex);
        // 1,3 g au largage du treuil (424 m)
        expect(summary).toEqual({ gMax: 1.3, gMin: 0.9, tempTakeoff: 27, tempMin: 22, tempMax: 27 });
    });

    it('recognises the .sdf of this flight, not one of another flight from the same takeoff', () => {
        expect(SdfParser.matchesTrace(records, igc.points, 0)).toBe(true);

        // Autre vol du même jour au même déco : même premier point, puis une autre trace
        const otherFlight = records.map((r, k) => (k < 20 ? r : { ...r, lat: r.lat + 0.003, alt: r.alt + 40 }));
        expect(SdfParser.alignToTrace(otherFlight, igc.points)).toBe(0); // le départ seul ne suffit pas
        expect(SdfParser.matchesTrace(otherFlight, igc.points, 0)).toBe(false);

        // Même début mais durée très différente (vol plus court)
        expect(SdfParser.matchesTrace(records.slice(0, 100), igc.points, 0)).toBe(false);
        expect(SdfParser.matchesTrace(records, igc.points, -1)).toBe(false);
    });

    it('rejects anything that is not a Syride record file', () => {
        expect(SdfParser.parse(new Uint8Array(10))).toBeNull();
        expect(SdfParser.parse(new TextEncoder().encode('AXSR\nHFDTE031026\n'))).toBeNull();
        expect(SdfParser.parse(new Uint8Array(8 + 21))).toBeNull(); // position 0,0
        expect(SdfParser.alignToTrace(records, [{ lat: 45, lon: 6 }])).toBe(-1);
    });
});
