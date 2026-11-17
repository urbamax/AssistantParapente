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
            datetime: '2026-09-20T11:15',
            site: 'Dune',
            voile: 'Voile B',
            sellette: 'Sellette Light',
            duree: 30,
            typeVol: 'Soaring',
            techDecollage: 'Face voile',
            priseTerrain: 'En S',
            vache: true,
            altitudeMax: 240,
            gain: 180,
            distanceKm: 12.4,
            maxClimbRate: 2.1,
            maxSpeedKmh: 42,
            avgSpeedKmh: 25,
            commentaire: 'Calme',
        },
        {
            id: 'a',
            type: 'vol',
            datetime: '2026-09-10T09:05',
            site: 'Plaine',
            voile: 'Voile A',
            duree: 90,
            typeVol: 'Treuil',
            techDecollage: 'Dos voile',
            treuilleur: 'Marc Treuil',
            ecole: 'École Alpes',
            brevetPrepare: 'BI',
            stageName: 'Stage Automne',
            stageSpecialty: 'Initiation',
            moniteur: ['Jean Moniteur'],
            accompagnateur: ['Paul Accomp'],
            pilotes: ['Lucie'],
            typeExercice: ['Virages'],
            altitudeMax: 1850,
            gain: 650,
            altOffset: 20,
            rawIgc: 'HFDTE100926',
            igcStats: {
                takeoffAlt: 1200,
                landingAlt: 450,
                cumulativeClimb: 820,
                freeDistanceKm: 18.6,
                maxFromTakeoffKm: 9.5,
                maxSinkRate: -2.8,
                thermalCount: 4,
                thermalMinutes: 18,
                bestThermalClimb: 3.4,
                glideRatio: 8.5,
                winch: {
                    towSeconds: 42,
                    releaseAlt: 1620,
                    releaseHeight: 420,
                    avgClimb: 10.0,
                    maxClimb: 12.5,
                    towDistanceKm: 0.5,
                },
            },
            sensorStats: { gMax: 2.4, gMin: 0.7 },
            instrument: { brand: 'Syride', model: "SYS'Nav XL" },
            rescueDeployed: true,
            rescueId: 'Secours Ultra',
            meteo: { temperature: 19, ventVitesse: 14, ventRafales: 22, ventDirection: 315 },
            meteoAtterro: { temperature: 22, ventVitesse: 8, ventRafales: 12, ventDirection: 0 },
        },
        {
            id: 'c',
            type: 'gonflage',
            datetime: '2026-09-15T08:30',
            lieu: 'Parking',
            voile: 'Voile A',
            duree: 20,
            typeExercice: ['Face voile', 'Affalage'],
        },
    ];
    const brevets = {
        BI: {
            theory: {
                passed: true,
                date: '2026-09-05',
                score: 28,
                total: 30,
                percentage: 93,
                school: 'École Alpes',
                examiner: 'Claire',
            },
            practical: {
                validated: true,
                date: '2026-09-18',
                school: 'École Alpes',
                instructor: 'Jean Moniteur',
                notes: 'Validé',
            },
        },
    };
    const html = buildLogbookReportHtml(flights, { generatedAt: '2026-10-11T12:00', brevets });

    it('is a complete A4 landscape HTML document without double body margin', () => {
        expect(html.startsWith('<!doctype html>')).toBe(true);
        expect(html).toContain('<table');
        expect(html).toContain('size: A4 landscape');
        expect(html).toMatch(/body\s*\{[^}]*margin:\s*0\b/);
    });

    it('lists the sessions in chronological order', () => {
        const order = ['Plaine', 'Parking', 'Dune'].map((name) => html.indexOf(name));
        expect(order.every((i) => i > -1)).toBe(true);
        expect([...order].sort((x, y) => x - y)).toEqual(order);
    });

    it('includes exact session times except for dateOnly entries', () => {
        expect(html).toContain('09:05');
        expect(html).toContain('08:30');
        expect(html).toContain('11:15');

        const ffvlHtml = buildLogbookReportHtml(
            [
                {
                    id: 'ffvl',
                    type: 'vol',
                    datetime: '2026-09-14T00:00',
                    dateOnly: true,
                    site: 'Annecy',
                    duree: 40,
                    import: { source: 'ffvl-xlsx' },
                },
            ],
            { generatedAt: '2026-10-11T12:00' },
        );
        expect(ffvlHtml).toContain('14/09/2026');
        expect(ffvlHtml).not.toContain('00:00');
        expect(ffvlHtml).toContain('Import FFVL');
    });

    it('shows detailed totals, separating flight and ground counts, cumulative stats and wings', () => {
        expect(html).toContain('3 sessions');
        expect(html).toContain('2 vols');
        expect(html).toContain('2h 00min');
        expect(html).toContain('1 gonflage');
        expect(html).toContain('20min');
        expect(html).toContain('1850 m'); // max altitude
        expect(html).toContain('830 m'); // cumulative gain (650 + 180)
        expect(html).toContain('12.4 km');
        expect(html).toContain('Voile A');
        expect(html).toContain('Voile B');
        expect(html).toContain('10/09/2026');
        expect(html).toContain('20/09/2026');
    });

    it('includes flight techniques, IGC/SDF metrics with single altOffset, gear, school, brevets and weather', () => {
        // Techniques & flight type
        expect(html).toContain('Treuil');
        expect(html).toContain('Soaring');
        expect(html).toContain('Dos voile');
        expect(html).toContain('En S');
        expect(html).toContain('Vaché');
        expect(html).toContain('Face voile, Affalage');

        // Gear & instrument & rescue
        expect(html).toContain('Sellette Light');
        expect(html).toContain('Secours Ultra');
        expect(html).toContain('Syride');
        expect(html).toContain('SYS&#39;Nav XL');

        // Altitudes & IGC metrics: altOffset (20) applied to takeoffAlt (1200 -> 1220) and landingAlt (450 -> 470)
        // and winch releaseAlt (1620 -> 1640), while altitudeMax (1850) is NOT shifted again to 1870
        expect(html).toContain('1220 m');
        expect(html).toContain('470 m');
        expect(html).toContain('750 m'); // descent: 1200 - 450
        expect(html).toContain('1640 m');
        expect(html).not.toContain('1870 m');
        expect(html).toContain('18.6 km'); // freeDistanceKm
        expect(html).toContain('+2.1 m/s');
        expect(html).toContain('2.4'); // gMax
        expect(html).toContain('42 s');

        // School, course, brevet, people
        expect(html).toContain('École Alpes');
        expect(html).toContain('BI');
        expect(html).toContain('Stage Automne');
        expect(html).toContain('Initiation');
        expect(html).toContain('Jean Moniteur');
        expect(html).toContain('Paul Accomp');
        expect(html).toContain('Marc Treuil');
        expect(html).toContain('Lucie');
        expect(html).toContain('28/30 (93%)');

        // Weather
        expect(html).toContain('19°C');
        expect(html).toContain('14 km/h');
        expect(html).toContain('22 km/h');
        expect(html).toContain('NO (315°)');
        expect(html).toContain('22°C');
    });

    it('escapes user data across all fields', () => {
        const out = buildLogbookReportHtml(
            [
                {
                    id: 'x',
                    type: 'vol',
                    datetime: '2026-09-10T09:00',
                    site: '<img src=x onerror=alert(1)>',
                    voile: '<script>alert(2)</script>',
                    sellette: '<b>Sellette</b>',
                    ecole: '<svg onload=alert(3)>',
                    moniteur: ['<i>Mon</i>'],
                    pilotes: ['<u>Pilote</u>'],
                    commentaire: '<iframe src=evil>',
                    duree: 5,
                },
            ],
            {
                generatedAt: '2026-10-11T12:00',
                brevets: {
                    BI: {
                        theory: { passed: true, school: '<img src=b>', examiner: '<script>e</script>' },
                        practical: { validated: true, school: '<svg>', instructor: '<b>I</b>', notes: '<p>n</p>' },
                    },
                },
            },
        );
        expect(out).not.toContain('<img');
        expect(out).not.toContain('<script');
        expect(out).not.toContain('<svg');
        expect(out).not.toContain('<iframe');
        expect(out).toContain('&lt;img');
        expect(out).toContain('&lt;script&gt;');
        expect(out).toContain('&lt;svg');
        expect(out).toContain('&lt;iframe');
    });

    it('does not mutate the flights it is given', () => {
        const input = [...flights];
        buildLogbookReportHtml(input, { generatedAt: '2026-10-11T12:00', brevets });
        expect(input.map((f) => f.id)).toEqual(['b', 'a', 'c']);
    });
});
