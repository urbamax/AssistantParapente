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
import GdprEngine from '../gdpr_engine.js';
import { saveTextFile } from '../utils/download.js';

export const BACKUP_APP_NAME = 'AssistantParapente';
/** Version written by this app. Older files without a version, and any 1.x file, are accepted. */
export const BACKUP_VERSION = '1.0';
/** A backup is a few hundred KB at most; anything bigger is not one. */
export const BACKUP_MAX_BYTES = 20 * 1024 * 1024;

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
 * Downloads the backup file.
 * @param {string} [exportedBy]
 * @returns {string} the file name
 */
export function exportBackup(exportedBy) {
    const filename = `parapente_backup_${new Date().toISOString().slice(0, 10)}.json`;
    saveTextFile(filename, JSON.stringify(buildBackup(exportedBy), null, 2), 'application/json');
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
 * Reads a file chosen by the user.
 * @param {Blob} file
 * @returns {Promise<ParsedBackup>}
 */
export async function readBackupFile(file) {
    if (file.size > BACKUP_MAX_BYTES) return { ok: false, error: 'tooLarge' };
    return parseBackup(await file.text());
}

const BackupService = { buildBackup, exportBackup, parseBackup, applyBackup, readBackupFile };
export default BackupService;
