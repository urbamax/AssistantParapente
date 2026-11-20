/**
 * SERVICE - Crash Reporter & Client-Side Telemetry (spec 050)
 * Détecte les erreurs JavaScript non gérées et les rejets de promesses critiques,
 * filtre les faux positifs (extensions navigateur, coupures réseau),
 * dé-doublonne par signature et transmet un rapport anonyme au microservice Discord.
 *
 * Confidentialité absolue : ZÉRO donnée personnelle, ZÉRO coordonnées GPS, ZÉRO vol.
 */

import { FEEDBACK_CONFIG } from '../feedback_config.js';
import { collectFeedbackContext } from './feedback_service.js';

export const CRASH_REPORTER_LIMITS = Object.freeze({
    MAX_REPORTS_PER_SESSION: 5,
    MAX_DESCRIPTION_LENGTH: 3000,
});

/** @type {Set<string>} */
const reportedSignatures = new Set();
let sessionReportCount = 0;
let isInitialized = false;
let cleanupFn = null;

/**
 * Liste des motifs d'erreurs à ignorer (bruit d'extensions, alertes bénignes du navigateur).
 */
export const IGNORED_ERROR_PATTERNS = Object.freeze([
    'chrome-extension://',
    'moz-extension://',
    'safari-extension://',
    'safari-web-extension://',
    'ResizeObserver loop',
    'Script error.',
    'Failed to fetch',
    'NetworkError',
    'Load failed',
    'The operation was aborted',
]);

/**
 * Vérifie si une erreur doit être ignorée (extension tierce, réseau, bruit bénin).
 * @param {{message?: string, filename?: string, stack?: string}} errInfo
 * @returns {boolean}
 */
export function isIgnoredError(errInfo) {
    if (!errInfo) return true;
    const combined = `${errInfo.message || ''} ${errInfo.filename || ''} ${errInfo.stack || ''}`.toLowerCase();
    return IGNORED_ERROR_PATTERNS.some((pattern) => combined.includes(pattern.toLowerCase()));
}

/**
 * Retire les paramètres de requête (?...) et fragments (#...) des URLs dans un texte d'erreur
 * pour qu'aucune donnée sensible (fiche ICE, migration de domaine) ne parte dans un rapport de crash.
 * @param {string} text
 * @returns {string}
 */
