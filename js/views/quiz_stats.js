/**
 * PURE VIEW - QuizView, statistiques, historique des examens, import / export
 * Un des morceaux de la vue du quiz (quiz.js) : QuizViewClass hérite de cette classe.
 */
import GlobalState from '../core/app_state.js';
import QuizService from '../services/quiz_service.js';
import BrevetService from '../services/brevet_service.js';
import StorageService from '../services/storage.js';
import { masteryRatio } from '../services/mastery.js';
import { escapeHTML } from '../core/security.js';
import { formatDateTime } from '../utils/date_utils.js';
import { COURSES_DATA } from '../data/courses_data.js';
import GdprEngine from '../gdpr_engine.js';
import BaseView from '../core/base_view.js';
import { tq, tql } from './quiz_strings.js';
import { explanationHtml } from './quiz_explanation.js';
import {
    buildDistributionHtml,
    buildThemesHtml,
    buildQuestionsHtml,
    buildGaugeHtml,
    buildOfficialTheoryBannerHtml,
} from './quiz_stats_html.js';

export class QuizStatsBase extends BaseView {
    constructor() {
        super();
        /** @type {any} Posé par QuizView (filtres, tri, session) : ces méthodes le lisent. */
        this.state = null;
    }

    /**
     * À fournir par QuizView.
     * @returns {any}
     */
    getQuestionByCode(_code) {
        throw new Error('QuizView must implement getQuestionByCode()');
    }

    showStatsScreen() {
        document.querySelectorAll('.mode-screen').forEach((s) => s.classList.remove('active'));
        const statsScreen = document.getElementById('stats-screen');
        if (statsScreen) statsScreen.classList.add('active');
        this.renderStats();
    }

