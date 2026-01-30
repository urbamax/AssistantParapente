/**
 * QUIZ ENGINE - Handling QCM & Statistics
 * Extracted from Engine.js for better modularity.
 */

const QuizEngine = {
    state: {
        qcmIndex: 0,
        qcmConfig: {
            mode: 'TRAINING', // TRAINING, EXAM, REVISION
            count: 10,
            theme: 'ALL'
        },
        qcmSessionData: [],
        currentQcmSelection: new Set(),
        examResults: [],
        mainEngine: null // Reference to main Engine
    },

    init: function (mainEngine) {
        this.state.mainEngine = mainEngine;
        console.log("QuizEngine Initialized");
    },

    // --- UTILS ---
    shuffle: function (array) {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    },

    // --- SETUP & NAVIGATION ---
    showSetup: function () {
        document.getElementById('qcm-setup-screen').classList.add('active');
        this.renderThemes();
    },

    renderThemes: function () {
        const themeSelect = document.getElementById('qcm-theme-select');
        if (themeSelect && themeSelect.options.length <= 1) {
            let themes = new Set();
            if (typeof QCM_OFFICIAL !== 'undefined' && QCM_OFFICIAL.questions) {
                const map = {
                    'A': 'Météo',
                    'E': 'Mécavol', 'G': 'Mécavol', 'H': 'Mécavol',
                    'L': 'Matériel', 'N': 'Matériel', 'R': 'Matériel',
                    'U': 'Pilotage', 'W': 'Pilotage', 'X': 'Pilotage',
                    'S': 'Réglementation',
                    'F': 'Facteurs humains',
                    'P': 'Milieu naturel'
                };
                QCM_OFFICIAL.questions.forEach(q => {
                    const code = q.code.charAt(0);
                    themes.add(map[code] || 'Autre');
                });
            } else {
                if (typeof QCM_DATA !== 'undefined') {
                    QCM_DATA.forEach(q => themes.add(q.theme));
                }
            }

            [...themes].sort().forEach(theme => {
                const opt = document.createElement('option');
                opt.value = theme;
                opt.innerText = theme;
                themeSelect.appendChild(opt);
            });
        }
    },

    setMode: function (mode) {
        this.state.qcmConfig.mode = mode;

        // UI Updates
        document.querySelectorAll('.mode-toggle-btn').forEach(btn => btn.classList.remove('active'));
        if (mode === 'TRAINING') document.getElementById('mode-training').classList.add('active');
        else if (mode === 'EXAM') document.getElementById('mode-exam').classList.add('active');
        else if (mode === 'REVISION') document.getElementById('mode-revision').classList.add('active');

        const trainingOptions = document.getElementById('training-options');
        if (mode === 'EXAM') {
            trainingOptions.style.opacity = '0.3';
            trainingOptions.style.pointerEvents = 'none';
        } else {
            trainingOptions.style.opacity = '1';
            trainingOptions.style.pointerEvents = 'auto';
        }
    },

    setCount: function (count) {
        this.state.qcmConfig.count = count;
        document.querySelectorAll('.count-btn').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.innerText) === count);
        });
    },

    // --- SESSION MGMT ---
    startSession: function () {
        // Resolve Level from Main Engine
        const level = this.state.mainEngine ? this.state.mainEngine.state.level : 'BI';

        const getCategory = (code) => {
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
            return map[letter] || 'Autre';
        };

        // Filter Questions
        let sourceData = [];
        if (typeof QCM_OFFICIAL !== 'undefined' && QCM_OFFICIAL.questions) {
            console.log("Using Official FFVL Data");
            sourceData = QCM_OFFICIAL.questions.map(q => ({
                code: q.code,
                question: q.question,
                choices: q.ans.map(a => ({
                    text: a.text,
                    correct: parseInt(a.pts) > 0,
                    pts: parseInt(a.pts)
                })),
                explanation: " (Source: QCM FFVL Officiel)",
                theme: getCategory(q.code),
                level: (function (c) {
                    const lastChar = c.charAt(c.length - 1).toUpperCase();
                    if (lastChar === 'V') return 1; // Vert -> BI
                    if (lastChar === 'B') return 2; // Bleu -> BP
                    if (lastChar === 'M') return 3; // Marron -> BPC
                    return q.niveau || 0;
                })(q.code)
            }));
        } else {
            console.warn("Official Data Not Found, falling back to legacy.");
            if (level === 'BI') sourceData = typeof QCM_BI !== 'undefined' ? QCM_BI : [];
            else if (level === 'BP') sourceData = typeof QCM_BP !== 'undefined' ? QCM_BP : [];
            else if (level === 'BPC') sourceData = typeof QCM_BPC !== 'undefined' ? QCM_BPC : [];
        }

        // Apply Filters
        if (typeof QCM_OFFICIAL !== 'undefined') {
            const excludedPrefixes = ['H', 'R', 'X']; // Delta specifics
            sourceData = sourceData.filter(q => !excludedPrefixes.includes(q.code.charAt(0)));

            const targetLevel = (level === 'BI') ? 1 : (level === 'BP') ? 2 : (level === 'BPC') ? 3 : 0;
            if (targetLevel > 0) {
                sourceData = sourceData.filter(q => q.level === targetLevel);
            }
        }

        const mode = this.state.qcmConfig.mode;
        let count = this.state.qcmConfig.count;
        const selectedTheme = document.getElementById('qcm-theme-select') ? document.getElementById('qcm-theme-select').value : 'ALL';

        if (mode === 'REVISION') {
            const stats = this.getPersistentStats();
            if (selectedTheme !== 'ALL') sourceData = sourceData.filter(q => q.theme === selectedTheme);

            // Filter questions that have been attempted at least once
            sourceData = sourceData.filter(q => {
                const s = stats.questions[q.code];
                return s && s.total > 0;
            });

            if (sourceData.length === 0) {
                alert("Aucune question à réviser ! Vous devez d'abord faire des quiz pour générer des statistiques.");
                return;
            }

            // Sort by success rate (worst first) and streak (prioritize non-mastered)
            sourceData.sort((a, b) => {
                const statsA = stats.questions[a.code];
                const statsB = stats.questions[b.code];

                const rateA = statsA.total > 0 ? (statsA.correct / statsA.total) : 0;
                const rateB = statsB.total > 0 ? (statsB.correct / statsB.total) : 0;

                // First priority: success rate (lower is worse, should come first)
                if (rateA !== rateB) {
                    return rateA - rateB;
                }

                // Second priority: streak (lower streak = needs more practice)
                const streakA = statsA.streak || 0;
                const streakB = statsB.streak || 0;
                return streakA - streakB;
            });

        } else if (mode === 'TRAINING') {
            const stats = this.getPersistentStats();
            if (selectedTheme !== 'ALL') sourceData = sourceData.filter(q => q.theme === selectedTheme);

            // Sort by attempt count (fewest attempts first) to prioritize unexplored questions
            sourceData.sort((a, b) => {
                const statsA = stats.questions[a.code];
                const statsB = stats.questions[b.code];

                const attemptsA = statsA ? statsA.total : 0;
                const attemptsB = statsB ? statsB.total : 0;

                return attemptsA - attemptsB;
            });

        } else if (selectedTheme !== 'ALL') {
            sourceData = sourceData.filter(q => q.theme === selectedTheme);
        }

        if (mode === 'EXAM') {
            if (level === 'BI') count = 30;
            else if (level === 'BP') count = 60;
            else if (level === 'BPC') count = 30;
        }

        if (sourceData.length === 0) {
            alert("Aucune question disponible pour ce filtre !");
            return;
        }

        // For TRAINING and REVISION: keep sorted order to prioritize
        // For EXAM: shuffle for randomness
        let questions;
        if (mode === 'TRAINING' || mode === 'REVISION') {
            questions = sourceData.slice(0, count);
        } else {
            questions = this.shuffle(sourceData).slice(0, count);
        }

        if (questions.length === 0) {
            alert("Aucune question trouvée !");
            return;
        }

        this.state.qcmSessionData = questions;
        this.state.qcmIndex = 0;
        this.state.examResults = [];
        this.state.currentQcmSelection = new Set(); // Reset

        // Switch Screens
        document.getElementById('qcm-setup-screen').classList.remove('active');
        document.getElementById('qcm-screen').classList.add('active');

        this.renderQuestion();
    },

    renderQuestion: function () {
        const sessionData = this.state.qcmSessionData;
        if (!sessionData || sessionData.length === 0) return;

        this.state.currentQcmSelection = new Set();

        // Restore Exam Selection
        if (this.state.qcmConfig.mode === 'EXAM' && this.state.examResults[this.state.qcmIndex]) {
            const prevResult = this.state.examResults[this.state.qcmIndex];
            if (prevResult && prevResult.selected) {
                prevResult.selected.forEach(s => this.state.currentQcmSelection.add(s));
            }
        }

        // Check End
        if (this.state.qcmIndex >= sessionData.length) {
            if (this.state.qcmConfig.mode === 'EXAM') {
                this.showExamResults();
            } else {
                this.finishTraining();
            }
            return;
        }

        const q = sessionData[this.state.qcmIndex];
        const feedbackDiv = document.getElementById('qcm-feedback');
        if (feedbackDiv) feedbackDiv.style.display = 'none';

        let levelLabel = "N/A";
        if (q.level === 1) levelLabel = "BI";
        else if (q.level === 2) levelLabel = "BP";
        else if (q.level === 3) levelLabel = "BPC";

        document.getElementById('qcm-question-text').innerHTML = `
            <div class="quiz-header-row">
                <div class="quiz-meta">
                    <div class="quiz-theme-tag">${q.theme}</div>
                    <div class="quiz-progress">Question ${this.state.qcmIndex + 1} / ${sessionData.length}</div>
                    <div style="font-size:0.8rem; opacity:0.4; font-family:monospace;">(#${q.code})</div>
                </div>
                <div class="level-tag" style="margin:0; font-size:0.75rem;">${levelLabel}</div>
            </div>
            <div class="quiz-question-text">${q.question}</div>
        `;

        const choicesDiv = document.getElementById('qcm-choices');
        choicesDiv.innerHTML = '';
        const shuffledChoices = this.shuffle(q.choices);

        shuffledChoices.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'qcm-option';
            if (this.state.currentQcmSelection.has(opt)) btn.classList.add('selected');

            const text = opt.text;
            btn.innerText = text.charAt(0).toUpperCase() + text.slice(1);
            btn._optionData = opt;
            btn.onclick = () => this.toggleSelection(opt, btn);
            choicesDiv.appendChild(btn);
        });

        this.renderActions(choicesDiv, q);
    },

    renderActions: function (container, question) {
        const actionContainer = document.createElement('div');
        actionContainer.style.display = 'flex';
        actionContainer.style.gap = '10px';
        actionContainer.style.marginTop = '15px';

        if (this.state.qcmIndex > 0) {
            const prevBtn = document.createElement('button');
            prevBtn.className = 'next-btn';
            prevBtn.onclick = () => {
                this.state.qcmIndex--;
                this.renderQuestion();
            };
            prevBtn.style.background = 'rgba(255,255,255,0.1)';
            prevBtn.style.border = '1px solid rgba(255,255,255,0.2)';
            prevBtn.innerHTML = "<i class='ri-arrow-left-line'></i>";
            prevBtn.style.width = "auto";
            prevBtn.style.flex = "0 0 60px";
            actionContainer.appendChild(prevBtn);
        }

        const validateBtn = document.createElement('button');
        validateBtn.id = 'qcm-validate-btn';
        validateBtn.className = 'next-btn';
        validateBtn.innerText = "VALIDER";
        validateBtn.style.width = "100%";
        validateBtn.style.flex = "1";
        validateBtn.onclick = () => this.validate(question);
        actionContainer.appendChild(validateBtn);

        container.appendChild(actionContainer);
    },

    toggleSelection: function (opt, btnElement) {
        if (this.state.currentQcmSelection.has(opt)) {
            this.state.currentQcmSelection.delete(opt);
            btnElement.classList.remove('selected');
        } else {
            this.state.currentQcmSelection.add(opt);
            btnElement.classList.add('selected');
        }
    },

    validate: function (question) {
        const validateBtn = document.getElementById('qcm-validate-btn');
        if (validateBtn) validateBtn.remove();

        // Gather selection
        const allBtns = document.querySelectorAll('.qcm-option');
        const selectedOptions = [];
        allBtns.forEach(btn => {
            const opt = btn._optionData;
            if (this.state.currentQcmSelection.has(opt)) {
                selectedOptions.push(opt);
            }
        });

        if (this.state.qcmConfig.mode === 'EXAM') {
            // Calculate scores based on points
            let maxScore = 0;
            let userScore = 0;

            question.choices.forEach(c => {
                const pts = parseInt(c.pts || 0);
                if (pts > 0) maxScore += pts;
                if (selectedOptions.includes(c)) userScore += pts;
            });

            // Is correct if user gathered all positive points (neutral 0-point items don't affect score)
            // Assuming no negative points exist that subtract from positive choices user didn't make
            // Logic: Success if UserScore == MaxScore
            const isCorrect = (userScore === maxScore);

            const resultData = {
                question: question,
                selected: selectedOptions,
                correct: question.choices.filter(c => parseInt(c.pts || 0) > 0),
                isCorrect: isCorrect
            };

            if (this.state.examResults[this.state.qcmIndex]) {
                this.state.examResults[this.state.qcmIndex] = resultData;
            } else {
                this.state.examResults.push(resultData);
            }

            this.updateStats(question, isCorrect);
            this.state.qcmIndex++;
            this.renderQuestion();
        } else {
            // Training Mode
            let maxScore = 0;
            let userScore = 0;
            let hasNegativeEffect = false;

            // Calculate score for validation
            question.choices.forEach(c => {
                const pts = parseInt(c.pts || 0);
                if (pts > 0) maxScore += pts;
                if (this.state.currentQcmSelection.has(c)) {
                    userScore += pts;
                    if (pts < 0) hasNegativeEffect = true;
                }
            });

            const isSuccess = (userScore === maxScore) && !hasNegativeEffect;

            allBtns.forEach(btn => {
                btn.disabled = true;
                btn.classList.remove('selected');
                const opt = btn._optionData;
                const isSelected = this.state.currentQcmSelection.has(opt);
                const pts = parseInt(opt.pts || 0);

                if (pts > 0) {
                    // Correct answer
                    btn.classList.add('correct');
                    btn.innerHTML += isSelected ? ' <i class="ri-check-double-line"></i>' : ' <i class="ri-checkbox-circle-line"></i>';
                } else if (pts < 0) {
                    // Incorrect answer (negative points)
                    if (isSelected) {
                        btn.classList.add('incorrect');
                        btn.innerHTML += ' <i class="ri-close-circle-line"></i>';
                    }
                } else {
                    // Neutral answer (0 points)
                    // If selected, show neutral style or just checkmark without color?
                    // User request: "juste ne comptent pas". Usually shown as neutral.
                    if (isSelected) {
                        btn.style.border = "1px solid var(--text-secondary)";
                        btn.innerHTML += ' <i class="ri-checkbox-blank-circle-line" style="opacity:0.5;"></i>';
                    }
                }
            });

            this.updateStats(question, isSuccess);

            const feedbackDiv = document.getElementById('qcm-feedback');
            if (feedbackDiv) {
                feedbackDiv.style.display = 'block';
                const feedbackClass = isSuccess ? 'feedback-success' : 'feedback-fail';
                const icon = isSuccess ? 'ri-thumb-up-line' : 'ri-thumb-down-line';
                feedbackDiv.innerHTML = `
                    <div class="instructor-feedback ${feedbackClass}" style="margin-top:0;">
                        <div class="feedback-header"><i class="${icon}"></i> ${isSuccess ? 'BRAVO !' : 'OUPS...'}</div>
                        ${(this.state.qcmConfig.mode === 'REVISION' && isSuccess) ? '<div style="font-size:0.8em; opacity:0.7; margin-bottom:8px;">Série en cours: ' + ((this.getPersistentStats().questions[question.code]?.streak) || 1) + '/5</div>' : ''}
                        <div style="opacity:0.9;">${question.explanation}</div>
                    </div>
                `;
            }

            const choicesDiv = document.getElementById('qcm-choices');
            const nextBtn = document.createElement('button');
            nextBtn.className = 'next-btn';
            nextBtn.innerHTML = "QUESTION SUIVANTE <i class='ri-arrow-right-line'></i>";
            nextBtn.style.marginTop = "20px";
            nextBtn.style.width = "100%";
            nextBtn.onclick = () => {
                this.state.qcmIndex++;
                this.renderQuestion();
            };
            choicesDiv.appendChild(nextBtn);
        }
    },

    finishTraining: function () {
        document.getElementById('qcm-question-text').innerText = "Session Terminée !";
        document.getElementById('qcm-choices').innerHTML = `
            <div style="text-align:center; margin-bottom:20px;">
                Vous avez complété ${this.state.qcmSessionData.length} questions.
            </div>
            <button class="choice-btn" onclick="Engine.showDashboard()">Retour au Menu</button>
        `;
        document.getElementById('qcm-feedback').style.display = 'none';
    },

    showExamResults: function () {
        const results = this.state.examResults;
        const total = results.length;
        const score = results.filter(r => r.isCorrect).length;
        const container = document.getElementById('qcm-question-text');
        const choicesArea = document.getElementById('qcm-choices');
        const feedbackDiv = document.getElementById('qcm-feedback');

        feedbackDiv.style.display = 'none';

        // Save exam to history (only for EXAM mode)
        if (this.state.qcmConfig.mode === 'EXAM') {
            this.saveExamHistory(Engine.state.level, score, total, results);
        }

        let color = score >= total * 0.75 ? '#4ade80' : '#f87171'; // keeping inline for dynamic color logic simplicity or could map to class
        container.innerHTML = `
            <div class="stats-circle-container">
                <h2 class="section-title" style="margin-bottom:16px;">RÉSULTATS</h2>
                <div class="stats-circle" style="border-color:${color}; color:${color}; box-shadow:0 0 20px -5px ${color};">
                    ${score}/${total}
                </div>
                <p style="color:var(--text-secondary);">
                    ${score >= total * 0.75 ? 'Excellent travail !' : 'Continuez à vous entraîner !'}
                </p>
            </div>
        `;


        let html = '<div class="results-list" style="display:flex; flex-direction:column; gap:32px;">';
        results.forEach((r, idx) => {
            const q = r.question;
            let optionsHtml = '';
            q.choices.forEach(opt => {
                let statusClass = '';
                let icon = '';
                const wasSelected = r.selected.includes(opt);
                const isCorrect = opt.correct; // Keep using this for positive green highlight if needed, or check pts > 0
                const pts = parseInt(opt.pts || 0);

                if (pts > 0) {
                    statusClass = 'correct';
                    icon = '<i class="ri-checkbox-circle-line"></i>';
                    if (wasSelected) icon = '<i class="ri-check-double-line"></i>';
                } else if (pts < 0) {
                    if (wasSelected) {
                        statusClass = 'incorrect';
                        icon = '<i class="ri-close-circle-line"></i>';
                    }
                } else {
                    // Neutral (0 pts)
                    if (wasSelected) {
                        statusClass = ''; // No red background
                        icon = '<i class="ri-checkbox-blank-circle-line" style="opacity:0.5;"></i>';
                        // Add a border to show it was selected
                        statusClass = 'neutral-selected'; // We'll need to define this or just inline style
                    }
                }

                // Add inline style for neutral selected since class doesn't exist yet
                const style = (pts === 0 && wasSelected) ? 'border:1px solid var(--text-secondary); opacity:0.8;' : '';
                optionsHtml += `
                    <div class="qcm-option ${statusClass}" style="padding:12px; font-size:0.9rem; pointer-events:none; opacity:1; ${style}">
                        ${opt.text} ${icon}
                    </div>
                `;
            });
            html += `
                <div class="g-quiz-item">
                    <div style="font-size:0.8rem; text-transform:uppercase; color:var(--text-secondary); margin-bottom:8px;">Question ${idx + 1}</div>
                    <div style="font-weight:600; margin-bottom:12px; font-size:1.05rem;">${q.question}</div>
                    <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:16px;">
                        ${optionsHtml}
                    </div>
                    ${!r.isCorrect ? `<div style="padding:12px; background:rgba(255,255,255,0.03); border-left:3px solid #f472b6; font-size:0.9rem; color:#e2e8f0;">${q.explanation || 'Pas d\'explication disponible.'}</div>` : ''}
                </div>
            `;
        });
        html += '</div>';
        html += `<button class="next-btn" style="margin-top:40px; width:100%;" onclick="Engine.showDashboard()">RETOUR AU MENU</button>`;
        choicesArea.innerHTML = html;
    },

    // ... showBank, renderBank ... (omitted from this edit for brevity if not heavily styled inline)

    // ... stats methods ...

    renderStats: function () {
        const stats = this.getPersistentStats();
        const container = document.getElementById('stats-content');
        if (!container) return;

        // Filter by current level
        let currentLevel = 'BI';
        if (typeof Engine !== 'undefined' && Engine.state && Engine.state.level) {
            currentLevel = Engine.state.level;
            // Normalize level text in case it's verbose
            if (currentLevel.includes("INITIAL")) currentLevel = "BI";
            else if (currentLevel.includes("PILOTE") && !currentLevel.includes("CONFIRM")) currentLevel = "BP";
            else if (currentLevel.includes("CONFIRM") || currentLevel.includes("BPC")) currentLevel = "BPC";
        }
        console.log("Rendering stats for normalized level:", currentLevel);

        let levelQuestionCodes = new Set();
        let totalLevelQuestions = 0;

        let levelQs = [];
        console.log("DEBUG RENDER STATS: User Level =", Engine.state.level, "Normalized =", currentLevel);





        // Mapping levels to QCM_OFFICIAL 'niveau' property
        // 0: Vert (Intro)? 1: Bleu (BI)? 2: Marron (BP)? 3: Rouge/Confirme (BPC)?

        if (currentLevel === 'BI') {
            // BI usually includes level 0 and 1
            levelQs = QCM_OFFICIAL.questions.filter(q => q.niveau === 0 || q.niveau === 1);
        } else if (currentLevel === 'BP') {
            // BP is level 2
            levelQs = QCM_OFFICIAL.questions.filter(q => q.niveau === 2);
        } else if (currentLevel === 'BPC') {
            // BPC is level 3
            levelQs = QCM_OFFICIAL.questions.filter(q => q.niveau === 3);
        } else {
            // Fallback: try to match by old class logic or defaulting
            levelQs = QCM_OFFICIAL.questions.filter(q => q.class && q.class.includes(currentLevel));
        }

        if (levelQs.length > 0) {
            totalLevelQuestions = levelQs.length;
            levelQs.forEach(q => levelQuestionCodes.add(q.code));
            console.log(`Found ${totalLevelQuestions} questions for level ${currentLevel} in QCM_OFFICIAL`);
        }
    }

        // Check globals if no questions found yet
        if(totalLevelQuestions === 0) {
        // Fallback to QCM_BI / QCM_BP / QCM_BPC globals
        let targetArray = null;
if (currentLevel === 'BI' && typeof QCM_BI !== 'undefined') targetArray = QCM_BI;
else if (currentLevel === 'BP' && typeof QCM_BP !== 'undefined') targetArray = QCM_BP;
else if (currentLevel === 'BPC' && typeof QCM_BPC !== 'undefined') targetArray = QCM_BPC;

if (targetArray) {
    totalLevelQuestions = targetArray.length;
    // Use ID instead of Code if available
    targetArray.forEach(q => levelQuestionCodes.add(q.id || q.code));
    console.log(`Found ${totalLevelQuestions} questions for level ${currentLevel} in global array`);
} else {
    console.warn("No question data found during stats render");
}
        }

