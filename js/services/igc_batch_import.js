/**
 * IgcBatchImport
 * Import de plusieurs vols d'un coup (spec 039), sans accès au DOM : lire les fichiers choisis, en
 * faire un tableau d'une ligne par vol, repérer les doublons et les vols déjà au carnet, associer les
 * fichiers de capteurs .sdf aux traces, valider et construire les vols enregistrés.
 *
 * Chaque ligne est construite à partir d'UN fichier (`prepareRow`) : rien n'est partagé entre les
 * lignes, ni dans le service ni dans la vue du formulaire (currentRawIgc, currentIgcStats…, qui ne
 * servent qu'au formulaire d'un vol). Le tableau d'une même sélection est donc le même quel que soit
 * l'ordre ou le nom des fichiers. Les fichiers .sdf sont associés aux traces par leur contenu
 * seulement.
 */
import LogbookService from './logbook_service.js';
import SdfParser from './sdf_parser.js';
import { classifyFlight } from './flight_classifier.js';
import { suggestDefaults } from './logbook_defaults.js';
import { companionsOf, instructorsOf, latestOfCourse } from './logbook_courses.js';
import { t } from '../utils/i18n.js';

/** Écart de décollage en dessous duquel deux fichiers sont le même vol (minutes et mètres). */
export const DUPLICATE_MINUTES = 5;
export const DUPLICATE_METERS = 500;

const IGC_FILE = /\.(igc|gpx)$/i;
const SDF_FILE = /\.sdf$/i;
const MANDATORY = ['datetime', 'site', 'voile', 'duree'];
const FIXED_STATUS = ['unreadable', 'unsupported'];

const text = (value) => (typeof value === 'string' ? value.trim() : '');
const reason = (key, params) => t(`logbook.batch.reasons.${key}`, params);

// ---------------------------------------------------------------------------------------------
// Lecture des fichiers
// ---------------------------------------------------------------------------------------------

/** Rend la main au navigateur entre deux fichiers, pour que la page reste réactive. */
const yieldToBrowser = () => new Promise((resolve) => setTimeout(resolve, 0));

function readAsText(file) {
    if (typeof file.text === 'function') return file.text();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });
}

async function readAsBytes(file) {
    if (typeof file.arrayBuffer === 'function') return new Uint8Array(await file.arrayBuffer());
    return new Uint8Array(await new Response(file).arrayBuffer());
}

/**
 * Lit les fichiers choisis un par un. Aucun n'est écarté : un fichier qu'on ne peut pas lire est
 * rendu avec le genre `unreadable`, un fichier d'un autre type avec `unsupported`.
 * @param {ArrayLike<File>} files
 * @param {(done: number, total: number) => void} [onProgress]
 * @returns {Promise<Array<{name: string, kind: 'igc'|'sdf'|'unsupported'|'unreadable', text?: string, bytes?: Uint8Array}>>}
 */
export async function loadEntries(files, onProgress) {
    const list = Array.from(files || []);
    const entries = [];
    for (const [index, file] of list.entries()) {
        const name = file.name || '';
        try {
            if (SDF_FILE.test(name)) entries.push({ name, kind: 'sdf', bytes: await readAsBytes(file) });
            else if (IGC_FILE.test(name)) entries.push({ name, kind: 'igc', text: await readAsText(file) });
            else entries.push({ name, kind: 'unsupported' });
        } catch {
            entries.push({ name, kind: 'unreadable' });
        }
        if (onProgress) onProgress(index + 1, list.length);
        await yieldToBrowser();
    }
    return entries;
}

// ---------------------------------------------------------------------------------------------
// Une ligne = un fichier
// ---------------------------------------------------------------------------------------------

const blankValues = () => ({
    datetime: '',
    site: '',
    duree: 0,
    voile: '',
    sellette: '',
    typeVol: 'Plouf',
    techDecollage: 'Face voile',
    ecole: '',
    stageName: '',
    stageSpecialty: '',
    brevetPrepare: '',
    moniteur: [],
    accompagnateur: [],
    pilotes: [],
});

