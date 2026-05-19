SitesEngine.initMap = function () {
        if (this.state.map) return;
        this.state.map = L.map('sites-map-canvas');
        this.updateMapTiles();
        this.state.markersGroup = L.featureGroup().addTo(this.state.map);
        this.updateMapMarkers();
        try {
            const bounds = this.state.markersGroup.getBounds();
            if (bounds.isValid()) this.state.map.fitBounds(bounds, { padding: [30, 30] });
            else this.state.map.setView([50.5, 2.5], 9);
        } catch (e) { this.state.map.setView([50.5, 2.5], 9); }
    };

SitesEngine.updateMapTiles = function () {
        if (!this.state.map) return;

        // Toggle dark-map class based on current theme mode
        const mapCanvas = document.getElementById('sites-map-canvas');
        if (mapCanvas) {
            const isLightMode = document.body.classList.contains('light-mode');
            if (isLightMode) {
                mapCanvas.classList.remove('dark-map');
            } else {
                mapCanvas.classList.add('dark-map');
            }
        }

        if (this.state.tileLayer) return; // No need to recreate the tile layer!

        this.state.tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://openstreetmap.fr">OSM France</a>',
            maxZoom: 20
        }).addTo(this.state.map);
    };

SitesEngine.updateMapMarkers = function () {
        if (!this.state.map || !this.state.markersGroup) return;
        this.state.markersGroup.clearLayers();
        let activeSites = SITES_DATA.filter(s => s.affiche !== false);

        // Filter map markers by search query
        if (this.state.searchQuery) {
            const queryCleaned = this.removeAccents(this.state.searchQuery.trim().toLowerCase());
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

        // 3-State Wind Map Filtering
        if (this.state.filterWindExclude && this.state.filterWindExclude.length > 0) {
            activeSites = activeSites.filter(s => s.orientations_vent && !s.orientations_vent.some(w => this.state.filterWindExclude.includes(w)));
        }
        if (this.state.filterWindInclude && this.state.filterWindInclude.length > 0) {
            activeSites = activeSites.filter(s => s.orientations_vent && s.orientations_vent.some(w => this.state.filterWindInclude.includes(w)));
        }

        // Type Map Filtering (with Landing-only default hide & independent type priority)
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
            activeSites = activeSites.filter(site => {
                const forecasts = this.state.weatherForecasts[site.id] || [];
                let hours = 0;
                for (let i = 0; i < Math.min(forecasts.length, 48); i++) {
                    if (this.isForecastFlyable(site, forecasts[i]).flyable) hours++;
                }
                return hours > 0;
            });
        }

        // Apply radius filter on map markers if user location and limit are active
        if (this.state.userLocation && this.state.radiusLimit < 210) {
            activeSites = activeSites.filter(site => {
                if (site.distance === undefined) {
                    site.distance = this.calculateDistance(
                        this.state.userLocation.lat,
                        this.state.userLocation.lng,
                        site.latitude,
                        site.longitude
                    );
                }
                return site.distance <= this.state.radiusLimit;
            });
        }

        activeSites.forEach(site => {
            let color = '#94a3b8';
            let flyableClass = 'weather-unknown';
            let weather = (this.state.weatherForecasts[site.id] || [])[this.state.forecastOffset];
            if (weather) {
                const status = this.isForecastFlyable(site, weather);
                flyableClass = status.class;
                if (status.flyable) color = status.warning ? '#eab308' : '#22c55e';
                else {
                    if (status.reason === 'Nuit') color = '#475569';
                    else if (status.reason.startsWith('Pluie')) color = '#3b82f6';
                    else if (status.reason === 'Mauvaise orientation') color = '#f97316';
                    else color = '#ef4444';
                }
            }
            const isCurrentlyFlyable = weather && this.isForecastFlyable(site, weather).flyable;
            const pulseHtml = isCurrentlyFlyable
                ? `<div class="marker-pulse" style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background: ${color}; opacity: 0.35; animation: marker-pulse-anim 1.8s infinite ease-out;"></div>`
                : '';
            const iconHtml = `<div class="custom-map-marker ${flyableClass}" style="position: relative; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;">${pulseHtml}<div class="marker-core" style="width: 14px; height: 14px; border-radius: 50%; background: ${color}; border: 2px solid var(--bg-surface); box-shadow: 0 2px 6px rgba(0,0,0,0.4); z-index: 2; transition: background-color 0.3s;"></div></div>`;
            const marker = L.marker([site.latitude, site.longitude], { icon: L.divIcon({ html: iconHtml, className: 'leaflet-custom-icon', iconSize: [30, 30], iconAnchor: [15, 15] }) });
            marker.on('click', (e) => {
                this.focusSiteWindy(site.latitude, site.longitude, site.nom);
            });
            this.state.markersGroup.addLayer(marker);
        });

        // Fit Leaflet map bounds to show only the active markers
        if (activeSites.length > 0 && this.state.map) {
            const coords = activeSites.map(s => [s.latitude, s.longitude]);
            this.state.map.fitBounds(coords, { padding: [30, 30] });
        }
    };

