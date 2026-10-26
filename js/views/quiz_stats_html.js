/**
 * PURE VIEW - QuizView, écran des statistiques : fabrication du HTML
 * Morceaux de QuizStatsBase.renderStats() : chaque fonction reçoit la vue (état des filtres et du tri,
 * getCourseUrl…) et les chiffres déjà calculés, et rend un fragment HTML. Aucun accès au DOM.
 */
import { escapeHTML } from '../core/security.js';
import { toSorted } from '../utils/array_utils.js';
import { truncate } from '../utils/text_utils.js';
import { tq, tqh, tql } from './quiz_strings.js';
import { explanationHtml } from './quiz_explanation.js';

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
        return `background:rgba(${baseColor}, ${bgOpacity}); border:1px solid rgba(${baseColor}, ${borderOpacity}); padding:20px 12px; border-radius:20px; text-align:center; cursor:pointer; transition:all 0.2s; flex:1 1 150px; max-width:220px; ${shadow}`;
    };

    // Colors in RGB for helper
    const cGreen = '74, 222, 128';
    const cYellow = '250, 204, 21';
    const cOrange = '251, 146, 60';
    const cRed = '248, 113, 113';
    const cGray = document.body.classList.contains('light-mode') ? '100, 116, 139' : '255, 255, 255';

    const distributionHtml = `
            <div style="display:flex; flex-wrap:wrap; justify-content:center; gap:16px;">
                <div role="button" tabindex="0" data-action="QuizsetMasteryFilter" data-args="['PERFECT']" style="${getCardStyle(cGreen, 'PERFECT')}">
                    <div style="font-size:2rem; font-weight:900; color:#4ade80;">${perfect}</div>
                    <div style="font-size:0.75rem; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; opacity:0.6; margin-top:8px;">${tq('stats.mastery.perfect')}</div>
                    <div style="font-size:0.65rem; opacity:0.4;">(100%)</div>
                </div>
                <div role="button" tabindex="0" data-action="QuizsetMasteryFilter" data-args="['EXCELLENT']" style="${getCardStyle('134, 239, 172', 'EXCELLENT')}">
                    <div style="font-size:2rem; font-weight:900; color:#86efac;">${excellent}</div>
                    <div style="font-size:0.75rem; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; opacity:0.6; margin-top:8px;">${tq('stats.mastery.excellent')}</div>
                    <div style="font-size:0.65rem; opacity:0.4;">(90-99%)</div>
                </div>
                <div role="button" tabindex="0" data-action="QuizsetMasteryFilter" data-args="['VERY_GOOD']" style="${getCardStyle('56, 189, 248', 'VERY_GOOD')}">
                    <div style="font-size:2rem; font-weight:900; color:#38bdf8;">${veryGood}</div>
                    <div style="font-size:0.75rem; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; opacity:0.6; margin-top:8px;">${tq('stats.mastery.veryGood')}</div>
                    <div style="font-size:0.65rem; opacity:0.4;">(75-89%)</div>
                </div>
                <div role="button" tabindex="0" data-action="QuizsetMasteryFilter" data-args="['GOOD']" style="${getCardStyle(cYellow, 'GOOD')}">
                    <div style="font-size:2rem; font-weight:900; color:#facc15;">${good}</div>
                    <div style="font-size:0.75rem; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; opacity:0.6; margin-top:8px;">${tq('stats.mastery.good')}</div>
                    <div style="font-size:0.65rem; opacity:0.4;">(50-74%)</div>
                </div>
                <div role="button" tabindex="0" data-action="QuizsetMasteryFilter" data-args="['POOR']" style="${getCardStyle(cOrange, 'POOR')}">
                    <div style="font-size:2rem; font-weight:900; color:#fb923c;">${poor}</div>
                    <div style="font-size:0.75rem; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; opacity:0.6; margin-top:8px;">${tq('stats.mastery.poor')}</div>
                    <div style="font-size:0.65rem; opacity:0.4;">(1-49%)</div>
                </div>
                <div role="button" tabindex="0" data-action="QuizsetMasteryFilter" data-args="['FAILED']" style="${getCardStyle(cRed, 'FAILED')}">
                    <div style="font-size:2rem; font-weight:900; color:#f87171;">${failed}</div>
                    <div style="font-size:0.75rem; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; opacity:0.6; margin-top:8px;">${tq('stats.mastery.failed')}</div>
                    <div style="font-size:0.65rem; opacity:0.4;">(0%)</div>
                </div>
                <div role="button" tabindex="0" data-action="QuizsetMasteryFilter" data-args="['NOT_ATTEMPTED']" style="${getCardStyle(cGray, 'NOT_ATTEMPTED')}">
                    <div style="font-size:2rem; font-weight:900; color:var(--text-muted);">${notAttempted}</div>
                    <div style="font-size:0.75rem; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; opacity:0.6; margin-top:8px;">${tq('stats.mastery.notAttempted')}</div>
                    <div style="font-size:0.65rem; opacity:0.4;">${tq('stats.outOf', { total: totalLevelQuestions })}</div>
                </div>
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

        // Theme emoji icon
        const themeIcons = {
            Météo: '🌦️',
            Mécavol: '⚙️',
            Matériel: '🪂',
            Pilotage: '🧭',
            Réglementation: '📋',
            'Facteurs humains': '🧠',
            'Milieu naturel': '🏔️',
        };
        const icon = themeIcons[name] || '📚';

        // Active state
        const isActive = view.state.themeFilter === name;
        const cardBorder = isActive
            ? `border:2px solid ${tColor}; box-shadow:0 0 20px -4px rgba(${tColorRgb},0.4);`
            : `border:1px solid var(--border-color);`;
        const cardBg = isActive ? `background:rgba(${tColorRgb},0.08);` : `background:var(--bg-card);`;

        // Progress bar width
        const barWidth = totalQ > 0 ? pct : 0;

        themesHtml += `
                <div role="button" tabindex="0" class="theme-card" data-action="QuizsetThemeFilter" data-args="['${name}']" style="cursor:pointer; padding:16px 18px; border-radius:16px; ${cardBorder} ${cardBg} color:var(--text-main); transition:all 0.25s ease; position:relative; overflow:hidden;">
                    <!-- Subtle background glow for active -->
                    ${isActive ? `<div style="position:absolute;inset:0;background:radial-gradient(ellipse at top left, rgba(${tColorRgb},0.08) 0%, transparent 70%);pointer-events:none;"></div>` : ''}

                    <!-- Top row: emoji (left) + badge % (right) — never overlaps -->
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <span style="font-size:1.4rem; line-height:1;">${icon}</span>
                        <div style="background:rgba(${tColorRgb},0.15); color:${tColor}; font-weight:900; font-size:1rem; padding:3px 10px; border-radius:10px; letter-spacing:-0.5px; white-space:nowrap;">
                            ${totalQ === 0 ? '—' : pct + '%'}
                        </div>
                    </div>

                    <!-- Theme name — full width, wraps freely -->
                    <div style="font-weight:700; font-size:0.88rem; line-height:1.3; letter-spacing:0.01em; margin-bottom:12px;">${name}</div>

                    <!-- Progress bar -->
                    <div style="height:5px; background:rgba(255,255,255,0.08); border-radius:99px; overflow:hidden; margin-bottom:8px;">
                        <div style="height:100%; width:${barWidth}%; background:${tColor}; border-radius:99px; transition:width 0.6s cubic-bezier(0.34,1.56,0.64,1); box-shadow:0 0 8px ${tColor};"></div>
                    </div>

                    <!-- Footer: question count -->
                    <div style="font-size:0.72rem; opacity:0.5; display:flex; justify-content:space-between; align-items:center;">
                        <span>${tq('stats.themeCount', { attempted: attemptedUnique, total: totalQ })}${notAttemptedQ > 0 ? ` <span style="opacity:0.7;">${tq(notAttemptedQ > 1 ? 'stats.themeNotAttemptedMany' : 'stats.themeNotAttemptedOne', { count: notAttemptedQ })}</span>` : ''}</span>
                        ${isActive ? `<span style="font-size:0.68rem; font-weight:700; opacity:0.8;">${tq('stats.removeFilter')}</span>` : ''}
                    </div>
                </div>
            `;
    });

    return { themesHtml, sortControlsHtml };
}

/** Liste des questions du niveau, filtrée par maîtrise et par thème. */
export function buildQuestionsHtml(view, { levelQs, levelQuestionEntries, stats }) {
    // Build individual questions list (FILTERED BY LEVEL)
    let allQuestionsHtml = '';
    // Use levelQuestionEntries computed earlier to show only relevant questions

    if (levelQuestionEntries.length > 0) {
        // Sort by success rate (worst first) immutably using ES2023 toSorted
        const sortedQuestions = toSorted(levelQuestionEntries, (a, b) => {
            const pctA = a[1].total > 0 ? a[1].correct / a[1].total : 0;
            const pctB = b[1].total > 0 ? b[1].correct / b[1].total : 0;
            return pctA - pctB;
        });

        // --- FILTERING LOGIC ---
        let visibleQuestions = [];

        if (view.state.masteryFilter === 'ALL') {
            visibleQuestions = sortedQuestions;
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
            visibleQuestions = sortedQuestions.filter(([, data]) => {
                const pct = Math.round((data.correct / data.total) * 100);
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

        // Append theme filter label if active
        let displayLabel = filterLabel;
        if (view.state.themeFilter) {
            displayLabel += tq('stats.themeSuffix', { theme: view.state.themeFilter }); // inserted as HTML: escaped (spec 025)
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

        allQuestionsHtml = `
                <div style="margin-bottom:16px; display:flex; justify-content:space-between; align-items:center;">
                    <div style="font-size:0.9rem; opacity:0.7;">
                        ${tqh('stats.questionCount', { count: `<span style="font-weight:700; color:var(--text-main);">${visibleQuestions.length}</span>` })} 
                        <span style="opacity:0.6;">(${displayLabel})</span>
                        ${view.state.masteryFilter !== 'ALL' || view.state.themeFilter ? `<a role="button" tabindex="0" data-action="QuizclearAllFilters" data-args="[]" style="margin-left:8px; cursor:pointer; text-decoration:underline; font-size:0.8rem; color:var(--accent-orange);">${tq('stats.clearFilters')}</a>` : ''}
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button data-action="QuizsortQuestions" data-args="['rate']" id="sort-rate-btn" class="sort-btn" style="padding:6px 12px; border-radius:6px; border:1px solid var(--border-color); background:rgba(255,255,255,0.05); cursor:pointer; font-size:0.8rem;">
                            ${tq('stats.sortByRate')}
                        </button>
                        <button data-action="QuizsortQuestions" data-args="['attempts']" id="sort-attempts-btn" class="sort-btn" style="padding:6px 12px; border-radius:6px; border:1px solid var(--border-color); background:transparent; cursor:pointer; font-size:0.8rem;">
                            ${tq('stats.sortByAttempts')}
                        </button>
                        <button data-action="QuizsortQuestions" data-args="['streak']" id="sort-streak-btn" class="sort-btn" style="padding:6px 12px; border-radius:6px; border:1px solid var(--border-color); background:transparent; cursor:pointer; font-size:0.8rem;">
                            ${tq('stats.sortByStreak')}
                        </button>
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

            const pct = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
            const qColor = pct >= 90 ? '#4ade80' : pct >= 75 ? '#38bdf8' : pct >= 50 ? '#facc15' : '#f87171';
            const streak = data.streak || 0;

            // Build answers HTML if available
            let answersHtml = '';
            if (qObj && qObj.choices) {
                answersHtml =
                    '<div class="question-answers" style="display:none; margin-top:12px; padding-top:12px; border-top:1px solid var(--border-color);">';
                qObj.choices.forEach((ans) => {
                    const isCorrect = parseInt(ans.pts) > 0;
                    const answerStyle = isCorrect
                        ? 'background:rgba(74, 222, 128, 0.1); border-left:3px solid #4ade80;'
                        : 'background:rgba(255,255,255,0.02);';
                    const icon = isCorrect ? '<i class="ri-checkbox-circle-fill" style="color:#4ade80;"></i>' : '';

                    answersHtml += `
                            <div style="padding:8px 12px; margin-bottom:6px; border-radius:6px; ${answerStyle} display:flex; align-items:center; gap:8px; font-size:0.85rem;">
                                ${icon}
                                <span style="flex:1;">${ans.text}</span>
                            </div>
                        `;
                });
                // Add Explanation in Stats View
                if (qObj.explication) {
                    answersHtml += `
                                <div style="margin-top:12px; padding:12px; background:rgba(251, 146, 60, 0.15); border-left:3px solid #fb923c; font-size:0.9rem; color:var(--text-main); border-radius:8px;">
                                    <div style="font-weight:700; font-size:0.75rem; color:#fb923c; margin-bottom:4px; text-transform:uppercase;">${tq('explanation')}</div>
                                    ${explanationHtml(qObj.explication)}
                                </div>
                            `;
                }
                answersHtml += '</div>';
            }

            const qText = qObj ? qObj.question : tql('stats.unknownQuestion');
            const displayText = truncate(qText, 80);
            const hasAnswers = qObj && qObj.choices;

            allQuestionsHtml += `
                    <div role="button" tabindex="0" class="question-stat-item" data-code="${code}" data-pct="${pct}" data-total="${data.total}" data-streak="${streak}" style="background:var(--bg-card); padding:12px 16px; border-radius:8px; border:1px solid var(--border-color); cursor:${hasAnswers ? 'pointer' : 'default'};" ${hasAnswers ? `data-action="QuiztoggleQuestionDetails" data-args="['${code}']"` : ''}>
                        <div style="display:flex; justify-content:space-between; align-items:start; gap:12px;">
                            <div style="flex:1;">
                                <div style="display:flex; gap:8px; align-items:center; margin-bottom:6px;">
                                    <span style="font-family:monospace; font-size:0.75rem; opacity:0.5;">#${code}</span>
                                    ${view.getCourseUrl(code) ? `<button data-action="openUrl" data-url="${escapeHTML(view.getCourseUrl(code))}" style="background:var(--accent-orange); color:white; border:none; padding:3px 8px; border-radius:4px; cursor:pointer; font-size:0.65rem; font-weight:700; display:flex; align-items:center; gap:4px; box-shadow:0 2px 4px rgba(0,0,0,0.2);"><i class="ri-book-open-line"></i> ${tq('stats.course')}</button>` : ''}
                                    <span style="background:rgba(255,255,255,0.1); padding:2px 6px; border-radius:4px; font-size:0.7rem;">${theme}</span>
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
export function buildGaugeHtml({ color, currentLevel, globalPct, stats }) {
    // Premium Circular Gauge Calculation
    const strokeDash = 2 * Math.PI * 55; // r=55
    const offset = strokeDash - (globalPct / 100) * strokeDash;

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
                        <div style="font-size:0.75rem; font-weight:800; text-transform:uppercase; letter-spacing:0.15em; opacity:0.5; margin-top:8px; line-height:1.2;">
                            ${tq('stats.globalLine1')}<br>${tq('stats.globalLine2')}
                        </div>
                    </div>
                </div>
                
                <div style="text-align:center; margin-top:24px;">
                    <div style="font-size:1.1rem; font-weight:700; color:var(--text-main); letter-spacing:0.02em;">${tq('stats.level', { level: currentLevel === 'ALL' ? tql('stats.allLevels') : currentLevel })}</div>
                    <div style="font-size:0.8rem; opacity:0.4; margin-top:4px; font-family:monospace;">${tq('stats.activity', { count: stats.totalQuestions })}</div>
                    <div style="font-size:0.7rem; opacity:0.3; margin-top:4px; font-style:italic;">${tq('stats.averageNote')}</div>
                </div>
            </div>
        `;

    return successGaugeHtml;
}
