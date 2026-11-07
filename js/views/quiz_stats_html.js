/**
 * PURE VIEW - QuizView, écran des statistiques : fabrication du HTML
 * Morceaux de QuizStatsBase.renderStats() : chaque fonction reçoit la vue (état des filtres et du tri,
 * getCourseUrl…) et les chiffres déjà calculés, et rend un fragment HTML. Aucun accès au DOM.
 */
import { escapeHTML } from '../core/security.js';
import { BREVET_CODES, OFFICIAL_THEORY_TOTAL_POINTS } from '../services/brevet_service.js';
import { masteryRatio } from '../services/mastery.js';
import { readAnswerLog } from '../services/answer_log.js';
import { toSorted } from '../utils/array_utils.js';
import { formatDateOnly, parseDateToMs } from '../utils/date_utils.js';
import { tq, tqh, tql } from './quiz_strings.js';
import { choiceCourseLinksHtml, courseLinksHtml } from './quiz_course_links.js';
import { explanationHtml, optionExplanationHtml, optionExplanations } from './quiz_explanation.js';

/**
 * Encart du statut officiel de l'examen théorique FFVL (affiché dans #qcm-setup-screen et #stats-screen).
 * @param {string} level
 * @param {any} entry
 * @param {string} [attrName]
 */
export function buildOfficialTheoryBannerHtml(level, entry, attrName = 'data-quiz-brevet-banner') {
    if (!BREVET_CODES.includes(level) || !entry) return '';
    const th = entry.theory || {};
    const pr = entry.practical || {};
    const isValidated = Boolean(th.passed || pr.validated);

    if (isValidated) {
        const rawDate = th.date || pr.date || '';
        const title = rawDate
            ? tq('officialTheory.validatedWithDate', { level, date: formatDateOnly(rawDate) })
            : tq('officialTheory.validatedBadge', { level });
        let score = th.score;
        let total = th.total;
        const pct =
            th.percentage ?? (score !== null && total !== null && total > 0 ? Math.round((score / total) * 100) : null);

        if (
            (score === null || total === null || typeof score === 'undefined' || typeof total === 'undefined') &&
            pct !== null &&
            OFFICIAL_THEORY_TOTAL_POINTS[level]
        ) {
            total = OFFICIAL_THEORY_TOTAL_POINTS[level];
            score = Math.round((pct / 100) * total);
        }

        const scorePart =
            score !== null && total !== null && typeof score !== 'undefined' && typeof total !== 'undefined'
                ? tq('officialTheory.scoreBadge', { score, total, pct: pct ?? 0 })
                : pct !== null
                  ? tq('officialTheory.pctBadge', { pct })
                  : '';
        const hintHtml =
            attrName === 'data-quiz-brevet-banner'
                ? `<div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px;">${tq('officialTheory.revisionHint')}</div>`
                : '';

        if (attrName === 'data-stats-brevet-banner') {
            return `
                <div ${attrName} style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.35); border-radius: 14px; padding: 8px 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;">
                    <div style="font-weight: 700; color: #10b981; font-size: 0.78rem; display: flex; align-items: center; gap: 5px; flex-wrap: wrap;">
                        <i class="ri-medal-fill"></i> <span>${title}</span>
                        ${scorePart ? `<span style="color: var(--text-main); font-weight: 600;">${scorePart}</span>` : ''}
                    </div>
                    <button type="button" data-action="openBrevetModal" data-args="${escapeHTML(level)}" style="background: transparent; border: 1px solid rgba(16, 185, 129, 0.5); color: #10b981; padding: 4px 8px; border-radius: 8px; cursor: pointer; font-size: 0.75rem; font-weight: 600;">
                        <i class="ri-edit-line"></i> ${tq('officialTheory.editBtn')}
                    </button>
                </div>`;
        }

        return `
            <div ${attrName} style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.35); border-radius: 14px; padding: 12px 16px; margin-bottom: 18px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
                <div>
                    <div style="font-weight: 700; color: #10b981; font-size: 0.92rem; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                        <i class="ri-medal-fill"></i> <span>${title}</span>
                        ${scorePart ? `<span style="color: var(--text-main); font-weight: 600;">${scorePart}</span>` : ''}
                    </div>
                    ${hintHtml}
                </div>
                <button type="button" data-action="openBrevetModal" data-args="${escapeHTML(level)}" style="background: transparent; border: 1px solid rgba(16, 185, 129, 0.5); color: #10b981; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 0.8rem; font-weight: 600;">
                    <i class="ri-edit-line"></i> ${tq('officialTheory.editBtn')}
                </button>
            </div>`;
    }

    if (attrName === 'data-stats-brevet-banner') {
        return `
            <div ${attrName} style="display: flex; justify-content: center;">
                <button type="button" data-action="openBrevetModal" data-args="${escapeHTML(level)}" style="width: 100%; justify-content: center; background: rgba(14, 165, 233, 0.12); border: 1px solid rgba(14, 165, 233, 0.35); color: #0ea5e9; padding: 10px 16px; border-radius: 14px; cursor: pointer; font-size: 0.84rem; font-weight: 600; display: inline-flex; align-items: center; gap: 8px;">
                    <i class="ri-checkbox-circle-line"></i> ${tq('officialTheory.recordBtn')}
                </button>
            </div>`;
    }

    return `
        <div ${attrName} style="background: rgba(14, 165, 233, 0.07); border: 1px solid rgba(14, 165, 233, 0.25); border-radius: 14px; padding: 10px 16px; margin-bottom: 18px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
            <span style="font-size: 0.86rem; color: var(--text-secondary);"><i class="ri-award-line" style="color: #0ea5e9;"></i> ${tq('officialTheory.promptUnvalidated', { level })}</span>
            <button type="button" data-action="openBrevetModal" data-args="${escapeHTML(level)}" style="background: rgba(14, 165, 233, 0.15); border: 1px solid rgba(14, 165, 233, 0.4); color: #0ea5e9; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 0.8rem; font-weight: 600;">
                <i class="ri-checkbox-circle-line"></i> ${tq('officialTheory.recordBtn')}
            </button>
        </div>`;
}