    renderStats() {
        console.log('QuizEngine.renderStats v4.4 - Starting');
        const container = document.getElementById('stats-content');
        if (!container) return;

        if (!GdprEngine.isConsentGranted('stats')) {
            container.innerHTML = `
                <div style="padding:40px; text-align:center; color:var(--text-main); max-width: 500px; margin: 0 auto; display:flex; flex-direction:column; align-items:center; justify-content:center;">
                    <i class="ri-shield-user-line" style="font-size:3.5rem; color:var(--accent-orange); display:block; margin-bottom:20px;"></i>
                    <h2 style="margin-bottom:12px; font-weight: 800; font-size: 1.4rem;">${tq('stats.disabledTitle')}</h2>
                    <p style="opacity:0.7; font-size:0.9rem; line-height: 1.6; margin-bottom: 24px;">
                        ${tq('stats.disabledText')}
                    </p>
                    <button data-action="GdprshowModal" data-args="gdpr-settings-modal" style="background:var(--accent-orange); color:white; border:none; padding:12px 24px; border-radius:14px; cursor:pointer; font-weight:700; transition:all 0.2s; font-size:0.9rem;">
                        ${tq('stats.enable')}
                    </button>
                </div>
            `;
            return;
        }

        if (!QuizService.state.isLoaded) {
            container.innerHTML = `
                <div style="padding:40px; text-align:center; color:var(--text-main); opacity:0.7;">
                    <i class="ri-loader-4-line ri-spin" style="font-size:3rem; margin-bottom:20px; display:block;"></i>
                    <p>${tq('stats.loading')}</p>
                </div>
            `;
            return;
        }

        if (QuizService.state.loadingError) {
            container.innerHTML = `
                <div style="padding:40px; text-align:center; color:var(--text-main); max-width: 500px; margin: 0 auto;">
                    <i class="ri-error-warning-line" style="font-size:3rem; color:#b91c1c; display:block; margin-bottom:20px;"></i>
                    <h2 style="margin-bottom:12px; font-weight: 800; font-size: 1.4rem;">${tq('stats.loadErrorTitle')}</h2>
                    <p style="opacity:0.7;">${tq('stats.loadErrorText')}<br>${tq('stats.loadErrorDetail', { detail: QuizService.state.loadingError })}</p>
                </div>
            `;
            return;
        }

        const questions = QuizService.getQuestions();
        if (!questions || !questions.length) {
            container.innerHTML = `
                <div style="padding:40px; text-align:center; color:white;">
                    <i class="ri-error-warning-line" style="font-size:3rem; color:#b91c1c; display:block; margin-bottom:20px;"></i>
                    <h2 style="margin-bottom:10px;">${tq('stats.noDataTitle')}</h2>
                    <p style="opacity:0.7;">${tq('stats.noDataText')}</p>
                </div>
            `;
            return;
        }

        try {
            const stats = QuizService.getPersistentStats();
            // Ensure stats structure
            if (!stats.themes) stats.themes = {};
            if (!stats.questions) stats.questions = {};

            // Filter by current level
            let currentLevel = typeof GlobalState !== 'undefined' ? GlobalState.get('level') : 'BI';
            if (!currentLevel || currentLevel === '') currentLevel = 'BI';

            console.log('Rendering stats for normalized level:', currentLevel);

            const levelQuestionCodes = new Set();
            let totalLevelQuestions = 0;

            let levelQs = [];
            console.log('DEBUG RENDER STATS: Normalized Level =', currentLevel);

            // Mapping levels to the questions' 'niveau' property
            // 0: Vert (Intro)? 1: Bleu (BI)? 2: Marron (BP)? 3: Rouge/Confirme (BPC)?

            if (currentLevel === 'ALL') {
                // For global view, use all PARAPENTE questions
                levelQs = questions.filter((q) => q.parapente === true);
                console.log('DEBUG ALL FILTER: Total parapente questions:', levelQs.length);
            } else if (currentLevel === 'BI') {
                // BI = Contains suffix V AND parapente
                levelQs = questions.filter((q) => q.parapente === true && q.code && q.code.includes('V'));
                console.log(`DEBUG BI FILTER: Found ${levelQs.length} questions (Suffix contains V).`);
            } else if (currentLevel === 'BP') {
                // BP = Contains suffix B AND parapente
                levelQs = questions.filter((q) => q.parapente === true && q.code && q.code.includes('B'));
                console.log(`DEBUG BP FILTER: Found ${levelQs.length} questions (Suffix contains B).`);
            } else if (currentLevel === 'BPC') {
                // BPC = Contains suffix M AND parapente
                levelQs = questions.filter((q) => q.parapente === true && q.code && q.code.includes('M'));
                console.log(`DEBUG BPC FILTER: Found ${levelQs.length} questions (Suffix contains M).`);
            } else if (currentLevel === 'TREUIL') {
                // TREUIL = Contains suffix T AND parapente
                levelQs = questions.filter((q) => q.parapente === true && q.code && q.code.includes('T'));
                console.log(`DEBUG TREUIL FILTER: Found ${levelQs.length} questions (Suffix contains T).`);
            } else {
                // Fallback
                levelQs = questions.filter((q) => q.parapente === true && q.class && q.class.includes(currentLevel));
            }

            // Deduplicate and Filter levelQs (Fix for erroneous 198 count vs 174)
            const excludedPrefixes = ['H', 'R', 'X']; // Delta specifics
            levelQs = levelQs.filter((q) => !excludedPrefixes.includes(q.code.charAt(0)));

            if (levelQs.length > 0) {
                totalLevelQuestions = levelQs.length;
                levelQs.forEach((q) => levelQuestionCodes.add(q.code));
                console.log(`Found ${totalLevelQuestions} questions for level ${currentLevel} in QCM dataset`);
            }

            // Calculate question distribution for CURRENT LEVEL
            const allQuestionEntries = Object.entries(stats.questions);

            if (currentLevel === 'ALL') {
                const sampleKeys = allQuestionEntries.slice(0, 5).map((e) => e[0]);
                console.log('DEBUG ALL: stats.questions keys sample:', sampleKeys);
                console.log('DEBUG ALL: levelQuestionCodes size:', levelQuestionCodes.size);
                const firstCode = Array.from(levelQuestionCodes)[0];
                console.log('DEBUG ALL: First code in levelQuestionCodes:', firstCode);
            }

            // Debug filtering
            const levelQuestionEntries = allQuestionEntries.filter(([code]) => levelQuestionCodes.has(code));

            // FALLBACK: If filtering returns 0 results but we have stats, it might be due to code mismatches.
            // In that case, we display everything to ensure the user sees their data.

            let perfect = 0; // 100%
            let excellent = 0; // 90-99%
            let veryGood = 0; // 75-89%
            let good = 0; // 50-74%
            let poor = 0; // 1-49%
            let failed = 0; // 0%
            // notAttempted is relative to the level total
            let notAttempted = totalLevelQuestions - levelQuestionEntries.length;

            // Ensure non-negative (incase of data sync issues)
            console.log(
                'DEBUG NOT ATTEMPTED:',
                totalLevelQuestions,
                levelQuestionEntries.length,
                notAttempted,
                notAttempted < 0 ? 'FIXED to 0' : '',
            );
            if (notAttempted < 0) notAttempted = 0;

            levelQuestionEntries.forEach(([, data]) => {
                if (data.total === 0) return;
                const pct = Math.round(masteryRatio(data) * 100);

                if (pct === 100) perfect++;
                else if (pct >= 90)
                    excellent++; // 90-99%
                else if (pct >= 75)
                    veryGood++; // 75-89% (NEW)
                else if (pct >= 50) good++;
                else if (pct > 0) poor++;
                else failed++;
            });

            // Recalculate global percentage (MASTERY SCORE)
            // Formula: Sum of (Correct/Total) for each unique question / Total number of unique questions
            // This ensures unattempted questions count as 0% mastery.

            let accumulatedMastery = 0;

            // Calculate Theme Stats dynamically for THIS LEVEL using ES2024 Object.groupBy
            const levelThemes = {};

            if (levelQs) {
                const groupedByTheme = Object.groupBy
                    ? Object.groupBy(levelQs, (q) => q.theme || 'Autre')
                    : levelQs.reduce((acc, q) => {
                          const t = q.theme || 'Autre';
                          (acc[t] = acc[t] || []).push(q);
                          return acc;
                      }, {});

                for (const [theme, questions] of Object.entries(groupedByTheme)) {
                    let mastery = 0;
                    let attemptedCount = 0;
                    for (const q of questions) {
                        const qStat = stats.questions[q.code];
                        if (qStat && qStat.total > 0) {
                            mastery += masteryRatio(qStat);
                            attemptedCount++;
                        }
                    }
                    levelThemes[theme] = {
                        mastery,
                        totalQuestions: questions.length,
                        attemptedCount,
                    };
                }
            }

            // Iterate over ALL unique questions for this level (attempted or not)
            levelQs.forEach((q) => {
                const stat = stats.questions[q.code];
                if (stat && stat.total > 0) {
                    accumulatedMastery += masteryRatio(stat);
                } else {
                    // Unattempted or 0 total attempts = 0% mastery
                    accumulatedMastery += 0;
                }
            });

            // If totalLevelQuestions is 0 (should not happen if data loaded), avoid division by zero
            const globalPct =
                totalLevelQuestions > 0 ? Math.round((accumulatedMastery / totalLevelQuestions) * 100) : 0;
            const color = globalPct >= 75 ? '#4ade80' : globalPct >= 50 ? '#facc15' : '#f87171';

            const distributionHtml = buildDistributionHtml(this, {
                perfect,
                excellent,
                veryGood,
                good,
                poor,
                failed,
                notAttempted,
                totalLevelQuestions,
            });
            const { themesHtml, sortControlsHtml } = buildThemesHtml(this, levelThemes);
            const allQuestionsHtml = buildQuestionsHtml(this, { levelQs, levelQuestionEntries, stats });
            const successGaugeHtml = buildGaugeHtml({ color, currentLevel, globalPct, stats });
            const officialTheoryBannerHtml = buildOfficialTheoryBannerHtml(
                currentLevel,
                BrevetService.getBrevet(currentLevel),
                'data-stats-brevet-banner',
            );
            container.innerHTML = `
            ${officialTheoryBannerHtml}
            ${successGaugeHtml}

            <div style="margin-top:48px;">
                <h3 class="library-section-header" style="border:none; margin-bottom:24px;">${tq('stats.distributionTitle')}</h3>
                ${distributionHtml}
            </div>

                <div style="margin-top:48px;">
                    <h3 class="library-section-header" style="border:none; margin-bottom:20px;">${tq('stats.themesTitle')}</h3>
                    ${sortControlsHtml}
                    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:12px;">
                        ${themesHtml || `<div style="opacity:0.5;">${tq('stats.noData')}</div>`}
                    </div>
                </div>
            </div>

            <div style="margin-top:64px;">
                <h3 class="library-section-header" style="border:none; margin-bottom:24px;">${tq('stats.historyTitle')}</h3>
                <div style="background:var(--bg-card); padding:24px; border-radius:24px; border:1px solid var(--border-color);">
                    ${this.renderExamHistory()}
                </div>
            </div>

            <div style="margin-top:64px;">
                <h3 class="library-section-header" style="border:none; margin-bottom:24px;">${tq('stats.questionsTitle')}</h3>
                <div style="background:var(--bg-card); padding:24px; border-radius:24px; border:1px solid var(--border-color);">
                    ${allQuestionsHtml}
                </div>
            </div>

            <div style="text-align:center; margin-top:64px; display:flex; gap:16px; justify-content:center; flex-wrap:wrap; padding-bottom:40px;">
                <button data-action="QuizexportData" data-args="[]" style="background:rgba(74, 222, 128, 0.1); color:#4ade80; border:1px solid rgba(74, 222, 128, 0.3); padding:12px 28px; border-radius:14px; cursor:pointer; font-weight:700; transition:all 0.2s; display:flex; align-items:center; gap:8px;">
                    <i class="ri-download-cloud-line" style="font-size:1.2rem;"></i> ${tq('stats.export')}
                </button>
                <button data-action="QuizimportData" data-args="[]" style="background:rgba(59, 130, 246, 0.1); color:#3b82f6; border:1px solid rgba(59, 130, 246, 0.3); padding:12px 28px; border-radius:14px; cursor:pointer; font-weight:700; transition:all 0.2s; display:flex; align-items:center; gap:8px;">
                    <i class="ri-upload-cloud-line" style="font-size:1.2rem;"></i> ${tq('stats.import')}
                </button>
                <button data-action="QuizresetStats" data-args="[]" style="background:rgba(248, 113, 113, 0.05); color:#f87171; border:1px solid rgba(248, 113, 113, 0.2); padding:12px 28px; border-radius:14px; cursor:pointer; font-weight:700; transition:all 0.2s; display:flex; align-items:center; gap:8px;">
                    <i class="ri-delete-bin-7-line" style="font-size:1.2rem;"></i> ${tq('stats.reset')}
                </button>
            </div>
        `;
        } catch (e) {
            console.error('Critical Error in renderStats:', e);
            if (container) {
                container.innerHTML = `<div style="padding:20px; color:#f87171; background:rgba(255,0,0,0.1); border-radius:12px;">${tq('stats.renderError', { error: e.message })}</div>`;
            }
        }
    }

