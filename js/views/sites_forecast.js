/**
 * VIEW - Sites forecast display helpers
 * Affichage des verdicts météo et du contexte des prévisions (modèle, âge, accord entre modèles).
 * Fonctions pures de mise en forme, extraites de sites.js : le comportement est inchangé.
 */
import { escapeHTML } from '../core/security.js';
import { t } from '../utils/i18n.js';
import { FR } from '../i18n/fr.js';
import SitesService from '../services/sites_service.js';
import { RADIUS, WEATHER_MODEL_INFO, STALE_AFTER_MS } from '../data/weather_config.js';

const FR_WEEKDAYS = FR.forecast.weekdays;

// ---------------------------------------------------------------------------------------------
// Affichage des verdicts météo (spec 001, contracts/ui-states.md). Les couleurs et libellés sont
// choisis à partir de `status` / `reasonCode`, jamais en comparant le texte affiché.
// ---------------------------------------------------------------------------------------------

/** Valeur de prévision affichable : « — » quand elle manque, jamais null, NaN ou 0 inventé. */
export function forecastValue(value) {
    return value === null || value === undefined || Number.isNaN(value) ? t('weather.missingPlaceholder') : value;
}

/** « Indisponible : vent moyen, rafales » pour une heure incomplète, sinon ''. */
export function missingValuesText(status) {
    if (!status || status.status !== 'incomplete' || !status.missing?.length) return '';
    const labels = status.missing.map((code) => t(`weather.missing.${code}`));
    return t('weather.unavailableList', { list: labels.join(', ') });
}

/** Couleur d'un verdict pour le marqueur de carte (`bar: false`) ou la frise horaire. */
export function verdictColor(status, { bar = false } = {}) {
    if (!status || status.status === 'loading' || status.status === 'incomplete')
        return bar ? 'transparent' : '#94a3b8';
    if (status.status === 'flyable') return status.warning ? '#eab308' : bar ? 'var(--accent-green)' : '#22c55e';
    if (status.reasonCode === 'NIGHT') return bar ? 'rgba(100,100,120,0.3)' : '#475569';
    if (status.reasonCode === 'RAIN') return '#3b82f6';
    if (status.reasonCode === 'WRONG_ORIENTATION') return '#f97316';
    return '#ef4444';
}

/**
 * Rappel affiché avec chaque verdict (spec 001 FR-010b, constitution principe II) : l'avis de
 * l'application repose sur des prévisions, le risque d'orage est estimé, le pilote décide.
 * Rien quand il n'y a pas de verdict (chargement, prévision incomplète).
 */
export function verdictReminderHtml(status) {
    if (status && status.status !== 'flyable' && status.status !== 'unflyable') return '';
    return `<p class="verdict-reminder"><i class="ri-information-line" aria-hidden="true"></i> ${escapeHTML(t('weather.reminder'))}</p>`;
}

/** Libellé français d'un modèle météo (spec 002, FR-001). */
export function modelLabel(modelKey) {
    const info = WEATHER_MODEL_INFO[modelKey];
    return info ? t(info.labelKey) : String(modelKey || '').toUpperCase();
}

const pad2 = (n) => String(n).padStart(2, '0');

/** « aujourd'hui » / « hier » / autre jour, en heure locale, par rapport à `now`. */
function dayOffset(timestamp, now) {
    const a = new Date(timestamp);
    const b = new Date(now);
    const startA = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
    const startB = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
    return Math.round((startB - startA) / 86400000);
}

/**
 * Ligne de contexte d'un verdict (spec 002, US1) : « AROME (Météo-France) · récupérée à 14 h 05
 * · run AROME de 08 h ». L'heure de calcul n'apparaît que si elle est connue (FR-003).
 * @param {{modelKey: string, fetchedAt: number, runAt?: number|null}} provenance
 * @param {number} [now]
 */
export function formatForecastContext(provenance, now = Date.now()) {
    const fetched = new Date(provenance.fetchedAt);
    const time = `${pad2(fetched.getHours())} h ${pad2(fetched.getMinutes())}`;
    const offset = dayOffset(provenance.fetchedAt, now);
    const when =
        offset === 0
            ? t('forecast.whenToday', { time })
            : offset === 1
              ? t('forecast.whenYesterday', { time })
              : t('forecast.whenOtherDay', { day: FR_WEEKDAYS[fetched.getDay()], time });
    let text = t('forecast.context', { model: modelLabel(provenance.modelKey), when });

    const info = WEATHER_MODEL_INFO[provenance.modelKey];
    if (provenance.runAt && info && info.runLabel) {
        const run = new Date(provenance.runAt);
        const hour = `${pad2(run.getHours())} h`;
        const runOffset = dayOffset(provenance.runAt, now);
        const runWhen =
            runOffset === 0
                ? t('forecast.runToday', { hour })
                : runOffset === 1
                  ? t('forecast.runYesterday', { hour })
                  : t('forecast.runOtherDay', { day: FR_WEEKDAYS[run.getDay()], hour });
        text += t('forecast.run', { component: info.runLabel, when: runWhen });
    }
    return text;
}