/** Cartes de répartition des questions par niveau de maîtrise (filtre au clic). */
export function buildDistributionHtml(
    view,
    { perfect, excellent, veryGood, good, poor, failed, notAttempted, totalLevelQuestions },
) {
    const currentFilter = view.state.masteryFilter || 'ALL';
    const getCardStyle = (baseColor, filterType) => {
        const isActive = currentFilter === filterType;
        const bgOpacity = isActive ? 0.15 : 0.03;
        const borderOpacity = isActive ? 0.6 : 0.1;
        // Remove scale, use shadow/border for "pop"
        const shadow = isActive ? `box-shadow: 0 0 20px rgba(${baseColor}, 0.2);` : '';
        return `background:rgba(${baseColor}, ${bgOpacity}); border:1px solid rgba(${baseColor}, ${borderOpacity}); padding:20px 12px; border-radius:20px; text-align:center; cursor:pointer; transition:all 0.2s; flex:1 1 120px; ${shadow}`;
    };

    // Colors in RGB for helper
    const cGreen = '74, 222, 128';
    const cYellow = '250, 204, 21';
    const cOrange = '251, 146, 60';
    const cRed = '248, 113, 113';
    const cGray = document.body.classList.contains('light-mode') ? '100, 116, 139' : '255, 255, 255';

    const cards = [
        {
            filter: 'PERFECT',
            count: perfect,
            rgb: cGreen,
            color: '#4ade80',
            label: tq('stats.mastery.perfect'),
            sub: '(100%)',
        },
        {
            filter: 'EXCELLENT',
            count: excellent,
            rgb: '134, 239, 172',
            color: '#86efac',
            label: tq('stats.mastery.excellent'),
            sub: '(90-99%)',
        },
        {
            filter: 'VERY_GOOD',
            count: veryGood,
            rgb: '56, 189, 248',
            color: '#38bdf8',
            label: tq('stats.mastery.veryGood'),
            sub: '(75-89%)',
        },
        {
            filter: 'GOOD',
            count: good,
            rgb: cYellow,
            color: '#facc15',
            label: tq('stats.mastery.good'),
            sub: '(50-74%)',
        },
        {
            filter: 'POOR',
            count: poor,
            rgb: cOrange,
            color: '#fb923c',
            label: tq('stats.mastery.poor'),
            sub: '(1-49%)',
        },
        {
            filter: 'FAILED',
            count: failed,
            rgb: cRed,
            color: '#f87171',
            label: tq('stats.mastery.failed'),
            sub: '(0%)',
        },
        {
            filter: 'NOT_ATTEMPTED',
            count: notAttempted,
            rgb: cGray,
            color: 'var(--text-muted)',
            label: tq('stats.mastery.notAttempted'),
            sub: tq('stats.outOf', { total: totalLevelQuestions }),
        },
    ];

    const visibleCards = cards.some((c) => c.count > 0)
        ? cards.filter((c) => c.count > 0 || currentFilter === c.filter)
        : cards;

    const distributionHtml = `
            <div style="display:flex; flex-wrap:wrap; justify-content:center; gap:16px;">
                ${visibleCards
                    .map(
                        (c) => `
                <div role="button" tabindex="0" data-action="QuizsetMasteryFilter" data-args="['${c.filter}']" style="${getCardStyle(c.rgb, c.filter)}">
                    <div style="font-size:2rem; font-weight:900; color:${c.color};">${c.count}</div>
                    <div style="font-size:0.75rem; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; opacity:0.6; margin-top:8px;">${c.label}</div>
                    <div style="font-size:0.65rem; opacity:0.4;">${c.sub}</div>
                </div>`,
                    )
                    .join('')}
            </div>
        `;

    return distributionHtml;
}

