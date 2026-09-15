import GlobalState from '../core/app_state.js';
import AppEvents from '../core/events.js';
import AppRouter from '../core/router.js';
import QuizService from '../services/quiz_service.js';
import { escapeHTML } from '../core/security.js';
import { formatDateTime } from '../utils/date_utils.js';
import { truncate } from '../utils/text_utils.js';

/**
 * PURE VIEW - QuizView
 * S'occupe uniquement du rendu HTML et de l'écoute des événements (Event Delegation)
 */
import BaseView from '../core/base_view.js';

class QuizViewClass extends BaseView {
    constructor() {
        super();
        
        this.state = {
            masteryFilter: 'ALL',
            themeFilter: null,
            themeSort: 'alpha',
            themeSortDir: 'asc',
            questionSort: 'rate',
            questionSortDir: 'asc'
        };

        Object.assign(this, {
            handleClick: this.handleClick.bind(this),
            handleChange: this.handleChange.bind(this)
        });
        
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                const qcmScreen = document.getElementById('qcm-screen');
                const isQcmScreenActive = qcmScreen && qcmScreen.classList.contains('active');
                
                if (isQcmScreenActive && typeof QuizService !== 'undefined' && QuizService.state && QuizService.state.qcmConfig.mode === 'EXAM') {
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
        alert("Examen invalidé : Vous avez quitté la page. Le mode examen requiert toute votre attention.");
        QuizService.state.invalidated = true;
        this.renderExamResults();
    }

    async mount(container) {
        await super.mount(container);
        console.log("QuizView: mount started");
        
        try {
            console.log("QuizView: Initializing QuizService in background...");
            // Non-blocking initialization
            QuizService.init().then(() => {
                console.log("QuizView: QuizService initialized successfully.");
                if (this.renderThemeOptions) this.renderThemeOptions();
                
                // Re-render the correct screen based on routing mode if needed
                const mode = GlobalState.get('mode');
                if (mode === 'STATS') {
                    this.renderStats();
                } else if (mode === 'QCM_BANK') {
                    this.showBankScreen();
                }
            }).catch(e => {
                console.error("QuizView: Error initializing QuizService", e);
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
                
                const statsScreen = document.getElementById('qcm-stats-screen');
                if (statsScreen && statsScreen.classList.contains('active')) {
                    this.renderStats();
                }
            });

        } catch (e) {
            console.error("QuizView: Error in mount", e);
            this.renderErrorState("Impossible de charger la base de données théorique : " + (e.message || "Erreur inconnue"));
        }
    }

    unmount() {
        super.unmount();
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
        const screens = ['qcm-setup-screen', 'qcm-screen', 'qcm-stats-screen', 'qcm-bank-screen'];
        screens.forEach(id => {
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
        let rawValue = target.getAttribute('data-args') || target.getAttribute('data-value');
        let args = [];
        
        if (rawValue) {
            try {
                if (rawValue.startsWith('[')) {
                    // Convert faux-array "['alpha']" or "['PERFECT']" to valid JSON '["alpha"]'
                    args = JSON.parse(rawValue.replace(/'/g, '"'));
                } else {
                    let value = rawValue.replace(/^'|'$/g, '');
                    args = [value];
                }
            } catch (err) {
                let value = rawValue.replace(/^'|'$/g, '');
                args = [value];
            }
        }
        
        let value = args[0] || null;

        switch (action) {
            case 'QuizsetThemeSort': this.setThemeSort(args[0]); break;
            case 'QuizsetMasteryFilter': this.setMasteryFilter(args[0]); break;
            case 'QuizsetThemeFilter': this.setThemeFilter(args[0]); break;
            case 'QuiztoggleQuestionDetails': this.toggleQuestionDetails(args[0]); break;
            case 'QuizsortQuestions': this.sortQuestions(args[0]); break;
            case 'QuizresetStats': this.resetStats(); break;
            case 'QuizclearAllFilters': this.clearAllFilters(); break;
            case 'QuiztoggleExamDetails': this.toggleExamDetails(args[0]); break;
            case 'QuizexportData': if(this.exportData) this.exportData(); break;
            case 'QuizimportData': if(this.importData) this.importData(); break;
            case 'setQcmMode':
            case 'set-mode':
                QuizService.setMode(value);
                this.updateModeUI(value, target);
                break;
            case 'setQcmCount':
            case 'set-count':
                QuizService.setCount(value === 'ALL' ? 'ALL' : parseInt(value));
                this.updateCountUI(value, target);
                break;
            case 'back-to-setup':
            case 'goBack':
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
        }
    }
    
    handleChange(e) {
        if(e.target.id === 'qcm-theme-select') {
            QuizService.setTheme(e.target.value);
        } else if(e.target.id === 'bank-theme-filter' || e.target.id === 'bank-search') {
            const select = document.getElementById('bank-theme-filter');
            this.renderBankContent(select ? select.value : 'ALL');
        }
    }

    // --- UI UPDATES ---
    showBankScreen() {
        document.querySelectorAll('.mode-screen').forEach(s => s.classList.remove('active'));
        const bankScreen = document.getElementById('qcm-bank-screen');
        if (bankScreen) {
            bankScreen.classList.add('active');
            const select = document.getElementById('bank-theme-filter');
            this.renderBankContent(select ? select.value : 'ALL');
        }
    }

    renderBankContent(themeFilter) {
        const container = document.getElementById('bank-results');
        if (!container) return;

        const searchInput = document.getElementById('bank-search');
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

        let sourceData = (window.QCM_OFFICIAL && window.QCM_OFFICIAL.questions) ? window.QCM_OFFICIAL.questions : [];
        
        // Filter by selected level
        const level = GlobalState.get('level') || 'BI';
        const hasLevel = (code, letter) => code.replace(/^[a-zA-Z]+\d+/, '').includes(letter);
        
        if (level === 'BI') {
            sourceData = sourceData.filter(q => hasLevel(q.code, 'V'));
        } else if (level === 'BP') {
            sourceData = sourceData.filter(q => hasLevel(q.code, 'B'));
        } else if (level === 'BPC') {
            sourceData = sourceData.filter(q => hasLevel(q.code, 'M'));
        } else if (level === 'TREUIL') {
            sourceData = sourceData.filter(q => hasLevel(q.code, 'T'));
        }
        
        if (themeFilter && themeFilter !== 'ALL') {
            sourceData = sourceData.filter(q => q.theme === themeFilter);
        }
        
        if (searchTerm) {
            sourceData = sourceData.filter(q => q.question.toLowerCase().includes(searchTerm) || q.code.toLowerCase().includes(searchTerm) || (q.explication && q.explication.toLowerCase().includes(searchTerm)));
        }
        
        // Exclude specific prefixes that were skipped in actual quiz
        const excludedPrefixes = ['H', 'R', 'X']; 
        sourceData = sourceData.filter(q => !excludedPrefixes.includes(q.code.charAt(0)));

        if (sourceData.length === 0) {
            container.innerHTML = '<p style="text-align:center; opacity:0.6; padding: 2rem;">Aucune question trouvée.</p>';
            return;
        }

        let html = '';
        sourceData.forEach(q => {
            const letters = q.code.replace(/^[a-zA-Z]+\d+/, '');
            let colorStyle = '';
            
            const colorMap = {
                'V': 'rgba(34, 197, 94, 0.2)', // Vert
                'B': 'rgba(59, 130, 246, 0.2)', // Bleu
                'M': 'rgba(139, 69, 19, 0.2)', // Marron
                'T': 'rgba(168, 85, 247, 0.2)'  // Violet
            };
            const textColors = { 'V': '#4ade80', 'B': '#60a5fa', 'M': '#c0773d', 'T': '#c084fc' };
            
            const validLetters = letters.split('').filter(l => colorMap[l]);
            if (validLetters.length === 1) {
                colorStyle = `background: ${colorMap[validLetters[0]]}; color: ${textColors[validLetters[0]]}; border: 1px solid ${colorMap[validLetters[0]].replace('0.2', '0.4')};`;
            } else if (validLetters.length > 1) {
                let stops = [];
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
                        ${q.choices.map(c => `
                            <div class="bank-choice ${c.pts > 0 ? 'correct' : (c.pts < 0 ? 'incorrect' : '')}">
                                ${escapeHTML(c.text)} ${c.pts > 0 ? '(+'+c.pts+')' : (c.pts < 0 ? '('+c.pts+')' : '')}
                            </div>
                        `).join('')}
                    </div>
                    ${q.explication ? `<div class="bank-item-explication">${escapeHTML(q.explication)}</div>` : ''}
                </div>
            `;
        });
        
        container.innerHTML = html;
    }

    updateModeUI(mode, targetBtn) {
        document.querySelectorAll('.mode-toggle-btn').forEach(btn => btn.classList.remove('active'));
        if (targetBtn) {
            targetBtn.classList.add('active');
        } else {
            // fallback
            const btn = document.querySelector(`[data-args="'${mode}'"]`) || document.querySelector(`[data-value="${mode}"]`);
            if (btn) btn.classList.add('active');
        }
        
        const descEl = document.getElementById('mode-description');
        if (descEl) {
            if (mode === 'EXAM') {
                descEl.innerText = "Mode Examen : Simulation dans les conditions réelles d'examen (volume et thèmes imposés).";
            } else if (mode === 'REVISION') {
                descEl.innerText = "Mode Révision : Retravaillez vos points faibles et découvrez les questions jamais tentées.";
            } else {
                descEl.innerText = "Mode Entraînement : Choisissez votre thème et volume. Correction immédiate après chaque question.";
            }
        }
        
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
    }

    updateCountUI(countVal, targetBtn) {
        document.querySelectorAll('.count-btn').forEach(btn => btn.classList.remove('active'));
        if (targetBtn) {
            targetBtn.classList.add('active');
        } else {
            // fallback
            const btn = document.querySelector(`[data-args="${countVal}"]`) || document.querySelector(`[data-value="${countVal}"]`);
            if (btn) btn.classList.add('active');
        }
    }

    renderThemeOptions() {
        const select = document.getElementById('qcm-theme-select');
        if(!select) return;
        const themes = QuizService.getThemes();
        themes.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t;
            opt.innerText = t;
            select.appendChild(opt);
        });
    }

    showSetupScreen() {
        document.querySelectorAll('.mode-screen').forEach(s => s.classList.remove('active'));
        document.getElementById('qcm-setup-screen').classList.add('active');
    }

    showStatsScreen() {
        document.querySelectorAll('.mode-screen').forEach(s => s.classList.remove('active'));
        const statsScreen = document.getElementById('stats-screen');
        if (statsScreen) statsScreen.classList.add('active');
        this.renderStats();
    }

    renderStats() {
        console.log("QuizEngine.renderStats v4.4 - Starting");
        const container = document.getElementById('stats-content');
        if (!container) return;

        if (window.GdprEngine && !window.GdprEngine.isConsentGranted('stats')) {
            container.innerHTML = `
                <div style="padding:40px; text-align:center; color:var(--text-main); max-width: 500px; margin: 0 auto; display:flex; flex-direction:column; align-items:center; justify-content:center;">
                    <i class="ri-shield-user-line" style="font-size:3.5rem; color:var(--accent-blue); display:block; margin-bottom:20px;"></i>
                    <h2 style="margin-bottom:12px; font-weight: 800; font-size: 1.4rem;">Statistiques désactivées</h2>
                    <p style="opacity:0.7; font-size:0.9rem; line-height: 1.6; margin-bottom: 24px;">
                        Vous avez désactivé le stockage de vos statistiques d'entraînement dans vos préférences de confidentialité. Pour suivre votre progression et voir votre historique, veuillez activer cette option.
                    </p>
                    <button onclick="if(window.GdprEngine) window.GdprEngine.showModal('gdpr-settings-modal');" style="background:var(--accent-blue); color:white; border:none; padding:12px 24px; border-radius:14px; cursor:pointer; font-weight:700; transition:all 0.2s; font-size:0.9rem;">
                        Activer le suivi de progression
                    </button>
                </div>
            `;
            return;
        }

        if (!QuizService.state.isLoaded) {
            container.innerHTML = `
                <div style="padding:40px; text-align:center; color:var(--text-main); opacity:0.7;">
                    <i class="ri-loader-4-line ri-spin" style="font-size:3rem; margin-bottom:20px; display:block;"></i>
                    <p>Chargement des données QCM...</p>
                </div>
            `;
            return;
        }

        if (QuizService.state.loadingError) {
            container.innerHTML = `
                <div style="padding:40px; text-align:center; color:var(--text-main); max-width: 500px; margin: 0 auto;">
                    <i class="ri-error-warning-line" style="font-size:3rem; color:#b91c1c; display:block; margin-bottom:20px;"></i>
                    <h2 style="margin-bottom:12px; font-weight: 800; font-size: 1.4rem;">Erreur de chargement</h2>
                    <p style="opacity:0.7;">Impossible de charger les fichiers de données (CORS/Fichier manquant).<br>Détail: ${QuizService.state.loadingError}</p>
                </div>
            `;
            return;
        }

        if (typeof QCM_OFFICIAL === 'undefined' || !window.QCM_OFFICIAL.questions) {
            container.innerHTML = `
                <div style="padding:40px; text-align:center; color:white;">
                    <i class="ri-error-warning-line" style="font-size:3rem; color:#b91c1c; display:block; margin-bottom:20px;"></i>
                    <h2 style="margin-bottom:10px;">Données QCM Introuvables</h2>
                    <p style="opacity:0.7;">Le fichier de questions (qcm_ffvl.csv) semble manquant ou corrompu.</p>
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
            

            console.log("Rendering stats for normalized level:", currentLevel);

            let levelQuestionCodes = new Set();
            let totalLevelQuestions = 0;

            let levelQs = [];
            console.log("DEBUG RENDER STATS: Normalized Level =", currentLevel);





            // Mapping levels to QCM_OFFICIAL 'niveau' property
            // 0: Vert (Intro)? 1: Bleu (BI)? 2: Marron (BP)? 3: Rouge/Confirme (BPC)?

            if (currentLevel === 'ALL') {
                // For global view, use all PARAPENTE questions
                levelQs = window.QCM_OFFICIAL.questions.filter(q => q.parapente === true);
                console.log("DEBUG ALL FILTER: Total parapente questions:", levelQs.length);
            } else if (currentLevel === 'BI') {
                // BI = Contains suffix V AND parapente
                levelQs = window.QCM_OFFICIAL.questions.filter(q => q.parapente === true && q.code && q.code.includes('V'));
                console.log(`DEBUG BI FILTER: Found ${levelQs.length} questions (Suffix contains V).`);
            } else if (currentLevel === 'BP') {
                // BP = Contains suffix B AND parapente
                levelQs = window.QCM_OFFICIAL.questions.filter(q => q.parapente === true && q.code && q.code.includes('B'));
                console.log(`DEBUG BP FILTER: Found ${levelQs.length} questions (Suffix contains B).`);
            } else if (currentLevel === 'BPC') {
                // BPC = Contains suffix M AND parapente
                levelQs = window.QCM_OFFICIAL.questions.filter(q => q.parapente === true && q.code && q.code.includes('M'));
                console.log(`DEBUG BPC FILTER: Found ${levelQs.length} questions (Suffix contains M).`);
            } else if (currentLevel === 'TREUIL') {
                // TREUIL = Contains suffix T AND parapente
                levelQs = window.QCM_OFFICIAL.questions.filter(q => q.parapente === true && q.code && q.code.includes('T'));
                console.log(`DEBUG TREUIL FILTER: Found ${levelQs.length} questions (Suffix contains T).`);
            } else {

                // Fallback
                levelQs = window.QCM_OFFICIAL.questions.filter(q => q.parapente === true && q.class && q.class.includes(currentLevel));
            }

            // Deduplicate and Filter levelQs (Fix for erroneous 198 count vs 174)
            const excludedPrefixes = ['H', 'R', 'X']; // Delta specifics
            levelQs = levelQs.filter(q => !excludedPrefixes.includes(q.code.charAt(0)));


            if (levelQs.length > 0) {
                totalLevelQuestions = levelQs.length;
                levelQs.forEach(q => levelQuestionCodes.add(q.code));
                console.log(`Found ${totalLevelQuestions} questions for level ${currentLevel} in QCM_OFFICIAL`);
            }



            // Calculate question distribution for CURRENT LEVEL
            const allQuestionEntries = Object.entries(stats.questions);

            if (currentLevel === 'ALL') {
                const sampleKeys = allQuestionEntries.slice(0, 5).map(e => e[0]);
                console.log("DEBUG ALL: stats.questions keys sample:", sampleKeys);
                console.log("DEBUG ALL: levelQuestionCodes size:", levelQuestionCodes.size);
                const firstCode = Array.from(levelQuestionCodes)[0];
                console.log("DEBUG ALL: First code in levelQuestionCodes:", firstCode);
            }

            // Debug filtering
            let levelQuestionEntries = allQuestionEntries.filter(([code, data]) => levelQuestionCodes.has(code));

            // FALLBACK: If filtering returns 0 results but we have stats, it might be due to code mismatches.
            // In that case, we display everything to ensure the user sees their data.


            let perfect = 0;      // 100%
            let excellent = 0;    // 90-99%
            let veryGood = 0;     // 75-89%
            let good = 0;         // 50-74%
            let poor = 0;         // 1-49%
            let failed = 0;       // 0%
            // notAttempted is relative to the level total
            let notAttempted = totalLevelQuestions - levelQuestionEntries.length;

            // Ensure non-negative (incase of data sync issues)
            console.log("DEBUG NOT ATTEMPTED:", totalLevelQuestions, levelQuestionEntries.length, notAttempted, notAttempted < 0 ? "FIXED to 0" : "");
            if (notAttempted < 0) notAttempted = 0;

            levelQuestionEntries.forEach(([code, data]) => {
                if (data.total === 0) return;
                const pct = Math.round((data.correct / data.total) * 100);

                if (pct === 100) perfect++;
                else if (pct >= 90) excellent++; // 90-99%
                else if (pct >= 75) veryGood++;  // 75-89% (NEW)
                else if (pct >= 50) good++;
                else if (pct > 0) poor++;
                else failed++;
            });

            // Recalculate global percentage (MASTERY SCORE)
            // Formula: Sum of (Correct/Total) for each unique question / Total number of unique questions
            // This ensures unattempted questions count as 0% mastery.

            let accumulatedMastery = 0;

            // Calculate Theme Stats dynamically for THIS LEVEL
            const levelThemes = {};

            if (levelQs) {
                levelQs.forEach(q => {
                    const qStat = stats.questions[q.code];
                    const theme = q.theme || 'Autre';

                    if (!levelThemes[theme]) {
                        levelThemes[theme] = { mastery: 0, totalQuestions: 0, attemptedCount: 0 };
                    }

                    // Always count this question toward the theme total
                    levelThemes[theme].totalQuestions++;

                    // Per-question mastery score: correct/total ratio (0–1), or 0 if not attempted
                    if (qStat && qStat.total > 0) {
                        levelThemes[theme].mastery += (qStat.correct / qStat.total);
                        levelThemes[theme].attemptedCount++;
                    }
                });
            }

            // Iterate over ALL unique questions for this level (attempted or not)
            levelQs.forEach(q => {
                const stat = stats.questions[q.code];
                if (stat && stat.total > 0) {
                    accumulatedMastery += (stat.correct / stat.total);
                } else {
                    // Unattempted or 0 total attempts = 0% mastery
                    accumulatedMastery += 0;
                }
            });

            // If totalLevelQuestions is 0 (should not happen if data loaded), avoid division by zero
            const globalPct = totalLevelQuestions > 0 ? Math.round((accumulatedMastery / totalLevelQuestions) * 100) : 0;
            const color = globalPct >= 75 ? '#4ade80' : (globalPct >= 50 ? '#facc15' : '#f87171');


            const currentFilter = QuizView.state.masteryFilter || 'ALL';
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
                <div data-action="QuizsetMasteryFilter" data-args="['PERFECT']" style="${getCardStyle(cGreen, 'PERFECT')}">
                    <div style="font-size:2rem; font-weight:900; color:#4ade80;">${perfect}</div>
                    <div style="font-size:0.75rem; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; opacity:0.6; margin-top:8px;">Maîtrisées</div>
                    <div style="font-size:0.65rem; opacity:0.4;">(100%)</div>
                </div>
                <div data-action="QuizsetMasteryFilter" data-args="['EXCELLENT']" style="${getCardStyle('134, 239, 172', 'EXCELLENT')}">
                    <div style="font-size:2rem; font-weight:900; color:#86efac;">${excellent}</div>
                    <div style="font-size:0.75rem; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; opacity:0.6; margin-top:8px;">Excellentes</div>
                    <div style="font-size:0.65rem; opacity:0.4;">(90-99%)</div>
                </div>
                <div data-action="QuizsetMasteryFilter" data-args="['VERY_GOOD']" style="${getCardStyle('56, 189, 248', 'VERY_GOOD')}">
                    <div style="font-size:2rem; font-weight:900; color:#38bdf8;">${veryGood}</div>
                    <div style="font-size:0.75rem; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; opacity:0.6; margin-top:8px;">Très Bonnes</div>
                    <div style="font-size:0.65rem; opacity:0.4;">(75-89%)</div>
                </div>
                <div data-action="QuizsetMasteryFilter" data-args="['GOOD']" style="${getCardStyle(cYellow, 'GOOD')}">
                    <div style="font-size:2rem; font-weight:900; color:#facc15;">${good}</div>
                    <div style="font-size:0.75rem; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; opacity:0.6; margin-top:8px;">Satisfaisantes</div>
                    <div style="font-size:0.65rem; opacity:0.4;">(50-74%)</div>
                </div>
                <div data-action="QuizsetMasteryFilter" data-args="['POOR']" style="${getCardStyle(cOrange, 'POOR')}">
                    <div style="font-size:2rem; font-weight:900; color:#fb923c;">${poor}</div>
                    <div style="font-size:0.75rem; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; opacity:0.6; margin-top:8px;">À travailler</div>
                    <div style="font-size:0.65rem; opacity:0.4;">(1-49%)</div>
                </div>
                <div data-action="QuizsetMasteryFilter" data-args="['FAILED']" style="${getCardStyle(cRed, 'FAILED')}">
                    <div style="font-size:2rem; font-weight:900; color:#f87171;">${failed}</div>
                    <div style="font-size:0.75rem; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; opacity:0.6; margin-top:8px;">Échecs</div>
                    <div style="font-size:0.65rem; opacity:0.4;">(0%)</div>
                </div>
                <div data-action="QuizsetMasteryFilter" data-args="['NOT_ATTEMPTED']" style="${getCardStyle(cGray, 'NOT_ATTEMPTED')}">
                    <div style="font-size:2rem; font-weight:900; color:var(--text-muted);">${notAttempted}</div>
                    <div style="font-size:0.75rem; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; opacity:0.6; margin-top:8px;">Non tentées</div>
                    <div style="font-size:0.65rem; opacity:0.4;">(sur ${totalLevelQuestions})</div>
                </div>
            </div>
        `;

            let themesHtml = '';

            // Sort Themes
            const sortedThemes = Object.entries(levelThemes).sort((a, b) => {
                let valA, valB;

                if (QuizView.state.themeSort === 'rate') {
                    valA = a[1].totalQuestions > 0 ? (a[1].mastery / a[1].totalQuestions) : 0;
                    valB = b[1].totalQuestions > 0 ? (b[1].mastery / b[1].totalQuestions) : 0;
                } else {
                    valA = a[0];
                    valB = b[0];
                }

                if (valA < valB) return QuizView.state.themeSortDir === 'asc' ? -1 : 1;
                if (valA > valB) return QuizView.state.themeSortDir === 'asc' ? 1 : -1;
                return 0;
            });

            // Sort Controls HTML — rendered separately above the grid
            const getSortIcon = (type) => {
                if (QuizView.state.themeSort !== type) return '';
                return QuizView.state.themeSortDir === 'asc' ? '<i class="ri-arrow-up-s-line"></i>' : '<i class="ri-arrow-down-s-line"></i>';
            };

            const sortBtnStyle = (type) => {
                const isActive = QuizView.state.themeSort === type;
                return `flex:1; background:${isActive ? 'var(--bg-main)' : 'transparent'}; color:${isActive ? 'var(--text-main)' : 'var(--text-muted)'}; border:none; padding:6px 14px; border-radius:8px; cursor:pointer; font-size:0.8rem; font-weight:${isActive ? '700' : '500'}; display:flex; align-items:center; justify-content:center; gap:5px; transition:all 0.2s; box-shadow:${isActive ? '0 1px 4px rgba(0,0,0,0.18)' : 'none'};`;
            };

            const sortControlsHtml = `
                <div style="display:flex; align-items:center; justify-content:flex-end; margin-bottom:16px;">
                    <div style="display:flex; background:var(--bg-card); border:1px solid var(--border-color); border-radius:10px; padding:3px; gap:2px;">
                        <button data-action="QuizsetThemeSort" data-args="['alpha']" style="${sortBtnStyle('alpha')}">
                            ${getSortIcon('alpha')} Alphabétique
                        </button>
                        <button data-action="QuizsetThemeSort" data-args="['rate']" style="${sortBtnStyle('rate')}">
                            ${getSortIcon('rate')} Taux
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

                const tColor = pct >= 90 ? '#4ade80' : (pct >= 75 ? '#38bdf8' : (pct >= 50 ? '#facc15' : (totalQ === 0 ? 'var(--text-muted)' : '#f87171')));
                const tColorRgb = pct >= 90 ? '74,222,128' : (pct >= 75 ? '56,189,248' : (pct >= 50 ? '250,204,21' : (totalQ === 0 ? '150,150,150' : '248,113,113')));

                // Theme emoji icon
                const themeIcons = {
                    'Météo': '🌦️', 'Mécavol': '⚙️', 'Matériel': '🪂',
                    'Pilotage': '🧭', 'Réglementation': '📋', 'Facteurs humains': '🧠',
                    'Milieu naturel': '🏔️'
                };
                const icon = themeIcons[name] || '📚';

                // Active state
                const isActive = QuizView.state.themeFilter === name;
                const cardBorder = isActive
                    ? `border:2px solid ${tColor}; box-shadow:0 0 20px -4px rgba(${tColorRgb},0.4);`
                    : `border:1px solid var(--border-color);`;
                const cardBg = isActive
                    ? `background:rgba(${tColorRgb},0.08);`
                    : `background:var(--bg-card);`;

                // Progress bar width
                const barWidth = totalQ > 0 ? pct : 0;

                themesHtml += `
                <div class="theme-card" data-action="QuizsetThemeFilter" data-args="['${name}']" style="cursor:pointer; padding:16px 18px; border-radius:16px; ${cardBorder} ${cardBg} color:var(--text-main); transition:all 0.25s ease; position:relative; overflow:hidden;">
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
                        <span>${attemptedUnique} tentées / ${totalQ} questions${notAttemptedQ > 0 ? ` <span style="opacity:0.7;">(${notAttemptedQ} non tentée${notAttemptedQ > 1 ? 's' : ''})</span>` : ''}</span>
                        ${isActive ? '<span style="font-size:0.68rem; font-weight:700; opacity:0.8;">✕ Retirer filtre</span>' : ''}
                    </div>
                </div>
            `;
            });



            // Build individual questions list (FILTERED BY LEVEL)
            let allQuestionsHtml = '';
            // Use levelQuestionEntries computed earlier to show only relevant questions

            if (levelQuestionEntries.length > 0) {
                // Sort by success rate (worst first) by default
                // Create a copy to avoid mutating the original array if used elsewhere? 
                // Although here it's fine as we are at the end.
                const sortedQuestions = [...levelQuestionEntries].sort((a, b) => {
                    const pctA = a[1].total > 0 ? (a[1].correct / a[1].total) : 0;
                    const pctB = b[1].total > 0 ? (b[1].correct / b[1].total) : 0;
                    return pctA - pctB;
                });

                // --- FILTERING LOGIC ---
                let visibleQuestions = [];

                if (QuizView.state.masteryFilter === 'ALL') {
                    visibleQuestions = sortedQuestions;
                } else if (QuizView.state.masteryFilter === 'NOT_ATTEMPTED') {
                    // Determine unattempted questions
                    // levelQs contains ALL valid questions for this level (excluding Delta)
                    // stats.questions contains history
                    levelQs.forEach(q => {
                        if (!stats.questions[q.code] || stats.questions[q.code].total === 0) {
                            // Create a mock "data" object for rendering
                            visibleQuestions.push([q.code, { total: 0, correct: 0 }]);
                        }
                    });
                } else {
                    visibleQuestions = sortedQuestions.filter(([code, data]) => {
                        const pct = Math.round((data.correct / data.total) * 100);
                        if (QuizView.state.masteryFilter === 'PERFECT') return pct === 100;
                        if (QuizView.state.masteryFilter === 'EXCELLENT') return pct >= 90 && pct < 100;
                        if (QuizView.state.masteryFilter === 'VERY_GOOD') return pct >= 75 && pct < 90;
                        if (QuizView.state.masteryFilter === 'GOOD') return pct >= 50 && pct < 75;
                        if (QuizView.state.masteryFilter === 'POOR') return pct > 0 && pct < 50;
                        if (QuizView.state.masteryFilter === 'FAILED') return pct === 0;
                        return true;
                    });
                }

                const filterLabel = {
                    'ALL': 'Toutes les questions tentées',
                    'PERFECT': 'Questions Maîtrisées (100%)',
                    'EXCELLENT': 'Questions Excellentes (90-99%)',
                    'VERY_GOOD': 'Questions Très Bonnes (75-89%)',
                    'GOOD': 'Questions Satisfaisantes (50-74%)',
                    'POOR': 'Questions À travailler (1-49%)',
                    'FAILED': 'Questions Échouées (0%)',
                    'NOT_ATTEMPTED': 'Questions Non Tentées'
                }[QuizView.state.masteryFilter];

                // Append theme filter label if active
                let displayLabel = filterLabel;
                if (QuizView.state.themeFilter) {
                    displayLabel += ` • Thème: ${QuizView.state.themeFilter}`;
                    // Filter sortedQuestions again by theme
                    visibleQuestions = visibleQuestions.filter(([code, data]) => {
                        let qObj = null;
                        if (typeof QCM_OFFICIAL !== 'undefined' && window.QCM_OFFICIAL.questions) {
                            qObj = window.QCM_OFFICIAL.questions.find(q => q.code === code || q.id === code);
                        }

                        let qTheme = (qObj && qObj.theme) ? qObj.theme : null;

                        // If theme is missing but we have a code, try to derive it
                        if (!qTheme && qObj && qObj.code) {
                            const letter = qObj.code.charAt(0);
                            const map = {
                                'A': 'Météo',
                                'E': 'Mécavol', 'G': 'Mécavol', 'H': 'Mécavol',
                                'L': 'Matériel', 'N': 'Matériel', 'R': 'Matériel',
                                'U': 'Pilotage', 'W': 'Pilotage', 'X': 'Pilotage',
                                'S': 'Réglementation',
                                'F': 'Facteurs humains',
                                'P': 'Milieu naturel'
                            };
                            qTheme = map[letter] || 'Autre';
                        }

                        if (!qTheme) qTheme = 'Autre';
                        return qTheme === QuizView.state.themeFilter;
                    });
                }


                allQuestionsHtml = `
                <div style="margin-bottom:16px; display:flex; justify-content:space-between; align-items:center;">
                    <div style="font-size:0.9rem; opacity:0.7;">
                        <span style="font-weight:700; color:var(--text-main);">${visibleQuestions.length}</span> questions 
                        <span style="opacity:0.6;">(${displayLabel})</span>
                        ${(QuizView.state.masteryFilter !== 'ALL' || QuizView.state.themeFilter) ? '<a data-action="QuizclearAllFilters" data-args="[]" style="margin-left:8px; cursor:pointer; text-decoration:underline; font-size:0.8rem; color:var(--accent-blue);">Tout effacer</a>' : ''}
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button data-action="QuizsortQuestions" data-args="['rate']" id="sort-rate-btn" class="sort-btn" style="padding:6px 12px; border-radius:6px; border:1px solid var(--border-color); background:rgba(255,255,255,0.05); cursor:pointer; font-size:0.8rem;">
                            Par taux
                        </button>
                        <button data-action="QuizsortQuestions" data-args="['attempts']" id="sort-attempts-btn" class="sort-btn" style="padding:6px 12px; border-radius:6px; border:1px solid var(--border-color); background:transparent; cursor:pointer; font-size:0.8rem;">
                            Par tentatives
                        </button>
                        <button data-action="QuizsortQuestions" data-args="['streak']" id="sort-streak-btn" class="sort-btn" style="padding:6px 12px; border-radius:6px; border:1px solid var(--border-color); background:transparent; cursor:pointer; font-size:0.8rem;">
                            Par série
                        </button>
                    </div>
                </div>
                <div id="all-questions-list" style="display:flex; flex-direction:column; gap:8px; max-height:500px; overflow-y:auto; padding-right:8px;">
            `;

                visibleQuestions.forEach(([code, data]) => {
                    let qObj = null;

                    if (typeof QCM_OFFICIAL !== 'undefined' && window.QCM_OFFICIAL.questions) {
                        qObj = window.QCM_OFFICIAL.questions.find(q => q.code === code || q.id === code);
                    }
                    
                    let theme = qObj ? qObj.theme : "Autre";

                    // Derive theme if missing
                    if (!theme && code) {
                        const letter = code.charAt(0);
                        const map = {
                            'A': 'Météo',
                            'E': 'Mécavol', 'G': 'Mécavol', 'H': 'Mécavol',
                            'L': 'Matériel', 'N': 'Matériel', 'R': 'Matériel',
                            'U': 'Pilotage', 'W': 'Pilotage', 'X': 'Pilotage',
                            'S': 'Réglementation',
                            'F': 'Facteurs humains',
                            'P': 'Milieu naturel'
                        };
                        theme = map[letter] || 'Autre';
                    }

                    const pct = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
                    const qColor = pct >= 90 ? '#4ade80' : (pct >= 75 ? '#38bdf8' : (pct >= 50 ? '#facc15' : '#f87171'));
                    const streak = data.streak || 0;

                    // Build answers HTML if available
                    let answersHtml = '';
                    if (qObj && qObj.choices) {
                        answersHtml = '<div class="question-answers" style="display:none; margin-top:12px; padding-top:12px; border-top:1px solid var(--border-color);">';
                        qObj.choices.forEach((ans, idx) => {
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
                                    <div style="font-weight:700; font-size:0.75rem; color:#fb923c; margin-bottom:4px; text-transform:uppercase;">Explication</div>
                                    ${qObj.explication}
                                </div>
                            `;
                        }
                        answersHtml += '</div>';
                    }

                    const qText = qObj ? qObj.question : "Question inconnue";
                    const displayText = truncate(qText, 80);
                    const hasAnswers = qObj && qObj.choices;

                    allQuestionsHtml += `
                    <div class="question-stat-item" data-code="${code}" data-pct="${pct}" data-total="${data.total}" data-streak="${streak}" style="background:var(--bg-card); padding:12px 16px; border-radius:8px; border:1px solid var(--border-color); cursor:${hasAnswers ? 'pointer' : 'default'};" ${hasAnswers ? `data-action="QuiztoggleQuestionDetails" data-args="['${code}']"` : ''}>
                        <div style="display:flex; justify-content:space-between; align-items:start; gap:12px;">
                            <div style="flex:1;">
                                <div style="display:flex; gap:8px; align-items:center; margin-bottom:6px;">
                                    <span style="font-family:monospace; font-size:0.75rem; opacity:0.5;">#${code}</span>
                                    ${QuizView.getCourseUrl(code, qText) ? `<button onclick="event.stopPropagation(); window.open('${QuizView.getCourseUrl(code, qText)}', '_blank')" style="background:var(--accent-blue); color:white; border:none; padding:3px 8px; border-radius:4px; cursor:pointer; font-size:0.65rem; font-weight:700; display:flex; align-items:center; gap:4px; box-shadow:0 2px 4px rgba(0,0,0,0.2);"><i class="ri-book-open-line"></i> COURS</button>` : ''}
                                    <span style="background:rgba(255,255,255,0.1); padding:2px 6px; border-radius:4px; font-size:0.7rem;">${theme}</span>
                                    ${streak >= 3 ? `<span style="background:#4ade80; color:#000; padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:700;">🔥 ${streak}</span>` : ''}
                                    ${hasAnswers ? '<i class="ri-arrow-down-s-line" style="opacity:0.5; transition:transform 0.2s;" id="arrow-' + code + '"></i>' : ''}
                                </div>
                                <div style="font-size:0.9rem; line-height:1.4;">${displayText}</div>
                                <div style="font-size:0.75rem; opacity:0.6; margin-top:4px;">
                                    ${data.correct}/${data.total} corrects • ${data.total} tentative${data.total > 1 ? 's' : ''} • Série en cours : ${streak}
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
                allQuestionsHtml = '<div style="opacity:0.6; font-style:italic; text-align:center; padding:40px;">Aucune question tentée pour le moment.</div>';
            }

            // Premium Circular Gauge Calculation
            const strokeDash = 2 * Math.PI * 55; // r=55
            const offset = strokeDash - (globalPct / 100) * strokeDash;
            const colorGlow = color + '44'; // Add transparency for glow

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
                            RÉUSSITE<br>GLOBALE
                        </div>
                    </div>
                </div>
                
                <div style="text-align:center; margin-top:24px;">
                    <div style="font-size:1.1rem; font-weight:700; color:var(--text-main); letter-spacing:0.02em;">NIVEAU : ${currentLevel === 'ALL' ? 'TOUS LES NIVEAUX' : currentLevel}</div>
                    <div style="font-size:0.8rem; opacity:0.4; margin-top:4px; font-family:monospace;">Activité : ${stats.totalQuestions} réponses enregistrées</div>
                    <div style="font-size:0.7rem; opacity:0.3; margin-top:4px; font-style:italic;">(Moyenne cumulée de tous vos scores)</div>
                </div>
            </div>
        `;

            const statsGridStyle = `display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:32px;`;

            container.innerHTML = `
            ${successGaugeHtml}

            <div style="margin-top:48px;">
                <h3 class="library-section-header" style="border:none; margin-bottom:24px;">RÉPARTITION PAR MAÎTRISE</h3>
                ${distributionHtml}
            </div>

                <div style="margin-top:48px;">
                    <h3 class="library-section-header" style="border:none; margin-bottom:20px;">STATISTIQUES PAR THÈME</h3>
                    ${sortControlsHtml}
                    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:12px;">
                        ${themesHtml || '<div style="opacity:0.5;">Aucune donnée.</div>'}
                    </div>
                </div>
            </div>

            <div style="margin-top:64px;">
                <h3 class="library-section-header" style="border:none; margin-bottom:24px;">HISTORIQUE DES EXAMENS</h3>
                <div style="background:var(--bg-card); padding:24px; border-radius:24px; border:1px solid var(--border-color);">
                    ${QuizView.renderExamHistory()}
                </div>
            </div>

            <div style="margin-top:64px;">
                <h3 class="library-section-header" style="border:none; margin-bottom:24px;">LISTE DÉTAILLÉE DES QUESTIONS</h3>
                <div style="background:var(--bg-card); padding:24px; border-radius:24px; border:1px solid var(--border-color);">
                    ${allQuestionsHtml}
                </div>
            </div>

            <div style="text-align:center; margin-top:64px; display:flex; gap:16px; justify-content:center; flex-wrap:wrap; padding-bottom:40px;">
                <button data-action="QuizexportData" data-args="[]" style="background:rgba(74, 222, 128, 0.1); color:#4ade80; border:1px solid rgba(74, 222, 128, 0.3); padding:12px 28px; border-radius:14px; cursor:pointer; font-weight:700; transition:all 0.2s; display:flex; align-items:center; gap:8px;">
                    <i class="ri-download-cloud-line" style="font-size:1.2rem;"></i> Exporter
                </button>
                <button data-action="QuizimportData" data-args="[]" style="background:rgba(59, 130, 246, 0.1); color:#3b82f6; border:1px solid rgba(59, 130, 246, 0.3); padding:12px 28px; border-radius:14px; cursor:pointer; font-weight:700; transition:all 0.2s; display:flex; align-items:center; gap:8px;">
                    <i class="ri-upload-cloud-line" style="font-size:1.2rem;"></i> Importer
                </button>
                <button data-action="QuizresetStats" data-args="[]" style="background:rgba(248, 113, 113, 0.05); color:#f87171; border:1px solid rgba(248, 113, 113, 0.2); padding:12px 28px; border-radius:14px; cursor:pointer; font-weight:700; transition:all 0.2s; display:flex; align-items:center; gap:8px;">
                    <i class="ri-delete-bin-7-line" style="font-size:1.2rem;"></i> Réinitialiser
                </button>
            </div>
        `;
        } catch (e) {
            console.error("Critical Error in renderStats:", e);
            if (container) {
                container.innerHTML = `<div style="padding:20px; color:#f87171; background:rgba(255,0,0,0.1); border-radius:12px;">Erreur d'affichage des statistiques: ${e.message}</div>`;
            }
        }
    }



    renderExamHistory() {
        let exams = QuizService.getExamHistory();

        // FILTER EXAMS BY CURRENT LEVEL
        let currentLevel = typeof GlobalState !== 'undefined' ? GlobalState.get('level') : 'BI';
        if (!currentLevel || currentLevel === '') currentLevel = 'BI';


        if (currentLevel !== 'ALL') {
            exams = exams.filter(e => e.level === currentLevel);
        }

        if (exams.length === 0) {
            return '<div style="opacity:0.6; font-style:italic; text-align:center; padding:40px;">Aucun examen complété pour le moment pour ce niveau.</div>';
        }

        let html = '<div style="display:flex; flex-direction:column; gap:12px;">';

        exams.forEach(exam => {
            const dateStr = formatDateTime(exam.date);
            const pct = exam.percentage !== undefined ? exam.percentage : (exam.total > 0 ? Math.round((exam.score / exam.total) * 100) : 0);
            const color = exam.invalidated ? '#f87171' : (pct >= 75 ? '#4ade80' : pct >= 50 ? '#facc15' : '#f87171');
            const levelLabel = exam.level === 'BI' ? 'Brevet Initial' : exam.level === 'BP' ? 'Brevet de Pilote' : exam.level === 'BPC' ? 'Brevet de Pilote Confirmé' : 'Treuil';

            // Build questions HTML

            let questionsHtml = '<div class="exam-details" style="display:none; margin-top:16px; padding-top:16px; border-top:1px solid var(--border-color);">';
            questionsHtml += '<div style="display:flex; flex-direction:column; gap:16px;">';

            exam.results.forEach((r, idx) => {
                let q = r.question;
                
                // Fallback: If question was saved as a string code (bug from early ES6 engine)
                if (typeof q === 'string') {
                    if (typeof QCM_OFFICIAL !== 'undefined' && window.QCM_OFFICIAL.questions) {
                        q = window.QCM_OFFICIAL.questions.find(curr => curr.code === r.question);
                    }
                }
                
                if (!q) return; // Skip if question couldn't be resolved
                
                const selectedOptions = r.selected || [];
                let optionsHtml = '';

                (q.choices || q.ans || []).forEach(opt => {
                    const wasSelected = selectedOptions.some(s => s.text === opt.text);
                    const pts = parseInt(opt.pts || 0);
                    let statusClass = '';
                    let icon = '';

                    if (pts > 0) {
                        statusClass = 'background:rgba(74, 222, 128, 0.1); border-left:3px solid #4ade80;';
                        icon = wasSelected ? '<i class="ri-check-double-line" style="color:#4ade80;"></i>' : '<i class="ri-checkbox-circle-line" style="color:#4ade80;"></i>';
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
        <span style="flex:1;">${opt.text}</span>
                        </div >
    `;
                });

                questionsHtml += `
    <div style="background:rgba(255,255,255,0.02); padding:12px; border-radius:8px; ${!r.isCorrect ? 'border:1px solid #f87171;' : ''}" >
                        <div style="font-size:0.75rem; opacity:0.6; margin-bottom:6px;">Question ${idx + 1}</div>
                        <div style="font-weight:600; margin-bottom:12px;">${q.question}</div>
                        <div style="display:flex; flex-direction:column; gap:6px;">
                            ${optionsHtml}
                        </div>
                        ${(function () {
                        // Try to get explanation from saved question, or lookup in current QCM_OFFICIAL
                        let expl = q.explanation || q.explication;
                        if (!expl && typeof QCM_OFFICIAL !== 'undefined' && window.QCM_OFFICIAL.questions) {
                            const currentQ = window.QCM_OFFICIAL.questions.find(curr => curr.code === q.code);
                            if (currentQ) expl = currentQ.explication || currentQ.explanation;
                        }

                        if (expl) {
                            return `<div style="margin-top:12px; padding:8px; background:rgba(251, 146, 60, 0.15); border-left:3px solid #fb923c; font-size:0.85rem; color:var(--text-main); border-radius:8px;">
                                    <div style="font-weight:700; font-size:0.75rem; color:#fb923c; margin-bottom:4px; text-transform:uppercase;">Explication</div>
                                    ${expl}</div>`;
                        }
                        return '';
                    })()}
                    </div >
    `;
            });

            questionsHtml += '</div></div>';

            html += `
    <div data-exam-id="${exam.id}" style="background:var(--bg-card); padding:16px; border-radius:12px; border:1px solid var(--border-color); cursor:pointer;" data-action="QuiztoggleExamDetails" data-args="[${exam.id}]" >
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="flex:1;">
                <div style="display:flex; gap:8px; align-items:center; margin-bottom:6px;">
                    <span style="font-size:0.75rem; opacity:0.6;">${dateStr}</span>
                    <span style="background:rgba(255,255,255,0.05); padding:2px 8px; border-radius:4px; font-size:0.7rem;">${levelLabel}</span>
                    ${exam.invalidated ? '<span style="background:rgba(248, 113, 113, 0.1); color:#f87171; border:1px solid #f87171; padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:bold;">INVALIDÉ</span>' : ''}
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

    sortQuestions(sortBy) {
        const list = document.getElementById('all-questions-list');
        if (!list) return;

        // Toggle direction if clicking same sort
        if (QuizView.state.sortState.field === sortBy) {
            QuizView.state.sortState.dir = QuizView.state.sortState.dir === 'asc' ? 'desc' : 'asc';
        } else {
            QuizView.state.sortState.field = sortBy;
            // Default directions: Rate -> ASC (worst first), Attempts -> DESC (most first)
            QuizView.state.sortState.dir = (sortBy === 'rate') ? 'asc' : 'desc';
        }

        const dir = QuizView.state.sortState.dir;
        const items = Array.from(list.querySelectorAll('.question-stat-item'));

        // Update button states & Icons
        // Update button states & Icons - Scope only to Stats buttons
        const statsButtons = ['sort-rate-btn', 'sort-attempts-btn', 'sort-streak-btn'];
        statsButtons.forEach(id => {
            const btn = document.getElementById(id);
            if (!btn) return;

            btn.style.background = 'transparent';
            // Reset text (remove arrows)
            let baseText = 'Par taux';
            if (id === 'sort-attempts-btn') baseText = 'Par tentatives';
            if (id === 'sort-streak-btn') baseText = 'Par série';
            btn.innerHTML = baseText;
        });

        const activeBtn = document.getElementById(sortBy === 'rate' ? 'sort-rate-btn' : (sortBy === 'attempts' ? 'sort-attempts-btn' : 'sort-streak-btn'));
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
                valA = parseInt(a.dataset.streak || 0);
                valB = parseInt(b.dataset.streak || 0);
            } else {
                valA = parseInt(a.dataset.total);
                valB = parseInt(b.dataset.total);
            }

            if (dir === 'asc') return valA - valB;
            else return valB - valA;
        });

        list.innerHTML = '';
        items.forEach(item => list.appendChild(item));
    }

    toggleQuestionDetails(code) {
        const card = document.querySelector(`[data-code="${code}"]`);
        if (!card) return;

        const answersDiv = card.querySelector('.question-answers');
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
        if (QuizView.state.masteryFilter === filter) {
            QuizView.state.masteryFilter = 'ALL'; // Toggle off
        } else {
            QuizView.state.masteryFilter = filter;
        }
        this.renderStats();
    }

    setThemeFilter(theme) {
        if (QuizView.state.themeFilter === theme) {
            QuizView.state.themeFilter = null; // Toggle off
        } else {
            QuizView.state.themeFilter = theme;
        }
        this.renderStats();
    }

    setThemeSort(sortType) {
        if (QuizView.state.themeSort === sortType) {
            // Toggle direction
            QuizView.state.themeSortDir = QuizView.state.themeSortDir === 'asc' ? 'desc' : 'asc';
        } else {
            QuizView.state.themeSort = sortType;
            QuizView.state.themeSortDir = 'desc'; // Default to desc for new sort
            if (sortType === 'alpha') QuizView.state.themeSortDir = 'asc'; // Default asc for alpha
        }
        this.renderStats();
    }


    reviewExam(examIdArgs) {
        let examId = examIdArgs;
        if (Array.isArray(examIdArgs)) {
            examId = examIdArgs[0];
        }
        const history = QuizService.getExamHistory();
        const exam = history.find(e => e.id === examId);
        if (!exam) return;
        
        const statsContent = document.getElementById('stats-content');
        if (!statsContent) return;
        
        const date = formatDateTime(exam.date);

        let html = `<h2>Revue de l'examen du ${date}</h2>`;
        html += `<button class="action-btn-secondary" data-action="QuizshowStatsScreen" style="margin-bottom: 20px;">&larr; Retour aux statistiques</button>`;
        
        const errors = exam.results.filter(r => !r.isCorrect);
        
        if (errors.length === 0) {
            html += `<p class="success-text">Félicitations, aucune erreur !</p>`;
        } else {
            html += `<h3>Erreurs (${errors.length})</h3>`;
            html += `<div style="display: flex; flex-direction: column; gap: 15px;">`;
            
            errors.forEach(err => {
                const q = QuizService.allQuestions.find(qq => qq.code === err.code);
                if (q) {
                    html += `
                        <div class="card error-card" style="border-left: 3px solid #ef4444; padding: 15px; border-radius: 8px; background: var(--bg-card, #fff); box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                            <div style="margin-bottom: 10px;">
                                <strong style="color: var(--text-main, #333);">${escapeHTML(q.code)} - ${escapeHTML(q.theme)}</strong><br>
                                <p style="margin: 8px 0; color: var(--text-main, #333);">${escapeHTML(q.texte)}</p>
                            </div>
                            <div style="font-size: 0.9em; background: var(--bg-secondary, #f9f9f9); padding: 10px; border-radius: 6px;">
                                ${q.reponses.map((r, i) => {
                                    const isGood = r.points > 0;
                                    return `<div style="color: ${isGood ? '#22c55e' : 'var(--text-main, #666)'}; ${isGood ? 'font-weight: bold;' : 'margin-bottom: 4px;'}">${escapeHTML(r.texte)} ${isGood ? '✓' : ''}</div>`;
                                }).join('')}
                            </div>
                        </div>
                    `;
                } else {
                    html += `<div class="card error-card" style="border-left: 3px solid #ef4444; padding: 15px; border-radius: 8px;">Question ${err.code} introuvable</div>`;
                }
            });
            html += `</div>`;
        }
        
        statsContent.innerHTML = html;
    }

    startSession() {
        try {
            const level = typeof GlobalState !== 'undefined' ? GlobalState.get('level') : 'BI';
            const firstQuestion = QuizService.startSession(level);
            
            document.querySelectorAll('.mode-screen').forEach(s => s.classList.remove('active'));
            document.getElementById('qcm-screen').classList.add('active');
            
            this.renderQuestion(firstQuestion);
        } catch(e) {
            alert(e.message);
        }
    }

    renderQuestion(q) {
        const feedbackDiv = document.getElementById('qcm-feedback');
        feedbackDiv.style.display = 'none';
        
        const container = document.getElementById('qcm-question-text');
        const choicesDiv = document.getElementById('qcm-choices');
        const actionsDiv = document.getElementById('qcm-actions-container');
        
        if (!q) {
            // End of quiz
            this.renderExamResults();
            return;
        }

        const qIdx = QuizService.state.qcmIndex + 1;
        const total = QuizService.state.qcmSessionData.length;

        let badgeHtml = '';
        if (QuizService.state.qcmConfig.mode === 'REVISION') {
            const stats = QuizService.getPersistentStats();
            const s = stats.questions[q.code];
            if (!s || s.total === 0) {
                badgeHtml = `<div class="quiz-theme-tag" style="background:var(--accent-blue, #3b82f6); color:#fff; border-color:var(--accent-blue, #3b82f6); margin-left: 8px;"><i class="ri-sparkling-line"></i> Nouveau</div>`;
            } else {
                badgeHtml = `<div class="quiz-theme-tag" style="background:#f87171; color:#fff; border-color:#f87171; margin-left: 8px;"><i class="ri-refresh-line"></i> À revoir</div>`;
            }
        }
        
        const letters = q.code.replace(/^[a-zA-Z]+\d+/, '');
        let colorStyle = '';
        const colorMap = {
            'V': 'rgba(34, 197, 94, 0.2)', // Vert
            'B': 'rgba(59, 130, 246, 0.2)', // Bleu
            'M': 'rgba(139, 69, 19, 0.2)', // Marron
            'T': 'rgba(168, 85, 247, 0.2)'  // Violet
        };
        const textColors = { 'V': '#4ade80', 'B': '#60a5fa', 'M': '#c0773d', 'T': '#c084fc' };
        
        const validLetters = letters.split('').filter(l => colorMap[l]);
        if (validLetters.length === 1) {
            colorStyle = `background: ${colorMap[validLetters[0]]}; color: ${textColors[validLetters[0]]}; border: 1px solid ${colorMap[validLetters[0]].replace('0.2', '0.4')};`;
        } else if (validLetters.length > 1) {
            let stops = [];
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
                    <div class="quiz-progress" style="margin-left: auto;">Question ${qIdx} / ${total}</div>
                </div>
            </div>
            <div class="quiz-question-text">${escapeHTML(q.question)}</div>
        `;

        // Render choices
        choicesDiv.innerHTML = q.choices.map((opt, idx) => `
            <button class="qcm-option" data-action="toggle-option" data-idx="${idx}">
                ${escapeHTML(opt.text)}
            </button>
        `).join('');
        
        // Cache choices for reference during selection
        this._currentChoices = q.choices;

        // Render Actions
        actionsDiv.innerHTML = `
            ${qIdx > 1 ? '<button class="next-btn" data-action="prev-question" style="flex:0 0 60px;"><i class="ri-arrow-left-line"></i></button>' : ''}
            <button class="next-btn" id="qcm-validate-btn" data-action="validate-question" style="flex:1;">VALIDER</button>
        `;
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
        if(!result) return;
        
        const isExam = QuizService.state.qcmConfig.mode === 'EXAM';
        
        if (isExam) {
            this.renderQuestion(QuizService.nextQuestion());
        } else {
            // Training mode: Visual feedback
            document.getElementById('qcm-validate-btn').remove();
            const btns = document.querySelectorAll('.qcm-option');
            
            btns.forEach(btn => {
                btn.disabled = true;
                const idx = parseInt(btn.getAttribute('data-idx'));
                const opt = this._currentChoices[idx];
                const isSelected = result.selected.includes(opt);
                
                if (opt.pts > 0) {
                    if (isSelected) {
                        btn.classList.add('correct');
                        btn.innerHTML += ' <i class="ri-check-double-line"></i>';
                    } else {
                        btn.classList.add('missed');
                    }
                } else if (opt.pts < 0 && isSelected) {
                    btn.classList.add('incorrect');
                }
            });
            
            const actionsDiv = document.getElementById('qcm-actions-container');
            actionsDiv.innerHTML += `<button class="next-btn" data-action="next-question" style="flex:1;">QUESTION SUIVANTE <i class="ri-arrow-right-line"></i></button>`;
            
            const feedbackDiv = document.getElementById('qcm-feedback');
            feedbackDiv.style.display = 'block';
            feedbackDiv.innerHTML = `
                <div class="instructor-feedback ${result.isCorrect ? 'feedback-success' : 'feedback-fail'}">
                    <div>${result.question.explication}</div>
                </div>
            `;
        }
    }

    renderExamResults() {
        const isExam = QuizService.state.qcmConfig.mode === 'EXAM';
        const modeTitle = isExam ? 'MODE EXAMEN' : (QuizService.state.qcmConfig.mode === 'REVISION' ? 'MODE RÉVISION' : 'MODE ENTRAÎNEMENT');
        
        if (isExam) {
            const level = typeof GlobalState !== 'undefined' ? GlobalState.get('level') : 'BI';
            QuizService.saveExamHistory(level);
        }
        
        const container = document.getElementById('qcm-question-text');
        const choicesDiv = document.getElementById('qcm-choices');
        const actionsDiv = document.getElementById('qcm-actions-container');
        document.getElementById('qcm-feedback').style.display = 'none';
        
        // Update the mode label dynamically based on mode
        const modeLabel = document.getElementById('qcm-mode-label');
        if (modeLabel) modeLabel.innerText = modeTitle;
        
        const results = QuizService.state.examResults;
        const total = QuizService.state.qcmSessionData && QuizService.state.qcmSessionData.length > 0 ? QuizService.state.qcmSessionData.length : results.length;
        const score = results.filter(r => r.isCorrect).length;
        const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
        const passed = percentage >= 75;
        const isInvalidated = QuizService.state.invalidated === true;
        
        const badgeHtml = isInvalidated ? 
            `<span style="background:rgba(248,113,113,0.1); color:#f87171; padding:4px 12px; border-radius:8px; font-size:1.1rem; font-weight:bold; border:1px solid #f87171;">INVALIDÉ</span>` :
            (passed ? 
            `<span style="background:rgba(74,222,128,0.1); color:#16a34a; padding:4px 12px; border-radius:8px; font-size:1.1rem; font-weight:bold; border:1px solid #4ade80;">RÉUSSI</span>` :
            `<span style="background:rgba(248,113,113,0.1); color:#dc2626; padding:4px 12px; border-radius:8px; font-size:1.1rem; font-weight:bold; border:1px solid #f87171;">ÉCHOUÉ</span>`);
        
        container.innerHTML = `
            <div class="stats-circle-container" style="display:flex; flex-direction:column; align-items:center; gap:24px; margin-bottom: 32px;">
                <h2 style="margin:0;">RÉSULTATS</h2>
                <div style="display:flex; align-items:center; justify-content:center; gap:32px; background:var(--bg-card); padding:24px 32px; border-radius:16px; border:1px solid var(--border-color); box-shadow:0 4px 6px rgba(0,0,0,0.05);">
                    <div class="stats-circle" style="margin:0;">${score}/${total}</div>
                    <div style="display:flex; flex-direction:column; gap:12px; align-items:center;">
                        <div style="font-size:2rem; font-weight:800; color:var(--text-main);">${percentage}%</div>
                        ${isExam ? badgeHtml : ''}
                    </div>
                </div>
            </div>
            
            <div style="margin-top: 32px; font-weight: 600; font-size: 1.2rem; border-bottom: 2px solid var(--border-color); padding-bottom: 12px; margin-bottom: 24px; color:var(--text-main);">
                Récapitulatif des questions
            </div>
            
            <div class="bank-container" style="display: flex; flex-direction: column; gap: 20px;">
                ${results.filter(r => !r.isCorrect).length === 0 ? 
                    `<div style="text-align: center; padding: 32px; background: rgba(74, 222, 128, 0.1); border-radius: var(--radius-md); border:1px solid #4ade80; color: #16a34a;">
                        <i class="ri-trophy-line" style="font-size: 3rem; margin-bottom:16px; display:block;"></i>
                        <span style="font-size:1.2rem; font-weight:bold;">Félicitations, vous n'avez fait aucune erreur !</span>
                    </div>` 
                : results.filter(r => !r.isCorrect).map((r, i) => `
                    <div class="bank-item" style="border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 20px; background: var(--bg-card); box-shadow:0 2px 4px rgba(0,0,0,0.02);">
                        <div class="bank-item-header" style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items:center;">
                            <span class="bank-item-code" style="font-family:monospace; font-size:0.85rem; color:var(--text-secondary); background:rgba(0,0,0,0.05); padding:4px 8px; border-radius:4px;">#${r.question.code}</span>
                            <span class="badge" style="background:rgba(248,113,113,0.1); color:#dc2626; border:1px solid #f87171; padding:2px 8px; border-radius:4px; font-size:0.75rem; font-weight:bold;">FAUX</span>
                        </div>
                        <div class="bank-item-question" style="font-weight: 600; font-size:1.1rem; margin-bottom: 16px; color:var(--text-main); line-height:1.4;">${r.question.question}</div>
                        <div class="bank-item-choices" style="display: flex; flex-direction: column; gap: 10px;">
                            ${r.question.choices.map(c => {
                                const isUserSelected = r.selected.some(sel => sel.text === c.text);
                                const isCorrectChoice = c.pts > 0;
                                
                                let bgStyle = 'background: transparent; border-color: var(--border-color); color: var(--text-secondary);';
                                let icon = '<i class="ri-checkbox-blank-circle-line" style="color:var(--text-muted); margin-right: 8px;"></i>';
                                let borderStyle = '1px solid var(--border-color)';
                                
                                if (isUserSelected && isCorrectChoice) {
                                    // Cochee et Juste -> Vert
                                    bgStyle = 'background: rgba(74, 222, 128, 0.15); color: var(--text-main);';
                                    borderStyle = '2px solid #4ade80';
                                    icon = '<i class="ri-checkbox-circle-fill" style="color:#16a34a; font-size:1.2rem; margin-right: 8px;"></i>';
                                } else if (isUserSelected && !isCorrectChoice) {
                                    // Cochee et Fausse -> Rouge
                                    bgStyle = 'background: rgba(248, 113, 113, 0.15); color: var(--text-main);';
                                    borderStyle = '2px solid #f87171';
                                    icon = '<i class="ri-close-circle-fill" style="color:#dc2626; font-size:1.2rem; margin-right: 8px;"></i>';
                                } else if (!isUserSelected && isCorrectChoice) {
                                    // Non Cochee et Juste (Oubli) -> Orange
                                    bgStyle = 'background: rgba(251, 146, 60, 0.15); color: var(--text-main);';
                                    borderStyle = '2px solid #fb923c';
                                    icon = '<i class="ri-error-warning-fill" style="color:#ea580c; font-size:1.2rem; margin-right: 8px;"></i>';
                                }
                                
                                return `
                                <div class="bank-choice" style="${bgStyle} border: ${borderStyle}; padding: 12px 16px; border-radius: 8px; font-size: 0.95rem; display: flex; justify-content: space-between; align-items:center;">
                                    <span style="display:flex; align-items:center; flex:1;">${icon} <span style="flex:1;">${c.text}</span></span>
                                    <span style="font-weight:bold; margin-left:12px; color:var(--text-secondary);">${isUserSelected ? '<i class="ri-user-line" style="margin-right: 4px;" title="Votre réponse"></i>' : ''}${c.pts > 0 ? '+'+c.pts : (c.pts < 0 ? c.pts : '')}</span>
                                </div>
                                `;
                            }).join('')}
                        </div>
                        ${r.question.explication ? `<div class="bank-item-explication" style="margin-top: 20px; font-size: 0.95rem; color: var(--text-main); background: rgba(251, 146, 60, 0.1); border-left:4px solid #fb923c; padding: 16px; border-radius: 0 8px 8px 0;"><div style="font-weight:bold; color:#ea580c; margin-bottom:4px; font-size:0.8rem; text-transform:uppercase;"><i class="ri-information-fill" style="margin-right: 4px;"></i>Explication</div>${r.question.explication}</div>` : ''}
                    </div>
                `).join('')}
            </div>
        `;
        
        choicesDiv.innerHTML = '';
        actionsDiv.innerHTML = `<button class="next-btn" data-action="finish-session" style="width:100%;">TERMINER</button>`;
    }

    setMasteryFilter(filter) {
        if (QuizView.state.masteryFilter === filter) {
            QuizView.state.masteryFilter = 'ALL'; // Toggle off
        } else {
            QuizView.state.masteryFilter = filter;
        }
        QuizView.renderStats();
    }

    setThemeFilter(theme) {
        if (QuizView.state.themeFilter === theme) {
            QuizView.state.themeFilter = null; // Toggle off
        } else {
            QuizView.state.themeFilter = theme;
        }
        QuizView.renderStats();
    }


    sortQuestions(sortBy) {
        const list = document.getElementById('all-questions-list');
        if (!list) return;

        // Toggle direction if clicking same sort
        if (QuizView.state.sortState.field === sortBy) {
            QuizView.state.sortState.dir = QuizView.state.sortState.dir === 'asc' ? 'desc' : 'asc';
        } else {
            QuizView.state.sortState.field = sortBy;
            // Default directions: Rate -> ASC (worst first), Attempts -> DESC (most first)
            QuizView.state.sortState.dir = (sortBy === 'rate') ? 'asc' : 'desc';
        }

        const dir = QuizView.state.sortState.dir;
        const items = Array.from(list.querySelectorAll('.question-stat-item'));

        // Update button states & Icons
        // Update button states & Icons - Scope only to Stats buttons
        const statsButtons = ['sort-rate-btn', 'sort-attempts-btn', 'sort-streak-btn'];
        statsButtons.forEach(id => {
            const btn = document.getElementById(id);
            if (!btn) return;

            btn.style.background = 'transparent';
            // Reset text (remove arrows)
            let baseText = 'Par taux';
            if (id === 'sort-attempts-btn') baseText = 'Par tentatives';
            if (id === 'sort-streak-btn') baseText = 'Par série';
            btn.innerHTML = baseText;
        });

        const activeBtn = document.getElementById(sortBy === 'rate' ? 'sort-rate-btn' : (sortBy === 'attempts' ? 'sort-attempts-btn' : 'sort-streak-btn'));
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
                valA = parseInt(a.dataset.streak || 0);
                valB = parseInt(b.dataset.streak || 0);
            } else {
                valA = parseInt(a.dataset.total);
                valB = parseInt(b.dataset.total);
            }

            if (dir === 'asc') return valA - valB;
            else return valB - valA;
        });

        list.innerHTML = '';
        items.forEach(item => list.appendChild(item));
    }

    toggleQuestionDetails(code) {
        const card = document.querySelector(`[data-code="${code}"]`);
        if (!card) return;

        const answersDiv = card.querySelector('.question-answers');
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
        if (QuizView.state.masteryFilter === filter) {
            QuizView.state.masteryFilter = 'ALL'; // Toggle off
        } else {
            QuizView.state.masteryFilter = filter;
        }
        QuizView.renderStats();
    }

    setThemeFilter(theme) {
        if (QuizView.state.themeFilter === theme) {
            QuizView.state.themeFilter = null; // Toggle off
        } else {
            QuizView.state.themeFilter = theme;
        }
        QuizView.renderStats();
    }

    setThemeSort(sortType) {
        if (QuizView.state.themeSort === sortType) {
            // Toggle direction
            QuizView.state.themeSortDir = QuizView.state.themeSortDir === 'asc' ? 'desc' : 'asc';
        } else {
            QuizView.state.themeSort = sortType;
            QuizView.state.themeSortDir = 'desc'; // Default to desc for new sort
            if (sortType === 'alpha') QuizView.state.themeSortDir = 'asc'; // Default asc for alpha
        }
        QuizView.renderStats();
    }

    clearAllFilters() {
        QuizView.state.masteryFilter = 'ALL';
        QuizView.state.themeFilter = null;
        QuizView.renderStats();
    }



    // --- STATISTICS MANAGEMENT ---

    resetStats() {
        if (confirm('Êtes-vous sûr de vouloir réinitialiser toutes vos statistiques ?')) {
            StorageService.remove(StorageService.KEYS.QCM_STATS);
            if (window.FirebaseAuthEngine && window.FirebaseAuthEngine.enabled) {
                window.FirebaseAuthEngine.saveStatsToCloud();
            }
            alert('Statistiques réinitialisées !');
            QuizView.renderStats();
        }
    }

    saveExamHistory(level, score, total, results) {
        if (window.GdprEngine && !window.GdprEngine.isConsentGranted('stats')) {
            console.log("Stats consent missing, skipping exam history save.");
            return;
        }
        try {
            let history = StorageService.get(StorageService.KEYS.EXAM_HISTORY) || { exams: [] };
            if (typeof history !== 'object' || !history.exams) {
                history = { exams: [] };
            }

            const exam = {
                id: Date.now(),
                date: new Date().toISOString(),
                level: level,
                score: score,
                total: total,
                percentage: Math.round((score / total) * 100),
                results: results
            };

            history.exams.unshift(exam); // Add to beginning
            history.exams = history.exams.slice(0, 10); // Keep only last 10

            StorageService.set(StorageService.KEYS.EXAM_HISTORY, history);
            if (window.FirebaseAuthEngine && window.FirebaseAuthEngine.enabled) {
                window.FirebaseAuthEngine.saveHistoryToCloud();
            }
        } catch (e) {
            console.error("Failed to save exam history", e);
        }
    }


    importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';

        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);

                    // Basic validation of the file structure
                    if (!data.stats || !data.examHistory) {
                        alert('❌ Fichier invalide: Format de données incorrect');
                        return;
                    }

                    if (confirm('⚠️ Cela va remplacer toutes vos statistiques et historiques actuels. Continuer ?')) {
                        // Save directly to localStorage
                        StorageService.set(StorageService.KEYS.QCM_STATS, data.stats);
                        StorageService.set(StorageService.KEYS.EXAM_HISTORY, { exams: data.examHistory });

                        // Force update of current runtime stats if needed? 
                        // Actually getPersistentStats reads from localStorage so it's fine.

                        alert('✅ Données importées avec succès !');

                        try {
                            // Refresh stats display
                            QuizView.renderStats();
                        } catch (renderError) {
                            console.error("Render failed after import", renderError);
                            alert("Données importées, mais une erreur est survenue lors de l'affichage. Veuillez recharger la page.");
                        }
                    }
                } catch (e) {
                    console.error('Import failed', e);
                    alert('❌ Erreur lors de l\'import : ' + e.message);
                }
            };
            reader.readAsText(file);
        };

        input.click();
    }
    toggleExamDetails(examId) {
        const card = document.querySelector(`[data-exam-id="${examId}"]`);
        if (!card) return;

        const detailsDiv = card.querySelector('.exam-details');
        const arrow = card.querySelector('.exam-arrow');

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
                version: '1.0'
            };

            const json = JSON.stringify(data, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0];
            const timeStr = now.getHours().toString().padStart(2, '0') + '-' + now.getMinutes().toString().padStart(2, '0');
            a.download = `parapente_stats_${dateStr}_${timeStr}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            alert('✅ Données exportées avec succès !');
        } catch (e) {
            console.error('Export failed', e);
            alert('❌ Erreur lors de l\'export');
        }
    }

    importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';

        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);

                    if (!data.stats || !data.examHistory) {
                        alert('❌ Fichier invalide');
                        return;
                    }

                    if (confirm('⚠️ Cela va remplacer vos données actuelles. Continuer ?')) {
                        StorageService.set(StorageService.KEYS.QCM_STATS, data.stats);
                        StorageService.set(StorageService.KEYS.EXAM_HISTORY, { exams: data.examHistory });

                        alert('✅ Données importées avec succès !');
                        QuizView.renderStats();
                    }
                } catch (e) {
                    console.error('Import failed', e);
                    alert('❌ Erreur lors de l\'import : fichier corrompu');
                }
            };
            reader.readAsText(file);
        };

        input.click();
    }

    getCourseUrl(questionCode, questionText) {
        return null;
    }

    toggleExamDetails(examId) {
        const card = document.querySelector(`[data-exam-id="${examId}"]`);
        if (!card) return;

        const detailsDiv = card.querySelector('.exam-details');
        const arrow = card.querySelector('.exam-arrow');

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

} // End Class

const QuizView = new QuizViewClass();
export default QuizView;