    renderExamHistory() {
        let exams = QuizService.getExamHistory();

        // FILTER EXAMS BY CURRENT LEVEL
        let currentLevel = typeof GlobalState !== 'undefined' ? GlobalState.get('level') : 'BI';
        if (!currentLevel || currentLevel === '') currentLevel = 'BI';

        if (currentLevel !== 'ALL') {
            exams = exams.filter((e) => e.level === currentLevel);
        }

        if (exams.length === 0) {
            return `<div style="opacity:0.6; font-style:italic; text-align:center; padding:40px;">${tq('history.empty')}</div>`;
        }

        let html = '<div style="display:flex; flex-direction:column; gap:12px;">';

        exams.forEach((exam) => {
            const dateStr = formatDateTime(exam.date);
            const pct =
                exam.percentage !== undefined
                    ? exam.percentage
                    : exam.total > 0
                      ? Math.round((exam.score / exam.total) * 100)
                      : 0;
            const color = exam.invalidated ? '#f87171' : pct >= 75 ? '#4ade80' : pct >= 50 ? '#facc15' : '#f87171';
            const levelLabel = tql(
                `history.levels.${['BI', 'BP', 'BPC'].includes(exam.level) ? exam.level : 'TREUIL'}`,
            );

            // Build questions HTML

            let questionsHtml =
                '<div class="exam-details" style="display:none; margin-top:16px; padding-top:16px; border-top:1px solid var(--border-color);">';
            questionsHtml += '<div style="display:flex; flex-direction:column; gap:16px;">';

            exam.results.forEach((r, idx) => {
                let q = r.question;

                // Fallback: If question was saved as a string code (bug from early ES6 engine)
                if (typeof q === 'string') {
                    q = this.getQuestionByCode(r.question);
                }

                if (!q) return; // Skip if question couldn't be resolved

                const selectedOptions = r.selected || [];
                let optionsHtml = '';

                (q.choices || q.ans || []).forEach((opt) => {
                    const wasSelected = selectedOptions.some((s) => s.text === opt.text);
                    const pts = parseInt(opt.pts || 0);
                    let statusClass;
                    let icon = '';

                    if (pts > 0) {
                        statusClass = 'background:rgba(74, 222, 128, 0.1); border-left:3px solid #4ade80;';
                        icon = wasSelected
                            ? '<i class="ri-check-double-line" style="color:#4ade80;"></i>'
                            : '<i class="ri-checkbox-circle-line" style="color:#4ade80;"></i>';
                    } else if (pts < 0 && wasSelected) {
                        statusClass = 'background:rgba(248, 113, 113, 0.1); border-left:3px solid #f87171;';
                        icon = '<i class="ri-close-circle-line" style="color:#f87171;"></i>';
                    } else if (pts === 0 && wasSelected) {
                        // Neutral (0 pts)
                        statusClass = 'background:rgba(255, 255, 255, 0.05); border:1px solid var(--text-secondary);';
                        icon = '<i class="ri-checkbox-blank-circle-line" style="opacity:0.5;"></i>';
                    } else {
                        statusClass = 'background:rgba(255,255,255,0.02);';
                    }

                    optionsHtml += `
            <div style="padding:8px 12px; border-radius:6px; ${statusClass} display:flex; align-items:center; gap:8px; font-size:0.85rem;" >
                ${icon}
        <span style="flex:1;">${escapeHTML(opt.text)}</span>
                        </div >
    `;
                });

                questionsHtml += `
    <div style="background:rgba(255,255,255,0.02); padding:12px; border-radius:8px; ${!r.isCorrect ? 'border:1px solid #f87171;' : ''}" >
                        <div style="font-size:0.75rem; opacity:0.6; margin-bottom:6px;">${tq('history.questionNumber', { n: idx + 1 })}</div>
                        <div style="font-weight:600; margin-bottom:12px;">${escapeHTML(q.question)}</div>
                        <div style="display:flex; flex-direction:column; gap:6px;">
                            ${optionsHtml}
                        </div>
                        ${function () {
                            // Try to get explanation from saved question, or lookup in the current question bank
                            let expl = q.explanation || q.explication;
                            if (!expl) {
                                const currentQ = this.getQuestionByCode(q.code);
                                if (currentQ) expl = currentQ.explication || currentQ.explanation;
                            }

                            if (expl) {
                                return `<div style="margin-top:12px; padding:8px; background:rgba(251, 146, 60, 0.15); border-left:3px solid #fb923c; font-size:0.85rem; color:var(--text-main); border-radius:8px;">
                                    <div style="font-weight:700; font-size:0.75rem; color:#fb923c; margin-bottom:4px; text-transform:uppercase;">${tq('explanation')}</div>
                                    ${explanationHtml(expl)}</div>`;
                            }
                            return '';
                        }.call(this)}
                    </div >
    `;
            });

            questionsHtml += '</div></div>';

            html += `
    <div role="button" tabindex="0" data-exam-id="${exam.id}" style="background:var(--bg-card); padding:16px; border-radius:12px; border:1px solid var(--border-color); cursor:pointer;" data-action="QuiztoggleExamDetails" data-args="['${exam.id}']" >
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="flex:1;">
                <div style="display:flex; gap:8px; align-items:center; margin-bottom:6px;">
                    <span style="font-size:0.75rem; opacity:0.6;">${dateStr}</span>
                    <span style="background:rgba(255,255,255,0.05); padding:2px 8px; border-radius:4px; font-size:0.7rem;">${levelLabel}</span>
                    ${exam.invalidated ? `<span style="background:rgba(248, 113, 113, 0.1); color:#f87171; border:1px solid #f87171; padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:bold;">${tq('results.invalidated')}</span>` : ''}
                    <i class="ri-arrow-down-s-line exam-arrow" style="opacity:0.5; transition:transform 0.2s;"></i>
                </div>
                <div style="font-size:0.9rem;">
                    <span style="color:${color}; font-weight:700; font-size:1.1rem;">${exam.score}/${exam.total}</span>
                </div>
            </div>
            <div style="text-align:right;">
                <div style="font-size:1.5rem; font-weight:700; color:${color};">${pct}%</div>
            </div>
        </div>
                    ${questionsHtml}
                </div >
    `;
        });

        html += '</div>';
        return html;
    }