/** Cartes par thème et boutons de tri. */
export function buildThemesHtml(view, levelThemes) {
    let themesHtml = '';

    // Sort Themes immutably
    const sortedThemes = toSorted(Object.entries(levelThemes), (a, b) => {
        let valA, valB;

        if (view.state.themeSort === 'rate') {
            valA = a[1].totalQuestions > 0 ? a[1].mastery / a[1].totalQuestions : 0;
            valB = b[1].totalQuestions > 0 ? b[1].mastery / b[1].totalQuestions : 0;
        } else {
            valA = a[0];
            valB = b[0];
        }

        if (valA < valB) return view.state.themeSortDir === 'asc' ? -1 : 1;
        if (valA > valB) return view.state.themeSortDir === 'asc' ? 1 : -1;
        return 0;
    });

    // Sort Controls HTML — rendered separately above the grid
    const getSortIcon = (type) => {
        if (view.state.themeSort !== type) return '';
        return view.state.themeSortDir === 'asc'
            ? '<i class="ri-arrow-up-s-line"></i>'
            : '<i class="ri-arrow-down-s-line"></i>';
    };

    const sortBtnStyle = (type) => {
        const isActive = view.state.themeSort === type;
        return `flex:1; background:${isActive ? 'var(--bg-main)' : 'transparent'}; color:${isActive ? 'var(--text-main)' : 'var(--text-muted)'}; border:none; padding:6px 14px; border-radius:8px; cursor:pointer; font-size:0.8rem; font-weight:${isActive ? '700' : '500'}; display:flex; align-items:center; justify-content:center; gap:5px; transition:all 0.2s; box-shadow:${isActive ? '0 1px 4px rgba(0,0,0,0.18)' : 'none'};`;
    };

    const sortControlsHtml = `
                <div style="display:flex; align-items:center; justify-content:flex-end; margin-bottom:16px;">
                    <div style="display:flex; background:var(--bg-card); border:1px solid var(--border-color); border-radius:10px; padding:3px; gap:2px;">
                        <button data-action="QuizsetThemeSort" data-args="['alpha']" style="${sortBtnStyle('alpha')}">
                            ${getSortIcon('alpha')} ${tq('stats.sortAlpha')}
                        </button>
                        <button data-action="QuizsetThemeSort" data-args="['rate']" style="${sortBtnStyle('rate')}">
                            ${getSortIcon('rate')} ${tq('stats.sortRate')}
                        </button>
                    </div>
                </div>
            `;

    sortedThemes.forEach(([name, data]) => {
        // totalQ = all questions in this theme for the current level (attempted or not)
        const totalQ = data.totalQuestions || 0;
        const attemptedUnique = data.attemptedCount || 0;
        const notAttemptedQ = totalQ - attemptedUnique;

        // pct = sum of per-question mastery ratios / totalQ
        // This is identical to the global gauge formula and always stays 0–100%
        const pct = totalQ > 0 ? Math.round((data.mastery / totalQ) * 100) : 0;

        const tColor =
            pct >= 90
                ? '#4ade80'
                : pct >= 75
                  ? '#38bdf8'
                  : pct >= 50
                    ? '#facc15'
                    : totalQ === 0
                      ? 'var(--text-muted)'
                      : '#f87171';
        const tColorRgb =
            pct >= 90
                ? '74,222,128'
                : pct >= 75
                  ? '56,189,248'
                  : pct >= 50
                    ? '250,204,21'
                    : totalQ === 0
                      ? '150,150,150'
                      : '248,113,113';

        // Active state
        const isActive = view.state.themeFilter === name;
        const cardBorder = isActive
            ? `border:2px solid ${tColor}; box-shadow:0 0 20px -4px rgba(${tColorRgb},0.4);`
            : `border:1px solid var(--border-color);`;
        const cardBg = isActive ? `background:rgba(${tColorRgb},0.08);` : `background:var(--bg-card);`;

        // Progress bar width
        const barWidth = totalQ > 0 ? pct : 0;

        themesHtml += `
                <div role="button" tabindex="0" class="theme-card" data-action="QuizsetThemeFilter" data-args="['${name}']" style="cursor:pointer; padding:14px 14px; border-radius:16px; ${cardBorder} ${cardBg} color:var(--text-main); transition:all 0.25s ease; position:relative; overflow:hidden; text-align:center;">
                    <!-- Subtle background glow for active -->
                    ${isActive ? `<div style="position:absolute;inset:0;background:radial-gradient(ellipse at top left, rgba(${tColorRgb},0.08) 0%, transparent 70%);pointer-events:none;"></div>` : ''}

                    <!-- Theme name — full width, wraps freely -->
                    <div class="theme-card-name" style="font-weight:700; font-size:0.86rem; line-height:1.25; letter-spacing:0.01em; margin-bottom:6px;">${name}</div>

                    <!-- Percentage below theme name -->
                    <div style="color:${tColor}; font-weight:900; font-size:1.45rem; line-height:1.1; letter-spacing:-0.5px; margin-bottom:8px;">
                        ${totalQ === 0 ? '—' : pct + '%'}
                    </div>

                    <!-- Progress bar -->
                    <div style="height:5px; background:rgba(255,255,255,0.08); border-radius:99px; overflow:hidden; margin-bottom:8px;">
                        <div style="height:100%; width:${barWidth}%; background:${tColor}; border-radius:99px; transition:width 0.6s cubic-bezier(0.34,1.56,0.64,1); box-shadow:0 0 8px ${tColor};"></div>
                    </div>

                    <!-- Footer: question count -->
                    <div style="font-size:0.68rem; opacity:0.55; display:flex; justify-content:center; align-items:center; gap:4px; flex-wrap:wrap;">
                        <span>${tq('stats.themeCount', { attempted: attemptedUnique, total: totalQ })}${notAttemptedQ > 0 ? ` <span style="opacity:0.7;">${tq(notAttemptedQ > 1 ? 'stats.themeNotAttemptedMany' : 'stats.themeNotAttemptedOne', { count: notAttemptedQ })}</span>` : ''}</span>
                        ${isActive ? `<span style="font-size:0.65rem; font-weight:700; opacity:0.8;">${tq('stats.removeFilter')}</span>` : ''}
                    </div>
                </div>
            `;
    });

    return { themesHtml, sortControlsHtml };
}

