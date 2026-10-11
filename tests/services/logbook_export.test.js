import { describe, it, expect } from 'vitest';
import { buildIgcFileName, buildLogbookReportHtml } from '../../js/services/logbook_export.js';

describe('buildIgcFileName', () => {
    it('uses the date and a slug of the site', () => {
        expect(buildIgcFileName({ datetime: '2026-09-14T10:30', site: 'Plaine-Joux (Haute-Savoie)' })).toBe(
            '2026-09-14_plaine-joux-haute-savoie.igc',
        );
    });

    it('removes accents', () => {
        expect(buildIgcFileName({ datetime: '2026-09-14T10:30', site: 'Écharpe à Gérôme' })).toBe(
            '2026-09-14_echarpe-a-gerome.igc',
        );
    });

    it('falls back when the site or the date is missing', () => {
        expect(buildIgcFileName({ datetime: '2026-09-14T10:30' })).toBe('2026-09-14_trace.igc');
        expect(buildIgcFileName({ site: 'Dune' })).toBe('vol_dune.igc');
        expect(buildIgcFileName({})).toBe('vol_trace.igc');
    });
});

describe('buildLogbookReportHtml', () => {
    const flights = [
        {
            id: 'b',
            type: 'vol',
            datetime: '2026-09-20T11:00',
            site: 'Dune',
            voile: 'Voile B',
            duree: 30,
            commentaire: 'Calme',
        },
        { id: 'a', type: 'vol', datetime: '2026-09-10T09:00', site: 'Plaine', voile: 'Voile A', duree: 90 },
        { id: 'c', type: 'gonflage', datetime: '2026-09-15T08:00', lieu: 'Parking', voile: 'Voile A', duree: 20 },
    ];
    const html = buildLogbookReportHtml(flights, { generatedAt: '2026-10-11T12:00' });

    it('is a complete HTML document', () => {
        expect(html.startsWith('<!doctype html>')).toBe(true);
        expect(html).toContain('<table');
    });

    it('lists the sessions in chronological order', () => {
        const order = ['Plaine', 'Parking', 'Dune'].map((name) => html.indexOf(name));
        expect(order.every((i) => i > -1)).toBe(true);
        expect([...order].sort((x, y) => x - y)).toEqual(order);
    });

    it('shows the totals, flights and ground handling apart', () => {
        expect(html).toContain('3 sessions');
        expect(html).toContain('2h 00min'); // vols : 90 + 30
        expect(html).toContain('20min'); // gonflage
    });

    it('escapes user data', () => {
        const out = buildLogbookReportHtml(
            [{ id: 'x', type: 'vol', datetime: '2026-09-10T09:00', site: '<img src=x onerror=alert(1)>', duree: 5 }],
            { generatedAt: '2026-10-11T12:00' },
        );
        expect(out).not.toContain('<img');
        expect(out).toContain('&lt;img');
    });

    it('does not mutate the flights it is given', () => {
        const input = [...flights];
        buildLogbookReportHtml(input, { generatedAt: '2026-10-11T12:00' });
        expect(input.map((f) => f.id)).toEqual(['b', 'a', 'c']);
    });
});
