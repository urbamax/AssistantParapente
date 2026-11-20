/**
 * SERVICE - Feedback Service (spec 048)
 * Validation, collecte de contexte technique non personnel, gestion du brouillon local,
 * formatage pour copie manuelle et envoi sécurisé (Web3Forms ou endpoint personnalisé).
 */

import GlobalState from '../core/app_state.js';
import { FEEDBACK_CONFIG } from '../feedback_config.js';
import { t } from '../utils/i18n.js';
import StorageService from './storage.js';

export const WEB3FORMS_ENDPOINT = 'https://api.web3forms.com/submit';

export const FEEDBACK_LIMITS = Object.freeze({
    SUBJECT_MAX: 120,
    DESCRIPTION_MIN: 10,
    DESCRIPTION_MAX: 3000,
    CONTACT_MAX: 120,
});

export const FEEDBACK_CATEGORIES = Object.freeze([
    Object.freeze({
        id: 'bug',
        icon: 'ri-bug-line',
        labelKey: 'feedback.categories.bug.label',
        helpKey: 'feedback.categories.bug.help',
        placeholderKey: 'feedback.categories.bug.placeholder',
    }),
    Object.freeze({
        id: 'qcm_course',
        icon: 'ri-book-open-line',
        labelKey: 'feedback.categories.qcm_course.label',
        helpKey: 'feedback.categories.qcm_course.help',
        placeholderKey: 'feedback.categories.qcm_course.placeholder',
    }),
    Object.freeze({
        id: 'site_weather',
        icon: 'ri-map-pin-line',
        labelKey: 'feedback.categories.site_weather.label',
        helpKey: 'feedback.categories.site_weather.help',
        placeholderKey: 'feedback.categories.site_weather.placeholder',
    }),
    Object.freeze({
        id: 'suggestion',
        icon: 'ri-lightbulb-line',
        labelKey: 'feedback.categories.suggestion.label',
        helpKey: 'feedback.categories.suggestion.help',
        placeholderKey: 'feedback.categories.suggestion.placeholder',
    }),
    Object.freeze({
        id: 'other',
        icon: 'ri-feedback-line',
        labelKey: 'feedback.categories.other.label',
        helpKey: 'feedback.categories.other.help',
        placeholderKey: 'feedback.categories.other.placeholder',
    }),
]);

/** @type {Set<string>} */
const VALID_CATEGORY_IDS = new Set(FEEDBACK_CATEGORIES.map((c) => c.id));
const EMAIL_RE = /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/;

/**
 * Retourne les métadonnées d'une catégorie (ou 'bug' par défaut).
 * @param {string} categoryId
 */
export function getCategoryMeta(categoryId) {
    return FEEDBACK_CATEGORIES.find((c) => c.id === categoryId) || FEEDBACK_CATEGORIES[0];
}

/**
 * Vérifie si une chaîne correspond à une adresse e-mail exploitable pour replyto.
 * @param {string} value
 * @returns {boolean}
 */
export function isValidEmail(value) {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > FEEDBACK_LIMITS.CONTACT_MAX) return false;
    return EMAIL_RE.test(trimmed);
}

/**
 * Normalise un brouillon reçu depuis le formulaire ou le stockage local.
 * @param {Partial<{category: string, subject: string, description: string, contact: string, includeContext: boolean, botcheck: string}> | null | undefined} raw
 */
export function normalizeFeedbackDraft(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const category = typeof src.category === 'string' && VALID_CATEGORY_IDS.has(src.category) ? src.category : 'bug';
    return {
        category,
        subject: typeof src.subject === 'string' ? src.subject : '',
        description: typeof src.description === 'string' ? src.description : '',
        contact: typeof src.contact === 'string' ? src.contact : '',
        includeContext: src.includeContext !== false,
    };
}

/**
 * Valide le contenu saisi avant envoi.
 * @param {{category?: string, subject?: string, description?: string, contact?: string}} draft
 * @returns {{valid: boolean, errors: Record<string, string>, firstError: string}}
 */