SitesEngine.buildWeatherPopupHtml = function (weather, color, site) {
        const status = this.isForecastFlyable(site, weather);
        return `<div style="margin-top: 8px; padding: 8px; border-radius: 6px; background: rgba(0,0,0,0.1); border: 1px solid var(--border-color); font-size: 0.85rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; gap: 8px;">
                <span style="font-weight: 700; white-space: nowrap;"><i class="ri-windy-line"></i> ${weather.windCard} ${weather.windSpeed} km/h</span>
                <span style="color: ${color}; font-weight: bold; font-size: 0.75rem;"><i class="${status.icon}"></i> ${status.reason}</span>
            </div>
            <div style="opacity: 0.8; font-size: 0.8rem;">Rafales : ${weather.windGust} km/h</div>
        </div>`;
    };

SitesEngine.buildMapPopupHtml = function (site, weatherPopupHtml) {
        return `<div class="map-popup-card" style="font-family: var(--font-main); color: var(--text-main); width: 220px;">
            <h4 style="margin: 0 0 4px 0; font-size: 1rem; font-weight: 700;">${site.nom}</h4>
            ${weatherPopupHtml}
            <div style="display: flex; gap: 6px; margin-top: 10px;">
                ${site.url ? `
                <a class="action-btn-secondary ffvl-btn" href="${site.url}" target="_blank" onclick="event.stopPropagation();" style="padding: 6px 8px; display: inline-flex; align-items: center; justify-content: center; text-decoration: none;" title="Fiche FFVL">
                    <img src="https://federation.ffvl.fr/sites/all/themes/ffvl/favicon.ico" alt="FFVL" style="width: 14px; height: 14px; border-radius: 2px;">
                </a>
                ` : ''}
                <button class="action-btn-primary" onclick="SitesEngine.openGpsMenu(${site.latitude}, ${site.longitude}); event.stopPropagation();" style="flex: 1; padding: 6px 10px; font-size: 0.8rem; justify-content: center;">
                    <i class="ri-navigation-line"></i> S'y rendre
                </button>
                <button class="action-btn-secondary windy-btn" onclick="SitesEngine.focusSiteWindy(${site.latitude}, ${site.longitude}, '${site.nom.replace(/'/g, "\\'")}'); event.stopPropagation();" style="padding: 6px 8px;" title="Afficher le vent sur le radar">
                    <i class="ri-windy-line"></i>
                </button>
            </div>
        </div>`;
    };

SitesEngine.openGpsMenu = function (lat, lng) {
        this.state.currentSiteCoords = { lat, lng };
        const sheet = document.getElementById('gps-bottom-sheet');
        if (sheet) sheet.classList.add('active');
    };

