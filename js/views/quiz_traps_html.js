// @ts-check
/**
 * Construction HTML pure des deux rappels de pièges hors séance : le bandeau de l'accueil du quiz et
 * la carte du résumé de fin de série.
 */
import { tq } from './quiz_strings.js';

const BTN =
    'background:#ef4444; color:#fff; border:none; padding:10px 18px; border-radius:10px; font-weight:700; font-size:0.86rem; cursor:pointer; display:inline-flex; align-items:center; gap:8px; white-space:nowrap;';
const LINK =
    'background:transparent; color:var(--text-secondary); border:1px solid var(--border-color); padding:10px 14px; border-radius:10px; font-weight:700; font-size:0.84rem; cursor:pointer; white-space:nowrap;';
const BOX =
    'display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px; padding:14px 18px; border-radius:var(--radius-md); background:rgba(248,113,113,0.08); border:1px solid rgba(248,113,113,0.35);';

/**
 * Bandeau de l'accueil du quiz. Chaîne vide s'il n'y a aucun piège actif.
 *
 * @param {{ active: number, axes: number }} totals
 * @returns {string}
 */
export function buildTrapsNudgeHtml(totals) {
    if (!totals || totals.active <= 0) return '';
    const title =
        totals.active === 1 ? tq('traps.nudgeTitleOne') : tq('traps.nudgeTitleMany', { count: totals.active });
    const text = totals.axes === 1 ? tq('traps.nudgeTextOne') : tq('traps.nudgeTextMany', { axes: totals.axes });
    return `
        <div class="traps-nudge" style="${BOX}">
            <div style="flex:1 1 240px;">
                <div style="font-weight:800; font-size:0.95rem; color:var(--text-main); display:flex; align-items:center; gap:8px; margin-bottom:2px;"><i class="ri-alert-line" style="color:#ef4444;"></i> ${title}</div>
                <div style="font-size:0.82rem; color:var(--text-secondary); line-height:1.4;">${text}</div>
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:8px;">
                <button type="button" data-action="QuizstartTrapsWorkshop" style="${BTN}"><i class="ri-focus-2-line"></i> ${tq('axes.trapsWorkshopBtn')}</button>
                <button type="button" data-action="QuizshowRevisionAxes" style="${LINK}">${tq('traps.nudgeAxesBtn')}</button>
            </div>
        </div>
    `;
}

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
