SitesEngine.updateSearchQuery = function (val) {
    this.state.searchQuery = val || '';
    this.renderList();
    if (this.state.map) {
        this.updateMapMarkers();
    }
};

SitesEngine.renderList = function () {
        const container = document.getElementById('sites-list-container');
        if (!container) return;

        try {
            if (typeof SITES_DATA === 'undefined') {
                container.innerHTML = '<div style="color:red; font-size: 20px; text-align: center; margin-top: 40px; background: rgba(255,0,0,0.1); padding: 20px; border-radius: 12px;">ERREUR CRITIQUE: Le fichier sites_data.js n\'a pas été chargé correctement (SITES_DATA est indéfini).</div>';
                return;
            }

            let activeSites = SITES_DATA.filter(s => s.affiche !== false);

            // Filter by search query
            const searchQuery = (this.state.searchQuery || '').trim().toLowerCase();
            if (searchQuery) {
                const queryCleaned = this.removeAccents(searchQuery);
                activeSites = activeSites.filter(site => {
                    const name = this.removeAccents(site.nom || '').toLowerCase();
                    const city = this.removeAccents(site.ville || '').toLowerCase();
                    const zip = (site.code_postal || '').toLowerCase();
                    
                    let dept = '';
                    if (Array.isArray(site.departement)) {
                        dept = this.removeAccents(site.departement.join(' ')).toLowerCase();
                    } else if (site.departement) {
                        dept = this.removeAccents(site.departement).toLowerCase();
                    }
                    
                    const region = this.removeAccents(site.region || '').toLowerCase();
                    const obs = this.removeAccents(site.observations || '').toLowerCase();
                    const topo = this.removeAccents(site.acces_topo || '').toLowerCase();
                    const dangers = this.removeAccents(site.dangers || '').toLowerCase();
                    const practice = this.removeAccents(site.praticabilite || '').toLowerCase();

                    return name.includes(queryCleaned) ||
                           city.includes(queryCleaned) ||
                           zip.includes(queryCleaned) ||
                           dept.includes(queryCleaned) ||
                           region.includes(queryCleaned) ||
                           obs.includes(queryCleaned) ||
                           topo.includes(queryCleaned) ||
                           dangers.includes(queryCleaned) ||
                           practice.includes(queryCleaned);
                });
            }

            activeSites.forEach(site => {
                const forecasts = this.state.weatherForecasts[site.id] || [];
                let flyableHoursCount = 0;
                let maxConsecutiveHours = 0;
                let currentConsecutiveStreak = 0;
                const flyableSlots = [];
                let currentSlot = null;

                const halfDayCounts = {};
                const dailyCounts = {};

                for (let i = 0; i < Math.min(forecasts.length, 48); i++) {
                    const weather = forecasts[i];
                    const status = this.isForecastFlyable(site, weather);

                    if (status.flyable) {
                        flyableHoursCount++;
                        currentConsecutiveStreak++;
                        if (currentConsecutiveStreak > maxConsecutiveHours) {
                            maxConsecutiveHours = currentConsecutiveStreak;
                        }

                        const date = new Date(weather.time);
                        const hour = date.getHours();
                        const dayStr = date.toDateString();
                        const halfDayStr = hour < 12 ? 'M' : 'A';
                        const halfDayKey = `${dayStr}_${halfDayStr}`;

                        halfDayCounts[halfDayKey] = (halfDayCounts[halfDayKey] || 0) + 1;
                        dailyCounts[dayStr] = (dailyCounts[dayStr] || 0) + 1;

                        const today = new Date();
                        const tomorrow = new Date(today);
                        tomorrow.setDate(today.getDate() + 1);

                        let dayLabel = '';
                        if (date.toDateString() === today.toDateString()) {
                            dayLabel = "Aujourd'hui";
                        } else if (date.toDateString() === tomorrow.toDateString()) {
                            dayLabel = "Demain";
                        } else {
                            const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
                            dayLabel = days[date.getDay()];
                        }

                        if (!currentSlot) {
                            currentSlot = { start: hour, end: hour + 1, dayLabel: dayLabel };
                        } else {
                            if (currentSlot.dayLabel === dayLabel && hour === currentSlot.end) {
                                currentSlot.end = hour + 1;
                            } else {
                                flyableSlots.push(currentSlot);
                                currentSlot = { start: hour, end: hour + 1, dayLabel: dayLabel };
                            }
                        }
                    } else {
                        currentConsecutiveStreak = 0;
                        if (currentSlot) {
                            flyableSlots.push(currentSlot);
                            currentSlot = null;
                        }
                    }
                }
                if (currentSlot) {
                    flyableSlots.push(currentSlot);
                }

                let maxHalfDayHours = 0;
                for (const key in halfDayCounts) {
                    if (halfDayCounts[key] > maxHalfDayHours) {
                        maxHalfDayHours = halfDayCounts[key];
                    }
                }

                let maxDailyHours = 0;
                for (const key in dailyCounts) {
                    if (dailyCounts[key] > maxDailyHours) {
                        maxDailyHours = dailyCounts[key];
                    }
                }

                site.flyableHours = flyableHoursCount;
                site.maxConsecutiveHours = maxConsecutiveHours;
                site.maxHalfDayHours = maxHalfDayHours;
                site.maxDailyHours = maxDailyHours;
                site.flyableSlots = flyableSlots;

                if (this.state.userLocation) {
                    site.distance = this.calculateDistance(
                        this.state.userLocation.lat,
                        this.state.userLocation.lng,
                        site.latitude,
                        site.longitude
                    );
                }
            });

            // Filter by distance if radius limit is set and user's location is known
            if (this.state.userLocation && this.state.radiusLimit < 210) {
                activeSites = activeSites.filter(site => site.distance !== undefined && site.distance <= this.state.radiusLimit);
            }

            // 3-State Wind Filtering
            if (this.state.filterWindExclude && this.state.filterWindExclude.length > 0) {
                activeSites = activeSites.filter(site => {
                    return !site.orientations_vent.some(w => this.state.filterWindExclude.includes(w));
                });
            }
            if (this.state.filterWindInclude && this.state.filterWindInclude.length > 0) {
                activeSites = activeSites.filter(site => {
                    return site.orientations_vent.some(w => this.state.filterWindInclude.includes(w));
                });
            }

            // Type Filtering (with Landing-only default hide & independent type priority)
            activeSites = activeSites.filter(site => {
                let siteTypes = Array.isArray(site.type) ? site.type : [site.type];
                siteTypes = siteTypes.map(t => t === 'ATTERO' ? 'ATTERRO' : t);

                // 1. Landing-only hidden by default (can be revealed by including ATTERRO)
                const isLandingOnly = siteTypes.includes('ATTERRO') && siteTypes.every(t => t === 'ATTERRO');
                if (isLandingOnly) {
                    if (!this.state.filterTypeInclude.includes('ATTERRO')) {
                        return false;
                    }
                }

                // 2. 3-state inclusion and exclusion logic with independence
                const hasIncludedType = this.state.filterTypeInclude && this.state.filterTypeInclude.length > 0 && siteTypes.some(t => this.state.filterTypeInclude.includes(t));
                const hasExcludedType = this.state.filterTypeExclude && this.state.filterTypeExclude.length > 0 && siteTypes.some(t => this.state.filterTypeExclude.includes(t));

                if (this.state.filterTypeInclude && this.state.filterTypeInclude.length > 0) {
                    if (hasIncludedType) return true;
                    return false;
                }

                if (hasExcludedType) return false;

                return true;
            });

            if (this.state.hideUnflyable) {
                activeSites = activeSites.filter(site => site.flyableHours > 0);
            }

            if (this.state.sortMode === 'CONDITIONS') {
                const strat = this.state.conditionsStrategy || 'CONSECUTIVE';

                activeSites.sort((a, b) => {
                    let priorities = [];

                    if (strat === 'CONSECUTIVE') {
                        priorities = [
                            (b.maxConsecutiveHours || 0) - (a.maxConsecutiveHours || 0),
                            (b.maxHalfDayHours || 0) - (a.maxHalfDayHours || 0),
                            (b.maxDailyHours || 0) - (a.maxDailyHours || 0),
                            (b.flyableHours || 0) - (a.flyableHours || 0)
                        ];
                    } else if (strat === 'HALF_DAY') {
                        priorities = [
                            (b.maxHalfDayHours || 0) - (a.maxHalfDayHours || 0),
                            (b.maxConsecutiveHours || 0) - (a.maxConsecutiveHours || 0),
                            (b.maxDailyHours || 0) - (a.maxDailyHours || 0),
                            (b.flyableHours || 0) - (a.flyableHours || 0)
                        ];
                    } else if (strat === 'DAILY') {
                        priorities = [
                            (b.maxDailyHours || 0) - (a.maxDailyHours || 0),
                            (b.maxConsecutiveHours || 0) - (a.maxConsecutiveHours || 0),
                            (b.maxHalfDayHours || 0) - (a.maxHalfDayHours || 0),
                            (b.flyableHours || 0) - (a.flyableHours || 0)
                        ];
                    } else { // TOTAL
                        priorities = [
                            (b.flyableHours || 0) - (a.flyableHours || 0),
                            (b.maxConsecutiveHours || 0) - (a.maxConsecutiveHours || 0),
                            (b.maxHalfDayHours || 0) - (a.maxHalfDayHours || 0),
                            (b.maxDailyHours || 0) - (a.maxDailyHours || 0)
                        ];
                    }

                    // Go down priorities until a non-zero difference is found
                    for (const diff of priorities) {
                        if (diff !== 0) return diff;
                    }

                    // Fallbacks: Distance -> Name
                    if (this.state.userLocation) {
                        return (a.distance || 9999) - (b.distance || 9999);
                    }
                    return a.nom.localeCompare(b.nom);
                });
            } else if (this.state.sortMode === 'DISTANCE' && this.state.userLocation) {
                activeSites.sort((a, b) => (a.distance || 9999) - (b.distance || 9999));
            } else {
                activeSites.sort((a, b) => a.nom.localeCompare(b.nom));
            }

            container.innerHTML = '';

            if (activeSites.length === 0) {
                container.innerHTML = `
                    <div class="empty-state site-empty-state">
                        <i class="ri-map-pin-line site-empty-icon"></i>
                        <p class="site-empty-text">Aucun site ne correspond à ces critères.</p>
                    </div>
                `;
                return;
            }

            activeSites.forEach(site => {
                const windTags = site.orientations_vent.map(w => `<span class="wind-tag" onclick="SitesEngine.filterByTag('${w}')" title="Filtrer par vent ${w}">${w}</span>`).join('');

                const typeLabels = {
                    'DECO': 'Décollage',
                    'ATTERRO': 'Atterrissage',
                    'NATUREL': 'Naturel',
                    'DUNE': 'Dune',
                    'TREUIL': 'Treuil',
                    'GONFLAGE': 'Gonflage'
                };
                let siteTypes = Array.isArray(site.type) ? site.type : [site.type];
                siteTypes = siteTypes.map(t => t === 'ATTERO' ? 'ATTERRO' : t);
                const typeLabel = siteTypes.map(t => {
                    const label = typeLabels[t] || t;
                    return `<span class="site-coords-badge site-type-badge">${label}</span>`;
                }).join(' ');

                let distanceHtml = '';
                if (site.distance !== undefined) {
                    distanceHtml = `
                        <span class="site-coords-badge site-dist-badge">
                            <i class="ri-navigation-fill"></i> ${site.distance.toFixed(1)} km
                        </span>
                    `;
                }

                const flyableHoursHtml = `
                    <span class="site-coords-badge" style="background: ${site.flyableHours > 0 ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.03)'}; border-color: ${site.flyableHours > 0 ? 'rgba(34,197,94,0.3)' : 'var(--border-color)'}; color: ${site.flyableHours > 0 ? 'var(--accent-green)' : 'var(--text-muted)'}; font-weight: 700;">
                        <i class="ri-time-line"></i> ${site.flyableHours}h volables ${site.maxConsecutiveHours > 0 ? `(${site.maxConsecutiveHours}h conséc.)` : ''}
                    </span>
                `;

                let weatherHtml = '';
                let weather = null;
                const forecasts = this.state.weatherForecasts[site.id] || [];
                if (forecasts && forecasts[this.state.forecastOffset]) {
                    weather = forecasts[this.state.forecastOffset];
                }
                if (weather) {
                    const status = this.isForecastFlyable(site, weather);
                    weatherHtml = `
                        <div class="site-weather-row ${status.class}" style="display: flex; flex-direction: column; gap: 6px; margin-top: 12px; padding: 8px 12px; border-radius: 8px; font-size: 0.9rem; font-weight: 500;">
                            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%;">
                                <span style="display: flex; align-items: center; gap: 6px;">
                                    <i class="ri-windy-line"></i>
                                    <span>Vent <b>${weather.windCard}</b> (${weather.windDirDeg}°) : <b>${weather.windSpeed} km/h</b> (raf. <b>${weather.windGust}</b>)</span>
                                </span>
                                <span style="display: flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; text-transform: uppercase;">
                                    <i class="${status.icon}"></i> ${status.reason}
                                </span>
                            </div>
                        </div>
                    `;
                } else {
                    weatherHtml = `
                        <div class="weather-loading">
                            <i class="ri-loader-4-line" style="animation: spin 1s linear infinite;"></i>
                            <span>Chargement météo ${this.state.weatherModel.toUpperCase()}...</span>
                        </div>
                    `;
                }

                let slotsTextHtml = '';
                if (site.flyableSlots.length > 0) {
                    const groupedByDay = {};
                    site.flyableSlots.forEach(slot => {
                        if (!groupedByDay[slot.dayLabel]) groupedByDay[slot.dayLabel] = [];
                        groupedByDay[slot.dayLabel].push(`${slot.start}h - ${slot.end}h`);
                    });
                    const slotsDetails = Object.keys(groupedByDay).map(day => {
                        return `<span><b>${day}</b> (${groupedByDay[day].join(', ')})</span>`;
                    }).join(' | ');
                    slotsTextHtml = `
                        <div class="creneaux-list good">
                            <i class="ri-calendar-todo-line"></i> Prochains créneaux : ${slotsDetails}
                        </div>
                    `;
                } else {
                    slotsTextHtml = `
                        <div class="creneaux-list bad">
                            <i class="ri-error-warning-line"></i> Aucun créneau favorable dans les prochaines 48 heures
                        </div>
                    `;
                }

                let timelineBarsHtml = '';
                const forecastsToUse = forecasts.slice(0, 48);
                for (let i = 0; i < 48; i++) {
                    const w = forecastsToUse[i];
                    let barColor = 'rgba(255,255,255,0.05)';
                    let statusLabel = 'Inconnu';
                    let timeStr = `+${i}h`;

                    if (w) {
                        const status = this.isForecastFlyable(site, w);
                        const date = new Date(w.time);
                        const h = String(date.getHours()).padStart(2, '0');
                        const m = String(date.getMinutes()).padStart(2, '0');
                        const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
                        timeStr = `${days[date.getDay()]} ${h}:${m}`;
                        if (status.flyable) {
                            if (status.warning) {
                                barColor = '#eab308'; // yellow for uncertain
                                statusLabel = `${w.windCard} ${w.windSpeed} km/h — ${status.reason}`;
                            } else {
                                barColor = 'var(--accent-green)';
                                statusLabel = `Volable — ${w.windCard} ${w.windSpeed} km/h (raf. ${w.windGust})`;
                            }
                        } else {
                            statusLabel = status.reason;
                            if (status.reason === 'Nuit') barColor = 'rgba(100,100,120,0.3)';
                            else if (status.reason.startsWith('Pluie')) barColor = '#3b82f6';
                            else if (status.reason === 'Mauvaise orientation') barColor = '#f97316';
                            else barColor = '#ef4444';
                        }
                    }
                    let dotStyle = `flex: 1; height: 100%; background: ${barColor}; transition: all 0.2s; cursor: pointer;`;
                    if (i === this.state.forecastOffset) {
                        dotStyle += ` outline: 1.5px solid var(--text-main); transform: scaleY(1.3); z-index: 5; box-shadow: 0 0 6px var(--accent-blue);`;
                    }
                    timelineBarsHtml += `<div class="timeline-hour-dot" style="${dotStyle}" title="${timeStr} : ${statusLabel}" onclick="event.stopPropagation(); SitesEngine.setForecastOffset(${i});"></div>`;
                }


                const card = document.createElement('div');
                card.id = `site-card-${site.id}`;
                card.className = 'site-card';
                card.innerHTML = this.buildSiteCardHtml(site, windTags, typeLabel, distanceHtml, flyableHoursHtml, weatherHtml, timelineBarsHtml, slotsTextHtml);
                container.appendChild(card);
            });
        } catch (err) {
            container.innerHTML = '<div class="site-error-container">ERREUR JS: ' + err.toString() + '</div>';
        }
    };

