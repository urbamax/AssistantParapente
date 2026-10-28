import { describe, it, expect } from 'vitest';
import {
    FfvlImportError,
    IMPORT_SOURCE,
    SIMILAR_MINUTES,
    parseExport,
    readFfvlExport,
    parseDate,
    parseDuration,
    resolveSite,
    prepareRows,
    refreshRow,
    setValue,
    validateRow,
    buildFlight,
} from '../../js/services/ffvl_logbook_import.js';
import { t } from '../../js/utils/i18n.js';
import { buildXlsx, ffvlExport, intranetExport, FFVL_HEADER, excelDay } from '../helpers/xlsx_fixture.js';

// Spec 046 : import de l'export Excel du carnet de vols de l'Intranet FFVL.
const reason = (key, params) => t(`logbook.ffvl.reasons.${key}`, params);
const env = (extra = {}) => ({ sessions: [], knownSites: [], ...extra });

/** Export of one flight: the layout of the real file, with invented values. */
const sample = [excelDay('2026-10-27'), 'SANARY', 100, '60 minutes', 'Analyse personnelle', 'Jean Dupont'];
const rowsOf = (...flights) => [FFVL_HEADER, ...flights];

describe('parseDate', () => {
    it('reads an Excel day number', () => {
        expect(parseDate(46322)).toBe('2026-10-27');
        expect(parseDate(46322.0)).toBe('2026-10-27');
    });

    it('reads a written date, day first', () => {
        expect(parseDate('27/10/2026')).toBe('2026-10-27');
        expect(parseDate('7/1/2026')).toBe('2026-01-07');
        expect(parseDate('27-10-2026')).toBe('2026-10-27');
        expect(parseDate('27.10.2026')).toBe('2026-10-27');
        expect(parseDate(' 27/10/2026 ')).toBe('2026-10-27');
    });

    it('reads an ISO date, with or without a time', () => {
        expect(parseDate('2026-10-27')).toBe('2026-10-27');
        expect(parseDate('2026-10-27T09:30:00')).toBe('2026-10-27');
    });

    it('refuses what is not a real date', () => {
        for (const value of ['31/02/2026', '2026-13-01', 'hier', '', null, undefined, 3, -5, NaN]) {
            expect(parseDate(value)).toBe(null);
        }
    });
});

describe('parseDuration', () => {
    it('reads minutes, as a number or written', () => {
        expect(parseDuration(45)).toBe(45);
        expect(parseDuration('60 minutes')).toBe(60);
        expect(parseDuration('1 minute')).toBe(1);
        expect(parseDuration('45 min')).toBe(45);
        expect(parseDuration('45')).toBe(45);
    });

    it('reads hours and minutes', () => {
        expect(parseDuration('1h30')).toBe(90);
        expect(parseDuration('1 h 30')).toBe(90);
        expect(parseDuration('2 heures')).toBe(120);
        expect(parseDuration('01:30')).toBe(90);
        expect(parseDuration('01:30:00')).toBe(90);
    });

    it('reads an Excel time (a fraction of a day)', () => {
        expect(parseDuration(0.0625)).toBe(90);
    });

    it('refuses what is not a duration of at least one minute', () => {
        for (const value of ['', null, undefined, 'long', '0 minutes', 0, -3, NaN]) {
            expect(parseDuration(value)).toBe(null);
        }
    });
});

describe('resolveSite', () => {
    it('writes a known site as the logbook writes it, whatever the case and accents', () => {
        expect(resolveSite('LE MOUCHEROTTE', ['Le Moucherotte'])).toBe('Le Moucherotte');
        expect(resolveSite('  saint-hilaire ', ['Saint-Hilaire'])).toBe('Saint-Hilaire');
        expect(resolveSite('ECHARPE', ['Écharpe'])).toBe('Écharpe');
    });

    it('writes an unknown all-capitals name in capitals and lower case', () => {
        expect(resolveSite('SANARY', [])).toBe('Sanary');
        expect(resolveSite('SAINT-HILAIRE', [])).toBe('Saint-Hilaire');
        expect(resolveSite("MONT D'ARBOIS", [])).toBe("Mont D'Arbois");
    });

    it('leaves a name that is not all capitals as it was written', () => {
        expect(resolveSite('Sanary sur mer', [])).toBe('Sanary sur mer');
        expect(resolveSite('Col de la Forclaz', [])).toBe('Col de la Forclaz');
    });

    it('is empty for an empty cell', () => {
        expect(resolveSite('', ['Sanary'])).toBe('');
        expect(resolveSite(null, [])).toBe('');
    });
});

