import re

with open('/Volumes/maximeurbaniak/TheorieParapente/js/sites_engine.js', 'r') as f:
    content = f.read()

# 1. Update state
content = re.sub(
    r"state: \{.*?currentSiteCoords: null\s+\},",
    "state: {\n        filterWind: [], // Array of selected winds\n        filterType: [], // Array of selected types\n        currentSiteCoords: null\n    },",
    content,
    flags=re.DOTALL
)

# 2. Add setupDropdowns & initialized to init/show
content = re.sub(
    r"show: function \(\) \{\s+this\.renderList\(\);\s+\},",
    "show: function () {\n        if (!this.initialized) {\n            this.setupDropdowns();\n            this.initialized = true;\n        }\n        this.renderList();\n    },",
    content
)

# 3. Replace all the old sort/filter functions (setSortMode, setWindFilter, setTypeFilter, filterByTag)
old_funcs_pattern = r"setSortMode: function\(mode\).*?filterByTag: function\(wind\) \{[^\}]+screen\.scrollTo[^\}]+?\}\},"
replacement_funcs = """setupDropdowns: function() {
        const winds = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
        const types = [
            {id: 'NATUREL', label: 'Site Naturel'},
            {id: 'DUNE', label: 'Dune'},
            {id: 'TREUIL', label: 'Piste de Treuil'}
        ];

        const windMenu = document.getElementById('menu-wind');
        if (windMenu) {
            windMenu.innerHTML = winds.map(w => `
                <label class="filter-option" onclick="event.stopPropagation()">
                    <input type="checkbox" class="filter-checkbox" value="${w}" onchange="SitesEngine.toggleFilter('wind', this.value, this.checked)">
                    <span class="filter-label">${w}</span>
                </label>
            `).join('');
        }

        const typeMenu = document.getElementById('menu-type');
        if (typeMenu) {
            typeMenu.innerHTML = types.map(t => `
                <label class="filter-option" onclick="event.stopPropagation()">
                    <input type="checkbox" class="filter-checkbox" value="${t.id}" onchange="SitesEngine.toggleFilter('type', this.value, this.checked)">
                    <span class="filter-label">${t.label}</span>
                </label>
            `).join('');
        }

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.filter-dropdown-container')) {
                document.querySelectorAll('.filter-dropdown-menu.show').forEach(m => m.classList.remove('show'));
            }
        });
    },

    toggleDropdown: function(type) {
        const menu = document.getElementById('menu-' + type);
        document.querySelectorAll('.filter-dropdown-menu.show').forEach(m => {
            if (m !== menu) m.classList.remove('show');
        });
        if (menu) menu.classList.toggle('show');
    },

    toggleFilter: function(category, value, isChecked) {
        let arr = category === 'wind' ? this.state.filterWind : this.state.filterType;
        
        if (isChecked) {
            if (!arr.includes(value)) arr.push(value);
        } else {
            arr = arr.filter(v => v !== value);
        }

        if (category === 'wind') this.state.filterWind = arr;
        else this.state.filterType = arr;

        this.updateBadges();
        this.renderList();
    },

    updateBadges: function() {
        const badgeWind = document.getElementById('badge-wind');
        const badgeType = document.getElementById('badge-type');

        if (badgeWind) {
            badgeWind.textContent = this.state.filterWind.length;
            badgeWind.classList.toggle('active', this.state.filterWind.length > 0);
        }
        if (badgeType) {
            badgeType.textContent = this.state.filterType.length;
            badgeType.classList.toggle('active', this.state.filterType.length > 0);
        }
    },

    filterByTag: function(wind) {
        // Toggle the wind checkbox programmatically
        const checkboxes = document.querySelectorAll('#menu-wind .filter-checkbox');
        checkboxes.forEach(cb => {
            if (cb.value === wind && !cb.checked) {
                cb.checked = true;
                this.toggleFilter('wind', wind, true);
            }
        });
        const screen = document.getElementById('sites-screen');
        if (screen) screen.scrollTo({top: 0, behavior: 'smooth'});
    },"""

content = re.sub(old_funcs_pattern, replacement_funcs, content, flags=re.DOTALL)

# 4. Update renderList filtering logic
render_logic_pattern = r"// Filtrage par vent.*?// Tri A-Z.*?sites\.sort\(\(a, b\) => a\.nom\.localeCompare\(b\.nom\)\);\s+\}"
new_render_logic = """// Filtrage par vent
            if (this.state.filterWind && this.state.filterWind.length > 0) {
                sites = sites.filter(site => {
                    return site.orientations_vent.some(w => this.state.filterWind.includes(w));
                });
            }

            // Filtrage par type
            if (this.state.filterType && this.state.filterType.length > 0) {
                sites = sites.filter(site => this.state.filterType.includes(site.type));
            }

            // Tri par défaut (A-Z)
            sites.sort((a, b) => a.nom.localeCompare(b.nom));"""

content = re.sub(render_logic_pattern, new_render_logic, content, flags=re.DOTALL)

with open('/Volumes/maximeurbaniak/TheorieParapente/js/sites_engine.js', 'w') as f:
    f.write(content)
