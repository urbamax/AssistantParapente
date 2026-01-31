/**
 * QUIZ ENGINE - Handling QCM & Statistics
 * Version 4.5 - Premium UI & Corrected Filtering
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
        console.log("QuizEngine v4.5 Initialized");
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
            const map = {
                'A': 'Météo',
                'E': 'Mécavol', 'G': 'Mécavol', 'H': 'Mécavol',
                'L': 'Matériel', 'N': 'Matériel', 'R': 'Matériel',
                'U': 'Pilotage', 'W': 'Pilotage', 'X': 'Pilotage',
                'S': 'Réglementation',
                'F': 'Facteurs humains',
                'P': 'Milieu naturel'
            };

            if (typeof QCM_OFFICIAL !== 'undefined' && QCM_OFFICIAL.questions) {
                QCM_OFFICIAL.questions.forEach(q => {
                    const code = q.code.charAt(0);
                    themes.add(map[code] || 'Autre');
                });
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
        const level = this.state.mainEngine ? this.state.mainEngine.state.level : 'BI';
        const getCategory = (code) => {
            const letter = code.charAt(0);
            const map = {
                'A': 'Météo', 'E': 'Mécavol', 'G': 'Mécavol', 'H': 'Mécavol',
                'L': 'Matériel', 'N': 'Matériel', 'R': 'Matériel',
                'U': 'Pilotage', 'W': 'Pilotage', 'X': 'Pilotage',
                'S': 'Réglementation', 'F': 'Facteurs humains', 'P': 'Milieu naturel'
            };
            return map[letter] || 'Autre';
        };

        if (typeof QCM_OFFICIAL === 'undefined') {
            alert("Erreur: Base de données QCM non trouvée.");
            return;
        }

        let sourceData = QCM_OFFICIAL.questions.map(q => ({
            code: q.code,
            question: q.question,
            choices: q.ans.map(a => ({
                text: a.text,
                correct: parseInt(a.pts) > 0,
                pts: parseInt(a.pts)
            })),
            explanation: q.explication || " (Source: QCM FFVL Officiel)",
            theme: getCategory(q.code),
            parapente: q.parapente
        }));

        // Filter Parapente only
        sourceData = sourceData.filter(q => q.parapente === true);

        // Filter by Level suffix
        if (level === 'BI') {
            sourceData = sourceData.filter(q => q.code && q.code.includes('V'));
        } else if (level === 'BP') {
            sourceData = sourceData.filter(q => q.code && q.code.includes('B'));
        } else if (level === 'BPC') {
            sourceData = sourceData.filter(q => q.code && q.code.includes('M'));
        }

        const mode = this.state.qcmConfig.mode;
        const selectedTheme = document.getElementById('qcm-theme-select') ? document.getElementById('qcm-theme-select').value : 'ALL';
        if (selectedTheme !== 'ALL') sourceData = sourceData.filter(q => q.theme === selectedTheme);

        let count = this.state.qcmConfig.count;
        if (mode === 'EXAM') {
            if (level === 'BI') count = 30;
            else if (level === 'BP') count = 60;
            else if (level === 'BPC') count = 30;
        }

        if (sourceData.length === 0) {
            alert("Aucune question disponible pour ce filtre !");
            return;
        }

        if (mode === 'REVISION') {
            const stats = this.getPersistentStats();
            sourceData = sourceData.filter(q => stats.questions[q.code] && stats.questions[q.code].total > 0);
            if (sourceData.length === 0) {
                alert("Aucune question à réviser !");
                return;
            }
            sourceData.sort((a, b) => {
                const rA = stats.questions[a.code].correct / stats.questions[a.code].total;
                const rB = stats.questions[b.code].correct / stats.questions[b.code].total;
                return rA - rB;
            });
        }

        let questions = (mode === 'EXAM') ? this.shuffle(sourceData).slice(0, count) : sourceData.slice(0, count);

        this.state.qcmSessionData = questions;
        this.state.qcmIndex = 0;
        this.state.examResults = [];
        this.state.currentQcmSelection = new Set();

        document.getElementById('qcm-setup-screen').classList.remove('active');
        document.getElementById('qcm-screen').classList.add('active');
        this.renderQuestion();
    },

    renderQuestion: function () {
        const sessionData = this.state.qcmSessionData;
        if (this.state.qcmIndex >= sessionData.length) {
            if (this.state.qcmConfig.mode === 'EXAM') this.showExamResults();
            else this.finishTraining();
            return;
        }

        this.state.currentQcmSelection = new Set();
        const q = sessionData[this.state.qcmIndex];
        const feedbackDiv = document.getElementById('qcm-feedback');
        if (feedbackDiv) feedbackDiv.style.display = 'none';

        document.getElementById('qcm-question-text').innerHTML = `
            <div class="quiz-header-row">
                <div class="quiz-meta">
                    <div class="quiz-theme-tag">${q.theme}</div>
                    <div class="quiz-progress">Question ${this.state.qcmIndex + 1} / ${sessionData.length}</div>
                    <div style="font-size:0.8rem; opacity:0.4; font-family:monospace;">(#${q.code})</div>
                </div>
            </div>
            <div class="quiz-question-text">${q.question}</div>
        `;

        const choicesDiv = document.getElementById('qcm-choices');
        choicesDiv.innerHTML = '';
        this.shuffle(q.choices).forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'qcm-option';
            btn.innerText = opt.text;
            btn.onclick = () => {
                btn.classList.toggle('selected');
                if (this.state.currentQcmSelection.has(opt)) this.state.currentQcmSelection.delete(opt);
                else this.state.currentQcmSelection.add(opt);
            };
            choicesDiv.appendChild(btn);
        });

        const actions = document.createElement('div');
        actions.style.cssText = "display:flex; gap:10px; margin-top:20px;";

        if (this.state.qcmIndex > 0) {
            const back = document.createElement('button');
            back.className = 'next-btn';
            back.style.flex = "0 0 60px";
            back.innerHTML = '<i class="ri-arrow-left-line"></i>';
            back.onclick = () => { this.state.qcmIndex--; this.renderQuestion(); };
            actions.appendChild(back);
        }

        const valid = document.createElement('button');
        valid.className = 'next-btn';
        valid.style.flex = "1";
        valid.innerText = "VALIDER";
        valid.onclick = () => this.validate(q);
        actions.appendChild(valid);
        choicesDiv.appendChild(actions);
    },

    validate: function (question) {
        const selected = Array.from(this.state.currentQcmSelection);
        let maxScore = 0;
        let userScore = 0;
        question.choices.forEach(c => {
            if (c.pts > 0) maxScore += c.pts;
            if (this.state.currentQcmSelection.has(c)) userScore += c.pts;
        });

        const isCorrect = userScore === maxScore && userScore > 0;
        this.updateStats(question, isCorrect);

        if (this.state.qcmConfig.mode === 'EXAM') {
            this.state.examResults.push({ question, selected, isCorrect });
            this.state.qcmIndex++;
            this.renderQuestion();
        } else {
            // Feedback for Training
            document.querySelectorAll('.qcm-option').forEach(btn => {
                btn.disabled = true;
                const opt = Array.from(question.choices).find(c => c.text === btn.innerText);
                if (opt && opt.pts > 0) btn.classList.add('correct');
                else if (opt && opt.pts < 0 && this.state.currentQcmSelection.has(opt)) btn.classList.add('incorrect');
            });

            const feedback = document.getElementById('qcm-feedback');
            feedback.style.display = 'block';
            feedback.innerHTML = `
                <div class="instructor-feedback ${isCorrect ? 'feedback-success' : 'feedback-fail'}">
                    <div class="feedback-header"><i class="${isCorrect ? 'ri-thumb-up-fill' : 'ri-thumb-down-fill'}"></i> ${isCorrect ? 'EXCELLENT !' : 'OUPS...'}</div>
                    <div style="opacity:0.9;">${question.explanation || ''}</div>
                </div>
                <button class="next-btn" style="width:100%; margin-top:15px;" onclick="QuizEngine.state.qcmIndex++; QuizEngine.renderQuestion();">QUESTION SUIVANTE <i class="ri-arrow-right-line"></i></button>
            `;
            // Remove the previous actions
            document.querySelector('#qcm-choices > div').remove();
        }
    },

    finishTraining: function () {
        document.getElementById('qcm-question-text').innerHTML = "<h2>Session Terminée !</h2>";
        document.getElementById('qcm-choices').innerHTML = `<button class="choice-btn" style="width:100%" onclick="Engine.showDashboard()">RETOUR AU MENU</button>`;
    },

    showExamResults: function () {
        const results = this.state.examResults;
        const total = results.length;
        const score = results.filter(r => r.isCorrect).length;
        this.saveExamHistory(Engine.state.level, score, total, results);

        const pct = Math.round((score / total) * 100);
        const color = pct >= 75 ? '#4ade80' : '#f87171';

        document.getElementById('qcm-question-text').innerHTML = `
            <div style="text-align:center; padding:20px;">
                <div style="font-size:3rem; font-weight:900; color:${color};">${pct}%</div>
                <div style="font-size:1.2rem; opacity:0.7;">Score: ${score}/${total}</div>
            </div>
        `;
        document.getElementById('qcm-choices').innerHTML = `<button class="next-btn" style="width:100%" onclick="Engine.showDashboard()">RETOUR AU MENU</button>`;
    },

    // --- STATISTICS ---

    renderStats: function () {
        console.log("QuizEngine.renderStats v4.5");
        const stats = this.getPersistentStats();
        const container = document.getElementById('stats-content');
        if (!container) return;

        let level = Engine.state.level;
        if (level.includes("INITIAL")) level = "BI";
        else if (level.includes("PILOTE") && !level.includes("CONFIRM")) level = "BP";
        else if (level.includes("CONFIRM") || level.includes("BPC")) level = "BPC";

        let filteredCodes = new Set();
        let levelQs = QCM_OFFICIAL.questions.filter(q => q.parapente === true);
        if (level === 'BI') levelQs = levelQs.filter(q => q.code.includes('V'));
        else if (level === 'BP') levelQs = levelQs.filter(q => q.code.includes('B'));
        else if (level === 'BPC') levelQs = levelQs.filter(q => q.code.includes('M'));

        levelQs.forEach(q => filteredCodes.add(q.code));

        const userQs = Object.entries(stats.questions).filter(([code]) => filteredCodes.has(code));
        let totalC = 0, totalT = 0;
        let p = 0, e = 0, g = 0, w = 0, f = 0;

        userQs.forEach(([code, data]) => {
            totalC += data.correct;
            totalT += data.total;
            const pct = (data.correct / data.total) * 100;
            if (pct === 100) p++;
            else if (pct >= 75) e++;
            else if (pct >= 50) g++;
            else if (pct > 0) w++;
            else f++;
        });

        const globalPct = totalT > 0 ? Math.round((totalC / totalT) * 100) : 0;
        const color = globalPct >= 75 ? '#4ade80' : (globalPct >= 50 ? '#facc15' : '#f87171');
        const dash = 2 * Math.PI * 45;
        const offset = dash - (globalPct / 100) * dash;

        const gauge = `
            <div class="premium-gauge-container" style="display:flex; flex-direction:column; align-items:center; margin-bottom:40px; padding:30px; background:rgba(255,255,255,0.02); border-radius:32px; border:1px solid rgba(255,255,255,0.05); backdrop-filter:blur(10px);">
                <div style="position:relative; width:180px; height:180px;">
                    <svg width="180" height="180" viewBox="0 0 100 100" style="transform: rotate(-90deg);">
                        <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="8" />
                        <circle cx="50" cy="50" r="45" fill="none" stroke="${color}" stroke-width="8" stroke-dasharray="${dash}" stroke-dashoffset="${offset}" stroke-linecap="round" style="transition:all 1s; filter:drop-shadow(0 0 8px ${color});" />
                    </svg>
                    <div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); text-align:center;">
                        <div style="font-size:3rem; font-weight:900; color:${color}; line-height:1;">${globalPct}%</div>
                        <div style="font-size:0.6rem; opacity:0.5; font-weight:700; margin-top:5px; text-transform:uppercase;">RÉUSSITE</div>
                    </div>
                </div>
                <div style="margin-top:20px; font-weight:700; opacity:0.8;">NIVEAU: ${level === 'ALL' ? 'TOUS' : level}</div>
            </div>
        `;

        const cards = `
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:12px;">
                <div style="padding:15px; background:rgba(74,222,128,0.05); border-radius:16px; text-align:center; border:1px solid rgba(74,222,128,0.1);">
                    <div style="font-size:1.8rem; font-weight:900; color:#4ade80;">${p}</div>
                    <div style="font-size:0.7rem; opacity:0.6; font-weight:700;">MAÎTRISÉES</div>
                </div>
                <div style="padding:15px; background:rgba(250,204,21,0.05); border-radius:16px; text-align:center; border:1px solid rgba(250,204,21,0.1);">
                    <div style="font-size:1.8rem; font-weight:900; color:#facc15;">${g}</div>
                    <div style="font-size:0.7rem; opacity:0.6; font-weight:700;">MOYENNES</div>
                </div>
                <div style="padding:15px; background:rgba(248,113,113,0.05); border-radius:16px; text-align:center; border:1px solid rgba(248,113,113,0.1);">
                    <div style="font-size:1.8rem; font-weight:900; color:#f87171;">${f}</div>
                    <div style="font-size:0.7rem; opacity:0.6; font-weight:700;">ÉCHECS</div>
                </div>
                <div style="padding:15px; background:rgba(255,255,255,0.02); border-radius:16px; text-align:center; border:1px solid rgba(255,255,255,0.05);">
                    <div style="font-size:1.8rem; font-weight:900; opacity:0.5;">${Math.max(0, levelQs.length - userQs.length)}</div>
                    <div style="font-size:0.7rem; opacity:0.4; font-weight:700;">RESTANTES</div>
                </div>
            </div>
        `;

        let themesHtml = '';
        Object.entries(stats.themes).sort((a, b) => b[1].total - a[1].total).forEach(([name, data]) => {
            const pct = Math.round((data.correct / data.total) * 100);
            themesHtml += `
                <div style="display:flex; justify-content:space-between; padding:10px 15px; background:rgba(255,255,255,0.02); border-radius:10px; margin-bottom:5px; border:1px solid rgba(255,255,255,0.03);">
                    <div style="font-weight:600;">${name}</div>
                    <div style="color:${pct >= 75 ? '#4ade80' : (pct >= 50 ? '#facc15' : '#f87171')}; font-weight:800;">${pct}%</div>
                </div>
            `;
        });

        container.innerHTML = `
            ${gauge}
            <div style="margin-top:30px;">
                <h3 class="library-section-header" style="border:none;">RÉPARTITION</h3>
                ${cards}
            </div>
            <div style="margin-top:40px; display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:30px;">
                <div>
                    <h3 class="library-section-header" style="border:none;">PAR THÈME</h3>
                    ${themesHtml || '<div style="opacity:0.5;">Aucune donnée</div>'}
                </div>
                <div>
                    <h3 class="library-section-header" style="border:none;">HISTORIQUE</h3>
                    ${this.renderExamHistory()}
                </div>
            </div>
            <div style="margin-top:50px; text-align:center; display:flex; justify-content:center; gap:15px;">
                <button onclick="QuizEngine.exportData()" class="choice-btn" style="padding:10px 20px;">Exporter</button>
                <button onclick="QuizEngine.resetStats()" class="choice-btn" style="padding:10px 20px; background:rgba(248,113,113,0.1); color:#f87171;">Reset</button>
            </div>
        `;
    },

    renderExamHistory: function () {
        const history = this.getExamHistory();
        if (history.length === 0) return '<div style="opacity:0.5; font-style:italic;">Aucun historique</div>';
        let h = '<div style="display:flex; flex-direction:column; gap:8px;">';
        history.forEach(ex => {
            const c = ex.percentage >= 75 ? '#4ade80' : ex.percentage >= 50 ? '#facc15' : '#f87171';
            h += `
                <div style="padding:12px; background:rgba(255,255,255,0.02); border-radius:10px; display:flex; justify-content:space-between; align-items:center; border:1px solid rgba(255,255,255,0.03);">
                    <div>
                        <div style="font-size:0.7rem; opacity:0.5;">${new Date(ex.date).toLocaleDateString()} • ${ex.level}</div>
                        <div style="font-weight:700;">Score: ${ex.score}/${ex.total}</div>
                    </div>
                    <div style="font-size:1.2rem; font-weight:900; color:${c};">${ex.percentage}%</div>
                </div>
            `;
        });
        return h + '</div>';
    },

    // --- DATA ---
    getPersistentStats: function () {
        return JSON.parse(localStorage.getItem('parapente_qcm_stats') || '{"totalQuestions":0,"totalCorrect":0,"themes":{},"questions":{}}');
    },

    updateStats: function (q, correct) {
        const s = this.getPersistentStats();
        s.totalQuestions++;
        if (correct) s.totalCorrect++;
        if (!s.themes[q.theme]) s.themes[q.theme] = { total: 0, correct: 0 };
        s.themes[q.theme].total++;
        if (correct) s.themes[q.theme].correct++;
        if (!s.questions[q.code]) s.questions[q.code] = { total: 0, correct: 0 };
        s.questions[q.code].total++;
        if (correct) s.questions[q.code].correct++;
        localStorage.setItem('parapente_qcm_stats', JSON.stringify(s));
    },

    getExamHistory: function () {
        const h = JSON.parse(localStorage.getItem('parapente_exam_history') || '{"exams":[]}');
        return h.exams || [];
    },

    saveExamHistory: function (level, score, total, results) {
        const h = JSON.parse(localStorage.getItem('parapente_exam_history') || '{"exams":[]}');
        h.exams.unshift({ level, score, total, percentage: Math.round((score / total) * 100), date: new Date().toISOString() });
        localStorage.setItem('parapente_exam_history', JSON.stringify({ exams: h.exams.slice(0, 10) }));
    },

    resetStats: function () {
        if (confirm("Reset stats ?")) { localStorage.removeItem('parapente_qcm_stats'); this.renderStats(); }
    },

    exportData: function () {
        const data = { stats: this.getPersistentStats(), examHistory: this.getExamHistory() };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = "stats_parapente.json";
        a.click();
    }
};

window.QuizEngine = QuizEngine;
console.log("QuizEngine v4.5 LOADED (CLEAN)");
