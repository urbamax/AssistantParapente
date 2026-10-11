/**
 * VIEW - Logbook strings
 * Textes du carnet (spec 014), tous dans js/i18n/fr.js (section logbook). tt() : texte pour du HTML,
 * paramètres échappés ; th() : un paramètre est un fragment HTML construit ici (nombres en gras) ;
 * tl() : texte brut (innerText, champs, boîtes de dialogue).
 */
import { escapeHTML } from '../core/security.js';
import { t } from '../utils/i18n.js';

const fillParams = (text, params, format) =>
    text.replace(/\{(\w+)\}/g, (match, name) =>
        Object.prototype.hasOwnProperty.call(params, name) ? format(params[name]) : match,
    );

export const tt = (key, params = {}) =>
    fillParams(escapeHTML(t(`logbook.${key}`)), params, (value) => escapeHTML(String(value)));
export const th = (key, htmlParams) => fillParams(escapeHTML(t(`logbook.${key}`)), htmlParams, String);
export const tl = (key, params) => t(`logbook.${key}`, params);
