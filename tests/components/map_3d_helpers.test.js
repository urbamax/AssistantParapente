import { describe, it, expect, afterEach, vi } from 'vitest';
import Map3DComponent from '../../js/components/map_3d.js';

describe('Map3DComponent helpers & edge cases', () => {
    afterEach(() => {
        Map3DComponent.clearPlayback();
        vi.restoreAllMocks();
    });

    it('_timeToSeconds parses HH:MM:SS and returns 0 on invalid input', () => {
        expect(Map3DComponent._timeToSeconds('00:00:00')).toBe(0);
        expect(Map3DComponent._timeToSeconds('01:02:03')).toBe(3723);
        expect(Map3DComponent._timeToSeconds('23:59:59')).toBe(86399);
        expect(Map3DComponent._timeToSeconds('')).toBe(0);
        expect(Map3DComponent._timeToSeconds(null)).toBe(0);
    });

    it('_computeVarioSeries computes smoothed climb/sink and handles UTC midnight rollover', () => {
        const trace = [
            { lat: 45, lon: 6, alt: 1000, time: '23:59:58' },
            { lat: 45, lon: 6, alt: 1004, time: '00:00:00' }, // +2 m/s across midnight
            { lat: 45, lon: 6, alt: 1008, time: '00:00:02' }, // +2 m/s
            { lat: 45, lon: 6, alt: 1008, time: '00:00:02' }, // dt=0 -> 0 m/s
        ];
        const series = Map3DComponent._computeVarioSeries(trace);
        expect(series).toHaveLength(4);
        // Point 1 raw is +2, neighbors are 0 and +2 -> smoothed ~1.33
        expect(series[1]).toBeCloseTo(4 / 3, 2);
        // Point 2 raw is +2, neighbors are +2 and 0 -> smoothed ~1.33
        expect(series[2]).toBeCloseTo(4 / 3, 2);
    });

    it('_varioColor clamps extremes and interpolates between stops', () => {
        expect(Map3DComponent._varioColor(-10)).toEqual([37, 99, 235]);
        expect(Map3DComponent._varioColor(10)).toEqual([220, 38, 38]);
        expect(Map3DComponent._varioColor(0)).toEqual([203, 213, 225]);
        const mid = Map3DComponent._varioColor(0.5);
        expect(mid[0]).toBeGreaterThan(203);
        expect(mid[0]).toBeLessThan(251);
    });

    it('_varioTextColor returns red for climb, blue for sink, muted for neutral', () => {
        expect(Map3DComponent._varioTextColor(1.5)).toBe('#dc2626');
        expect(Map3DComponent._varioTextColor(-1.2)).toBe('#2563eb');
        expect(Map3DComponent._varioTextColor(0.2)).toBe('var(--text-secondary)');
    });

    it('_boxBlur1D smooths both horizontally and vertically', () => {
        const src = new Float32Array([0, 0, 9, 0, 0, 0, 0, 9, 0, 0]);
        const h = Map3DComponent._boxBlur1D(src, 5, 2, 1, true);
        expect(h[2]).toBeCloseTo(3, 5);
        const v = Map3DComponent._boxBlur1D(src, 5, 2, 1, false);
        expect(v[2]).toBeCloseTo(9, 5);
    });

    it('_buildStyle configures satellite, smoothdem terrain and hillshade', () => {
        const style = Map3DComponent._buildStyle();
        expect(style.version).toBe(8);
        expect(style.sources.terrainSource.tiles[0]).toContain('smoothdem://');
        expect(style.layers.map((l) => l.id)).toEqual(['satellite', 'hillshade']);
    });

    it('_buildPathSegments pairs consecutive points with averaged vario color', () => {
        const trace = [
            { lat: 45, lon: 6, alt: 1000, time: '12:00:00' },
            { lat: 45.01, lon: 6.01, alt: 1010, time: '12:00:05' },
        ];
        const segs = Map3DComponent._buildPathSegments(trace, [2, 2]);
        expect(segs).toHaveLength(1);
        expect(segs[0].path).toEqual([
            [6, 45, 1000],
            [6.01, 45.01, 1010],
        ]);
        expect(segs[0].color).toEqual(Map3DComponent._varioColor(2));
    });

    it('_playerHtml and _varioLegendGradient produce valid player markup', () => {
        const grad = Map3DComponent._varioLegendGradient();
        expect(grad).toContain('0%');
        expect(grad).toContain('100%');
        const html = Map3DComponent._playerHtml('s1', 42);
        expect(html).toContain('id="play-btn-s1"');
        expect(html).toContain('max="42"');
    });

    it('_errorHtml escapes untrusted HTML in error messages', () => {
        const html = Map3DComponent._errorHtml('<img src=x onerror=alert(1)>');
        expect(html).not.toContain('<img');
        expect(html).toContain('&lt;img');
    });

    it('clearPlayback clears active interval and resets handle', () => {
        Map3DComponent.activeInterval = setInterval(() => {}, 10000);
        Map3DComponent.clearPlayback();
        expect(Map3DComponent.activeInterval).toBeNull();
    });
});
