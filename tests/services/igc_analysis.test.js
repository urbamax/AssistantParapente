import { describe, it, expect } from 'vitest';
import IGCParser from '../../js/services/igc_parser.js';

const M_PER_DEG_LAT = 111320;
const START = Date.UTC(2026, 6, 14, 11, 0, 0);

/**
 * Trace synthétique à 1 point/s. Phases :
 *  - { seconds, glide: { speedKmh, verticalMs, headingDeg } } : ligne droite
 *  - { seconds, circle: { speedKmh, radiusM, verticalMs, direction } } : spirale (+1 droite, -1 gauche)
 */
function buildFlight(phases, origin = { lat: 45.9, lon: 6.87, alt: 1500 }) {
    const trace = [];
    let { lat, lon, alt } = origin;
    let t = START;
    let heading = 0;
    const mPerDegLon = M_PER_DEG_LAT * Math.cos((origin.lat * Math.PI) / 180);
    const push = () => trace.push({ lat, lon, alt: Math.round(alt), timestamp: t });
    push();
    for (const phase of phases) {
        for (let s = 0; s < phase.seconds; s++) {
            if (phase.glide) {
                heading = phase.glide.headingDeg ?? heading;
                const v = phase.glide.speedKmh / 3.6;
                lat += (v * Math.cos((heading * Math.PI) / 180)) / M_PER_DEG_LAT;
                lon += (v * Math.sin((heading * Math.PI) / 180)) / mPerDegLon;
                alt += phase.glide.verticalMs;
            } else {
                const { speedKmh, radiusM, verticalMs, direction } = phase.circle;
                const v = speedKmh / 3.6;
                heading = (heading + (direction * ((v / radiusM) * 180)) / Math.PI + 360) % 360;
                lat += (v * Math.cos((heading * Math.PI) / 180)) / M_PER_DEG_LAT;
                lon += (v * Math.sin((heading * Math.PI) / 180)) / mPerDegLon;
                alt += verticalMs;
            }
            t += 1000;
            push();
        }
    }
    return trace;
}

const thermal = (seconds, verticalMs, direction = -1) => ({
    seconds,
    circle: { speedKmh: 32, radiusM: 35, verticalMs, direction },
});
const glide = (seconds, headingDeg = 0) => ({ seconds, glide: { speedKmh: 36, verticalMs: -1.2, headingDeg } });

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

    it('returns null for too short a track', () => {
        expect(IGCParser.analyzeFlight([])).toBeNull();
        expect(IGCParser.analyzeFlight(buildFlight([glide(1)]))).toBeNull();
    });
});