export function sanitizeCrashText(text) {
    if (!text || typeof text !== 'string') return '';
    return text.replace(/(https?:\/\/[^\s?#):]+)([?#][^\s):]*)/gi, '$1');
}

/**
 * Calcule une signature unique pour éviter d'envoyer 50 fois la même erreur en boucle.
 * @param {{message?: string, filename?: string, lineno?: number, colno?: number}} errInfo
 * @returns {string}
 */
export function computeErrorSignature(errInfo) {
    const msg = sanitizeCrashText(errInfo?.message || 'unknown_error')
        .trim()
        .slice(0, 80);
    const file = (errInfo?.filename || 'inline').split('#')[0].split('?')[0].split('/').pop() || 'file';
    const line = errInfo?.lineno || 0;
    const col = errInfo?.colno || 0;
    return `${msg}@${file}:${line}:${col}`;
}

/**
 * Décide si un crash doit être téléversé ou non.
 * @param {{message?: string, filename?: string, lineno?: number, colno?: number, stack?: string}} errInfo
 * @param {{reportedSignaturesSet?: Set<string>, reportCount?: number}} [state]
 * @returns {boolean}
 */
export function shouldReportCrash(errInfo, state = {}) {
    if (!errInfo) return false;
    const count = typeof state.reportCount === 'number' ? state.reportCount : sessionReportCount;
    if (count >= CRASH_REPORTER_LIMITS.MAX_REPORTS_PER_SESSION) {
        return false;
    }

    if (isIgnoredError(errInfo)) {
        return false;
    }

    const set = state.reportedSignaturesSet || reportedSignatures;
    const sig = computeErrorSignature(errInfo);
    if (set.has(sig)) {
        return false;
    }

    return true;
}

/**
 * Formate et envoie un rapport de crash vers l'endpoint configuré.
 * @param {{
 *   message: string,
 *   name?: string,
 *   filename?: string,
 *   lineno?: number,
 *   colno?: number,
 *   stack?: string
 * }} errInfo
 * @param {{
 *   endpoint?: string,
 *   sendBeaconImpl?: typeof navigator.sendBeacon,
 *   fetchImpl?: typeof fetch,
 *   context?: ReturnType<typeof collectFeedbackContext>
 * }} [options]
 * @returns {Promise<boolean>}
 */
export async function sendCrashReport(errInfo, options = {}) {
    if (!shouldReportCrash(errInfo)) {
        return false;
    }

    const signature = computeErrorSignature(errInfo);
    reportedSignatures.add(signature);
    sessionReportCount++;

    const customUrl = typeof FEEDBACK_CONFIG?.customEndpoint === 'string' ? FEEDBACK_CONFIG.customEndpoint.trim() : '';
    const endpoint = options.endpoint || customUrl || '/api/feedback';

    const ctx = options.context || collectFeedbackContext();
    const file = (errInfo.filename || 'app').split('#')[0].split('?')[0].split('/').pop() || 'app';
    const locationStr = `${file}:${errInfo.lineno || '?'}:${errInfo.colno || '?'}`;
    const errorName = errInfo.name || 'Error';
    const cleanMsg = sanitizeCrashText(errInfo.message || 'Erreur inconnue').trim();
    const cleanStack = sanitizeCrashText(errInfo.stack || cleanMsg).slice(
        0,
        CRASH_REPORTER_LIMITS.MAX_DESCRIPTION_LENGTH,
    );

    const payload = {
        category: 'crash',
        categoryLabel: 'Crash Client JS',
        subject: `${errorName} in ${locationStr}`,
        description: cleanStack,
        location: locationStr,
        contact: 'Télémétrie Automatique',
        context: ctx,
        botcheck: '',
    };

    const payloadStr = JSON.stringify(payload);

    // Essayer sendBeacon en priorité si disponible (non-bloquant même à la fermeture de page)
    const beaconFn =
        options.sendBeaconImpl === null
            ? null
            : options.sendBeaconImpl ||
              (typeof navigator !== 'undefined' && navigator.sendBeacon ? navigator.sendBeacon.bind(navigator) : null);
    if (beaconFn && typeof Blob !== 'undefined') {
        try {
            const blob = new Blob([payloadStr], { type: 'application/json' });
            const sent = beaconFn(endpoint, blob);
            if (sent) return true;
        } catch {
            // Fallback sur fetch
        }
    }

    // Fallback sur fetch keepalive
    const fetchFn =
        options.fetchImpl || (typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : null);
    if (!fetchFn) return false;

    try {
        await fetchFn(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: payloadStr,
            keepalive: true,
        });
        return true;
    } catch {
        return false;
    }
}

/**
 * Gestionnaire global pour window.onerror.
 * @param {ErrorEvent} event
 */
function handleGlobalError(event) {
    try {
        const error = event.error || {};
        sendCrashReport({
            name: error.name || 'Error',
            message: event.message || error.message || 'Unknown error',
            filename: event.filename || '',
            lineno: event.lineno || 0,
            colno: event.colno || 0,
            stack: error.stack || '',
        });
    } catch {
        // Ne jamais laisser le rapporteur de crash crasher lui-même
    }
}

/**
 * Gestionnaire global pour unhandledrejection.
 * @param {PromiseRejectionEvent} event
 */
function handleUnhandledRejection(event) {
    try {
        const reason = event.reason;
        const isErrorObj = reason instanceof Error;
        const msg = isErrorObj ? reason.message : typeof reason === 'string' ? reason : 'Unhandled Promise Rejection';
        sendCrashReport({
            name: isErrorObj ? reason.name : 'UnhandledRejection',
            message: msg,
            filename: isErrorObj && reason.stack ? reason.stack.split('\n')[1] || '' : '',
            lineno: 0,
            colno: 0,
            stack: isErrorObj ? reason.stack || msg : String(reason || msg),
        });
    } catch {
        // Silence absolu
    }
}

/**
 * Initialise l'écouteur de télémétrie des crashs.
 * @param {{windowObj?: Window & typeof globalThis}} [options]
 * @returns {() => void} Fonction de nettoyage
 */
export function initCrashReporter(options = {}) {
    if (isInitialized && cleanupFn) {
        return cleanupFn;
    }

    const win = options.windowObj || (typeof window !== 'undefined' ? window : null);
    if (!win || typeof win.addEventListener !== 'function') {
        return () => {};
    }

    win.addEventListener('error', handleGlobalError);
    win.addEventListener('unhandledrejection', handleUnhandledRejection);
    isInitialized = true;

    cleanupFn = () => {
        win.removeEventListener('error', handleGlobalError);
        win.removeEventListener('unhandledrejection', handleUnhandledRejection);
        isInitialized = false;
        cleanupFn = null;
    };

    return cleanupFn;
}

/**
 * Réinitialise l'état interne (utile pour les tests).
 */
export function _resetCrashReporterForTesting() {
    reportedSignatures.clear();
    sessionReportCount = 0;
    if (cleanupFn) {
        cleanupFn();
    }
}
