// @ts-check
/**
 * Construction HTML pure de l'écran « Axes de révision » anti-bachotage (Spec 043).
 *
 * Chaque carte d'axe structure l'étude en 3 étapes :
 *   1. Lire le cours officiel aux pages exactes (uniquement pages vérifiées #page=N)
 *   2. Points clés à retenir (explications conceptuelles dépliables sans choix QCM A/B/C/D)
 *   3. Vérifier ma compréhension (lancement d'un atelier ciblé de 5 à 8 questions)
 */
import { escapeHTML } from '../core/security.js';
import { tq } from './quiz_strings.js';
import { explanationHtml } from './quiz_explanation.js';

/** @type {Record<string, { border: string, bg: string, color: string, icon: string }>} */
const STATUS_THEME = {
    BLOCKER: {
        border: 'rgba(248, 113, 113, 0.45)',
        bg: 'rgba(248, 113, 113, 0.12)',
        color: '#ef4444',
        icon: 'ri-error-warning-line',
    },
    REFRESH: {
        border: 'rgba(251, 146, 60, 0.45)',
        bg: 'rgba(251, 146, 60, 0.12)',
        color: '#f97316',
        icon: 'ri-refresh-line',
    },
    EXPLORE: {
        border: 'rgba(56, 189, 248, 0.45)',
        bg: 'rgba(56, 189, 248, 0.12)',
        color: '#0ea5e9',
        icon: 'ri-compass-3-line',
    },
    MASTERED: {
        border: 'rgba(74, 222, 128, 0.45)',
        bg: 'rgba(74, 222, 128, 0.12)',
        color: '#22c55e',
        icon: 'ri-checkbox-circle-line',
    },
};

/**
 * Construit le bandeau de raccourci affiché en haut de l'écran Statistiques (`#stats-axes-banner`).
 *
 * @returns {string}
 */
export function buildStatsAxesShortcutHtml() {
    return `
        <div class="stats-axes-shortcut" style="display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:16px; padding:16px 20px; margin-top:16px; border-radius:var(--radius-md); background:var(--bg-card); border:1px solid var(--border-color); box-shadow:0 4px 12px rgba(0,0,0,0.06);">
            <div style="display:flex; align-items:flex-start; gap:14px; flex:1 1 280px;">
                <div style="width:42px; height:42px; border-radius:12px; background:rgba(14,165,233,0.14); color:var(--accent-orange); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                    <i class="ri-compass-3-line" style="font-size:1.35rem;"></i>
                </div>
                <div>
                    <div style="font-weight:800; font-size:1rem; color:var(--text-main); margin-bottom:4px;">${tq('axes.shortcutFromStatsTitle')}</div>
                    <div style="font-size:0.86rem; color:var(--text-secondary); line-height:1.45;">${tq('axes.shortcutFromStatsText')}</div>
                </div>
            </div>
            <button type="button" data-action="QuizshowRevisionAxes" style="background:var(--accent-orange); color:#fff; border:none; padding:10px 18px; border-radius:12px; font-weight:700; font-size:0.88rem; cursor:pointer; display:inline-flex; align-items:center; gap:8px; white-space:nowrap;">
                <i class="ri-compass-3-line"></i> ${tq('axes.shortcutFromStatsBtn')} <i class="ri-arrow-right-line"></i>
            </button>
        </div>
    `;
}

/**
 * Construit les pastilles de répartition des questions d'un axe.
 *
 * @param {any} axis
 * @returns {string}
 */
