SitesEngine.setupDropdowns = function () {
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.filter-dropdown-container')) {
                document.querySelectorAll('.filter-dropdown-menu.show').forEach(m => m.classList.remove('show'));
            }
        });
        this.renderDropdowns();
    };

SitesEngine.renderDropdowns = function () {
        const winds = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
        const types = [
            { id: 'ATTERRO', label: 'Atterrissage' },
            { id: 'NATUREL', label: 'Site Naturel' },
            { id: 'DUNE', label: 'Dune' },
            { id: 'TREUIL', label: 'Piste de Treuil' },
            { id: 'GONFLAGE', label: 'Gonflage' }
        ];

        const windMenu = document.getElementById('menu-wind');
        if (windMenu) {
            windMenu.innerHTML = winds.map(w => {
                let stateName = 'neutral';
                let iconClass = 'ri-checkbox-blank-line';
                if (this.state.filterWindInclude.includes(w)) {
                    stateName = 'include';
                    iconClass = 'ri-checkbox-fill';
                } else if (this.state.filterWindExclude.includes(w)) {
                    stateName = 'exclude';
                    iconClass = 'ri-close-box-fill';
                }
                return `
                    <label class="filter-option state-${stateName}" onclick="event.stopPropagation(); SitesEngine.cycleFilterState('wind', '${w}')">
                        <span class="custom-filter-icon"><i class="${iconClass}"></i></span>
                        <span class="filter-label">${w}</span>
                    </label>
                `;
            }).join('');
        }

        const typeMenu = document.getElementById('menu-type');
        if (typeMenu) {
            typeMenu.innerHTML = types.map(t => {
                let stateName = 'neutral';
                let iconClass = 'ri-checkbox-blank-line';
                if (this.state.filterTypeInclude.includes(t.id)) {
                    stateName = 'include';
                    iconClass = 'ri-checkbox-fill';
                } else if (this.state.filterTypeExclude.includes(t.id)) {
                    stateName = 'exclude';
                    iconClass = 'ri-close-box-fill';
                }
                return `
                    <label class="filter-option state-${stateName}" onclick="event.stopPropagation(); SitesEngine.cycleFilterState('type', '${t.id}')">
                        <span class="custom-filter-icon"><i class="${iconClass}"></i></span>
                        <span class="filter-label">${t.label}</span>
                    </label>
                `;
            }).join('');
        }
    };

SitesEngine.cycleFilterState = function (category, value) {
        if (category === 'wind') {
            const isInclude = this.state.filterWindInclude.includes(value);
            const isExclude = this.state.filterWindExclude.includes(value);

            if (!isInclude && !isExclude) {
                // State 0 (Neutral) -> State 1 (Include)
                this.state.filterWindInclude.push(value);
            } else if (isInclude) {
                // State 1 (Include) -> State 2 (Exclude)
                this.state.filterWindInclude = this.state.filterWindInclude.filter(w => w !== value);
                this.state.filterWindExclude.push(value);
            } else {
                // State 2 (Exclude) -> State 0 (Neutral)
                this.state.filterWindExclude = this.state.filterWindExclude.filter(w => w !== value);
            }
            this.state.filterWind = this.state.filterWindInclude;
        } else if (category === 'type') {
            const isInclude = this.state.filterTypeInclude.includes(value);
            const isExclude = this.state.filterTypeExclude.includes(value);

            if (!isInclude && !isExclude) {
                // State 0 (Neutral) -> State 1 (Include)
                this.state.filterTypeInclude.push(value);
            } else if (isInclude) {
                // State 1 (Include) -> State 2 (Exclude)
                this.state.filterTypeInclude = this.state.filterTypeInclude.filter(t => t !== value);
                this.state.filterTypeExclude.push(value);
            } else {
                // State 2 (Exclude) -> State 0 (Neutral)
                this.state.filterTypeExclude = this.state.filterTypeExclude.filter(t => t !== value);
            }
            this.state.filterType = this.state.filterTypeInclude;
        }

        this.updateBadges();
        this.renderDropdowns();
        this.renderList();
        if (this.state.map) {
            this.updateMapMarkers();
        }
    };

SitesEngine.toggleDropdown = function (type) {
        const menu = document.getElementById('menu-' + type);
        document.querySelectorAll('.filter-dropdown-menu.show').forEach(m => {
            if (m !== menu) m.classList.remove('show');
        });
        if (menu) menu.classList.toggle('show');
    };