export function validateFeedback(draft) {
    /** @type {Record<string, string>} */
    const errors = {};
    const category = typeof draft?.category === 'string' ? draft.category : '';
    const subject = typeof draft?.subject === 'string' ? draft.subject.trim() : '';
    const description = typeof draft?.description === 'string' ? draft.description.trim() : '';
    const contact = typeof draft?.contact === 'string' ? draft.contact.trim() : '';

    if (!VALID_CATEGORY_IDS.has(category)) {
        errors.category = t('feedback.errInvalidCategory');
    }
    if (subject.length > FEEDBACK_LIMITS.SUBJECT_MAX) {
        errors.subject = t('feedback.errSubjectTooLong', { max: FEEDBACK_LIMITS.SUBJECT_MAX });
    }
    if (description.length < FEEDBACK_LIMITS.DESCRIPTION_MIN) {
        errors.description = t('feedback.errDescriptionTooShort', { min: FEEDBACK_LIMITS.DESCRIPTION_MIN });
    } else if (description.length > FEEDBACK_LIMITS.DESCRIPTION_MAX) {
        errors.description = t('feedback.errDescriptionTooLong', { max: FEEDBACK_LIMITS.DESCRIPTION_MAX });
    }
    if (contact.length > FEEDBACK_LIMITS.CONTACT_MAX) {
        errors.contact = t('feedback.errContactTooLong', { max: FEEDBACK_LIMITS.CONTACT_MAX });
    }

    const messages = Object.values(errors);
    return {
        valid: messages.length === 0,
        errors,
        firstError: messages[0] || '',
    };
}

function readActiveScreenDetail(mode, doc) {
    if (!doc || typeof doc.querySelector !== 'function') return '';
    if (mode === 'QCM') {
        const codeEl = doc.querySelector('#qcm-screen.active .bank-item-code, #qcm-screen .bank-item-code');
        return codeEl ? codeEl.textContent.trim().slice(0, 60) : '';
    }
    if (mode === 'SITES') {
        const siteEl = doc.querySelector('details.site-details-toggle[open][data-site-id]');
        return siteEl ? (siteEl.getAttribute('data-site-id') || '').trim().slice(0, 80) : '';
    }
    if (mode === 'LOGBOOK') {
        const tabEl = doc.querySelector('[data-logbook-tab][aria-current="true"]');
        return tabEl ? (tabEl.getAttribute('data-logbook-tab') || '').trim().slice(0, 40) : '';
    }
    if (mode === 'SAFETY') {
        const tabEl = doc.querySelector('[data-safety-tab][aria-current="true"]');
        return tabEl ? (tabEl.getAttribute('data-safety-tab') || '').trim().slice(0, 40) : '';
    }
    return '';
}

function detectRuntimeLabel(standaloneOverride) {
    if (typeof standaloneOverride === 'boolean') {
        return standaloneOverride ? t('feedback.contextRuntimePwa') : t('feedback.contextRuntimeBrowser');
    }
    const navStandalone =
        typeof navigator !== 'undefined' &&
        Boolean(/** @type {Navigator & {standalone?: boolean}} */ (navigator).standalone);
    const mediaStandalone =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(display-mode: standalone)').matches;
    return navStandalone || mediaStandalone ? t('feedback.contextRuntimePwa') : t('feedback.contextRuntimeBrowser');
}

/**
 * Collecte uniquement des informations techniques et contextuelles non personnelles.
 * Aucune donnée de carnet de vol, position GPS, fiche ICE ou identité n'est jamais lue.
 * @param {{
 *   doc?: Document,
 *   appVersion?: string,
 *   mode?: string,
 *   level?: string,
 *   themeMode?: string,
 *   width?: number,
 *   height?: number,
 *   standalone?: boolean,
 *   online?: boolean
 * }} [options]
 */
