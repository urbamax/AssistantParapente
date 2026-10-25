import { describe, it, expect } from 'vitest';
import LogbookService from '../../js/services/logbook_service.js';
import SdfParser from '../../js/services/sdf_parser.js';
import { buildFlight, buildSdf, CORRUPTED_IGC, tooShortIgc, localDateTime } from './igc_fixture.js';

// Les générateurs de tests doivent donner de vrais fichiers : lus par les vrais analyseurs.
describe('igc fixtures', () => {
    it('builds an IGC the parser reads as a flight, with the take-off at the requested time', () => {
        const flight = buildFlight({ date: '2026-09-20', start: '09:30:00', minutes: 12 });
        const result = LogbookService.parseIGC(flight.igc);
        expect(result.success).toBe(true);
        expect(result.data.duration).toBe(12);
        const detected = result.data.points[result.data.takeoffIndex].timestamp;
        expect(result.data.dateStr).toBe(localDateTime(detected));
        expect(Math.abs(detected - flight.takeoffMs)).toBeLessThan(30000);
        expect(result.data.startsAirborne).toBe(false);
        expect(result.data.endsAirborne).toBe(false);
        expect(result.data.points[result.data.takeoffIndex].lat).toBeCloseTo(46.4, 2);
    });

    it('builds a trace that starts in the air when there is no time on the ground', () => {
        const result = LogbookService.parseIGC(buildFlight({ groundMinutes: 0 }).igc);
        expect(result.data.startsAirborne).toBe(true);
    });

    it('builds a .sdf that follows its own trace and not a flight of another shape', () => {
        const a = buildFlight({ heading: 90, sink: 1 });
        const b = buildFlight({ heading: 200, sink: 1.4, start: '11:00:00' });
        const trace = (flight) => LogbookService.parseIGC(flight.igc).data.points;
        const records = SdfParser.parse(a.sdf);
        expect(records).not.toBeNull();
        expect(SdfParser.matchesTrace(records, trace(a), SdfParser.alignToTrace(records, trace(a)))).toBe(true);
        // Même décollage : l'alignement du début réussit, c'est la vérification sur tout le vol qui refuse
        expect(SdfParser.matchesTrace(records, trace(b), SdfParser.alignToTrace(records, trace(b)))).toBe(false);
        const own = SdfParser.summarize(records);
        expect(own.gMax).toBe(2);
    });

    it('builds a .sdf that follows a flight of the same shape flown at another time', () => {
        const a = buildFlight({ start: '09:00:00' });
        const b = buildFlight({ start: '14:00:00' });
        const records = SdfParser.parse(a.sdf);
        const trace = LogbookService.parseIGC(b.igc).data.points;
        expect(SdfParser.matchesTrace(records, trace, SdfParser.alignToTrace(records, trace))).toBe(true);
    });

    it('gives texts the parser refuses or finds too short', () => {
        expect(LogbookService.parseIGC(CORRUPTED_IGC).success).toBe(false);
        const short = LogbookService.parseIGC(tooShortIgc());
        expect(short.success ? short.data.duration : 0).toBe(0);
        expect(buildSdf([{ lat: 46, lon: 3, alt: 1, timestamp: 0 }]).length).toBe(8 + 21);
    });
});
