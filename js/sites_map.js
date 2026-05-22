SitesEngine.initMap = function () {
        if (this.state.map) return;
        this.state.map = L.map('sites-map-canvas');
        this.updateMapTiles();
        this.state.markersGroup = L.featureGroup().addTo(this.state.map);
        this.updateMapMarkers();
        
        // Fix Leaflet tile loading issue on mobile/resize using ResizeObserver
        const mapCanvas = document.getElementById('sites-map-canvas');
        if (mapCanvas && window.ResizeObserver) {
            this.state.mapResizeObserver = new ResizeObserver(() => {
                if (this.state.map) {
                    this.state.map.invalidateSize();
                }
            });
            this.state.mapResizeObserver.observe(mapCanvas);
        }

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

        // 1. Couche de base (Esri World Topo Map) - Rendu beaucoup plus "dessin/vectoriel" et épuré que OpenTopoMap
        this.state.tileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri',
            maxZoom: 17,
            maxNativeZoom: 15 // Astuce Ligne Claire : Étire les tuiles (lignes épaisses, pas de lissage)
        }).addTo(this.state.map);

        // 2. On supprime la surcouche de relief car Esri intègre déjà un relief très doux et plat
        if (this.state.hillshadeLayer) {
            this.state.map.removeLayer(this.state.hillshadeLayer);
            this.state.hillshadeLayer = null;
        }
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
                this.spotSite(site.latitude, site.longitude, site.nom, site.referecence_terrain || "");
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
                <button class="action-btn-secondary paraglidable-btn" onclick="SitesEngine.focusSiteMap('paraglidable', ${site.latitude}, ${site.longitude}, '${site.nom.replace(/'/g, "\\'")}'); event.stopPropagation();" style="padding: 6px 8px;" title="Afficher sur Paraglidable">
                    <i class="ri-flight-takeoff-line"></i>
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
    const modes = [
        'leaflet', 'windy', 'meteoparapente', 'paraglidingearth', 'isofronts', 'paraglidable'
    ];
    
    // Toggle buttons
    modes.forEach(m => {
        const btn = document.getElementById(`map-toggle-${m}`);
        if (btn) {
            if (m === mode) {
                btn.className = 'action-btn-primary map-toggle-btn';
                btn.style.color = '';
                btn.style.borderColor = '';
            } else {
                btn.className = 'action-btn-secondary map-toggle-btn';
                btn.style.color = 'var(--text-secondary)';
                btn.style.borderColor = 'var(--border-color)';
            }
        }
    });

    // Toggle canvases
    const canvases = {
        'leaflet': document.getElementById('sites-map-canvas'),
        'windy': document.getElementById('sites-windy-canvas'),
        'meteoparapente': document.getElementById('sites-meteoparapente-canvas'),
        'paraglidingearth': document.getElementById('sites-paraglidingearth-canvas'),
        'isofronts': document.getElementById('sites-isofronts-canvas'),
        'paraglidable': document.getElementById('sites-paraglidable-canvas')
    };

    Object.keys(canvases).forEach(k => {
        const canvas = canvases[k];
        if (canvas) {
            canvas.style.display = (k === mode) ? 'block' : 'none';
        }
    });

    // Special behavior per mode
    if (mode === 'leaflet') {
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
    } else {
        // Load default/current coordinates if not switching to Leaflet
        let lat = 46.5;
        let lon = 2.2;
        let name = "France";
        let extraId = "";
        let isGeneric = true;
        
        if (this.state._spottedSite) {
            lat = this.state._spottedSite.lat;
            lon = this.state._spottedSite.lon;
            name = this.state._spottedSite.siteName;
            extraId = this.state._spottedSite.extraId || "";
            isGeneric = false;
        } else if (this.state.userLocation) {
            lat = this.state.userLocation.lat;
            lon = this.state.userLocation.lng;
            isGeneric = false;
        }
        
        if (mode === 'isofronts') {
            this.initIsofronts();
        } else {
            this.loadIframeContent(mode, lat, lon, name, extraId, isGeneric);
        }
    }
};