describe('parseExport', () => {
    it('reads the sample export: one flight', () => {
        const { entries } = parseExport(rowsOf(sample));
        expect(entries).toEqual([
            {
                line: 2,
                date: '2026-10-27',
                site: 'SANARY',
                denivele: 100,
                duree: 60,
                analyse: 'Analyse personnelle',
                formateur: 'Jean Dupont',
                problem: null,
            },
        ]);
    });

    it('finds the columns by their title, in any order, with extra columns and blank lines above', () => {
        const { entries } = parseExport([
            [null, null, null],
            ['Notes', 'Formateur', 'DURÉE', 'date', 'Site', 'Dénivelé', 'Analyse'],
            ['x', 'Jean Dupont', 30, excelDay('2026-03-01'), 'Annecy', 250, 'RAS'],
        ]);
        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({
            line: 3,
            date: '2026-03-01',
            site: 'Annecy',
            denivele: 250,
            duree: 30,
            analyse: 'RAS',
            formateur: 'Jean Dupont',
        });
    });

    it('accepts a file without the instructor, analysis or height columns', () => {
        const { entries } = parseExport([
            ['Date', 'Site', 'Durée'],
            [excelDay('2026-03-01'), 'Annecy', '45 minutes'],
        ]);
        expect(entries[0]).toMatchObject({ site: 'Annecy', duree: 45, denivele: null, analyse: '', formateur: '' });
    });

    it('skips empty lines and keeps the line number of the others', () => {
        const { entries } = parseExport(rowsOf(sample, [null, null, null, null, null, null], sample));
        expect(entries.map((e) => e.line)).toEqual([2, 4]);
    });

    it('keeps a row with an unreadable date or duration, with the problem named', () => {
        const { entries } = parseExport(
            rowsOf(
                ['bientôt', 'Annecy', 10, '30 minutes', '', ''],
                [excelDay('2026-03-01'), 'Annecy', 10, 'long', '', ''],
            ),
        );
        expect(entries.map((e) => e.problem)).toEqual(['date', 'duration']);
    });

    it('reads a height written with its unit and an empty one', () => {
        const { entries } = parseExport(
            rowsOf(
                [excelDay('2026-03-01'), 'A', '120 m', '30 minutes', '', ''],
                [excelDay('2026-03-01'), 'A', null, '30 minutes', '', ''],
            ),
        );
        expect(entries.map((e) => e.denivele)).toEqual([120, null]);
    });

    it('is not an FFVL logbook when the Date or Durée column is missing', () => {
        for (const rows of [
            [
                ['Nom', 'Prénom'],
                ['Dupont', 'Jean'],
            ],
            [
                ['Date', 'Site'],
                [46322, 'SANARY'],
            ],
            [],
        ]) {
            expect(() => parseExport(rows)).toThrow(FfvlImportError);
            try {
                parseExport(rows);
            } catch (error) {
                expect(error.code).toBe('notFfvl');
            }
        }
    });

    it('is an empty logbook when there is a header and no flight', () => {
        expect(parseExport([FFVL_HEADER]).entries).toEqual([]);
    });
});

