/**
 * XlsxReader
 * Lecture minimale d'un classeur Excel (.xlsx), sans bibliothèque ni réseau (spec 046) : le carnet de vols
 * de l'Intranet FFVL n'existe qu'en Excel. Un .xlsx est une archive zip de fichiers XML ; on n'en lit que ce
 * qu'il faut pour obtenir les valeurs de la première feuille : le répertoire du zip, les textes partagés et
 * les cellules (texte, nombre). Les formules, styles, fusions et feuilles suivantes sont ignorés.
 */

/** Taille maximale d'un fichier décompressé : au-delà, le classeur n'est pas un carnet de vols. */
export const MAX_PART_BYTES = 20 * 1024 * 1024;
/** Une feuille plus grande que ça n'est pas un carnet de vols non plus (lignes, colonnes). */
const MAX_ROWS = 100000;
const MAX_COLUMNS = 200;

export class XlsxError extends Error {
    /**
     * @param {'notXlsx'|'tooLarge'} code
     * @param {string} [message]
     */
    constructor(code, message = code) {
        super(message);
        this.name = 'XlsxError';
        this.code = code;
    }
}

const notXlsx = () => new XlsxError('notXlsx', 'Not an .xlsx workbook');

// ---------------------------------------------------------------------------------------------
// L'archive zip
// ---------------------------------------------------------------------------------------------

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const UTF8 = new TextDecoder('utf-8');

/**
 * Fichiers de l'archive : nom, méthode de compression et position des données compressées.
 * @param {Uint8Array} bytes
 * @returns {Map<string, {method: number, start: number, size: number, expected: number}>}
 */
function listEntries(bytes) {
    if (bytes.length < 22) throw notXlsx();
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let end = -1;
    for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 22 - 65535); at--) {
        if (view.getUint32(at, true) === EOCD_SIGNATURE) {
            end = at;
            break;
        }
    }
    if (end < 0) throw notXlsx();
    const count = view.getUint16(end + 10, true);
    let at = view.getUint32(end + 16, true);
    const entries = new Map();
    for (let i = 0; i < count; i++) {
        if (at + 46 > bytes.length || view.getUint32(at, true) !== CENTRAL_SIGNATURE) throw notXlsx();
        const flags = view.getUint16(at + 8, true);
        const method = view.getUint16(at + 10, true);
        const size = view.getUint32(at + 20, true);
        const expected = view.getUint32(at + 24, true);
        const nameLength = view.getUint16(at + 28, true);
        const extraLength = view.getUint16(at + 30, true);
        const commentLength = view.getUint16(at + 32, true);
        const local = view.getUint32(at + 42, true);
        if (at + 46 + nameLength > bytes.length || local + 30 > bytes.length) throw notXlsx();
        const name = UTF8.decode(bytes.subarray(at + 46, at + 46 + nameLength));
        if (view.getUint32(local, true) !== LOCAL_SIGNATURE) throw notXlsx();
        const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
        // Fichier chiffré ou qui déborde de l'archive : on ne sait pas le lire
        if (flags & 1 || start + size > bytes.length) throw notXlsx();
        entries.set(name, { method, start, size, expected });
        at += 46 + nameLength + extraLength + commentLength;
    }
    return entries;
}

/** Décompresse des données « deflate » brutes, en s'arrêtant dès que la taille permise est dépassée. */
async function inflate(data, limit) {
    const reader = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
    const chunks = [];
    let total = 0;
    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            total += value.length;
            if (total > limit) {
                reader.cancel().catch(() => {});
                throw new XlsxError('tooLarge');
            }
            chunks.push(value);
        }
    } catch (error) {
        if (error instanceof XlsxError) throw error;
        throw notXlsx();
    }
    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        out.set(chunk, offset);
        offset += chunk.length;
    }
    return out;
}

/** Texte d'un fichier de l'archive, ou null s'il n'y est pas. */
async function readPart(bytes, entries, name) {
    const entry = entries.get(name);
    if (!entry) return null;
    if (entry.expected > MAX_PART_BYTES) throw new XlsxError('tooLarge');
    const data = bytes.subarray(entry.start, entry.start + entry.size);
    if (entry.method === 0) return UTF8.decode(data);
    if (entry.method === 8) return UTF8.decode(await inflate(data, MAX_PART_BYTES));
    throw notXlsx();
}

