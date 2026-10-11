import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import IGCParser from '../../js/services/igc_parser.js';
import { buildFlight, thermal, glide } from '../helpers/synthetic_flight.js';

describe('IGCParser.analyzeFlight', () => {
    it('finds the thermals, their climb and the turn direction', () => {
        const flight = buildFlight([glide(120), thermal(180, 2), glide(180), thermal(120, 3, 1), glide(120)]);
        const a = IGCParser.analyzeFlight(flight);

        expect(a.thermalCount).toBe(2);
        expect(a.bestThermalClimb).toBeCloseTo(3, 0);
        expect(a.avgThermalClimb).toBeGreaterThan(2);
        expect(a.avgThermalClimb).toBeLessThan(3);
        expect(a.maxThermalGain).toBeGreaterThanOrEqual(340);
        expect(a.maxThermalGain).toBeLessThanOrEqual(370);
        expect(a.thermalMinutes).toBeGreaterThanOrEqual(4);
        expect(a.thermalMinutes).toBeLessThanOrEqual(6);
        // 32 km/h sur un rayon de 35 m : un tour en ~25 s
        expect(a.turnsLeft).toBeGreaterThanOrEqual(6);
        expect(a.turnsRight).toBeGreaterThanOrEqual(4);
        expect(a.turnsLeft).toBeGreaterThan(a.turnsRight);
    });

    it('computes the glide ratio of the transitions', () => {
        const flight = buildFlight([glide(300), thermal(120, 2), glide(300, 90)]);
        const a = IGCParser.analyzeFlight(flight);
        // 36 km/h = 10 m/s pour -1,2 m/s : finesse ~8,3
        expect(a.glideRatio).toBeGreaterThan(7.8);
        expect(a.glideRatio).toBeLessThan(8.8);
        expect(a.bestGlideRatio).toBeGreaterThan(7.8);
        expect(a.glideSpeedKmh).toBeCloseTo(36, 0);
    });

    it('measures altitudes, cumulative climb and max sink', () => {
        const flight = buildFlight([
            glide(60),
            thermal(100, 2),
            glide(60),
            thermal(100, 2),
            { seconds: 20, glide: { speedKmh: 30, verticalMs: -4 } },
        ]);
        const a = IGCParser.analyzeFlight(flight);
        expect(a.takeoffAlt).toBe(1500);
        expect(a.cumulativeClimb).toBeGreaterThanOrEqual(370);
        expect(a.cumulativeClimb).toBeLessThanOrEqual(420);
        expect(a.maxSinkRate).toBeCloseTo(-4, 0);
        expect(a.maxAltAboveTakeoff).toBe(Math.max(...flight.map((p) => p.alt)) - 1500);
    });

    it('measures straight, max and free distances on an out-and-return', () => {
        // 3 km au nord, puis 3 km au sud : retour au déco
        const flight = buildFlight([glide(300, 0), glide(300, 180)]);
        const a = IGCParser.analyzeFlight(flight);
        expect(a.straightDistanceKm).toBeLessThan(0.2);
        expect(a.maxFromTakeoffKm).toBeCloseTo(3, 1);
        expect(a.freeDistanceKm).toBeCloseTo(6, 0);
        expect(a.thermalCount).toBe(0);
    });

    it('does not see thermals in a straight glide nor in a figure-8 approach', () => {
        const eights = [];
        for (let i = 0; i < 4; i++) eights.push(thermal(10, -1, 1), thermal(10, -1, -1));
        const a = IGCParser.analyzeFlight(buildFlight([glide(300), ...eights]));
        expect(a.thermalCount).toBe(0);
    });

    it('estimates the load factor in turns (v x turn rate)', () => {
        // Spirale à 60 km/h sur 20 m de rayon : v²/r = 13,9 m/s², soit ~1,7 g
        const spiral = { seconds: 40, circle: { speedKmh: 60, radiusM: 20, verticalMs: -8, direction: 1 } };
        const a = IGCParser.analyzeFlight(buildFlight([glide(60), spiral, glide(60)]));
        expect(a.estimatedMaxG).toBeGreaterThan(1.5);
        expect(a.estimatedMaxG).toBeLessThan(1.9);
        expect(IGCParser.analyzeFlight(buildFlight([glide(300)])).estimatedMaxG).toBe(1);
    });

    it('does not take a hill launch, a thermal or a ridge for a winch launch', () => {
        const straightClimb = (seconds, verticalMs) => ({ seconds, glide: { speedKmh: 30, verticalMs } });
        // Treuil synthétique : 90 s à +3 m/s en ligne droite, puis plané
        expect(IGCParser.detectWinchTow(buildFlight([straightClimb(90, 3), glide(300)]))).toMatchObject({
            towSeconds: 90,
        });
        // Départ de pente : on descend dès le décollage
        expect(IGCParser.detectWinchTow(buildFlight([glide(120), thermal(180, 2)]))).toBeNull();
        // Thermique enroulé dès le décollage : ça monte, mais en tournant
        expect(IGCParser.detectWinchTow(buildFlight([thermal(180, 2.5), glide(120)]))).toBeNull();
        // Petite bouffée de 20 s
        expect(IGCParser.detectWinchTow(buildFlight([straightClimb(20, 2), glide(300)]))).toBeNull();
        // Soaring faible en ligne droite : +0,8 m/s
        expect(IGCParser.detectWinchTow(buildFlight([straightClimb(120, 0.8), glide(120)]))).toBeNull();
    });

    it('counts the turnarounds of a ridge flight, not the thermals nor a straight line', () => {
        const leg = (heading) => ({ seconds: 200, glide: { speedKmh: 34, verticalMs: -0.1, headingDeg: heading } });
        const turn = (direction) => ({
            seconds: 14,
            circle: { speedKmh: 34, radiusM: 40, verticalMs: -0.1, direction },
        });
        const ridge = buildFlight([leg(0), turn(1), leg(180), turn(-1), leg(0), turn(1), leg(180)]);
        expect(IGCParser.analyzeFlight(ridge).reversals).toBe(3);

        expect(IGCParser.analyzeFlight(buildFlight([glide(600)])).reversals).toBe(0);
        expect(IGCParser.analyzeFlight(buildFlight([glide(120), thermal(240, 2), glide(120)])).reversals).toBe(0);
    });

    it('returns null for too short a track', () => {
        expect(IGCParser.analyzeFlight([])).toBeNull();
        expect(IGCParser.analyzeFlight(buildFlight([glide(1)]))).toBeNull();
    });
});

