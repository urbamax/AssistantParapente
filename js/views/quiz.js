import GlobalState from '../core/app_state.js';
import AppRouter from '../core/router.js';
import QuizService from '../services/quiz_service.js';
import BrevetService from '../services/brevet_service.js';
import { escapeHTML } from '../core/security.js';
import { formatDateOnly } from '../utils/date_utils.js';
import AppEvents from '../core/events.js';
import VoiceService from '../services/voice_service.js';

import { optionLetter } from '../services/quiz_voice.js';
import { pickWorkshopQuestions } from '../services/revision_axes.js';
import { tq, tql } from './quiz_strings.js';
import { courseLinksHtml } from './quiz_course_links.js';
import { explanationHtml } from './quiz_explanation.js';
import { buildOfficialTheoryBannerHtml } from './quiz_stats_html.js';
import { QuizVoiceBase } from './quiz_voice_ui.js';

/**
 * PURE VIEW - QuizView
 * S'occupe uniquement du rendu HTML et de l'écoute des événements (Event Delegation)
 */

// Durée hors de la page au-delà de laquelle l'examen est invalidé.
const EXAM_LEAVE_GRACE_MS = 15000;

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
            if (!document.hidden) {
                clearTimeout(this._examLeaveTimer);
                this._examLeaveTimer = null;
                if (this._examInvalidatedNotice) {
                    this._examInvalidatedNotice = false;
                    alert(tql('dialogs.examInvalidated'));
                }
                return;
            }
            if (!this.isExamInProgress()) return;
            // Un appel entrant ou un changement d'appli très court ne doit pas annuler l'examen.
            clearTimeout(this._examLeaveTimer);
            this._examLeaveTimer = setTimeout(() => {
                this._examLeaveTimer = null;
                if (document.hidden && this.isExamInProgress()) this.invalidateExam();
            }, EXAM_LEAVE_GRACE_MS);
        });
    }

    isExamInProgress() {
        const qcmScreen = document.getElementById('qcm-screen');
        const state = QuizService.state;
        return (
            !!qcmScreen &&
            qcmScreen.classList.contains('active') &&
            state.qcmConfig.mode === 'EXAM' &&
            !state.invalidated &&
            !state.examSaved &&
            state.examResults.length < state.qcmSessionData.length
        );
    }

    // Invalidation silencieuse : la page est masquée, l'alerte est montrée au retour de l'élève.
    invalidateExam() {
        QuizService.state.invalidated = true;
        this._examInvalidatedNotice = true;
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
                    this.updateThemeUI();
                    // Le résumé du mode Révision reste caché tant que les questions ne sont pas chargées :
                    // si le mode a été choisi entre-temps, il faut l'afficher maintenant.
                    this.updateRevisionSummary();
                    this.refreshMasterySlider();

                    // Re-render the correct screen based on routing mode if needed
                    const mode = GlobalState.get('mode');
                    if (mode === 'STATS') {
                        this.renderStats();
                    } else if (mode === 'REVISION_AXES') {
                        this.renderRevisionAxes();
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
            } else if (mode === 'REVISION_AXES') {
                this.showRevisionAxesScreen();
            } else if (mode === 'QCM_BANK') {
                this.showBankScreen();
            } else {
                this.showSetupScreen();
            }

            // Bind and add event listeners for dynamic filters & internal clicks
            this._handleClick = this.handleClick.bind(this);
            document.body.addEventListener('click', this._handleClick);

            this._handleKeydown = this.handleKeydown.bind(this);
            document.addEventListener('keydown', this._handleKeydown);

            this._handleChange = this.handleChange.bind(this);
            const themeSelect = document.getElementById('qcm-theme-select');
            if (themeSelect) {
                themeSelect.addEventListener('change', this._handleChange);
                themeSelect.addEventListener('input', this._handleChange);
            }

            const bankFilter = document.getElementById('bank-theme-filter');
            if (bankFilter) bankFilter.addEventListener('change', this._handleChange);

            const bankSearch = document.getElementById('bank-search');
            if (bankSearch) bankSearch.addEventListener('input', this._handleChange);

            // Subscribe to level changes to re-render dynamic content (QCM Bank, Stats)
            this._unsubscribeLevel = GlobalState.subscribe('level', () => {
                this.syncOfficialTheoryForLevel();
                this.updateThemeUI();
                this.updateRevisionSummary();
                this.refreshMasterySlider();

                const bankScreen = document.getElementById('qcm-bank-screen');
                if (bankScreen && bankScreen.classList.contains('active')) {
                    this.showBankScreen();
                }

                const statsScreen = document.getElementById('stats-screen');
                if (statsScreen && statsScreen.classList.contains('active')) {
                    this.renderStats();
                }

                const axesScreen = document.getElementById('revision-axes-screen');
                if (axesScreen && axesScreen.classList.contains('active')) {
                    this.renderRevisionAxes();
                }
            });

            this._onBrevetsUpdated = () => {
                this.syncOfficialTheoryForLevel();
                this.updateThemeUI();
                this.updateRevisionSummary();
                this.refreshMasterySlider();
                const statsScreen = document.getElementById('stats-screen');
                if (statsScreen && statsScreen.classList.contains('active')) {
                    this.renderStats();
                }
            };
            window.addEventListener('brevets:updated', this._onBrevetsUpdated);
        } catch (e) {
            console.error('QuizView: Error in mount', e);
            this.renderErrorState(tql('dialogs.loadFailed', { error: e.message || tql('dialogs.unknownError') }));
        }
    }

    async unmount() {
        await super.unmount();
        this.stopVoice();
        if (this._handleClick) document.body.removeEventListener('click', this._handleClick);
        if (this._handleKeydown) document.removeEventListener('keydown', this._handleKeydown);

        if (this._unsubscribeLevel) {
            this._unsubscribeLevel();
            this._unsubscribeLevel = null;
        }
        if (this._onBrevetsUpdated) {
            window.removeEventListener('brevets:updated', this._onBrevetsUpdated);
            this._onBrevetsUpdated = null;
        }

        const themeSelect = document.getElementById('qcm-theme-select');
        if (themeSelect && this._handleChange) {
            themeSelect.removeEventListener('change', this._handleChange);
            themeSelect.removeEventListener('input', this._handleChange);
        }

        const bankFilter = document.getElementById('bank-theme-filter');
        if (bankFilter && this._handleChange) bankFilter.removeEventListener('change', this._handleChange);

        const bankSearch = document.getElementById('bank-search');
        if (bankSearch && this._handleChange) bankSearch.removeEventListener('input', this._handleChange);

        // Cache les écrans
        const screens = ['qcm-setup-screen', 'qcm-screen', 'stats-screen', 'revision-axes-screen', 'qcm-bank-screen'];
        screens.forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.classList.remove('active');
        });
    }

    // --- KEYBOARD SHORTCUTS (question screen) ---
    // A-D or 1-4 tick an answer, Enter validates (or moves on once corrected), arrows go back/forward.
    // Each shortcut clicks the matching on-screen button so the click handler stays the only code path.
    handleKeydown(e) {
        if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
        const screen = document.getElementById('qcm-screen');
        if (!screen || !screen.classList.contains('active')) return;

        const target = /** @type {HTMLElement | null} */ (e.target);
        if (target?.closest('input, select, textarea, [contenteditable="true"], dialog, [role="dialog"], .modal'))
            return;
        // Other buttons (Lire, Répondre à la voix…) keep their native Enter/Space behaviour.
        const onOtherButton = target?.closest('button, a[href]') && !target.closest('.qcm-option');

        const press = (selector) => {
            const btn = /** @type {HTMLButtonElement | null} */ (screen.querySelector(selector));
            if (!btn || btn.disabled) return false;
            e.preventDefault();
            btn.click();
            return true;
        };

        if (e.key === 'Enter') {
            if (onOtherButton) return;
            if (!press('[data-action="validate-question"]')) press('[data-action="next-question"]');
        } else if (e.key === 'ArrowLeft') {
            press('[data-action="prev-question"]');
        } else if (e.key === 'ArrowRight') {
            press('[data-action="next-question"]');
        } else if (/^[a-dA-D1-4]$/.test(e.key)) {
            const idx = /\d/.test(e.key) ? Number(e.key) - 1 : e.key.toLowerCase().charCodeAt(0) - 97;
            press(`.qcm-option[data-idx="${idx}"]`);
        }
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
            case 'QuizshowRevisionAxes':
                this._activeWorkshopAxisId = null;
                if (AppRouter.routes && AppRouter.routes.has('REVISION_AXES')) {
                    AppRouter.navigate('REVISION_AXES');
                } else {
                    this.showRevisionAxesScreen();
                }
                break;
            case 'QuizsetAxesFilter':
                this.setAxesFilter(args[0]);
                break;
            case 'QuiztoggleAxisTakeaways':
                this.toggleAxisTakeaways(args[0]);
                break;
            case 'QuizstartAxisWorkshop':
                this.startAxisWorkshop(args[0]);
                break;
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
            this.updateThemeUI(e.target.value);
            this.updateRevisionSummary();
            this.refreshMasterySlider();
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

        // Même périmètre que les sessions : niveau choisi, sans les préfixes exclus du quiz.
        let sourceData = QuizService.getLevelQuestions(GlobalState.get('level') || 'BI');

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
                    ${q.explication ? `<div class="bank-item-explication">${explanationHtml(q.explication)}</div>` : ''}
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
        this.updateThemeUI();
        this.refreshMasterySlider();
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

    // Appelé quand le pilote déplace le curseur du palier objectif.
    updateMasteryTargetUI(target) {
        this._masteryTargetChoice = Number(target);
        this.showMasteryTarget(target);
    }

    showMasteryTarget(target) {
        const output = document.getElementById('mastery-target-value');
        if (output) output.textContent = `${target}%`;
        const slider = /** @type {HTMLInputElement | null} */ (document.getElementById('mastery-target-slider'));
        if (slider) slider.setAttribute('aria-valuetext', `${target}%`);
    }

    // Le curseur du palier va de 1 point au-dessus de la maîtrise actuelle du périmètre (niveau et
    // thème choisis) jusqu'à 100 %. À recalculer quand le niveau, le thème ou les statistiques changent.
    // Tant que le pilote n'a pas touché au curseur, il se place sur 75 % (ou sur son minimum si la
    // maîtrise actuelle est déjà plus haute) ; ensuite son choix est conservé, ramené dans la plage
    // (il revient tel quel si la plage s'élargit de nouveau, par exemple en changeant de thème).
    refreshMasterySlider() {
        const slider = /** @type {HTMLInputElement | null} */ (document.getElementById('mastery-target-slider'));
        if (!slider) return;
        const level = (typeof GlobalState !== 'undefined' && GlobalState.get('level')) || 'BI';
        const { current, min, max, complete } = QuizService.getMasteryTargetBounds(level);

        const wanted = this._masteryTargetChoice ?? 75;
        const value = Math.min(Math.max(wanted, min), max);
        slider.min = String(min);
        slider.max = String(max);
        slider.value = String(value);
        slider.disabled = min >= max;
        QuizService.setMasteryTarget(value);
        this.showMasteryTarget(value);

        // Déjà à 100 % sur ce périmètre : rien à perfectionner, on ne laisse pas lancer de série.
        const hint = document.getElementById('mastery-target-hint');
        if (hint) hint.textContent = complete ? tql('modes.masteryAtMax') : tql('modes.masteryCurrent', { current });
        const startBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('qcm-start-btn'));
        if (startBtn) startBtn.disabled = complete && QuizService.state.qcmConfig.mode === 'MASTERY';
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

    updateThemeUI(theme = QuizService.state.qcmConfig.theme) {
        const select = /** @type {HTMLSelectElement | null} */ (document.getElementById('qcm-theme-select'));
        if (!select) return;
        const currentTheme = theme || 'ALL';
        const hasOption = Array.from(select.options).some((opt) => opt.value === currentTheme);
        if (hasOption) {
            select.value = currentTheme;
        } else {
            select.value = 'ALL';
            QuizService.setTheme('ALL');
        }
    }

    renderThemeOptions() {
        const select = document.getElementById('qcm-theme-select');
        if (!select) return;
        // La vue est montée à chaque visite de l'écran : sans ce nettoyage, les thèmes
        // s'empilent dans la liste à chaque passage.
        select.querySelectorAll('option:not([value="ALL"])').forEach((opt) => opt.remove());
        QuizService.getThemes().forEach((t) => {
            const opt = document.createElement('option');
            opt.value = t;
            opt.innerText = t;
            select.appendChild(opt);
        });
        this.updateThemeUI();
    }

    showSetupScreen() {
        document.querySelectorAll('.mode-screen').forEach((s) => s.classList.remove('active'));
        document.getElementById('qcm-setup-screen').classList.add('active');
        this.syncOfficialTheoryForLevel();
        this.updateThemeUI();
        this.updateRevisionSummary();
        this.refreshMasterySlider();
    }

    syncOfficialTheoryForLevel() {
        const level = (typeof GlobalState !== 'undefined' && GlobalState.get('level')) || 'BI';
        const isValidated = BrevetService.isTheoryValidated(level);
        if (
            isValidated &&
            (QuizService.state.qcmConfig.mode === 'TRAINING' || QuizService.state.qcmConfig.mode === 'EXAM')
        ) {
            QuizService.setMode('REVISION');
            this.updateModeUI('REVISION');
        }
        this.renderOfficialTheoryBanner(level);
    }

    renderOfficialTheoryBanner(levelArg) {
        const setupScreen = document.getElementById('qcm-setup-screen');
        if (!setupScreen) return;
        const level = levelArg || (typeof GlobalState !== 'undefined' && GlobalState.get('level')) || 'BI';
        let slot = document.getElementById('qcm-brevet-banner-slot');
        if (!slot) {
            const grid = setupScreen.querySelector('.setup-grid');
            if (!grid || !grid.parentNode) return;
            slot = document.createElement('div');
            slot.id = 'qcm-brevet-banner-slot';
            grid.parentNode.insertBefore(slot, grid);
        }
        slot.innerHTML = buildOfficialTheoryBannerHtml(
            level,
            BrevetService.getBrevet(level),
            'data-quiz-brevet-banner',
        );
    }

    startSession() {
        try {
            this._activeWorkshopAxisId = null;
            const level = typeof GlobalState !== 'undefined' ? GlobalState.get('level') : 'BI';
            const firstQuestion = QuizService.startSession(level);

            document.querySelectorAll('.mode-screen').forEach((s) => s.classList.remove('active'));
            document.getElementById('qcm-screen').classList.add('active');

            this.renderQuestion(firstQuestion);
        } catch (e) {
            alert(e.message);
        }
    }

    startAxisWorkshop(axisId) {
        if (!axisId) return;
        const level = (typeof GlobalState !== 'undefined' && GlobalState.get('level')) || 'BI';
        const stats = QuizService.getPersistentStats();
        const picked = pickWorkshopQuestions(QuizService.getQuestions(), stats, {
            axisId,
            level,
            targetCount: 6,
        });
        if (!picked.length) return;

        const sessionQuestions = QuizService.shuffle(picked).map((q) => QuizService.shuffleQuestionChoices(q));
        this._activeWorkshopAxisId = axisId;
        QuizService._masteryPool = null;
        QuizService.state.qcmConfig.mode = 'TRAINING';
        QuizService.state.qcmIndex = 0;
        QuizService.state.qcmSessionData = sessionQuestions;
        QuizService.state.currentQcmSelection = new Set();
        QuizService.state.examResults = [];
        QuizService.state.invalidated = false;

        document.querySelectorAll('.mode-screen').forEach((s) => s.classList.remove('active'));
        const qcmScreen = document.getElementById('qcm-screen');
        if (qcmScreen) qcmScreen.classList.add('active');

        this.renderQuestion(sessionQuestions[0]);
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
            if (this._activeWorkshopAxisId) {
                modeLabelEl.innerText = tql('modes.labels.AXIS_WORKSHOP', {
                    title: tql(`axes.catalog.${this._activeWorkshopAxisId}.title`),
                });
            } else {
                const mode = QuizService.state.qcmConfig.mode;
                modeLabelEl.innerText = tql(
                    `modes.labels.${['EXAM', 'REVISION', 'MASTERY'].includes(mode) ? mode : 'TRAINING'}`,
                );
            }
        }

        this.refreshMasteryProgress();

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

    // Objectif du mode Perfectionnement et longueur de la série : ils changent dès qu'une réponse
    // est validée (la série peut se prolonger), pas seulement à la question suivante.
    refreshMasteryProgress() {
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

        const counterEl = document.querySelector('.quiz-progress');
        if (counterEl) {
            counterEl.textContent = tq('question.progress', {
                index: QuizService.state.qcmIndex + 1,
                total: QuizService.state.qcmSessionData.length,
            });
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
            this.refreshMasteryProgress();
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

        const courseLinks = this.getCourseLinks(result.question.code);

        const feedbackDiv = document.getElementById('qcm-feedback');
        feedbackDiv.style.display = 'block';
        feedbackDiv.innerHTML = `
            <details class="instructor-feedback ${result.isCorrect ? 'feedback-success' : 'feedback-fail'}"${result.isCorrect ? '' : ' open'}>
                <summary>${tq('question.explanation')}</summary>
                <div>${explanationHtml(result.question.explication)}</div>
                ${courseLinksHtml(courseLinks)}
            </details>
        `;

        this._voiceFeedback = result;
        this.renderVoiceBar();
    }

    // ------------------------------------------------------------------ mode vocal (spec 016)

    renderExamResults() {
        const isExam = QuizService.state.qcmConfig.mode === 'EXAM';
        const sessionMode = QuizService.state.qcmConfig.mode;
        const modeTitle = this._activeWorkshopAxisId
            ? tql('modes.labels.AXIS_WORKSHOP', {
                  title: tql(`axes.catalog.${this._activeWorkshopAxisId}.title`),
              })
            : tql(`modes.labels.${['EXAM', 'REVISION', 'MASTERY'].includes(sessionMode) ? sessionMode : 'TRAINING'}`);

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
                        ${r.question.explication ? `<div class="bank-item-explication" style="margin-top: 20px; font-size: 0.95rem; color: var(--text-main); background: rgba(251, 146, 60, 0.1); border-left:4px solid #fb923c; padding: 16px; border-radius: 0 8px 8px 0;"><div style="font-weight:bold; color:#ea580c; margin-bottom:4px; font-size:0.8rem; text-transform:uppercase;"><i class="ri-information-fill" style="margin-right: 4px;"></i>${tq('explanation')}</div>${explanationHtml(r.question.explication)}</div>` : ''}
                    </div>
                `,
                              )
                              .join('')
                }
            </div>
        `;

        choicesDiv.innerHTML = '';
        if (this._activeWorkshopAxisId) {
            actionsDiv.innerHTML = `<button class="next-btn" data-action="QuizshowRevisionAxes" style="width:100%;"><i class="ri-compass-3-line"></i> ${tq('axes.backToAxesBtn')}</button>`;
        } else {
            actionsDiv.innerHTML = `<button class="next-btn" data-action="finish-session" style="width:100%;">${tq('results.finish')}</button>`;
        }
    }

    // --- STATISTICS MANAGEMENT ---
} // End Class

const QuizView = new QuizViewClass();
export default QuizView;
