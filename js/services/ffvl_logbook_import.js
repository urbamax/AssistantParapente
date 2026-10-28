/**
 * FfvlLogbookImport
 * Import de l'export Excel du carnet de vols de l'Intranet FFVL (spec 046), sans accès au DOM : lire le
 * fichier, en faire un tableau d'une ligne par vol, reconnaître les vols déjà importés ou déjà au carnet,
 * valider et construire les vols enregistrés.
 *
 * L'export (Date, Site, Dénivelé, Durée, Analyse, Formateur) ne donne ni l'heure, ni la voile, ni la
 * sellette, ni le type de vol : ces champs restent vides, rien n'est inventé. Chaque vol importé porte
 * `import = { source, batchId, importedAt, key }` : `key` reconnaît la ligne d'un export à l'autre,
 * `batchId` rassemble les vols d'un même import pour pouvoir l'annuler.
 */
import { readXlsx, XlsxError } from './xlsx_reader.js';
import { formatDateOnly } from '../utils/date_utils.js';
import { t } from '../utils/i18n.js';

export const IMPORT_SOURCE = 'ffvl-xlsx';

/** Écart de durée en dessous duquel un vol saisi à la main passe pour le même vol (minutes). */
export const SIMILAR_MINUTES = 10;

const MANDATORY = ['date', 'site', 'duree'];
const FIXED_STATUS = ['invalid'];

const text = (value) => (typeof value === 'string' ? value.trim() : '');
const reason = (key, params) => t(`logbook.ffvl.reasons.${key}`, params);

export class FfvlImportError extends Error {
    /** @param {'unreadable'|'notFfvl'|'tooLarge'} code */
    constructor(code, message = code) {
        super(message);
        this.name = 'FfvlImportError';
        this.code = code;
    }
}

// ---------------------------------------------------------------------------------------------
// Valeurs d'une cellule
// ---------------------------------------------------------------------------------------------

/** « Sanary », « Écharpe » → « sanary », « echarpe » : pour comparer deux noms. */
const normalize = (value) =>
    text(String(value ?? ''))
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ');

function isoDate(year, month, day) {
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    return date.toISOString().slice(0, 10);
}

/**
 * Date d'une cellule : un jour Excel (nombre), « 27/10/2026 » (jour d'abord) ou « 2026-10-27 ».
 * @param {unknown} value
 * @returns {string|null} `AAAA-MM-JJ`
 */
export function parseDate(value) {
    if (typeof value === 'number') {
        // Un jour Excel : 1 = 01/01/1900 (avec le jour 29/02/1900 que Excel invente : on part du 30/12/1899)
        if (!Number.isFinite(value) || value < 1000 || value > 80000) return null;
        return new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86400000).toISOString().slice(0, 10);
    }
    const written = text(value);
    const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(written);
    if (iso) return isoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    const french = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(written);
    return french ? isoDate(Number(french[3]), Number(french[2]), Number(french[1])) : null;
}

/**
 * Durée d'une cellule, en minutes entières d'au moins une : un nombre de minutes, « 60 minutes »,
 * « 1h30 », « 01:30 » ou une heure Excel (fraction de jour).
 * @param {unknown} value
 * @returns {number|null}
 */
export function parseDuration(value) {
    let minutes = null;
    if (typeof value === 'number') {
        minutes = value > 0 && value < 1 ? value * 1440 : value;
    } else {
        const written = text(value).toLowerCase();
        const clock = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(written);
        const hours = /^(\d+)\s*(?:h|heures?)\s*(?:(\d+)\s*(?:min(?:utes?)?)?)?$/.exec(written);
        const plain = /^(\d+)\s*(?:min(?:utes?)?)?$/.exec(written);
        if (clock) minutes = Number(clock[1]) * 60 + Number(clock[2]);
        else if (hours) minutes = Number(hours[1]) * 60 + Number(hours[2] || 0);
        else if (plain) minutes = Number(plain[1]);
    }
    return Number.isFinite(minutes) && Math.round(minutes) >= 1 ? Math.round(minutes) : null;
}

/** Dénivelé d'une cellule : un nombre de mètres, avec ou sans unité ; null s'il est vide ou illisible. */
function parseHeight(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const match = /^-?\d+(?:[.,]\d+)?/.exec(text(value));
    return match ? Number(match[0].replace(',', '.')) : null;
}

/**
 * Le site tel que le carnet l'écrit : celui d'une liste de sites connus (sans tenir compte des
 * majuscules ni des accents) ; sinon un nom tout en majuscules est mis en majuscules et minuscules
 * (« SANARY » → « Sanary ») et un autre nom reste tel quel.
 * @param {unknown} raw
 * @param {string[]} knownSites
 */
export function resolveSite(raw, knownSites) {
    const site = text(typeof raw === 'string' ? raw : '');
    if (!site) return '';
    const key = normalize(site);
    const known = (knownSites || []).find((name) => normalize(name) === key);
    if (known) return known;
    const isCapitals = site === site.toUpperCase() && site !== site.toLowerCase();
    if (!isCapitals) return site;
    return site.toLowerCase().replace(/\p{L}+/gu, (word) => word[0].toUpperCase() + word.slice(1));
}

