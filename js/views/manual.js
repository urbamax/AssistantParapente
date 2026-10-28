/**
 * VIEW/CONTROLLER - LibraryView
 * Wrapped from library_engine.js
 */
import GlobalState from '../core/app_state.js';
import { escapeHTML } from '../core/security.js';
import { openLink } from '../core/course_link.js';
import { COURSES_DATA } from '../data/courses_data.js';
import { toSorted } from '../utils/array_utils.js';
import { t } from '../utils/i18n.js';
import { FR } from '../i18n/fr.js';

/**
 * LIBRARY ENGINE
 * Handles the "Bibliothèque" mode: searching, sorting, and displaying courses.
 */

import BaseView from '../core/base_view.js';

class LibraryViewClass extends BaseView {
    constructor() {
        super();
        this.state = {
            search: '',
            sort: 'CATEGORY', // TITLE, LEVEL, CATEGORY
            courses: {},
        };
    }
    init() {
        // Load courses from global data
        this.state.courses = COURSES_DATA;
        console.log('LibraryEngine Initialized');
    }

    show() {
        document.getElementById('library-screen').classList.add('active');
        this.render();
    }

    updateSearch(val) {
        this.state.search = val.toLowerCase();
        this.render();
    }

    setSort(sortType) {
        this.state.sort = sortType;
        document.querySelectorAll('.sort-btn').forEach((btn) => btn.classList.remove('active'));
        const activeBtn = document.getElementById(`sort-${sortType}`);
        if (activeBtn) activeBtn.classList.add('active');
        this.render();
    }

