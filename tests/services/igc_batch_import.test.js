import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
    prepareRow,
    prepareBatch,
    loadEntries,
    validateRow,
    buildFlight,
    setValue,
    applyCourse,
    applyToOthers,
    resolvePlaces,
} from '../../js/services/igc_batch_import.js';
import LogbookView from '../../js/views/logbook.js';
import { t } from '../../js/utils/i18n.js';
import { buildFlight as makeFlight, CORRUPTED_IGC, tooShortIgc, localDateTime } from '../helpers/igc_fixture.js';

// Import de plusieurs vols (spec 039) : chaque ligne vient d'UN fichier, sans état partagé.
const reason = (key, params) => t(`logbook.batch.reasons.${key}`, params);

const igc = (name, flight) => ({ name, kind: 'igc', text: flight.igc });
const sdf = (name, flight) => ({ name, kind: 'sdf', bytes: flight.sdf });
const env = (extra = {}) => ({
    sessions: [],
    options: { voile: ['Voile école', 'Voile côte'], sellette: ['Sellette'] },
    nearbySites: () => [],
    ...extra,
});

// Trois vols du même décollage le même jour, de formes différentes
const morning = () => makeFlight({ start: '07:30:00', heading: 90, speed: 8, sink: 1, gPeak: 2.1 });
const noon = () => makeFlight({ start: '09:00:00', heading: 200, speed: 9, sink: 1.3, gPeak: 3.2 });
const afternoon = () => makeFlight({ start: '12:30:00', heading: 300, speed: 7, sink: 0.8, gPeak: 1.7 });

// Toutes les permutations de plusieurs fichiers seraient trop longues à analyser : on prend tous les décalages,
// l'ordre inverse et un entrelacement des traces avec les capteurs
const shuffles = (list) => {
    const rotations = (items) => items.map((_, i) => [...items.slice(i), ...items.slice(0, i)]);
    const half = Math.ceil(list.length / 2);
    const interleaved = list.slice(0, half).flatMap((item, i) => [item, list[half + i]].filter(Boolean));
    return [...rotations(list), ...rotations([...list].reverse()), interleaved];
};

