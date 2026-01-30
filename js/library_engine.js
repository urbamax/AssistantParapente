/**
 * LIBRARY ENGINE
 * Handles the "Bibliothèque" mode: searching, sorting, and displaying courses.
 */

const LibraryEngine = {
    state: {
        search: '',
        sort: 'LEVEL', // TITLE, LEVEL, CATEGORY
        mainEngine: null,
        courses: {}
    },

    init: function (mainEngine) {
        this.state.mainEngine = mainEngine;
        // Load courses from global data
        if (typeof COURSES_DATA !== 'undefined') {
            this.state.courses = COURSES_DATA;
        }
        console.log("LibraryEngine Initialized");
    },

    show: function () {
        document.getElementById('library-screen').classList.add('active');
        this.render();
    },

    updateSearch: function (val) {
        this.state.search = val.toLowerCase();
        this.render();
    },

    setSort: function (sortType) {
        this.state.sort = sortType;
        document.querySelectorAll('.sort-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.getElementById(`sort-${sortType}`);
        if (activeBtn) activeBtn.classList.add('active');
        this.render();
    },

    render: function () {
        const container = document.getElementById('library-results');
        if (!container) return;

        container.innerHTML = '';
        const search = this.state.search;
        const sort = this.state.sort;
        // Get level from Main Engine
        const globalLevel = this.state.mainEngine ? this.state.mainEngine.state.level : 'ALL';

        // Filter courses
        let results = Object.entries(this.state.courses).map(([id, data]) => ({ id, ...data }));

        // 1. Search Filter
        if (search) {
            results = results.filter(c =>
                c.title.toLowerCase().includes(search) ||
                c.category.toLowerCase().includes(search)
            );
        }

        // 2. Level Filter (Global)
        if (globalLevel !== 'ALL') {
            results = results.filter(c => {
                const cLevels = Array.isArray(c.level) ? c.level : [c.level || 'GENERAL'];
                // Include if matches globalLevel OR if it's a GENERAL course
                return cLevels.includes(globalLevel) || cLevels.includes('GENERAL');
            });
        }

        if (results.length === 0) {
            container.innerHTML = `
                <div class="no-results" style="text-align:center; padding:64px; color:var(--text-secondary); opacity:0.6;">
                    <i class="ri-search-eye-line" style="font-size:3rem; margin-bottom:16px; display:block;"></i>
                    <p>Aucun résultat pour cette recherche...</p>
                </div>
            `;
            return;
        }

        if (sort === 'TITLE') {
            results.sort((a, b) => a.title.localeCompare(b.title));
            this.renderSimpleGrid(container, results);
        } else if (sort === 'LEVEL') {
            this.renderGroupedByLevel(container, results);
        } else if (sort === 'CATEGORY') {
            this.renderGroupedByCategory(container, results);
        }
    },

    renderSimpleGrid: function (container, courses) {
        const grid = document.createElement('div');
        grid.className = 'library-grid';
        courses.forEach(c => grid.appendChild(this.createCourseCard(c)));
        container.appendChild(grid);
    },

    renderGroupedByLevel: function (container, courses) {
        const levels = { 'BI': [], 'BP': [], 'BPC': [], 'GENERAL': [] };
        courses.forEach(c => {
            const l = Array.isArray(c.level) ? c.level : [c.level || 'GENERAL'];
            l.forEach(levelKey => {
                if (levels[levelKey]) levels[levelKey].push(c);
                else levels['GENERAL'].push(c); // Fallback
            });
        });

        ['BI', 'BP', 'BPC', 'GENERAL'].forEach(lKey => {
            if (levels[lKey].length === 0) return;
            const section = document.createElement('div');
            section.className = 'library-section';
            section.innerHTML = `<h3 class="library-section-header level-header level-${lKey}"><i class="ri-bookmark-3-fill"></i> ${this.getLevelName(lKey)}</h3>`;
            const grid = document.createElement('div');
            grid.className = 'library-grid';
            levels[lKey].forEach(c => grid.appendChild(this.createCourseCard(c)));
            section.appendChild(grid);
            container.appendChild(section);
        });
    },

    renderGroupedByCategory: function (container, courses) {
        const categories = {};
        courses.forEach(c => {
            const cat = c.category || "Autre";
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(c);
        });

        const catWeights = {
            "Livrets PP 2025": 10,
            "Manuels & Guides": 15,
            "Developpement Durable": 20,
            "Facteurs Humains": 30,
            "Preparation Examens": 40,
            "Passeport Telechargement Web": 50,
            "Affiches Pedagogiques A3": 60,
            "Autre": 100
        };

        const sortedCats = Object.keys(categories).sort((a, b) => (catWeights[a] || 999) - (catWeights[b] || 999));
        sortedCats.forEach(cat => {
            const section = document.createElement('div');
            section.className = 'library-section';
            section.innerHTML = `<h3 class="library-section-header"><i class="ri-folder-open-line"></i> ${cat}</h3>`;
            const grid = document.createElement('div');
            grid.className = 'library-grid';
            categories[cat].forEach(c => grid.appendChild(this.createCourseCard(c)));
            section.appendChild(grid);
            container.appendChild(section);
        });
    },

    createCourseCard: function (c) {
        const btn = document.createElement('button');
        const isModernized = c.id.startsWith('modernized/');
        btn.className = `mode-btn ${isModernized ? 'modernized' : ''}`;
        btn.onclick = () => this.openCourse(c.id);

        let levelBadges = '';
        const levels = Array.isArray(c.level) ? c.level : [c.level || 'GENERAL'];
        levels.forEach(l => {
            levelBadges += `<span class="badge badge-${l}">${l}</span> `;
        });

        if (isModernized) {
            levelBadges += `<span class="badge badge-modernized"><i class="ri-sparkling-fill"></i> NOUVEAU</span>`;
        }

        btn.innerHTML = `
            <div class="course-card-content">
                <div class="course-card-title">${this.formatTitle(c.title)}</div>
                <div class="course-card-meta">
                    <span class="category-tag">${c.category}</span>
                    <div class="level-badges">${levelBadges}</div>
                </div>
            </div>
        `;
        return btn;
    },

    openCourse: function (courseId) {
        const course = this.state.courses[courseId];
        if (!course) return console.error("Course not found:", courseId);

        console.log("Navigating to course:", course.title);

        // Tell Main Engine to switch key if needed, or just navigate
        // Engine.js used to set currentCourseId and saveState.
        // We should replicate that or ask Engine to do it.
        // For now, simpler to just navigate as it's a PDF link mostly.

        if (this.state.mainEngine) {
            this.state.mainEngine.state.currentCourseId = courseId;
            this.state.mainEngine.saveState();
        }

        // DIRECT NAVIGATION
        window.location.href = course.pdf;
    },

    formatTitle: function (title) {
        if (!title) return "";
        let clean = title.replace(/\(Cours Modernisé\)/g, '');
        clean = clean.replace(/^[0-9]+[ \-_]*/, '');
        clean = clean.replace(/[_\-]/g, ' ');
        clean = clean.replace(/(2019|2021|2022|2024|2025|WEB|WEB2025|PP2025)/gi, '');
        clean = clean.replace(/\s+/g, ' ').trim();

        if (clean.includes("RCFC")) clean = clean.replace("RCFC", "Référentiel");
        if (clean.includes("RENTIEL")) clean = clean.replace("RENTIEL", "Référentiel");
        if (clean === "DESEQUILIBRE DU VOL") clean = "Déséquilibre du Vol";

        if (clean === clean.toUpperCase()) {
            clean = clean.toLowerCase().split(' ').map(s => s.charAt(0).toUpperCase() + s.substring(1)).join(' ');
        }

        clean = clean.replace(/Brevet Pilote/gi, 'Brevet de Pilote');
        return clean;
    },

    getLevelName: function (l) {
        const names = { 'BI': 'BREVET INITIAL', 'BP': 'BREVET DE PILOTE', 'BPC': 'BREVET DE PILOTE CONFIRMÉ', 'GENERAL': 'GÉNÉRAL' };
        return names[l] || l;
    }
};

window.LibraryEngine = LibraryEngine;