function buildAxisBreakdownPillsHtml(axis) {
    /** @type {string[]} */
    const pills = [];
    if (axis.strugglingCount > 0) {
        const label =
            axis.strugglingCount === 1
                ? tq('axes.pillStrugglingOne')
                : tq('axes.pillStrugglingMany', { count: axis.strugglingCount });
        pills.push(
            `<span style="background:rgba(248,113,113,0.14); color:#ef4444; border:1px solid rgba(248,113,113,0.35); padding:3px 9px; border-radius:999px; font-size:0.76rem; font-weight:700;">${label}</span>`,
        );
    }
    if (axis.hesitantCount > 0) {
        const label =
            axis.hesitantCount === 1
                ? tq('axes.pillHesitantOne')
                : tq('axes.pillHesitantMany', { count: axis.hesitantCount });
        pills.push(
            `<span style="background:rgba(251,191,36,0.14); color:#f59e0b; border:1px solid rgba(251,191,36,0.35); padding:3px 9px; border-radius:999px; font-size:0.76rem; font-weight:700;">${label}</span>`,
        );
    }
    if (axis.dueCount > 0) {
        const label = axis.dueCount === 1 ? tq('axes.pillDueOne') : tq('axes.pillDueMany', { count: axis.dueCount });
        pills.push(
            `<span style="background:rgba(251,146,60,0.14); color:#f97316; border:1px solid rgba(251,146,60,0.35); padding:3px 9px; border-radius:999px; font-size:0.76rem; font-weight:700;">${label}</span>`,
        );
    }
    if (axis.unattemptedCount > 0) {
        const label =
            axis.unattemptedCount === 1
                ? tq('axes.pillUnattemptedOne')
                : tq('axes.pillUnattemptedMany', { count: axis.unattemptedCount });
        pills.push(
            `<span style="background:rgba(56,189,248,0.14); color:#0ea5e9; border:1px solid rgba(56,189,248,0.35); padding:3px 9px; border-radius:999px; font-size:0.76rem; font-weight:700;">${label}</span>`,
        );
    }
    if (axis.masteredCount > 0) {
        const label =
            axis.masteredCount === 1
                ? tq('axes.pillMasteredOne')
                : tq('axes.pillMasteredMany', { count: axis.masteredCount });
        pills.push(
            `<span style="background:rgba(74,222,128,0.14); color:#22c55e; border:1px solid rgba(74,222,128,0.35); padding:3px 9px; border-radius:999px; font-size:0.76rem; font-weight:700;">${label}</span>`,
        );
    }
    return pills.join('');
}

/**
 * Construit le bloc « Étape 1 — Lire le cours officiel aux pages exactes ».
 *
 * @param {any} axis
 * @returns {string}
 */