    reviewExam(examIdArgs) {
        let examId = examIdArgs;
        if (Array.isArray(examIdArgs)) {
            examId = examIdArgs[0];
        }
        const history = QuizService.getExamHistory();
        const exam = history.find((e) => String(e.id) === String(examId));
        if (!exam) return;

        const statsContent = document.getElementById('stats-content');
        if (!statsContent) return;

        const date = formatDateTime(exam.date);

        let html = `<h2>${tq('review.title', { date })}</h2>`;
        html += `<button class="action-btn-secondary" data-action="QuizshowStatsScreen" style="margin-bottom: 20px;">&larr; ${tq('review.back')}</button>`;

        const errors = exam.results.filter((r) => !r.isCorrect);

        if (errors.length === 0) {
            html += `<p class="success-text">${tq('review.noError')}</p>`;
        } else {
            html += `<h3>${tq('review.errors', { count: errors.length })}</h3>`;
            html += `<div style="display: flex; flex-direction: column; gap: 15px;">`;

            errors.forEach((err) => {
                // Exam history stores the full question object already (see QuizService.saveExamToHistory),
                // no lookup by code needed or possible: results never carried a `code` field.
                const q = err.question;
                if (q) {
                    html += `
                        <div class="card error-card" style="border-left: 3px solid #ef4444; padding: 15px; border-radius: 8px; background: var(--bg-card, #fff); box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                            <div style="margin-bottom: 10px;">
                                <strong style="color: var(--text-main, #333);">${escapeHTML(q.code)} - ${escapeHTML(err.theme || q.theme)}</strong><br>
                                <p style="margin: 8px 0; color: var(--text-main, #333);">${escapeHTML(q.question)}</p>
                            </div>
                            <div style="font-size: 0.9em; background: var(--bg-secondary, #f9f9f9); padding: 10px; border-radius: 6px;">
                                ${q.choices
                                    .map((c) => {
                                        const isGood = c.pts > 0;
                                        return `<div style="color: ${isGood ? '#22c55e' : 'var(--text-main, #666)'}; ${isGood ? 'font-weight: bold;' : 'margin-bottom: 4px;'}">${escapeHTML(c.text)} ${isGood ? '✓' : ''}</div>`;
                                    })
                                    .join('')}
                            </div>
                        </div>
                    `;
                } else {
                    html += `<div class="card error-card" style="border-left: 3px solid #ef4444; padding: 15px; border-radius: 8px;">${tq('review.missing', { code: err.code })}</div>`;
                }
            });
            html += `</div>`;
        }

        statsContent.innerHTML = html;
    }

