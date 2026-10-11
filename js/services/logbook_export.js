/**
 * SERVICE - Logbook export
 * Pure builders for what leaves the logbook: the name of a downloaded IGC file and the printable
 * A4 report. No DOM access here: the view hands the result to the browser (download, print).
 */
import { t } from '../utils/i18n.js';
import { escapeHTML } from '../core/security.js';
import { formatDateOnly, formatDuration } from '../utils/date_utils.js';

/**
 * @typedef {object} ExportedSession
 * @property {string} [type] 'vol' ou 'gonflage'
 * @property {string} [datetime]
 * @property {string} [site]
 * @property {string} [lieu]
 * @property {string} [voile]
 * @property {number|string} [duree] minutes
 * @property {string} [commentaire]
 */

/** « Écharpe à Gérôme » → « echarpe-a-gerome » ; chaîne vide si rien d'exploitable. */
function slugify(text) {
    return String(text || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/**
 * Nom du fichier `.igc` téléchargé pour un vol : `<date>_<site>.igc`.
 * @param {ExportedSession} flight
 * @returns {string}
 */
export function buildIgcFileName(flight) {
    const date = (flight?.datetime || '').slice(0, 10) || 'vol';
    const site = slugify(flight?.site || flight?.lieu) || 'trace';
    return `${date}_${site}.igc`;
}

const REPORT_STYLE = `
    body { font-family: Arial, Helvetica, sans-serif; margin: 20mm 15mm; color: #111; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    .meta { color: #555; font-size: 12px; margin-bottom: 14px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #bbb; padding: 5px 7px; text-align: left; vertical-align: top; }
    th { background: #eee; }
    tr { page-break-inside: avoid; }
    .totals { margin-top: 14px; font-size: 13px; font-weight: bold; }
    @page { size: A4; margin: 12mm; }
`;

/**
 * Document HTML imprimable (A4) du carnet : sessions par ordre chronologique et totaux.
 * @param {ExportedSession[]} flights
 * @param {{generatedAt?: string|Date}} [options]
 * @returns {string}
 */
export function buildLogbookReportHtml(flights, { generatedAt = new Date() } = {}) {
    const sessions = [...flights].sort((a, b) => (a.datetime || '').localeCompare(b.datetime || ''));
    const isGround = (f) => f.type === 'gonflage';
    const minutes = (f) => parseInt(f.duree || 0, 10) || 0;
    const totalOf = (list) => list.reduce((sum, f) => sum + minutes(f), 0);

    const rows = sessions
        .map(
            (f) => `
        <tr>
            <td>${escapeHTML(formatDateOnly(f.datetime))}</td>
            <td>${escapeHTML(t(isGround(f) ? 'logbook.export.typeGround' : 'logbook.export.typeFlight'))}</td>
            <td>${escapeHTML(f.site || f.lieu || '')}</td>
            <td>${escapeHTML(f.voile || '')}</td>
            <td>${escapeHTML(formatDuration(minutes(f)))}</td>
            <td>${escapeHTML(f.commentaire || '')}</td>
        </tr>`,
        )
        .join('');

    const columns = ['date', 'type', 'site', 'wing', 'duration', 'comment']
        .map((key) => `<th>${escapeHTML(t(`logbook.export.columns.${key}`))}</th>`)
        .join('');
    const count = sessions.length;
    const countLabel = t(count === 1 ? 'logbook.export.totalSession' : 'logbook.export.totalSessions', { count });
    const totals = [
        countLabel,
        t('logbook.export.totalFlights', { duration: formatDuration(totalOf(sessions.filter((f) => !isGround(f)))) }),
        t('logbook.export.totalGround', { duration: formatDuration(totalOf(sessions.filter(isGround))) }),
    ];

    return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>${escapeHTML(t('logbook.export.title'))}</title>
<style>${REPORT_STYLE}</style>
</head>
<body>
<h1>${escapeHTML(t('logbook.export.title'))}</h1>
<div class="meta">${escapeHTML(t('logbook.export.generated', { date: formatDateOnly(generatedAt) }))}</div>
<table>
<thead><tr>${columns}</tr></thead>
<tbody>${rows}
</tbody>
</table>
<div class="totals">${totals.map(escapeHTML).join(' · ')}</div>
</body>
</html>
`;
}
