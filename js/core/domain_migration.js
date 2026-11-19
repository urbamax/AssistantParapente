/**
 * CORE - Move to the app's own domain (https://assistantparapente.fr)
 *
 * A browser keeps localStorage and IndexedDB per origin: on the new domain the app would start empty
 * for everyone who used the old address without an account. Nothing is asked of the user:
 *
 *  1. Old address: the app packs the local backup (backup_service.js) plus the privacy choice,
 *     compresses it and replaces the page with the new domain, the data in the URL FRAGMENT. A browser
 *     never sends the fragment to a server: the data goes from the device to the device.
 *  2. New domain: the app reads the fragment, removes it from the address bar at once, restores the
 *     data through the usual backup validation, then reloads so every service starts from it.
 *
 * An address has a length limit, so the data is cut down until it fits: everything, then without the
 * GPS traces, then without the flights. What is left out stays on the old address, which can still be
 * opened with `?rester` (to export a backup file by hand).
 *
 * Safety: the new domain only accepts a fragment when the page that sent it is the old address
 * (document.referrer, kept by "Referrer-Policy: strict-origin-when-cross-origin"), only on a device
 * that has no data of its own yet, and only once. A crafted link therefore cannot plant a logbook or,
 * worse, a privacy consent the person never gave.
 */
import {
    BACKUP_TRACES_KEY,
    applyBackup,
    applyBackupTraces,
    buildBackup,
    collectTraces,
    parseBackup,
} from '../services/backup_service.js';
import { CONSENT_KEY, CONSENT_VERSION, isConsentGranted } from '../services/consent_store.js';
import StorageService from '../services/storage.js';
import { ENCODING_GZIP, ENCODING_PLAIN, decodeTrace, encodeTrace } from '../utils/trace_codec.js';

export const CANONICAL_ORIGIN = 'https://assistantparapente.fr';
/** Addresses the app was served from before its own domain. Only these redirect. */
export const LEGACY_ORIGINS = Object.freeze(['https://assistantparapente.noisecontrol.live']);
/** `#migration=<g|p>.<base64>` */
export const MIGRATION_PARAM = 'migration';
/** Set on the new domain once data has been received: a later fragment is ignored. */
export const MIGRATION_DONE_KEY = 'parapente_domain_migration';
/** Query parameter that keeps the old address open (no redirect). */
export const STAY_PARAM = 'rester';
/**
 * Room for the fragment. Chromium refuses URLs over 2 MB; Firefox and Safari take more. Half a
 * megabyte leaves a wide margin and still carries hundreds of flights without their traces.
 */
export const MAX_FRAGMENT_CHARS = 512 * 1024;

const KEYS = StorageService.KEYS;
const ENCODING_TAGS = Object.freeze({ [ENCODING_GZIP]: 'g', [ENCODING_PLAIN]: 'p' });
const TAG_ENCODINGS = Object.freeze({ g: ENCODING_GZIP, p: ENCODING_PLAIN });

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNonEmptyList = (v) => Array.isArray(v) && v.length > 0;
const isNonEmptyObject = (v) => isPlainObject(v) && Object.keys(v).length > 0;

/** The privacy choice stored on this device, if it is one the current app understands. */
function readConsent() {
    try {
        const consent = JSON.parse(localStorage.getItem(CONSENT_KEY) || 'null');
        return isPlainObject(consent) && consent.version === CONSENT_VERSION ? consent : null;
    } catch {
        return null;
    }
}

/** Does this device hold anything worth moving (or worth protecting from being overwritten)? */
export function hasLocalData() {
    return (
        isNonEmptyList(StorageService.get(KEYS.LOGBOOK_DATA)) ||
        isNonEmptyList(StorageService.get(KEYS.EQUIPMENT_DATA)) ||
        isNonEmptyObject(StorageService.get(KEYS.QCM_STATS)) ||
        isNonEmptyObject(StorageService.get(KEYS.EXAM_HISTORY))
    );
}

async function encodePayload(payload) {
    const { encoding, parts } = await encodeTrace(JSON.stringify(payload), { partChars: Infinity });
    return `${ENCODING_TAGS[encoding]}.${parts[0]}`;
}

/**
 * The fragment value carrying this device's data, cut down to fit `maxChars`, or null when there is
 * nothing to carry (or nothing fits).
 * @param {number} [maxChars]
 * @returns {Promise<{ value: string, level: 'full'|'noTraces'|'noFlights' } | null>}
 */