function buildStep1CoursesHtml(axis) {
    if (!Array.isArray(axis.courseReadings) || axis.courseReadings.length === 0) {
        return `
            <div class="revision-axis-step" style="padding:14px 16px; border-radius:12px; background:rgba(255,255,255,0.02); border:1px solid var(--border-color);">
                <div style="display:flex; align-items:center; gap:8px; font-weight:700; font-size:0.88rem; color:var(--text-main); margin-bottom:6px;">
                    <i class="ri-book-read-line" style="color:var(--accent-orange);"></i>
                    <span>${tq('axes.step1Heading')}</span>
                </div>
                <div style="font-size:0.82rem; color:var(--text-secondary);">${tq('axes.step1Empty')}</div>
            </div>
        `;
    }

    const coursesHtml = axis.courseReadings
        .map((reading) => {
            const pageButtons = reading.pageLinks
                .map(
                    (link) => `
                        <a href="${escapeHTML(link.url)}" target="_blank" rel="noopener noreferrer" class="revision-axis-page-link" style="display:inline-flex; align-items:center; gap:4px; padding:4px 10px; border-radius:8px; background:rgba(14,165,233,0.12); color:var(--accent-orange); border:1px solid rgba(14,165,233,0.3); font-size:0.78rem; font-weight:700; text-decoration:none;">
                            <i class="ri-file-pdf-line"></i> ${tq('axes.coursePageLink', { page: link.page })}
                        </a>
                    `,
                )
                .join('');

            const focusBadge =
                reading.focusHitCount > 0
                    ? `<span style="background:rgba(248,113,113,0.15); color:#ef4444; border:1px solid rgba(248,113,113,0.35); padding:2px 8px; border-radius:999px; font-size:0.72rem; font-weight:700;">${tq('axes.courseFocusBadge')}</span>`
                    : '';

            return `
                <div class="revision-axis-course-item" style="display:flex; flex-direction:column; gap:8px; padding:10px 12px; border-radius:10px; background:var(--bg-card); border:1px solid var(--border-color);">
                    <div style="display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:8px;">
                        <a href="${escapeHTML(reading.primaryUrl)}" target="_blank" rel="noopener noreferrer" style="font-weight:700; font-size:0.9rem; color:var(--text-main); text-decoration:none; display:inline-flex; align-items:center; gap:6px;">
                            <i class="ri-book-open-line" style="color:var(--accent-orange);"></i>
                            <span>${escapeHTML(reading.title)}</span>
                            <i class="ri-external-link-line" style="font-size:0.8rem; opacity:0.7;"></i>
                        </a>
                        <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                            ${focusBadge}
                            <span style="font-size:0.78rem; font-weight:700; color:var(--text-secondary); background:rgba(148,163,184,0.12); padding:2px 8px; border-radius:6px;">
                                ${tq('axes.coursePagesBadge', { ranges: reading.pageRangesText })}
                            </span>
                        </div>
                    </div>
                    <div style="display:flex; flex-wrap:wrap; gap:6px;">
                        ${pageButtons}
                    </div>
                </div>
            `;
        })
        .join('');

    return `
        <div class="revision-axis-step" style="padding:14px 16px; border-radius:12px; background:rgba(255,255,255,0.02); border:1px solid var(--border-color);">
            <div style="display:flex; align-items:center; gap:8px; font-weight:700; font-size:0.88rem; color:var(--text-main); margin-bottom:10px;">
                <i class="ri-book-read-line" style="color:var(--accent-orange);"></i>
                <span>${tq('axes.step1Heading')}</span>
            </div>
            <div style="display:flex; flex-direction:column; gap:8px;">
                ${coursesHtml}
            </div>
        </div>
    `;
}

/**
 * Construit le bloc « Étape 2 — Points clés à retenir (sans QCM) ».
 *
 * @param {any} axis
 * @param {boolean} isExpanded
 * @returns {string}
 */