    render() {
        const container = document.getElementById('library-results');
        if (!container) return;

        container.innerHTML = '';
        const search = this.state.search;
        const sort = this.state.sort;
        // Get level from GlobalState
        const globalLevel = GlobalState.get('level') || 'ALL';

        // Filter courses
        let results = Object.entries(this.state.courses).map(([id, data]) => ({ id, ...data }));

        // 1. Search Filter
        if (search) {
            results = results.filter(
                (c) => c.title.toLowerCase().includes(search) || c.category.toLowerCase().includes(search),
            );
        }

        // 2. Level Filter (Global)
        if (globalLevel !== 'ALL') {
            results = results.filter((c) => {
                const cLevels = Array.isArray(c.level) ? c.level : [c.level || 'GENERAL'];

                // Allow GENERAL courses for everyone
                if (cLevels.includes('GENERAL')) return true;

                // Exact match (Strict segregation)
                if (cLevels.includes(globalLevel)) return true;

                return false;
            });
        }

        if (results.length === 0) {
            container.innerHTML = `
                <div class="no-results" style="text-align:center; padding:64px; color:var(--text-secondary); opacity:0.6;">
                    <i class="ri-search-eye-line" style="font-size:3rem; margin-bottom:16px; display:block;"></i>
                    <p>${escapeHTML(t('library.noResults'))}</p>
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
    }

    renderSimpleGrid(container, courses) {
        const listContainer = document.createElement('div');
        listContainer.className = 'library-list';
        courses.forEach((c) => listContainer.appendChild(this.createCourseListItem(c)));
        container.appendChild(listContainer);
    }

    renderGroupedByLevel(container, courses) {
        const levels = { BI: [], BP: [], BPC: [], TREUIL: [], GENERAL: [] };
        courses.forEach((c) => {
            const l = Array.isArray(c.level) ? c.level : [c.level || 'GENERAL'];
            l.forEach((levelKey) => {
                if (levels[levelKey]) levels[levelKey].push(c);
                else levels['GENERAL'].push(c); // Fallback
            });
        });

        ['BI', 'BP', 'BPC', 'TREUIL', 'GENERAL'].forEach((lKey) => {
            if (levels[lKey].length === 0) return;

            const section = document.createElement('div');
            section.className = 'library-section';
            section.innerHTML = `<h3 class="library-section-header level-header level-${lKey}"><i class="ri-bookmark-3-fill"></i> ${this.getLevelName(lKey)}</h3>`;

            // USE LIST CONTAINER
            const listContainer = document.createElement('div');
            listContainer.className = 'library-list';

            levels[lKey].forEach((c) => listContainer.appendChild(this.createCourseCard(c)));
            section.appendChild(listContainer);
            container.appendChild(section);
        });
    }

    renderGroupedByCategory(container, courses) {
        // Group courses by category using modern ES2024 Object.groupBy
        const categories = Object.groupBy
            ? Object.groupBy(courses, (c) => c.category || 'Autre')
            : courses.reduce((acc, c) => {
                  const cat = c.category || 'Autre';
                  (acc[cat] = acc[cat] || []).push(c);
                  return acc;
              }, {});

        // Get all unique categories and sort them immutably
        const sortedCategories = toSorted(Object.keys(categories), (a, b) => {
            // Put 'Général' or 'GENERAL' first, 'Autre' last
            if (a.toLowerCase().includes('général') || a === 'GENERAL') return -1;
            if (b.toLowerCase().includes('général') || b === 'GENERAL') return 1;
            if (a === 'Autre') return 1;
            if (b === 'Autre') return -1;
            return a.localeCompare(b);
        });

        sortedCategories.forEach((cat) => {
            const catCourses = categories[cat] || [];
            if (catCourses.length === 0) return;

            const section = document.createElement('div');
            section.className = 'library-section';
            section.innerHTML = `<h3 class="library-section-header"><i class="ri-archive-line"></i> ${escapeHTML(cat)}</h3>`;

            const listContainer = document.createElement('div');
            listContainer.className = 'library-list';

            // Sort courses within each category by title
            const sortedInCat = toSorted(catCourses, (a, b) => (a.title || '').localeCompare(b.title || ''));

            sortedInCat.forEach((c) => listContainer.appendChild(this.createCourseListItem(c)));

            section.appendChild(listContainer);
            container.appendChild(section);
        });
    }

    assignTheme(c) {
        // Logic removed: We now use the 'category' property directly from courses_data.js
        return c.category || 'Autre';
    }

    createCourseListItem(c) {
        const btn = document.createElement('div');
        btn.className = 'library-list-item';
        btn.setAttribute('role', 'button');
        btn.setAttribute('tabindex', '0');
        btn.setAttribute('aria-label', t('library.openCourse', { title: c.title || '' }));

        const handleOpen = () => this.openCourse(c.id);
        btn.addEventListener('click', handleOpen);
        btn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleOpen();
            }
        });

        let levelBadges = '';
        const levels = Array.isArray(c.level) ? c.level : [c.level || 'GENERAL'];
        levels.forEach((l) => {
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
                <div class="list-item-action" aria-hidden="true">
                    <i class="ri-arrow-right-s-line"></i>
                </div>
            </div>
        `;
        return btn;
    }

    // Legacy support for grid (unused in CATEGORY view but kept for others if needed)
    createCourseCard(c) {
        return this.createCourseListItem(c); // Redirect to list view globally for consistency
    }

    openCourse(courseId) {
        const course = this.state.courses[courseId];
        if (!course) return console.error('Course not found:', courseId);

        console.log('Opening course PDF:', course.title);

        // PREFER ORIGINAL PDF IF AVAILABLE (skips modernized HTML)
        let targetUrl = course.original_pdf || course.pdf;
        if (targetUrl) {
            targetUrl = targetUrl.normalize('NFC');
        }

        // Nouvel onglet (sans lien avec la page) ; application installée : visionneuse avec bouton « Retour »
        openLink(targetUrl);
    }

    formatTitle(title) {
        return escapeHTML(title || '');
    }

    getLevelName(l) {
        return FR.library.levels[l] || l;
    }

    async mount(params) {
        await super.mount(params);
        console.log('Mounting LibraryView with params', params);
        try {
            if (this.init) {
                this.init();
            }

            // Auto-update library when level changes
            this._unsubscribeLevel = GlobalState.subscribe('level', () => {
                if (this.render) {
                    const libraryScreen = document.getElementById('library-screen');
                    if (libraryScreen && libraryScreen.classList.contains('active')) {
                        this.render();
                    }
                }
            });

            if (this.show) {
                this.show();
            }

            this._handleSearchInput = (e) => this.updateSearch(e.target.value);
            const searchInput = document.getElementById('library-search');
            if (searchInput) searchInput.addEventListener('input', this._handleSearchInput);
        } catch (e) {
            console.error('Erreur de montage de LibraryView', e);
            super.renderErrorState(e.message || t('library.loadError'), 'library-screen');
        }
    }

    async unmount() {
        await super.unmount();
        console.log('Unmounting LibraryView');
        if (this._unsubscribeLevel) {
            this._unsubscribeLevel();
            this._unsubscribeLevel = null;
        }
        const searchInput = document.getElementById('library-search');
        if (searchInput && this._handleSearchInput) searchInput.removeEventListener('input', this._handleSearchInput);
        document.getElementById('library-screen').classList.remove('active');
    }
} // Ends class

const LibraryEngine = new LibraryViewClass();
window.LibraryEngine = LibraryEngine;

export default LibraryEngine;
