/**
 * Composant Map3D
 * Gère l'affichage de la trace IGC en 3D avec MapLibre GL JS
 */
const Map3DComponent = {
    activeInterval: null,

    /**
     * Initialise et affiche la trace 3D dans le conteneur donné.
     * @param {string} sessionId L'ID de la session
     * @param {Array} traceGps Le tableau de points GPS
     * @param {HTMLElement} container L'élément DOM conteneur
     */
    showTrace: function (sessionId, traceGps, container) {
        if (!traceGps || traceGps.length === 0) return;

        if (typeof maplibregl === 'undefined') {
            console.error("MapLibre GL JS n'est pas chargé.");
            return;
        }

        // Nettoyage de l'intervalle précédent
        this.clearPlayback();

        container.style.display = 'block';
        container.innerHTML = `
            <div id="player-3d-wrapper-${sessionId}" style="display: flex; flex-direction: column; width: 100%; height: 100%; background: var(--bg-surface);">
                <div style="position: relative; flex: 1; min-height: 400px; width: 100%; border-radius: var(--radius-md); overflow: hidden; border: 1px solid var(--border-light);">
                    <div id="map-3d-container-${sessionId}" style="position: absolute; top: 0; left: 0; height: 100%; width: 100%; background: #eee;"></div>
                </div>
                <div style="padding: 10px; background: var(--bg-card); display: flex; flex-direction: column; gap: 10px; margin-top: 10px; border-radius: var(--radius-md);">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <button id="play-btn-${sessionId}" class="action-btn-primary" style="padding: 4px 12px; min-width: 60px;"><i class="ri-play-fill"></i></button>
                        <input type="range" id="slider-${sessionId}" min="0" max="${traceGps.length - 1}" value="0" style="flex: 1; cursor: pointer;">
                    </div>
                    <div id="info-${sessionId}" style="font-size: 0.85rem; font-family: monospace; color: var(--text-secondary); text-align: center;">
                        Heure : --:--:--
                    </div>
                </div>
            </div>
        `;

        const slider = document.getElementById(`slider-${sessionId}`);
        const playBtn = document.getElementById(`play-btn-${sessionId}`);
        const info = document.getElementById(`info-${sessionId}`);

        let map3D = null;

        const updatePosition = () => {
            const index = parseInt(slider.value, 10);
            const pt = traceGps[index];

            // Update Map Center and Symbol
            if (map3D && map3D.isStyleLoaded()) {
                const source = map3D.getSource('pilot-source');
                if (source) {
                    const previous = traceGps[index > 0 ? index - 1 : index];
                    const timeToSecs = (tStr) => { const p = tStr.split(':'); return parseInt(p[0]) * 3600 + parseInt(p[1]) * 60 + parseInt(p[2]); };
                    const timeDiff = timeToSecs(pt.time) - timeToSecs(previous.time);
                    const altitudeDiff = pt.alt - previous.alt;
                    const vario = timeDiff > 0 ? (altitudeDiff / timeDiff).toFixed(1) : "0.0";

                    source.setData({
                        type: 'Feature',
                        properties: { altitude: Math.round(pt.alt).toString(), vario: vario.toString() },
                        geometry: { type: 'Point', coordinates: [pt.lon, pt.lat, pt.alt] }
                    });
                }

                if (!map3D.isDragging()) {
                    map3D.easeTo({
                        center: [pt.lon, pt.lat],
                        duration: 100,
                        easing: (t) => t
                    });
                }
            }

            info.innerHTML = `Heure : <strong style="color:var(--text-primary);">${pt.time}</strong>`;
        };

        slider.addEventListener('input', () => {
            updatePosition();
            this.clearPlayback();
            playBtn.innerHTML = '<i class="ri-play-fill"></i>';
        });

        playBtn.addEventListener('click', () => {
            if (this.activeInterval) {
                this.clearPlayback();
                playBtn.innerHTML = '<i class="ri-play-fill"></i>';
            } else {
                playBtn.innerHTML = '<i class="ri-pause-fill"></i>';
                if (parseInt(slider.value, 10) >= traceGps.length - 1) {
                    slider.value = 0;
                }
                this.activeInterval = setInterval(() => {
                    let val = parseInt(slider.value, 10);
                    let step = 1;
                    if (traceGps.length > 2000) step = 3;
                    else if (traceGps.length > 1000) step = 2;

                    if (val < traceGps.length - 1) {
                        slider.value = Math.min(val + step, traceGps.length - 1);
                        updatePosition();
                    } else {
                        this.clearPlayback();
                        playBtn.innerHTML = '<i class="ri-play-fill"></i>';
                    }
                }, 100);
            }
        });

        // Setup MapLibre
        map3D = new maplibregl.Map({
            container: `map-3d-container-${sessionId}`,
            style: {
                version: 8,
                glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
                sources: {
                    'satellite': {
                        type: 'raster',
                        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
                        tileSize: 256,
                        attribution: 'Tiles &copy; Esri'
                    },
                    'terrainSource': {
                        type: 'raster-dem',
                        tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
                        encoding: 'terrarium',
                        tileSize: 256,
                        maxzoom: 14
                    }
                },
                layers: [
                    {
                        id: 'satellite',
                        type: 'raster',
                        source: 'satellite'
                    }
                ],
                terrain: {
                    source: 'terrainSource',
                    exaggeration: 1.0 // Strictly 1.0
                }
            },
            center: [traceGps[0].lon, traceGps[0].lat],
            zoom: 14,
            pitch: 60,
            bearing: 0,
            interactive: true
        });

        map3D.dragRotate.enable();
        map3D.touchZoomRotate.enable();

        map3D.addControl(new maplibregl.NavigationControl({
            visualizePitch: true,
            showZoom: true,
            showCompass: true
        }));

        map3D.addControl(new maplibregl.FullscreenControl({
            container: document.getElementById(`player-3d-wrapper-${sessionId}`)
        }));

        const initFlightLayers = () => {
            // Source unique LineString propre avec altitudes Z
            map3D.addSource('trace-source', {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    properties: {},
                    geometry: {
                        type: 'LineString',
                        coordinates: traceGps.map(pt => [pt.lon, pt.lat, pt.alt])
                    }
                }
            });

            // Calque filaire 3D (Line)
            map3D.addLayer({
                id: 'trace-line-3d',
                type: 'line',
                source: 'trace-source',
                layout: {
                    'line-join': 'round',
                    'line-cap': 'round'
                },
                paint: {
                    'line-color': '#ff6600',
                    'line-width': 4,
                    'line-opacity': 0.95
                }
            });

            // Badge WebGL
            const currentPt = traceGps[parseInt(slider.value, 10)];
            map3D.addSource('pilot-source', {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    properties: { altitude: Math.round(currentPt.alt).toString(), vario: "0.0" },
                    geometry: { type: 'Point', coordinates: [currentPt.lon, currentPt.lat, currentPt.alt] }
                }
            });

            map3D.addLayer({
                id: 'pilot-badge',
                type: 'symbol',
                source: 'pilot-source',
                layout: {
                    'text-field': ['concat', ['get', 'altitude'], 'm\n', ['get', 'vario'], ' m/s'],
                    'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
                    'text-size': 12,
                    'text-anchor': 'bottom',
                    'text-offset': [0, -1.2],
                    'text-justify': 'center',
                    'text-pitch-alignment': 'viewport',
                    'text-allow-overlap': true,
                    'text-ignore-placement': true
                },
                paint: {
                    'text-color': '#ffffff',
                    'text-halo-color': '#ff6600',
                    'text-halo-width': 2.5
                }
            });

            updatePosition();

            const bounds = new maplibregl.LngLatBounds(
                [traceGps[0].lon, traceGps[0].lat],
                [traceGps[0].lon, traceGps[0].lat]
            );
            for (const pt of traceGps) {
                bounds.extend([pt.lon, pt.lat]);
            }
            map3D.fitBounds(bounds, {
                padding: 50,
                pitch: 60,
                bearing: 0
            });
        };

        map3D.once('idle', () => {
            initFlightLayers();
        });
    },

    clearPlayback: function () {
        if (this.activeInterval) {
            clearInterval(this.activeInterval);
            this.activeInterval = null;
        }
    }
};

window.Map3DComponent = Map3DComponent;
