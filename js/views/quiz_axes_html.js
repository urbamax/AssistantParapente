// @ts-check
/**
 * Construction HTML pure de l'écran « Axes de révision » anti-bachotage (Spec 043).
 *
 * Chaque carte d'axe structure l'étude en 3 étapes :
 *   1. Lire le cours officiel aux pages exactes (uniquement pages vérifiées #page=N)
 *   2. Points clés à retenir (explications conceptuelles dépliables sans choix QCM A/B/C/D)
 *   3. Vérifier ma compréhension (lancement d'un atelier ciblé de 6 questions)
 *
 * Spec 062 : cartes repliées par défaut, étape 2 « Comprendre » regroupant pièges, oublis et points
 * clés, numérotation sans trou, filtres en deux lignes et aide « Comment lire cette page ».
 */
import { escapeHTML } from '../core/security.js';
import { tq, tqh } from './quiz_strings.js';
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
 * Construit les pastilles de répartition des questions d'un axe.
 *
 * @param {any} axis
 * @returns {string}
 */
function buildAxisBreakdownPillsHtml(axis) {
    /** @type {string[]} */
    const pills = [];
    const traps = axis.traps || { active: 0, consolidating: 0, overcome: 0 };
    const trapPill = (count, one, many, color, rgb) =>
        `<span style="background:rgba(${rgb},0.14); color:${color}; border:1px solid rgba(${rgb},0.35); padding:3px 9px; border-radius:999px; font-size:0.76rem; font-weight:700;"><i class="ri-alert-line"></i> ${count === 1 ? tq(one) : tq(many, { count })}</span>`;
    if (traps.active > 0) {
        pills.push(
            trapPill(traps.active, 'axes.pillTrapsActiveOne', 'axes.pillTrapsActiveMany', '#ef4444', '248,113,113'),
        );
    }
    if (traps.consolidating > 0) {
        pills.push(
            trapPill(
                traps.consolidating,
                'axes.pillTrapsConsolidatingOne',
                'axes.pillTrapsConsolidatingMany',
                '#f59e0b',
                '251,191,36',
            ),
        );
    }
    if (traps.overcome > 0) {
        pills.push(
            trapPill(
                traps.overcome,
                'axes.pillTrapsOvercomeOne',
                'axes.pillTrapsOvercomeMany',
                '#22c55e',
                '74,222,128',
            ),
        );
    }
    const omissions = axis.omissions || { active: 0, consolidating: 0, overcome: 0 };
    const omissionPill = (count, one, many, color, rgb) =>
        `<span style="background:rgba(${rgb},0.14); color:${color}; border:1px solid rgba(${rgb},0.35); padding:3px 9px; border-radius:999px; font-size:0.76rem; font-weight:700;"><i class="ri-error-warning-line"></i> ${count === 1 ? tq(one) : tq(many, { count })}</span>`;
    if (omissions.active > 0) {
        pills.push(
            omissionPill(
                omissions.active,
                'axes.pillOmissionsActiveOne',
                'axes.pillOmissionsActiveMany',
                '#f97316',
                '249,115,22',
            ),
        );
    }
    if (omissions.consolidating > 0) {
        pills.push(
            omissionPill(
                omissions.consolidating,
                'axes.pillOmissionsConsolidatingOne',
                'axes.pillOmissionsConsolidatingMany',
                '#f59e0b',
                '251,191,36',
            ),
        );
    }
    if (omissions.overcome > 0) {
        pills.push(
            omissionPill(
                omissions.overcome,
                'axes.pillOmissionsOvercomeOne',
                'axes.pillOmissionsOvercomeMany',
                '#22c55e',
                '74,222,128',
            ),
        );
    }
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
    return pills.join('');
}

/**
 * Libellé du bouton « Voir tous » : il annonce les erreurs surmontées qu'il ajoute, pour que son
 * total ne contredise pas les pastilles (qui ne comptent que les erreurs à corriger et en consolidation).
 *
 * @param {'traps' | 'omissions'} kind
 * @param {Array<{ status: string }>} items
 */
function showAllLabel(kind, items) {
    const overcome = items.filter((i) => i.status === 'overcome').length;
    if (overcome === 0) return tq(`axes.${kind}ShowAll`, { count: items.length });
    return overcome === 1
        ? tq(`axes.${kind}ShowAllOvercomeOne`, { count: items.length })
        : tq(`axes.${kind}ShowAllOvercome`, { count: items.length, overcome });
}

