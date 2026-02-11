/**
 * ENGINE.JS - v4.0 (Modular Architecture)
 * Acts as the Application Controller, coordinating Mode switching and Logic delegation.
 * - Library Logic -> js/library_engine.js
 * - QCM Logic -> js/quiz_engine.js
 */

const Engine = {
    state: {
        level: 'ALL',        // BI, BP, BPC, ALL
        mode: 'MENU',
        themeMode: 'auto',
        currentCourseId: null,
        lastMode: 'MENU',
        basePath: '.'
    },

    init: function () {
        console.log("App Controller Initialized v4.1 - Level State Fix");

        // Initialize Sub-Engines
        if (typeof QuizEngine !== 'undefined') QuizEngine.init(this);
        if (typeof LibraryEngine !== 'undefined') LibraryEngine.init(this);

        // Setup Theme Toggle Listener safely
        const themeBtn = document.getElementById('theme-toggle');
        if (themeBtn) {
            themeBtn.onclick = () => this.toggleTheme();
        }

        // Load saved theme
        const savedTheme = localStorage.getItem('themeMode');
        if (savedTheme) {
            this.state.themeMode = savedTheme;
        }
        this.applyThemeMode();

        // Load saved level
        const savedLevel = localStorage.getItem('userLevel');
        if (savedLevel) {
            this.state.level = savedLevel;
            const levelSelect = document.getElementById('global-level-select');
            if (levelSelect) levelSelect.value = savedLevel;
        }

        // Restore State or Show Dashboard
        if (!this.restoreState()) {
            this.showDashboard();
        }

        // Check for pending quiz (Standalone integration)
        const pendingQuiz = localStorage.getItem('pending_quiz');
        if (pendingQuiz) {
            console.log("Found pending quiz:", pendingQuiz);
            localStorage.removeItem('pending_quiz');
            setTimeout(() => {
                this.toggleReviewMode(pendingQuiz);
            }, 500);
        }

        // Header Scroll Effect - Fix for stored scroll containers
        const screens = document.querySelectorAll('.mode-screen');
        screens.forEach(screen => {
            screen.addEventListener('scroll', (e) => {
                const header = document.getElementById('app-header');
                if (!header) return;
                // Use scrollTop of the scrolling container
                if (e.target.scrollTop > 20) {
                    header.classList.add('scrolled');
                } else {
                    header.classList.remove('scrolled');
                }
            }, { passive: true });
        });

        // Initialize Theme based on loaded level
        this.updateAppTheme(this.state.level);

        // --- EVENT LISTENERS ---
        // Global Navigation
        window.onpopstate = (event) => {
            if (event.state) {
                this.restoreState();
            }
        };

        // Keyboard Navigation (Esc to close modals)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.goBack();
        });

        console.log("Engine v4.5 Initialized");
    },

    /* --- STATE MANAGEMENT --- */
    saveState: function () {
        const persist = {
            mode: this.state.mode,
            currentCourseId: this.state.currentCourseId,
            level: this.state.level
        };
        localStorage.setItem('parapente_state', JSON.stringify(persist));
    },

    restoreState: function () {
        const saved = localStorage.getItem('parapente_state');
        if (!saved) return false;

        let stateToRestore;
        try {
            stateToRestore = JSON.parse(saved);
        } catch (e) {
            console.warn("Corrupted state in localStorage, resetting.", e);
            localStorage.removeItem('parapente_state');
            return false;
        }

        console.log("Attempting to restore session:", stateToRestore);

        // 1. Level Restoration
        // We defer to the explicitly stored 'userLevel' loaded in init() for the Level.
        // But for consistency, we can log if they differ.
        if (stateToRestore.level && stateToRestore.level !== this.state.level) {
            console.log(`Session level (${stateToRestore.level}) differs from User Preference (${this.state.level}). Keeping User Preference.`);
        }

        // 2. Mode Restoration
        const { mode, currentCourseId } = stateToRestore;

        // Block start if mode is MENU
        if (!mode || mode === 'MENU') {
            return false;
        }

        // Handle Modes
        switch (mode) {
            case 'COURSE':
                if (currentCourseId && typeof LibraryEngine !== 'undefined') {
                    // Directly open the course without going through startMode checks that might wipe ID
                    LibraryEngine.openCourse(currentCourseId);
                    return true;
                }
                break;

            case 'QCM':
            case 'QCM_BANK':
            case 'STATS':
            case 'LIBRARY':
                this.startMode(mode);
                return true;

            default:
                console.warn(`Unrecognized mode '${mode}', returning to Dashboard.`);
        }

        return false;
    },

    /* --- ROUTING & MODE SWITCHING --- */
    startMode: function (mode) {
        this.state.mode = mode;
        this.state.currentCourseId = null;
        document.querySelectorAll('.mode-screen').forEach(s => s.classList.remove('active'));

        if (mode === 'ADVENTURE') {
            if (typeof AdventureEngine !== 'undefined') AdventureEngine.start();
        } else if (mode === 'QCM') {
            if (typeof QuizEngine !== 'undefined') QuizEngine.showSetup();
        } else if (mode === 'QCM_BANK') {
            const bankScreen = document.getElementById('qcm-bank-screen');
            if (bankScreen) bankScreen.classList.add('active');
            if (typeof QuizEngine !== 'undefined') QuizEngine.renderBank();
        } else if (mode === 'STATS') {
            document.getElementById('stats-screen').classList.add('active');
            if (typeof QuizEngine !== 'undefined') QuizEngine.renderStats();
        } else if (mode === 'LIBRARY') {
            if (typeof LibraryEngine !== 'undefined') LibraryEngine.show();
        }
        this.updateHeaderNavigation();
        this.saveState();
    },

    showDashboard: function () {
        if (this.state.basePath && this.state.basePath !== '.') {
            window.location.href = this.state.basePath + '/index.html';
            return;
        }
        this.state.mode = 'MENU';
        this.state.currentCourseId = null;
        document.body.classList.remove('course-open');
        document.querySelectorAll('.mode-screen').forEach(s => s.classList.remove('active'));
        document.getElementById('start-screen').classList.add('active');

        // Hide specific containers if needed
        const dashContent = document.querySelector('.dashboard-content');
        if (dashContent) dashContent.style.display = 'block';

        this.updateHeaderUI();
        this.updateHeaderNavigation();
        this.saveState();
    },

    goBack: function () {
        if (this.state.mode === 'COURSE') {
            // Stop PDF Frame
            const frame = document.getElementById('course-pdf-frame');
            if (frame) frame.src = "";
            document.body.classList.remove('course-open');
            this.startMode('LIBRARY');
            return;
        }
        this.showDashboard();
        this.updateHeaderNavigation();
    },

    changeLevel: function (newLevel) {
        this.state.level = newLevel;
        localStorage.setItem('userLevel', newLevel);
        this.saveState(); // Ensure session state is updated

        // Update Theme
        this.updateAppTheme(newLevel);

        console.log("DEBUG: Engine.changeLevel called with", newLevel, "State updated to", this.state.level);

        // Refresh current view
        if (this.state.mode === 'LIBRARY' && typeof LibraryEngine !== 'undefined') {
            LibraryEngine.render();
        }
        else if (this.state.mode === 'ADVENTURE' && typeof AdventureEngine !== 'undefined') {
            AdventureEngine.startFlight(newLevel);
        }
        else if (this.state.mode === 'QCM_BANK' && typeof QuizEngine !== 'undefined') {
            QuizEngine.renderBank();
        }
        // Qcm might use it too
        else if (this.state.mode === 'STATS' && typeof QuizEngine !== 'undefined') {
            QuizEngine.renderStats();
        }
    },

    // --- THEME MANAGEMENT ---
    updateAppTheme: function (level) {
        const root = document.documentElement;
        let color = '#0ea5e9'; // Default Blue (BP)

        if (level === 'BI') color = '#22c55e'; // Green
        else if (level === 'BPC') color = '#8B4513'; // Brown (Marron)
        else if (level === 'TREUIL') color = '#6366f1'; // Indigo
        else if (level === 'ALL') color = '#64748b'; // Slate (Sober)

        root.style.setProperty('--accent-blue', color);
    },

    updateHeaderUI: function () {
        // Reserved for future header updates
    },

    updateHeaderNavigation: function () {
        const navSlot = document.querySelector('.header-nav-slot');
        if (!navSlot) return;

        // Clear slot
        navSlot.innerHTML = '';

        // Only show back button if not on MENU
        if (this.state.mode !== 'MENU') {
            const backBtn = document.createElement('button');
            backBtn.className = 'nav-btn-glass';
            backBtn.innerHTML = '<i class="ri-arrow-left-line"></i> <span>RETOUR</span>';
            backBtn.onclick = () => this.goBack();
            navSlot.appendChild(backBtn);
        }
    },

    /* --- COMPONENT LOADING (Dynamic Fetch) --- */
    loadComponents: function (basePath) {
        basePath = basePath || '.';
        this.state.basePath = basePath;

        const componentMap = [
            { id: 'app-header', url: basePath + '/components/header.html' },
            { id: 'app-footer', url: basePath + '/components/footer.html', selector: '.app-footer-placeholder' }
        ];

        const self = this;

        componentMap.forEach(function (comp) {
            fetch(comp.url)
                .then(response => {
                    if (!response.ok) throw new Error('Network response was not ok');
                    return response.text();
                })
                .then(html => {
                    const targets = comp.selector ? document.querySelectorAll(comp.selector) : (document.getElementById(comp.id) ? [document.getElementById(comp.id)] : []);
                    targets.forEach(function (el) {
                        el.innerHTML = html;

                        // Path correction
                        if (basePath !== '.') {
                            el.querySelectorAll('[src], [href]').forEach(function (node) {
                                const attr = node.hasAttribute('src') ? 'src' : 'href';
                                const val = node.getAttribute(attr);
                                if (!val.match(/^(http|\/\/|#|mailto:)/)) {
                                    node.setAttribute(attr, basePath + '/' + val);
                                }
                            });
                        }
                    });

                    // Re-bind theme and navigation after loading
                    self.updateHeaderNavigation();
                    self.applyThemeMode();

                    // Standalone Hooks
                    if (window.self === window.top && basePath !== '.') {
                        self.setupStandalone(basePath);
                    }
                })
                .catch(error => {
                    console.warn('Error loading component:', comp.url, error);
                    // Fallback to legacy global object if available (backward compatibility)
                    if (typeof COMPONENTS !== 'undefined') {
                        const legacyKey = comp.url.includes('header') ? 'header' : 'footer';
                        if (COMPONENTS[legacyKey]) {
                            const targets = comp.selector ? document.querySelectorAll(comp.selector) : (document.getElementById(comp.id) ? [document.getElementById(comp.id)] : []);
                            targets.forEach(function (el) { el.innerHTML = COMPONENTS[legacyKey]; });
                        }
                    }
                });
        });
    },

    setupStandalone: function (basePath) {
        document.body.classList.add('standalone-course');
        const navSlot = document.querySelector('.header-nav-slot');
        if (navSlot && !document.getElementById('standalone-back-btn')) {
            const backBtn = document.createElement('a');
            backBtn.id = 'standalone-back-btn';
            backBtn.href = basePath + '/index.html';
            backBtn.className = 'nav-btn-glass';
            backBtn.innerHTML = '<i class="ri-arrow-left-line"></i> <span>RETOUR</span>';
            navSlot.appendChild(backBtn);
        }

        if (navSlot && !document.getElementById('standalone-pdf-btn') && typeof COURSES_DATA !== 'undefined') {
            const currentFilename = window.location.pathname.split('/').pop();
            let pdfPath = null;
            for (const key in COURSES_DATA) {
                if (COURSES_DATA[key].pdf && COURSES_DATA[key].pdf.endsWith(currentFilename)) {
                    pdfPath = COURSES_DATA[key].original_pdf;
                    break;
                }
            }
            if (pdfPath) {
                const pdfBtn = document.createElement('a');
                pdfBtn.id = 'standalone-pdf-btn';
                pdfBtn.href = basePath + '/' + pdfPath;
                pdfBtn.target = '_blank';
                pdfBtn.className = 'nav-btn-glass secondary';
                pdfBtn.innerHTML = '<i class="ri-file-pdf-line"></i> <span>PDF</span>';
                navSlot.appendChild(pdfBtn);
            }
        }
    },

    /* --- THEME LOGIC --- */
    toggleTheme: function () {
        const modes = ['auto', 'light', 'dark'];
        const next = modes[(modes.indexOf(this.state.themeMode) + 1) % modes.length];
        this.state.themeMode = next;
        localStorage.setItem('themeMode', next);
        this.applyThemeMode();
    },

    applyThemeMode: function () {
        const body = document.body;
        const iconSun = document.querySelector('.ri-sun-line');
        const iconMoon = document.querySelector('.ri-moon-line');
        const btn = document.getElementById('theme-toggle');

        body.classList.remove('light-mode', 'dark-mode');
        // Reset Icons opacity
        if (iconSun) iconSun.style.opacity = '0.5';
        if (iconMoon) iconMoon.style.opacity = '0.5';

        let effectiveMode = this.state.themeMode;
        if (effectiveMode === 'auto') {
            const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            effectiveMode = systemDark ? 'dark' : 'light';
            if (btn) btn.title = "Mode: Auto";
            if (iconSun && iconMoon) {
                iconSun.style.opacity = '1';
                iconMoon.style.opacity = '1';
            }
        } else {
            if (btn) btn.title = "Mode: " + effectiveMode.charAt(0).toUpperCase() + effectiveMode.slice(1);
            if (effectiveMode === 'light') {
                if (iconSun) iconSun.style.opacity = '1';
            } else {
                if (iconMoon) iconMoon.style.opacity = '1';
            }
        }
        if (effectiveMode === 'light') body.classList.add('light-mode');
    },

    /* --- DELEGATIONS (API for HTML) --- */

    // QuizEngine Delegations
    setQcmMode: (m) => typeof QuizEngine !== 'undefined' && QuizEngine.setMode(m),
    setQcmCount: (c) => typeof QuizEngine !== 'undefined' && QuizEngine.setCount(c),
    startQcmSession: () => typeof QuizEngine !== 'undefined' && QuizEngine.startSession(),
    showQcmBank: () => typeof QuizEngine !== 'undefined' && QuizEngine.showBank(),
    renderQcmBank: () => typeof QuizEngine !== 'undefined' && QuizEngine.renderBank(),
    showStats: function () { this.startMode('STATS'); },
    checkGenAnswer: (e, q, o, c) => typeof QuizEngine !== 'undefined' && QuizEngine.checkGenAnswer && QuizEngine.checkGenAnswer(e, q, o, c),
    // note: checkGenAnswer was in engine.js for review mode. I extracted it in my head? 
    // Wait, the review/generated content logic (lines 894-972) was NOT extracted to QuizEngine yet!
    // I missed that block (lines 894-972) in extraction.
    // It's for "Generated Content" / Review Mode.
    // I should probably keep it in Engine or move to QuizEngine.
    // It's used when a quiz is generated from the content tool (external).
    // I better keep it here or add it to plain Engine for now to avoid breaking "Review Mode" if it's used.

    // LibraryEngine Delegations
    updateLibrarySearch: (v) => typeof LibraryEngine !== 'undefined' && LibraryEngine.updateSearch(v),
    setLibrarySort: (t) => typeof LibraryEngine !== 'undefined' && LibraryEngine.setSort(t),

    // AdventureEngine Delegations
    handleChoice: (c, s) => typeof AdventureEngine !== 'undefined' && AdventureEngine.handleChoice(c, s),
    // ... others are internal to AdventureEngine

    // Legacy / Misc
    renderCourseMenu: () => { }, // Deprecated

    /* --- REVIEW MODE (GENERATED CONTENT) --- */
    toggleReviewMode: function (courseId) {
        const viewer = document.querySelector('.course-viewer') || document.body;
        const existingOverlay = document.getElementById('review-overlay');

        if (existingOverlay) {
            existingOverlay.remove();
            return;
        }

        // Check global generated content (if available)
        if (typeof GENERATED_CONTENT === 'undefined' || !GENERATED_CONTENT[courseId]) {
            console.warn("No generated content found for", courseId);
            return;
        }

        const data = GENERATED_CONTENT[courseId];

        const overlay = document.createElement('div');
        overlay.id = 'review-overlay';
        overlay.className = 'review-overlay';

        if (viewer === document.body) {
            // CSS class .review-overlay handles fixed positioning
        } else {
            // If embedded in a container, we might need specific logic or a different class
            // But usually it's fullscreen.
            overlay.style.position = 'absolute'; // fallback for container embed if ever used
        }

        let quizHTML = '';
        if (data.quiz && data.quiz.length > 0) {
            quizHTML = `<div class="generated-quiz">
                <h3>Quiz de validation</h3>
                ${data.quiz.map((q, i) => `
                    <div class="g-quiz-item">
                        <div class="g-question">${i + 1}. ${q.question}</div>
                        <div class="g-options">
                            ${q.options.map((opt, optI) => `
                                <div class="g-option" onclick="Engine.checkGenAnswer(this, ${i}, ${optI}, ${q.correct})">${opt}</div>
                            `).join('')}
                        </div>
                        <div class="g-explanation" id="g-expl-${i}" style="display:none;">${q.explanation}</div>
                    </div>
                `).join('')}
            </div>`;
        }

        overlay.innerHTML = `
            <div class="review-content">
                <button class="close-review icon-btn" onclick="document.getElementById('review-overlay').remove()" style="position:fixed; top:20px; right:20px; z-index:100000;">
                    <i class="ri-close-line"></i>
                </button>
                <div class="generated-summary">
                    ${data.summary}
                </div>
                ${quizHTML}
            </div>
        `;

        viewer.appendChild(overlay);
    },

    checkGenAnswer: function (el, qIndex, optIndex, correctIndex) {
        if (el.classList.contains('checked')) return;
        el.parentElement.querySelectorAll('.g-option').forEach(o => o.classList.add('checked'));
        if (optIndex === correctIndex) el.classList.add('correct');
        else el.classList.add('incorrect');

        const expl = document.getElementById(`g-expl-${qIndex}`);
        if (expl) expl.style.display = 'block';
    }
};

window.Engine = Engine;

document.addEventListener('DOMContentLoaded', () => {
    Engine.init();
});

if (document.body && window.matchMedia && !window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.body.classList.add('light-mode');
}