describe('readFfvlExport', () => {
    it('reads an .xlsx file', async () => {
        const bytes = ffvlExport([['2026-10-27', 'SANARY', 100, '60 minutes', 'Analyse', 'Jean Dupont']]);
        const file = new File([bytes], 'Carnet_vols_2026-10-27.xlsx');
        const { entries } = await readFfvlExport(file);
        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({ date: '2026-10-27', site: 'SANARY', duree: 60 });
    });

    it('reads the file exactly as the Intranet writes it, to the flight it holds', async () => {
        const { entries } = await readFfvlExport(new File([intranetExport()], 'Carnet_vols_2026-10-27.xlsx'));
        expect(entries).toEqual([
            {
                line: 2,
                date: '2026-10-27',
                site: 'SANARY',
                denivele: 100,
                duree: 60,
                analyse: 'Analyse perosnnelle',
                formateur: 'Jean Dupont',
                problem: null,
            },
        ]);
    });

    it('says the file is unreadable when it is not a workbook', async () => {
        const error = await readFfvlExport(new File(['Date;Site'], 'carnet.csv')).catch((e) => e);
        expect(error).toBeInstanceOf(FfvlImportError);
        expect(error.code).toBe('unreadable');
    });

    it('says it is not an FFVL logbook for a workbook of something else', async () => {
        const file = new File(
            [
                buildXlsx([
                    ['Produit', 'Prix'],
                    ['Voile', 1500],
                ]),
            ],
            'devis.xlsx',
        );
        const error = await readFfvlExport(file).catch((e) => e);
        expect(error.code).toBe('notFfvl');
    });
});