SitesEngine.closeGpsMenu = function () {
        const sheet = document.getElementById('gps-bottom-sheet');
        if (sheet) sheet.classList.remove('active');
        this.state.currentSiteCoords = null;
    };

SitesEngine.launchGps = function (app) {
        const coords = this.state.currentSiteCoords;
        if (!coords) return;
        const { lat, lng } = coords;
        let url = '';
        if (app === 'waze') {
            url = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
        } else if (app === 'gmaps') {
            url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
        } else if (app === 'apple') {
            url = `http://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
        }
        if (url) window.open(url, '_blank');
        this.closeGpsMenu();
    };

SitesEngine.switchMapMode = function (mode) {
        const leafletBtn = document.getElementById('map-toggle-leaflet');
        const windyBtn = document.getElementById('map-toggle-windy');
        const isofrontsBtn = document.getElementById('map-toggle-isofronts');
        const leafletCanvas = document.getElementById('sites-map-canvas');
        const windyCanvas = document.getElementById('sites-windy-canvas');
        const isofrontsCanvas = document.getElementById('sites-isofronts-canvas');
        const windyIframe = document.getElementById('windy-embed-iframe');

        if (mode === 'leaflet') {
            if (leafletBtn) {
                leafletBtn.className = 'action-btn-primary';
                leafletBtn.style.color = '';
                leafletBtn.style.borderColor = '';
            }
            if (windyBtn) {
                windyBtn.className = 'action-btn-secondary';
                windyBtn.style.color = 'var(--text-secondary)';
                windyBtn.style.borderColor = 'var(--border-color)';
            }
            if (isofrontsBtn) {
                isofrontsBtn.className = 'action-btn-secondary';
                isofrontsBtn.style.color = 'var(--text-secondary)';
                isofrontsBtn.style.borderColor = 'var(--border-color)';
            }
            if (leafletCanvas) leafletCanvas.style.display = 'block';
            if (windyCanvas) windyCanvas.style.display = 'none';
            if (isofrontsCanvas) isofrontsCanvas.style.display = 'none';
            if (this.state.map) {
                setTimeout(() => {
                    this.state.map.invalidateSize();
                    if (this.state.markersGroup) {
                        const bounds = this.state.markersGroup.getBounds();
                        if (bounds.isValid()) {
                            this.state.map.fitBounds(bounds, { padding: [30, 30] });
                        }
                    }
                }, 150);
            }
        } else if (mode === 'windy') {
            if (leafletBtn) {
                leafletBtn.className = 'action-btn-secondary';
                leafletBtn.style.color = 'var(--text-secondary)';
                leafletBtn.style.borderColor = 'var(--border-color)';
            }
            if (windyBtn) {
                windyBtn.className = 'action-btn-primary';
                windyBtn.style.color = '';
                windyBtn.style.borderColor = '';
            }
            if (isofrontsBtn) {
                isofrontsBtn.className = 'action-btn-secondary';
                isofrontsBtn.style.color = 'var(--text-secondary)';
                isofrontsBtn.style.borderColor = 'var(--border-color)';
            }
            if (leafletCanvas) leafletCanvas.style.display = 'none';
            if (windyCanvas) windyCanvas.style.display = 'block';
            if (isofrontsCanvas) isofrontsCanvas.style.display = 'none';

            // Load Windy Widget Centered
            let lat = 50.45;
            let lon = 2.20;
            if (this.state.userLocation) {
                lat = this.state.userLocation.lat;
                lon = this.state.userLocation.lng;
            } else if (typeof SITES_DATA !== 'undefined' && SITES_DATA.length > 0) {
                lat = SITES_DATA[0].latitude;
                lon = SITES_DATA[0].longitude;
            }

            if (windyIframe && !windyIframe.src.includes('windy.com')) {
                windyIframe.src = `https://embed.windy.com/embed2.html?lat=${lat}&lon=${lon}&width=100%&height=400&zoom=8&level=surface&overlay=wind&product=ecmwf&menu=&message=&marker=true&calendar=now&pressure=&type=map&location=coordinates&metricWind=default&metricTemp=default&radarRange=`;
                const nameLabel = document.getElementById('windy-active-spot-name');
                if (nameLabel) {
                    nameLabel.textContent = "Général (Centre de la carte)";
                }
            }
        } else if (mode === 'isofronts') {
            if (leafletBtn) {
                leafletBtn.className = 'action-btn-secondary';
                leafletBtn.style.color = 'var(--text-secondary)';
                leafletBtn.style.borderColor = 'var(--border-color)';
            }
            if (windyBtn) {
                windyBtn.className = 'action-btn-secondary';
                windyBtn.style.color = 'var(--text-secondary)';
                windyBtn.style.borderColor = 'var(--border-color)';
            }
            if (isofrontsBtn) {
                isofrontsBtn.className = 'action-btn-primary';
                isofrontsBtn.style.color = '';
                isofrontsBtn.style.borderColor = '';
            }
            if (leafletCanvas) leafletCanvas.style.display = 'none';
            if (windyCanvas) windyCanvas.style.display = 'none';
            if (isofrontsCanvas) isofrontsCanvas.style.display = 'block';
        }
    };

    // Removed getLatestIsofrontsUrl and toggleIsofrontsSource as Météo-France map is now directly embedded