SitesEngine.toggleFilter = function (category, value, isChecked) {
        // Legacy toggleFilter wrapper for external callers
        if (isChecked) {
            if (category === 'wind') {
                this.state.filterWindExclude = this.state.filterWindExclude.filter(w => w !== value);
                if (!this.state.filterWindInclude.includes(value)) this.state.filterWindInclude.push(value);
                this.state.filterWind = this.state.filterWindInclude;
            } else {
                this.state.filterTypeExclude = this.state.filterTypeExclude.filter(t => t !== value);
                if (!this.state.filterTypeInclude.includes(value)) this.state.filterTypeInclude.push(value);
                this.state.filterType = this.state.filterTypeInclude;
            }
        } else {
            if (category === 'wind') {
                this.state.filterWindInclude = this.state.filterWindInclude.filter(w => w !== value);
                this.state.filterWindExclude = this.state.filterWindExclude.filter(w => w !== value);
                this.state.filterWind = this.state.filterWindInclude;
            } else {
                this.state.filterTypeInclude = this.state.filterTypeInclude.filter(t => t !== value);
                this.state.filterTypeExclude = this.state.filterTypeExclude.filter(t => t !== value);
                this.state.filterType = this.state.filterTypeInclude;
            }
        }
        this.updateBadges();
        this.renderDropdowns();
        this.renderList();
        if (this.state.map) {
            this.updateMapMarkers();
        }
    };

SitesEngine.updateBadges = function () {
        const badgeWind = document.getElementById('badge-wind');
        const badgeType = document.getElementById('badge-type');

        const activeWindsCount = this.state.filterWindInclude.length + this.state.filterWindExclude.length;
        const activeTypesCount = this.state.filterTypeInclude.length + this.state.filterTypeExclude.length;

        if (badgeWind) {
            badgeWind.textContent = activeWindsCount;
            badgeWind.classList.toggle('active', activeWindsCount > 0);
        }
        if (badgeType) {
            badgeType.textContent = activeTypesCount;
            badgeType.classList.toggle('active', activeTypesCount > 0);
        }
    };

SitesEngine.filterByTag = function (wind) {
        // Force the wind to "Include" state and remove from "Exclude" state
        this.state.filterWindExclude = this.state.filterWindExclude.filter(w => w !== wind);
        if (!this.state.filterWindInclude.includes(wind)) {
            this.state.filterWindInclude.push(wind);
        }
        this.state.filterWind = this.state.filterWindInclude;

        this.updateBadges();
        this.renderDropdowns();
        this.renderList();
        if (this.state.map) {
            this.updateMapMarkers();
        }

        const screen = document.getElementById('sites-screen');
        if (screen) screen.scrollTo({ top: 0, behavior: 'smooth' });
    };

SitesEngine.changeSortMode = function (mode) {
        this.state.sortMode = mode;

        const strategyPanel = document.getElementById('conditions-strategy-panel');
        if (strategyPanel) {
            strategyPanel.style.display = (mode === 'CONDITIONS') ? 'flex' : 'none';
        }

        if (mode === 'DISTANCE') {
            if (this.state.userLocation) {
                this.renderList();
                if (this.state.map) {
                    this.updateMapMarkers();
                }
            } else {
                this.requestGpsLocation();
            }
        } else {
            this.renderList();
            if (this.state.map) {
                this.updateMapMarkers();
            }
        }
    };