export async function buildMigrationFragment(maxChars = MAX_FRAGMENT_CHARS) {
    const consent = readConsent();
    if (!hasLocalData() && !consent) return null;

    const base = buildBackup('domain-migration');
    // Describe the old device only: never carried over.
    delete base.LAST_ACTIVE_ROUTE;
    delete base.firebase_last_sync;
    if (consent) base[CONSENT_KEY] = consent;

    /** @type {Array<[ 'full'|'noTraces'|'noFlights', Record<string, any> ]>} */
    const candidates = [];
    const traces = await collectTraces();
    if (Object.keys(traces).length) candidates.push(['full', { ...base, [BACKUP_TRACES_KEY]: traces }]);
    candidates.push(['noTraces', base]);
    /** @type {Record<string, any>} */
    const withoutFlights = { ...base };
    delete withoutFlights[KEYS.LOGBOOK_DATA];
    delete withoutFlights.deleted_flights;
    candidates.push(['noFlights', withoutFlights]);

    for (const [level, payload] of candidates) {
        const value = await encodePayload(payload);
        if (value.length <= maxChars) return { value, level };
    }
    return null;
}

/**
 * On the old address: sends the user, with their data, to the new domain.
 * @param {{ location?: Location, maxChars?: number, legacyOrigins?: readonly string[] }} [env]
 * @returns {Promise<boolean>} true when the page is being replaced (stop booting)
 */
export async function redirectFromLegacyOrigin({
    location = window.location,
    maxChars,
    legacyOrigins = LEGACY_ORIGINS,
} = {}) {
    if (!legacyOrigins.includes(location.origin)) return false;
    if (new URLSearchParams(location.search).has(STAY_PARAM)) return false;

    let target = `${CANONICAL_ORIGIN}/`;
    try {
        const fragment = await buildMigrationFragment(maxChars);
        if (fragment) {
            target += `#${MIGRATION_PARAM}=${fragment.value}`;
            console.info(`[Migration] Data sent to ${CANONICAL_ORIGIN} (${fragment.level}).`);
        }
    } catch (error) {
        // Never trap the user on the old address because packing failed.
        console.warn('[Migration] Data could not be packed, redirecting without it:', error);
    }
    location.replace(target);
    return true;
}

function cameFromLegacyOrigin(referrer, legacyOrigins) {
    try {
        return legacyOrigins.includes(new URL(referrer).origin);
    } catch {
        return false;
    }
}

/**
 * On the new domain: restores the data a redirect brought in the fragment, then reloads.
 * @param {{ location?: Location, history?: History, referrer?: string, legacyOrigins?: readonly string[] }} [env]
 * @returns {Promise<boolean>} true when the page is reloading (stop booting)
 */
export async function receiveMigration({
    location = window.location,
    history = window.history,
    referrer = document.referrer,
    legacyOrigins = LEGACY_ORIGINS,
} = {}) {
    const prefix = `#${MIGRATION_PARAM}=`;
    if (!location.hash.startsWith(prefix)) return false;
    const value = location.hash.slice(prefix.length);
    // Out of the address bar first: not bookmarked, not shared, not read by the router.
    history.replaceState(null, '', `${location.pathname}${location.search}`);

    if (location.origin !== CANONICAL_ORIGIN || !cameFromLegacyOrigin(referrer, legacyOrigins)) {
        console.warn('[Migration] Data ignored: it does not come from the old address.');
        return false;
    }
    if (localStorage.getItem(MIGRATION_DONE_KEY) || hasLocalData()) {
        console.info('[Migration] Data ignored: this device already has its own.');
        return false;
    }

    try {
        const dot = value.indexOf('.');
        const encoding = TAG_ENCODINGS[value.slice(0, dot)];
        if (!encoding) throw new Error('unknown encoding');
        const text = await decodeTrace([value.slice(dot + 1)], encoding);
        const parsed = parseBackup(text);
        // 'empty': only the privacy choice was carried, still worth restoring.
        const error = parsed.ok ? null : /** @type {{ error: string }} */ (parsed).error;
        if (error && error !== 'empty') throw new Error(error);

        const consent = JSON.parse(text)[CONSENT_KEY];
        if (!readConsent() && isPlainObject(consent) && consent.version === CONSENT_VERSION) {
            localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
        }
        if (parsed.ok) {
            applyBackup(parsed.backup, { statsAllowed: isConsentGranted('stats') });
            await applyBackupTraces(parsed.backup);
        }
        localStorage.setItem(MIGRATION_DONE_KEY, new Date().toISOString());
    } catch (error) {
        console.warn('[Migration] Data could not be restored:', error);
        return false;
    }
    // Services read localStorage when their module loads: start again from the restored data.
    location.reload();
    return true;
}
