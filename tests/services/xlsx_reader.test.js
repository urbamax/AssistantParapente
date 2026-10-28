import { describe, it, expect } from 'vitest';
import { readXlsx, XlsxError } from '../../js/services/xlsx_reader.js';
import { buildXlsx, ffvlExport, excelDay, zip } from '../helpers/xlsx_fixture.js';

// Spec 046 : lecture d'un .xlsx sans bibliothèque ni réseau (le carnet FFVL n'existe qu'en Excel).

describe('xlsx_reader', () => {
    it('knows the Excel day number of the sample export date', () => {
        expect(excelDay('2026-10-27')).toBe(46322);
    });

    it('reads the strings and numbers of the first worksheet, row by row', async () => {
        const rows = await readXlsx(
            buildXlsx([
                ['Date', 'Site', 'Durée'],
                [46322, 'SANARY', '60 minutes'],
            ]),
        );
        expect(rows).toEqual([
            ['Date', 'Site', 'Durée'],
            [46322, 'SANARY', '60 minutes'],
        ]);
    });

    it('reads a number written the way the Intranet writes it (46322.0)', async () => {
        const bytes = ffvlExport([['2026-10-27', 'SANARY', 100, '60 minutes', 'x', 'y']]);
        const rows = await readXlsx(bytes);
        expect(rows[1][0]).toBe(46322);
        expect(rows[1][2]).toBe(100);
    });

    it('keeps empty cells as null so columns stay aligned', async () => {
        const rows = await readXlsx(
            buildXlsx([
                ['A', null, 'C'],
                [null, 'B', null],
            ]),
        );
        expect(rows).toEqual([
            ['A', null, 'C'],
            [null, 'B', null],
        ]);
    });

    it('decodes XML entities and accents', async () => {
        const rows = await readXlsx(buildXlsx([['Dénivelé', 'Pente & "école" <1>']]));
        expect(rows[0]).toEqual(['Dénivelé', 'Pente & "école" <1>']);
    });

    it('reads text written in the cells (inline strings)', async () => {
        const rows = await readXlsx(buildXlsx([['Site'], ['Annecy']], { inlineStrings: true }));
        expect(rows).toEqual([['Site'], ['Annecy']]);
    });

    it('reads a file whose parts are stored without compression', async () => {
        const rows = await readXlsx(buildXlsx([['Site'], ['Annecy']], { stored: true }));
        expect(rows).toEqual([['Site'], ['Annecy']]);
    });

    it('accepts an ArrayBuffer as well as bytes', async () => {
        const bytes = buildXlsx([['Site']]);
        const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        expect(await readXlsx(buffer)).toEqual([['Site']]);
    });

    it('joins the pieces of a rich-text string', async () => {
        // A shared string made of two runs
        const parts = {
            '[Content_Types].xml': '<Types/>',
            'xl/workbook.xml':
                '<workbook xmlns:r="r"><sheets><sheet name="S" sheetId="1" r:id="rId1"/></sheets></workbook>',
            'xl/_rels/workbook.xml.rels':
                '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
            'xl/sharedStrings.xml': '<sst><si><r><t>Ana</t></r><r><t xml:space="preserve">lyse</t></r></si></sst>',
            'xl/worksheets/sheet1.xml':
                '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row></sheetData></worksheet>',
        };
        expect(await readXlsx(zip(parts))).toEqual([['Analyse']]);
    });

    it('rejects something that is not a zip file, with a code', async () => {
        const error = await readXlsx(new TextEncoder().encode('Date;Site\n27/10/2026;SANARY')).catch((e) => e);
        expect(error).toBeInstanceOf(XlsxError);
        expect(error.code).toBe('notXlsx');
    });

    it('rejects a zip file that has no worksheet', async () => {
        const error = await readXlsx(zip({ 'readme.txt': 'hello' })).catch((e) => e);
        expect(error).toBeInstanceOf(XlsxError);
        expect(error.code).toBe('notXlsx');
    });

    it('rejects an empty or truncated file', async () => {
        expect((await readXlsx(new Uint8Array()).catch((e) => e)).code).toBe('notXlsx');
        const bytes = buildXlsx([['Site']]);
        expect((await readXlsx(bytes.slice(0, bytes.length - 40)).catch((e) => e)).code).toBe('notXlsx');
    });

    it('refuses a worksheet that unpacks to an unreasonable size', async () => {
        const huge = 'x'.repeat(30 * 1024 * 1024);
        const parts = {
            'xl/worksheets/sheet1.xml': `<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>${huge}</t></is></c></row></sheetData></worksheet>`,
        };
        const error = await readXlsx(zip(parts)).catch((e) => e);
        expect(error).toBeInstanceOf(XlsxError);
        expect(error.code).toBe('tooLarge');
    });
});