/**
 * Calcule l'horodatage (ms) du dernier passage d'une question, en combinant lastSeen,
 * le journal des réponses récentes et l'historique des examens.
 * @param {{ lastSeen?: number | string, answers?: any[] } | undefined} data
 * @param {string} [code]
 * @param {Map<string, number>} [examDateByCode]
 * @returns {number} 0 si la question n'a jamais été tentée
 */
export function getQuestionLastSeen(data, code, examDateByCode) {
    if (!data) return 0;
    let lastSeen = parseDateToMs(data.lastSeen);
    if (Array.isArray(data.answers) && data.answers.length > 0) {
        const log = readAnswerLog(data.answers);
        if (log.length > 0) {
            const lastEntry = log[log.length - 1];
            if (lastEntry && Number.isInteger(lastEntry[0])) {
                const answerMs = lastEntry[0] * 86400000;
                if (answerMs > lastSeen) {
                    lastSeen = answerMs;
                }
            }
        }
    }
    if (code && examDateByCode && examDateByCode.has(code)) {
        const examMs = examDateByCode.get(code);
        if (examMs > lastSeen) {
            lastSeen = examMs;
        }
    }
    return lastSeen;
}

/**
 * Compte combien de fois chaque question (par code) a été posée dans l'historique des examens.
 * @param {any[]} [examHistory]
 * @param {string | null} [currentLevel]
 * @returns {Map<string, number>}
 */