// Calculate question distribution for CURRENT LEVEL
const allQuestionEntries = Object.entries(stats.questions);

// Debug filtering
let levelQuestionEntries = allQuestionEntries.filter(([code, data]) => levelQuestionCodes.has(code));

// FALLBACK: If filtering returns 0 results but we have stats, it might be due to code mismatches.
// In that case, we display everything to ensure the user sees their data.


let perfect = 0;      // 100%
let excellent = 0;    // 75-99%
let good = 0;         // 50-74%
let poor = 0;         // 1-49%
let failed = 0;       // 0%
// notAttempted is relative to the level total
let notAttempted = totalLevelQuestions - levelQuestionEntries.length;

// Ensure non-negative (incase of data sync issues)
if (notAttempted < 0) notAttempted = 0;

levelQuestionEntries.forEach(([code, data]) => {
    if (data.total === 0) return;
    const pct = Math.round((data.correct / data.total) * 100);

    if (pct === 100) perfect++;
    else if (pct >= 75) excellent++;
    else if (pct >= 50) good++;
    else if (pct > 0) poor++;
    else failed++;
});

// Recalculate global percentage for this level only
let levelTotalQuestions = 0;
let levelTotalCorrect = 0;
levelQuestionEntries.forEach(([code, data]) => {
    levelTotalQuestions += data.total;
    levelTotalCorrect += data.correct;
});

