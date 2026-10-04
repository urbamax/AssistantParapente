import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import LogbookService from '../../js/services/logbook_service.js';
import LogbookView from '../../js/views/logbook.js';

// Statistiques détaillées d'un vol (carte) et records personnels (onglet Statistiques).
const STATS = {
    takeoffAlt: 166,
    landingAlt: 160,
    minAlt: 158,
    maxAltAboveTakeoff: 259,
    cumulativeClimb: 300,
    maxSinkRate: -2.4,
    avgVario: -0.02,
    thermalCount: 2,
    thermalMinutes: 4,
    thermalPercent: 40,
    avgThermalClimb: 1.6,
    bestThermalClimb: 2.1,
    maxThermalGain: 180,
    turnsLeft: 5,
    turnsRight: 1,
    glideRatio: 8.4,
    bestGlideRatio: 9.1,
    glideSpeedKmh: 34,
    straightDistanceKm: 0.3,
    maxFromTakeoffKm: 1.2,
    freeDistanceKm: 2.6,
};

const flight = (id, extra = {}) => ({
    id,
    type: 'vol',
    datetime: '2026-07-01T12:06',
    site: 'PLAINE <b>',
    voile: 'V',
    duree: 10,
    maxClimbRate: 2.5,
    maxSpeedKmh: 45,
    avgSpeedKmh: 30,
    distanceKm: 4.2,
    ...extra,
});

beforeEach(() => {
    localStorage.clear();
    vi.spyOn(LogbookService, 'saveFlights').mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('LogbookView.renderFlightAnalysis', () => {
    it('shows the detailed stats, absolute altitudes corrected by the pilot', () => {
        const html = LogbookView.renderFlightAnalysis(flight('f1', { igcStats: STATS, altOffset: 5 }));
        expect(html).toContain('<details class="flight-analysis">');
        expect(html).toContain('171 m'); // décollage 166 + 5
        expect(html).toContain('Max au-dessus du déco</span><strong>259 m'); // relatif : pas de correction
        expect(html).toContain('5 à gauche, 1 à droite');
        expect(html).toContain('Distance libre (3 points)</span><strong>2.6 km');
        expect(html).toContain('Finesse moyenne en transition</span><strong>8.4');
    });

    it('says when no thermal was found, and shows nothing without analysis', () => {
        const html = LogbookView.renderFlightAnalysis(flight('f1', { igcStats: { ...STATS, thermalCount: 0 } }));
        expect(html).toContain('Thermiques enroulés</span><strong>0');
        expect(html).not.toContain('Meilleur thermique');
        expect(LogbookView.renderFlightAnalysis(flight('f2'))).toBe('');
    });
});

describe('LogbookView.renderRecords', () => {
    it('keeps the best value of each record, with its date and escaped site', () => {
        const html = LogbookView.renderRecords([
            flight('a', { igcStats: STATS }),
            flight('b', { duree: 95, igcStats: { ...STATS, freeDistanceKm: 12.3, bestThermalClimb: 3.4 } }),
        ]);
        expect(html).toContain('Plus long vol</span>\n                        <strong class="record-value">1h 35min');
        expect(html).toContain('12.3 km');
        expect(html).toContain('+3.4 m/s');
        expect(html).toContain('PLAINE &lt;b&gt;');
        expect(html).toContain('Sur 2 vols avec trace : 8.4 km parcourus');
    });

    it('offers to compute the stats of flights imported before', () => {
        const html = LogbookView.renderRecords([flight('a', { rawIgc: 'B...' })]);
        expect(html).toContain('à mettre à jour : 1');
    });
});

describe('LogbookService.recomputeAllTraceStats', () => {
    it('only refreshes the trace stats, never the rest of the flight', async () => {
        const original = flight('f1', { altitudeMax: 999, gain: 7, commentaire: 'garder', distanceKm: 0 });
        LogbookService.flights = [original, { id: 'g1', type: 'gonflage', datetime: '2026-10-01T10:00' }];
        vi.spyOn(LogbookService, 'getFlightTrace').mockResolvedValue('IGC');
        vi.spyOn(LogbookService, 'parseIGC').mockReturnValue({
            success: true,
            data: { distanceKm: 4.9, maxClimbRate: 3, maxSpeedKmh: 50, avgSpeedKmh: 31, analysis: STATS, duration: 99 },
        });

        expect(await LogbookService.recomputeAllTraceStats()).toBe(1);
        const f = LogbookService.getFlightById('f1');
        expect(f).toMatchObject({ distanceKm: 4.9, maxClimbRate: 3, igcStats: STATS, syncPending: true });
        expect(f).toMatchObject({ duree: 10, altitudeMax: 999, gain: 7, commentaire: 'garder', site: 'PLAINE <b>' });
        expect(LogbookService.saveFlights).toHaveBeenCalledTimes(1);
    });
});