function buildStep2TakeawaysHtml(axis, isExpanded) {
    if (!Array.isArray(axis.takeaways) || axis.takeaways.length === 0) {
        return '';
    }

    const count = axis.takeaways.length;
    const toggleLabel = isExpanded ? tq('axes.step2HideBtn', { count }) : tq('axes.step2ShowBtn', { count });
    const toggleIcon = isExpanded ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line';

    /** @type {Record<string, { key: string, color: string, bg: string }>} */
    const bucketMeta = {
        struggling: { key: 'axes.takeawayBadgeStruggling', color: '#ef4444', bg: 'rgba(248,113,113,0.14)' },
        hesitant: { key: 'axes.takeawayBadgeHesitant', color: '#f59e0b', bg: 'rgba(251,191,36,0.14)' },
        due: { key: 'axes.takeawayBadgeDue', color: '#f97316', bg: 'rgba(251,146,60,0.14)' },
        unattempted: { key: 'axes.takeawayBadgeExplore', color: '#0ea5e9', bg: 'rgba(56,189,248,0.14)' },
        mastered: { key: 'axes.takeawayBadgeMastered', color: '#22c55e', bg: 'rgba(74,222,128,0.14)' },
    };

    const listHtml = isExpanded
        ? `
            <div class="revision-axis-takeaways-list" style="margin-top:12px; display:flex; flex-direction:column; gap:10px;">
                <div style="font-size:0.8rem; color:var(--text-secondary); line-height:1.45;">
                    ${tq('axes.step2Hint')}
                </div>
                ${axis.takeaways
                    .map((item) => {
                        const meta = bucketMeta[item.bucket] || bucketMeta.unattempted;
                        const badgeText = tq(meta.key, { num: item.questionNum });
                        const courseLink =
                            item.courseUrl && item.courseTitle && item.coursePage
                                ? `<a href="${escapeHTML(item.courseUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-flex; align-items:center; gap:4px; font-size:0.76rem; font-weight:700; color:var(--accent-orange); text-decoration:none;">
                                        <i class="ri-file-pdf-line"></i> ${tq('axes.takeawayCourseLink', { title: item.courseTitle, page: item.coursePage })}
                                   </a>`
                                : '';
                        return `
                            <div class="revision-axis-takeaway-item" style="padding:12px 14px; border-radius:10px; background:var(--bg-card); border:1px solid var(--border-color); border-left:3px solid ${meta.color};">
                                <div style="display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:8px; margin-bottom:6px;">
                                    <span style="background:${meta.bg}; color:${meta.color}; padding:2px 8px; border-radius:999px; font-size:0.74rem; font-weight:700;">
                                        ${badgeText}
                                    </span>
                                    ${courseLink}
                                </div>
                                <div style="font-size:0.88rem; color:var(--text-main); line-height:1.5;">
                                    ${explanationHtml(item.explanation)}
                                </div>
                            </div>
                        `;
                    })
                    .join('')}
            </div>
        `
        : '';

    return `
        <div class="revision-axis-step" style="padding:14px 16px; border-radius:12px; background:rgba(255,255,255,0.02); border:1px solid var(--border-color);">
            <div style="display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:10px;">
                <div style="display:flex; align-items:center; gap:8px; font-weight:700; font-size:0.88rem; color:var(--text-main);">
                    <i class="ri-lightbulb-line" style="color:#f59e0b;"></i>
                    <span>${tq('axes.step2Heading')}</span>
                </div>
                <button type="button" data-action="QuiztoggleAxisTakeaways" data-args="${escapeHTML(axis.id)}" aria-expanded="${isExpanded ? 'true' : 'false'}" style="background:rgba(245,158,11,0.12); color:#f59e0b; border:1px solid rgba(245,158,11,0.35); padding:6px 12px; border-radius:10px; font-size:0.8rem; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:6px;">
                    <span>${toggleLabel}</span>
                    <i class="${toggleIcon}"></i>
                </button>
            </div>
            ${listHtml}
        </div>
    `;
}

/**
 * Construit le bloc « Étape 3 — Vérifier ma compréhension (Atelier ciblé) ».
 *
 * @param {any} axis
 * @returns {string}
 */
function buildStep3WorkshopHtml(axis) {
    const btnLabel =
        axis.workshopSize === 1 ? tq('axes.workshopBtnOne') : tq('axes.workshopBtnMany', { count: axis.workshopSize });

    return `
        <div class="revision-axis-step" style="display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px; padding:14px 16px; border-radius:12px; background:rgba(14,165,233,0.06); border:1px solid rgba(14,165,233,0.22);">
            <div style="flex:1 1 240px;">
                <div style="display:flex; align-items:center; gap:8px; font-weight:700; font-size:0.88rem; color:var(--text-main); margin-bottom:2px;">
                    <i class="ri-focus-2-line" style="color:var(--accent-orange);"></i>
                    <span>${tq('axes.step3Heading')}</span>
                </div>
                <div style="font-size:0.8rem; color:var(--text-secondary); line-height:1.4;">
                    ${tq('axes.step3Hint')}
                </div>
            </div>
            <button type="button" data-action="QuizstartAxisWorkshop" data-args="${escapeHTML(axis.id)}" style="background:var(--accent-orange); color:#fff; border:none; padding:10px 18px; border-radius:10px; font-weight:700; font-size:0.86rem; cursor:pointer; display:inline-flex; align-items:center; gap:8px; white-space:nowrap;">
                <i class="ri-focus-2-line"></i>
                <span>${btnLabel}</span>
                <i class="ri-arrow-right-line"></i>
            </button>
        </div>
    `;
}

/**
 * Construit la carte HTML complète d'un axe de révision.
 *
 * @param {any} axis
 * @param {Set<string>} expandedIds
 * @returns {string}
 */