/**
 * Accord du second modèle pour l'heure affichée (spec 002, US3) : texte + icône, jamais la
 * couleur seule. Rien si les modèles n'ont pas été comparés.
 */
export function modelAgreementHtml(site) {
    const agreement = SitesService.getModelAgreement(site);
    if (!agreement || agreement.state === 'not_compared') return '';
    const model = modelLabel(agreement.secondaryModelKey);
    let text;
    if (agreement.state === 'agree') text = t('forecast.agree', { model });
    else if (agreement.state === 'disagree')
        text = t('forecast.disagree', { model, verdict: agreement.secondaryOutcome?.reason || '' });
    else text = t('forecast.comparisonUnavailable', { model });
    return `<p class="model-agreement model-agreement--${agreement.state}">${escapeHTML(text)}</p>`;
}

/** Âge d'une prévision : « 45 min », « 3 h 20 », « 1 j 2 h » (spec 002, US2). */
export function formatAge(ms) {
    const minutes = Math.max(0, Math.floor(ms / 60000));
    if (minutes < 60) return t('forecast.ageMinutes', { minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t('forecast.ageHours', { hours, minutes: pad2(minutes % 60) });
    return t('forecast.ageDays', { days: Math.floor(hours / 24), hours: hours % 24 });
}

/** Dernier échec d'« Actualiser » (raison en français), affiché sur les prévisions anciennes. */
let lastRefreshFailure = '';

/** Raison de l'échec de la dernière actualisation de la météo ('' si elle a réussi). */
export function setRefreshFailure(reason) {
    lastRefreshFailure = reason;
}
export function getRefreshFailure() {
    return lastRefreshFailure;
}

/**
 * Contenu d'une ligne de contexte. Au-delà de 3 h (spec 002, FR-005) : âge, avertissement et
 * bouton « Actualiser », plus la raison du dernier échec éventuel (FR-006).
 */
export function forecastContextInner(provenance, now = Date.now()) {
    const stale = now - provenance.fetchedAt > STALE_AFTER_MS;
    let html = escapeHTML(formatForecastContext(provenance, now));
    if (stale) {
        html +=
            `<br><span class="forecast-stale-text"><i class="ri-time-line" aria-hidden="true"></i> ` +
            `${escapeHTML(t('forecast.stale', { age: formatAge(now - provenance.fetchedAt) }))}</span> ` +
            `<button type="button" class="forecast-refresh-btn" data-action="SitesrefreshWeather">${escapeHTML(t('forecast.refresh'))}</button>`;
        if (lastRefreshFailure) {
            html += `<br><span class="forecast-refresh-error">${escapeHTML(t('forecast.refreshFailed', { reason: lastRefreshFailure }))}</span>`;
        }
    }
    return { html, stale };
}

/** Ligne de contexte HTML d'un site (vide si sa prévision n'a pas encore de provenance). */
export function forecastContextHtml(siteId) {
    const provenance = SitesService.getForecastProvenance(siteId);
    if (!provenance) return '';
    const { html, stale } = forecastContextInner(provenance);
    return (
        `<p class="forecast-context${stale ? ' forecast-context--stale' : ''}" data-fetched-at="${provenance.fetchedAt}" ` +
        `data-model-key="${escapeHTML(provenance.modelKey)}" data-run-at="${provenance.runAt || ''}">${html}</p>`
    );
}

/** Libellé du rayon (10–200 km ; « Illimité » n'existe plus, spec 002 FR-015). */
export function radiusLabel(km) {
    return t('forecast.radiusKm', { km: Math.min(RADIUS.MAX, Number(km)) });
}

/** Libellé court d'un verdict (infobulles, tableau) : raison + données manquantes éventuelles. */
export function verdictLabel(status) {
    const missing = missingValuesText(status);
    return missing ? `${status.reason} — ${missing}` : status.reason;
}