const globalPct = levelTotalQuestions > 0 ? Math.round((levelTotalCorrect / levelTotalQuestions) * 100) : 0;
const color = globalPct >= 75 ? '#4ade80' : (globalPct >= 50 ? '#facc15' : '#f87171');


const distributionHtml = `
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:12px;">
                <div style="background:rgba(74, 222, 128, 0.1); border:1px solid #4ade80; padding:12px; border-radius:8px; text-align:center;">
                    <div style="font-size:1.8rem; font-weight:700; color:#4ade80;">${perfect}</div>
                    <div style="font-size:0.75rem; opacity:0.8; margin-top:4px;">100% maîtrisées</div>
                </div>
                <div style="background:rgba(74, 222, 128, 0.05); border:1px solid #86efac; padding:12px; border-radius:8px; text-align:center;">
                    <div style="font-size:1.8rem; font-weight:700; color:#86efac;">${excellent}</div>
                    <div style="font-size:0.75rem; opacity:0.8; margin-top:4px;">75-99%</div>
                </div>
                <div style="background:rgba(250, 204, 21, 0.1); border:1px solid #facc15; padding:12px; border-radius:8px; text-align:center;">
                    <div style="font-size:1.8rem; font-weight:700; color:#facc15;">${good}</div>
                    <div style="font-size:0.75rem; opacity:0.8; margin-top:4px;">50-74%</div>
                </div>
                <div style="background:rgba(251, 146, 60, 0.1); border:1px solid #fb923c; padding:12px; border-radius:8px; text-align:center;">
                    <div style="font-size:1.8rem; font-weight:700; color:#fb923c;">${poor}</div>
                    <div style="font-size:0.75rem; opacity:0.8; margin-top:4px;">1-49%</div>
                </div>
                <div style="background:rgba(248, 113, 113, 0.1); border:1px solid #f87171; padding:12px; border-radius:8px; text-align:center;">
                    <div style="font-size:1.8rem; font-weight:700; color:#f87171;">${failed}</div>
                    <div style="font-size:0.75rem; opacity:0.8; margin-top:4px;">0% (échec)</div>
                </div>
                <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border-color); padding:12px; border-radius:8px; text-align:center;">
                    <div style="font-size:1.8rem; font-weight:700; color:var(--text-muted);">${notAttempted}</div>
                    <div style="font-size:0.75rem; opacity:0.8; margin-top:4px;">Non tentées <span style="opacity:0.6; font-size:0.7rem;">(sur ${totalLevelQuestions})</span></div>
                </div>
            </div>
        `;