export function getQuestionExamCounts(examHistory = [], currentLevel = null) {
    const counts = new Map();
    if (!Array.isArray(examHistory)) return counts;
    for (const exam of examHistory) {
        if (!exam || !Array.isArray(exam.results)) continue;
        if (currentLevel && currentLevel !== 'ALL' && exam.level !== currentLevel) continue;
        for (const r of exam.results) {
            const rawCode =
                r?.code || r?.questionCode || (typeof r?.question === 'object' ? r.question.code : r?.question);
            const code = typeof rawCode === 'string' ? rawCode.trim() : '';
            if (code) {
                counts.set(code, (counts.get(code) || 0) + 1);
            }
        }
    }
    return counts;
}

/** Liste des questions du niveau, filtrée par maîtrise et par thème. */
export function buildQuestionsHtml(
    view,
    { levelQs, levelQuestionEntries, stats, examHistory = [], currentLevel = null },
) {
    // Build individual questions list (FILTERED BY LEVEL)
    let allQuestionsHtml = '';
    // Use levelQuestionEntries computed earlier to show only relevant questions

    const examDateByCode = new Map();
    const examCountByCode = getQuestionExamCounts(examHistory, currentLevel);
    const allowGlobalExamCount = !currentLevel || currentLevel === 'ALL';
    if (Array.isArray(examHistory)) {
        for (const exam of examHistory) {
            if (currentLevel && currentLevel !== 'ALL' && exam?.level !== currentLevel) continue;
            const examTime = parseDateToMs(exam?.date);
            if (examTime <= 0) continue;
            if (Array.isArray(exam.results)) {
                for (const r of exam.results) {
                    const code =
                        r?.code || r?.questionCode || (typeof r?.question === 'object' ? r.question.code : r?.question);
                    if (code && (!examDateByCode.has(code) || examDateByCode.get(code) < examTime)) {
                        examDateByCode.set(code, examTime);
                    }
                }
            }
        }
    }

    if (levelQuestionEntries.length > 0) {
        // --- FILTERING LOGIC ---
        let visibleQuestions = [];

        if (view.state.masteryFilter === 'ALL') {
            visibleQuestions = levelQuestionEntries;
        } else if (view.state.masteryFilter === 'NOT_ATTEMPTED') {
            // Determine unattempted questions
            // levelQs contains ALL valid questions for this level (excluding Delta)
            // stats.questions contains history
            levelQs.forEach((q) => {
                if (!stats.questions[q.code] || stats.questions[q.code].total === 0) {
                    // Create a mock "data" object for rendering
                    visibleQuestions.push([q.code, { total: 0, correct: 0 }]);
                }
            });
        } else {
            visibleQuestions = levelQuestionEntries.filter(([, data]) => {
                const pct = Math.round(masteryRatio(data) * 100);
                if (view.state.masteryFilter === 'PERFECT') return pct === 100;
                if (view.state.masteryFilter === 'EXCELLENT') return pct >= 90 && pct < 100;
                if (view.state.masteryFilter === 'VERY_GOOD') return pct >= 75 && pct < 90;
                if (view.state.masteryFilter === 'GOOD') return pct >= 50 && pct < 75;
                if (view.state.masteryFilter === 'POOR') return pct > 0 && pct < 50;
                if (view.state.masteryFilter === 'FAILED') return pct === 0;
                return true;
            });
        }

        const filterLabel = tq(`stats.filters.${view.state.masteryFilter}`);
        const hasActiveFilter = view.state.masteryFilter !== 'ALL' || Boolean(view.state.themeFilter);

        // Append theme filter label if active
        let displayLabel = view.state.masteryFilter !== 'ALL' ? filterLabel : '';
        if (view.state.themeFilter) {
            const themeSuffix = tq('stats.themeSuffix', { theme: view.state.themeFilter }); // inserted as HTML: escaped (spec 025)
            displayLabel = displayLabel ? displayLabel + themeSuffix : themeSuffix.replace(/^\s*•\s*/, '');
            // Filter sortedQuestions again by theme
            visibleQuestions = visibleQuestions.filter(([code]) => {
                const qObj = view.getQuestionByCode(code);

                let qTheme = qObj && qObj.theme ? qObj.theme : null;

                // If theme is missing but we have a code, try to derive it
                if (!qTheme && qObj && qObj.code) {
                    const letter = qObj.code.charAt(0);
                    const map = {
                        A: 'Météo',
                        E: 'Mécavol',
                        G: 'Mécavol',
                        H: 'Mécavol',
                        L: 'Matériel',
                        N: 'Matériel',
                        R: 'Matériel',
                        U: 'Pilotage',
                        W: 'Pilotage',
                        X: 'Pilotage',
                        S: 'Réglementation',
                        F: 'Facteurs humains',
                        P: 'Milieu naturel',
                    };
                    qTheme = map[letter] || 'Autre';
                }

                if (!qTheme) qTheme = 'Autre';
                return qTheme === view.state.themeFilter;
            });
        }

        const sortKey = view.state.questionSort || 'rate';
        const sortDir = view.state.questionSortDir || (sortKey === 'rate' ? 'asc' : 'desc');

        visibleQuestions = toSorted(visibleQuestions, (a, b) => {
            let valA, valB;
            if (sortKey === 'rate') {
                valA = Math.round(masteryRatio(a[1]) * 100);
                valB = Math.round(masteryRatio(b[1]) * 100);
            } else if (sortKey === 'streak') {
                valA = a[1].streak || 0;
                valB = b[1].streak || 0;
            } else if (sortKey === 'date') {
                valA = getQuestionLastSeen(a[1], a[0], examDateByCode);
                valB = getQuestionLastSeen(b[1], b[0], examDateByCode);

                if (valA === 0 && valB === 0) return 0;
                if (valA === 0) return 1;
                if (valB === 0) return -1;

                return sortDir === 'asc' ? valA - valB : valB - valA;
            } else if (sortKey === 'exams') {
                valA = examCountByCode.get(a[0]) ?? (allowGlobalExamCount ? Number(a[1]?.examCount) || 0 : 0);
                valB = examCountByCode.get(b[0]) ?? (allowGlobalExamCount ? Number(b[1]?.examCount) || 0 : 0);
            } else {
                valA = a[1].total || 0;
                valB = b[1].total || 0;
            }

            if (sortDir === 'asc') return valA - valB;
            return valB - valA;
        });

        allQuestionsHtml = `
                <div style="margin-bottom:16px; display:flex; justify-content:space-between; align-items:center;">
                    <div style="font-size:0.9rem; opacity:0.7;">
                        ${tqh('stats.questionCount', { count: `<span style="font-weight:700; color:var(--text-main);">${visibleQuestions.length}</span>` })}${hasActiveFilter ? ` <span style="opacity:0.6;">(${displayLabel})</span>` : ''}
                        ${hasActiveFilter ? `<a role="button" tabindex="0" data-action="QuizclearAllFilters" data-args="[]" style="margin-left:8px; cursor:pointer; text-decoration:underline; font-size:0.8rem; color:var(--accent-orange);">${tq('stats.clearFilters')}</a>` : ''}
                    </div>
                    <div class="stats-sort-container">
                        <div class="stats-sort-select-wrapper">
                            <select id="sort-questions-select" class="sort-select-btn" data-action="QuizsortQuestions" aria-label="${tq('stats.sortQuestionsLabel')}">
                                <option value="rate-asc"${sortKey === 'rate' && sortDir === 'asc' ? ' selected' : ''}>${tq('stats.sortRateAsc')}</option>
                                <option value="rate-desc"${sortKey === 'rate' && sortDir === 'desc' ? ' selected' : ''}>${tq('stats.sortRateDesc')}</option>
                                <option value="attempts-desc"${sortKey === 'attempts' && sortDir === 'desc' ? ' selected' : ''}>${tq('stats.sortAttemptsDesc')}</option>
                                <option value="attempts-asc"${sortKey === 'attempts' && sortDir === 'asc' ? ' selected' : ''}>${tq('stats.sortAttemptsAsc')}</option>
                                <option value="streak-desc"${sortKey === 'streak' && sortDir === 'desc' ? ' selected' : ''}>${tq('stats.sortStreakDesc')}</option>
                                <option value="streak-asc"${sortKey === 'streak' && sortDir === 'asc' ? ' selected' : ''}>${tq('stats.sortStreakAsc')}</option>
                                <option value="date-desc"${sortKey === 'date' && sortDir === 'desc' ? ' selected' : ''}>${tq('stats.sortDateDesc')}</option>
                                <option value="date-asc"${sortKey === 'date' && sortDir === 'asc' ? ' selected' : ''}>${tq('stats.sortDateAsc')}</option>
                                <option value="exams-desc"${sortKey === 'exams' && sortDir === 'desc' ? ' selected' : ''}>${tq('stats.sortExamsDesc')}</option>
                                <option value="exams-asc"${sortKey === 'exams' && sortDir === 'asc' ? ' selected' : ''}>${tq('stats.sortExamsAsc')}</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div id="all-questions-list" style="display:flex; flex-direction:column; gap:8px; max-height:500px; overflow-y:auto; padding-right:8px;">
            `;

        visibleQuestions.forEach(([code, data]) => {
            const qObj = view.getQuestionByCode(code);

            let theme = qObj ? qObj.theme : 'Autre';

            // Derive theme if missing
            if (!theme && code) {
                const letter = code.charAt(0);
                const map = {
                    A: 'Météo',
                    E: 'Mécavol',
                    G: 'Mécavol',
                    H: 'Mécavol',
                    L: 'Matériel',
                    N: 'Matériel',
                    R: 'Matériel',
                    U: 'Pilotage',
                    W: 'Pilotage',
                    X: 'Pilotage',
                    S: 'Réglementation',
                    F: 'Facteurs humains',
                    P: 'Milieu naturel',
                };
                theme = map[letter] || 'Autre';
            }

            const pct = Math.round(masteryRatio(data) * 100);
            const qColor = pct >= 90 ? '#4ade80' : pct >= 75 ? '#38bdf8' : pct >= 50 ? '#facc15' : '#f87171';
            const streak = data.streak || 0;
            const lastSeen = getQuestionLastSeen(data, code, examDateByCode);
            const examCount = examCountByCode.get(code) ?? (allowGlobalExamCount ? Number(data?.examCount) || 0 : 0);
            const examBadgeHtml =
                examCount > 0
                    ? `<span class="question-exam-badge" title="${tq(examCount > 1 ? 'stats.examBadgeTitleMany' : 'stats.examBadgeTitleOne', { count: examCount })}" style="background:rgba(56, 189, 248, 0.15); color:#38bdf8; border:1px solid rgba(56, 189, 248, 0.35); padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:700;">🎓 ${examCount > 1 ? tq('stats.examBadgeMany', { count: examCount }) : tq('stats.examBadgeOne')}</span>`
                    : '';

            // Build answers HTML if available
            let answersHtml = '';
            if (qObj && qObj.choices) {
                const perOption = optionExplanations(qObj);
                const courseLinks =
                    typeof view.getCourseLinks === 'function'
                        ? view.getCourseLinks(code)
                        : view.getCourseUrl && view.getCourseUrl(code)
                          ? [{ url: view.getCourseUrl(code), title: '', page: '' }]
                          : [];

                answersHtml =
                    '<div class="question-answers" style="display:none; margin-top:12px; padding-top:12px; border-top:1px solid var(--border-color);">';
                answersHtml += '<div class="bank-item-choices" style="display:flex; flex-direction:column; gap:8px;">';
                qObj.choices.forEach((ans, idx) => {
                    const pts = parseInt(ans.pts || 0);
                    const isCorrect = pts > 0;
                    const text = perOption ? perOption[idx] : null;
                    const links = isCorrect ? choiceCourseLinksHtml(courseLinks) : '';
                    const explHtml = text ? optionExplanationHtml(text, 'ok', tq('question.explanation'), links) : '';
                    const choiceHtml = `
                            <div class="bank-choice ${pts > 0 ? 'correct' : pts < 0 ? 'incorrect' : ''}">
                                ${escapeHTML(ans.text)} ${pts > 0 ? '(+' + pts + ')' : pts < 0 ? '(' + pts + ')' : ''}
                            </div>
                        `;
                    answersHtml += explHtml
                        ? `<div class="qcm-option-group">${choiceHtml}${explHtml}</div>`
                        : choiceHtml;
                });
                answersHtml += '</div>';

                if (!perOption && (qObj.explication || courseLinks.length > 0)) {
                    answersHtml += `
                                <div class="bank-item-explication" style="margin-top:12px;">
                                    ${qObj.explication ? `<div>${explanationHtml(qObj.explication)}</div>` : ''}
                                    ${courseLinksHtml(courseLinks)}
                                </div>
                            `;
                }
                answersHtml += '</div>';
            }

            const qText = qObj ? qObj.question : tql('stats.unknownQuestion');
            const displayText = qText;
            const hasAnswers = qObj && qObj.choices;

            allQuestionsHtml += `
                    <div role="button" tabindex="0" class="question-stat-item" data-code="${code}" data-pct="${pct}" data-total="${data.total}" data-streak="${streak}" data-date="${lastSeen}" data-exams="${examCount}" style="background:var(--bg-card); padding:12px 16px; border-radius:8px; border:1px solid var(--border-color); cursor:${hasAnswers ? 'pointer' : 'default'};" ${hasAnswers ? `data-action="QuiztoggleQuestionDetails" data-args="['${code}']"` : ''}>
                        <div style="display:flex; justify-content:space-between; align-items:start; gap:12px;">
                            <div style="flex:1;">
                                <div style="display:flex; gap:8px; align-items:center; margin-bottom:6px;">
                                    <span style="font-family:monospace; font-size:0.75rem; opacity:0.5;">#${code}</span>
                                    <span style="background:rgba(255,255,255,0.1); padding:2px 6px; border-radius:4px; font-size:0.7rem;">${theme}</span>
                                    ${examBadgeHtml}
                                    ${streak >= 3 ? `<span style="background:#4ade80; color:#000; padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:700;">🔥 ${streak}</span>` : ''}
                                    ${hasAnswers ? '<i class="ri-arrow-down-s-line" style="opacity:0.5; transition:transform 0.2s;" id="arrow-' + code + '"></i>' : ''}
                                </div>
                                <div style="font-size:0.9rem; line-height:1.4;">${escapeHTML(displayText)}</div>
                                <div style="font-size:0.75rem; opacity:0.6; margin-top:4px;">
                                    ${tq(data.total > 1 ? 'stats.questionLineMany' : 'stats.questionLineOne', { correct: data.correct, total: data.total, streak })}
                                </div>
                                ${answersHtml}
                            </div>
                            <div style="text-align:right; min-width:60px;">
                                <div style="font-size:1.3rem; font-weight:700; color:${qColor};">${pct}%</div>
                            </div>
                        </div>
                    </div>
                `;
        });

        allQuestionsHtml += '</div>';
    } else {
        allQuestionsHtml = `<div style="opacity:0.6; font-style:italic; text-align:center; padding:40px;">${tq('stats.noAttempt')}</div>`;
    }

    return allQuestionsHtml;
}