function skeleton(fileName, status, reasonText) {
    return {
        id: '',
        fileName,
        status,
        reason: reasonText,
        included: false,
        flag: null,
        duplicateOf: null,
        issues: [],
        warnings: [],
        values: blankValues(),
        searching: false,
        edited: new Set(),
        learned: {},
        trace: null,
        sensor: null,
    };
}

/**
 * Construit la ligne d'UN fichier, à partir de lui seul (fonction pure : rien d'autre n'est lu ni
 * modifié).
 * @param {{name: string, kind: string, text?: string}} entry
 */
export function prepareRow(entry) {
    const name = entry.name || '';
    if (entry.kind === 'unsupported') return skeleton(name, 'unsupported', reason('unsupported'));
    if (entry.kind !== 'igc') return skeleton(name, 'unreadable', reason('unreadable'));

    const result = LogbookService.parseIGC(entry.text || '');
    if (!result.success) return skeleton(name, 'unreadable', reason('unreadable'));
    const parsed = result.data;
    if (!parsed.dateStr || !(parsed.duration >= 1)) return skeleton(name, 'unreadable', reason('tooShort'));

    const row = skeleton(name, 'ready', '');
    row.included = true;
    row.values = { ...blankValues(), datetime: parsed.dateStr, duree: parsed.duration };
    row.trace = { rawIgc: entry.text, parsed };
    if (parsed.startsAirborne) row.warnings.push('startsAirborne');
    if (parsed.endsAirborne) row.warnings.push('endsAirborne');
    return row;
}

// ---------------------------------------------------------------------------------------------
// Validation et état d'une ligne
// ---------------------------------------------------------------------------------------------

/**
 * Valeurs obligatoires d'un vol, comme dans le formulaire : date et heure, site, voile, durée.
 * @param {{values: Record<string, any>}} row
 * @returns {{ok: boolean, missing: string[]}}
 */
export function validateRow(row) {
    const v = row.values || {};
    const missing = MANDATORY.filter((field) => {
        if (field === 'duree') return !(Number.isInteger(Number(v.duree)) && Number(v.duree) >= 1);
        return !text(v[field]);
    });
    return { ok: missing.length === 0, missing };
}

/** Recalcule l'état et la raison d'une ligne d'après ses valeurs (appelé après chaque correction). */
export function refreshRow(row) {
    if (FIXED_STATUS.includes(row.status)) return row;
    if (row.flag === 'duplicate') {
        row.status = 'duplicate';
        row.reason = reason('duplicate', { name: row.duplicateOf });
        row.issues = validateRow(row).missing;
        return row;
    }
    const { ok, missing } = validateRow(row);
    row.issues = missing;
    if (row.flag === 'known') {
        row.status = 'known';
        row.reason = reason('known');
    } else if (ok) {
        row.status = 'ready';
        row.reason = '';
    } else {
        row.status = 'fix';
        row.reason = reason('missing', { fields: missing.map((f) => t(`logbook.batch.fields.${f}`)).join(', ') });
    }
    return row;
}

// ---------------------------------------------------------------------------------------------
// Corrections faites sur une ligne
// ---------------------------------------------------------------------------------------------

/** Colonnes dont une valeur peut être recopiée sur les autres lignes, et les champs qu'elles portent. */
const COLUMN_FIELDS = {
    voile: ['voile'],
    sellette: ['sellette'],
    typeVol: ['typeVol'],
    course: ['stageName', 'ecole', 'stageSpecialty', 'moniteur', 'accompagnateur', 'brevetPrepare'],
    pilotes: ['pilotes'],
};

const copyValue = (value) => (Array.isArray(value) ? [...value] : value);

/**
 * Corrige une valeur d'une ligne : seule cette ligne change, le champ est noté « corrigé » (les
 * propositions et « Appliquer à toutes » n'y touchent plus) et l'état de la ligne est recalculé.
 */