let themesHtml = '';
Object.entries(stats.themes).sort((a, b) => b[1].total - a[1].total).forEach(([name, data]) => {
    const pct = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
    const tColor = pct >= 75 ? '#4ade80' : (pct >= 50 ? '#facc15' : '#f87171');
    themesHtml += `
                <div class="stats-row">
                    <div>
                        <div style="font-weight:600;">${name}</div>
                        <div style="font-size:0.8rem; opacity:0.6;">${data.correct}/${data.total} corrects</div>
                    </div>
                    <div style="font-weight:bold; color:${tColor}; font-size:1.1rem;">${pct}%</div>
                </div>
            `;
});

const problemQuestions = Object.entries(stats.questions)
    .filter(([code, data]) => data.total > 1 && (data.correct / data.total) < 0.5)
    .sort((a, b) => (a[1].correct / a[1].total) - (b[1].correct / b[1].total))
    .slice(0, 5);

let problemsHtml = '';
if (problemQuestions.length > 0) {
    problemsHtml = '<div style="display:flex; flex-direction:column; gap:8px;">';
    problemQuestions.forEach(([code, data]) => {
        let qText = "Question " + code;
        if (typeof QCM_OFFICIAL !== 'undefined' && QCM_OFFICIAL.questions) {
            const qObj = QCM_OFFICIAL.questions.find(q => q.code === code);
            if (qObj) qText = qObj.question;
            if (qText.length > 60) qText = qText.substring(0, 60) + "...";
        }
        const pct = Math.round((data.correct / data.total) * 100);
        problemsHtml += `
                    <div class="problem-item">
                        <div style="font-size:0.8rem; font-weight:bold; color:#f87171;">${code} (${pct}% réussite)</div>
                        <div style="font-size:0.9rem; opacity:0.9;">${qText}</div>
                    </div>
                 `;
    });
    problemsHtml += '</div>';
} else {
    problemsHtml = '<div style="opacity:0.6; font-style:italic;">Pas encore de questions problématiques identifiées.</div>';
}

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

    allQuestionsHtml = `
                <div style="margin-bottom:16px; display:flex; justify-content:space-between; align-items:center;">
                    <div style="font-size:0.9rem; opacity:0.7;">${levelQuestionEntries.length} questions tentées</div>
                    <div style="display:flex; gap:8px;">
                        <button onclick="QuizEngine.sortQuestions('rate')" id="sort-rate-btn" class="sort-btn" style="padding:6px 12px; border-radius:6px; border:1px solid var(--border-color); background:rgba(255,255,255,0.05); cursor:pointer; font-size:0.8rem;">
                            Par taux
                        </button>
                        <button onclick="QuizEngine.sortQuestions('attempts')" id="sort-attempts-btn" class="sort-btn" style="padding:6px 12px; border-radius:6px; border:1px solid var(--border-color); background:transparent; cursor:pointer; font-size:0.8rem;">
                            Par tentatives
                        </button>
                    </div>
                </div>
                <div id="all-questions-list" style="display:flex; flex-direction:column; gap:8px; max-height:500px; overflow-y:auto; padding-right:8px;">
            `;

    sortedQuestions.forEach(([code, data]) => {
        let qText = "Question " + code;
        let theme = "Autre";
        let qObj = null;

        if (typeof QCM_OFFICIAL !== 'undefined' && QCM_OFFICIAL.questions) {
            qObj = QCM_OFFICIAL.questions.find(q => q.code === code || q.id === code);
        }

        // Fallback search in global arrays
        if (!qObj) {
            if (typeof QCM_BI !== 'undefined') qObj = QCM_BI.find(q => q.id === code || q.code === code);
            if (!qObj && typeof QCM_BP !== 'undefined') qObj = QCM_BP.find(q => q.id === code || q.code === code);
            if (!qObj && typeof QCM_BPC !== 'undefined') qObj = QCM_BPC.find(q => q.id === code || q.code === code);
        }

        if (qObj) {
            qText = qObj.question;
            theme = qObj.theme || 'Autre';
        }

        const pct = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
        const qColor = pct >= 75 ? '#4ade80' : (pct >= 50 ? '#facc15' : '#f87171');
        const streak = data.streak || 0;

        // Build answers HTML if available
        let answersHtml = '';
        if (qObj && qObj.ans) {
            answersHtml = '<div class="question-answers" style="display:none; margin-top:12px; padding-top:12px; border-top:1px solid var(--border-color);">';
            qObj.ans.forEach((ans, idx) => {
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
            answersHtml += '</div>';
        }

        const displayText = qText.length > 80 ? qText.substring(0, 80) + "..." : qText;
        const hasAnswers = qObj && qObj.ans;

        allQuestionsHtml += `
                    <div class="question-stat-item" data-code="${code}" data-pct="${pct}" data-total="${data.total}" style="background:var(--bg-card); padding:12px 16px; border-radius:8px; border:1px solid var(--border-color); cursor:${hasAnswers ? 'pointer' : 'default'};" ${hasAnswers ? `onclick="QuizEngine.toggleQuestionDetails('${code}')"` : ''}>
                        <div style="display:flex; justify-content:space-between; align-items:start; gap:12px;">
                            <div style="flex:1;">
                                <div style="display:flex; gap:8px; align-items:center; margin-bottom:6px;">
                                    <span style="font-family:monospace; font-size:0.75rem; opacity:0.5;">#${code}</span>
                                    <span style="background:rgba(255,255,255,0.05); padding:2px 6px; border-radius:4px; font-size:0.7rem;">${theme}</span>
                                    ${streak >= 3 ? `<span style="background:#4ade80; color:#000; padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:700;">🔥 ${streak}</span>` : ''}
                                    ${hasAnswers ? '<i class="ri-arrow-down-s-line" style="opacity:0.5; transition:transform 0.2s;" id="arrow-' + code + '"></i>' : ''}
                                </div>
                                <div style="font-size:0.9rem; line-height:1.4;">${displayText}</div>
                                <div style="font-size:0.75rem; opacity:0.6; margin-top:4px;">${data.correct}/${data.total} corrects • ${data.total} tentative${data.total > 1 ? 's' : ''}</div>
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

container.innerHTML = `
            <div class="stats-circle-container">
                <div class="stats-circle" style="border-color:${color}; color:${color}; box-shadow:0 0 20px -5px ${color};">
                    ${globalPct}%
                </div>
                <div style="font-size:0.9rem; opacity:0.7;">Taux de réussite (${currentLevel})</div>
                <div style="font-size:0.8rem; opacity:0.5;">(Activité totale: ${stats.totalQuestions} réponses)</div>
            </div>

            <div style="margin-top:32px;">
                <h3 class="library-section-header">Répartition des questions</h3>
                ${distributionHtml}
            </div>

            <div class="stats-grid-2">
                <div>
                    <h3 class="library-section-header">Statistiques par Thème</h3>
                    <div style="display:flex; flex-direction:column; gap:8px;">
                        ${themesHtml || '<div style="opacity:0.5;">Aucune donnée.</div>'}
                    </div>
                </div>
                <div>
                    <h3 class="library-section-header">Questions à revoir</h3>
                    ${problemsHtml}
                </div>
            </div>

            <div style="margin-top:40px;">
                <h3 class="library-section-header">Historique des examens</h3>
                ${this.renderExamHistory()}
            </div>

            <div style="margin-top:40px;">
                <h3 class="library-section-header">Toutes les questions</h3>
                ${allQuestionsHtml}
            </div>

            <div style="text-align:center; margin-top:32px; display:flex; gap:12px; justify-content:center; flex-wrap:wrap;">
                <button onclick="QuizEngine.exportData()" style="background:rgba(74, 222, 128, 0.1); color:#4ade80; border:1px solid #4ade80; padding:10px 20px; border-radius:8px; cursor:pointer;">
                    <i class="ri-download-line"></i> Exporter les données
                </button>
                <button onclick="QuizEngine.importData()" style="background:rgba(59, 130, 246, 0.1); color:#3b82f6; border:1px solid #3b82f6; padding:10px 20px; border-radius:8px; cursor:pointer;">
                    <i class="ri-upload-line"></i> Importer les données
                </button>
                <button onclick="QuizEngine.resetStats()" style="background:rgba(248, 113, 113, 0.1); color:#f87171; border:1px solid #f87171; padding:10px 20px; border-radius:8px; cursor:pointer;">
                    <i class="ri-delete-bin-line"></i> Réinitialiser
                </button>
            </div>
        `;
    },

renderExamHistory: function () {
    const exams = this.getExamHistory();

    if (exams.length === 0) {
        return '<div style="opacity:0.6; font-style:italic; text-align:center; padding:40px;">Aucun examen complété pour le moment.</div>';
    }

    let html = '<div style="display:flex; flex-direction:column; gap:12px;">';

    exams.forEach(exam => {
        const date = new Date(exam.date);
        const dateStr = date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        const color = exam.percentage >= 75 ? '#4ade80' : exam.percentage >= 50 ? '#facc15' : '#f87171';
        const levelLabel = exam.level === 'BI' ? 'Brevet Initial' : exam.level === 'BP' ? 'Brevet de Pilote' : 'Brevet de Pilote Confirmé';

        // Build questions HTML
        let questionsHtml = '<div class="exam-details" style="display:none; margin-top:16px; padding-top:16px; border-top:1px solid var(--border-color);">';
        questionsHtml += '<div style="display:flex; flex-direction:column; gap:16px;">';

        exam.results.forEach((r, idx) => {
            const q = r.question;
            let optionsHtml = '';

            q.choices.forEach(opt => {
                // Fix object reference comparison for loaded JSON data
                const wasSelected = r.selected.some(s => s.text === opt.text);
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
                        <div style="padding:8px 12px; border-radius:6px; ${statusClass} display:flex; align-items:center; gap:8px; font-size:0.85rem;">
                            ${icon}
                            <span style="flex:1;">${opt.text}</span>
                        </div>
                    `;
            });

            questionsHtml += `
                    <div style="background:rgba(255,255,255,0.02); padding:12px; border-radius:8px; ${!r.isCorrect ? 'border:1px solid #f87171;' : ''}">
                        <div style="font-size:0.75rem; opacity:0.6; margin-bottom:6px;">Question ${idx + 1}</div>
                        <div style="font-weight:600; margin-bottom:12px;">${q.question}</div>
                        <div style="display:flex; flex-direction:column; gap:6px;">
                            ${optionsHtml}
                        </div>
                        ${!r.isCorrect && q.explanation ? `<div style="margin-top:12px; padding:8px; background:rgba(251, 146, 60, 0.1); border-left:3px solid #fb923c; font-size:0.85rem; opacity:0.9;">${q.explanation}</div>` : ''}
                    </div>
                `;
        });

        questionsHtml += '</div></div>';

        html += `
                <div data-exam-id="${exam.id}" style="background:var(--bg-card); padding:16px; border-radius:12px; border:1px solid var(--border-color); cursor:pointer;" onclick="QuizEngine.toggleExamDetails(${exam.id})">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div style="flex:1;">
                            <div style="display:flex; gap:8px; align-items:center; margin-bottom:6px;">
                                <span style="font-size:0.75rem; opacity:0.6;">${dateStr}</span>
                                <span style="background:rgba(255,255,255,0.05); padding:2px 8px; border-radius:4px; font-size:0.7rem;">${levelLabel}</span>
                                <i class="ri-arrow-down-s-line exam-arrow" style="opacity:0.5; transition:transform 0.2s;"></i>
                            </div>
                            <div style="font-size:0.9rem;">
                                <span style="color:${color}; font-weight:700; font-size:1.1rem;">${exam.score}/${exam.total}</span>
                                <span style="opacity:0.7; margin-left:8px;">(${exam.percentage}%)</span>
                            </div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:1.5rem; font-weight:700; color:${color};">${exam.percentage}%</div>
                        </div>
                    </div>
                    ${questionsHtml}
                </div>
            `;
    });

    html += '</div>';
    return html;
},