describe('prepareRows', () => {
    const entriesOf = (...flights) => parseExport(rowsOf(...flights)).entries;

    it('makes a ready, ticked row of a flight that is not in the logbook', () => {
        const [row] = prepareRows(entriesOf(sample), env({ knownSites: ['Sanary'] }));
        expect(row).toMatchObject({
            id: 'r0',
            line: 2,
            status: 'ready',
            reason: '',
            included: true,
            issues: [],
            values: {
                date: '2026-10-27',
                site: 'Sanary',
                duree: 60,
                denivele: 100,
                analyse: 'Analyse personnelle',
                formateur: 'Jean Dupont',
            },
        });
    });

    it('gives each row a stable key, and two identical rows two different keys', () => {
        const first = prepareRows(entriesOf(sample, sample), env());
        expect(first[0].key).not.toBe(first[1].key);
        expect(first.map((r) => r.status)).toEqual(['ready', 'ready']);
        // The same file again: the same keys
        const again = prepareRows(entriesOf(sample, sample), env());
        expect(again.map((r) => r.key)).toEqual(first.map((r) => r.key));
    });

    it('gives a row the same key in a longer export of the same logbook', () => {
        const other = [excelDay('2026-10-28'), 'ANNECY', 50, '20 minutes', '', ''];
        const small = prepareRows(entriesOf(sample), env());
        const big = prepareRows(entriesOf(other, sample, sample), env());
        expect(big.map((r) => r.key)).toContain(small[0].key);
        expect(new Set(big.map((r) => r.key)).size).toBe(3);
    });

    it('does not change the key when the pilot corrects the site', () => {
        const [row] = prepareRows(entriesOf(sample), env());
        const key = row.key;
        setValue(row, 'site', 'Sanary-sur-Mer');
        expect(row.key).toBe(key);
    });

    it('flags a flight already imported, leaves it unticked and says when it was imported', () => {
        const [first] = prepareRows(entriesOf(sample), env());
        const imported = {
            id: 'f1',
            type: 'vol',
            datetime: '2026-10-27T00:00',
            site: 'Sanary',
            duree: 60,
            import: {
                source: IMPORT_SOURCE,
                batchId: 'b1',
                importedAt: new Date('2026-10-28T10:00:00').getTime(),
                key: first.key,
            },
        };
        const [row] = prepareRows(entriesOf(sample), env({ sessions: [imported] }));
        expect(row.status).toBe('imported');
        expect(row.included).toBe(false);
        expect(row.reason).toBe(reason('imported', { date: '28/10/2026' }));
    });

    it('still sees a flight as imported after the pilot edited it', () => {
        const [first] = prepareRows(entriesOf(sample), env());
        const edited = {
            type: 'vol',
            datetime: '2026-10-27T14:30',
            site: 'Autre nom',
            duree: 75,
            import: { source: IMPORT_SOURCE, batchId: 'b1', importedAt: 1, key: first.key },
        };
        const [row] = prepareRows(entriesOf(sample), env({ sessions: [edited] }));
        expect(row.status).toBe('imported');
    });

    it('imports only the flights that are new in a longer export', () => {
        const [first] = prepareRows(entriesOf(sample), env());
        const imported = {
            type: 'vol',
            datetime: '2026-10-27T00:00',
            import: { source: IMPORT_SOURCE, batchId: 'b1', importedAt: 1, key: first.key },
        };
        const other = [excelDay('2026-10-28'), 'ANNECY', 50, '20 minutes', '', ''];
        const rows = prepareRows(entriesOf(other, sample), env({ sessions: [imported] }));
        expect(rows.map((r) => [r.status, r.included])).toEqual([
            ['ready', true],
            ['imported', false],
        ]);
    });

    describe('a similar flight entered by hand', () => {
        const manual = (extra = {}) => ({
            id: 'm1',
            type: 'vol',
            datetime: '2026-10-27T10:15',
            site: 'sanary',
            duree: 62,
            ...extra,
        });

        it('is flagged "maybe already in the logbook" and left unticked', () => {
            const [row] = prepareRows(entriesOf(sample), env({ sessions: [manual()] }));
            expect(row.status).toBe('similar');
            expect(row.included).toBe(false);
            expect(row.reason).toBe(reason('similar'));
        });

        it('can be ticked by the pilot, and the row is then still a similar one', () => {
            const [row] = prepareRows(entriesOf(sample), env({ sessions: [manual()] }));
            row.included = true;
            refreshRow(row);
            expect(row.status).toBe('similar');
            expect(row.included).toBe(true);
        });

        it(`needs the same day, the same site and a duration within ${SIMILAR_MINUTES} minutes`, () => {
            const other = (extra) => prepareRows(entriesOf(sample), env({ sessions: [manual(extra)] }))[0].status;
            expect(other({ datetime: '2026-10-26T10:15' })).toBe('ready');
            expect(other({ site: 'Annecy' })).toBe('ready');
            expect(other({ duree: 60 + SIMILAR_MINUTES + 1 })).toBe('ready');
            expect(other({ duree: 60 + SIMILAR_MINUTES })).toBe('similar');
            expect(other({ type: 'gonflage' })).toBe('ready');
        });

        it('is not a flight from another import', () => {
            const imported = manual({
                import: { source: IMPORT_SOURCE, batchId: 'b0', importedAt: 1, key: 'other-key#0' },
            });
            const [row] = prepareRows(entriesOf(sample), env({ sessions: [imported] }));
            expect(row.status).toBe('ready');
        });
    });

    it('asks for the site when the cell is empty, and is ready once it is typed', () => {
        const [row] = prepareRows(entriesOf([excelDay('2026-10-27'), '', 10, '30 minutes', '', '']), env());
        expect(row.status).toBe('fix');
        expect(row.issues).toEqual(['site']);
        expect(row.reason).toBe(reason('missing', { fields: t('logbook.ffvl.fields.site') }));
        expect(row.included).toBe(true);
        setValue(row, 'site', 'Annecy');
        expect(row.status).toBe('ready');
        expect(row.issues).toEqual([]);
        expect(row.edited.has('site')).toBe(true);
    });

    it('cannot import a row without a readable date or duration, and says why', () => {
        const rows = prepareRows(
            entriesOf(
                ['bientôt', 'Annecy', 10, '30 minutes', '', ''],
                [excelDay('2026-03-01'), 'Annecy', 10, 'long', '', ''],
            ),
            env(),
        );
        expect(rows.map((r) => [r.status, r.included])).toEqual([
            ['invalid', false],
            ['invalid', false],
        ]);
        expect(rows[0].reason).toBe(reason('invalidDate'));
        expect(rows[1].reason).toBe(reason('invalidDuration'));
        // A correction elsewhere never turns it into a flight
        setValue(rows[0], 'site', 'Autre');
        expect(rows[0].status).toBe('invalid');
    });

    it('keeps the order of the file', () => {
        const rows = prepareRows(
            entriesOf(
                [excelDay('2026-03-02'), 'B', 1, '5 minutes', '', ''],
                [excelDay('2026-03-01'), 'A', 1, '5 minutes', '', ''],
            ),
            env(),
        );
        expect(rows.map((r) => r.values.site)).toEqual(['B', 'A']);
        expect(rows.map((r) => r.id)).toEqual(['r0', 'r1']);
    });
});

