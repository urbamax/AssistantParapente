// @ts-check
/**
 * Construction HTML pure de la carte de pièges du résumé de fin de série.
 */
import { tq } from './quiz_strings.js';

const BTN =
    'background:#ef4444; color:#fff; border:none; padding:10px 18px; border-radius:10px; font-weight:700; font-size:0.86rem; cursor:pointer; display:inline-flex; align-items:center; gap:8px; white-space:nowrap;';
const BOX =
    'display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px; padding:14px 18px; border-radius:var(--radius-md); background:rgba(248,113,113,0.08); border:1px solid rgba(248,113,113,0.35);';

/**
 * Carte du résumé de fin de série : pièges cochés pendant la série. Chaîne vide s'il n'y en a aucun.
 *
 * @param {{ trapped: Array<{ code: string, count: number, status: string, relapse: boolean }>, recurrent: number }} summary
 * @param {{ canStartWorkshop: boolean }} options
 * @returns {string}
 */
export function buildResultsTrapsHtml(summary, options) {
    if (!summary || summary.trapped.length === 0) return '';
    const n = summary.trapped.length;
    const title = n === 1 ? tq('traps.resultsTitleOne') : tq('traps.resultsTitleMany', { count: n });
    const recurrent =
        summary.recurrent === 0
            ? tq('traps.resultsAllNew')
            : summary.recurrent === 1
              ? tq('traps.resultsRecurrentOne')
              : tq('traps.resultsRecurrentMany', { count: summary.recurrent });
    const workshop = options?.canStartWorkshop
        ? `<button type="button" data-action="QuizstartTrapsWorkshop" style="${BTN}"><i class="ri-focus-2-line"></i> ${tq('axes.trapsWorkshopBtn')}</button>`
        : '';
    return `
        <div class="results-traps" style="${BOX} margin-bottom:24px;">
            <div style="flex:1 1 240px;">
                <div style="font-weight:800; font-size:0.95rem; color:var(--text-main); display:flex; align-items:center; gap:8px; margin-bottom:2px;"><i class="ri-alert-line" style="color:#ef4444;"></i> ${title}</div>
                <div style="font-size:0.82rem; color:var(--text-secondary); line-height:1.4;">${recurrent} ${tq('traps.resultsHint')}</div>
            </div>
            ${workshop}
        </div>
    `;
}