sortQuestions: function (sortBy) {
    const list = document.getElementById('all-questions-list');
    if (!list) return;

    const items = Array.from(list.querySelectorAll('.question-stat-item'));

    // Update button states
    document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.style.background = 'transparent';
    });

    if (sortBy === 'rate') {
        document.getElementById('sort-rate-btn').style.background = 'rgba(255,255,255,0.05)';
        items.sort((a, b) => {
            const pctA = parseInt(a.dataset.pct);
            const pctB = parseInt(b.dataset.pct);
            return pctA - pctB;
        });
    } else if (sortBy === 'attempts') {
        document.getElementById('sort-attempts-btn').style.background = 'rgba(255,255,255,0.05)';
        items.sort((a, b) => {
            const totalA = parseInt(a.dataset.total);
            const totalB = parseInt(b.dataset.total);
            return totalB - totalA;
        });
    }

    list.innerHTML = '';
    items.forEach(item => list.appendChild(item));
},

toggleQuestionDetails: function (code) {
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
},



// --- STATISTICS MANAGEMENT ---
getPersistentStats: function () {
    const defaultStats = {
        totalQuestions: 0,
        totalCorrect: 0,
        themes: {},
        questions: {}
    };

    try {
        const saved = localStorage.getItem('parapente_qcm_stats');
        if (!saved) return defaultStats;
        return JSON.parse(saved);
    } catch (e) {
        console.error("Failed to load stats", e);
        return defaultStats;
    }
},

