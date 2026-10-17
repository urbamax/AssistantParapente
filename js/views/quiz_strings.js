/**
 * VIEW - Quiz strings
 * Textes du quiz (spec 024), dans js/i18n/fr.js (section quiz). tq() : texte pour du HTML,
 * paramètres échappés ; tqh() : un paramètre est un fragment HTML construit ici ; tql() : texte
 * brut (innerText, boîtes de dialogue). tv() : texte du mode vocal (spec 016), échappé pour le HTML.
 * Les noms de thèmes et codes de niveau sont des données.
 */
import { escapeHTML } from '../core/security.js';
import { t } from '../utils/i18n.js';

const fillParams = (text, params, format) =>
    text.replace(/\{(\w+)\}/g, (match, name) =>
        Object.prototype.hasOwnProperty.call(params, name) ? format(params[name]) : match,
    );

export const tv = (key, params = {}) => escapeHTML(t(`quiz.voice.${key}`, params));
export const tq = (key, params = {}) =>
    fillParams(escapeHTML(t(`quiz.${key}`)), params, (value) => escapeHTML(String(value)));
export const tqh = (key, htmlParams) => fillParams(escapeHTML(t(`quiz.${key}`)), htmlParams, String);
export const tql = (key, params) => t(`quiz.${key}`, params);