// ---------------------------------------------------------------------------------------------
// Le XML
// ---------------------------------------------------------------------------------------------

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decodeXml(text) {
    return text
        .replace(/&(?:#(\d+)|#x([0-9a-f]+)|(amp|lt|gt|quot|apos));/gi, (_, dec, hex, name) =>
            name ? ENTITIES[name.toLowerCase()] : String.fromCodePoint(parseInt(dec || hex, dec ? 10 : 16)),
        )
        .replace(/_x([0-9a-f]{4})_/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

/** Valeur d'un attribut d'une balise, dans n'importe quel ordre. */
function attribute(tag, name) {
    const match = new RegExp(`(?:^|[\\s<])${name}\\s*=\\s*"([^"]*)"`).exec(tag);
    return match ? decodeXml(match[1]) : null;
}

/** Texte d'un bloc : tous ses `<t>` mis bout à bout (un texte mis en forme en a plusieurs), sans la phonétique. */
function textOf(block) {
    const plain = block.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
    let text = '';
    for (const match of plain.matchAll(/<t\b[^>]*?(?:\/>|>([\s\S]*?)<\/t>)/g))
        text += match[1] ? decodeXml(match[1]) : '';
    return text;
}

function parseSharedStrings(xml) {
    if (!xml) return [];
    return Array.from(xml.matchAll(/<si\b[^>]*?(?:\/>|>([\s\S]*?)<\/si>)/g), (match) => textOf(match[1] || ''));
}

/** Chemin de la première feuille dans l'archive (d'après le classeur, sinon la première `sheetN.xml`). */
async function firstSheetPath(bytes, entries) {
    const workbook = await readPart(bytes, entries, 'xl/workbook.xml');
    const rels = await readPart(bytes, entries, 'xl/_rels/workbook.xml.rels');
    const sheet = workbook ? /<sheet\b[^>]*>/.exec(workbook) : null;
    const relId = sheet ? attribute(sheet[0], 'r:id') : null;
    if (relId && rels) {
        for (const [tag] of rels.matchAll(/<Relationship\b[^>]*>/g)) {
            if (attribute(tag, 'Id') !== relId) continue;
            const target = attribute(tag, 'Target') || '';
            const path = target.startsWith('/') ? target.slice(1) : `xl/${target}`;
            if (entries.has(path)) return path;
        }
    }
    const guess = [...entries.keys()].filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name)).sort();
    return guess[0] || null;
}

/** Position d'une cellule « C12 » : colonne 2, ligne 11 (de 0). */
function position(ref) {
    const match = /^([A-Z]+)(\d+)$/i.exec(ref || '');
    if (!match) return null;
    const column = [...match[1].toUpperCase()].reduce((n, letter) => n * 26 + letter.charCodeAt(0) - 64, 0) - 1;
    return { row: Number(match[2]) - 1, column };
}

function cellValue(attrs, body, shared) {
    const type = attribute(attrs, 't');
    if (type === 'inlineStr') return textOf(body) || null;
    const raw = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(body);
    if (!raw) return null;
    if (type === 's') return shared[Number(raw[1])] ?? null;
    if (type === 'str') return decodeXml(raw[1]) || null;
    if (type === 'e') return null;
    const number = Number(raw[1]);
    return Number.isFinite(number) ? number : null;
}

function parseSheet(xml, shared) {
    const cells = [];
    let rowCount = 0;
    let columnCount = 0;
    let next = 0;
    for (const match of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const where = position(attribute(match[1], 'r')) || { row: Math.max(rowCount - 1, 0), column: next };
        next = where.column + 1;
        if (where.row >= MAX_ROWS || where.column >= MAX_COLUMNS) throw new XlsxError('tooLarge');
        const value = cellValue(match[1], match[2] || '', shared);
        rowCount = Math.max(rowCount, where.row + 1);
        columnCount = Math.max(columnCount, where.column + 1);
        if (value !== null) cells.push([where.row, where.column, value]);
    }
    const rows = Array.from({ length: rowCount }, () => Array(columnCount).fill(null));
    for (const [row, column, value] of cells) rows[row][column] = value;
    return rows;
}

// ---------------------------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------------------------

/**
 * Les lignes de la première feuille d'un classeur .xlsx : textes et nombres (un jour Excel est un nombre),
 * `null` pour une cellule vide, toutes les lignes de la même longueur.
 * @param {ArrayBuffer|Uint8Array} content
 * @returns {Promise<Array<Array<string|number|null>>>}
 * @throws {XlsxError} `notXlsx` (pas un classeur lisible) ou `tooLarge`
 */
export async function readXlsx(content) {
    const bytes = content instanceof Uint8Array ? content : new Uint8Array(content);
    const entries = listEntries(bytes);
    const path = await firstSheetPath(bytes, entries);
    if (!path) throw notXlsx();
    const sheet = await readPart(bytes, entries, path);
    if (sheet === null) throw notXlsx();
    return parseSheet(sheet, parseSharedStrings(await readPart(bytes, entries, 'xl/sharedStrings.xml')));
}