    sortQuestions(sortBy) {
        const list = document.getElementById('all-questions-list');
        if (!list) return;

        // Toggle direction if clicking same sort
        if (this.state.questionSort === sortBy) {
            this.state.questionSortDir = this.state.questionSortDir === 'asc' ? 'desc' : 'asc';
        } else {
            this.state.questionSort = sortBy;
            // Default directions: Rate -> ASC (worst first), Attempts -> DESC (most first)
            this.state.questionSortDir = sortBy === 'rate' ? 'asc' : 'desc';
        }

        const dir = this.state.questionSortDir;
        const items = Array.from(/** @type {NodeListOf<HTMLElement>} */ (list.querySelectorAll('.question-stat-item')));

        // Update button states & Icons
        // Update button states & Icons - Scope only to Stats buttons
        const statsButtons = ['sort-rate-btn', 'sort-attempts-btn', 'sort-streak-btn'];
        statsButtons.forEach((id) => {
            const btn = document.getElementById(id);
            if (!btn) return;

            btn.style.background = 'transparent';
            // Reset text (remove arrows)
            let baseText = tq('stats.sortByRate');
            if (id === 'sort-attempts-btn') baseText = tq('stats.sortByAttempts');
            if (id === 'sort-streak-btn') baseText = tq('stats.sortByStreak');
            btn.innerHTML = baseText;
        });

        const activeBtn = document.getElementById(
            sortBy === 'rate' ? 'sort-rate-btn' : sortBy === 'attempts' ? 'sort-attempts-btn' : 'sort-streak-btn',
        );
        if (activeBtn) {
            activeBtn.style.background = 'rgba(255,255,255,0.05)';
            const arrow = dir === 'asc' ? ' <i class="ri-arrow-up-line"></i>' : ' <i class="ri-arrow-down-line"></i>';
            activeBtn.innerHTML += arrow;
        }

        items.sort((a, b) => {
            let valA, valB;
            if (sortBy === 'rate') {
                valA = parseInt(a.dataset.pct);
                valB = parseInt(b.dataset.pct);
            } else if (sortBy === 'streak') {
                valA = parseInt(a.dataset.streak || '0');
                valB = parseInt(b.dataset.streak || '0');
            } else {
                valA = parseInt(a.dataset.total);
                valB = parseInt(b.dataset.total);
            }

            if (dir === 'asc') return valA - valB;
            else return valB - valA;
        });

        list.innerHTML = '';
        items.forEach((item) => list.appendChild(item));
    }