export function setValue(row, field, value) {
    row.values[field] = field === 'duree' ? Math.trunc(Number(value)) || 0 : copyValue(value);
    row.edited.add(field);
    return refreshRow(row);
}

/**
 * Le stage d'une ligne : son nom, et, si c'est un stage connu, l'école, la spécialité, les moniteurs,
 * les accompagnateurs et les pilotes de sa dernière session, sans remplacer ce qui a été corrigé sur la ligne.
 * @param {any} row
 * @param {string} name
 * @param {any[]} sessions le carnet
 */
export function applyCourse(row, name, sessions) {
    row.values.stageName = name;
    row.edited.add('stageName');
    const reference = latestOfCourse(sessions, name);
    if (reference) {
        const proposed = {
            ecole: text(reference.ecole),
            stageSpecialty: text(reference.stageSpecialty),
            brevetPrepare: text(reference.brevetPrepare),
            moniteur: instructorsOf(reference),
            accompagnateur: companionsOf(reference),
            pilotes: Array.isArray(reference.pilotes) ? reference.pilotes : [],
        };
        for (const [field, value] of Object.entries(proposed)) {
            if (row.edited.has(field) || value.length === 0) continue;
            row.values[field] = copyValue(value);
            row.learned[field] = 'course';
        }
    }
    return refreshRow(row);
}

/**
 * Recopie la valeur d'une colonne (voile, sellette, typeVol, course, pilotes) d'une ligne sur les
 * autres lignes à importer, sauf celles où le pilote a déjà corrigé cette colonne.
 * @param {any[]} rows
 * @param {'voile'|'sellette'|'typeVol'|'course'|'pilotes'} column
 * @param {string} sourceId
 */
export function applyToOthers(rows, column, sourceId) {
    const fields = COLUMN_FIELDS[column];
    const source = rows.find((r) => r.id === sourceId);
    if (!fields || !source || !source.trace) return rows;
    for (const row of rows) {
        if (row === source || !row.trace) continue;
        if (fields.some((field) => row.edited.has(field))) continue;
        for (const field of fields) row.values[field] = copyValue(source.values[field]);
        refreshRow(row);
    }
    return rows;
}

/**
 * Cherche, un lieu après l'autre, le nom du lieu des lignes sans site (hors ligne : rien). Une
 * ligne dont le site a été saisi pendant la recherche garde ce qui a été saisi.
 * @param {any[]} rows
 * @param {(lat: number, lon: number) => Promise<{success: boolean, data?: {city?: string}}>} reverseGeocode
 * @param {(row: any) => void} [onRow] appelé quand l'état d'une ligne change
 * @param {{online?: boolean}} [options]
 */
export async function resolvePlaces(rows, reverseGeocode, onRow, { online = true } = {}) {
    if (!online) return;
    for (const row of rows) {
        if (!row.trace || text(row.values.site) || row.edited.has('site')) continue;
        const take = takeoffOf(row);
        row.searching = true;
        if (onRow) onRow(row);
        const result = await Promise.resolve()
            .then(() => reverseGeocode(take.lat, take.lon))
            .catch(() => null);
        row.searching = false;
        const city = result && result.success && result.data ? text(result.data.city) : '';
        if (city && !text(row.values.site) && !row.edited.has('site')) {
            row.values.site = city;
            row.learned.site = 'geocoded';
            refreshRow(row);
        }
        if (onRow) onRow(row);
    }
}

// ---------------------------------------------------------------------------------------------
// Doublons et vols déjà au carnet
// ---------------------------------------------------------------------------------------------

function distanceM(a, b) {
    const dLat = (a.lat - b.lat) * 111320;
    const dLon = (a.lon - b.lon) * 111320 * Math.cos((a.lat * Math.PI) / 180);
    return Math.hypot(dLat, dLon);
}