export function buildRevisionAxisCardHtml(axis, expandedIds) {
    const theme = STATUS_THEME[axis.status] || STATUS_THEME.EXPLORE;
    const isExpanded = expandedIds instanceof Set && expandedIds.has(axis.id);
    const statusLabel = tq(`axes.statusLabels.${axis.status}`);
    const barColor =
        axis.masteryPct >= 85
            ? '#22c55e'
            : axis.masteryPct >= 50
              ? '#f59e0b'
              : axis.attemptedCount > 0
                ? '#ef4444'
                : '#38bdf8';

    return `
        <article class="revision-axis-card" data-axis-id="${escapeHTML(axis.id)}" data-axis-status="${escapeHTML(axis.status)}" style="background:var(--bg-card); border:1px solid var(--border-color); border-left:4px solid ${theme.color}; border-radius:var(--radius-md); padding:20px; display:flex; flex-direction:column; gap:14px; box-shadow:0 4px 12px rgba(0,0,0,0.04);">
            <header style="display:flex; flex-direction:column; gap:10px;">
                <div style="display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:8px;">
                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                        <span style="background:rgba(148,163,184,0.14); color:var(--text-main); padding:3px 10px; border-radius:999px; font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:0.04em;">
                            ${escapeHTML(axis.category)}
                        </span>
                        <span style="background:${theme.bg}; color:${theme.color}; border:1px solid ${theme.border}; padding:3px 10px; border-radius:999px; font-size:0.76rem; font-weight:700; display:inline-flex; align-items:center; gap:5px;">
                            <i class="${theme.icon}"></i>
                            <span>${statusLabel}</span>
                        </span>
                    </div>
                    <span style="font-size:0.82rem; font-weight:700; color:var(--text-secondary);">
                        ${tq('axes.metricsSummary', { attempted: axis.attemptedCount, total: axis.totalQuestions, mastery: axis.masteryPct })}
                    </span>
                </div>

                <div>
                    <h3 style="margin:0 0 4px 0; font-size:1.12rem; font-weight:800; color:var(--text-main);">
                        ${escapeHTML(axis.title)}
                    </h3>
                    <p style="margin:0; font-size:0.85rem; color:var(--text-secondary); line-height:1.45;">
                        ${escapeHTML(axis.subtitle)}
                    </p>
                </div>

                <div style="display:flex; flex-direction:column; gap:8px;">
                    <div style="height:6px; width:100%; background:rgba(148,163,184,0.16); border-radius:999px; overflow:hidden;">
                        <div style="height:100%; width:${axis.masteryPct}%; background:${barColor}; border-radius:999px; transition:width 0.3s;"></div>
                    </div>
                    <div style="display:flex; flex-wrap:wrap; gap:6px;">
                        ${buildAxisBreakdownPillsHtml(axis)}
                    </div>
                </div>
            </header>

            ${buildStep1CoursesHtml(axis)}
            ${buildStep2TakeawaysHtml(axis, isExpanded)}
            ${buildStep3WorkshopHtml(axis)}
        </article>
    `;
}

/**
 * Construit le tableau de bord complet de l'écran « Axes de révision ».
 *
 * @param {{ level: string, axes: any[], counts: Record<string, number> }} report
 * @param {{ statusFilter?: string, expandedIds?: Set<string> }} [uiState]
 * @returns {string}
 */
