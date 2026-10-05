import { describe, it, expect, afterEach } from 'vitest';
import IGCParser from '../../js/services/igc_parser.js';
import LogbookView from '../../js/views/logbook.js';
import SitesService from '../../js/services/sites_service.js';

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

/** Convertit une trace synthétique en texte IGC (enregistrements B). */
function toIgc(trace) {
    const coord = (value, degLen, pos, neg) => {
        const abs = Math.abs(value);
        const deg = Math.floor(abs);
        const min = Math.round((abs - deg) * 60000);
        return `${String(deg).padStart(degLen, '0')}${String(min).padStart(5, '0')}${value < 0 ? neg : pos}`;
    };
    const records = trace.map((p) => {
        const d = new Date(p.timestamp);
        const time = [d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()]
            .map((n) => String(n).padStart(2, '0'))
            .join('');
        const alt = String(p.alt).padStart(5, '0');
        return `B${time}${coord(p.lat, 2, 'N', 'S')}${coord(p.lon, 3, 'E', 'W')}A${alt}${alt}`;
    });
    return ['HFDTE260926', ...records].join('\n');
}

describe('IGCParser.detectLandingIndex', () => {
    it('cuts the walk back to the car after landing', () => {
        const { trace, phaseStarts } = buildTrace([FLIGHT, { seconds: 15 * 60, speedKmh: 4 }]);
        expectNear(IGCParser.detectLandingIndex(trace), phaseStarts[1], trace);
    });

    it('keeps tight approach turns (figure 8) in the flight', () => {
        // Vol en ligne droite, puis 2 min de virages serrés (rayon 25 m, 30 km/h, -1 m/s) :
        // en 20 s le pilote revient presque à son point de départ.
        const { trace, phaseStarts } = buildTrace([FLIGHT]);
        const last = trace[trace.length - 1];
        const r = 25;
        const v = 30 / 3.6;
        let alt = last.alt;
        let t = last.timestamp;
        for (let s = STEP_S; s <= 120; s += STEP_S) {
            const angle = (v * s) / r;
            t += STEP_S * 1000;
            alt -= STEP_S;
            trace.push({
                lat: last.lat + (r * Math.sin(angle)) / M_PER_DEG_LAT,
                lon: last.lon + (r * (1 - Math.cos(angle))) / (M_PER_DEG_LAT * Math.cos((last.lat * Math.PI) / 180)),
                alt: Math.round(alt),
                timestamp: t,
            });
        }
        const landing = trace.length;
        const { trace: ground } = buildTrace([WAIT], { ...trace[landing - 1] });
        ground.forEach((p, k) => trace.push({ ...p, timestamp: t + (k + 1) * STEP_S * 1000 }));
        expect(phaseStarts[0]).toBe(0);
        expectNear(IGCParser.detectLandingIndex(trace), landing - 1, trace);
    });

    it('keeps the whole track when the vario was switched off on landing', () => {
        const { trace } = buildTrace([FLIGHT]);
        expect(IGCParser.detectLandingIndex(trace)).toBe(trace.length - 1);
    });
});

describe('IGCParser.parse on the flight only', () => {
    it('measures duration, takeoff time and gain without the walk up nor the walk back', () => {
        const { trace, phaseStarts } = buildTrace([WALK, WAIT, FLIGHT, { seconds: 10 * 60, speedKmh: 4 }]);
        const parsed = IGCParser.parse(toIgc(trace));

        expect(parsed.points).toHaveLength(trace.length); // trace complète conservée
        expect(parsed.duration).toBeGreaterThanOrEqual(10);
        expect(parsed.duration).toBeLessThanOrEqual(11);

        const takeoff = new Date(trace[phaseStarts[2]].timestamp);
        const [, time] = parsed.dateStr.split('T');
        const expectedHour = String(takeoff.getHours()).padStart(2, '0');
        expect(time.startsWith(expectedHour)).toBe(true);
        expect(Math.abs(Number(time.slice(3)) - takeoff.getMinutes())).toBeLessThanOrEqual(1);

        // La montée à pied (+240 m) n'est pas un gain en vol : le vol ne fait que descendre.
        expect(parsed.gain).toBeLessThanOrEqual(10);
    });

    it('gives the same stats as before when the track is only the flight', () => {
        const { trace } = buildTrace([FLIGHT]);
        const parsed = IGCParser.parse(toIgc(trace));
        expect(parsed.takeoffIndex).toBe(0);
        expect(parsed.landingIndex).toBe(trace.length - 1);
        expect(parsed.duration).toBe(IGCParser.calculateDurationMinutes(parsed.points));
    });
});

describe('LogbookView.findNearestSite (import IGC)', () => {
    const deco = { nom: 'PLANPRAZ', latitude: 45.9, longitude: 6.87, type: ['NATUREL'], affiche: true };
    const atterro = { nom: 'ATTERRO DU BOIS', latitude: 45.9001, longitude: 6.87, type: ['ATTERRO'] };
    const kite = { nom: 'SPOT KITE', latitude: 45.9, longitude: 6.8701, type: ['KITE'] };
    const hidden = { nom: 'A renseigner', latitude: 45.9, longitude: 6.87, type: ['NATUREL'], affiche: false };

    afterEach(() => {
        SitesService.setSites([]);
    });

    it('only proposes visible takeoff sites, even when a landing is closer', () => {
        SitesService.setSites([atterro, kite, hidden, deco]);
        expect(LogbookView.findNearestSite(45.9001, 6.8701)).toBe(deco);
    });

    it('returns null when the only nearby sites are not takeoffs', () => {
        SitesService.setSites([atterro, kite, hidden]);
        expect(LogbookView.findNearestSite(45.9, 6.87)).toBeNull();
    });

    it('returns null beyond a 500 m radius', () => {
        SitesService.setSites([deco]);
        expect(LogbookView.findNearestSite(45.904, 6.87)).toBe(deco); // ~445 m
        expect(LogbookView.findNearestSite(45.905, 6.87)).toBeNull(); // ~560 m
    });
});