const takeoffOf = (row) => {
    const { points, takeoffIndex } = row.trace.parsed;
    return points[takeoffIndex] || points[0];
};

function sameFlight(a, b) {
    return Math.abs(a.timestamp - b.timestamp) <= DUPLICATE_MINUTES * 60000 && distanceM(a, b) <= DUPLICATE_METERS;
}

/** Un vol du carnet est le même vol qu'une ligne : même décollage à quelques minutes près et au même endroit. */
function isInLogbook(row, sessions) {
    const take = takeoffOf(row);
    const when = new Date(row.values.datetime).getTime();
    return (sessions || []).some((s) => {
        if (s.type !== 'vol') return false;
        const at = new Date(s.datetime).getTime();
        if (!Number.isFinite(at) || Math.abs(at - when) > DUPLICATE_MINUTES * 60000) return false;
        if (Number.isFinite(s.lat) && Number.isFinite(s.lon)) {
            return distanceM(take, { lat: s.lat, lon: s.lon }) <= DUPLICATE_METERS;
        }
        // Sans position : le site doit être le même ; l'heure seule ne suffit jamais
        return Boolean(text(s.site)) && text(s.site).toLowerCase() === text(row.values.site).toLowerCase();
    });
}

// ---------------------------------------------------------------------------------------------
// Fichiers de capteurs
// ---------------------------------------------------------------------------------------------

function sensorStatsFor(records, parsed, offset) {
    const { points, takeoffIndex } = parsed;
    const t0 = points[0].timestamp;
    const at = (i) => offset + Math.round((points[i].timestamp - t0) / 1000);
    const from = at(takeoffIndex || 0);
    const to = at(points.length - 1);
    /** @type {Record<string, any>} */
    const stats = { ...SdfParser.summarize(records, from, to), source: 'sdf' };
    // Facteur de charge au largage du treuil (± 5 s autour du point le plus haut)
    const winch = parsed.analysis && parsed.analysis.winch;
    if (winch) {
        const release = at((takeoffIndex || 0) + winch.releaseIndex);
        const around = SdfParser.summarize(records, release - 5, release + 5);
        if (around) stats.gRelease = around.gMax;
    }
    return stats;
}

/**
 * Associe chaque .sdf à la trace qu'il suit, par le contenu seul : il est essayé contre chaque trace
 * avec la vérification du formulaire d'un vol (SdfParser.alignToTrace puis matchesTrace). Il n'est
 * rattaché qu'à une trace qui lui correspond, et seulement si aucun autre ne correspond à la même
 * trace ni à lui : sinon il est signalé « ambigu » et rattaché à aucune. Un .sdf sans trace est
 * « non rattaché ». Les lignes reçues sont celles qui comptent : la copie d'un vol choisi deux fois n'en fait
 * pas partie (voir prepareBatch).
 * @returns {Array<{name: string, status: 'notAttached'|'ambiguous'|'unreadable'}>} les fichiers non rattachés
 */
function pairSensors(rows, sensorEntries) {
    const unpaired = [];
    const candidates = [];
    for (const entry of sensorEntries) {
        const records = entry.kind === 'sdf' && entry.bytes ? SdfParser.parse(entry.bytes) : null;
        if (!records) unpaired.push({ name: entry.name, status: 'unreadable' });
        else candidates.push({ name: entry.name, records });
    }
    const traced = rows.filter((r) => r.trace);
    // matches[i] : indices des lignes dont la trace correspond au capteur i
    const matches = candidates.map((c) =>
        traced.filter((r) => {
            const points = r.trace.parsed.points;
            const offset = SdfParser.alignToTrace(c.records, points);
            return offset >= 0 && SdfParser.matchesTrace(c.records, points, offset);
        }),
    );
    const sensorsOf = new Map(traced.map((r) => [r, []]));
    matches.forEach((rowsOfSensor, i) => rowsOfSensor.forEach((r) => sensorsOf.get(r).push(i)));

    candidates.forEach((c, i) => {
        const hits = matches[i];
        if (hits.length === 0) {
            unpaired.push({ name: c.name, status: 'notAttached' });
        } else if (hits.length > 1 || sensorsOf.get(hits[0]).length > 1) {
            unpaired.push({ name: c.name, status: 'ambiguous' });
        } else {
            const row = hits[0];
            const parsed = row.trace.parsed;
            const offset = SdfParser.alignToTrace(c.records, parsed.points);
            row.sensor = { name: c.name, stats: sensorStatsFor(c.records, parsed, offset) };
        }
    });
    return unpaired;
}