describe('IGCParser on a real Syride track (winch launch, 8s on approach)', () => {
    const parsed = IGCParser.parse(readFileSync('tests/fixtures/syride-winch-flight.igc', 'utf8'));

    it('matches what Syride shows', () => {
        const takeoff = parsed.points[parsed.takeoffIndex];
        const landing = parsed.points[parsed.landingIndex];
        expect(takeoff.alt).toBe(166);
        expect(landing.alt).toBeLessThanOrEqual(168); // Syride : 166 m
        expect(parsed.maxAltitude).toBe(425);
        expect(parsed.gain).toBe(259);
        expect(parsed.duration).toBeGreaterThanOrEqual(4);
        expect(parsed.analysis.freeDistanceKm).toBeCloseTo(2, 0); // Syride : 2 km
        expect(parsed.analysis.thermalCount).toBe(0);
        expect(parsed.analysis.estimatedMaxG).toBeLessThan(1.4); // capteur Syride : 1,3 g max (largage)
    });

    it('recognises the winch launch: 83 s of tow, released at 425 m', () => {
        expect(parsed.analysis.winch).toMatchObject({
            towSeconds: 83,
            releaseAlt: 425,
            releaseHeight: 259,
            avgClimb: 3.1,
        });
        expect(parsed.analysis.winch.maxClimb).toBeGreaterThan(4);
        expect(parsed.analysis.winch.towDistanceKm).toBeCloseTo(0.75, 1);
    });
});

describe('IGCParser.parseInstrument', () => {
    const header = (...lines) => [...lines, 'B1006055025600N00223844EA000020016601517'];

    it('reads a Syride header, its serial number being in the competition class field', () => {
        const instrument = IGCParser.parseInstrument(
            header(
                'AXSR',
                'HFDTE010726',
                'HFRFWFIRMWAREVERSION: 3.42',
                'HFRHWHARDWAREVERSION: 1.0',
                "HFFTYFRTYPE: Syride, SYS'Nav",
                'HFGPS: Quectel,L76-M33,99ch,10000m',
                'HFPRSPRESSALTSENSOR: TE,MS5607,11000m',
                'HFCIDCOMPETITIONID: ',
                'HFCCLCOMPETITIONCLASS: 1234567890',
            ),
        );
        expect(instrument).toEqual({
            manufacturer: 'XSR',
            brand: 'Syride',
            model: "SYS'Nav",
            firmware: '3.42',
            hardware: '1.0',
            gps: 'Quectel, L76-M33, 99ch, 10000m',
            pressureSensor: 'TE, MS5607, 11000m',
            serial: '1234567890',
        });
    });

    it('takes the serial number of the A record, and reads the old header format', () => {
        const instrument = IGCParser.parseInstrument(
            header(
                'AXCTABC123 FLIGHT:1',
                'HFFTYFR TYPE:XCTRACER,XC TRACER II',
                'HFRFW1.7',
                'HFCCLCOMPETITIONCLASS:Sport',
            ),
        );
        expect(instrument).toMatchObject({
            manufacturer: 'XCT',
            brand: 'XCTRACER',
            model: 'XC TRACER II',
            serial: 'ABC123FLIGHT1',
            firmware: '1.7',
        });
        // Sans marque dans le type, celle du code fabricant
        expect(IGCParser.parseInstrument(header('AFLY01234', 'HFFTYFRTYPE:Flymaster GPS'))).toMatchObject({
            brand: 'Flymaster',
            model: 'Flymaster GPS',
            serial: '01234',
        });
    });

    it('ignores empty or "not set" fields, and the lines after the header', () => {
        expect(
            IGCParser.parseInstrument(['HFGTYGLIDERTYPE: not set', 'B1006055025600N00223844EA0000200166']),
        ).toBeNull();
        expect(IGCParser.parseInstrument(header('HFRFWFIRMWAREVERSION: not set'))).toBeNull();
    });

    it('is returned by parse() with the flight (anonymised fixture: no serial number)', () => {
        const parsed = IGCParser.parse(readFileSync('tests/fixtures/syride-winch-flight.igc', 'utf8'));
        expect(parsed.instrument).toMatchObject({ brand: 'Syride', model: "SYS'Nav", firmware: '3.42' });
        expect(parsed.instrument.serial).toBeUndefined();
    });
});
