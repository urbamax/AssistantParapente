import { describe, it, expect } from 'vitest';
import IGCParser from '../../js/services/igc_parser.js';

// Altitude d'un champ IGC sur 5 caractères, signe compris (« -0112 », « 00021 »).
const alt5 = (m) => (m < 0 ? '-' + String(-m).padStart(4, '0') : String(m).padStart(5, '0'));

/** Fichier IGC : un point par seconde vers le nord (~30 km/h), altitudes GPS et baro données. */
function igc(points) {
    const lines = ['AXSR', 'HFDTE200926'];
    points.forEach(({ gps, baro }, i) => {
        const t = 13 * 3600 + 38 * 60 + i;
        const hhmmss = [Math.floor(t / 3600), Math.floor(t / 60) % 60, t % 60]
            .map((n) => String(n).padStart(2, '0'))
            .join('');
        const latMin = 55.0 + i * 0.0045; // ≈ 8,3 m par seconde
        const lat = `50${String(Math.round(latMin * 1000)).padStart(5, '0')}N`;
        lines.push(`B${hhmmss}${lat}00142098EA${alt5(baro)}${alt5(gps)}`);
    });
    return lines.join('\n');
}

describe('IGC altitude at sea level', () => {
    // Vol au bord de la mer : le GPS passe par 0 m ; le baromètre, non calé, est 130 m plus bas.
    const gps = [];
    for (let i = 0; i < 300; i++) gps.push(Math.round(60 - i * 0.22) || 0); // 60 m → -6 m (sans « -0 »)
    const points = gps.map((g) => ({ gps: g, baro: g - 130 }));

    it('keeps a GPS altitude of 0 m instead of jumping to the barometer', () => {
        const result = IGCParser.parse(igc(points));
        const alts = result.points.map((p) => p.alt);
        expect(alts).toEqual(gps);
        expect(Math.min(...alts)).toBe(-6);
    });

    it('gives a believable vario and minimum altitude', () => {
        const result = IGCParser.parse(igc(points));
        expect(result.maxClimbRate).toBeLessThan(2);
        expect(result.analysis.maxSinkRate).toBeGreaterThan(-3);
        expect(result.analysis.minAlt).toBeGreaterThanOrEqual(-6);
    });

    it('uses the barometer when the file has no GPS altitude at all', () => {
        const result = IGCParser.parse(igc(points.map((p) => ({ gps: 0, baro: p.baro }))));
        expect(result.points.map((p) => p.alt)).toEqual(points.map((p) => p.baro));
    });
});
