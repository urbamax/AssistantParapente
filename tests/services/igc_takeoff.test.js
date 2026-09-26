import { describe, it, expect, afterEach } from 'vitest';
import IGCParser from '../../js/services/igc_parser.js';
import LogbookView from '../../js/views/logbook.js';

const START = Date.UTC(2026, 8, 26, 10, 0, 0);
const M_PER_DEG_LAT = 111320;
const STEP_S = 2;

/**
 * Construit une trace synthétique (un point toutes les 2 s) à partir de phases
 * { seconds, speedKmh, verticalMs } : déplacement vers le nord à vitesse constante.
 */
function buildTrace(phases, origin = { lat: 45.9, lon: 6.87, alt: 1000 }) {
    const trace = [];
    let { lat, alt } = origin;
    let t = START;
    const phaseStarts = [];
    for (const { seconds, speedKmh = 0, verticalMs = 0 } of phases) {
        phaseStarts.push(trace.length);
        for (let s = 0; s < seconds; s += STEP_S) {
            trace.push({ lat, lon: origin.lon, alt: Math.round(alt), timestamp: t });
            lat += ((speedKmh / 3.6) * STEP_S) / M_PER_DEG_LAT;
            alt += verticalMs * STEP_S;
            t += STEP_S * 1000;
        }
    }
    return { trace, phaseStarts };
}

const WALK = { seconds: 20 * 60, speedKmh: 4, verticalMs: 0.2 };
const WAIT = { seconds: 5 * 60 };
const FLIGHT = { seconds: 10 * 60, speedKmh: 30, verticalMs: -1 };

// Tolérance : la fenêtre de 20 s peut déclencher quelques points avant le vrai départ.
function expectNear(index, expected, trace) {
    const deltaS = Math.abs(trace[index].timestamp - trace[expected].timestamp) / 1000;
    expect(deltaS).toBeLessThanOrEqual(20);
}

describe('IGCParser.detectTakeoffIndex', () => {
    it('skips the walk up and the wait on the takeoff', () => {
        const { trace, phaseStarts } = buildTrace([WALK, WAIT, FLIGHT]);
        expectNear(IGCParser.detectTakeoffIndex(trace), phaseStarts[2], trace);
    });

    it('detects ridge soaring with almost no ground speed from the climb rate', () => {
        const { trace, phaseStarts } = buildTrace([WAIT, { seconds: 5 * 60, speedKmh: 3, verticalMs: 2 }]);
        expectNear(IGCParser.detectTakeoffIndex(trace), phaseStarts[1], trace);
    });

    it('ignores a fast burst shorter than a minute (running, aborted takeoff)', () => {
        const { trace, phaseStarts } = buildTrace([WAIT, { seconds: 30, speedKmh: 20 }, WAIT, FLIGHT]);
        expectNear(IGCParser.detectTakeoffIndex(trace), phaseStarts[3], trace);
    });

    it('does not mistake jogging for flying', () => {
        const { trace } = buildTrace([{ seconds: 10 * 60, speedKmh: 12, verticalMs: 0.3 }]);
        expect(IGCParser.detectTakeoffIndex(trace)).toBe(0);
    });

    it('returns 0 for a track that starts in flight, or has too few points', () => {
        const { trace } = buildTrace([FLIGHT]);
        expect(IGCParser.detectTakeoffIndex(trace)).toBe(0);
        expect(IGCParser.detectTakeoffIndex([])).toBe(0);
        expect(IGCParser.detectTakeoffIndex(trace.slice(0, 1))).toBe(0);
    });
});

describe('LogbookView.findNearestSite (import IGC)', () => {
    const deco = { nom: 'PLANPRAZ', latitude: 45.9, longitude: 6.87, type: ['NATUREL'], affiche: true };
    const atterro = { nom: 'ATTERRO DU BOIS', latitude: 45.9001, longitude: 6.87, type: ['ATTERRO'] };
    const kite = { nom: 'SPOT KITE', latitude: 45.9, longitude: 6.8701, type: ['KITE'] };
    const hidden = { nom: 'A renseigner', latitude: 45.9, longitude: 6.87, type: ['NATUREL'], affiche: false };

    afterEach(() => {
        globalThis.SITES_DATA = undefined;
    });

    it('only proposes visible takeoff sites, even when a landing is closer', () => {
        globalThis.SITES_DATA = [atterro, kite, hidden, deco];
        expect(LogbookView.findNearestSite(45.9001, 6.8701)).toBe(deco);
    });

    it('returns null when the only nearby sites are not takeoffs', () => {
        globalThis.SITES_DATA = [atterro, kite, hidden];
        expect(LogbookView.findNearestSite(45.9, 6.87)).toBeNull();
    });

    it('returns null beyond 2 km', () => {
        globalThis.SITES_DATA = [deco];
        expect(LogbookView.findNearestSite(45.93, 6.87)).toBeNull();
    });
});