// ---------------------------------------------------------------------------------------------
// Le tableau
// ---------------------------------------------------------------------------------------------

const byDate = (a, b) => {
    if (a.values.datetime !== b.values.datetime) return a.values.datetime < b.values.datetime ? -1 : 1;
    const pa = a.trace.parsed.points.length;
    const pb = b.trace.parsed.points.length;
    if (pa !== pb) return pb - pa;
    if (a.trace.rawIgc !== b.trace.rawIgc) return a.trace.rawIgc < b.trace.rawIgc ? -1 : 1;
    return a.fileName < b.fileName ? -1 : a.fileName > b.fileName ? 1 : 0;
};

/** La ligne vue comme une session du carnet, pour que les lignes suivantes en tirent leurs habitudes. */
function asSession(row) {
    const take = takeoffOf(row);
    return {
        id: row.id,
        type: 'vol',
        datetime: row.values.datetime,
        duree: row.values.duree,
        lat: take.lat,
        lon: take.lon,
        ...row.values,
    };
}

const bySessionDate = (a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime();

/**
 * Le tableau d'une sélection de fichiers.
 * @param {Array<{name: string, kind: string, text?: string, bytes?: Uint8Array}>} entries
 * @param {Object} env
 * @param {any[]} env.sessions le carnet, du plus récent au plus ancien
 * @param {{voile?: string[], sellette?: string[], typeVol?: string[], techDecollage?: string[]}} [env.options]
 * @param {(lat: number, lon: number) => string[]} [env.nearbySites] noms des sites connus près d'un point
 * @returns {{rows: any[], sensors: Array<{name: string, status: string}>}} `sensors` : les fichiers de capteurs non rattachés
 */
export function prepareBatch(entries, env) {
    const sessions = env.sessions || [];
    const sensorEntries = entries.filter((e) => e.kind === 'sdf' || (e.kind === 'unreadable' && SDF_FILE.test(e.name)));
    const traceRows = entries.filter((e) => !sensorEntries.includes(e)).map(prepareRow);

    const readable = traceRows.filter((r) => r.trace).sort(byDate);
    const rejected = traceRows
        .filter((r) => !r.trace)
        .sort((a, b) =>
            a.status === b.status ? a.fileName.localeCompare(b.fileName) : a.status.localeCompare(b.status),
        );
    const rows = [...readable, ...rejected];
    rows.forEach((row, i) => (row.id = `r${i}`));

    // Site connu près du décollage (le même calcul que pour un vol seul)
    for (const row of readable) {
        const take = takeoffOf(row);
        const near = env.nearbySites ? env.nearbySites(take.lat, take.lon) : [];
        if (near.length > 0) {
            row.values.site = near[0];
            row.learned.site = 'nearbySite';
        }
    }

    // Doublons : de deux vols identiques, celui qui vient le premier dans l'ordre du tableau est gardé
    const kept = [];
    for (const row of readable) {
        const take = takeoffOf(row);
        const twin = kept.find((other) => sameFlight(take, takeoffOf(other)));
        if (twin) {
            row.flag = 'duplicate';
            row.duplicateOf = twin.fileName;
            row.included = false;
        } else {
            kept.push(row);
            if (isInLogbook(row, sessions)) {
                row.flag = 'known';
                row.included = false;
            }
        }
    }

    // Valeurs de départ, dans l'ordre des dates : chaque vol voit le carnet et les vols qui le précèdent
    const known = [...sessions];
    for (const row of readable) {
        const parsed = row.trace.parsed;
        const kind = classifyFlight(parsed.analysis, parsed.duration);
        const proposal = suggestDefaults(known, {
            place: row.values.site,
            datetime: row.values.datetime,
            options: env.options || {},
            skip: kind ? new Set(['typeVol']) : new Set(),
            typeVol: kind ? kind.type : undefined,
        });
        if (kind) {
            row.values.typeVol = kind.type;
            row.learned.typeVol = kind.reason;
        }
        for (const [field, value] of Object.entries(proposal.values)) {
            if (value !== undefined) row.values[field] = Array.isArray(value) ? [...value] : value;
        }
        Object.assign(row.learned, proposal.reasons);
        if (row.flag !== 'duplicate') {
            known.push(asSession(row));
            known.sort(bySessionDate);
        }
    }

    // Un vol choisi deux fois n'a qu'une ligne gardée : le capteur se rattache à elle, pas à sa copie
    const sensors = pairSensors(
        readable.filter((row) => row.flag !== 'duplicate'),
        sensorEntries,
    );
    rows.forEach(refreshRow);
    return { rows, sensors };
}

// ---------------------------------------------------------------------------------------------
// Le vol enregistré
// ---------------------------------------------------------------------------------------------

/**
 * Le vol qu'ajouterait le formulaire pour cette ligne (mêmes champs : voir LogbookFormBase.submitForm).
 * `id`, `updatedAt` et `syncPending` sont posés à l'ajout (LogbookService.addFlights).
 * @param {any} row
 */
export function buildFlight(row) {
    const v = row.values;
    const parsed = row.trace.parsed;
    const school = text(v.ecole);
    /** @type {Record<string, any>} */
    const flight = {
        type: 'vol',
        datetime: v.datetime,
        voile: text(v.voile),
        sellette: text(v.sellette),
        duree: Math.trunc(Number(v.duree)),
        commentaire: '',
        ecole: school,
        moniteur: school ? instructorsOf({ moniteur: v.moniteur }) : [],
        stageName: school ? text(v.stageName) : '',
        stageSpecialty: school ? text(v.stageSpecialty) : '',
        brevetPrepare: school ? text(v.brevetPrepare) : '',
        accompagnateur: school ? companionsOf({ accompagnateur: v.accompagnateur }) : [],
        pilotes: [...(v.pilotes || [])],
        site: text(v.site),
        typeVol: v.typeVol,
        treuilleur: '',
        rescueDeployed: false,
        rescueId: '',
        priseTerrain: '',
        vache: false,
        techDecollage: v.techDecollage,
        typeExercice: [],
        lat: parsed.points[0].lat,
        lon: parsed.points[0].lon,
        distanceKm: parsed.distanceKm,
        maxClimbRate: parsed.maxClimbRate,
        maxSpeedKmh: parsed.maxSpeedKmh,
        avgSpeedKmh: parsed.avgSpeedKmh,
        igcStats: parsed.analysis || null,
        ...(parsed.instrument ? { instrument: parsed.instrument } : {}),
        rawIgc: row.trace.rawIgc,
        // Date de la trace : la synchro la renvoie dans le compte si elle est plus récente que l'envoi (spec 037)
        traceUpdatedAt: Date.now(),
        varioOffInFlight: Boolean(parsed.endsAirborne),
        varioInFlight: Boolean(parsed.startsAirborne),
        altOffset: 0,
    };
    if (parsed.maxAltitude !== null) flight.altitudeMax = Math.trunc(parsed.maxAltitude);
    if (parsed.gain !== null) flight.gain = Math.trunc(parsed.gain);
    if (row.sensor) flight.sensorStats = row.sensor.stats;
    return flight;
}

/** Cherche, pour un nom de stage, la dernière session de ce stage (pour remplir une ligne). */
export { latestOfCourse };
