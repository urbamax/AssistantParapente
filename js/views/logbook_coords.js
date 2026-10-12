/**
 * VIEW - Logbook coordinates picker
 * Base class of LogbookView (see logbook.js): the place coordinates block of the session form
 * (status, typed coordinates, map pin picker). Kept in its own file so logbook.js stays smaller;
 * behaviour is unchanged.
 */
import LogbookService from '../services/logbook_service.js';
import { escapeHTML } from '../core/security.js';
import { parseCoordinates, formatCoordinates } from '../utils/geo_utils.js';
import { t } from '../utils/i18n.js';
import { LogbookHistoryBase } from './logbook_history.js';

export class LogbookCoordsBase extends LogbookHistoryBase {
    constructor() {
        super();
        this.currentFormType = 'vol';
    }

    renderCoordsBlock() {
        return `
                    <div class="lb-coords-block" style="margin-top: 6px;">
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 0.82rem;">
                            <button type="button" data-action="toggleCoordsPicker" aria-expanded="false" aria-controls="lb-coords-panel" style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border: 1px solid var(--border-light, #ccc); border-radius: var(--radius-sm); background: none; color: var(--accent-blue); cursor: pointer; font-size: 0.82rem;">
                                <i class="ri-map-pin-line" aria-hidden="true"></i> <span id="lb-coords-toggle-label">${escapeHTML(t('logbook.coords.open'))}</span>
                            </button>
                            <span id="lb-coords-status" style="color: var(--text-muted);"></span>
                        </div>
                        <div id="lb-coords-panel" hidden style="margin-top: 8px;">
                            <label for="lb-coords">${escapeHTML(t('logbook.coords.label'))}</label>
                            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                                <input type="text" id="lb-coords" autocomplete="off" spellcheck="false" placeholder="${escapeHTML(t('logbook.coords.placeholder'))}" aria-describedby="lb-coords-hint lb-coords-error" style="flex: 1 1 14rem; min-width: 0;">
                                <button type="button" data-action="clearCoords" style="padding: 4px 10px; border: 1px solid var(--border-light, #ccc); border-radius: var(--radius-sm); background: none; color: var(--text-secondary); cursor: pointer; font-size: 0.82rem; white-space: nowrap;">${escapeHTML(t('logbook.coords.clear'))}</button>
                            </div>
                            <small id="lb-coords-hint" style="display: block; margin-top: 4px; color: var(--text-muted);">${escapeHTML(t('logbook.coords.hint'))}</small>
                            <div id="lb-coords-error" role="alert" hidden style="margin-top: 4px; color: #ef4444; font-size: 0.82rem;">${escapeHTML(t('logbook.coords.invalid'))}</div>
                            <div id="lb-coords-map" aria-label="${escapeHTML(t('logbook.coords.mapLabel'))}" style="height: 280px; margin-top: 8px; border-radius: 8px; border: 1px solid var(--border-light, #ccc);"></div>
                        </div>
                    </div>`;
    }

    getPlaceName() {
        const el = /** @type {HTMLInputElement} */ (
            document.getElementById(this.currentFormType === 'vol' ? 'lb-site' : 'lb-lieu')
        );
        return el ? el.value.trim() : '';
    }

    // Site de la base rapproché du lieu saisi (recherche approximative par mots), s'il y en a un.
    getKnownSiteCoords() {
        const name = this.getPlaceName();
        if (!name) return null;
        const site = this.findSiteByName(name);
        const coords = this.getSiteCoords(site);
        return Number.isFinite(Number(coords.lat)) && Number.isFinite(Number(coords.lon)) && coords.lat && coords.lon
            ? { name: site.nom || site.name || '', lat: Number(coords.lat), lon: Number(coords.lon) }
            : null;
    }

    updateCoordsStatus() {
        const status = document.getElementById('lb-coords-status');
        const input = /** @type {HTMLInputElement} */ (document.getElementById('lb-coords'));
        if (!status || !input) return;
        const coords = parseCoordinates(input.value);
        let text = '';
        if (coords) {
            const formatted = formatCoordinates(coords.lat, coords.lon);
            text =
                this.coordsAutoFilled === input.value
                    ? t('logbook.coords.statusFromHistory', { coords: formatted })
                    : t('logbook.coords.statusChosen', { coords: formatted });
        } else if (!input.value.trim() && this.getPlaceName()) {
            const known = this.getKnownSiteCoords();
            text = known
                ? t('logbook.coords.statusKnownSite', { name: known.name })
                : t('logbook.coords.statusMissing');
        }
        status.textContent = text;
    }

    // Lieu modifié : un lieu déjà utilisé reprend les coordonnées de sa dernière session. Elles passent
    // avant la base des sites, dont la recherche par mots peut rapprocher « Equihen terrain » d'un autre site.
    onPlaceChanged() {
        const input = /** @type {HTMLInputElement} */ (document.getElementById('lb-coords'));
        if (!input) return;
        if (this.coordsAutoFilled && input.value === this.coordsAutoFilled) {
            input.value = '';
            this.coordsAutoFilled = null;
        }
        if (!input.value.trim()) {
            const previous = LogbookService.findLastCoordsForPlace(this.getPlaceName());
            if (previous) {
                input.value = formatCoordinates(previous.lat, previous.lon);
                this.coordsAutoFilled = input.value;
            }
        }
        this.updateCoordsStatus();
        this.placeCoordsPin(true);
    }

