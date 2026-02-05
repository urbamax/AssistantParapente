/**
 * LIBRARY ENGINE
 * Handles the "Bibliothèque" mode: searching, sorting, and displaying courses.
 */

const LibraryEngine = {
    state: {
        search: '',
        sort: 'CATEGORY', // TITLE, LEVEL, CATEGORY
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
        const listContainer = document.createElement('div');
        listContainer.className = 'library-list';
        courses.forEach(c => listContainer.appendChild(this.createCourseListItem(c)));
        container.appendChild(listContainer);
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

            // USE LIST CONTAINER
            const listContainer = document.createElement('div');
            listContainer.className = 'library-list';

            levels[lKey].forEach(c => listContainer.appendChild(this.createCourseCard(c)));
            section.appendChild(listContainer);
            container.appendChild(section);
        });
    },

    renderGroupedByCategory: function (container, courses) {
        // Group by INFERRED THEME instead of Folder Category
        const themes = {};

        courses.forEach(c => {
            const theme = this.assignTheme(c);
            if (!themes[theme]) themes[theme] = [];
            themes[theme].push(c);
        });

        // Define fixed order for themes
        const themeOrder = [
            "Météo",
            "Mécavol",
            "Matériel",
            "Pilotage",
            "Réglementation",
            "Facteurs humains",
            "Milieu naturel",
            "Autre"
        ];

        themeOrder.forEach(theme => {
            if (!themes[theme] || themes[theme].length === 0) return;

            const section = document.createElement('div');
            section.className = 'library-section';
            section.innerHTML = `<h3 class="library-section-header"><i class="ri-folder-open-line"></i> ${theme.toUpperCase()}</h3>`;

            // USE LIST CONTAINER
            const listContainer = document.createElement('div');
            listContainer.className = 'library-list';

            themes[theme].forEach(c => listContainer.appendChild(this.createCourseListItem(c)));

            section.appendChild(listContainer);
            container.appendChild(section);
        });
    },

    assignTheme: function (c) {
        const text = (c.title + " " + (c.keywords || []).join(" ")).toLowerCase();

        if (text.includes("météo") || text.includes("nuage") || text.includes("front") || text.includes("atmosphère") || text.includes("brise") || text.includes("thermique")) return "Météo";
        if (text.includes("mécanique") || text.includes("mécavol") || text.includes("portance") || text.includes("polaire") || text.includes("finesse") || text.includes("dynamique")) return "Mécavol";
        if (text.includes("matériel") || text.includes("parachute") || text.includes("sellette") || text.includes("voile") || text.includes("homologation") || text.includes("suspente")) return "Matériel";
        if (text.includes("pilotage") || text.includes("tangage") || text.includes("roulis") || text.includes("virage") || text.includes("gonflage") || text.includes("décollage") || text.includes("atterrissage") || text.includes("vitesse") || text.includes("plan de vol")) return "Pilotage";
        if (text.includes("règlementation") || text.includes("reglementation") || text.includes("aérien") || text.includes("espace") || text.includes("vfr") || text.includes("site")) return "Réglementation";
        if (text.includes("humain") || text.includes("stress") || text.includes("mental") || text.includes("risque") || text.includes("decision") || text.includes("fatigue")) return "Facteurs humains";
        if (text.includes("milieu") || text.includes("nature") || text.includes("rapace") || text.includes("faune") || text.includes("flore")) return "Milieu naturel";

        return "Autre";
    },

    createCourseListItem: function (c) {
        const btn = document.createElement('div');
        btn.className = 'library-list-item';
        btn.onclick = () => this.openCourse(c.id);

        let levelBadges = '';
        const levels = Array.isArray(c.level) ? c.level : [c.level || 'GENERAL'];
        levels.forEach(l => {
            levelBadges += `<span class="badge badge-${l}">${l}</span> `;
        });

        // SIMPLIFIED STRUCTURE MATCHING STATS ROW
        // Title on left | Badges + Arrow on right
        btn.innerHTML = `
            <div class="list-item-content">
                <div class="list-item-title">${this.formatTitle(c.title)}</div>
            </div>
            <div class="list-item-meta">
                ${levelBadges}
                <div class="list-item-action">
                    <i class="ri-arrow-right-s-line"></i>
                </div>
            </div>
        `;
        return btn;
    },

    // Legacy support for grid (unused in CATEGORY view but kept for others if needed)
    createCourseCard: function (c) {
        return this.createCourseListItem(c); // Redirect to list view globally for consistency
    },

    openCourse: function (courseId) {
        const course = this.state.courses[courseId];
        if (!course) return console.error("Course not found:", courseId);

        console.log("Opening course PDF:", course.title);

        // PREFER ORIGINAL PDF IF AVAILABLE (skips modernized HTML)
        const targetUrl = course.original_pdf || course.pdf;

        // OPEN IN NEW TAB
        window.open(targetUrl, '_blank');
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
