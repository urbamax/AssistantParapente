/**
 * SERVICE - Local backup (export / import of all user data as a JSON file)
 *
 * Works without an account and without Firebase consent: the file stays on the device and is
 * never sent anywhere by this module. The file only carries data. Importing never evaluates
 * anything from it: the text goes through JSON.parse, every known key is type-checked, and the
 * values are written to localStorage as they are (QCM_STATS is copied whole, no field filtering,
 * so fields added to the statistics later survive a round trip).
 *
 * File layout (unchanged since the first export, version 1.0):
 *   { _meta: { appName, exportVersion, exportedAt, exportedBy }, <localStorage key>: <value>, ... }
 */
import StorageService from './storage.js';
import IDBStorage from './idb_storage.js';
import GdprEngine from '../gdpr_engine.js';
import { saveTextFile } from '../utils/download.js';
import { ENCODING_GZIP, ENCODING_PLAIN, decodeTrace, encodeTrace } from '../utils/trace_codec.js';

export const BACKUP_APP_NAME = 'AssistantParapente';
/** Version written by this app. Older files without a version, and any 1.x file, are accepted. */
export const BACKUP_VERSION = '1.0';
/** Compressed GPS traces make up most of a backup (about 50 KB per flight); anything bigger is not one. */
export const BACKUP_MAX_BYTES = 64 * 1024 * 1024;
/** Key of the GPS traces kept in IndexedDB: { <flight id>: { encoding, data } }, `data` is base64. */
export const BACKUP_TRACES_KEY = 'igc_traces';
/** A single compressed trace is far below this; it only bounds what a damaged file can ask for. */
const TRACE_MAX_CHARS = 12 * 1024 * 1024;

const KEYS = StorageService.KEYS;

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isObjectList = (v) => Array.isArray(v) && v.every(isPlainObject);

/**
 * Keys restored from a file, with the shape each value must have. ACCESS (roles granted by the
 * server) is deliberately absent: a file must never be able to grant a role.
 * `stats: true` marks the data the user must have consented to store (RGPD « Statistiques »).
 */
const STORAGE_KEYS = [
    { key: KEYS.STATE, valid: isPlainObject },
    { key: KEYS.USER_LEVEL, valid: (v) => typeof v === 'string' && /^[A-Za-z_]{1,16}$/.test(v) },
    { key: KEYS.THEME_MODE, valid: (v) => v === 'auto' || v === 'light' || v === 'dark' },
    { key: KEYS.USER_PREFS, valid: isPlainObject },
    { key: KEYS.LOGBOOK_DATA, valid: isObjectList },
    { key: KEYS.EQUIPMENT_DATA, valid: isObjectList },
    { key: KEYS.QCM_STATS, valid: isPlainObject, stats: true },
    { key: KEYS.EXAM_HISTORY, valid: isPlainObject, stats: true },
    { key: KEYS.PENDING_QUIZ, valid: (v) => v !== null && typeof v === 'object' },
];

const TOMBSTONE_KEYS = ['deleted_flights', 'deleted_equipment'];

/** Same rule as the cloud sync: only non-empty text ids count. */
function readTombstoneIds(key) {
    try {
        const value = JSON.parse(localStorage.getItem(key) || '[]');
        return Array.isArray(value) ? value.filter((id) => typeof id === 'string' && id !== '') : [];
    } catch {
        return [];
    }
}

/**
 * Everything the user owns, as the object written to the file.
 * @param {string} [exportedBy] label stored in `_meta` (account e-mail when signed in)
 */
export function buildBackup(exportedBy = 'anonymous') {
    const payload = {
        _meta: {
            appName: BACKUP_APP_NAME,
            exportVersion: BACKUP_VERSION,
            exportedAt: new Date().toISOString(),
            exportedBy,
        },
    };
    for (const { key } of STORAGE_KEYS) payload[key] = StorageService.get(key);
    for (const key of TOMBSTONE_KEYS) payload[key] = readTombstoneIds(key);
    // Kept so that files stay readable by older versions of the app.
    payload.LAST_ACTIVE_ROUTE = localStorage.getItem('LAST_ACTIVE_ROUTE');
    payload.firebase_last_sync = localStorage.getItem('firebase_last_sync');
    return payload;
}

/**
 * The GPS trace (raw IGC text) of every logged flight, compressed. They live in IndexedDB, not in
 * localStorage, so buildBackup() cannot read them. Flights without a trace are left out.
 * @returns {Promise<Record<string, { encoding: string, data: string }>>}
 */
export async function collectTraces() {
    const flights = StorageService.get(KEYS.LOGBOOK_DATA);
    const traces = {};
    if (!Array.isArray(flights) || !IDBStorage.isSupported()) return traces;
    for (const flight of flights) {
        const id = flight?.id;
        if (typeof id !== 'string' || id === '') continue;
        try {
            const raw = (await IDBStorage.getTrace(id)) || (await IDBStorage.getFlight(id))?.rawIgc;
            if (typeof raw !== 'string' || raw === '') continue;
            // One part, whatever its size: the Firestore limit on a document does not apply to a file.
            const { encoding, parts } = await encodeTrace(raw, { partChars: Infinity });
            traces[id] = { encoding, data: parts[0] };
        } catch (error) {
            console.warn(`[Backup] Trace of flight ${id} left out:`, error);
        }
    }
    return traces;
}

/**
 * Like buildBackup(), with the GPS traces.
 * @param {string} [exportedBy]
 */
export async function buildFullBackup(exportedBy) {
    const payload = buildBackup(exportedBy);
    const traces = await collectTraces();
    if (Object.keys(traces).length) payload[BACKUP_TRACES_KEY] = traces;
    return payload;
}