    toggleQuestionDetails(code) {
        const card = document.querySelector(`[data-code="${code}"]`);
        if (!card) return;

        const answersDiv = /** @type {HTMLElement} */ (card.querySelector('.question-answers'));
        const arrow = document.getElementById('arrow-' + code);

        if (!answersDiv) return;

        const isExpanded = answersDiv.style.display !== 'none';

        if (isExpanded) {
            answersDiv.style.display = 'none';
            if (arrow) arrow.style.transform = 'rotate(0deg)';
        } else {
            answersDiv.style.display = 'block';
            if (arrow) arrow.style.transform = 'rotate(180deg)';
        }
    }

    setMasteryFilter(filter) {
        if (this.state.masteryFilter === filter) {
            this.state.masteryFilter = 'ALL'; // Toggle off
        } else {
            this.state.masteryFilter = filter;
        }
        this.renderStats();
    }

    setThemeFilter(theme) {
        if (this.state.themeFilter === theme) {
            this.state.themeFilter = null; // Toggle off
        } else {
            this.state.themeFilter = theme;
        }
        this.renderStats();
    }

    setThemeSort(sortType) {
        if (this.state.themeSort === sortType) {
            // Toggle direction
            this.state.themeSortDir = this.state.themeSortDir === 'asc' ? 'desc' : 'asc';
        } else {
            this.state.themeSort = sortType;
            this.state.themeSortDir = 'desc'; // Default to desc for new sort
            if (sortType === 'alpha') this.state.themeSortDir = 'asc'; // Default asc for alpha
        }
        this.renderStats();
    }