export function collectFeedbackContext(options = {}) {
    const doc = options.doc || (typeof document !== 'undefined' ? document : null);
    const screen = options.mode || String(GlobalState.get('mode') || 'MENU');
    const level = options.level || String(GlobalState.get('level') || 'ALL');
    const theme = options.themeMode || String(GlobalState.get('themeMode') || 'auto');

    const versionFromDom =
        doc?.documentElement?.dataset?.appVersion ||
        doc?.querySelector?.('meta[name="app-version"]')?.getAttribute?.('content') ||
        '';
    const version = (options.appVersion || versionFromDom || t('feedback.contextDev')).trim();

    const width =
        typeof options.width === 'number' ? options.width : typeof window !== 'undefined' ? window.innerWidth : 0;
    const height =
        typeof options.height === 'number' ? options.height : typeof window !== 'undefined' ? window.innerHeight : 0;
    const viewport = width > 0 && height > 0 ? `${width}x${height}` : '-';

    const online =
        typeof options.online === 'boolean'
            ? options.online
            : typeof navigator !== 'undefined'
              ? navigator.onLine !== false
              : true;

    return {
        version,
        screen,
        level,
        theme,
        viewport,
        runtime: detectRuntimeLabel(options.standalone),
        network: online ? t('feedback.contextOnline') : t('feedback.contextOffline'),
        detail: readActiveScreenDetail(screen, doc),
    };
}

/**
 * Formate le contexte technique en texte lisible avant envoi ou copie.
 * @param {{version: string, screen: string, level: string, theme: string, viewport: string, runtime: string, network: string, detail?: string}} ctx
 * @returns {string}
 */
export function formatTechnicalContext(ctx) {
    const lines = [
        t('feedback.contextLineVersion', { value: ctx.version }),
        t('feedback.contextLineScreen', { value: ctx.screen }),
        t('feedback.contextLineLevel', { value: ctx.level }),
        t('feedback.contextLineTheme', { value: ctx.theme }),
        t('feedback.contextLineViewport', { value: ctx.viewport }),
        t('feedback.contextLineRuntime', { value: ctx.runtime }),
        t('feedback.contextLineNetwork', { value: ctx.network }),
    ];
    if (ctx.detail) {
        lines.push(t('feedback.contextLineDetail', { value: ctx.detail }));
    }
    return lines.join('\n');
}

/**
 * Formate le message complet pour l'envoi ou le bouton « Copier le message ».
 * @param {{category?: string, subject?: string, description?: string, contact?: string, includeContext?: boolean}} draft
 * @param {ReturnType<typeof collectFeedbackContext>} ctx
 * @returns {string}
 */
export function formatCopyPayload(draft, ctx) {
    const normalized = normalizeFeedbackDraft(draft);
    const meta = getCategoryMeta(normalized.category);
    const categoryLabel = t(meta.labelKey);
    const cleanSubject = normalized.subject.trim();
    const cleanDescription = normalized.description.trim();
    const cleanContact = normalized.contact.trim();

    const parts = [
        t('feedback.copyHeader'),
        t('feedback.copyCategory', { value: categoryLabel }),
        t('feedback.copySubject', { value: cleanSubject || t('feedback.copySubjectNone') }),
        '',
        t('feedback.copyDescription'),
        cleanDescription,
    ];

    if (cleanContact) {
        parts.push('', t('feedback.copyContact', { value: cleanContact }));
    }

    if (normalized.includeContext && ctx) {
        parts.push('', t('feedback.copyContextTitle'), formatTechnicalContext(ctx));
    }

    return parts.join('\n');
}

export function loadFeedbackDraft() {
    const stored = StorageService.get(StorageService.KEYS.FEEDBACK_DRAFT, null);
    return normalizeFeedbackDraft(stored);
}

/**
 * @param {{category?: string, subject?: string, description?: string, contact?: string, includeContext?: boolean}} draft
 */
export function saveFeedbackDraft(draft) {
    const normalized = normalizeFeedbackDraft(draft);
    StorageService.set(StorageService.KEYS.FEEDBACK_DRAFT, normalized);
    return normalized;
}

export function clearFeedbackDraft() {
    StorageService.remove(StorageService.KEYS.FEEDBACK_DRAFT);
}

