/**
 * ADVENTURE ENGINE
 * Handles the "Simulateur" mode: Flight scenarios, choices, and consequences.
 */

const AdventureEngine = {
    state: {
        flight: null,       // Current Flight Object
        stepIndex: 0,       // Current Step
        flightState: {},    // Dynamic variables (wind, stress, etc.)
        stats: {            // Session Stats
            correct: 0,
            total: 0,
            themes: {}
        },
        mainEngine: null
    },

    init: function (mainEngine) {
        this.state.mainEngine = mainEngine;
        console.log("AdventureEngine Initialized");
    },

    start: function () {
        document.getElementById('adventure-screen').classList.add('active');
        const level = this.state.mainEngine ? this.state.mainEngine.state.level : 'BI';
        this.startFlight(level);
    },

    startFlight: function (level) {
        if (typeof ScenarioGenerator === 'undefined') {
            console.error("ScenarioGenerator missing!");
            return;
        }
        const newFlight = ScenarioGenerator.generate(level);
        if (!newFlight) {
            if (this.state.mainEngine) this.state.mainEngine.showDashboard();
            return;
        }

        this.state.flight = newFlight;
        this.state.stepIndex = 0;
        this.state.flightState = {};
        this.state.stats = { correct: 0, total: 0, themes: {} };
        this.renderStep();
    },

    renderStep: function () {
        if (!this.state.flight) return;
        const flight = this.state.flight;
        const step = flight.steps[this.state.stepIndex];
        const title = document.getElementById('scenario-title');
        const textContainer = document.getElementById('narrative-text');
        const choicesContainer = document.getElementById('choices-area');

        if (!title || !textContainer || !choicesContainer) return;

        title.innerText = `${flight.level} • ${step.stage}`;
        title.className = `level-tag level-${flight.level}`;

        const currentScore = this.state.stats.total > 0 ? Math.round((this.state.stats.correct / this.state.stats.total) * 100) : 100;
        const stressLevel = this.state.flightState.stress || 0;
        const progressPct = (this.state.stepIndex / flight.steps.length) * 100;

        const hudHtml = `
            <div class="hud-container">
                <div class="hud-stat">
                    <span class="hud-stat-label">Performance</span>
                    <span class="hud-stat-value ${currentScore > 50 ? 'good' : 'warning'}">${currentScore}%</span>
                </div>
                <div class="hud-progress-track">
                    <div class="hud-progress-fill" style="width:${progressPct}%;"></div>
                </div>
                <div class="hud-stat" style="text-align:right;">
                    <span class="hud-stat-label">Stress</span>
                    <span class="hud-stat-value ${stressLevel < 50 ? 'good' : 'danger'}">${stressLevel}%</span>
                </div>
            </div>
        `;

        let contentText = step.text;
        if (typeof step.text === 'function') contentText = step.text(this.state.flightState);

        textContainer.innerHTML = '';
        textContainer.insertAdjacentHTML('beforeend', hudHtml);
        textContainer.insertAdjacentHTML('beforeend', `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <span class="quiz-progress">Etape ${this.state.stepIndex + 1}/${flight.steps.length}</span>
                <span class="badge badge-modernized">${flight.level}</span>
            </div>
            <div class="narrative-content">${contentText}</div>
        `);

        choicesContainer.innerHTML = '';
        const shuffledChoices = this.shuffle(step.choices);
        shuffledChoices.forEach(choice => {
            const btn = document.createElement('button');
            btn.className = 'choice-btn';
            btn.innerHTML = `<i class="ri-arrow-right-circle-line"></i> <span>${choice.text}</span>`;
            btn.onclick = () => this.handleChoice(choice, step.stage);
            choicesContainer.appendChild(btn);
        });
    },

    handleChoice: function (choice, stage) {
        const isCorrect = choice.correct !== false;
        if (stage !== 'SITUATION' && stage !== 'ATTERRISSAGE' && stage !== 'FIN DU VOL') {
            this.state.stats.total++;
            if (isCorrect) this.state.stats.correct++;
            if (!this.state.stats.themes[stage]) this.state.stats.themes[stage] = { correct: 0, total: 0 };
            this.state.stats.themes[stage].total++;
            if (isCorrect) this.state.stats.themes[stage].correct++;
        }
        if (choice.impact) {
            this.state.flightState = { ...this.state.flightState, ...choice.impact };
        }
        this.showFeedback(choice);
    },

    showFeedback: function (choice) {
        const textContainer = document.getElementById('narrative-text');
        const choicesContainer = document.getElementById('choices-area');
        const isCorrect = choice.correct !== false;
        const feedbackClass = isCorrect ? 'feedback-success' : 'feedback-fail';
        const icon = isCorrect ? '<i class="ri-checkbox-circle-line"></i>' : '<i class="ri-error-warning-line"></i>';

        textContainer.innerHTML = `
            <div class="instructor-feedback ${feedbackClass}">
                <div class="feedback-header">${icon} Analyse Instructeur</div>
                <p style="font-size:1.1rem; opacity:0.9; margin:0;">${choice.feedback || "Bien reçu."}</p>
            </div>
        `;

        choicesContainer.innerHTML = '';
        const nextBtn = document.createElement('button');
        nextBtn.className = 'choice-btn next-btn';
        nextBtn.style.marginTop = '20px';
        if (this.state.stepIndex >= this.state.flight.steps.length - 1) {
            nextBtn.innerHTML = '<i class="ri-flag-line"></i> DÉBRIEFING';
            nextBtn.onclick = () => this.finishFlight();
        } else {
            nextBtn.innerHTML = 'ÉTAPE SUIVANTE <i class="ri-arrow-right-line"></i>';
            nextBtn.onclick = () => {
                this.state.stepIndex++;
                this.renderStep();
            };
        }
        choicesContainer.appendChild(nextBtn);
    },

    finishFlight: function () {
        const stats = this.state.stats;
        const scorePct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 100;
        let rating = "Pilote";
        if (scorePct >= 95) rating = "As des As";
        else if (scorePct >= 80) rating = "Excellent Pilote";
        else if (scorePct >= 60) rating = "Pilote Prudent";
        else if (scorePct >= 40) rating = "Élève en progression";
        else rating = "Danger Public";

        let themesHtml = '<div class="stats-grid-2" style="margin-top:20px;">';
        for (const [theme, data] of Object.entries(stats.themes)) {
            const pct = Math.round((data.correct / data.total) * 100);
            const colorClass = pct > 75 ? 'good' : (pct > 40 ? 'warning' : 'danger');
            const color = pct > 75 ? '#00e676' : (pct > 40 ? '#ff9800' : '#f44336'); // keeping inline for dynamic color for now or map to classes
            themesHtml += `
            <div class="stats-row">
                <div style="font-size:0.9rem; opacity:0.7">${theme}</div>
                <div style="font-size:1.1rem; color:${color}; font-weight:bold;">${pct}%</div>
            </div>`;
        }
        themesHtml += '</div>';

        document.getElementById('narrative-text').innerHTML = `
            <div style="text-align:center;">
                <h2>VOL TERMINÉ</h2>
                <div style="font-size:3rem; font-weight:bold; color:${scorePct > 75 ? '#00e676' : '#f44336'}">${scorePct}%</div>
                <div style="font-size:1.2rem; margin-bottom:20px;">${rating}</div>
                <hr style="border:0; border-top:1px solid rgba(255,255,255,0.1); margin:20px 0;">
                <div style="font-size:0.9rem;">Bonnes réponses: <b>${stats.correct}</b> / ${stats.total}</div>
                ${themesHtml}
            </div>
        `;

        const choicesContainer = document.getElementById('choices-area');
        choicesContainer.innerHTML = '';
        const retryBtn = document.createElement('button');
        retryBtn.className = 'choice-btn';
        retryBtn.innerHTML = "<i class='ri-restart-line'></i> NOUVEAU VOL";
        retryBtn.onclick = () => this.startFlight(this.state.flight.level);

        const menuBtn = document.createElement('button');
        menuBtn.className = 'return-btn';
        menuBtn.innerHTML = "Menu Principal";
        menuBtn.style.marginTop = "20px";
        menuBtn.onclick = () => {
            if (this.state.mainEngine) this.state.mainEngine.showDashboard();
        };

        choicesContainer.appendChild(retryBtn);
        choicesContainer.appendChild(menuBtn);
    },

    shuffle: function (array) {
        if (!array) return [];
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    }
};

window.AdventureEngine = AdventureEngine;