updateStats: function (question, isCorrect) {
    const stats = this.getPersistentStats();

    // Update global counters
    stats.totalQuestions++;
    if (isCorrect) stats.totalCorrect++;

    // Update theme stats
    const theme = question.theme || 'Autre';
    if (!stats.themes[theme]) {
        stats.themes[theme] = { total: 0, correct: 0 };
    }
    stats.themes[theme].total++;
    if (isCorrect) stats.themes[theme].correct++;

    // Update question-specific stats
    // Prefer ID over code for stability, falling back to generated ID
    const code = question.id || question.code || `q_${Date.now()}`;
    if (!stats.questions[code]) {
        stats.questions[code] = { total: 0, correct: 0, streak: 0 };
    }
    stats.questions[code].total++;
    if (isCorrect) {
        stats.questions[code].correct++;
        stats.questions[code].streak = (stats.questions[code].streak || 0) + 1;

        // REDEMPTION: After 10 consecutive correct answers, reset to 100%
        if (stats.questions[code].streak >= 10) {
            stats.questions[code].total = stats.questions[code].streak;
            stats.questions[code].correct = stats.questions[code].streak;
            // Keep the streak to show mastery
        }
    } else {
        stats.questions[code].streak = 0;
    }

    localStorage.setItem('parapente_qcm_stats', JSON.stringify(stats));
},