// ---------------------------------------------------------------------------------------------
// Lecture du fichier
// ---------------------------------------------------------------------------------------------

const COLUMN_TITLES = {
    date: 'date',
    site: 'site',
    denivele: 'denivele',
    duree: 'duree',
    analyse: 'analyse',
    formateur: 'formateur',
};

/** Ligne de titres : celle qui contient « Date » et « Durée » (dans n'importe quel ordre). */
function findHeader(rows) {
    for (const [index, row] of rows.entries()) {
        const columns = {};
        row.forEach((cell, column) => {
            const title = Object.entries(COLUMN_TITLES).find(([, label]) => normalize(cell) === label);
            if (title && columns[title[0]] === undefined) columns[title[0]] = column;
        });
        if (columns.date !== undefined && columns.duree !== undefined) return { index, columns };
    }
    return null;
}

/**
 * Les vols d'un export, ligne par ligne. Une ligne dont la date ou la durée est illisible est gardée,
 * avec le problème nommé (`problem` : 'date' ou 'duration').
 * @param {Array<Array<string|number|null>>} rows les lignes de la feuille
 * @returns {{entries: Array<{line: number, date: string|null, site: string, denivele: number|null, duree: number|null, analyse: string, formateur: string, problem: 'date'|'duration'|null}>}}
 * @throws {FfvlImportError} `notFfvl` : pas de colonnes « Date » et « Durée »
 */
export function parseExport(rows) {
    const header = findHeader(rows || []);
    if (!header) throw new FfvlImportError('notFfvl');
    const cell = (row, name) => (header.columns[name] === undefined ? null : row[header.columns[name]]);
    const cellText = (row, name) => {
        const value = cell(row, name);
        return typeof value === 'number' ? String(value) : text(value);
    };
    const entries = [];
    rows.slice(header.index + 1).forEach((row, offset) => {
        if (row.every((value) => value === null || text(String(value)) === '')) return;
        const date = parseDate(cell(row, 'date'));
        const duree = parseDuration(cell(row, 'duree'));
        entries.push({
            line: header.index + offset + 2,
            date,
            site: cellText(row, 'site'),
            denivele: parseHeight(cell(row, 'denivele')),
            duree,
            analyse: cellText(row, 'analyse'),
            formateur: cellText(row, 'formateur'),
            problem: date === null ? 'date' : duree === null ? 'duration' : null,
        });
    });
    return { entries };
}

/**
 * Lit un fichier .xlsx choisi par le pilote.
 * @param {File} file
 * @throws {FfvlImportError} `unreadable` (pas un classeur), `tooLarge` ou `notFfvl`
 */
export async function readFfvlExport(file) {
    let rows;
    try {
        rows = await readXlsx(await file.arrayBuffer());
    } catch (error) {
        if (error instanceof XlsxError)
            throw new FfvlImportError(error.code === 'tooLarge' ? 'tooLarge' : 'unreadable');
        throw new FfvlImportError('unreadable');
    }
    return parseExport(rows);
}

// ---------------------------------------------------------------------------------------------
// Le tableau
// ---------------------------------------------------------------------------------------------

/** Validation d'une ligne : la date, le site et la durée sont obligatoires, comme dans le formulaire d'un vol. */
export function validateRow(row) {
    const v = row.values || {};
    const missing = MANDATORY.filter((field) =>
        field === 'duree' ? !(Number.isInteger(Number(v.duree)) && Number(v.duree) >= 1) : !text(v[field]),
    );
    return { ok: missing.length === 0, missing };
}

/** Recalcule l'état et la raison d'une ligne d'après ses valeurs (appelé après chaque correction). */
export function refreshRow(row) {
    if (FIXED_STATUS.includes(row.status)) return row;
    const { ok, missing } = validateRow(row);
    row.issues = missing;
    if (row.flag === 'imported') {
        row.status = 'imported';
        row.reason = reason('imported', { date: formatDateOnly(row.importedAt) });
    } else if (!ok) {
        row.status = 'fix';
        row.reason = reason('missing', { fields: missing.map((f) => t(`logbook.ffvl.fields.${f}`)).join(', ') });
    } else if (row.flag === 'similar') {
        row.status = 'similar';
        row.reason = reason('similar');
    } else {
        row.status = 'ready';
        row.reason = '';
    }
    return row;
}

/** Corrige une valeur d'une ligne (le site) ; la clé de la ligne, elle, ne change pas. */
export function setValue(row, field, value) {
    row.values[field] = field === 'duree' ? Math.trunc(Number(value)) || 0 : value;
    row.edited.add(field);
    return refreshRow(row);
}

/**
 * Empreinte d'une ligne de l'export, avec son rang parmi les lignes identiques du fichier : deux vols
 * identiques le même jour restent deux vols, et une même ligne a la même clé dans tous les exports.
 */
