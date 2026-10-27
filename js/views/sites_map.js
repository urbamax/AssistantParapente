/**
 * VIEW - Sites map
 * Base class of SitesView (see sites.js): the Leaflet map of the Sites screen: tiles, markers
 * and popups, GPS and Spotair menus, map modes and iframes, full screen and the extra-maps
 * dropdown. Kept in its own file so sites.js stays smaller; behaviour is unchanged.
 */
import SitesService from '../services/sites_service.js';
import { RADIUS } from '../data/weather_config.js';
import { escapeHTML, safeHttpUrl } from '../core/security.js';
import {
    forecastValue,
    missingValuesText,
    verdictColor,
    verdictReminderHtml,
    modelAgreementHtml,
    forecastContextHtml,
    verdictLabel,
} from './sites_forecast.js';
import { tt, th, tl } from './sites_strings.js';
import BaseView from '../core/base_view.js';

export class SitesMapBase extends BaseView {
    // À fournir par SitesListBase (fait défiler jusqu'à la fiche d'un site).
    /** @param {string|number} _siteId */
    jumpToSiteCard(_siteId) {
        throw new Error('SitesListBase must implement jumpToSiteCard()');
    }

    constructor() {
        super();
        this.state = {
            map: null,
            markersGroup: null,
            tileLayer: null,
            mapResizeObserver: null,
            mapExpanded: true,
            expandedSites: {},
            currentSiteCoords: null,
            _spottedSite: null,
            showComparator: false,
        };
    }

    initMap() {
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

        this.fitMapToRadius();
        this.bindMapSync();
    }

    /**
     * Cadre la carte sur le cercle du rayon autour de la position de référence (GPS, adresse ou
     * Boulogne-sur-Mer) — jamais sur l'étendue de tous les marqueurs : un favori lointain reste
     * affiché sans faire dézoomer la carte (spec 004, FR-001/FR-002).
     */
    fitMapToRadius() {
        if (!this.state.map) return;
        const ref = SitesService.getEffectiveLocation();
        const diameterMeters = SitesService.state.radiusLimit * 2 * 1000;
        this.state.isProgrammaticZoom = true;
        try {
            this.state.map.fitBounds(L.latLng(ref.lat, ref.lng).toBounds(diameterMeters), { padding: [20, 20] });
        } catch {
            this.state.map.setView([ref.lat, ref.lng], 9);
        }
        if (this._progZoomTimeout) clearTimeout(this._progZoomTimeout);
        this._progZoomTimeout = setTimeout(() => {
            this.state.isProgrammaticZoom = false;
        }, 1000);
    }