describe('validateRow', () => {
    it('needs a site, a date and a duration', () => {
        expect(validateRow({ values: { date: '2026-10-27', site: 'A', duree: 5 } })).toEqual({ ok: true, missing: [] });
        expect(validateRow({ values: { date: '2026-10-27', site: '  ', duree: 5 } }).missing).toEqual(['site']);
        expect(validateRow({ values: { date: '', site: 'A', duree: 0 } }).missing).toEqual(['date', 'duree']);
    });
});

describe('buildFlight', () => {
    const build = (flight = sample, options = {}, sessions = []) => {
        const [row] = prepareRows(parseExport(rowsOf(flight)).entries, env({ sessions }));
        return buildFlight(row, { batchId: 'batch-1', importedAt: 1234, ...options });
    };

    it('stores a flight dated that day without inventing a time, and marks it', () => {
        const flight = build();
        expect(flight).toMatchObject({
            type: 'vol',
            datetime: '2026-10-27T00:00',
            dateOnly: true,
            site: 'Sanary',
            duree: 60,
            import: { source: IMPORT_SOURCE, batchId: 'batch-1', importedAt: 1234 },
        });
        expect(flight.import.key).toMatch(/\S/);
    });

    it('does not invent the wing, the harness or the flight type', () => {
        const flight = build();
        expect(flight).toMatchObject({ voile: '', sellette: '', typeVol: '', techDecollage: '' });
        expect(flight).not.toHaveProperty('gain');
        expect(flight).not.toHaveProperty('altitudeMax');
    });

    it('has every field the logbook screens read, so none breaks on it', () => {
        const flight = build();
        for (const field of [
            'commentaire',
            'ecole',
            'moniteur',
            'stageName',
            'stageSpecialty',
            'brevetPrepare',
            'accompagnateur',
            'pilotes',
            'treuilleur',
            'rescueDeployed',
            'rescueId',
            'priseTerrain',
            'vache',
            'typeExercice',
        ]) {
            expect(flight).toHaveProperty(field);
        }
        expect(flight.moniteur).toEqual([]);
        expect(flight.pilotes).toEqual([]);
        expect(flight.typeExercice).toEqual([]);
    });

    it('writes the height, the analysis and the instructor in the comment when no school is given', () => {
        const flight = build();
        expect(flight.ecole).toBe('');
        expect(flight.moniteur).toEqual([]);
        expect(flight.commentaire).toBe(
            [
                t('logbook.ffvl.comment.denivele', { value: 100 }),
                t('logbook.ffvl.comment.analyse', { value: 'Analyse personnelle' }),
                t('logbook.ffvl.comment.formateur', { value: 'Jean Dupont' }),
            ].join(' · '),
        );
    });

    it('stores the instructor as the instructor of the school when a school is given', () => {
        const flight = build(sample, { school: ' Le Fil d’Ariane ' });
        expect(flight.ecole).toBe('Le Fil d’Ariane');
        expect(flight.moniteur).toEqual(['Jean Dupont']);
        expect(flight.commentaire).not.toContain('Jean Dupont');
        expect(flight.commentaire).toContain('Analyse personnelle');
    });

    it('leaves the comment empty when the export holds nothing else', () => {
        const flight = build([excelDay('2026-10-27'), 'SANARY', null, '30 minutes', '', '']);
        expect(flight.commentaire).toBe('');
    });

    it('writes the site the pilot corrected', () => {
        const [row] = prepareRows(parseExport(rowsOf(sample)).entries, env());
        setValue(row, 'site', 'Sanary-sur-Mer');
        expect(buildFlight(row, { batchId: 'b', importedAt: 1 }).site).toBe('Sanary-sur-Mer');
    });

    it('keeps the key of the row, so the next import recognises the flight', () => {
        const [row] = prepareRows(parseExport(rowsOf(sample)).entries, env());
        expect(buildFlight(row, { batchId: 'b', importedAt: 1 }).import.key).toBe(row.key);
    });
});