SitesEngine.geocodeAddress = function (query) {
    if (!query || query.trim() === '') {
        alert("Veuillez saisir une adresse ou une ville.");
        return;
    }

    const statusEl = document.getElementById('address-status-message');
    const gpsBtn = document.getElementById('btn-use-gps');
    
    if (statusEl) {
        statusEl.innerHTML = `<i class="ri-loader-4-line" style="animation: spin 1s linear infinite;"></i> Recherche de l'adresse...`;
        statusEl.style.color = 'var(--text-muted)';
    }

    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`)
        .then(res => res.json())
        .then(data => {
            if (data && data.length > 0) {
                const result = data[0];
                const lat = parseFloat(result.lat);
                const lng = parseFloat(result.lon);
                
                // Clear cached distances on sites data to force recalculation with new reference coordinates
                if (typeof SITES_DATA !== 'undefined' && Array.isArray(SITES_DATA)) {
                    SITES_DATA.forEach(s => { delete s.distance; });
                }

                this.state.userLocation = { lat, lng };

                if (statusEl) {
                    statusEl.innerHTML = `<i class="ri-checkbox-circle-line" style="color: var(--accent-green);"></i> Localisé : ${result.display_name}`;
                    statusEl.style.color = 'var(--accent-green)';
                }
                if (gpsBtn) {
                    gpsBtn.style.borderColor = '';
                    gpsBtn.style.color = '';
                }

                this.renderList();
                if (this.state.map) {
                    this.updateMapMarkers();
                    this.state.map.setView([lat, lng], 10);
                }
            } else {
                if (statusEl) {
                    statusEl.innerHTML = `<i class="ri-error-warning-line" style="color: var(--accent-red);"></i> Adresse non trouvée.`;
                    statusEl.style.color = 'var(--accent-red)';
                }
            }
        })
        .catch(err => {
            console.error("Geocoding error:", err);
            if (statusEl) {
                statusEl.innerHTML = `<i class="ri-error-warning-line" style="color: var(--accent-red);"></i> Erreur de connexion au service.`;
                statusEl.style.color = 'var(--accent-red)';
            }
        });
};

SitesEngine.changeStrategy = function (strategy) {
        this.state.conditionsStrategy = strategy;

        const strategies = ['CONSECUTIVE', 'HALF_DAY', 'DAILY', 'TOTAL'];
        strategies.forEach(s => {
            const btn = document.getElementById(`strat-${s}`);
            if (btn) {
                if (s === strategy) {
                    btn.classList.add('active');
                    btn.style.background = 'rgba(14,165,233,0.15)';
                    btn.style.borderColor = 'rgba(14,165,233,0.3)';
                    btn.style.color = 'var(--accent-blue)';
                } else {
                    btn.classList.remove('active');
                    btn.style.background = 'rgba(255,255,255,0.03)';
                    btn.style.borderColor = 'var(--border-color)';
                    btn.style.color = 'var(--text-secondary)';
                }
            }
        });

        this.renderList();
        if (this.state.mapExpanded) {
            this.updateMapMarkers();
        }
    };

SitesEngine.calculateDistance = function (lat1, lon1, lat2, lon2) {
        const R = 6371; // Rayon de la Terre en km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // Distance en km
    };

SitesEngine.updateWindLimits = function () {
        const minVal = parseFloat(document.getElementById('limit-wind-min').value) || 0;
        const maxVal = parseFloat(document.getElementById('limit-wind-max').value) || 25;
        const deltaVal = parseFloat(document.getElementById('limit-gust-delta').value) || 10;
        this.state.limitWindMin = minVal;
        this.state.limitWindMax = maxVal;
        this.state.limitGustDelta = deltaVal;
        this.renderList();
        if (this.state.mapExpanded) this.updateMapMarkers();
    };

SitesEngine.toggleHideUnflyable = function (checked) {
        this.state.hideUnflyable = checked;
        this.renderList();
        if (this.state.mapExpanded) this.updateMapMarkers();
    };

SitesEngine.updateForecastLabel = function () {
        const label = document.getElementById('forecast-time-label');
        if (!label) return;

        const offset = this.state.forecastOffset;
        if (offset === 0) {
            label.textContent = "Maintenant";
            return;
        }

        // Find forecast time from first active site
        const firstActiveSite = SITES_DATA.find(s => s.affiche !== false);
        const firstSiteId = firstActiveSite?.id;
        const forecasts = firstSiteId ? this.state.weatherForecasts[firstSiteId] : null;
        if (forecasts && forecasts[offset]) {
            const date = new Date(forecasts[offset].time);
            const days = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
            const dayName = days[date.getDay()];
            const hour = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            label.textContent = `+${offset}h (${dayName} ${hour}:${minutes})`;
        } else {
            label.textContent = `+${offset}h`;
        }
    };

SitesEngine.setForecastOffset = function (value) {
        const offset = parseInt(value);
        if (isNaN(offset)) return;
        this.state.forecastOffset = offset;

        // Synchronize HTML range slider position in the DOM
        const slider = document.getElementById('forecast-slider');
        if (slider) {
            slider.value = offset;
        }

        this.updateForecastLabel();
        this.renderList();
        if (this.state.mapExpanded) {
            this.updateMapMarkers();
        }
    };

SitesEngine.setRadiusLimit = function (value) {
        const radius = parseInt(value);
        if (isNaN(radius)) return;
        this.state.radiusLimit = radius;

        const slider = document.getElementById('radius-slider');
        if (slider) {
            slider.value = radius;
        }

        const label = document.getElementById('radius-val-label');
        if (label) {
            label.textContent = radius === 210 ? 'Illimité' : `${radius} km`;
        }

        this.renderList();
        if (this.state.mapExpanded) {
            this.updateMapMarkers();
        }
    };

SitesEngine.isFieldFilled = function (val) {
        if (val === null || val === undefined) return false;
        if (typeof val !== 'string') return !!val;
        const cleaned = val.trim().toLowerCase();
        if (cleaned === '' || cleaned === '-' || cleaned === '--') return false;
        
        const placeholders = [
            'non renseigné', 'non renseigne',
            'ras', 'r.a.s.', 'r.a.s', 'rien',
            'néant', 'neant', 'n/a', 'na',
            'aucun', 'aucun danger', 'aucun danger particulier', 'aucun danger signalé', 'aucun danger signale'
        ];
        return !placeholders.includes(cleaned);
    };