    bindMapSync() {
        if (!this.state.map) return;

        // Le rayon ne suit la carte qu'après un geste du pilote sur la carte (glisser, molette,
        // pincer, boutons, clavier). Un redimensionnement, le chargement des fonds ou un cadrage
        // automatique déclenchent aussi « moveend » : les suivre faisait grandir le rayon en
        // boucle jusqu'à 200 km (spec 004, FR-004).
        const container = this.state.map.getContainer();
        if (this._gestureContainer !== container) {
            this._gestureContainer = container; // la carte est recréée à chaque retour sur l'écran
            const markGesture = () => {
                this._lastMapGestureAt = Date.now();
            };
            ['pointerdown', 'wheel', 'touchstart', 'keydown'].forEach((type) =>
                container.addEventListener(type, markGesture, { passive: true }),
            );
        }

        this.state.map.off('zoomend moveend');
        this.state.map.on('zoomend moveend', (e) => {
            if (this.state.isProgrammaticZoom) return;
            if (!this._lastMapGestureAt || Date.now() - this._lastMapGestureAt > 1500) return;

            try {
                let radius;
                const bounds = this.state.map.getBounds();
                if (!bounds || !bounds.isValid()) return;

                // Même position de référence que le filtre du rayon : GPS, adresse, ou
                // Boulogne-sur-Mer par défaut (spec 002, FR-017) — jamais le centre de la carte.
                const reference = SitesService.getEffectiveLocation();
                if (reference && reference.lat !== undefined) {
                    const userLatLng = L.latLng(reference.lat, reference.lng);
                    const corners = [
                        bounds.getNorthWest(),
                        bounds.getNorthEast(),
                        bounds.getSouthWest(),
                        bounds.getSouthEast(),
                    ];
                    let maxDistance = 0;
                    for (const corner of corners) {
                        const dist = userLatLng.distanceTo(corner) / 1000;
                        if (dist > maxDistance) maxDistance = dist;
                    }
                    radius = Math.round(maxDistance / 10) * 10;
                } else {
                    const center = this.state.map.getCenter();
                    const northEast = bounds.getNorthEast();
                    radius = Math.round(center.distanceTo(northEast) / 1000 / 10) * 10;
                }

                // Le zoom de la carte ne peut plus repasser en « Illimité » (spec 002, FR-015).
                radius = Math.min(RADIUS.MAX, Math.max(RADIUS.MIN, radius));

                if (SitesService.state.radiusLimit !== radius) {
                    this.state.ignoreNextFitBounds = true;
                    const slider = /** @type {HTMLInputElement} */ (document.getElementById('radius-slider'));
                    if (slider) {
                        slider.value = radius;
                        slider.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                    setTimeout(() => {
                        this.state.ignoreNextFitBounds = false;
                    }, 600);
                }
            } catch (err) {
                console.error('Map sync error', err);
            }
        });
    }

    updateMapTiles() {
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
        this.state.tileLayer = L.tileLayer(
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
            {
                attribution: 'Tiles &copy; Esri',
                // CORS : réponses lisibles, donc gardées pour le hors-ligne par le service worker (spec 008).
                crossOrigin: true,
                maxZoom: 17,
                maxNativeZoom: 15, // Astuce Ligne Claire : Étire les tuiles (lignes épaisses, pas de lissage)
            },
        ).addTo(this.state.map);

        // 2. On supprime la surcouche de relief car Esri intègre déjà un relief très doux et plat
        if (SitesService.state.hillshadeLayer) {
            this.state.map.removeLayer(SitesService.state.hillshadeLayer);
            SitesService.state.hillshadeLayer = null;
        }
    }

    // Génère l'URL de l'icône SVG officielle FFVL/SpotAir pour un site (type de pratique +
    // secteurs de vent favorables), voir ideas_roadmap.md section 1 pour la spec de l'API.
    updateMapMarkers() {
        if (!this.state.map || !this.state.markersGroup) return;
        this.state.markersGroup.clearLayers();

        const activeSites = SitesService.getFilteredAndSortedSites(SitesService.getSites());

        activeSites.forEach((site) => {
            let flyableClass = 'weather-unknown';
            const weather = (SitesService.state.weatherForecasts[site.id] || [])[SitesService.state.forecastOffset];
            const status = weather ? SitesService.isForecastFlyable(site, weather) : null;
            if (status) flyableClass = status.class;
            const color = verdictColor(status);
            const isIncomplete = status?.status === 'incomplete';
            // Pas de pulsation pour un site dont l'orientation est inconnue (spec 001, US2).
            const isCurrentlyFlyable = status?.flyable && !status.warning;
            const pulseHtml = isCurrentlyFlyable
                ? `<div class="marker-pulse" style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background: ${color}; opacity: 0.35; animation: marker-pulse-anim 1.8s infinite ease-out;"></div>`
                : '';
            const iconHtml = `<div class="custom-map-marker ${flyableClass}" style="position: relative; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;" title="${escapeHTML(site.nom)}">${pulseHtml}${
                isIncomplete
                    ? `<div class="marker-core marker-core--incomplete" title="${escapeHTML(verdictLabel(status))}">?</div>`
                    : `<div class="marker-core" style="width: 14px; height: 14px; border-radius: 50%; background: ${color}; border: 2px solid var(--bg-surface); box-shadow: 0 2px 6px rgba(0,0,0,0.4); z-index: 2; transition: background-color 0.3s;"></div>`
            }</div>`;
            const marker = L.marker([parseFloat(site.latitude || site.lat), parseFloat(site.longitude || site.lon)], {
                icon: L.divIcon({
                    html: iconHtml,
                    className: 'leaflet-custom-icon',
                    iconSize: [30, 30],
                    iconAnchor: [15, 15],
                }),
                title: site.nom,
            });
            marker.bindTooltip(site.nom, { direction: 'top', offset: [0, -15], opacity: 0.9 });
            marker.on('click', (e) => {
                this.jumpToSiteCard(site.id);
            });
            this.state.markersGroup.addLayer(marker);
        });

        if (this.state.map && !this.state.ignoreNextFitBounds) {
            this.fitMapToRadius();
        }
    }

    buildWeatherPopupHtml(weather, color, site) {
        const status = SitesService.isForecastFlyable(site, weather);
        const missing = missingValuesText(status);
        return `<div style="margin-top: 8px; padding: 8px; border-radius: 6px; background: rgba(0,0,0,0.1); border: 1px solid var(--border-color); font-size: 0.85rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; gap: 8px;">
                <span style="font-weight: 700; white-space: nowrap;"><i class="ri-windy-line"></i> ${tt('popup.wind', { card: forecastValue(weather.windCard), speed: forecastValue(weather.windSpeed) })}</span>
                <span style="color: ${status.status === 'incomplete' ? 'var(--text-muted)' : color}; font-weight: bold; font-size: 0.75rem;"><i class="${status.icon}"></i> ${escapeHTML(status.reason)}</span>
            </div>
            <div style="opacity: 0.8; font-size: 0.8rem;">${tt('popup.gusts', { gust: forecastValue(weather.windGust) })}</div>
            ${missing ? `<div class="weather-missing-values" style="margin-top: 4px; font-size: 0.8rem;">${escapeHTML(missing)}</div>` : ''}
            ${status.status === 'incomplete' ? '' : modelAgreementHtml(site)}
            ${forecastContextHtml(site.id)}
            ${verdictReminderHtml(status)}
        </div>`;
    }

    buildMapPopupHtml(site, weatherPopupHtml) {
        return `<div class="map-popup-card" style="font-family: var(--font-main); color: var(--text-main); width: 220px;">
            <h4 style="margin: 0 0 4px 0; font-size: 1rem; font-weight: 700;">${escapeHTML(site.nom)}</h4>
            ${weatherPopupHtml}
            <div style="display: flex; gap: 6px; margin-top: 10px;">
                ${
                    safeHttpUrl(site.url)
                        ? `
                <a class="action-btn-secondary ffvl-btn" href="${escapeHTML(safeHttpUrl(site.url))}" target="_blank" rel="noopener noreferrer" style="padding: 6px 8px; display: inline-flex; align-items: center; justify-content: center; text-decoration: none;" title="${tt('popup.ffvlTitle')}">
                    <img src="img/logos/ffvl.png" alt="${tt('card.ffvl')}" style="width: 14px; height: 14px; border-radius: 2px;">
                </a>
                `
                        : ''
                }
                <button class="action-btn-primary" data-action="openGpsMenu" data-args="'${parseFloat(site.latitude || site.lat)}', '${parseFloat(site.longitude || site.lon)}'" style="flex: 1; padding: 6px 10px; font-size: 0.8rem; justify-content: center;">
                    <i class="ri-navigation-line"></i> ${tt('card.goThere')}
                </button>
                <button class="action-btn-secondary windy-btn" data-action="focusSiteWindy" data-args="'${parseFloat(site.latitude || site.lat)}', '${parseFloat(site.longitude || site.lon)}', '${escapeHTML(site.nom)}'" style="padding: 6px 8px;" title="${tt('popup.windyTitle')}">
                    <i class="ri-windy-line"></i>
                </button>
                <button class="action-btn-secondary paraglidable-btn" data-action="focusSiteMap" data-args="'paraglidable', '${parseFloat(site.latitude || site.lat)}', '${parseFloat(site.longitude || site.lon)}', '${escapeHTML(site.nom)}'" style="padding: 6px 8px;" title="${tt('popup.paraglidableTitle')}">
                    <i class="ri-flight-takeoff-line"></i>
                </button>
            </div>
        </div>`;
    }

    openGpsMenu(lat, lng) {
        this.state.currentSiteCoords = { lat, lng };
        const sheet = document.getElementById('gps-bottom-sheet');
        if (sheet) sheet.classList.add('active');
    }

    closeGpsMenu() {
        const sheet = document.getElementById('gps-bottom-sheet');
        if (sheet) sheet.classList.remove('active');
        this.state.currentSiteCoords = null;
    }

    openSpotairModal(spotairId, siteId) {
        const modal = /** @type {HTMLDialogElement & { _cancelBound?: boolean }} */ (
            document.getElementById('spotair-modal')
        );
        const iframe = /** @type {HTMLIFrameElement} */ (document.getElementById('spotair-modal-iframe'));
        const titleEl = document.getElementById('spotair-modal-title');
        if (!modal || !iframe) return;

        const site = SitesService.getSiteById(siteId);
        if (titleEl)
            titleEl.textContent = site
                ? tl('maps.spotairTitleSite', { name: site.nom })
                : tl('maps.spotairTitleGeneric');
        iframe.src = `https://www.spotair.mobi/page/wind/ffvl/${spotairId}`;

        if (typeof modal.showModal === 'function' && !modal.open) {
            modal.showModal();
            if (!modal._cancelBound) {
                modal._cancelBound = true;
                modal.addEventListener('cancel', (e) => {
                    e.preventDefault();
                    this.closeSpotairModal();
                });
            }
        }
        modal.style.display = 'flex';
        void modal.offsetWidth;
        modal.classList.add('active');
    }

    closeSpotairModal() {
        const modal = /** @type {HTMLDialogElement & { _cancelBound?: boolean }} */ (
            document.getElementById('spotair-modal')
        );
        const iframe = /** @type {HTMLIFrameElement} */ (document.getElementById('spotair-modal-iframe'));
        if (!modal) return;
        modal.classList.remove('active');
        setTimeout(() => {
            if (!modal.classList.contains('active')) {
                if (typeof modal.close === 'function' && modal.open) {
                    modal.close();
                }
                modal.style.display = 'none';
                if (iframe) iframe.src = '';
            }
        }, 300);
    }

    launchGps(app) {
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
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
        this.closeGpsMenu();
    }

    switchMapMode(mode) {
        const modes = ['leaflet', 'windy', 'meteoparapente', 'paraglidingearth', 'paraglidable', 'isofronts'];

        // Toggle buttons
        modes.forEach((m) => {
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
            leaflet: document.getElementById('sites-map-canvas'),
            windy: document.getElementById('sites-windy-canvas'),
            meteoparapente: document.getElementById('sites-meteoparapente-canvas'),
            paraglidingearth: document.getElementById('sites-paraglidingearth-canvas'),
            paraglidable: document.getElementById('sites-paraglidable-canvas'),
            isofronts: document.getElementById('sites-isofronts-canvas'),
        };

        Object.keys(canvases).forEach((k) => {
            const canvas = canvases[k];
            if (canvas) {
                canvas.style.display = k === mode ? 'block' : 'none';
            }
        });

        // Special behavior per mode
        if (mode === 'leaflet') {
            if (this.state.map) {
                // Reset spotted site when returning to base map
                this.state._spottedSite = null;
                this.state.map.closePopup();

                setTimeout(() => {
                    this.state.map.invalidateSize();
                    this.fitMapToRadius(); // cercle du rayon, pas l'étendue des marqueurs (spec 004)
                }, 150);
            }
        } else {
            // Load default/current coordinates if not switching to Leaflet
            let lat = 46.5;
            let lon = 2.2;
            let name = tl('maps.defaultName');
            let extraId = '';
            let isGeneric = true;

            if (this.state._spottedSite) {
                lat = this.state._spottedSite.lat;
                lon = this.state._spottedSite.lon;
                name = this.state._spottedSite.siteName;
                extraId = this.state._spottedSite.extraId || '';
                isGeneric = false;
            } else if (SitesService.state.userLocation) {
                lat = SitesService.state.userLocation.lat;
                lon = SitesService.state.userLocation.lng;
                isGeneric = false;
            }

            if (mode === 'isofronts') {
                this.initIsofronts();
            } else {
                this.loadIframeContent(mode, lat, lon, name, extraId, isGeneric);
            }
        }
    }

    loadIframeContent(mode, lat, lon, siteName, extraId, isGeneric) {
        const nameLabels = {
            windy: document.getElementById('windy-active-spot-name'),
            meteoparapente: document.getElementById('meteoparapente-active-spot-name'),
            paraglidingearth: document.getElementById('paraglidingearth-active-spot-name'),
            paraglidable: document.getElementById('paraglidable-active-spot-name'),
        };
        if (nameLabels[mode]) {
            nameLabels[mode].textContent = siteName ? siteName.toUpperCase() : tl('maps.generic');
        }

        const iframes = {
            windy: document.getElementById('windy-embed-iframe'),
            meteoparapente: document.getElementById('meteoparapente-embed-iframe'),
            paraglidingearth: document.getElementById('paraglidingearth-embed-iframe'),
            paraglidable: document.getElementById('paraglidable-embed-iframe'),
        };

        const openLinks = {
            windy: document.getElementById('windy-open-link'),
            meteoparapente: document.getElementById('meteoparapente-open-link'),
            paraglidingearth: document.getElementById('paraglidingearth-open-link'),
            paraglidable: document.getElementById('paraglidable-open-link'),
        };

        const zoom = isGeneric ? 6 : 11;
        const paraglidableZoom = isGeneric ? 6 : 8;

        // Calculate URLs
        const urls = {
            windy: `https://embed.windy.com/embed2.html?lat=${lat}&lon=${lon}&detailLat=${lat}&detailLon=${lon}&width=100%&height=400&zoom=${zoom}&level=surface&overlay=wind&product=ecmwf&menu=&message=true&marker=${isGeneric ? 'false' : 'true'}&calendar=now&pressure=&type=map&location=coordinates&metricWind=km%2Fh&metricTemp=default&radarRange=`,
            meteoparapente: `https://meteo-parapente.com/#/${lat},${lon},${zoom}`,
            paraglidingearth: `https://www.paraglidingearth.com/?latlng=${lat},${lon}`,
            paraglidable: `https://paraglidable.com/?lat=${lat}&lon=${lon}&zoom=${paraglidableZoom}`,
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
                linkUrl = `https://www.windy.com/${lat}/${lon}?${lat},${lon},${zoom}`;
            } else if (mode === 'meteoparapente') {
                linkUrl = `https://meteo-parapente.com/#/${lat},${lon},${zoom}`;
            } else if (mode === 'paraglidingearth') {
                linkUrl = `https://www.paraglidingearth.com/?latlng=${lat},${lon}`;
            } else if (mode === 'paraglidable') {
                linkUrl = `https://paraglidable.com/?lat=${lat}&lon=${lon}&zoom=${paraglidableZoom}`;
            }
            openLink.href = linkUrl;
        }
    }

    focusSiteMap(mode, lat, lon, siteName, extraId) {
        const externalModes = ['meteoblue', 'windfinder', 'spotair', 'paraglidingmap'];
        if (externalModes.includes(mode)) {
            let url = '';
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
                window.open(url, '_blank', 'noopener,noreferrer');
            }
            return;
        }

        this.switchMapMode(mode);
        this.loadIframeContent(mode, lat, lon, siteName, extraId);

        const mapView = document.getElementById('sites-map-view');
        if (mapView) {
            mapView.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    focusSiteWindy(lat, lon, siteName) {
        this.focusSiteMap('windy', lat, lon, siteName);
    }

    toggleFullscreen() {
        const mapView = document.getElementById('sites-map-view');
        const fsBtn = document.getElementById('map-toggle-fullscreen');
        if (!mapView || !fsBtn) return;

        const isFullscreen = mapView.classList.toggle('map-view-fullscreen');

        let placeholder = document.getElementById('map-view-placeholder');
        if (!placeholder) {
            placeholder = document.createElement('div');
            placeholder.id = 'map-view-placeholder';
            placeholder.style.display = 'none';
            mapView.parentNode.insertBefore(placeholder, mapView);
        }

        if (isFullscreen) {
            document.body.appendChild(mapView);
            document.body.style.overflow = 'hidden';
            document.documentElement.style.overflow = 'hidden';
            fsBtn.innerHTML = `<i class="ri-fullscreen-exit-line"></i> <span>${tt('maps.fullscreenExit')}</span>`;
            fsBtn.classList.add('active-fs');
            if (this.state.map && document.getElementById('sites-map-canvas').style.display !== 'none') {
                setTimeout(() => {
                    this.state.map.invalidateSize();
                    this.fitMapToRadius(); // cercle du rayon, pas l'étendue des marqueurs (spec 004)
                }, 150);
            }
        } else {
            if (placeholder && placeholder.parentNode) {
                placeholder.parentNode.insertBefore(mapView, placeholder);
            }
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
            fsBtn.innerHTML = `<i class="ri-fullscreen-line"></i> <span>${tt('maps.fullscreen')}</span>`;
            fsBtn.classList.remove('active-fs');
            if (this.state.map && document.getElementById('sites-map-canvas').style.display !== 'none') {
                setTimeout(() => {
                    this.state.map.invalidateSize();
                    this.fitMapToRadius(); // cercle du rayon, pas l'étendue des marqueurs (spec 004)
                }, 150);
            }
        }
    }

    initIsofronts() {
        // Panneau statique Météo-France — rien à charger dynamiquement
    }

    spotSite(lat, lon, siteName, extraId) {
        // 1. Scroll to the top map view
        const mapView = document.getElementById('sites-map-view');
        if (mapView) {
            mapView.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        // 2. Switch to Windy as main visible map
        this.switchMapMode('windy');

        // 3. Load all iframe maps with the site coordinates
        ['windy', 'meteoparapente', 'paraglidingearth', 'paraglidable'].forEach((mode) => {
            this.loadIframeContent(mode, lat, lon, siteName, extraId);
        });

        // 4. Update the leaflet marker focus
        if (this.state.map) {
            this.state.map.setView([lat, lon], 13, { animate: true });
        }

        // 5. Store last spotted site for the "Plus" dropdown
        this.state._spottedSite = { lat: lat, lon: lon, siteName: siteName, extraId: extraId };

        // 6. Show a brief toast feedback
        this.showSpotItToast(siteName);
    }

    showSpotItToast(siteName) {
        /** @type {HTMLElement & { _hideTimer?: ReturnType<typeof setTimeout> }} */
        let toast = document.getElementById('spot-it-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'spot-it-toast';
            toast.className = 'spot-it-toast';
            document.body.appendChild(toast);
        }
        toast.innerHTML = `<i class="ri-focus-3-line"></i> ${th('maps.centeredOn', { name: `<strong>${escapeHTML(siteName)}</strong>` })}`;
        toast.classList.add('visible');
        clearTimeout(toast._hideTimer);
        toast._hideTimer = setTimeout(function () {
            toast.classList.remove('visible');
        }, 2500);
    }

    openMoreMapsDropdown() {
        const sheet = document.getElementById('more-maps-bottom-sheet');
        if (!sheet) return;

        const spotted = this.state._spottedSite || null;
        let lat = null;
        let lon = null;
        let siteName = null;
        let extraId = null;

        if (spotted) {
            lat = spotted.lat || spotted.latitude;
            lon = spotted.lon || spotted.longitude;
            siteName = spotted.siteName || spotted.nom;
            extraId = spotted.extraId || spotted.id;
        } else if (this.state.map) {
            const center = this.state.map.getCenter();
            lat = center.lat;
            lon = center.lng;
        }

        let mbUrl = 'https://www.meteoblue.com/';
        if (lat && lon) {
            const latVal = Math.abs(lat);
            const lonVal = Math.abs(lon);
            const latDir = lat >= 0 ? 'N' : 'S';
            const lonDir = lon >= 0 ? 'E' : 'W';
            mbUrl = 'https://www.meteoblue.com/fr/meteo/semaine/' + latVal + latDir + lonVal + lonDir;
        }

        const links = [
            {
                label: tl('maps.labels.meteoblue'),
                icon: 'ri-temp-hot-line',
                cls: 'mb-btn',
                url: mbUrl,
            },
            {
                label: tl('maps.labels.windfinder'),
                icon: 'ri-compass-line',
                cls: 'wf-btn',
                url: lat ? 'https://fr.windfinder.com/#11/' + lat + '/' + lon : 'https://www.windfinder.com/',
            },
            {
                label: tl('maps.labels.paraglidingmap'),
                icon: 'ri-map-pin-line',
                cls: 'pm-btn',
                url: lat
                    ? 'https://www.paraglidingmap.com/app/?lat=' + lat + '&lng=' + lon + '&zoom=11'
                    : 'https://www.paraglidingmap.com/',
            },
        ];

        if (extraId) {
            links.splice(2, 0, {
                label: tl('maps.labels.spotair'),
                icon: 'ri-radar-line',
                cls: 'sa-btn',
                url: 'https://www.spotair.mobi/spot/ffvl/' + extraId,
            });
        }

        const togglableMaps = [
            { id: 'leaflet', label: tl('maps.labels.leaflet'), icon: 'ri-map-2-line', url: '#' },
            {
                id: 'windy',
                label: tl('maps.labels.windy'),
                icon: 'ri-windy-line',
                url: lat ? 'https://www.windy.com/?' + lat + ',' + lon + ',12' : 'https://www.windy.com/',
            },
            {
                id: 'meteoparapente',
                label: tl('maps.labels.meteoparapenteShort'),
                icon: 'ri-cloud-windy-line',
                url: lat ? 'https://meteo-parapente.com/?lat=' + lat + '&lon=' + lon : 'https://meteo-parapente.com/',
            },
            {
                id: 'paraglidingearth',
                label: tl('maps.labels.paraglidingearth'),
                icon: 'ri-earth-line',
                url: 'https://www.paraglidingearth.com/',
            },
            {
                id: 'paraglidable',
                label: tl('maps.labels.paraglidable'),
                icon: 'ri-flight-takeoff-line',
                url: lat ? 'https://paraglidable.com/?lat=' + lat + '&lon=' + lon : 'https://paraglidable.com/',
            },
            {
                id: 'isofronts',
                label: tl('maps.labels.isofronts'),
                icon: 'ri-cloud-line',
                url: 'https://meteofrance.com/isofronts',
            },
        ];

        togglableMaps.forEach(function (m) {
            if (!SitesService.state.activeMapLayers.includes(m.id)) {
                links.push({
                    label: m.label,
                    icon: m.icon,
                    cls: 'internal-map-btn',
                    url: m.url,
                });
            }
        });

        const grid = document.getElementById('more-maps-grid');
        if (grid) {
            grid.innerHTML = links
                .map(function (link) {
                    if (link.onclick) {
                        return `<a href="#" class="external-link-btn ${link.cls} more-map-link" ${link.onclick}><i class="${link.icon}"></i> ${link.label}</a>`;
                    }
                    return `<a href="${link.url}" target="_blank" rel="noopener noreferrer" class="external-link-btn ${link.cls} more-map-link" data-action="closeMoreMapsDropdown"><i class="${link.icon}"></i> ${link.label}</a>`;
                })
                .join('');
        }

        const title = document.getElementById('more-maps-title');
        if (title) {
            title.textContent = siteName ? siteName.toUpperCase() : tl('maps.externalTitle');
        }

        const subtitle = document.getElementById('more-maps-subtitle');
        if (subtitle) {
            subtitle.textContent = tl(siteName ? 'maps.subtitleSpot' : 'maps.subtitleGeneric');
        }

        sheet.classList.add('active');
    }

    closeMoreMapsDropdown() {
        const sheet = document.getElementById('more-maps-bottom-sheet');
        if (sheet) sheet.classList.remove('active');
    }
}
