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

        const mapMenu = document.getElementById('menu-map-settings');
        if (mapMenu) {
            const maps = [
                { id: 'leaflet', label: 'Cartographie', icon: 'ri-map-2-line' },
                { id: 'windy', label: 'Windy', icon: 'ri-windy-line' },
                { id: 'meteoparapente', label: 'Météo-Parapente', icon: 'ri-temp-hot-line' },
                { id: 'paraglidingearth', label: 'PG Earth', icon: 'ri-earth-line' },
                { id: 'paraglidable', label: 'Paraglidable', icon: 'ri-flight-takeoff-line' },
                { id: 'isofronts', label: 'Fronts & Isobares', icon: 'ri-cloud-line' }
            ];

            mapMenu.innerHTML = maps.map(m => {
                const isActive = this.state.activeMapLayers.includes(m.id);
                const iconClass = isActive ? 'ri-checkbox-fill' : 'ri-checkbox-blank-line';
                return `
                    <label class="filter-option" style="cursor:pointer;" onclick="event.stopPropagation(); SitesEngine.toggleMapLayer('${m.id}')">
                        <span class="custom-filter-icon"><i class="${iconClass}"></i></span>
                        <span class="filter-label" style="display:flex; align-items:center; gap:8px;"><i class="${m.icon}"></i> ${m.label}</span>
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
        this.savePreferences();
        this.renderList();
        if (this.state.map) {
            this.updateMapMarkers();
        }
    };

SitesEngine.toggleMapLayer = function (layerId) {
    const idx = this.state.activeMapLayers.indexOf(layerId);
    if (idx >= 0) {
        this.state.activeMapLayers.splice(idx, 1);
    } else {
        this.state.activeMapLayers.push(layerId);
    }
    
    // Fallback: If no maps are active, activate leaflet by default
    if (this.state.activeMapLayers.length === 0) {
        this.state.activeMapLayers.push('leaflet');
    }
    
    // Save to preferences and cloud
    this.savePreferences();
    
    // Update map buttons visibility
    this.updateMapTogglesVisibility();
    
    // Re-render the dropdown menu
    this.renderDropdowns();
    
    // If the currently active map was hidden, switch back to leaflet (or the first available)
    const currentMode = Object.keys(this.expandedSites).length > 0 ? 'leaflet' : (document.getElementById(`sites-${this.state.weatherModel}-canvas`) ? this.state.weatherModel : 'leaflet'); // Need to actually check the active tab, but since we don't store the current map tab explicitly in state outside of UI classes, we just force to leaflet.
    // Let's rely on switchMapMode
    if (!this.state.activeMapLayers.includes('leaflet')) {
        // If leaflet is disabled and we were on it... well, leaflet should probably be mandatory but let's allow anything.
    }
};

SitesEngine.updateMapTogglesVisibility = function () {
    const maps = ['leaflet', 'windy', 'meteoparapente', 'paraglidingearth', 'paraglidable', 'isofronts'];
    let firstVisible = null;
    
    maps.forEach(m => {
        const btn = document.getElementById(`map-toggle-${m}`);
        if (btn) {
            if (this.state.activeMapLayers.includes(m)) {
                btn.style.display = '';
                if (!firstVisible) firstVisible = m;
            } else {
                btn.style.display = 'none';
            }
        }
    });
    
    // Check if the currently active tab is hidden, if so, switch to first visible
    maps.forEach(m => {
        const btn = document.getElementById(`map-toggle-${m}`);
        if (btn && btn.classList.contains('action-btn-primary') && btn.style.display === 'none') {
            if (firstVisible) {
                this.switchMapMode(firstVisible);
            }
        }
    });
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
        this.savePreferences();
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
        this.savePreferences();
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
    const inputEl = document.getElementById('address-input');
    const gpsBtn = document.getElementById('btn-use-gps');
    const btnSave = document.getElementById('btn-save-location');
    
    if (statusEl) {
        statusEl.innerHTML = `<i class="ri-loader-4-line" style="animation: spin 1s linear infinite;"></i> Recherche de l'adresse...`;
        statusEl.style.color = 'var(--text-muted)';
    }

    // Fetch up to 15 candidates with address details to check country codes
    fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(query)}&limit=15`)
        .then(res => res.json())
        .then(data => {
            if (data && data.length > 0) {
                // Rank logic: 
                // 1 = France (fr)
                // 2 = Bordering countries (be, lu, de, ch, it, es, ad, mc)
                // 3 = Other countries
                const getCountryRank = (item) => {
                    let cc = (item.address && item.address.country_code) ? item.address.country_code.toLowerCase() : '';
                    if (!cc && item.display_name) {
                        const nameLower = item.display_name.toLowerCase();
                        if (nameLower.includes('france')) {
                            cc = 'fr';
                        } else if (nameLower.includes('belgique') || nameLower.includes('belgium') || nameLower.includes('belgië')) {
                            cc = 'be';
                        } else if (nameLower.includes('luxembourg')) {
                            cc = 'lu';
                        } else if (nameLower.includes('deutschland') || nameLower.includes('germany') || nameLower.includes('allemagne')) {
                            cc = 'de';
                        } else if (nameLower.includes('schweiz') || nameLower.includes('switzerland') || nameLower.includes('suisse')) {
                            cc = 'ch';
                        } else if (nameLower.includes('italia') || nameLower.includes('italy') || nameLower.includes('italie')) {
                            cc = 'it';
                        } else if (nameLower.includes('españa') || nameLower.includes('spain') || nameLower.includes('espagne')) {
                            cc = 'es';
                        } else if (nameLower.includes('andorra') || nameLower.includes('andorre')) {
                            cc = 'ad';
                        } else if (nameLower.includes('monaco')) {
                            cc = 'mc';
                        }
                    }
                    if (cc === 'fr') return 1;
                    if (['be', 'lu', 'de', 'ch', 'it', 'es', 'ad', 'mc'].includes(cc)) return 2;
                    return 3;
                };

                // Stable sort prioritizing French and bordering countries' locations
                const mapped = data.map((item, idx) => ({ item, idx, rank: getCountryRank(item) }));
                mapped.sort((a, b) => {
                    if (a.rank !== b.rank) {
                        return a.rank - b.rank;
                    }
                    return a.idx - b.idx;
                });

                const result = mapped[0].item;
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
                if (btnSave) btnSave.style.display = 'inline-block';
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
        
        this.savePreferences();
        this.renderList();
        if (this.state.mapExpanded) this.updateMapMarkers();
    };

SitesEngine.toggleHideUnflyable = function (checked) {
        this.state.hideUnflyable = checked;
        this.savePreferences();
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
            const maxVal = parseInt(slider.max) || 120;
            const percentage = maxVal > 0 ? (offset / maxVal) * 100 : 0;
            slider.style.background = `linear-gradient(to right, var(--accent-blue) 0%, var(--accent-blue) ${percentage}%, rgba(255,255,255,0.1) ${percentage}%, rgba(255,255,255,0.1) 100%)`;
        }

        this.updateForecastLabel();
        this.renderList();
        if (this.state.mapExpanded) {
            this.updateMapMarkers();
        }
    };

SitesEngine.saveCurrentLocation = function() {
    if (!this.state.userLocation) return;
    const inputEl = document.getElementById('address-input');
    const name = inputEl.value || (inputEl.placeholder !== 'Adresse ou ville (ex: Annecy, Gourdon)...' ? inputEl.placeholder : 'Nouveau lieu');
    const newLoc = {
        name: name,
        lat: this.state.userLocation.lat,
        lng: this.state.userLocation.lng
    };
    
    // Check if it already exists by name or coordinates
    const exists = this.state.userPreferences.savedLocations.some(l => 
        l.name === name || (Math.abs(l.lat - newLoc.lat) < 0.001 && Math.abs(l.lng - newLoc.lng) < 0.001)
    );
    
    if (!exists) {
        this.state.userPreferences.savedLocations.push(newLoc);
        this.savePreferences();
        this.renderSavedLocations();
    }
};

SitesEngine.loadSavedLocation = function(index) {
    const loc = this.state.userPreferences.savedLocations[index];
    if (loc) {
        this.state.userLocation = { lat: loc.lat, lng: loc.lng, name: loc.name };
        document.getElementById('address-input').value = loc.name;
        document.getElementById('address-input').placeholder = "Adresse ou ville (ex: Annecy, Gourdon)...";
        document.getElementById('address-status-message').innerHTML = '<i class="ri-check-line"></i> Lieu favori chargé';
        const btnSave = document.getElementById('btn-save-location');
        if (btnSave) btnSave.style.display = 'inline-block';
        
        this.renderList();
        if (this.state.mapExpanded) this.updateMapMarkers();
    }
};

SitesEngine.removeSavedLocation = function(index) {
    this.state.userPreferences.savedLocations.splice(index, 1);
    this.savePreferences();
    this.renderSavedLocations();
};

SitesEngine.renderSavedLocations = function() {
    const container = document.getElementById('saved-locations-list');
    if (!container) return;
    
    const locations = this.state.userPreferences.savedLocations || [];
    container.innerHTML = '';
    
    locations.forEach((loc, index) => {
        const pill = document.createElement('div');
        pill.style.cssText = 'background: rgba(14,165,233,0.15); border: 1px solid rgba(14,165,233,0.3); color: var(--accent-blue); padding: 4px 8px; border-radius: 12px; font-size: 0.8rem; display: flex; align-items: center; gap: 4px; cursor: pointer;';
        
        const label = document.createElement('span');
        label.textContent = loc.name;
        label.onclick = () => this.loadSavedLocation(index);
        
        const btnRemove = document.createElement('i');
        btnRemove.className = 'ri-close-line';
        btnRemove.style.cursor = 'pointer';
        btnRemove.style.fontSize = '1rem';
        btnRemove.onclick = (e) => {
            e.stopPropagation();
            this.removeSavedLocation(index);
        };
        
        pill.appendChild(label);
        pill.appendChild(btnRemove);
        container.appendChild(pill);
    });
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

        this.savePreferences();
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

// Scroll to top button logic
SitesEngine.initScrollLogic = function() {
    const screen = document.getElementById('sites-screen');
    if (screen) {
        screen.addEventListener('scroll', function() {
            const btn = document.getElementById('btn-back-to-top');
            if (btn) {
                if (this.scrollTop > 100) {
                    btn.classList.add('show');
                } else {
                    btn.classList.remove('show');
                }
            }
            
            // JS fallback for broken CSS position: sticky on mobile Safari/Chrome
            const stickyContainer = document.querySelector('.forecast-sticky-container');
            if (stickyContainer) {
                if (window.innerWidth <= 768) {
                    // Mobile: apply JS fixed positioning
                    // 150px is roughly when the container reaches the header
                    if (this.scrollTop > 150) { 
                        if (!stickyContainer.classList.contains('js-fixed')) {
                            const parent = stickyContainer.parentElement;
                            const rect = parent.getBoundingClientRect();
                            const style = window.getComputedStyle(parent);
                            const paddingLeft = parseFloat(style.paddingLeft);
                            const paddingRight = parseFloat(style.paddingRight);
                            
                            // Create placeholder to prevent content jump and remember original position
                            let placeholder = document.getElementById('sticky-placeholder');
                            if (!placeholder) {
                                placeholder = document.createElement('div');
                                placeholder.id = 'sticky-placeholder';
                                placeholder.style.height = stickyContainer.offsetHeight + 'px';
                                placeholder.style.marginBottom = window.getComputedStyle(stickyContainer).marginBottom;
                                parent.insertBefore(placeholder, stickyContainer);
                            }
                            
                            stickyContainer.style.width = (rect.width - paddingLeft - paddingRight) + 'px';
                            stickyContainer.style.left = (rect.left + paddingLeft) + 'px';
                            stickyContainer.classList.add('js-fixed');
                            
                            // Move to body to completely escape any CSS transform/stacking context bugs
                            if (stickyContainer.parentNode !== document.body) {
                                document.body.appendChild(stickyContainer);
                            }
                        }
                    } else {
                        stickyContainer.classList.remove('js-fixed');
                        stickyContainer.style.width = '';
                        stickyContainer.style.left = '';
                        
                        const placeholder = document.getElementById('sticky-placeholder');
                        if (placeholder) {
                            // Restore original position
                            if (stickyContainer.parentNode === document.body) {
                                placeholder.parentNode.insertBefore(stickyContainer, placeholder);
                            }
                            placeholder.remove();
                        }
                    }
                } else {
                    // Desktop: rely on native CSS sticky
                    if (stickyContainer.classList.contains('js-fixed')) {
                        stickyContainer.classList.remove('js-fixed');
                        stickyContainer.style.width = '';
                        stickyContainer.style.left = '';
                        
                        const placeholder = document.getElementById('sticky-placeholder');
                        if (placeholder) {
                            // Restore original position
                            if (stickyContainer.parentNode === document.body) {
                                placeholder.parentNode.insertBefore(stickyContainer, placeholder);
                            }
                            placeholder.remove();
                        }
                    }
                }
            }
        });
    }
};

SitesEngine.scrollToTop = function() {
    const screen = document.getElementById('sites-screen');
    if (screen) {
        screen.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

// Initialize scroll logic when script loads
document.addEventListener('DOMContentLoaded', () => {
    SitesEngine.initScrollLogic();
});

// User Preferences Management

SitesEngine.toggleFavorite = function(siteId) {
    if (!this.state.userPreferences) this.state.userPreferences = { pilotLevel: 'ALL', favoriteSites: [], minimizedSites: [] };
    const idx = this.state.userPreferences.favoriteSites.indexOf(siteId);
    if (idx > -1) {
        this.state.userPreferences.favoriteSites.splice(idx, 1);
    } else {
        this.state.userPreferences.favoriteSites.push(siteId);
    }
    
    this.savePreferences();
    this.renderList();
    if (this.state.mapExpanded) this.updateMapMarkers();
};

SitesEngine.toggleMinimize = function(siteId) {
    if (!this.state.userPreferences) this.state.userPreferences = { pilotLevel: 'ALL', favoriteSites: [], minimizedSites: [] };
    if (!this.state.userPreferences.minimizedSites) this.state.userPreferences.minimizedSites = [];
    const idx = this.state.userPreferences.minimizedSites.indexOf(siteId);
    if (idx > -1) {
        this.state.userPreferences.minimizedSites.splice(idx, 1);
    } else {
        this.state.userPreferences.minimizedSites.push(siteId);
    }
    
    this.savePreferences();
    this.renderList();
};

SitesEngine.toggleFilterFavoritesOnly = function() {
    this.state.filterFavoritesOnly = !this.state.filterFavoritesOnly;
    
    const btn = document.getElementById('btn-filter-favorites');
    if (btn) {
        if (this.state.filterFavoritesOnly) {
            btn.classList.add('active');
            btn.innerHTML = `<i class="ri-star-fill" style="color: #fbbf24;"></i> Favoris`;
            btn.style.background = 'rgba(251, 191, 36, 0.15)';
            btn.style.borderColor = 'rgba(251, 191, 36, 0.3)';
        } else {
            btn.classList.remove('active');
            btn.innerHTML = `<i class="ri-star-line"></i> Favoris`;
            btn.style.background = 'rgba(255,255,255,0.03)';
            btn.style.borderColor = 'var(--border-color)';
        }
    }
    
    this.savePreferences();
    this.renderList();
    if (this.state.mapExpanded) this.updateMapMarkers();
};

SitesEngine.saveUserPreferences = function() {
    try {
        localStorage.setItem('parapente_user_prefs', JSON.stringify(this.state.userPreferences));
    } catch(e) {}
    
    if (window.FirebaseAuthEngine && window.FirebaseAuthEngine.enabled && window.FirebaseAuthEngine.currentUser) {
        window.FirebaseAuthEngine.savePreferencesToCloud();
    }
};