    onCoordsTyped() {
        this.coordsAutoFilled = null;
        const input = /** @type {HTMLInputElement} */ (document.getElementById('lb-coords'));
        if (input && (!input.value.trim() || parseCoordinates(input.value))) this.hideCoordsError();
        this.updateCoordsStatus();
        this.placeCoordsPin(true);
    }

    showCoordsError() {
        const panel = document.getElementById('lb-coords-panel');
        if (panel && panel.hidden) this.toggleCoordsPicker();
        const error = document.getElementById('lb-coords-error');
        if (error) error.hidden = false;
        document.getElementById('lb-coords')?.focus();
    }

    hideCoordsError() {
        const error = document.getElementById('lb-coords-error');
        if (error) error.hidden = true;
    }

    toggleCoordsPicker() {
        const panel = document.getElementById('lb-coords-panel');
        const button = document.querySelector('[data-action="toggleCoordsPicker"]');
        const label = document.getElementById('lb-coords-toggle-label');
        if (!panel) return;
        panel.hidden = !panel.hidden;
        if (button) button.setAttribute('aria-expanded', String(!panel.hidden));
        if (label) label.textContent = t(panel.hidden ? 'logbook.coords.open' : 'logbook.coords.close');
        if (!panel.hidden) this.ensureCoordsMap();
    }

    clearCoords() {
        const input = /** @type {HTMLInputElement} */ (document.getElementById('lb-coords'));
        if (input) input.value = '';
        this.coordsAutoFilled = null;
        this.hideCoordsError();
        if (this.coordsMarker) {
            this.coordsMarker.remove();
            this.coordsMarker = null;
        }
        this.updateCoordsStatus();
    }

    // Carte créée seulement à l'ouverture : aucun fond de carte n'est demandé avant (spec 009).
    ensureCoordsMap() {
        const mapEl = document.getElementById('lb-coords-map');
        if (!mapEl) return;
        if (this.coordsMap) {
            this.coordsMap.invalidateSize();
            return;
        }
        if (typeof L === 'undefined') {
            mapEl.textContent = t('logbook.coords.mapUnavailable');
            return;
        }
        const esri = (service, maxNativeZoom) =>
            L.tileLayer(`https://server.arcgisonline.com/ArcGIS/rest/services/${service}/MapServer/tile/{z}/{y}/{x}`, {
                attribution: 'Tiles &copy; Esri',
                // CORS : réponses lisibles, donc gardées pour le hors-ligne par le service worker (spec 008).
                crossOrigin: true,
                maxZoom: 19,
                maxNativeZoom,
            });
        const satellite = esri('World_Imagery', 18);
        const topo = esri('World_Topo_Map', 16);

        this.coordsMap = L.map(mapEl, { layers: [satellite] });
        L.control
            .layers({ [t('logbook.coords.layerSatellite')]: satellite, [t('logbook.coords.layerTopo')]: topo })
            .addTo(this.coordsMap);
        this.coordsMap.on('click', (e) => this.setPickedCoords(e.latlng.lat, e.latlng.lng));

        const input = /** @type {HTMLInputElement} */ (document.getElementById('lb-coords'));
        const chosen = parseCoordinates(input ? input.value : '');
        const known = this.getKnownSiteCoords();
        if (chosen) this.coordsMap.setView([chosen.lat, chosen.lon], 16);
        else if (known) this.coordsMap.setView([known.lat, known.lon], 14);
        else this.coordsMap.setView([46.6, 2.4], 5);
        this.placeCoordsPin(false);
    }

    setPickedCoords(lat, lon) {
        const input = /** @type {HTMLInputElement} */ (document.getElementById('lb-coords'));
        if (!input) return;
        input.value = formatCoordinates(lat, lon);
        this.coordsAutoFilled = null;
        this.hideCoordsError();
        this.updateCoordsStatus();
        this.placeCoordsPin(false);
    }

    // Place (ou retire) le repère selon le champ texte ; recentre la carte si demandé.
    placeCoordsPin(recenter) {
        if (!this.coordsMap) return;
        const input = /** @type {HTMLInputElement} */ (document.getElementById('lb-coords'));
        const coords = parseCoordinates(input ? input.value : '');
        if (!coords) {
            if (this.coordsMarker && input && !input.value.trim()) {
                this.coordsMarker.remove();
                this.coordsMarker = null;
            }
            return;
        }
        const latLng = [coords.lat, coords.lon];
        if (!this.coordsMarker) {
            this.coordsMarker = L.marker(latLng, {
                draggable: true,
                icon: L.divIcon({
                    className: 'lb-coords-pin',
                    html: '<i class="ri-map-pin-fill" aria-hidden="true" style="font-size: 32px; line-height: 1; color: #ef4444; text-shadow: 0 1px 3px rgba(0,0,0,0.5);"></i>',
                    iconSize: [32, 32],
                    iconAnchor: [16, 32],
                }),
            }).addTo(this.coordsMap);
            this.coordsMarker.on('dragend', () => {
                const pos = this.coordsMarker.getLatLng();
                this.setPickedCoords(pos.lat, pos.lng);
            });
        } else {
            this.coordsMarker.setLatLng(latLng);
        }
        if (recenter) this.coordsMap.setView(latLng, Math.max(this.coordsMap.getZoom(), 14));
    }

    releaseCoordsMap() {
        if (this.coordsMap) this.coordsMap.remove();
        this.coordsMap = null;
        this.coordsMarker = null;
        this.coordsAutoFilled = null;
    }
}