function keysOf(entries) {
    const seen = new Map();
    return entries.map((entry) => {
        const fingerprint = [
            entry.date,
            normalize(entry.site),
            entry.denivele ?? '',
            entry.duree,
            normalize(entry.analyse),
            normalize(entry.formateur),
        ].join('|');
        const rank = seen.get(fingerprint) || 0;
        seen.set(fingerprint, rank + 1);
        return `${fingerprint}#${rank}`;
    });
}

/** Un vol saisi à la main : même jour, même site, durée proche (hors vols déjà importés et gonflages). */
function isSimilar(row, sessions) {
    const site = normalize(row.values.site);
    return (sessions || []).some(
        (s) =>
            s.type === 'vol' &&
            !s.import &&
            text(s.datetime).slice(0, 10) === row.values.date &&
            normalize(s.site || s.lieu) === site &&
            Math.abs((parseInt(s.duree, 10) || 0) - row.values.duree) <= SIMILAR_MINUTES,
    );
}

/**
 * Le tableau d'un export : une ligne par vol, dans l'ordre du fichier.
 * @param {ReturnType<typeof parseExport>['entries']} entries
 * @param {{sessions?: any[], knownSites?: string[]}} env `sessions` : le carnet ; `knownSites` : sites connus
 */
export function prepareRows(entries, env) {
    const sessions = (env && env.sessions) || [];
    const importedByKey = new Map(
        sessions.filter((s) => s.import && s.import.source === IMPORT_SOURCE).map((s) => [s.import.key, s.import]),
    );
    const keys = keysOf(entries);
    return entries.map((entry, i) => {
        const row = {
            id: `r${i}`,
            line: entry.line,
            key: keys[i],
            status: 'ready',
            reason: '',
            included: true,
            flag: null,
            importedAt: null,
            issues: [],
            edited: new Set(),
            values: {
                date: entry.date || '',
                site: resolveSite(entry.site, env && env.knownSites),
                duree: entry.duree || 0,
                denivele: entry.denivele,
                analyse: entry.analyse,
                formateur: entry.formateur,
            },
        };
        if (entry.problem) {
            row.status = 'invalid';
            row.reason = reason(entry.problem === 'date' ? 'invalidDate' : 'invalidDuration');
            row.included = false;
            return row;
        }
        const done = importedByKey.get(row.key);
        if (done) {
            row.flag = 'imported';
            row.importedAt = done.importedAt;
            row.included = false;
        } else if (isSimilar(row, sessions)) {
            row.flag = 'similar';
            row.included = false;
        }
        return refreshRow(row);
    });
}

// ---------------------------------------------------------------------------------------------
// Le vol enregistré
// ---------------------------------------------------------------------------------------------

/** Dénivelé, analyse et formateur, tels que l'export les donne, en une phrase lisible sur la carte du vol. */
function commentOf(v, withInstructor) {
    const part = (key, value) => t(`logbook.ffvl.comment.${key}`, { value });
    return [
        v.denivele !== null && v.denivele !== undefined ? part('denivele', v.denivele) : '',
        text(v.analyse) ? part('analyse', text(v.analyse)) : '',
        withInstructor && text(v.formateur) ? part('formateur', text(v.formateur)) : '',
    ]
        .filter(Boolean)
        .join(' · ');
}

/**
 * Le vol qu'ajoute cette ligne. Pas d'heure (l'export n'en a pas : `dateOnly`), ni voile, sellette ou
 * type de vol. Le dénivelé n'est pas le « gain » d'une trace (hauteur au-dessus du décollage) : il va
 * dans le commentaire. Le formateur est le moniteur de l'école si le pilote en indique une ; sans
 * école, le formulaire d'un vol ne garde pas les moniteurs, il va donc dans le commentaire.
 * `id`, `updatedAt` et `syncPending` sont posés à l'ajout (LogbookService.addFlights).
 * @param {any} row
 * @param {{batchId: string, importedAt: number, school?: string}} options
 */
export function buildFlight(row, { batchId, importedAt, school = '' }) {
    const v = row.values;
    const ecole = text(school);
    const instructor = text(v.formateur);
    return {
        type: 'vol',
        datetime: `${v.date}T00:00`,
        dateOnly: true,
        site: text(v.site),
        duree: Math.trunc(Number(v.duree)),
        voile: '',
        sellette: '',
        typeVol: '',
        techDecollage: '',
        commentaire: commentOf(v, !ecole),
        ecole,
        moniteur: ecole && instructor ? [instructor] : [],
        stageName: '',
        stageSpecialty: '',
        brevetPrepare: '',
        accompagnateur: [],
        pilotes: [],
        treuilleur: '',
        rescueDeployed: false,
        rescueId: '',
        priseTerrain: '',
        vache: false,
        typeExercice: [],
        import: { source: IMPORT_SOURCE, batchId, importedAt, key: row.key },
    };
}
