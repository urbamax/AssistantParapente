/**
 * VIEW - Sites strings
 * Textes de l'écran des sites (spec 015), tous dans js/i18n/fr.js (section sites). tt() : texte pour
 * du HTML, paramètres échappés ; th() : un paramètre est un fragment HTML construit ici ; tl() :
 * texte brut (textContent, attributs posés par setAttribute, boîtes de dialogue).
 */
import { escapeHTML } from '../core/security.js';
import { t } from '../utils/i18n.js';

const fillParams = (text, params, format) =>
    text.replace(/\{(\w+)\}/g, (match, name) =>
        Object.prototype.hasOwnProperty.call(params, name) ? format(params[name]) : match,
    );
export const tt = (key, params = {}) =>
    fillParams(escapeHTML(t(`sites.${key}`)), params, (value) => escapeHTML(String(value)));
export const th = (key, htmlParams) => fillParams(escapeHTML(t(`sites.${key}`)), htmlParams, String);
export const tl = (key, params) => t(`sites.${key}`, params);