export function buildRevisionAxesDashboardHtml(report, uiState = {}) {
    const activeFilter = uiState.statusFilter || 'ALL';
    const expandedIds = uiState.expandedIds instanceof Set ? uiState.expandedIds : new Set();

    const filterDefs = [
        { key: 'ALL', label: tq('axes.filterAll', { count: report.counts.ALL || 0 }) },
        { key: 'BLOCKER', label: tq('axes.filterBlocker', { count: report.counts.BLOCKER || 0 }) },
        { key: 'REFRESH', label: tq('axes.filterRefresh', { count: report.counts.REFRESH || 0 }) },
        { key: 'EXPLORE', label: tq('axes.filterExplore', { count: report.counts.EXPLORE || 0 }) },
        { key: 'MASTERED', label: tq('axes.filterMastered', { count: report.counts.MASTERED || 0 }) },
    ];

    const filtersHtml = filterDefs
        .map((f) => {
            const isActive = f.key === activeFilter;
            const style = isActive
                ? 'background:var(--accent-orange); color:#fff; border:1px solid var(--accent-orange);'
                : 'background:var(--bg-card); color:var(--text-secondary); border:1px solid var(--border-color);';
            return `
                <button type="button" data-action="QuizsetAxesFilter" data-args="${f.key}" aria-pressed="${isActive ? 'true' : 'false'}" style="${style} padding:8px 14px; border-radius:999px; font-size:0.82rem; font-weight:700; cursor:pointer; transition:all 0.2s;">
                    ${f.label}
                </button>
            `;
        })
        .join('');

    const visibleAxes =
        activeFilter === 'ALL' ? report.axes : report.axes.filter((axis) => axis.status === activeFilter);

    const cardsHtml =
        visibleAxes.length > 0
            ? visibleAxes.map((axis) => buildRevisionAxisCardHtml(axis, expandedIds)).join('')
            : `<div style="padding:32px; text-align:center; background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-md); color:var(--text-secondary); font-size:0.92rem;">
                    ${tq('axes.emptyFilter')}
               </div>`;

    return `
        <div class="revision-axes-dashboard" style="display:flex; flex-direction:column; gap:20px;">
            <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:20px;">
                <p style="margin:0 0 16px 0; color:var(--text-secondary); font-size:0.92rem; line-height:1.55;">
                    ${tq('axes.subtitle')}
                </p>
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(210px, 1fr)); gap:12px;">
                    <div style="padding:12px 14px; border-radius:12px; background:rgba(14,165,233,0.06); border:1px solid rgba(14,165,233,0.2);">
                        <div style="font-weight:800; font-size:0.86rem; color:var(--text-main); margin-bottom:4px; display:flex; align-items:center; gap:6px;">
                            <i class="ri-book-read-line" style="color:var(--accent-orange);"></i>
                            <span>${tq('axes.methodStep1Title')}</span>
                        </div>
                        <div style="font-size:0.78rem; color:var(--text-secondary); line-height:1.4;">${tq('axes.methodStep1Text')}</div>
                    </div>
                    <div style="padding:12px 14px; border-radius:12px; background:rgba(245,158,11,0.06); border:1px solid rgba(245,158,11,0.2);">
                        <div style="font-weight:800; font-size:0.86rem; color:var(--text-main); margin-bottom:4px; display:flex; align-items:center; gap:6px;">
                            <i class="ri-lightbulb-line" style="color:#f59e0b;"></i>
                            <span>${tq('axes.methodStep2Title')}</span>
                        </div>
                        <div style="font-size:0.78rem; color:var(--text-secondary); line-height:1.4;">${tq('axes.methodStep2Text')}</div>
                    </div>
                    <div style="padding:12px 14px; border-radius:12px; background:rgba(34,197,94,0.06); border:1px solid rgba(34,197,94,0.2);">
                        <div style="font-weight:800; font-size:0.86rem; color:var(--text-main); margin-bottom:4px; display:flex; align-items:center; gap:6px;">
                            <i class="ri-focus-2-line" style="color:#22c55e;"></i>
                            <span>${tq('axes.methodStep3Title')}</span>
                        </div>
                        <div style="font-size:0.78rem; color:var(--text-secondary); line-height:1.4;">${tq('axes.methodStep3Text')}</div>
                    </div>
                </div>
            </div>

            <div class="revision-axes-filters" style="display:flex; flex-wrap:wrap; gap:8px;">
                ${filtersHtml}
            </div>

            <div class="revision-axes-list" style="display:flex; flex-direction:column; gap:16px;">
                ${cardsHtml}
            </div>
        </div>
    `;
}
