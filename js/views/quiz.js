import GlobalState from '../core/app_state.js';
import AppRouter from '../core/router.js';
import QuizService from '../services/quiz_service.js';
import { escapeHTML } from '../core/security.js';
import { formatDateOnly } from '../utils/date_utils.js';
import AppEvents from '../core/events.js';
import VoiceService from '../services/voice_service.js';

import { optionLetter } from '../services/quiz_voice.js';
import { tq, tql } from './quiz_strings.js';
import { QuizVoiceBase } from './quiz_voice_ui.js';

/**
 * PURE VIEW - QuizView
 * S'occupe uniquement du rendu HTML et de l'écoute des événements (Event Delegation)
 */

class QuizViewClass extends QuizVoiceBase {
    constructor() {
        super();

        this.state = {
            masteryFilter: 'ALL',
            themeFilter: null,
            themeSort: 'alpha',
            themeSortDir: 'asc',
            questionSort: 'rate',
            questionSortDir: 'asc',
        };

        Object.assign(this, {
            handleClick: this.handleClick.bind(this),
            handleChange: this.handleChange.bind(this),
        });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                const qcmScreen = document.getElementById('qcm-screen');
                const isQcmScreenActive = qcmScreen && qcmScreen.classList.contains('active');

                if (
                    isQcmScreenActive &&
                    typeof QuizService !== 'undefined' &&
                    QuizService.state &&
                    QuizService.state.qcmConfig.mode === 'EXAM'
                ) {
                    const totalQuestions = QuizService.state.qcmSessionData.length;
                    const answeredQuestions = QuizService.state.examResults.length;

                    if (answeredQuestions < totalQuestions && !QuizService.state.invalidated) {
                        this.invalidateExam();
                    }
                }
            }
        });
    }

    invalidateExam() {
        alert(tql('dialogs.examInvalidated'));
        QuizService.state.invalidated = true;
        this.renderExamResults();
    }

    getQuestionByCode(code) {
        return QuizService.getQuestionByCode(code);
    }

    async mount(container) {
        await super.mount(container);
        console.log('QuizView: mount started');

        try {
            console.log('QuizView: Initializing QuizService in background...');
            // Non-blocking initialization
            QuizService.init()
                .then(() => {
                    console.log('QuizView: QuizService initialized successfully.');
                    if (this.renderThemeOptions) this.renderThemeOptions();

                    // Re-render the correct screen based on routing mode if needed
                    const mode = GlobalState.get('mode');
                    if (mode === 'STATS') {
                        this.renderStats();
                    } else if (mode === 'QCM_BANK') {
                        this.showBankScreen();
                    }
                })
                .catch((e) => {
                    console.error('QuizView: Error initializing QuizService', e);
                });

            // Show skeleton/UI instantly
            const mode = GlobalState.get('mode');
            if (mode === 'STATS') {
                this.showStatsScreen();
            } else if (mode === 'QCM_BANK') {
                this.showBankScreen();
            } else {
                this.showSetupScreen();
            }

            // Bind and add event listeners for dynamic filters & internal clicks
            this._handleClick = this.handleClick.bind(this);
            document.body.addEventListener('click', this._handleClick);

            this._handleChange = this.handleChange.bind(this);
            const themeSelect = document.getElementById('qcm-theme-select');
            if (themeSelect) themeSelect.addEventListener('change', this._handleChange);

            const bankFilter = document.getElementById('bank-theme-filter');
            if (bankFilter) bankFilter.addEventListener('change', this._handleChange);

            const bankSearch = document.getElementById('bank-search');
            if (bankSearch) bankSearch.addEventListener('input', this._handleChange);

            // Subscribe to level changes to re-render dynamic content (QCM Bank, Stats)
            this._unsubscribeLevel = GlobalState.subscribe('level', () => {
                const bankScreen = document.getElementById('qcm-bank-screen');
                if (bankScreen && bankScreen.classList.contains('active')) {
                    this.showBankScreen();
                }

                const statsScreen = document.getElementById('stats-screen');
                if (statsScreen && statsScreen.classList.contains('active')) {
                    this.renderStats();
                }
            });
        } catch (e) {
            console.error('QuizView: Error in mount', e);
            this.renderErrorState(tql('dialogs.loadFailed', { error: e.message || tql('dialogs.unknownError') }));
        }
    }

    async unmount() {
        await super.unmount();
        this.stopVoice();
        if (this._handleClick) document.body.removeEventListener('click', this._handleClick);

        if (this._unsubscribeLevel) {
            this._unsubscribeLevel();
            this._unsubscribeLevel = null;
        }

        const themeSelect = document.getElementById('qcm-theme-select');
        if (themeSelect && this._handleChange) themeSelect.removeEventListener('change', this._handleChange);

        const bankFilter = document.getElementById('bank-theme-filter');
        if (bankFilter && this._handleChange) bankFilter.removeEventListener('change', this._handleChange);

        const bankSearch = document.getElementById('bank-search');
        if (bankSearch && this._handleChange) bankSearch.removeEventListener('input', this._handleChange);

        // Cache les écrans
        const screens = ['qcm-setup-screen', 'qcm-screen', 'stats-screen', 'qcm-bank-screen'];
        screens.forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.classList.remove('active');
        });
    }

    // --- EVENT DELEGATION ---
    handleClick(e) {
        // Find closest element with data-action
        const target = e.target.closest('[data-action]');
        if (!target) return;

        const action = target.getAttribute('data-action');
        const rawValue = target.getAttribute('data-args') || target.getAttribute('data-value');
        let args = [];

        if (rawValue) {
            try {
                if (rawValue.startsWith('[')) {
                    // Convert faux-array "['alpha']" or "['PERFECT']" to valid JSON '["alpha"]'
                    args = JSON.parse(rawValue.replace(/'/g, '"'));
                } else {
                    const value = rawValue.replace(/^'|'$/g, '');
                    args = [value];
                }
            } catch {
                const value = rawValue.replace(/^'|'$/g, '');
                args = [value];
            }
        }

        // setQcmMode, setQcmCount, setMasteryTarget and goBack are registered in js/core/main.js:
        // handling them here too would run them twice per click (spec 018).
        switch (action) {
            case 'QuizsetThemeSort':
                this.setThemeSort(args[0]);
                break;
            case 'QuizsetMasteryFilter':
                this.setMasteryFilter(args[0]);
                break;
            case 'QuizsetThemeFilter':
                this.setThemeFilter(args[0]);
                break;
            case 'QuiztoggleQuestionDetails':
                this.toggleQuestionDetails(args[0]);
                break;
            case 'QuizsortQuestions':
                this.sortQuestions(args[0]);
                break;
            case 'QuizresetStats':
                this.resetStats();
                break;
            case 'QuizclearAllFilters':
                this.clearAllFilters();
                break;
            case 'QuiztoggleExamDetails':
                this.toggleExamDetails(args[0]);
                break;
            case 'QuizexportData':
                if (this.exportData) this.exportData();
                break;
            case 'QuizimportData':
                if (this.importData) this.importData();
                break;
            case 'back-to-setup':
                this.showSetupScreen();
                break;
            case 'show-stats':
                e.preventDefault();
                this.showStatsScreen();
                break;
            case 'toggle-option':
                this.toggleOptionSelection(target);
                break;
            case 'validate-question':
                this.validateQuestion();
                break;
            case 'next-question':
                this.renderQuestion(QuizService.nextQuestion());
                break;
            case 'prev-question':
                this.renderQuestion(QuizService.prevQuestion());
                break;
            case 'finish-session':
                AppRouter.navigate('QCM');
                break;
            case 'quiz-voice-read':
                this.toggleReadAloud();
                break;
            case 'quiz-voice-auto':
                this.toggleAutoRead();
                break;
            case 'quiz-voice-mic':
                this.toggleVoiceAnswers();
                break;
            case 'quiz-voice-consent':
                this.acceptVoiceConsent();
                break;
            case 'quiz-voice-cancel':
                this._voiceNoticeOpen = false;
                this.renderVoiceBar();
                break;
            case 'quiz-voice-revoke':
                this.revokeVoiceConsent();
                break;
            default:
                return;
        }
        // The app-wide delegation (AppEvents) runs after this listener: tell it the action was
        // handled, so it neither warns "Unregistered action" nor tries a fallback (spec 018).
        AppEvents.markHandled(e);
    }

    handleChange(e) {
        if (e.target.id === 'qcm-theme-select') {
            QuizService.setTheme(e.target.value);
            this.updateRevisionSummary();
        } else if (e.target.id === 'bank-theme-filter' || e.target.id === 'bank-search') {
            const select = /** @type {HTMLSelectElement} */ (document.getElementById('bank-theme-filter'));
            this.renderBankContent(select ? select.value : 'ALL');
        }
    }

    // --- UI UPDATES ---
    showBankScreen() {
        document.querySelectorAll('.mode-screen').forEach((s) => s.classList.remove('active'));
        const bankScreen = document.getElementById('qcm-bank-screen');
        if (bankScreen) {
            bankScreen.classList.add('active');
            const select = /** @type {HTMLSelectElement} */ (document.getElementById('bank-theme-filter'));
            this.renderBankContent(select ? select.value : 'ALL');
        }
    }

    renderBankContent(themeFilter) {
        const container = document.getElementById('bank-results');
        if (!container) return;

        const searchInput = /** @type {HTMLInputElement} */ (document.getElementById('bank-search'));
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

        let sourceData = QuizService.getQuestions();

        // Filter by selected level
        const level = GlobalState.get('level') || 'BI';
        const hasLevel = (code, letter) => code.replace(/^[a-zA-Z]+\d+/, '').includes(letter);

        if (level === 'BI') {
            sourceData = sourceData.filter((q) => hasLevel(q.code, 'V'));
        } else if (level === 'BP') {
            sourceData = sourceData.filter((q) => hasLevel(q.code, 'B'));
        } else if (level === 'BPC') {
            sourceData = sourceData.filter((q) => hasLevel(q.code, 'M'));
        } else if (level === 'TREUIL') {
            sourceData = sourceData.filter((q) => hasLevel(q.code, 'T'));
        }

        if (themeFilter && themeFilter !== 'ALL') {
            sourceData = sourceData.filter((q) => q.theme === themeFilter);
        }

        if (searchTerm) {
            sourceData = sourceData.filter(
                (q) =>
                    q.question.toLowerCase().includes(searchTerm) ||
                    q.code.toLowerCase().includes(searchTerm) ||
                    (q.explication && q.explication.toLowerCase().includes(searchTerm)),
            );
        }

        // Exclude specific prefixes that were skipped in actual quiz
        const excludedPrefixes = ['H', 'R', 'X'];
        sourceData = sourceData.filter((q) => !excludedPrefixes.includes(q.code.charAt(0)));

        if (sourceData.length === 0) {
            container.innerHTML = `<p style="text-align:center; opacity:0.6; padding: 2rem;">${tq('bank.empty')}</p>`;
            return;
        }

        let html = '';
        sourceData.forEach((q) => {
            const letters = q.code.replace(/^[a-zA-Z]+\d+/, '');
            let colorStyle = '';

            const colorMap = {
                V: 'rgba(34, 197, 94, 0.2)', // Vert
                B: 'rgba(59, 130, 246, 0.2)', // Bleu
                M: 'rgba(139, 69, 19, 0.2)', // Marron
                T: 'rgba(168, 85, 247, 0.2)', // Violet
            };
            const textColors = {
                V: 'var(--level-text-V, #4ade80)',
                B: 'var(--level-text-B, #60a5fa)',
                M: 'var(--level-text-M, #c0773d)',
                T: 'var(--level-text-T, #c084fc)',
            };

            const validLetters = letters.split('').filter((l) => colorMap[l]);
            if (validLetters.length === 1) {
                colorStyle = `background: ${colorMap[validLetters[0]]}; color: ${textColors[validLetters[0]]}; border: 1px solid ${colorMap[validLetters[0]].replace('0.2', '0.4')};`;
            } else if (validLetters.length > 1) {
                const stops = [];
                const step = 100 / validLetters.length;
                validLetters.forEach((l, i) => {
                    stops.push(`${colorMap[l]} ${i * step}%`);
                    stops.push(`${colorMap[l]} ${(i + 1) * step}%`);
                });
                colorStyle = `background: linear-gradient(90deg, ${stops.join(', ')}); border: 1px solid rgba(255,255,255,0.1); color: var(--text-main); text-shadow: 0 1px 2px rgba(0,0,0,0.5);`;
            }

            html += `
                <div class="bank-item">
                    <div class="bank-item-header">
                        <span class="bank-item-code" style="${colorStyle}">${escapeHTML(q.code)}</span>
                        <span class="bank-item-theme">${escapeHTML(q.theme)}</span>
                    </div>
                    <div class="bank-item-question">${escapeHTML(q.question)}</div>
                    <div class="bank-item-choices">
                        ${q.choices
                            .map(
                                (c) => `
                            <div class="bank-choice ${c.pts > 0 ? 'correct' : c.pts < 0 ? 'incorrect' : ''}">
                                ${escapeHTML(c.text)} ${c.pts > 0 ? '(+' + c.pts + ')' : c.pts < 0 ? '(' + c.pts + ')' : ''}
                            </div>
                        `,
                            )
                            .join('')}
                    </div>
                    ${q.explication ? `<div class="bank-item-explication">${escapeHTML(q.explication)}</div>` : ''}
                </div>
            `;
        });

        container.innerHTML = html;
    }

    updateModeUI(mode, targetBtn) {
        document.querySelectorAll('.mode-toggle-btn').forEach((btn) => btn.classList.remove('active'));
        if (targetBtn) {
            targetBtn.classList.add('active');
        } else {
            // fallback
            const btn =
                document.querySelector(`[data-args="'${mode}'"]`) || document.querySelector(`[data-value="${mode}"]`);
            if (btn) btn.classList.add('active');
        }

        const descEl = document.getElementById('mode-description');
        if (descEl) {
            if (mode === 'EXAM') {
                descEl.innerText = tql('modes.examDescription');
            } else if (mode === 'REVISION') {
                descEl.innerText = tql('modes.revisionDescription');
            } else if (mode === 'MASTERY') {
                descEl.innerText = tql('modes.masteryDescription');
            } else {
                descEl.innerText = tql('modes.trainingDescription');
            }
        }

        this.updateRevisionSummary();

        const trainingOptions = document.getElementById('training-options');
        if (trainingOptions) {
            if (mode === 'EXAM') {
                trainingOptions.style.opacity = '0.3';
                trainingOptions.style.pointerEvents = 'none';
            } else {
                trainingOptions.style.opacity = '1';
                trainingOptions.style.pointerEvents = 'auto';
            }
        }

        const countGroup = document.getElementById('qcm-count-group');
        if (countGroup) countGroup.style.display = mode === 'MASTERY' ? 'none' : '';

        const themeLabel = document.getElementById('qcm-theme-label');
        if (themeLabel) {
            themeLabel.innerText = tql(mode === 'MASTERY' ? 'modes.themeLabelMastery' : 'modes.themeLabel');
        }

        const masteryOptions = document.getElementById('mastery-options');
        if (masteryOptions) masteryOptions.style.display = mode === 'MASTERY' ? '' : 'none';
    }

    // Mode Révision : combien de questions sont à réviser, et pourquoi la session peut proposer des
    // questions qui ne sont pas encore à réviser (spec 035).
    updateRevisionSummary() {
        const el = document.getElementById('revision-summary');
        if (!el) return;
        if (QuizService.state.qcmConfig.mode !== 'REVISION' || !QuizService.state.isLoaded) {
            el.hidden = true;
            el.textContent = '';
            return;
        }
        const level = (typeof GlobalState !== 'undefined' && GlobalState.get('level')) || 'BI';
        const summary = QuizService.getReviewSummary(level);
        if (summary.total === 0) {
            el.hidden = true;
            el.textContent = '';
            return;
        }
        if (summary.due + summary.fresh > 0) {
            el.textContent = tql('modes.revisionSummary', { due: summary.due, fresh: summary.fresh });
        } else if (summary.nextDueAt !== null) {
            el.textContent = tql('modes.revisionNothingDue', { date: formatDateOnly(new Date(summary.nextDueAt)) });
        } else {
            el.textContent = tql('modes.revisionNothingDueNoDate');
        }
        el.hidden = false;
    }

    updateMasteryTargetUI(target, targetBtn) {
        const container = document.getElementById('mastery-options');
        if (!container) return;
        container.querySelectorAll('.count-btn').forEach((btn) => btn.classList.remove('active'));
        if (targetBtn) {
            targetBtn.classList.add('active');
        } else {
            const btn = container.querySelector(`[data-args="${target}"]`);
            if (btn) btn.classList.add('active');
        }
    }

    updateCountUI(countVal, targetBtn) {
        document.querySelectorAll('.count-btn').forEach((btn) => btn.classList.remove('active'));
        if (targetBtn) {
            targetBtn.classList.add('active');
        } else {
            // fallback
            const btn =
                document.querySelector(`[data-args="${countVal}"]`) ||
                document.querySelector(`[data-value="${countVal}"]`);
            if (btn) btn.classList.add('active');
        }
    }

    renderThemeOptions() {
        const select = document.getElementById('qcm-theme-select');
        if (!select) return;
        const themes = QuizService.getThemes();
        themes.forEach((t) => {
            const opt = document.createElement('option');
            opt.value = t;
            opt.innerText = t;
            select.appendChild(opt);
        });
    }

    showSetupScreen() {
        document.querySelectorAll('.mode-screen').forEach((s) => s.classList.remove('active'));
        document.getElementById('qcm-setup-screen').classList.add('active');
    }

    startSession() {
        try {
            const level = typeof GlobalState !== 'undefined' ? GlobalState.get('level') : 'BI';
            const firstQuestion = QuizService.startSession(level);

            document.querySelectorAll('.mode-screen').forEach((s) => s.classList.remove('active'));
            document.getElementById('qcm-screen').classList.add('active');

            this.renderQuestion(firstQuestion);
        } catch (e) {
            alert(e.message);
        }
    }

    renderQuestion(q) {
        VoiceService.stopSpeaking();
        this._voiceQuestion = q || null;
        this._voiceFeedback = null;

        const feedbackDiv = document.getElementById('qcm-feedback');
        feedbackDiv.style.display = 'none';

        const container = document.getElementById('qcm-question-text');
        const choicesDiv = document.getElementById('qcm-choices');
        const actionsDiv = document.getElementById('qcm-actions-container');

        if (!q) {
            // End of quiz
            this.stopVoice();
            this.renderVoiceBar();
            this.renderExamResults();
            return;
        }

        // Question suivante/précédente : l'écran garde sinon la position de l'explication précédente,
        // et la nouvelle question reste hors de vue au-dessus.
        const qcmScreen = document.getElementById('qcm-screen');
        if (qcmScreen) qcmScreen.scrollTo({ top: 0 });
        window.scrollTo({ top: 0 });

        const qIdx = QuizService.state.qcmIndex + 1;
        const total = QuizService.state.qcmSessionData.length;

        const modeLabelEl = document.getElementById('qcm-mode-label');
        if (modeLabelEl) {
            const mode = QuizService.state.qcmConfig.mode;
            modeLabelEl.innerText = tql(
                `modes.labels.${['EXAM', 'REVISION', 'MASTERY'].includes(mode) ? mode : 'TRAINING'}`,
            );
        }

        const masteryProgressEl = document.getElementById('qcm-mastery-progress');
        if (masteryProgressEl) {
            if (QuizService.state.qcmConfig.mode === 'MASTERY') {
                const progress = QuizService.getMasteryProgress();
                masteryProgressEl.style.display = progress ? 'block' : 'none';
                if (progress) {
                    masteryProgressEl.innerText = tql('question.masteryProgress', {
                        target: progress.target,
                        current: progress.current,
                    });
                }
            } else {
                masteryProgressEl.style.display = 'none';
            }
        }

        let badgeHtml = '';
        if (QuizService.state.qcmConfig.mode === 'REVISION') {
            const stats = QuizService.getPersistentStats();
            const s = stats.questions[q.code];
            if (!s || s.total === 0) {
                badgeHtml = `<div class="quiz-theme-tag" style="background:var(--accent-orange, #3b82f6); color:#fff; border-color:var(--accent-orange, #3b82f6); margin-left: 8px;"><i class="ri-sparkling-line"></i> ${tq('question.new')}</div>`;
            } else {
                badgeHtml = `<div class="quiz-theme-tag" style="background:#f87171; color:#fff; border-color:#f87171; margin-left: 8px;"><i class="ri-refresh-line"></i> ${tq('question.toReview')}</div>`;
            }
        }

        const letters = q.code.replace(/^[a-zA-Z]+\d+/, '');
        let colorStyle = '';
        const colorMap = {
            V: 'rgba(34, 197, 94, 0.2)', // Vert
            B: 'rgba(59, 130, 246, 0.2)', // Bleu
            M: 'rgba(139, 69, 19, 0.2)', // Marron
            T: 'rgba(168, 85, 247, 0.2)', // Violet
        };
        const textColors = {
            V: 'var(--level-text-V, #4ade80)',
            B: 'var(--level-text-B, #60a5fa)',
            M: 'var(--level-text-M, #c0773d)',
            T: 'var(--level-text-T, #c084fc)',
        };

        const validLetters = letters.split('').filter((l) => colorMap[l]);
        if (validLetters.length === 1) {
            colorStyle = `background: ${colorMap[validLetters[0]]}; color: ${textColors[validLetters[0]]}; border: 1px solid ${colorMap[validLetters[0]].replace('0.2', '0.4')};`;
        } else if (validLetters.length > 1) {
            const stops = [];
            const step = 100 / validLetters.length;
            validLetters.forEach((l, i) => {
                stops.push(`${colorMap[l]} ${i * step}%`);
                stops.push(`${colorMap[l]} ${(i + 1) * step}%`);
            });
            colorStyle = `background: linear-gradient(90deg, ${stops.join(', ')}); border: 1px solid rgba(255,255,255,0.1); color: var(--text-main); text-shadow: 0 1px 2px rgba(0,0,0,0.5);`;
        }

        container.innerHTML = `
            <div class="quiz-header-row">
                <div class="quiz-meta" style="display:flex; align-items:center;">
                    <span class="bank-item-code" style="margin-right: 8px; ${colorStyle}">${escapeHTML(q.code)}</span>
                    <div class="quiz-theme-tag">${escapeHTML(q.theme)}</div>
                    ${badgeHtml}
                    <div class="quiz-progress" style="margin-left: auto;">${tq('question.progress', { index: qIdx, total })}</div>
                </div>
            </div>
            <div class="quiz-question-text">${escapeHTML(q.question)}</div>
        `;

        // Render choices (spec 016 : lettres affichées dès que le mode vocal est disponible)
        const withLetters = this.isVoiceAvailable();
        choicesDiv.innerHTML = q.choices
            .map(
                (opt, idx) => `
            <button class="qcm-option" data-action="toggle-option" data-idx="${idx}">
                ${withLetters ? `<span class="qcm-option-letter">${optionLetter(idx)}</span>` : ''}${escapeHTML(opt.text)}
            </button>
        `,
            )
            .join('');

        // Cache choices for reference during selection
        this._currentChoices = q.choices;

        // Render Actions
        actionsDiv.innerHTML = `
            ${qIdx > 1 ? '<button class="next-btn" data-action="prev-question" style="flex:0 0 60px;"><i class="ri-arrow-left-line"></i></button>' : ''}
            <button class="next-btn" id="qcm-validate-btn" data-action="validate-question" style="flex:1;">${tq('question.validate')}</button>
        `;

        // Si on revient sur une question déjà validée (bouton "retour"), on réaffiche son état
        // corrigé (réponses figées + explication) au lieu d'une question vierge : sinon il suffit
        // de cliquer sur la bonne réponse qu'on vient de voir surlignée, sans aucun effort.
        const isExam = QuizService.state.qcmConfig.mode === 'EXAM';
        const existingResult = QuizService.state.examResults[QuizService.state.qcmIndex];
        if (existingResult && !isExam) {
            this.showAnswerFeedback(existingResult, qIdx > 1);
        }

        this.renderVoiceBar();
        if (VoiceService.getPrefs().autoRead) this.readAloud();
    }

    toggleOptionSelection(btnElement) {
        const idx = parseInt(btnElement.getAttribute('data-idx'));
        const opt = this._currentChoices[idx];
        const selectedOptions = QuizService.toggleSelection(opt);

        if (selectedOptions.includes(opt)) {
            btnElement.classList.add('selected');
        } else {
            btnElement.classList.remove('selected');
        }
    }

    validateQuestion() {
        const result = QuizService.validate();
        if (!result) return;

        const isExam = QuizService.state.qcmConfig.mode === 'EXAM';

        if (isExam) {
            this.renderQuestion(QuizService.nextQuestion());
        } else {
            this.showAnswerFeedback(result, QuizService.state.qcmIndex > 0);
            if (VoiceService.getPrefs().autoRead) this.readAloud({ auto: true });
        }
    }

    // Affiche les réponses figées (corrigées) + l'explication, que ce soit juste après avoir
    // validé ou en revenant sur une question déjà répondue via le bouton "retour".
    showAnswerFeedback(result, showBackButton) {
        const btns = /** @type {NodeListOf<HTMLButtonElement>} */ (document.querySelectorAll('.qcm-option'));

        btns.forEach((btn) => {
            btn.disabled = true;
            const idx = parseInt(btn.getAttribute('data-idx'));
            const opt = this._currentChoices[idx];
            const isSelected = result.selected.includes(opt);

            if (opt.pts > 0) {
                if (isSelected) {
                    btn.classList.add('correct');
                    if (!btn.innerHTML.includes('ri-check-double-line')) {
                        btn.innerHTML += ' <i class="ri-check-double-line"></i>';
                    }
                } else {
                    btn.classList.add('missed');
                }
            } else if (opt.pts < 0 && isSelected) {
                btn.classList.add('incorrect');
            }
        });

        const actionsDiv = document.getElementById('qcm-actions-container');
        actionsDiv.innerHTML = `
            ${showBackButton ? '<button class="next-btn" data-action="prev-question" style="flex:0 0 60px;"><i class="ri-arrow-left-line"></i></button>' : ''}
            <button class="next-btn" data-action="next-question" style="flex:1;">${tq('question.next')} <i class="ri-arrow-right-line"></i></button>
        `;

        const courseUrl = this.getCourseUrl(result.question.code);

        const feedbackDiv = document.getElementById('qcm-feedback');
        feedbackDiv.style.display = 'block';
        feedbackDiv.innerHTML = `
            <div class="instructor-feedback ${result.isCorrect ? 'feedback-success' : 'feedback-fail'}">
                <div>${escapeHTML(result.question.explication)}</div>
                ${courseUrl ? `<button data-action="openUrl" data-url="${escapeHTML(courseUrl)}" style="margin-top:10px; background:var(--accent-orange); color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; font-size:0.75rem; font-weight:700; display:inline-flex; align-items:center; gap:4px;"><i class="ri-book-open-line"></i> ${tq('question.seeCourse')}</button>` : ''}
            </div>
        `;

        this._voiceFeedback = result;
        this.renderVoiceBar();
    }

    // ------------------------------------------------------------------ mode vocal (spec 016)

    renderExamResults() {
        const isExam = QuizService.state.qcmConfig.mode === 'EXAM';
        const sessionMode = QuizService.state.qcmConfig.mode;
        const modeTitle = tql(
            `modes.labels.${['EXAM', 'REVISION', 'MASTERY'].includes(sessionMode) ? sessionMode : 'TRAINING'}`,
        );

        if (isExam) {
            const level = typeof GlobalState !== 'undefined' ? GlobalState.get('level') : 'BI';
            QuizService.saveExamHistory(level);
        }

        const container = document.getElementById('qcm-question-text');
        const choicesDiv = document.getElementById('qcm-choices');
        const actionsDiv = document.getElementById('qcm-actions-container');
        document.getElementById('qcm-feedback').style.display = 'none';
        const masteryProgressEl = document.getElementById('qcm-mastery-progress');
        if (masteryProgressEl) masteryProgressEl.style.display = 'none';

        // Update the mode label dynamically based on mode
        const modeLabel = document.getElementById('qcm-mode-label');
        if (modeLabel) modeLabel.innerText = modeTitle;

        const results = QuizService.state.examResults;
        const total =
            QuizService.state.qcmSessionData && QuizService.state.qcmSessionData.length > 0
                ? QuizService.state.qcmSessionData.length
                : results.length;
        const score = results.filter((r) => r.isCorrect).length;
        const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
        const passed = percentage >= 75;
        const isInvalidated = QuizService.state.invalidated === true;

        const badgeHtml = isInvalidated
            ? `<span style="background:rgba(248,113,113,0.1); color:#f87171; padding:4px 12px; border-radius:8px; font-size:1.1rem; font-weight:bold; border:1px solid #f87171;">${tq('results.invalidated')}</span>`
            : passed
              ? `<span style="background:rgba(74,222,128,0.1); color:#16a34a; padding:4px 12px; border-radius:8px; font-size:1.1rem; font-weight:bold; border:1px solid #4ade80;">${tq('results.passed')}</span>`
              : `<span style="background:rgba(248,113,113,0.1); color:#dc2626; padding:4px 12px; border-radius:8px; font-size:1.1rem; font-weight:bold; border:1px solid #f87171;">${tq('results.failed')}</span>`;

        container.innerHTML = `
            <div class="stats-circle-container" style="display:flex; flex-direction:column; align-items:center; gap:24px; margin-bottom: 32px;">
                <h2 style="margin:0;">${tq('results.title')}</h2>
                <div style="display:flex; align-items:center; justify-content:center; gap:32px; background:var(--bg-card); padding:24px 32px; border-radius:16px; border:1px solid var(--border-color); box-shadow:0 4px 6px rgba(0,0,0,0.05);">
                    <div class="stats-circle" style="margin:0;">${score}/${total}</div>
                    <div style="display:flex; flex-direction:column; gap:12px; align-items:center;">
                        <div style="font-size:2rem; font-weight:800; color:var(--text-main);">${percentage}%</div>
                        ${isExam ? badgeHtml : ''}
                    </div>
                </div>
            </div>
            
            <div style="margin-top: 32px; font-weight: 600; font-size: 1.2rem; border-bottom: 2px solid var(--border-color); padding-bottom: 12px; margin-bottom: 24px; color:var(--text-main);">
                ${tq('results.summary')}
            </div>
            
            <div class="bank-container" style="display: flex; flex-direction: column; gap: 20px;">
                ${
                    results.filter((r) => !r.isCorrect).length === 0
                        ? `<div style="text-align: center; padding: 32px; background: rgba(74, 222, 128, 0.1); border-radius: var(--radius-md); border:1px solid #4ade80; color: #16a34a;">
                        <i class="ri-trophy-line" style="font-size: 3rem; margin-bottom:16px; display:block;"></i>
                        <span style="font-size:1.2rem; font-weight:bold;">${tq('results.noError')}</span>
                    </div>`
                        : results
                              .filter((r) => !r.isCorrect)
                              .map(
                                  (r) => `
                    <div class="bank-item" style="border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 20px; background: var(--bg-card); box-shadow:0 2px 4px rgba(0,0,0,0.02);">
                        <div class="bank-item-header" style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items:center;">
                            <span class="bank-item-code" style="font-family:monospace; font-size:0.85rem; color:var(--text-secondary); background:rgba(0,0,0,0.05); padding:4px 8px; border-radius:4px;">#${escapeHTML(r.question.code)}</span>
                            <span class="badge" style="background:rgba(248,113,113,0.1); color:#dc2626; border:1px solid #f87171; padding:2px 8px; border-radius:4px; font-size:0.75rem; font-weight:bold;">${tq('results.wrong')}</span>
                        </div>
                        <div class="bank-item-question" style="font-weight: 600; font-size:1.1rem; margin-bottom: 16px; color:var(--text-main); line-height:1.4;">${escapeHTML(r.question.question)}</div>
                        <div class="bank-item-choices" style="display: flex; flex-direction: column; gap: 10px;">
                            ${r.question.choices
                                .map((c) => {
                                    const isUserSelected = r.selected.some((sel) => sel.text === c.text);
                                    const isCorrectChoice = c.pts > 0;

                                    let bgStyle =
                                        'background: transparent; border-color: var(--border-color); color: var(--text-secondary);';
                                    let icon =
                                        '<i class="ri-checkbox-blank-circle-line" style="color:var(--text-muted); margin-right: 8px;"></i>';
                                    let borderStyle = '1px solid var(--border-color)';

                                    if (isUserSelected && isCorrectChoice) {
                                        // Cochee et Juste -> Vert
                                        bgStyle = 'background: rgba(74, 222, 128, 0.15); color: var(--text-main);';
                                        borderStyle = '2px solid #4ade80';
                                        icon =
                                            '<i class="ri-checkbox-circle-fill" style="color:#16a34a; font-size:1.2rem; margin-right: 8px;"></i>';
                                    } else if (isUserSelected && !isCorrectChoice) {
                                        // Cochee et Fausse -> Rouge
                                        bgStyle = 'background: rgba(248, 113, 113, 0.15); color: var(--text-main);';
                                        borderStyle = '2px solid #f87171';
                                        icon =
                                            '<i class="ri-close-circle-fill" style="color:#dc2626; font-size:1.2rem; margin-right: 8px;"></i>';
                                    } else if (!isUserSelected && isCorrectChoice) {
                                        // Non Cochee et Juste (Oubli) -> Orange
                                        bgStyle = 'background: rgba(251, 146, 60, 0.15); color: var(--text-main);';
                                        borderStyle = '2px solid #fb923c';
                                        icon =
                                            '<i class="ri-error-warning-fill" style="color:#ea580c; font-size:1.2rem; margin-right: 8px;"></i>';
                                    }

                                    return `
                                <div class="bank-choice" style="${bgStyle} border: ${borderStyle}; padding: 12px 16px; border-radius: 8px; font-size: 0.95rem; display: flex; justify-content: space-between; align-items:center;">
                                    <span style="display:flex; align-items:center; flex:1;">${icon} <span style="flex:1;">${escapeHTML(c.text)}</span></span>
                                    <span style="font-weight:bold; margin-left:12px; color:var(--text-secondary);">${isUserSelected ? `<i class="ri-user-line" style="margin-right: 4px;" title="${tq('results.yourAnswer')}"></i>` : ''}${c.pts > 0 ? '+' + c.pts : c.pts < 0 ? c.pts : ''}</span>
                                </div>
                                `;
                                })
                                .join('')}
                        </div>
                        ${r.question.explication ? `<div class="bank-item-explication" style="margin-top: 20px; font-size: 0.95rem; color: var(--text-main); background: rgba(251, 146, 60, 0.1); border-left:4px solid #fb923c; padding: 16px; border-radius: 0 8px 8px 0;"><div style="font-weight:bold; color:#ea580c; margin-bottom:4px; font-size:0.8rem; text-transform:uppercase;"><i class="ri-information-fill" style="margin-right: 4px;"></i>${tq('explanation')}</div>${escapeHTML(r.question.explication)}</div>` : ''}
                    </div>
                `,
                              )
                              .join('')
                }
            </div>
        `;

        choicesDiv.innerHTML = '';
        actionsDiv.innerHTML = `<button class="next-btn" data-action="finish-session" style="width:100%;">${tq('results.finish')}</button>`;
    }

    // --- STATISTICS MANAGEMENT ---
} // End Class

const QuizView = new QuizViewClass();
export default QuizView;