resetStats: function () {
    if (confirm('Êtes-vous sûr de vouloir réinitialiser toutes vos statistiques ?')) {
        localStorage.removeItem('parapente_qcm_stats');
        alert('Statistiques réinitialisées !');
        this.renderStats();
    }
},

saveExamHistory: function (level, score, total, results) {
    try {
        let history = JSON.parse(localStorage.getItem('parapente_exam_history') || '{"exams":[]}');

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

        localStorage.setItem('parapente_exam_history', JSON.stringify(history));
    } catch (e) {
        console.error("Failed to save exam history", e);
    }
},

getExamHistory: function () {
    try {
        const history = JSON.parse(localStorage.getItem('parapente_exam_history') || '{"exams":[]}');
        return history.exams || [];
    } catch (e) {
        console.error("Failed to load exam history", e);
        return [];
    }
},

importData: function () {
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
                    localStorage.setItem('parapente_qcm_stats', JSON.stringify(data.stats));
                    localStorage.setItem('parapente_exam_history', JSON.stringify({ exams: data.examHistory }));

                    // Force update of current runtime stats if needed? 
                    // Actually getPersistentStats reads from localStorage so it's fine.

                    alert('✅ Données importées avec succès !');

                    try {
                        // Refresh stats display
                        this.renderStats();
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
},
toggleExamDetails: function (examId) {
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
},

exportData: function () {
    try {
        const stats = this.getPersistentStats();
        const examHistory = this.getExamHistory();

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
        a.download = `parapente_stats_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        alert('✅ Données exportées avec succès !');
    } catch (e) {
        console.error('Export failed', e);
        alert('❌ Erreur lors de l\'export');
    }
},

importData: function () {
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
                    localStorage.setItem('parapente_qcm_stats', JSON.stringify(data.stats));
                    localStorage.setItem('parapente_exam_history', JSON.stringify({ exams: data.examHistory }));

                    alert('✅ Données importées avec succès !');
                    this.renderStats();
                }
            } catch (e) {
                console.error('Import failed', e);
                alert('❌ Erreur lors de l\'import : fichier corrompu');
            }
        };
        reader.readAsText(file);
    };

    input.click();
},

showStats: function () {
    document.querySelectorAll('.mode-screen').forEach(s => s.classList.remove('active'));
    document.getElementById('stats-screen').classList.add('active');
    this.renderStats();
},

// --- QUESTION BANK ---
showBank: function () {
    this.state.mainEngine.startMode('QCM_BANK');
},

renderBank: function () {
    const searchInput = document.getElementById('bank-search');
    const levelFilter = document.getElementById('bank-level-filter');
    const resultsDiv = document.getElementById('bank-results');

    if (!resultsDiv) return;

    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    const levelValue = levelFilter ? levelFilter.value : 'ALL';

    let questions = [];
    if (typeof QCM_OFFICIAL !== 'undefined' && QCM_OFFICIAL.questions) {
        const getCategory = (code) => {
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
            return map[letter] || 'Autre';
        };

        questions = QCM_OFFICIAL.questions.map(q => ({
            code: q.code,
            question: q.question,
            theme: getCategory(q.code),
            level: (function (c) {
                const lastChar = c.charAt(c.length - 1).toUpperCase();
                if (lastChar === 'V') return 1;
                if (lastChar === 'B') return 2;
                if (lastChar === 'M') return 3;
                return 0;
            })(q.code),
            choices: q.ans
        }));
    }

    // Apply filters
    if (levelValue !== 'ALL') {
        questions = questions.filter(q => q.level === parseInt(levelValue));
    }

    if (searchTerm) {
        questions = questions.filter(q =>
            q.question.toLowerCase().includes(searchTerm) ||
            q.code.toLowerCase().includes(searchTerm)
        );
    }

    // Render
    if (questions.length === 0) {
        resultsDiv.innerHTML = '<div style="text-align:center; opacity:0.5; padding:40px;">Aucune question trouvée</div>';
        return;
    }

    let html = '';
    questions.forEach(q => {
        const levelLabel = q.level === 1 ? 'BI' : q.level === 2 ? 'BP' : q.level === 3 ? 'BPC' : 'N/A';
        const levelColor = q.level === 1 ? '#48BB78' : q.level === 2 ? '#4299E1' : '#92400e';

        html += `
                <div class="bank-question-card" style="background:var(--bg-card); padding:20px; border-radius:12px; border:1px solid var(--border-color);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                        <div style="display:flex; gap:8px; align-items:center;">
                            <span style="background:${levelColor}; color:white; padding:4px 8px; border-radius:6px; font-size:0.7rem; font-weight:700;">${levelLabel}</span>
                            <span style="background:rgba(255,255,255,0.05); padding:4px 8px; border-radius:6px; font-size:0.7rem;">${q.theme}</span>
                        </div>
                        <span style="font-family:monospace; font-size:0.75rem; opacity:0.5;">#${q.code}</span>
                    </div>
                    <div style="font-weight:600; margin-bottom:12px;">${q.question}</div>
                    <div style="display:flex; flex-direction:column; gap:6px; font-size:0.9rem; opacity:0.8;">
                        ${q.choices.map((a, i) => `
                            <div style="padding:8px; background:rgba(255,255,255,0.02); border-radius:6px; ${parseInt(a.pts) > 0 ? 'border-left:3px solid #48BB78;' : ''}">
                                ${a.text}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
    });

    resultsDiv.innerHTML = html;
}

};

window.QuizEngine = QuizEngine;