/** Nombre de pièges visibles sans déplier le bloc. */
const TRAPS_VISIBLE = 3;

/** @type {Record<string, { key: string, color: string, bg: string }>} */
const TRAP_STATUS_META = {
    active: { key: 'axes.trapStatusActive', color: '#ef4444', bg: 'rgba(248,113,113,0.14)' },
    consolidating: { key: 'axes.trapStatusConsolidating', color: '#f59e0b', bg: 'rgba(251,191,36,0.14)' },
    overcome: { key: 'axes.trapStatusOvercome', color: '#22c55e', bg: 'rgba(74,222,128,0.14)' },
};

/**
 * Construit le bloc « Mes pièges sur ce chapitre » : les fausses croyances déjà cochées, avec le
 * passage qui les corrige. Comme les points clés, il n'affiche jamais l'énoncé ni les choix QCM.
 *
 * @param {any} axis
 * @param {Set<string>} expandedIds
 * @returns {string}
 */
function buildTrapsBlockHtml(axis, expandedIds) {
    const items = Array.isArray(axis.traps?.items) ? axis.traps.items : [];
    if (items.length === 0) return '';

    const expanded = expandedIds instanceof Set && expandedIds.has(`traps:${axis.id}`);
    const urgent = items.filter((i) => i.status !== 'overcome');
    const shown = expanded ? items : urgent.slice(0, TRAPS_VISIBLE);
    const hasMore = items.length > urgent.slice(0, TRAPS_VISIBLE).length;

    const itemsHtml = shown
        .map((item) => {
            const meta = TRAP_STATUS_META[item.status] || TRAP_STATUS_META.active;
            const relapse = item.relapse
                ? `<span style="background:rgba(248,113,113,0.14); color:#ef4444; padding:2px 8px; border-radius:999px; font-size:0.72rem; font-weight:700;">${tq('axes.trapRelapse')}</span>`
                : '';
            const picked = item.count === 1 ? tq('axes.trapPickedOne') : tq('axes.trapPicked', { count: item.count });
            const courseLink =
                item.courseUrl && item.courseTitle && item.coursePage
                    ? `<a href="${escapeHTML(item.courseUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-flex; align-items:center; gap:4px; font-size:0.76rem; font-weight:700; color:var(--accent-orange); text-decoration:none;"><i class="ri-file-pdf-line"></i> ${tq('axes.takeawayCourseLink', { title: item.courseTitle, page: item.coursePage })}</a>`
                    : '';
            return `
                <div class="revision-axis-trap-item" data-trap-status="${escapeHTML(item.status)}" style="padding:12px 14px; border-radius:10px; background:var(--bg-card); border:1px solid var(--border-color); border-left:3px solid ${meta.color};">
                    <div style="display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:8px; margin-bottom:6px;">
                        <div style="display:flex; flex-wrap:wrap; align-items:center; gap:6px;">
                            <span style="background:${meta.bg}; color:${meta.color}; padding:2px 8px; border-radius:999px; font-size:0.74rem; font-weight:700;">${tq(meta.key)}</span>
                            ${relapse}
                            <span style="font-size:0.76rem; color:var(--text-secondary); font-weight:600;">${picked} · ${tq('axes.trapQuestionRef', { num: item.questionNum })}</span>
                        </div>
                        ${courseLink}
                    </div>
                    <div style="font-size:0.88rem; color:var(--text-main); line-height:1.5;">${explanationHtml(item.explanation)}</div>
                </div>
            `;
        })
        .join('');

    const toggle = hasMore
        ? `<button type="button" data-action="QuiztoggleAxisTakeaways" data-args="traps:${escapeHTML(axis.id)}" aria-expanded="${expanded ? 'true' : 'false'}" style="align-self:flex-start; background:rgba(248,113,113,0.1); color:#ef4444; border:1px solid rgba(248,113,113,0.35); padding:6px 12px; border-radius:10px; font-size:0.8rem; font-weight:700; cursor:pointer;">${expanded ? tq('axes.trapsHideAll') : showAllLabel('traps', items)}</button>`
        : '';

    return `
        <div class="revision-axis-step revision-axis-traps" style="padding:14px 16px; border-radius:12px; background:rgba(248,113,113,0.05); border:1px solid rgba(248,113,113,0.3); display:flex; flex-direction:column; gap:10px;">
            <div style="display:flex; align-items:center; gap:8px; font-weight:700; font-size:0.88rem; color:var(--text-main);">
                <i class="ri-alert-line" style="color:#ef4444;"></i>
                <span>${tq('axes.trapsHeading')}</span>
            </div>
            <div style="font-size:0.8rem; color:var(--text-secondary); line-height:1.45;">${tq('axes.trapsHint')}</div>
            ${itemsHtml}
            ${toggle}
        </div>
    `;
}