describe('prepareRow: one file, one row', () => {
    it('reads the date, the duration and the statistics of a trace, and keeps the trace', () => {
        const flight = morning();
        const row = prepareRow(igc('matin.igc', flight));
        expect(row.status).toBe('ready');
        expect(row.fileName).toBe('matin.igc');
        expect(row.values.duree).toBe(12);
        expect(row.values.datetime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
        expect(row.trace.rawIgc).toBe(flight.igc);
        expect(row.trace.parsed.points.length).toBeGreaterThan(100);
        expect(row.included).toBe(true);
        expect(row.warnings).toEqual([]);
    });

    it('is a pure function of the file: same file, same row, and the form state is never touched', () => {
        const a = igc('a.igc', morning());
        const b = igc('b.igc', noon());
        const first = prepareRow(a);
        prepareRow(b);
        const again = prepareRow(a);
        expect(again).toEqual(first);
        for (const field of [
            'currentRawIgc',
            'currentIgcStats',
            'currentSensorStats',
            'currentTraceInfo',
            'currentTraceData',
        ]) {
            expect(LogbookView[field]).toBeNull();
        }
    });

    it('keeps rows read at the same time apart from each other', async () => {
        const entries = [morning(), noon(), afternoon()].map((f, i) => igc(`f${i}.igc`, f));
        const together = await Promise.all(entries.map((e) => Promise.resolve().then(() => prepareRow(e))));
        entries.forEach((entry, i) => {
            expect(together[i].trace.rawIgc).toBe(entry.text);
            expect(together[i]).toEqual(prepareRow(entry));
        });
    });

    it('warns about a trace that starts or ends in the air', () => {
        const row = prepareRow(igc('air.igc', makeFlight({ groundMinutes: 0 })));
        expect(row.warnings).toContain('startsAirborne');
        expect(row.warnings).toContain('endsAirborne');
        expect(row.included).toBe(true);
    });

    it('turns a file that is not a trace, or too short, into an unreadable row that cannot be included', () => {
        const junk = prepareRow({ name: 'junk.igc', kind: 'igc', text: CORRUPTED_IGC });
        expect(junk).toMatchObject({ status: 'unreadable', included: false, fileName: 'junk.igc' });
        expect(junk.reason).toBe(reason('unreadable'));
        const short = prepareRow({ name: 'short.igc', kind: 'igc', text: tooShortIgc() });
        expect(short).toMatchObject({ status: 'unreadable', included: false });
        expect(short.reason).toBe(reason('tooShort'));
        const other = prepareRow({ name: 'photo.jpg', kind: 'unsupported' });
        expect(other).toMatchObject({ status: 'unsupported', included: false });
        expect(other.reason).toBe(reason('unsupported'));
    });
});

describe('loadEntries', () => {
    it('reads every file, tells the kind of each by its extension, and reports progress', async () => {
        const files = [
            new File([morning().igc], 'a.IGC'),
            new File([morning().sdf], 'a.sdf'),
            new File(['x'], 'photo.jpg'),
            new File([noon().igc], 'b.gpx'),
        ];
        const progress = [];
        const entries = await loadEntries(files, (done, total) => progress.push([done, total]));
        expect(entries.map((e) => [e.name, e.kind])).toEqual([
            ['a.IGC', 'igc'],
            ['a.sdf', 'sdf'],
            ['photo.jpg', 'unsupported'],
            ['b.gpx', 'igc'],
        ]);
        expect(entries[0].text).toBe(morning().igc);
        expect(entries[1].bytes).toBeInstanceOf(Uint8Array);
        expect(progress[progress.length - 1]).toEqual([4, 4]);
    });

    it('lists a file that cannot be read instead of dropping it', async () => {
        const broken = {
            name: 'x.igc',
            text: () => Promise.reject(new Error('lecture')),
            arrayBuffer: () => Promise.reject(new Error('lecture')),
        };
        const entries = await loadEntries([broken]);
        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({ name: 'x.igc', kind: 'unreadable' });
    });
});

describe('prepareBatch: the table', () => {
    it('gives one row per flight file, ordered by date whatever the order of the files', () => {
        const entries = [igc('apres-midi.igc', afternoon()), igc('matin.igc', morning()), igc('midi.igc', noon())];
        const { rows } = prepareBatch(entries, env());
        expect(rows.map((r) => r.fileName)).toEqual(['matin.igc', 'midi.igc', 'apres-midi.igc']);
        expect(rows.map((r) => r.id)).toEqual(['r0', 'r1', 'r2']);
        expect(rows.every((r) => r.included && r.status !== 'unreadable')).toBe(true);
    });

    it('accounts for every selected file', () => {
        const entries = [
            igc('ok.igc', morning()),
            { name: 'junk.igc', kind: 'igc', text: CORRUPTED_IGC },
            { name: 'photo.jpg', kind: 'unsupported' },
            { name: 'broken.igc', kind: 'unreadable' },
            sdf('seul.sdf', noon()),
        ];
        const { rows, sensors } = prepareBatch(entries, env());
        expect(rows.length + sensors.length).toBe(entries.length);
        expect(rows.filter((r) => r.status === 'unreadable')).toHaveLength(2);
        expect(rows.filter((r) => r.status === 'unsupported')).toHaveLength(1);
    });

    it('starts each row from the nearest known site, the trace and the habits', () => {
        const flight = morning();
        const nearbySites = vi.fn((lat) => (Math.abs(lat - 46.4) < 0.01 ? ['Col de la Test'] : []));
        const sessions = [
            {
                id: 's1',
                type: 'vol',
                datetime: '2026-09-01T10:00',
                site: 'Col de la Test',
                voile: 'Voile côte',
                sellette: 'Sellette',
                typeVol: 'Soaring',
                techDecollage: 'Face voile',
                duree: 10,
            },
        ];
        const { rows } = prepareBatch([igc('a.igc', flight)], env({ sessions, nearbySites }));
        expect(rows[0].values).toMatchObject({
            site: 'Col de la Test',
            voile: 'Voile côte',
            sellette: 'Sellette',
            duree: 12,
            pilotes: [],
            ecole: '',
        });
        expect(rows[0].values.typeVol).toBeTruthy();
        expect(rows[0].learned.voile).toBe('gearPlace');
        expect(nearbySites).toHaveBeenCalled();
    });

    it('leaves the site to fill when no known site is near', () => {
        const { rows } = prepareBatch([igc('a.igc', morning())], env());
        expect(rows[0].values.site).toBe('');
        expect(rows[0].status).toBe('fix');
        expect(rows[0].issues).toContain('site');
    });

    it('lets a flight see the flights before it: close in time at the same site, it gets the same course and pilots', () => {
        const first = morning();
        const second = noon();
        const logbookCourse = {
            id: 's1',
            type: 'vol',
            datetime: localDateTime(first.takeoffMs - 150 * 60000), // 2 h 30 avant le premier vol
            site: 'Col de la Test',
            duree: 10,
            voile: 'Voile école',
            ecole: 'ÉCOLE TEST',
            stageName: 'Stage été',
            stageSpecialty: 'SIV',
            moniteur: ['Gilbert'],
            pilotes: ['Julie'],
        };
        const nearbySites = () => ['Col de la Test'];
        const { rows } = prepareBatch(
            [igc('b.igc', second), igc('a.igc', first)],
            env({ sessions: [logbookCourse], nearbySites }),
        );
        // Le deuxième vol est à 1 h 30 du premier : le stage du carnet est à plus de 3 h, celui du premier vol non
        expect(rows[0].values).toMatchObject({ stageName: 'Stage été', pilotes: ['Julie'], moniteur: ['Gilbert'] });
        expect(rows[1].values).toMatchObject({ stageName: 'Stage été', pilotes: ['Julie'], moniteur: ['Gilbert'] });
    });

    it('does not mix two flights of the same day from the same take-off: separate rows, own statistics', () => {
        const a = morning();
        const b = noon();
        const { rows } = prepareBatch([igc('b.igc', b), igc('a.igc', a)], env());
        expect(rows).toHaveLength(2);
        expect(rows[0].trace.rawIgc).toBe(a.igc);
        expect(rows[1].trace.rawIgc).toBe(b.igc);
        expect(rows[0].trace.parsed.distanceKm).not.toBe(rows[1].trace.parsed.distanceKm);
    });
});

describe('prepareBatch: doubles and flights already in the logbook', () => {
    const near = (lat = 46.4, lon = 3.4) => ({ lat, lon });

    it('keeps one row when the same file is chosen twice, and flags the other', () => {
        const flight = morning();
        const { rows } = prepareBatch([igc('copie.igc', flight), igc('original.igc', flight)], env());
        expect(rows).toHaveLength(2);
        const kept = rows.filter((r) => r.status !== 'duplicate');
        const dup = rows.filter((r) => r.status === 'duplicate');
        expect(kept).toHaveLength(1);
        expect(dup).toHaveLength(1);
        expect(dup[0].included).toBe(false);
        expect(dup[0].reason).toBe(reason('duplicate', { name: kept[0].fileName }));
    });

    it('flags two recorders of the same flight (take-off within 5 minutes and 500 m)', () => {
        const a = makeFlight({ start: '09:00:00', ...near() });
        const b = makeFlight({ start: '09:02:00', lat: 46.4015, lon: 3.4 }); // 2 minutes et ~170 m plus loin
        const { rows } = prepareBatch([igc('a.igc', a), igc('b.igc', b)], env());
        expect(rows.filter((r) => r.status === 'duplicate')).toHaveLength(1);
    });

    it('keeps two flights of the day from the same take-off when they are more than 5 minutes apart', () => {
        const a = makeFlight({ start: '09:00:00' });
        const b = makeFlight({ start: '09:20:00' });
        const { rows } = prepareBatch([igc('a.igc', a), igc('b.igc', b)], env());
        expect(rows.map((r) => r.status)).not.toContain('duplicate');
    });

    it('keeps two flights at the same time from two different places', () => {
        const a = makeFlight({ start: '09:00:00' });
        const b = makeFlight({ start: '09:01:00', lat: 46.6, lon: 3.6 });
        const { rows } = prepareBatch([igc('a.igc', a), igc('b.igc', b)], env());
        expect(rows.map((r) => r.status)).not.toContain('duplicate');
    });

    it('flags a flight already in the logbook, unticked, that can be ticked again', () => {
        const flight = morning();
        const parsedDate = prepareRow(igc('x.igc', flight)).values.datetime;
        const existing = {
            id: 'e1',
            type: 'vol',
            datetime: parsedDate,
            site: 'Ailleurs',
            lat: 46.4003,
            lon: 3.4003,
            duree: 12,
        };
        const { rows } = prepareBatch([igc('a.igc', flight)], env({ sessions: [existing] }));
        expect(rows[0]).toMatchObject({ status: 'known', included: false });
        expect(rows[0].reason).toBe(reason('known'));
    });

    it('flags a flight a few minutes away from one of the logbook, but not one 30 minutes away', () => {
        const flight = morning();
        const parsedDate = prepareRow(igc('x.igc', flight)).values.datetime;
        const shift = (min) => localDateTime(new Date(parsedDate).getTime() + min * 60000);
        const at = (min) => ({
            id: 'e',
            type: 'vol',
            datetime: shift(min),
            site: 'Ailleurs',
            lat: 46.4,
            lon: 3.4,
            duree: 12,
        });
        expect(prepareBatch([igc('a.igc', flight)], env({ sessions: [at(4)] })).rows[0].status).toBe('known');
        expect(prepareBatch([igc('a.igc', flight)], env({ sessions: [at(30)] })).rows[0].status).not.toBe('known');
    });

    it('compares on the site name when the logbook flight has no position, and never on the time alone', () => {
        const flight = morning();
        const parsedDate = prepareRow(igc('x.igc', flight)).values.datetime;
        const nearbySites = () => ['Col de la Test'];
        const same = { id: 'e', type: 'vol', datetime: parsedDate, site: 'col de la test', duree: 12 };
        const other = { id: 'e', type: 'vol', datetime: parsedDate, site: 'Autre site', duree: 12 };
        expect(prepareBatch([igc('a.igc', flight)], env({ sessions: [same], nearbySites })).rows[0].status).toBe(
            'known',
        );
        expect(prepareBatch([igc('a.igc', flight)], env({ sessions: [other], nearbySites })).rows[0].status).not.toBe(
            'known',
        );
    });

    it('ignores ground sessions of the logbook', () => {
        const flight = morning();
        const parsedDate = prepareRow(igc('x.igc', flight)).values.datetime;
        const ground = {
            id: 'g',
            type: 'gonflage',
            datetime: parsedDate,
            lieu: 'Pente',
            lat: 46.4,
            lon: 3.4,
            duree: 12,
        };
        expect(prepareBatch([igc('a.igc', flight)], env({ sessions: [ground] })).rows[0].status).not.toBe('known');
    });
});

describe('validateRow', () => {
    const ready = () => {
        const nearbySites = () => ['Col de la Test'];
        const sessions = [
            {
                id: 's',
                type: 'vol',
                datetime: '2026-09-01T10:00',
                site: 'Col de la Test',
                voile: 'Voile école',
                duree: 5,
            },
        ];
        return prepareBatch([igc('a.igc', morning())], env({ sessions, nearbySites })).rows[0];
    };

    it('asks for the date, the site, the wing and the duration', () => {
        const row = ready();
        expect(validateRow(row)).toEqual({ ok: true, missing: [] });
        for (const [field, key] of [
            ['datetime', 'datetime'],
            ['site', 'site'],
            ['voile', 'voile'],
            ['duree', 'duree'],
        ]) {
            const broken = { ...row, values: { ...row.values, [field]: field === 'duree' ? 0 : '' } };
            expect(validateRow(broken)).toEqual({ ok: false, missing: [key] });
        }
    });

    it('names every missing value in the reason of the row', () => {
        const { rows } = prepareBatch([igc('a.igc', morning())], env());
        expect(rows[0].status).toBe('fix');
        expect(rows[0].issues).toEqual(['site', 'voile']);
        expect(rows[0].reason).toBe(
            reason('missing', { fields: `${t('logbook.batch.fields.site')}, ${t('logbook.batch.fields.voile')}` }),
        );
    });
});

describe('buildFlight', () => {
    it('builds the flight the form would store for this trace', () => {
        const flight = morning();
        const nearbySites = () => ['Col de la Test'];
        const sessions = [
            {
                id: 's',
                type: 'vol',
                datetime: '2026-09-01T10:00',
                site: 'Col de la Test',
                voile: 'Voile école',
                sellette: 'Sellette',
                duree: 5,
            },
        ];
        const row = prepareBatch([igc('a.igc', flight)], env({ sessions, nearbySites })).rows[0];
        const built = buildFlight(row);
        expect(built).toMatchObject({
            type: 'vol',
            site: 'Col de la Test',
            voile: 'Voile école',
            sellette: 'Sellette',
            duree: 12,
            commentaire: '',
            ecole: '',
            moniteur: [],
            accompagnateur: [],
            pilotes: [],
            stageName: '',
            stageSpecialty: '',
            treuilleur: '',
            rescueDeployed: false,
            rescueId: '',
            typeExercice: [],
            altOffset: 0,
            varioInFlight: false,
            varioOffInFlight: false,
            rawIgc: flight.igc,
        });
        expect(built.lat).toBeCloseTo(46.4, 2);
        expect(built.lon).toBeCloseTo(3.4, 2);
        expect(built.traceUpdatedAt).toBeGreaterThan(0);
        expect(built.distanceKm).toBe(row.trace.parsed.distanceKm);
        expect(built.altitudeMax).toBe(row.trace.parsed.maxAltitude);
        expect(built.igcStats).toEqual(row.trace.parsed.analysis);
        expect(built.id).toBeUndefined();
    });

    it('keeps only the instructors and the companions of a school session', () => {
        const row = prepareBatch([igc('a.igc', morning())], env()).rows[0];
        row.values = {
            ...row.values,
            ecole: '',
            moniteur: ['Gilbert'],
            accompagnateur: ['Sophie'],
            stageName: 'Stage',
            stageSpecialty: 'SIV',
        };
        expect(buildFlight(row)).toMatchObject({
            ecole: '',
            moniteur: [],
            accompagnateur: [],
            stageName: '',
            stageSpecialty: '',
        });
        row.values.ecole = 'ÉCOLE TEST';
        expect(buildFlight(row)).toMatchObject({
            moniteur: ['Gilbert'],
            accompagnateur: ['Sophie'],
            stageName: 'Stage',
            stageSpecialty: 'SIV',
        });
    });
});

describe('independence of the rows (FR-014, SC-006)', () => {
    const summary = (rows) =>
        rows.map((r) => ({
            status: r.status,
            included: r.included,
            datetime: r.values?.datetime,
            duree: r.values?.duree,
            raw: r.trace?.rawIgc?.length ?? 0,
            gMax: r.sensor?.stats?.gMax ?? null,
        }));
    it('gives the same table for every order of the same files', () => {
        const entries = [
            igc('a.igc', morning()),
            igc('b.igc', noon()),
            igc('c.igc', afternoon()),
            igc('copie-de-a.igc', morning()),
            { name: 'junk.igc', kind: 'igc', text: CORRUPTED_IGC },
        ];
        const reference = summary(prepareBatch(entries, env()).rows);
        for (const order of shuffles(entries)) {
            expect(summary(prepareBatch(order, env()).rows)).toEqual(reference);
        }
    });

    it('gives the same table when the files are renamed', () => {
        const flights = [morning(), noon(), afternoon()];
        const named = flights.map((f, i) => igc(`x${i}.igc`, f));
        const renamed = flights.map((f, i) => igc(`zzz-${2 - i}.igc`, f));
        expect(summary(prepareBatch(renamed, env()).rows)).toEqual(summary(prepareBatch(named, env()).rows));
    });

    it('never gives a row anything read from another file', () => {
        const flights = [morning(), noon(), afternoon()];
        const { rows } = prepareBatch(
            flights.map((f, i) => igc(`f${i}.igc`, f)),
            env(),
        );
        for (const row of rows) {
            const own = flights.find((f) => f.igc === row.trace.rawIgc);
            expect(own).toBeTruthy();
            expect(row.trace.parsed.points[row.trace.parsed.takeoffIndex].timestamp).toBeGreaterThanOrEqual(
                own.takeoffMs - 30000,
            );
        }
    });
});

describe('sensor files (.sdf) are paired with their flight by content', () => {
    // Quatre vols du même décollage le même jour, de formes différentes
    const day = () => [
        makeFlight({ start: '07:30:00', heading: 90, speed: 8, sink: 1, gPeak: 2.1 }),
        makeFlight({ start: '09:00:00', heading: 200, speed: 9, sink: 1.3, gPeak: 3.2 }),
        makeFlight({ start: '11:00:00', heading: 300, speed: 7, sink: 0.8, gPeak: 1.7 }),
        makeFlight({ start: '14:00:00', heading: 20, speed: 10, sink: 1.6, gPeak: 4.4 }),
    ];
    const gOf = (rows) =>
        Object.fromEntries(
            rows.map((r) => [r.trace.rawIgc.length + ':' + r.values.datetime, r.sensor?.stats?.gMax ?? null]),
        );
    it('attaches each .sdf to the flight it follows, whatever the names and the order', () => {
        const flights = day();
        // Les noms sont volontairement échangés : le .sdf du premier vol s'appelle comme la trace du dernier
        const entries = [
            ...flights.map((f, i) => igc(`vol${i}.igc`, f)),
            ...flights.map((f, i) => sdf(`vol${3 - i}.sdf`, f)),
        ];
        const { rows, sensors } = prepareBatch(entries, env());
        expect(rows).toHaveLength(4);
        expect(rows.every((r) => r.sensor)).toBe(true);
        expect(sensors.filter((s) => s.status)).toHaveLength(0);
        flights.forEach((f) => {
            const row = rows.find((r) => r.trace.rawIgc === f.igc);
            expect(row.sensor.stats.gMax).toBe(f.gPeak);
            expect(row.sensor.stats.source).toBe('sdf');
        });
    });

    it('gives the same pairing for every order of the files', () => {
        const flights = day().slice(0, 3);
        const entries = [...flights.map((f, i) => igc(`i${i}.igc`, f)), ...flights.map((f, i) => sdf(`s${i}.sdf`, f))];
        const reference = gOf(prepareBatch(entries, env()).rows);
        for (const order of shuffles(entries)) {
            expect(gOf(prepareBatch(order, env()).rows)).toEqual(reference);
        }
    });

    it('lists an orphan .sdf as not attached and saves nothing from it', () => {
        const [a, b] = day();
        const orphan = makeFlight({ start: '16:00:00', heading: 150, speed: 11, sink: 2, gPeak: 5 });
        const { rows, sensors } = prepareBatch([igc('a.igc', a), igc('b.igc', b), sdf('orphelin.sdf', orphan)], env());
        expect(rows.every((r) => r.sensor === null)).toBe(true);
        expect(sensors).toEqual([expect.objectContaining({ name: 'orphelin.sdf', status: 'notAttached' })]);
    });

    it('attaches a .sdf that matches two traces to none of them and lists it as ambiguous', () => {
        const x = makeFlight({ start: '09:00:00' });
        const y = makeFlight({ start: '15:00:00' }); // même forme, une autre heure
        const { rows, sensors } = prepareBatch([igc('x.igc', x), igc('y.igc', y), sdf('x.sdf', x)], env());
        expect(rows.every((r) => r.sensor === null)).toBe(true);
        expect(sensors).toEqual([expect.objectContaining({ name: 'x.sdf', status: 'ambiguous' })]);
    });

    it('attaches a .sdf to the row that is kept when the same flight is selected twice', () => {
        const x = makeFlight({ start: '09:00:00', gPeak: 3.2 });
        const entries = [igc('x.igc', x), igc('x-copie.igc', x), sdf('x.sdf', x)];
        const reference = prepareBatch(entries, env());
        for (const order of shuffles(entries)) {
            const { rows, sensors } = prepareBatch(order, env());
            const kept = rows.find((r) => r.flag !== 'duplicate');
            const copy = rows.find((r) => r.flag === 'duplicate');
            expect(sensors).toEqual([]);
            expect(kept.sensor.stats.gMax).toBe(3.2);
            expect(kept.included).toBe(true);
            expect(copy.sensor).toBeNull();
        }
        expect(reference.rows).toHaveLength(2);
    });

    it('keeps the .sdf of a duplicated flight apart from the other flights of the day', () => {
        const [a, b] = [morning(), noon()];
        const { rows, sensors } = prepareBatch(
            [igc('a.igc', a), igc('a2.igc', a), igc('b.igc', b), sdf('a.sdf', a), sdf('b.sdf', b)],
            env(),
        );
        expect(sensors).toEqual([]);
        const sensorOf = (flight) =>
            rows.find((r) => r.trace.rawIgc === flight.igc && r.flag !== 'duplicate').sensor.stats.gMax;
        expect(sensorOf(a)).toBe(a.gPeak);
        expect(sensorOf(b)).toBe(b.gPeak);
    });

    it('still lists a .sdf as ambiguous when it matches a duplicated flight and a different one', () => {
        const x = makeFlight({ start: '09:00:00' });
        const y = makeFlight({ start: '15:00:00' }); // même forme, une autre heure : un autre vol
        const { rows, sensors } = prepareBatch(
            [igc('x.igc', x), igc('x-copie.igc', x), igc('y.igc', y), sdf('x.sdf', x)],
            env(),
        );
        expect(rows.every((r) => r.sensor === null)).toBe(true);
        expect(sensors).toEqual([expect.objectContaining({ name: 'x.sdf', status: 'ambiguous' })]);
    });

    it('attaches none of two .sdf matching the same trace, and lists both', () => {
        const x = makeFlight({ start: '09:00:00' });
        const { rows, sensors } = prepareBatch([igc('x.igc', x), sdf('a.sdf', x), sdf('b.sdf', x)], env());
        expect(rows[0].sensor).toBeNull();
        expect(sensors.map((s) => s.status)).toEqual(['ambiguous', 'ambiguous']);
    });

    it('lists a file that is not a readable .sdf', () => {
        const { sensors } = prepareBatch(
            [igc('x.igc', morning()), { name: 'faux.sdf', kind: 'sdf', bytes: new Uint8Array([1, 2, 3]) }],
            env(),
        );
        expect(sensors).toEqual([expect.objectContaining({ name: 'faux.sdf', status: 'unreadable' })]);
    });

    it('keeps the sensor data of a real winch flight, with the load factor at the release', () => {
        const igcText = readFileSync('tests/fixtures/syride-winch-flight.igc', 'utf8');
        const bytes = new Uint8Array(readFileSync('tests/fixtures/syride-winch-flight.sdf'));
        const { rows, sensors } = prepareBatch(
            [
                { name: 'treuil.igc', kind: 'igc', text: igcText },
                { name: 'treuil.sdf', kind: 'sdf', bytes },
            ],
            env(),
        );
        expect(sensors).toEqual([]);
        expect(rows[0].sensor.stats).toMatchObject({ source: 'sdf' });
        expect(rows[0].sensor.stats.gMax).toBeGreaterThan(1);
        if (rows[0].trace.parsed.analysis?.winch) expect(rows[0].sensor.stats.gRelease).toBeGreaterThan(0);
    });
});

describe('editing the rows', () => {
    const course = {
        id: 's1',
        type: 'vol',
        datetime: '2026-08-01T10:00',
        site: 'Ailleurs',
        duree: 10,
        voile: 'Voile école',
        ecole: 'ÉCOLE TEST',
        stageName: 'Stage été',
        stageSpecialty: 'SIV',
        moniteur: ['Gilbert', 'Marie'],
        accompagnateur: ['Sophie'],
        pilotes: ['Julie', 'Marc'],
    };
    const three = (extra = {}) =>
        prepareBatch(
            [igc('a.igc', morning()), igc('b.igc', noon()), igc('c.igc', afternoon())],
            env({ sessions: [], nearbySites: () => ['Col de la Test'], ...extra }),
        ).rows;

    it('changes only the row being edited, marks the field edited and refreshes the status', () => {
        const rows = three();
        expect(rows.map((r) => r.status)).toEqual(['fix', 'fix', 'fix']); // pas de voile
        setValue(rows[1], 'voile', 'Voile école');
        expect(rows[1].values.voile).toBe('Voile école');
        expect(rows[1].edited.has('voile')).toBe(true);
        expect(rows[1].status).toBe('ready');
        expect(rows[1].issues).toEqual([]);
        expect(rows[0].values.voile).toBe('');
        expect(rows[2].values.voile).toBe('');
        setValue(rows[1], 'site', '  ');
        expect(rows[1].status).toBe('fix');
        expect(rows[1].issues).toEqual(['site']);
    });

    it('turns the duration into a number and refuses a duration below one minute', () => {
        const [row] = three();
        setValue(row, 'duree', '45');
        expect(row.values.duree).toBe(45);
        setValue(row, 'duree', '0');
        expect(row.issues).toContain('duree');
        setValue(row, 'duree', 'abc');
        expect(row.issues).toContain('duree');
    });

    it('keeps a known row flagged when it is edited, and lets it be ticked', () => {
        const flight = morning();
        const date = prepareRow(igc('x.igc', flight)).values.datetime;
        const existing = { id: 'e', type: 'vol', datetime: date, site: 'Col de la Test', duree: 12 };
        const [row] = prepareBatch(
            [igc('a.igc', flight)],
            env({ sessions: [existing], nearbySites: () => ['Col de la Test'] }),
        ).rows;
        expect(row.status).toBe('known');
        setValue(row, 'voile', 'Voile école');
        expect(row.status).toBe('known');
        expect(row.included).toBe(false);
    });

    it('applyCourse fills school, specialty, instructors, companions and pilots of a known course', () => {
        const [row] = three({ sessions: [course] });
        applyCourse(row, 'STAGE ÉTÉ', [course]);
        expect(row.values).toMatchObject({
            stageName: 'STAGE ÉTÉ',
            ecole: 'ÉCOLE TEST',
            stageSpecialty: 'SIV',
            moniteur: ['Gilbert', 'Marie'],
            accompagnateur: ['Sophie'],
            pilotes: ['Julie', 'Marc'],
        });
        expect(row.learned.pilotes).toBe('course');
        expect(row.edited.has('stageName')).toBe(true);
    });

    it('applyCourse leaves alone what was edited on the row, and an unknown name only sets the name', () => {
        const [row] = three({ sessions: [course] });
        setValue(row, 'pilotes', ['Moi']);
        setValue(row, 'ecole', 'AUTRE ÉCOLE');
        applyCourse(row, 'Stage été', [course]);
        expect(row.values.pilotes).toEqual(['Moi']);
        expect(row.values.ecole).toBe('AUTRE ÉCOLE');
        expect(row.values.moniteur).toEqual(['Gilbert', 'Marie']);

        const [other] = three();
        applyCourse(other, 'Stage inconnu', [course]);
        expect(other.values.stageName).toBe('Stage inconnu');
        expect(other.values.pilotes).toEqual([]);
        expect(other.values.ecole).toBe('');
    });

    it('applyToOthers copies the value of one row to the rows not edited in that column, never to edited ones', () => {
        const rows = three();
        setValue(rows[0], 'voile', 'Voile école');
        setValue(rows[2], 'voile', 'Voile côte');
        applyToOthers(rows, 'voile', rows[0].id);
        expect(rows.map((r) => r.values.voile)).toEqual(['Voile école', 'Voile école', 'Voile côte']);
        expect(rows[1].status).toBe('ready');
        expect(rows[1].edited.has('voile')).toBe(false);
    });

    it('applyToOthers copies a course as a whole, and the pilots as a list, but not to rows that cannot be imported', () => {
        const rows = [
            ...three(),
            ...prepareBatch([{ name: 'junk.igc', kind: 'igc', text: CORRUPTED_IGC }], env()).rows,
        ];
        applyCourse(rows[0], 'Stage été', [course]);
        setValue(rows[0], 'pilotes', ['A', 'B']);
        applyToOthers(rows, 'course', rows[0].id);
        applyToOthers(rows, 'pilotes', rows[0].id);
        expect(rows[1].values).toMatchObject({
            stageName: 'Stage été',
            ecole: 'ÉCOLE TEST',
            stageSpecialty: 'SIV',
            pilotes: ['A', 'B'],
        });
        expect(rows[2].values.pilotes).toEqual(['A', 'B']);
        expect(rows[3].values.stageName).toBe(''); // fichier illisible
        // Une copie, pas la même liste
        rows[1].values.pilotes.push('C');
        expect(rows[2].values.pilotes).toEqual(['A', 'B']);
    });

    it('applyToOthers on the flight type copies it, and does nothing from an unknown row', () => {
        const rows = three();
        setValue(rows[0], 'typeVol', 'Cross');
        applyToOthers(rows, 'typeVol', rows[0].id);
        expect(rows.map((r) => r.values.typeVol)).toEqual(['Cross', 'Cross', 'Cross']);
        applyToOthers(rows, 'typeVol', 'inconnue');
        expect(rows.map((r) => r.values.typeVol)).toEqual(['Cross', 'Cross', 'Cross']);
    });

    it('resolvePlaces looks the places up one at a time, only for rows with no site, and keeps what was edited', async () => {
        const rows = prepareBatch(
            [igc('a.igc', morning()), igc('b.igc', noon()), igc('c.igc', afternoon())],
            env(),
        ).rows;
        setValue(rows[2], 'site', 'Saisi à la main');
        let running = 0;
        let maxRunning = 0;
        const calls = [];
        const reverseGeocode = async (lat, lon) => {
            running++;
            maxRunning = Math.max(maxRunning, running);
            calls.push([lat, lon]);
            await new Promise((resolve) => setTimeout(resolve, 5));
            running--;
            return { success: true, data: { city: `Ville ${calls.length}` } };
        };
        const seen = [];
        await resolvePlaces(rows, reverseGeocode, (row) => seen.push([row.id, row.searching]));
        expect(calls).toHaveLength(2);
        expect(maxRunning).toBe(1);
        expect(rows.map((r) => r.values.site)).toEqual(['Ville 1', 'Ville 2', 'Saisi à la main']);
        expect(rows.every((r) => r.searching === false)).toBe(true);
        expect(seen.length).toBeGreaterThanOrEqual(2);
        expect(rows[0].status).toBe('fix'); // la voile manque encore
    });

    it('resolvePlaces leaves the site to fill when the lookup fails, and ignores a site typed while it searched', async () => {
        const rows = prepareBatch([igc('a.igc', morning()), igc('b.igc', noon())], env()).rows;
        let calls = 0;
        const reverseGeocode = async () => {
            calls++;
            if (calls === 1) return { success: false, error: 'hors ligne' };
            setValue(rows[1], 'site', 'Tapé pendant la recherche');
            return { success: true, data: { city: 'Trop tard' } };
        };
        await resolvePlaces(rows, reverseGeocode);
        expect(rows[0].values.site).toBe('');
        expect(rows[1].values.site).toBe('Tapé pendant la recherche');
    });

    it('resolvePlaces does nothing when the pilot is offline', async () => {
        const rows = prepareBatch([igc('a.igc', morning())], env()).rows;
        const reverseGeocode = async () => ({ success: true, data: { city: 'Ville' } });
        await resolvePlaces(rows, reverseGeocode, undefined, { online: false });
        expect(rows[0].values.site).toBe('');
    });
});
