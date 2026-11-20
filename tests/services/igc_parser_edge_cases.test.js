import { describe, it, expect } from 'vitest';
import IGCParser from '../../js/services/igc_parser.js';

describe('IGCParser — validFix & UTC midnight rollover', () => {
    it('ignore les points B invalides (fix V) lorsque des points valides (fix A) existent', () => {
        const igc = [
            'HFDTE201126',
            'B1200004500000N00600000EV0000000000', // fix V invalide (alt 0)
            'B1200104500100N00600100EA0100001000',
            'B1200204500200N00600200EA0105001050',
            'B1200304500300N00600300EA0110001100',
        ].join('\n');

        const parsed = IGCParser.parse(igc);
        expect(parsed.points).toHaveLength(3);
        expect(parsed.points.every((p) => p.alt >= 1000)).toBe(true);
    });

    it('gère le passage de minuit UTC (23:59 → 00:01) sans faire reculer les timestamps de 24 h', () => {
        const igc = [
            'HFDTE201126',
            'B2358004500000N00600000EA0100001000',
            'B2359004500500N00600500EA0105001050',
            'B0000304501000N00601000EA0110001100',
            'B0002004501500N00601500EA0102001020',
        ].join('\n');

        const parsed = IGCParser.parse(igc);
        expect(parsed.points).toHaveLength(4);
        for (let i = 1; i < parsed.points.length; i++) {
            expect(parsed.points[i].timestamp).toBeGreaterThan(parsed.points[i - 1].timestamp);
        }
        expect(parsed.duration).toBeGreaterThanOrEqual(3);
        expect(parsed.duration).toBeLessThanOrEqual(5);
    });

    it('rejette les coordonnées B corrompues (NaN, hémisphère invalide, hors bornes) au lieu de polluer la trace', () => {
        const igc = [
            'HFDTE201126',
            'B120000XX00000N00600000EA0100001000', // lat NaN
            'B1200059500000N00600000EA0100001000', // lat > 90°
            'B1200084500000X00600000EA0100001000', // hémisphère X invalide
            'B1200104500100N00600100EA0100001000', // valide
            'B1200204500200N00600200EA0105001050', // valide
        ].join('\n');

        const parsed = IGCParser.parse(igc);
        expect(parsed.points).toHaveLength(2);
        expect(parsed.points.every((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon))).toBe(true);
    });
});