    clearAllFilters() {
        this.state.masteryFilter = 'ALL';
        this.state.themeFilter = null;
        this.renderStats();
    }

    resetStats() {
        if (confirm(tql('dialogs.resetConfirm'))) {
            StorageService.remove(StorageService.KEYS.QCM_STATS);
            if (window.FirebaseAuthEngine && window.FirebaseAuthEngine.enabled) {
                window.FirebaseAuthEngine.saveStatsToCloud();
            }
            alert(tql('dialogs.resetDone'));
            this.renderStats();
        }
    }

    saveExamHistory(level, score, total, results) {
        if (!GdprEngine.isConsentGranted('stats')) {
            console.log('Stats consent missing, skipping exam history save.');
            return;
        }
        try {
            let history = StorageService.get(StorageService.KEYS.EXAM_HISTORY) || { exams: [] };
            if (typeof history !== 'object' || !history.exams) {
                history = { exams: [] };
            }

            const exam = {
                id:
                    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                        ? crypto.randomUUID()
                        : Date.now().toString(),
                date: new Date().toISOString(),
                level: level,
                score: score,
                total: total,
                percentage: Math.round((score / total) * 100),
                results: results,
            };

            history.exams.unshift(exam); // Add to beginning
            history.exams = history.exams.slice(0, 10); // Keep only last 10

            StorageService.set(StorageService.KEYS.EXAM_HISTORY, history);
            if (window.FirebaseAuthEngine && window.FirebaseAuthEngine.enabled) {
                window.FirebaseAuthEngine.saveHistoryToCloud();
            }
        } catch (e) {
            console.error('Failed to save exam history', e);
        }
    }

    importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';

        input.addEventListener('change', async (e) => {
            const file = /** @type {HTMLInputElement} */ (e.target).files[0];
            if (!file) return;

            try {
                const data = JSON.parse(await file.text());

                // Basic validation of the file structure
                if (!data.stats || !data.examHistory) {
                    alert(tql('dialogs.importInvalid'));
                    return;
                }

                if (confirm(tql('dialogs.importConfirm'))) {
                    // Save directly to localStorage
                    StorageService.set(StorageService.KEYS.QCM_STATS, data.stats);
                    StorageService.set(StorageService.KEYS.EXAM_HISTORY, { exams: data.examHistory });

                    // Force update of current runtime stats if needed?
                    // Actually getPersistentStats reads from localStorage so it's fine.

                    alert(tql('dialogs.importDone'));

                    try {
                        // Refresh stats display
                        this.renderStats();
                    } catch (renderError) {
                        console.error('Render failed after import', renderError);
                        alert(tql('dialogs.importRenderError'));
                    }
                }
            } catch (e) {
                console.error('Import failed', e);
                alert(tql('dialogs.importError', { error: e.message }));
            }
        });

        input.click();
    }

    toggleExamDetails(examId) {
        const card = document.querySelector(`[data-exam-id="${examId}"]`);
        if (!card) return;

        const detailsDiv = /** @type {HTMLElement} */ (card.querySelector('.exam-details'));
        const arrow = /** @type {HTMLElement} */ (card.querySelector('.exam-arrow'));

        if (!detailsDiv) return;

        const isExpanded = detailsDiv.style.display !== 'none';

        if (isExpanded) {
            detailsDiv.style.display = 'none';
            if (arrow) arrow.style.transform = 'rotate(0deg)';
        } else {
            detailsDiv.style.display = 'block';
            if (arrow) arrow.style.transform = 'rotate(180deg)';
        }
    }

    exportData() {
        try {
            const stats = QuizService.getPersistentStats();
            const examHistory = QuizService.getExamHistory();

            const data = {
                stats: stats,
                examHistory: examHistory,
                exportDate: new Date().toISOString(),
                version: '1.0',
            };

            const json = JSON.stringify(data, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0];
            const timeStr =
                now.getHours().toString().padStart(2, '0') + '-' + now.getMinutes().toString().padStart(2, '0');
            a.download = `parapente_stats_${dateStr}_${timeStr}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            alert(tql('dialogs.exportDone'));
        } catch (e) {
            console.error('Export failed', e);
            alert(tql('dialogs.exportError'));
        }
    }

    getCourseUrl(questionCode) {
        const links = this.getCourseLinks(questionCode);
        return links.length ? links[0].url : null;
    }

    /**
     * Tous les endroits du cours qui justifient la réponse : la source principale, puis les sources
     * supplémentaires quand plusieurs bonnes réponses relèvent de cours (ou de pages) différents.
     * Convention déjà utilisée pour ouvrir un PDF (manual.js openCourse) : chemin relatif ouvert par
     * le navigateur, qui supporte nativement l'ancre #page=N pour sauter à la bonne page sans avoir
     * à construire un lecteur PDF dédié.
     */
    getCourseLinks(questionCode) {
        const q = this.getQuestionByCode(questionCode);
        if (!q) return [];
        const candidates = [{ courseId: q.courseId, coursePage: q.coursePage }, ...(q.extraCourses || [])];
        const seen = new Set();
        const links = [];
        for (const { courseId, coursePage } of candidates) {
            if (!courseId || !coursePage) continue;
            const course = COURSES_DATA[courseId];
            if (!course || !course.pdf) continue;
            const url = `${course.pdf}#page=${coursePage}`;
            if (seen.has(url)) continue;
            seen.add(url);
            links.push({ url, title: course.title || courseId, page: coursePage });
        }
        return links;
    }
}
