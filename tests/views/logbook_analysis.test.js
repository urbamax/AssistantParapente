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
        expect(html).toContain('Plus long vol</div>');
        expect(html).toContain('1h 35min');
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
    const data = {
        dateStr: '2026-07-01T12:10',
        duration: 17,
        maxAltitude: 171,
        gain: 150,
        points: [
            { lat: 50.1, lon: 1.6, alt: 21 },
            { lat: 50.2, lon: 1.7, alt: 171 },
        ],
        takeoffIndex: 0,
        distanceKm: 4.9,
        maxClimbRate: 3,
        maxSpeedKmh: 50,
        avgSpeedKmh: 31,
        analysis: STATS,
    };

    it('recomputes what comes from the trace, like the Recalculer button of a session', async () => {
        const original = flight('f1', { altitudeMax: 999, gain: 7, duree: 10, altOffset: 7 });
        LogbookService.flights = [original, { id: 'g1', type: 'gonflage', datetime: '2026-10-01T10:00' }];
        vi.spyOn(LogbookService, 'getFlightTrace').mockResolvedValue('IGC');
        const parse = vi.spyOn(LogbookService, 'parseIGC').mockReturnValue({ success: true, data });

        expect(await LogbookService.recomputeAllTraceStats()).toBe(1);
        // La correction d'altitude du vol est appliquée
        expect(parse).toHaveBeenCalledWith('IGC', 7);
        expect(LogbookService.getFlightById('f1')).toMatchObject({
            datetime: '2026-07-01T12:10',
            duree: 17,
            altitudeMax: 171,
            gain: 150,
            lat: 50.1,
            lon: 1.6,
            distanceKm: 4.9,
            maxClimbRate: 3,
            igcStats: STATS,
            syncPending: true,
        });
        expect(LogbookService.saveFlights).toHaveBeenCalledTimes(1);
    });

    it('keeps what the pilot entered', async () => {
        LogbookService.flights = [
            flight('f1', { commentaire: 'garder', typeVol: 'Soaring', ecole: 'ÉCOLE', pilotes: ['A'], altOffset: 7 }),
        ];
        vi.spyOn(LogbookService, 'getFlightTrace').mockResolvedValue('IGC');
        vi.spyOn(LogbookService, 'parseIGC').mockReturnValue({ success: true, data });
        await LogbookService.recomputeAllTraceStats();
        expect(LogbookService.getFlightById('f1')).toMatchObject({
            site: 'PLAINE <b>',
            voile: 'V',
            commentaire: 'garder',
            typeVol: 'Soaring',
            ecole: 'ÉCOLE',
            pilotes: ['A'],
            altOffset: 7,
        });
    });

    it('asks first, and does nothing when the pilot cancels', async () => {
        const recompute = vi.spyOn(LogbookService, 'recomputeAllTraceStats').mockResolvedValue(2);
        vi.stubGlobal('alert', vi.fn());
        vi.stubGlobal(
            'confirm',
            vi.fn(() => false),
        );
        await LogbookView.recomputeAllTraceStats();
        expect(recompute).not.toHaveBeenCalled();

        vi.stubGlobal(
            'confirm',
            vi.fn(() => true),
        );
        await LogbookView.recomputeAllTraceStats();
        expect(recompute).toHaveBeenCalledTimes(1);
        expect(alert).toHaveBeenCalledWith('2 vols mis à jour depuis leur trace IGC.');
        vi.unstubAllGlobals();
    });
});

describe('instrument that recorded the flight', () => {
    const instrument = {
        manufacturer: 'XSR',
        brand: 'Syride',
        model: "SYS'Nav",
        firmware: '3.42',
        hardware: '1.0',
        serial: '1234567890',
    };

    it('shows brand, model, serial number and firmware in the detailed stats', () => {
        const html = LogbookView.renderFlightAnalysis(flight('f1', { igcStats: STATS, instrument }));
        expect(html).toContain('Marque</span><strong>Syride');
        expect(html).toContain('Modèle</span><strong>SYS&#39;Nav');
        expect(html).toContain('Numéro de série</span><strong>1234567890');
        expect(html).toContain('Version du logiciel</span><strong>3.42');
    });

    it('is shown even on a flight without detailed stats, without fake zero values', () => {
        const html = LogbookView.renderFlightAnalysis(flight('f2', { instrument }));
        expect(html).toContain('Numéro de série');
        expect(html).not.toContain('Thermiques');
    });

    it('is saved with the stats when all traces are recomputed', async () => {
        LogbookService.flights = [flight('f3')];
        vi.spyOn(LogbookService, 'getFlightTrace').mockResolvedValue('IGC');
        vi.spyOn(LogbookService, 'parseIGC').mockReturnValue({ success: true, data: { analysis: STATS, instrument } });
        await LogbookService.recomputeAllTraceStats();
        expect(LogbookService.getFlightById('f3').instrument).toEqual(instrument);
    });
});