SitesEngine.loadIframeContent = function (mode, lat, lon, siteName, extraId, isGeneric) {
    const nameLabels = {
        'windy': document.getElementById('windy-active-spot-name'),
        'meteoparapente': document.getElementById('meteoparapente-active-spot-name'),
        'paraglidingearth': document.getElementById('paraglidingearth-active-spot-name'),
        'paraglidable': document.getElementById('paraglidable-active-spot-name')
    };

    if (nameLabels[mode]) {
        nameLabels[mode].textContent = siteName ? siteName.toUpperCase() : "Général";
    }

    const iframes = {
        'windy': document.getElementById('windy-embed-iframe'),
        'meteoparapente': document.getElementById('meteoparapente-embed-iframe'),
        'paraglidingearth': document.getElementById('paraglidingearth-embed-iframe'),
        'paraglidable': document.getElementById('paraglidable-embed-iframe')
    };

    const openLinks = {
        'windy': document.getElementById('windy-open-link'),
        'meteoparapente': document.getElementById('meteoparapente-open-link'),
        'paraglidingearth': document.getElementById('paraglidingearth-open-link'),
        'paraglidable': document.getElementById('paraglidable-open-link')
    };

    const zoom = isGeneric ? 6 : 11;
    const paraglidableZoom = isGeneric ? 6 : 8;

    // Calculate URLs
    const urls = {
        'windy': `https://embed.windy.com/embed2.html?lat=${lat}&lon=${lon}&detailLat=${lat}&detailLon=${lon}&width=100%&height=400&zoom=${zoom}&level=surface&overlay=wind&product=ecmwf&menu=&message=true&marker=${isGeneric ? 'false' : 'true'}&calendar=now&pressure=&type=map&location=coordinates&metricWind=default&metricTemp=default&radarRange=`,
        'meteoparapente': `https://meteo-parapente.com/#/${lat},${lon},${zoom}`,
        'paraglidingearth': `https://www.paraglidingearth.com/?latlng=${lat},${lon}`,
        'paraglidable': `https://paraglidable.com/?lat=${lat}&lon=${lon}&zoom=${paraglidableZoom}`
    };

    const iframe = iframes[mode];
    if (iframe) {
        if (iframe.src !== urls[mode]) {
            iframe.src = urls[mode];
        }
    }

    const openLink = openLinks[mode];
    if (openLink) {
        let linkUrl = urls[mode];
        if (mode === 'windy') {
            linkUrl = `https://www.windy.com/?${lat},${lon},${zoom}`;
        } else if (mode === 'meteoparapente') {
            linkUrl = `https://meteo-parapente.com/#/${lat},${lon},${zoom}`;
        } else if (mode === 'paraglidingearth') {
            linkUrl = `https://www.paraglidingearth.com/?latlng=${lat},${lon}`;
        } else if (mode === 'paraglidable') {
            linkUrl = `https://paraglidable.com/?lat=${lat}&lon=${lon}&zoom=${paraglidableZoom}`;
        }
        openLink.href = linkUrl;
    }
};