/**
 * Downloads the backup file (data and GPS traces).
 * @param {string} [exportedBy]
 * @returns {Promise<string>} the file name
 */
export async function exportBackup(exportedBy) {
    const filename = `parapente_backup_${new Date().toISOString().slice(0, 10)}.json`;
    saveTextFile(filename, JSON.stringify(await buildFullBackup(exportedBy), null, 2), 'application/json');
    return filename;
}

/**
 * @typedef {{ ok: true, backup: Record<string, any>, exportedAt: string|null }
 *   | { ok: false, error: 'notJson'|'notBackup'|'tooLarge'|'unsupportedVersion'|'badData'|'empty' }} ParsedBackup
 */

/**
 * Reads and validates the text of a backup file. Writes nothing.
 * @param {string} text
 * @returns {ParsedBackup}
 */
export function parseBackup(text) {
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        return { ok: false, error: 'notJson' };
    }
    if (!isPlainObject(data) || !isPlainObject(data._meta) || data._meta.appName !== BACKUP_APP_NAME) {
        return { ok: false, error: 'notBackup' };
    }

    const version = data._meta.exportVersion;
    if (version !== undefined && !/^1(\.\d+)*$/.test(String(version))) {
        return { ok: false, error: 'unsupportedVersion' };
    }

    // One malformed known key rejects the whole file: nothing is half restored.
    for (const { key, valid } of STORAGE_KEYS) {
        const value = data[key];
        if (value !== undefined && value !== null && !valid(value)) return { ok: false, error: 'badData' };
    }
    for (const key of TOMBSTONE_KEYS) {
        if (data[key] !== undefined && data[key] !== null && !Array.isArray(data[key])) {
            return { ok: false, error: 'badData' };
        }
    }

    const traces = data[BACKUP_TRACES_KEY];
    if (traces !== undefined && traces !== null) {
        const valid =
            isPlainObject(traces) &&
            Object.values(traces).every(
                (t) =>
                    isPlainObject(t) &&
                    (t.encoding === ENCODING_GZIP || t.encoding === ENCODING_PLAIN) &&
                    typeof t.data === 'string' &&
                    t.data.length <= TRACE_MAX_CHARS,
            );
        if (!valid) return { ok: false, error: 'badData' };
    }

    const hasData =
        STORAGE_KEYS.some(({ key }) => data[key] !== undefined && data[key] !== null) ||
        TOMBSTONE_KEYS.some((key) => Array.isArray(data[key]));
    if (!hasData) return { ok: false, error: 'empty' };

    const date = new Date(data._meta.exportedAt);
    return { ok: true, backup: data, exportedAt: Number.isNaN(date.getTime()) ? null : date.toISOString() };
}

/**
 * Writes a validated backup into localStorage. Keys absent from the file are left as they are.
 * Statistics are skipped when the user has not consented to store them (they would be erased at
 * the next consent change anyway), and reported in `skipped`.
 * @param {Record<string, any>} backup result of parseBackup()
 * @param {{ statsAllowed?: boolean }} [options]
 * @returns {{ restored: string[], skipped: string[] }}
 */
export function applyBackup(backup, { statsAllowed = GdprEngine.isConsentGranted('stats') } = {}) {
    const restored = [];
    const skipped = [];

    for (const { key, stats } of STORAGE_KEYS) {
        const value = backup[key];
        if (value === undefined || value === null) continue;
        if (stats && !statsAllowed) {
            skipped.push(key);
        } else if (StorageService.set(key, value)) {
            restored.push(key);
        } else {
            throw new Error(`Could not write ${key}`);
        }
    }
    for (const key of TOMBSTONE_KEYS) {
        if (!Array.isArray(backup[key])) continue;
        const ids = backup[key].filter((id) => typeof id === 'string' && id !== '');
        localStorage.setItem(key, JSON.stringify(ids));
        restored.push(key);
    }
    // LAST_ACTIVE_ROUTE (would jump to the page the file was exported from) and firebase_last_sync
    // (the date of another device's sync) describe the exporting device: they are not restored.
    return { restored, skipped };
}

/**
 * Writes the GPS traces of a validated backup into IndexedDB, for the flights the backup lists.
 * A trace that cannot be decoded is skipped; the rest is restored.
 * @param {Record<string, any>} backup result of parseBackup()
 * @returns {Promise<{ restored: number, failed: number }>}
 */
export async function applyBackupTraces(backup) {
    const traces = backup[BACKUP_TRACES_KEY];
    const flights = backup[KEYS.LOGBOOK_DATA];
    let restored = 0;
    let failed = 0;
    if (!isPlainObject(traces) || !Array.isArray(flights) || !IDBStorage.isSupported()) return { restored, failed };

    const flightIds = new Set(flights.map((f) => f.id).filter((id) => typeof id === 'string'));
    for (const [id, trace] of Object.entries(traces)) {
        if (!flightIds.has(id)) continue;
        try {
            const raw = await decodeTrace([trace.data], trace.encoding);
            if (raw && (await IDBStorage.saveTrace(id, raw))) restored++;
            else failed++;
        } catch (error) {
            console.warn(`[Backup] Trace of flight ${id} could not be restored:`, error);
            failed++;
        }
    }
    return { restored, failed };
}

/**
 * Reads a file chosen by the user.
 * @param {Blob} file
 * @returns {Promise<ParsedBackup>}
 */
export async function readBackupFile(file) {
    if (file.size > BACKUP_MAX_BYTES) return { ok: false, error: 'tooLarge' };
    return parseBackup(await file.text());
}

const BackupService = {
    buildBackup,
    buildFullBackup,
    exportBackup,
    parseBackup,
    applyBackup,
    applyBackupTraces,
    readBackupFile,
};
export default BackupService;