/**
 * Indique si au moins un point de terminaison d'envoi est configuré.
 * @param {{web3FormsAccessKey?: string, customEndpoint?: string}} [config]
 * @returns {boolean}
 */
export function isSubmissionConfigured(config = FEEDBACK_CONFIG) {
    const custom = typeof config?.customEndpoint === 'string' ? config.customEndpoint.trim() : '';
    const key = typeof config?.web3FormsAccessKey === 'string' ? config.web3FormsAccessKey.trim() : '';
    return Boolean(custom || key);
}

/**
 * Envoie un retour vers l'endpoint configuré (Web3Forms par défaut ou customEndpoint).
 * @param {{category?: string, subject?: string, description?: string, contact?: string, includeContext?: boolean, botcheck?: string}} rawDraft
 * @param {{
 *   config?: {web3FormsAccessKey?: string, customEndpoint?: string},
 *   fetchImpl?: typeof fetch,
 *   context?: ReturnType<typeof collectFeedbackContext>,
 *   online?: boolean
 * }} [options]
 */
export async function submitFeedback(rawDraft, options = {}) {
    if (typeof rawDraft?.botcheck === 'string' && rawDraft.botcheck.trim()) {
        return { ok: true, skipped: true, reason: 'honeypot' };
    }

    const draft = normalizeFeedbackDraft(rawDraft);
    const validation = validateFeedback(draft);
    if (!validation.valid) {
        return {
            ok: false,
            reason: 'validation',
            errors: validation.errors,
            message: validation.firstError,
        };
    }

    const online =
        typeof options.online === 'boolean'
            ? options.online
            : typeof navigator !== 'undefined'
              ? navigator.onLine !== false
              : true;

    if (!online) {
        return { ok: false, reason: 'offline', message: t('feedback.errOffline') };
    }

    const config = options.config || FEEDBACK_CONFIG;
    if (!isSubmissionConfigured(config)) {
        return { ok: false, reason: 'unconfigured', message: t('feedback.errUnconfigured') };
    }

    const fetchFn =
        options.fetchImpl || (typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : null);
    if (!fetchFn) {
        return { ok: false, reason: 'network', message: t('feedback.errNetwork') };
    }

    const ctx = options.context || collectFeedbackContext();
    const formattedMessage = formatCopyPayload(draft, ctx);
    const categoryLabel = t(getCategoryMeta(draft.category).labelKey);
    const cleanSubject = draft.subject.trim();
    const cleanContact = draft.contact.trim();

    const customUrl = typeof config.customEndpoint === 'string' ? config.customEndpoint.trim() : '';
    const endpoint = customUrl || WEB3FORMS_ENDPOINT;

    const payload = customUrl
        ? {
              category: draft.category,
              categoryLabel,
              subject: cleanSubject,
              description: draft.description.trim(),
              contact: cleanContact,
              context: draft.includeContext ? ctx : null,
              message: formattedMessage,
              botcheck: '',
          }
        : {
              access_key: String(config.web3FormsAccessKey || '').trim(),
              subject: `${t('feedback.emailSubjectPrefix')} ${categoryLabel}${cleanSubject ? ` — ${cleanSubject}` : ''}`,
              from_name: cleanContact || t('feedback.defaultSenderName'),
              message: formattedMessage,
              botcheck: '',
              ...(isValidEmail(cleanContact) ? { replyto: cleanContact } : {}),
          };

    try {
        const response = await fetchFn(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify(payload),
        });

        let data = null;
        try {
            data = await response.json();
        } catch {
            data = null;
        }

        if (!response.ok || (data && data.success === false)) {
            const detail = (data && typeof data.message === 'string' && data.message) || `HTTP ${response.status}`;
            return {
                ok: false,
                reason: 'server',
                message: t('feedback.errServer', { detail }),
            };
        }

        clearFeedbackDraft();
        return { ok: true };
    } catch {
        return {
            ok: false,
            reason: 'network',
            message: t('feedback.errNetwork'),
        };
    }
}