SitesEngine.focusSiteMap = function (mode, lat, lon, siteName, extraId) {
    const externalModes = ['meteoblue', 'windfinder', 'spotair', 'paraglidingmap'];
    if (externalModes.includes(mode)) {
        let url = "";
        if (mode === 'meteoblue') {
            const latVal = Math.abs(lat);
            const lonVal = Math.abs(lon);
            const latDir = lat >= 0 ? 'N' : 'S';
            const lonDir = lon >= 0 ? 'E' : 'W';
            url = `https://www.meteoblue.com/fr/meteo/semaine/${latVal}${latDir}${lonVal}${lonDir}`;
        } else if (mode === 'windfinder') {
            url = `https://fr.windfinder.com/#11/${lat}/${lon}`;
        } else if (mode === 'spotair') {
            url = extraId ? `https://www.spotair.mobi/spot/ffvl/${extraId}` : `https://www.spotair.mobi/`;
        } else if (mode === 'paraglidingmap') {
            url = `https://www.paraglidingmap.com/app/?lat=${lat}&lng=${lon}&zoom=11`;
        }
        if (url) {
            window.open(url, '_blank');
        }
        return;
    }

    this.switchMapMode(mode);
    this.loadIframeContent(mode, lat, lon, siteName, extraId);

    const mapView = document.getElementById('sites-map-view');
    if (mapView) {
        mapView.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
};

SitesEngine.focusSiteWindy = function (lat, lon, siteName) {
    this.focusSiteMap('windy', lat, lon, siteName);
};

SitesEngine.toggleFullscreen = function () {
        const mapView = document.getElementById('sites-map-view');
        const fsBtn = document.getElementById('map-toggle-fullscreen');
        if (!mapView || !fsBtn) return;

        const isFullscreen = mapView.classList.toggle('map-view-fullscreen');

        if (isFullscreen) {
            document.body.style.overflow = 'hidden';
            document.documentElement.style.overflow = 'hidden';
            fsBtn.innerHTML = '<i class="ri-fullscreen-exit-line"></i> <span>Réduire</span>';
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
            fsBtn.innerHTML = '<i class="ri-fullscreen-line"></i> <span>Plein écran</span>';
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

/* ============================================================
   ISOFRONTS
   Redirige vers meteofrance.com/isofronts car les APIs tierces
   (wetterzentrale, dwd) bloquent le hotlinking ou ont changé d'URL.
   ============================================================ */

SitesEngine.initIsofronts = function () {
    // Panneau statique Météo-France — rien à charger dynamiquement
};
/* ============================================================
   SPOT IT
   Scrolle vers les cartes en haut et parametre toutes les
   cartes disponibles en iframe sur les coordonnees du site.
   ============================================================ */

SitesEngine.spotSite = function (lat, lon, siteName, extraId) {
    // 1. Scroll to the top map view
    var mapView = document.getElementById('sites-map-view');
    if (mapView) {
        mapView.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // 2. Switch to Windy as main visible map
    this.switchMapMode('windy');

    // 3. Load all iframe maps with the site coordinates
    ['windy', 'meteoparapente', 'paraglidingearth', 'paraglidable'].forEach(function(mode) {
        SitesEngine.loadIframeContent(mode, lat, lon, siteName, extraId);
    });

    // 4. Update the leaflet marker focus
    if (this.state.map) {
        this.state.map.setView([lat, lon], 13, { animate: true });
    }

    // 5. Store last spotted site for the "Plus" dropdown
    this.state._spottedSite = { lat: lat, lon: lon, siteName: siteName, extraId: extraId };

    // 6. Show a brief toast feedback
    this.showSpotItToast(siteName);
};

SitesEngine.showSpotItToast = function (siteName) {
    var toast = document.getElementById('spot-it-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'spot-it-toast';
        toast.className = 'spot-it-toast';
        document.body.appendChild(toast);
    }
    toast.innerHTML = '<i class="ri-focus-3-line"></i> Cartes centrees sur <strong>' + siteName + '</strong>';
    toast.classList.add('visible');
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(function() {
        toast.classList.remove('visible');
    }, 2500);
};

/* ============================================================
   "PLUS" DROPDOWN — cartes externes sans iframe
   (Meteoblue, Windfinder, Spotair, ParaglidingMap)
   Ouvre dans un nouvel onglet sur le spot actif.
   ============================================================ */

SitesEngine.openMoreMapsDropdown = function () {
    var sheet = document.getElementById('more-maps-bottom-sheet');
    if (!sheet) return;

    var spotted = this.state._spottedSite || null;
    var lat = spotted ? spotted.lat : null;
    var lon = spotted ? spotted.lon : null;
    var siteName = spotted ? spotted.siteName : null;
    var extraId = spotted ? spotted.extraId : null;

    var mbUrl = 'https://www.meteoblue.com/';
    if (lat && lon) {
        var latVal = Math.abs(lat);
        var lonVal = Math.abs(lon);
        var latDir = lat >= 0 ? 'N' : 'S';
        var lonDir = lon >= 0 ? 'E' : 'W';
        mbUrl = 'https://www.meteoblue.com/fr/meteo/semaine/' + latVal + latDir + lonVal + lonDir;
    }

    var links = [
        {
            label: 'Meteoblue',
            icon: 'ri-temp-hot-line',
            cls: 'mb-btn',
            url: mbUrl
        },
        {
            label: 'Windfinder',
            icon: 'ri-compass-line',
            cls: 'wf-btn',
            url: lat ? ('https://fr.windfinder.com/#11/' + lat + '/' + lon) : 'https://www.windfinder.com/'
        },
        {
            label: 'Paragliding Map',
            icon: 'ri-map-pin-line',
            cls: 'pm-btn',
            url: lat ? ('https://www.paraglidingmap.com/app/?lat=' + lat + '&lng=' + lon + '&zoom=11') : 'https://www.paraglidingmap.com/'
        }
    ];

    if (extraId) {
        links.splice(2, 0, {
            label: 'Spotair',
            icon: 'ri-radar-line',
            cls: 'sa-btn',
            url: 'https://www.spotair.mobi/spot/ffvl/' + extraId
        });
    }

    const internalMaps = [
        { id: 'leaflet', label: 'Cartographie', icon: 'ri-map-2-line' },
        { id: 'windy', label: 'Windy', icon: 'ri-windy-line' },
        { id: 'meteoparapente', label: 'Météo-P.', icon: 'ri-cloud-windy-line' },
        { id: 'paraglidingearth', label: 'PG Earth', icon: 'ri-earth-line' },
        { id: 'paraglidable', label: 'Paraglidable', icon: 'ri-flight-takeoff-line' },
        { id: 'isofronts', label: 'Fronts & Isobares', icon: 'ri-mist-line' }
    ];

    internalMaps.forEach(function(m) {
        if (!SitesEngine.state.activeMapLayers.includes(m.id)) {
            links.push({
                label: m.label,
                icon: m.icon,
                cls: 'internal-map-btn',
                onclick: "SitesEngine.switchMapMode('" + m.id + "'); SitesEngine.closeMoreMapsDropdown();",
                url: '#'
            });
        }
    });

    var grid = document.getElementById('more-maps-grid');
    if (grid) {
        grid.innerHTML = links.map(function(link) {
            if (link.onclick) {
                return '<a href="#" class="external-link-btn ' + link.cls + ' more-map-link" onclick="' + link.onclick + ' event.preventDefault();">' +
                    '<i class="' + link.icon + '"></i> ' + link.label + '</a>';
            }
            return '<a href="' + link.url + '" target="_blank" class="external-link-btn ' + link.cls + ' more-map-link" onclick="SitesEngine.closeMoreMapsDropdown()">' +
                '<i class="' + link.icon + '"></i> ' + link.label + '</a>';
        }).join('');
    }

    var title = document.getElementById('more-maps-title');
    if (title) {
        title.textContent = siteName ? siteName.toUpperCase() : 'CARTES EXTERNES';
    }

    var subtitle = document.getElementById('more-maps-subtitle');
    if (subtitle) {
        subtitle.textContent = siteName
            ? 'Ouvrir dans un nouvel onglet sur ce spot'
            : 'Aucun site spotte — cliquez Spot It sur une fiche d\'abord';
    }

    sheet.classList.add('active');
};

SitesEngine.closeMoreMapsDropdown = function () {
    var sheet = document.getElementById('more-maps-bottom-sheet');
    if (sheet) sheet.classList.remove('active');
};