/**
 * Construit le bloc « Mes oublis sur ce chapitre » : les bonnes réponses oubliées (non cochées), avec le
 * passage qui les explique. Comme les points clés et les pièges, il n'affiche jamais l'énoncé ni les choix QCM.
 *
 * @param {any} axis
 * @param {Set<string>} expandedIds
 * @returns {string}
 */
function buildOmissionsBlockHtml(axis, expandedIds) {
    const items = Array.isArray(axis.omissions?.items) ? axis.omissions.items : [];
    if (items.length === 0) return '';

    const expanded = expandedIds instanceof Set && expandedIds.has(`omissions:${axis.id}`);
    const urgent = items.filter((i) => i.status !== 'overcome');
    const shown = expanded ? items : urgent.slice(0, TRAPS_VISIBLE);
    const hasMore = items.length > urgent.slice(0, TRAPS_VISIBLE).length;

    const itemsHtml = shown
        .map((item) => {
            const meta = TRAP_STATUS_META[item.status] || TRAP_STATUS_META.active;
            const relapse = item.relapse
                ? `<span style="background:rgba(249,115,22,0.14); color:#ea580c; padding:2px 8px; border-radius:999px; font-size:0.72rem; font-weight:700;">${tq('axes.trapRelapse')}</span>`
                : '';
            const missed =
                item.count === 1 ? tq('axes.omissionMissedOne') : tq('axes.omissionMissed', { count: item.count });
            const courseLink =
                item.courseUrl && item.courseTitle && item.coursePage
                    ? `<a href="${escapeHTML(item.courseUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-flex; align-items:center; gap:4px; font-size:0.76rem; font-weight:700; color:var(--accent-orange); text-decoration:none;"><i class="ri-file-pdf-line"></i> ${tq('axes.takeawayCourseLink', { title: item.courseTitle, page: item.coursePage })}</a>`
                    : '';
            return `
                <div class="revision-axis-omission-item" data-omission-status="${escapeHTML(item.status)}" style="padding:12px 14px; border-radius:10px; background:var(--bg-card); border:1px solid var(--border-color); border-left:3px solid #f97316;">
                    <div style="display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:8px; margin-bottom:6px;">
                        <div style="display:flex; flex-wrap:wrap; align-items:center; gap:6px;">
                            <span style="background:${meta.bg}; color:${meta.color}; padding:2px 8px; border-radius:999px; font-size:0.74rem; font-weight:700;">${tq(meta.key)}</span>
                            ${relapse}
                            <span style="font-size:0.76rem; color:var(--accent-orange); font-weight:700;"><i class="ri-error-warning-fill" style="margin-right:2px;"></i>${missed}</span>
                            <span style="font-size:0.76rem; color:var(--text-secondary); font-weight:600;">· ${tq('axes.trapQuestionRef', { num: item.questionNum })}</span>
                        </div>
                        ${courseLink}
                    </div>
                    <div style="font-size:0.88rem; color:var(--text-main); line-height:1.5;">${explanationHtml(item.explanation)}</div>
                </div>
            `;
        })
        .join('');

    const toggle = hasMore
        ? `<button type="button" data-action="QuiztoggleAxisTakeaways" data-args="omissions:${escapeHTML(axis.id)}" aria-expanded="${expanded ? 'true' : 'false'}" style="align-self:flex-start; background:rgba(251,146,60,0.1); color:#ea580c; border:1px solid rgba(251,146,60,0.35); padding:6px 12px; border-radius:10px; font-size:0.8rem; font-weight:700; cursor:pointer;">${expanded ? tq('axes.omissionsHideAll') : showAllLabel('omissions', items)}</button>`
        : '';

    return `
        <div class="revision-axis-step revision-axis-omissions" style="padding:14px 16px; border-radius:12px; background:rgba(251,146,60,0.05); border:1px solid rgba(251,146,60,0.3); display:flex; flex-direction:column; gap:10px;">
            <div style="display:flex; align-items:center; gap:8px; font-weight:700; font-size:0.88rem; color:var(--text-main);">
                <i class="ri-error-warning-line" style="color:var(--accent-orange);"></i>
                <span>${tq('axes.omissionsHeading')}</span>
            </div>
            <div style="font-size:0.8rem; color:var(--text-secondary); line-height:1.45;">${tq('axes.omissionsHint')}</div>
            ${itemsHtml}
            ${toggle}
        </div>
    `;
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
        .map((reading, index) => {
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
                // Les cours sont triés par nombre d'erreurs couvertes : seul le premier est mis en avant.
                index === 0 && reading.focusHitCount > 0
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
function buildStep3WorkshopHtml(axis, stepNumber) {
    const btnLabel =
        axis.workshopSize === 1 ? tq('axes.workshopBtnOne') : tq('axes.workshopBtnMany', { count: axis.workshopSize });

    return `
        <div class="revision-axis-step" style="display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px; padding:14px 16px; border-radius:12px; background:rgba(14,165,233,0.06); border:1px solid rgba(14,165,233,0.22);">
            <div style="flex:1 1 240px;">
                <div style="display:flex; align-items:center; gap:8px; font-weight:700; font-size:0.88rem; color:var(--text-main); margin-bottom:2px;">
                    <i class="ri-focus-2-line" style="color:var(--accent-orange);"></i>
                    <span>${tq('axes.step3Heading', { n: stepNumber })}</span>
                </div>
                <div style="font-size:0.8rem; color:var(--text-secondary); line-height:1.4;">
                    ${tq('axes.step3Hint')}${axis.traps?.active > 0 || axis.omissions?.active > 0 ? ` ${tq('axes.workshopTrapsHint')}` : ''}
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
    const isOpen = expandedIds instanceof Set && expandedIds.has(`card:${axis.id}`);
    const statusLabel = tq(`axes.statusLabels.${axis.status}`);
    const barColor =
        axis.masteryPct >= 85
            ? '#22c55e'
            : axis.masteryPct >= 50
              ? '#f59e0b'
              : axis.attemptedCount > 0
                ? '#ef4444'
                : '#38bdf8';

    const reasonText = buildReasonText(axis);
    const understandHtml = [
        buildTrapsBlockHtml(axis, expandedIds),
        buildOmissionsBlockHtml(axis, expandedIds),
        buildStep2TakeawaysHtml(axis, isExpanded),
    ].join('');
    const hasUnderstandStep = understandHtml.trim() !== '';
    const understandStepHtml = hasUnderstandStep
        ? `<section class="revision-axis-understand" style="display:flex; flex-direction:column; gap:10px;">
                <div style="display:flex; align-items:center; gap:8px; font-weight:800; font-size:0.92rem; color:var(--text-main);">
                    <i class="ri-lightbulb-line" style="color:#f59e0b;"></i>
                    <span>${tq('axes.stepUnderstandHeading')}</span>
                </div>
                ${understandHtml}
            </section>`
        : '';

    return `
        <article class="revision-axis-card" data-axis-id="${escapeHTML(axis.id)}" data-axis-status="${escapeHTML(axis.status)}" data-open="${isOpen ? 'true' : 'false'}" style="background:var(--bg-card); border:1px solid var(--border-color); border-left:4px solid ${theme.color}; border-radius:var(--radius-md); padding:16px 20px; display:flex; flex-direction:column; gap:14px; box-shadow:0 4px 12px rgba(0,0,0,0.04);">
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

                <div style="display:flex; flex-wrap:wrap; align-items:flex-start; justify-content:space-between; gap:10px;">
                    <div style="flex:1 1 280px;">
                        <h3 style="margin:0 0 4px 0; font-size:1.08rem; font-weight:800; color:var(--text-main);">
                            ${escapeHTML(axis.title)}
                        </h3>
                        <p style="margin:0; font-size:0.85rem; color:var(--text-secondary); line-height:1.45;">
                            ${escapeHTML(axis.subtitle)}
                        </p>
                    </div>
                    <button type="button" class="revision-axis-card-toggle" data-action="QuiztoggleAxisTakeaways" data-args="card:${escapeHTML(axis.id)}" aria-expanded="${isOpen ? 'true' : 'false'}" style="background:var(--accent-orange); color:#fff; border:none; padding:8px 14px; border-radius:10px; font-size:0.84rem; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:6px; white-space:nowrap;">
                        <span>${isOpen ? tq('axes.cardClose') : tq('axes.cardOpen')}</span>
                        <i class="${isOpen ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'}"></i>
                    </button>
                </div>

                <div style="display:flex; flex-direction:column; gap:8px;">
                    <div style="height:6px; width:100%; background:rgba(148,163,184,0.16); border-radius:999px; overflow:hidden;">
                        <div style="height:100%; width:${axis.masteryPct}%; background:${barColor}; border-radius:999px; transition:width 0.3s;"></div>
                    </div>
                    <div style="display:flex; flex-wrap:wrap; gap:6px;">
                        ${buildAxisBreakdownPillsHtml(axis)}
                    </div>
                    ${reasonText ? `<div class="revision-axis-reason" style="font-size:0.82rem; color:var(--text-secondary); line-height:1.4;">${reasonText}</div>` : ''}
                </div>
            </header>

            <div class="revision-axis-card-body" ${isOpen ? '' : 'hidden'} style="display:${isOpen ? 'flex' : 'none'}; flex-direction:column; gap:14px;">
                ${buildStep1CoursesHtml(axis)}
                ${understandStepHtml}
                ${buildStep3WorkshopHtml(axis, hasUnderstandStep ? 3 : 2)}
            </div>
        </article>
    `;
}

/**
 * Phrase « Pourquoi Priorité N : … » : les compteurs qui ont placé le chapitre dans sa priorité.
 * Elle suit les règles de `buildRevisionAxes` (services/revision_axes.js).
 *
 * @param {any} axis
 * @returns {string}
 */
function buildReasonText(axis) {
    const plural = (count, one, many) => (count === 1 ? tq(one) : tq(many, { count }));
    /** @type {string[]} */
    const reasons = [];
    const traps = axis.traps || {};
    const omissions = axis.omissions || {};
    let priorityKey = '';
    if (axis.status === 'BLOCKER') {
        priorityKey = 'axes.reasonPriority1';
        if (axis.strugglingCount > 0)
            reasons.push(plural(axis.strugglingCount, 'axes.pillStrugglingOne', 'axes.pillStrugglingMany'));
        if (axis.hesitantCount > 0)
            reasons.push(plural(axis.hesitantCount, 'axes.pillHesitantOne', 'axes.pillHesitantMany'));
        if (traps.active > 0) reasons.push(plural(traps.active, 'axes.pillTrapsActiveOne', 'axes.pillTrapsActiveMany'));
        if (omissions.active > 0)
            reasons.push(plural(omissions.active, 'axes.pillOmissionsActiveOne', 'axes.pillOmissionsActiveMany'));
    } else if (axis.status === 'REFRESH') {
        priorityKey = 'axes.reasonPriority2';
        if (axis.dueCount > 0) reasons.push(plural(axis.dueCount, 'axes.pillDueOne', 'axes.pillDueMany'));
        if (traps.consolidating > 0)
            reasons.push(
                plural(traps.consolidating, 'axes.pillTrapsConsolidatingOne', 'axes.pillTrapsConsolidatingMany'),
            );
        if (omissions.consolidating > 0)
            reasons.push(
                plural(
                    omissions.consolidating,
                    'axes.pillOmissionsConsolidatingOne',
                    'axes.pillOmissionsConsolidatingMany',
                ),
            );
    } else if (axis.status === 'EXPLORE') {
        priorityKey = 'axes.reasonPriority3';
        if (axis.unattemptedCount > 0)
            reasons.push(plural(axis.unattemptedCount, 'axes.pillUnattemptedOne', 'axes.pillUnattemptedMany'));
    }
    if (!priorityKey || reasons.length === 0) return '';
    return tqh('axes.reasonPrefix', { priority: tq(priorityKey), reasons: reasons.join(tq('axes.reasonJoin')) });
}

/**
 * Construit le tableau de bord complet de l'écran « Axes de révision ».
 *
 * @param {{ level: string, axes: any[], counts: Record<string, number>, trapTotals?: { active: number, consolidating: number, overcome: number, axes: number }, omissionTotals?: { active: number, consolidating: number, overcome: number, axes: number } }} report
 * @param {{ statusFilter?: string, expandedIds?: Set<string> }} [uiState]
 * @returns {string}
 */
export function buildRevisionAxesDashboardHtml(report, uiState = {}) {
    const activeFilter = !uiState.statusFilter || uiState.statusFilter === 'MASTERED' ? 'ALL' : uiState.statusFilter;
    const expandedIds = uiState.expandedIds instanceof Set ? uiState.expandedIds : new Set();

    // Les chapitres déjà maîtrisés n'ont plus besoin d'apparaître dans les axes de révision.
    const revisionAxes = report.axes.filter((axis) => axis.status !== 'MASTERED');

    // Deux familles de filtres, qui comptent toutes deux des chapitres : les priorités se partagent les
    // chapitres, les filtres d'erreurs les recoupent. Un filtre vide ou qui retient tous les chapitres
    // n'apporte rien : il est masqué, sauf s'il est sélectionné.
    const hasActiveError = (axis) => (axis.traps?.active || 0) + (axis.omissions?.active || 0) > 0;
    const hasConsolidating = (axis) => (axis.traps?.consolidating || 0) + (axis.omissions?.consolidating || 0) > 0;
    const isUseful = (f) =>
        activeFilter === f.key || (f.count > 0 && (f.group === 'chapters' || f.count < revisionAxes.length));
    const filterGroups = [
        {
            labelKey: 'axes.filterGroupChapters',
            filters: [
                { key: 'ALL', count: revisionAxes.length, labelKey: 'axes.filterAll', group: 'all' },
                {
                    key: 'BLOCKER',
                    count: report.counts.BLOCKER || 0,
                    labelKey: 'axes.filterBlocker',
                    group: 'chapters',
                },
                {
                    key: 'REFRESH',
                    count: report.counts.REFRESH || 0,
                    labelKey: 'axes.filterRefresh',
                    group: 'chapters',
                },
                {
                    key: 'EXPLORE',
                    count: report.counts.EXPLORE || 0,
                    labelKey: 'axes.filterExplore',
                    group: 'chapters',
                },
            ].filter((f) => f.key === 'ALL' || isUseful(f)),
        },
        {
            labelKey: 'axes.filterGroupErrors',
            filters: [
                {
                    key: 'TRAPS',
                    count: revisionAxes.filter(hasActiveError).length,
                    labelKey: 'axes.filterTraps',
                    group: 'errors',
                },
                {
                    key: 'CONSOLIDATING',
                    count: revisionAxes.filter(hasConsolidating).length,
                    labelKey: 'axes.filterConsolidating',
                    group: 'errors',
                },
            ].filter(isUseful),
        },
    ].filter((g) => g.filters.length > 0);

    const filterButton = (f) => {
        const isActive = f.key === activeFilter;
        const style = isActive
            ? 'background:var(--accent-orange); color:#fff; border:1px solid var(--accent-orange);'
            : 'background:var(--bg-card); color:var(--text-secondary); border:1px solid var(--border-color);';
        return `
                <button type="button" data-action="QuizsetAxesFilter" data-args="${f.key}" aria-pressed="${isActive ? 'true' : 'false'}" style="${style} padding:8px 14px; border-radius:999px; font-size:0.82rem; font-weight:700; cursor:pointer; transition:all 0.2s;">
                    ${tq(f.labelKey, { count: f.count })}
                </button>
            `;
    };
    const filtersHtml = filterGroups
        .map(
            (g) => `
            <div class="revision-axes-filter-group" role="group" aria-label="${tq(g.labelKey)}" style="display:flex; flex-wrap:wrap; align-items:center; gap:8px;">
                <span style="font-size:0.78rem; font-weight:800; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.04em; min-width:170px;">${tq(g.labelKey)}</span>
                ${g.filters.map(filterButton).join('')}
            </div>`,
        )
        .join('');

    const visibleAxes =
        activeFilter === 'ALL'
            ? revisionAxes
            : activeFilter === 'TRAPS'
              ? revisionAxes.filter(hasActiveError)
              : activeFilter === 'CONSOLIDATING'
                ? revisionAxes.filter(hasConsolidating)
                : revisionAxes.filter((axis) => axis.status === activeFilter);

    // Chapitres maîtrisés : masqués, mais signalés pour que leur absence ne surprenne pas.
    const masteredAxes = report.axes.filter((axis) => axis.status === 'MASTERED');
    const masteredHtml =
        masteredAxes.length > 0
            ? `<div class="revision-axes-mastered-hidden" style="font-size:0.82rem; color:var(--text-secondary); display:flex; align-items:center; gap:6px;"><i class="ri-checkbox-circle-line" style="color:#22c55e;"></i> ${
                  masteredAxes.length === 1
                      ? tq('axes.masteredHiddenOne', { titles: masteredAxes[0].title })
                      : tq('axes.masteredHiddenMany', {
                            count: masteredAxes.length,
                            titles: masteredAxes.map((a) => a.title).join(', '),
                        })
              }</div>`
            : '';

    const guideOpen = expandedIds.has('guide');
    const guideHtml = `
        <div class="revision-axes-guide" style="display:flex; flex-direction:column; gap:8px;">
            <button type="button" data-action="QuiztoggleAxisTakeaways" data-args="guide" aria-expanded="${guideOpen ? 'true' : 'false'}" style="align-self:flex-start; background:none; border:none; padding:0; color:var(--accent-orange); font-size:0.84rem; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:6px;">
                <i class="ri-question-line"></i> ${guideOpen ? tq('axes.guideHideBtn') : tq('axes.guideBtn')}
            </button>
            ${
                guideOpen
                    ? `<ul class="revision-axes-guide-list" style="margin:0; padding-left:18px; display:flex; flex-direction:column; gap:6px; font-size:0.82rem; color:var(--text-secondary); line-height:1.45;">
                    <li>${tq('axes.guidePriorities')}</li>
                    <li>${tq('axes.guideQuestions')}</li>
                    <li>${tq('axes.guideErrors')}</li>
                    <li>${tq('axes.guideCounts')}</li>
                </ul>`
                    : ''
            }
        </div>`;

    // Atelier transversal : proposé tant qu'il reste un piège ou un oubli à corriger ou en consolidation.
    const openTraps = (report.trapTotals?.active || 0) + (report.trapTotals?.consolidating || 0);
    const openOmissions = (report.omissionTotals?.active || 0) + (report.omissionTotals?.consolidating || 0);
    const workshopParts = [
        openTraps > 0
            ? tq(openTraps === 1 ? 'axes.workshopTrapsOne' : 'axes.workshopTrapsMany', { count: openTraps })
            : '',
        openOmissions > 0
            ? tq(openOmissions === 1 ? 'axes.workshopOmissionsOne' : 'axes.workshopOmissionsMany', {
                  count: openOmissions,
              })
            : '',
    ].filter(Boolean);
    const errorChapters = revisionAxes.filter((axis) => hasActiveError(axis) || hasConsolidating(axis)).length;
    const workshopItems = workshopParts.join(tq('axes.workshopPartsJoin'));
    const workshopTitle =
        errorChapters > 0
            ? tq('axes.trapsWorkshopTitleChapters', {
                  items: workshopItems,
                  chapters:
                      errorChapters === 1
                          ? tq('axes.workshopChaptersOne')
                          : tq('axes.workshopChaptersMany', { count: errorChapters }),
              })
            : tq('axes.trapsWorkshopTitle', { items: workshopItems });
    const trapsCtaHtml =
        workshopParts.length > 0
            ? `<div class="revision-axes-traps-cta" style="display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px; padding:16px 20px; border-radius:var(--radius-md); background:rgba(248,113,113,0.08); border:1px solid rgba(248,113,113,0.35);">
                    <div style="flex:1 1 260px;">
                        <div style="font-weight:800; font-size:0.95rem; color:var(--text-main); margin-bottom:2px; display:flex; align-items:center; gap:8px;"><i class="ri-alert-line" style="color:#ef4444;"></i> ${workshopTitle}</div>
                        <div style="font-size:0.82rem; color:var(--text-secondary); line-height:1.4;">${tq('axes.trapsWorkshopText')}</div>
                    </div>
                    <button type="button" data-action="QuizstartTrapsWorkshop" style="background:#ef4444; color:#fff; border:none; padding:10px 18px; border-radius:10px; font-weight:700; font-size:0.86rem; cursor:pointer; display:inline-flex; align-items:center; gap:8px; white-space:nowrap;"><i class="ri-focus-2-line"></i> ${tq('axes.trapsWorkshopBtn')} <i class="ri-arrow-right-line"></i></button>
                </div>`
            : '';

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
                <div style="margin-top:14px;">${guideHtml}</div>
            </div>

            ${trapsCtaHtml}

            <div class="revision-axes-filters" style="display:flex; flex-direction:column; gap:10px;">
                ${filtersHtml}
            </div>

            <div class="revision-axes-list" style="display:flex; flex-direction:column; gap:16px;">
                ${cardsHtml}
            </div>

            ${masteredHtml}
        </div>
    `;
}
