import { deflateRawSync } from 'node:zlib';

// Builds a small .xlsx file (a zip of XML parts) the way the FFVL Intranet export is laid out: one worksheet, strings
// in sharedStrings.xml, numbers (dates as Excel day numbers) written as `<v>46322.0</v>`. Only for tests.

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
});

function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
}

const escapeXml = (text) =>
    String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Zip of `{name: text}`; `stored` lists the names written without compression. */
export function zip(parts, { stored = [] } = {}) {
    const chunks = [];
    const central = [];
    let offset = 0;
    for (const [name, text] of Object.entries(parts)) {
        const data = Buffer.from(text, 'utf8');
        const method = stored.includes(name) ? 0 : 8;
        const body = method === 0 ? data : deflateRawSync(data);
        const nameBytes = Buffer.from(name, 'utf8');
        const header = Buffer.alloc(30);
        header.writeUInt32LE(0x04034b50, 0);
        header.writeUInt16LE(20, 4);
        header.writeUInt16LE(method, 8);
        header.writeUInt32LE(crc32(data), 14);
        header.writeUInt32LE(body.length, 18);
        header.writeUInt32LE(data.length, 22);
        header.writeUInt16LE(nameBytes.length, 26);
        chunks.push(header, nameBytes, body);
        const entry = Buffer.alloc(46);
        entry.writeUInt32LE(0x02014b50, 0);
        entry.writeUInt16LE(20, 4);
        entry.writeUInt16LE(20, 6);
        entry.writeUInt16LE(method, 10);
        entry.writeUInt32LE(crc32(data), 16);
        entry.writeUInt32LE(body.length, 20);
        entry.writeUInt32LE(data.length, 24);
        entry.writeUInt16LE(nameBytes.length, 28);
        entry.writeUInt32LE(offset, 42);
        central.push(entry, nameBytes);
        offset += header.length + nameBytes.length + body.length;
    }
    const directory = Buffer.concat(central);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(central.length / 2, 8);
    end.writeUInt16LE(central.length / 2, 10);
    end.writeUInt32LE(directory.length, 12);
    end.writeUInt32LE(offset, 16);
    return new Uint8Array(Buffer.concat([...chunks, directory, end]));
}

const columnName = (index) => String.fromCharCode(65 + index);

/**
 * @param {Array<Array<string|number|null>>} rows
 * @param {{inlineStrings?: boolean, stored?: boolean}} [options] `inlineStrings`: write text in the cells instead of
 *   sharedStrings.xml (what some tools do); `stored`: no compression
 */
export function buildXlsx(rows, { inlineStrings = false, stored = false } = {}) {
    const strings = [];
    const sheetRows = rows
        .map((row, r) => {
            const cells = row
                .map((value, c) => {
                    const ref = `${columnName(c)}${r + 1}`;
                    if (value === null || value === undefined || value === '') return `<c r="${ref}" s="0"/>`;
                    if (typeof value === 'number') return `<c r="${ref}"><v>${value}</v></c>`;
                    if (inlineStrings) return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
                    let index = strings.indexOf(value);
                    if (index < 0) index = strings.push(value) - 1;
                    return `<c r="${ref}" t="s"><v>${index}</v></c>`;
                })
                .join('');
            return `<row r="${r + 1}">${cells}</row>`;
        })
        .join('');
    const parts = {
        '[Content_Types].xml':
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>',
        'xl/workbook.xml':
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Worksheet" sheetId="1" r:id="rId4"/></sheets></workbook>',
        'xl/_rels/workbook.xml.rels':
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
        'xl/sharedStrings.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" uniqueCount="${strings.length}">${strings
            .map((s) => `<si><t>${escapeXml(s)}</t></si>`)
            .join('')}</sst>`,
        'xl/worksheets/sheet1.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`,
    };
    return zip(parts, { stored: stored ? Object.keys(parts) : [] });
}

/** The header of the FFVL Intranet export. */
export const FFVL_HEADER = ['Date', 'Site', 'Dénivelé', 'Durée', 'Analyse', 'Formateur'];

/** Excel day number of a `YYYY-MM-DD` date (what the Intranet writes in the Date column). */
export function excelDay(isoDate) {
    return Math.round(
        (Date.UTC(...isoDate.split('-').map((n, i) => (i === 1 ? n - 1 : +n))) - Date.UTC(1899, 11, 30)) / 86400000,
    );
}

/** An export of the given flights `[date, site, denivele, 'N minutes', analyse, formateur]`. */
export function ffvlExport(flights, options) {
    return buildXlsx([FFVL_HEADER, ...flights.map(([date, ...rest]) => [excelDay(date), ...rest])], options);
}

/**
 * The export of the FFVL Intranet as the site writes it (parts copied from a real file, the instructor's name
 * replaced): extra XML namespaces, a style on the date cell, `46322.0`, a spare empty column G in the dimension.
 */
export function intranetExport() {
    const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
    return zip({
        '[Content_Types].xml': `${xml}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>`,
        'xl/_rels/workbook.xml.rels': `${xml}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
        'xl/sharedStrings.xml': `${xml}<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" uniqueCount="10"><si><t>Date</t></si><si><t>Site</t></si><si><t>Dénivelé</t></si><si><t>Durée</t></si><si><t>Analyse</t></si><si><t>Formateur</t></si><si><t>SANARY</t></si><si><t>60 minutes</t></si><si><t>Analyse perosnnelle</t></si><si><t>Jean Dupont</t></si></sst>`,
        'xl/workbook.xml': `${xml}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><fileVersion appName="xl" lastEdited="4" lowestEdited="4" rupBuild="4505"/><workbookPr codeName="ThisWorkbook"/><bookViews><workbookView activeTab="0" autoFilterDateGrouping="true" firstSheet="0" minimized="false" showHorizontalScroll="true" showSheetTabs="true" showVerticalScroll="true" tabRatio="600" visibility="visible"/></bookViews><sheets><sheet name="Worksheet" sheetId="1" r:id="rId4"/></sheets><definedNames/><calcPr calcId="999999" calcMode="auto" calcCompleted="1" fullCalcOnLoad="0" forceFullCalc="0"/></workbook>`,
        'xl/worksheets/sheet1.xml': `${xml}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:x14="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main" xmlns:xm="http://schemas.microsoft.com/office/excel/2006/main" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="x14ac" xmlns:x14ac="http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac"><sheetPr><outlinePr summaryBelow="1" summaryRight="1"/></sheetPr><dimension ref="A1:G2"/><sheetViews><sheetView tabSelected="1" workbookViewId="0" showGridLines="true" showRowColHeaders="1"><selection activeCell="A2" sqref="A2"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="14.4" outlineLevelRow="0" outlineLevelCol="0"/><cols><col min="1" max="1" width="12" customWidth="true" style="0"/></cols><sheetData><row r="1" spans="1:7"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c><c r="E1" t="s"><v>4</v></c><c r="F1" t="s"><v>5</v></c></row><row r="2" spans="1:7"><c r="A2" s="1"><v>46322.0</v></c><c r="B2" t="s"><v>6</v></c><c r="C2"><v>100</v></c><c r="D2" t="s"><v>7</v></c><c r="E2" t="s"><v>8</v></c><c r="F2" t="s"><v>9</v></c></row></sheetData><printOptions gridLines="false" gridLinesSet="true"/><pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/><pageSetup paperSize="1" orientation="default" scale="100" fitToHeight="1" fitToWidth="1" pageOrder="downThenOver"/></worksheet>`,
    });
}