SitesEngine.buildSiteCardHtml = function (site, windTags, typeLabel, distanceHtml, flyableHoursHtml, weatherHtml, timelineBarsHtml, slotsTextHtml) {
        return `
            <div class="site-card-header site-card-header-row">
                <div class="site-info site-info-row">
                    <h3 class="site-card-title">${site.nom}</h3>
                    ${site.altitude ? `
                    <span class="site-coords-badge site-altitude-badge" title="Altitude du site">
                        <i class="ri-landscape-line"></i> ${site.altitude} m
                    </span>
                    ` : ''}
                    <div class="site-wind-tags site-wind-tags-row">${windTags}</div>
                    ${typeLabel}
                    <button class="site-coords-badge copy-coords-btn" onclick="SitesEngine.copyCoords(${site.latitude}, ${site.longitude}, this)" title="Copier les coordonnées">
                        <i class="ri-map-pin-2-line"></i> <span class="coords-text">${site.latitude}, ${site.longitude}</span>
                    </button>
                    ${distanceHtml}
                    ${flyableHoursHtml}
                </div>
                <div class="site-actions-container">
                    ${site.url ? `
                    <a class="action-btn-secondary ffvl-btn" href="${site.url}" target="_blank" onclick="event.stopPropagation();" title="Fiche officielle FFVL">
                        <img src="https://federation.ffvl.fr/sites/all/themes/ffvl/favicon.ico" alt="FFVL"> FFVL
                    </a>
                    ` : ''}
                    <button class="action-btn-spot spot-it-btn" onclick="SitesEngine.spotSite(${site.latitude}, ${site.longitude}, '${site.nom.replace(/'/g, "\\'")}', '${site.referecence_terrain || ''}'); event.stopPropagation();" title="Spot It — Paramétrer toutes les cartes sur ce site">
                        <i class="ri-focus-3-line"></i> Spot It
                    </button>
                    <button class="action-btn-primary gps-btn" onclick="SitesEngine.openGpsMenu(${site.latitude}, ${site.longitude}); event.stopPropagation();">
                        <i class="ri-navigation-line"></i> S'y rendre
                    </button>
                </div>
            </div>
            ${weatherHtml}
            <div style="margin-top: 14px;">
                <div class="timeline-labels">
                    <span>Maintenant</span><span>Prévisions (48h)</span><span>Dans 2 jours</span>
                </div>
                <div class="ranking-timeline">
                    ${timelineBarsHtml}
                </div>
                <div class="timeline-legend">
                    <span class="legend-item"><span class="legend-color" style="background:#22c55e;"></span> Volable</span>
                    <span class="legend-item"><span class="legend-color" style="background:#eab308;"></span> Orientation inconnue</span>
                    <span class="legend-item"><span class="legend-color" style="background:#ef4444;"></span> Vent / Rafales</span>
                    <span class="legend-item"><span class="legend-color" style="background:#f97316;"></span> Mauvaise orientation</span>
                    <span class="legend-item"><span class="legend-color" style="background:#3b82f6;"></span> Pluie</span>
                    <span class="legend-item"><span class="legend-color" style="background:rgba(100,100,120,0.5);"></span> Nuit</span>
                </div>
            </div>
            ${slotsTextHtml}
            ${(() => {
                const showConv = this.isFieldFilled(site.conventionnement);
                const showPrat = this.isFieldFilled(site.praticabilite);
                const showGest = this.isFieldFilled(site.structure_gestionnaire);
                const showAero = this.isFieldFilled(site.aerologie_ideale);
                const showSec = this.isFieldFilled(site.secours_acces);
                const showDang = this.isFieldFilled(site.dangers);
                const showTopo = this.isFieldFilled(site.acces_topo);

                const rawObs = site.observations || '';
                const cleanObs = rawObs.replace(/^Altitude\s*:\s*\d+\s*m\.?\s*/i, '').trim();
                const showObs = this.isFieldFilled(cleanObs);

                const isOpen = this.state.expandedSites[site.id] ? 'open' : '';
                const toggleText = this.state.expandedSites[site.id] ? 'Masquer les détails' : "Voir plus d'infos";
                
                return `
                    <details class="site-details-toggle" ${isOpen} ontoggle="SitesEngine.handleDetailsToggle(${site.id}, this)">
                        <summary>
                            <span class="toggle-text">${toggleText}</span>
                            <i class="ri-arrow-down-s-line"></i>
                        </summary>
                        <div class="site-rich-details">

                            ${showConv ? `
                            <div class="rich-detail-item default">
                                <i class="ri-shield-check-line rich-detail-icon blue"></i>
                                <div>
                                    <strong class="rich-detail-label muted">Conventionnement</strong>
                                    <span class="rich-detail-value">${site.conventionnement}</span>
                                </div>
                            </div>
                            ` : ''}
                            ${showPrat ? `
                            <div class="rich-detail-item default">
                                <i class="ri-checkbox-circle-line rich-detail-icon ${site.affiche ? 'green' : 'red'}"></i>
                                <div>
                                    <strong class="rich-detail-label muted">Praticabilité</strong>
                                    <span class="rich-detail-value">${site.praticabilite}</span>
                                </div>
                            </div>
                            ` : ''}
                            ${showGest ? `
                            <div class="rich-detail-item default">
                                <i class="ri-group-line rich-detail-icon secondary"></i>
                                <div>
                                    <strong class="rich-detail-label muted">Structure Gestionnaire</strong>
                                    <span class="rich-detail-value">${site.structure_gestionnaire}</span>
                                </div>
                            </div>
                            ` : ''}
                            ${showAero ? `
                            <div class="rich-detail-item default">
                                <i class="ri-compass-3-line rich-detail-icon blue"></i>
                                <div>
                                    <strong class="rich-detail-label muted">Aérologie Idéale</strong>
                                    <span class="rich-detail-value">${site.aerologie_ideale}</span>
                                </div>
                            </div>
                            ` : ''}
                            ${showSec ? `
                            <div class="rich-detail-item default">
                                <i class="ri-heart-pulse-line rich-detail-icon red"></i>
                                <div>
                                    <strong class="rich-detail-label muted">Secours & Accès</strong>
                                    <span class="rich-detail-value">${site.secours_acces}</span>
                                </div>
                            </div>
                            ` : ''}
                            ${showDang ? `
                            <div class="rich-detail-item danger">
                                <i class="ri-error-warning-line rich-detail-icon red"></i>
                                <div>
                                    <strong class="rich-detail-label red">Dangers Signalés</strong>
                                    <span class="rich-detail-value">${site.dangers}</span>
                                </div>
                            </div>
                            ` : ''}
                            ${showTopo ? `
                            <div class="rich-detail-item default full-width">
                                <i class="ri-walk-line rich-detail-icon secondary"></i>
                                <div>
                                    <strong class="rich-detail-label muted">Accès & Topo</strong>
                                    <span class="rich-detail-value">${site.acces_topo}</span>
                                </div>
                            </div>
                            ` : ''}
                            ${showObs ? `
                            <div class="rich-detail-item obs">
                                <i class="ri-information-line rich-detail-icon blue"></i>
                                <div>
                                    <strong class="rich-detail-label muted">Observations & Réglementation</strong>
                                    <span class="rich-detail-value">${cleanObs}</span>
                                </div>
                            </div>
                            ` : ''}
                        </div>
                    </details>
                `;
            })()}
        `;
    };