/** Jauge circulaire du taux de réussite global. */
export function buildGaugeHtml({ color, currentLevel, globalPct, stats, levelTotalResponses }) {
    // Premium Circular Gauge Calculation
    const strokeDash = 2 * Math.PI * 55; // r=55
    const offset = strokeDash - (globalPct / 100) * strokeDash;
    const levelName =
        currentLevel === 'ALL' ? tql('stats.allLevels') : tql(`history.levels.${currentLevel}`) || currentLevel;
    const responseCount = typeof levelTotalResponses === 'number' ? levelTotalResponses : stats?.totalQuestions || 0;

    const successGaugeHtml = `
            <div class="premium-gauge-container" style="display:flex; flex-direction:column; align-items:center; margin: 10px 0 40px 0; position:relative; padding:30px; background:var(--bg-card); border-radius:32px; border: 1px solid var(--border-color); backdrop-filter:blur(10px);">
                <div class="gauge-wrapper" style="position:relative; width:250px; height:250px; display:flex; align-items:center; justify-content:center;">
                    <!-- SVG Progress Circle -->
                    <svg width="250" height="250" viewBox="0 0 140 140" style="transform: rotate(-90deg); overflow: visible;">
                        <!-- Background track -->
                        <circle cx="70" cy="70" r="55" fill="none" stroke="var(--border-color)" stroke-width="8" />
                        <!-- Progress bar -->
                        <circle cx="70" cy="70" r="55" fill="none" 
                            stroke="${color}" 
                            stroke-width="8" 
                            stroke-dasharray="${strokeDash}" 
                            stroke-dashoffset="${offset}" 
                            stroke-linecap="round"
                            style="transition: stroke-dashoffset 1.5s cubic-bezier(0.34, 1.56, 0.64, 1); filter: drop-shadow(0 0 12px ${color});"
                        />
                    </svg>
                    
                    <!-- Internal Content -->
                    <div style="position:absolute; text-align:center; transform: rotate(0deg); display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; height:100%;">
                        <div style="font-size:4.5rem; font-weight:900; color:${color}; line-height:1; letter-spacing:-2px; font-family:'Inter', sans-serif;">
                            ${globalPct}<span style="font-size:1.8rem; opacity:0.8; margin-left:2px;">%</span>
                        </div>
                    </div>
                </div>
                
                <div style="text-align:center; margin-top:24px;">
                    <div style="font-size:1.1rem; font-weight:700; color:var(--text-main); letter-spacing:0.02em;">${tq('stats.level', { level: levelName })}</div>
                    <div style="font-size:0.8rem; opacity:0.4; margin-top:4px; font-family:monospace;">${tq('stats.activity', { count: responseCount })}</div>
                </div>
            </div>
        `;

    return successGaugeHtml;
}