SitesEngine.focusSiteWindy = function (lat, lon, siteName) {
        this.switchMapMode('windy');

        const nameLabel = document.getElementById('windy-active-spot-name');
        if (nameLabel) {
            nameLabel.textContent = siteName ? siteName.toUpperCase() : "Général";
        }

        const windyIframe = document.getElementById('windy-embed-iframe');
        if (windyIframe) {
            windyIframe.src = `https://embed.windy.com/embed2.html?lat=${lat}&lon=${lon}&detailLat=${lat}&detailLon=${lon}&width=100%&height=400&zoom=11&level=surface&overlay=wind&product=ecmwf&menu=&message=true&marker=true&calendar=now&pressure=&type=map&location=coordinates&metricWind=default&metricTemp=default&radarRange=`;
        }
        const mapView = document.getElementById('sites-map-view');
        if (mapView) {
            mapView.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    };

SitesEngine.toggleFullscreen = function () {
        const mapView = document.getElementById('sites-map-view');
        const fsBtn = document.getElementById('map-toggle-fullscreen');
        if (!mapView || !fsBtn) return;

        const isFullscreen = mapView.classList.toggle('map-view-fullscreen');

        if (isFullscreen) {
            document.body.style.overflow = 'hidden';
            document.documentElement.style.overflow = 'hidden';
            fsBtn.innerHTML = '<i class="ri-fullscreen-exit-line"></i> Réduire';
            fsBtn.classList.add('active-fs');
            if (this.state.map && document.getElementById('sites-map-canvas').style.display !== 'none') {
                setTimeout(() => {
                    this.state.map.invalidateSize();
                    if (this.state.markersGroup) {
                        const bounds = this.state.markersGroup.getBounds();
                        if (bounds.isValid()) {
                            this.state.map.fitBounds(bounds, { padding: [30, 30] });
                        }
                    }
                }, 150);
            }
        } else {
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
            fsBtn.innerHTML = '<i class="ri-fullscreen-line"></i> Plein écran';
            fsBtn.classList.remove('active-fs');
            if (this.state.map && document.getElementById('sites-map-canvas').style.display !== 'none') {
                setTimeout(() => {
                    this.state.map.invalidateSize();
                    if (this.state.markersGroup) {
                        const bounds = this.state.markersGroup.getBounds();
                        if (bounds.isValid()) {
                            this.state.map.fitBounds(bounds, { padding: [30, 30] });
                        }
                    }
                }, 150);
            }
        }
    };