SitesEngine.copyCoords = function (lat, lng, btnRef) {
        const coords = lat + ', ' + lng;
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(coords).then(() => {
                const originalHtml = btnRef.innerHTML;
                btnRef.innerHTML = '<i class="ri-check-line" style="color: var(--accent-green);"></i> <span style="color: var(--accent-green);">Copié !</span>';
                btnRef.style.borderColor = 'var(--accent-green)';
                setTimeout(() => {
                    btnRef.innerHTML = originalHtml;
                    btnRef.style.borderColor = '';
                }, 2000);
            }).catch(err => { console.error('Failed to copy: ', err); });
        } else {
            const textarea = document.createElement('textarea');
            textarea.value = coords;
            textarea.style.position = 'fixed';
            document.body.appendChild(textarea);
            textarea.select();
            try {
                document.execCommand('copy');
                const originalHtml = btnRef.innerHTML;
                btnRef.innerHTML = '<i class="ri-check-line" style="color: var(--accent-green);"></i> <span style="color: var(--accent-green);">Copié !</span>';
                btnRef.style.borderColor = 'var(--accent-green)';
                setTimeout(() => {
                    btnRef.innerHTML = originalHtml;
                    btnRef.style.borderColor = '';
                }, 2000);
            } catch (err) { console.error('Fallback copy failed', err); }
            document.body.removeChild(textarea);
        }
    };

SitesEngine.jumpToSiteCard = function (siteId) {
        const target = document.getElementById(`site-card-${siteId}`);
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            target.classList.add('highlight-glow');
            setTimeout(() => { target.classList.remove('highlight-glow'); }, 2000);
        }
    };

SitesEngine.handleDetailsToggle = function (siteId, detailsEl) {
        if (!this.state.expandedSites) {
            this.state.expandedSites = {};
        }
        this.state.expandedSites[siteId] = detailsEl.open;
        const toggleTextEl = detailsEl.querySelector('.toggle-text');
        if (toggleTextEl) {
            toggleTextEl.textContent = detailsEl.open ? 'Masquer les détails' : "Voir plus d'infos";
        }
    };