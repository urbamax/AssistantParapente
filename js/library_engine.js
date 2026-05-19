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
        const levels = { 'BI': [], 'BP': [], 'BPC': [], 'TREUIL': [], 'GENERAL': [] };
        courses.forEach(c => {

            const l = Array.isArray(c.level) ? c.level : [c.level || 'GENERAL'];
            l.forEach(levelKey => {
                if (levels[levelKey]) levels[levelKey].push(c);
                else levels['GENERAL'].push(c); // Fallback
            });
        });

        ['BI', 'BP', 'BPC', 'TREUIL', 'GENERAL'].forEach(lKey => {
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
        // Group by the 'category' property defined in courses_data.js
        const categories = {};

        courses.forEach(c => {
            const cat = c.category || "Autre";
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(c);
        });

        // Get all unique categories and sort them
        const sortedCategories = Object.keys(categories).sort((a, b) => {
            // Put 'Général' or 'GENERAL' first, 'Autre' last
            if (a.toLowerCase().includes('général') || a === 'GENERAL') return -1;
            if (b.toLowerCase().includes('général') || b === 'GENERAL') return 1;
            if (a === 'Autre') return 1;
            if (b === 'Autre') return -1;
            return a.localeCompare(b);
        });

        sortedCategories.forEach(cat => {
            if (categories[cat].length === 0) return;

            const section = document.createElement('div');
            section.className = 'library-section';
            section.innerHTML = `<h3 class="library-section-header"><i class="ri-folder-open-line"></i> ${cat}</h3>`;

            const listContainer = document.createElement('div');
            listContainer.className = 'library-list';

            // Sort courses within each category by title
            categories[cat].sort((a, b) => (a.title || "").localeCompare(b.title || ""));

            categories[cat].forEach(c => listContainer.appendChild(this.createCourseListItem(c)));

            section.appendChild(listContainer);
            container.appendChild(section);
        });
    }
    ,

    assignTheme: function (c) {
        // Logic removed: We now use the 'category' property directly from courses_data.js
        return c.category || "Autre";
    }
    ,

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
        let targetUrl = course.original_pdf || course.pdf;
        if (targetUrl) {
            targetUrl = targetUrl.normalize('NFC');
        }

        // OPEN IN NEW TAB
        window.open(targetUrl, '_blank');
    },

    formatTitle: function (title) {
        return title || "";
    },

    getLevelName: function (l) {
        const names = { 'BI': 'BREVET INITIAL', 'BP': 'BREVET DE PILOTE', 'BPC': 'BREVET DE PILOTE CONFIRMÉ', 'TREUIL': 'TREUIL', 'GENERAL': 'GÉNÉRAL' };
        return names[l] || l;
    }

};

window.LibraryEngine = LibraryEngine;
