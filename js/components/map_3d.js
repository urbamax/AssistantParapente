/**
 * Composant Map3D
 * Rejoue une trace IGC en 3D : relief réel (MapLibre GL JS) + trace de vol à sa vraie
 * altitude, colorée par variomètre (deck.gl).
 *
 * MapLibre GL JS ne sait pas donner une altitude variable à une ligne (issue
 * maplibre/maplibre-gl-js#644, toujours ouverte à ce jour) : un calque `line` ignore le Z
 * des coordonnées et se plaque systématiquement sur le terrain. deck.gl le sait : son
 * PathLayer accepte directement des coordonnées [lon, lat, altitude_en_mètres] et rend une
 * vraie ligne 3D, sans avoir besoin d'interroger l'altitude du sol ni de bricoler un ruban
 * de polygones extrudés pour simuler l'effet. C'est l'outil fait pour ce problème plutôt
 * qu'un contournement des limites de MapLibre.
 */
import { t } from '../utils/i18n.js';
import { escapeHTML } from '../core/security.js';
const Map3DComponent = {
    activeInterval: null,
    _smoothProtocolRegistered: false,

    // --- Configuration ---------------------------------------------------------
    // 5.24.0, pas la 6.x (latest) : 6.x casse le rendu interleaved de deck.gl 9.4.0
    // (voir PR #35 pour l'investigation complète — deck.gl n'a pas encore de version
    // compatible avec MapLibre v6 au moment où ceci est écrit).
    MAPLIBRE_VERSION: '5.24.0',
    // Empreintes SRI (sha384) des fichiers CDN : à recalculer à chaque changement de version,
    // sinon le navigateur refuse de les charger.
    CDN_INTEGRITY: {
        'maplibre-gl.css': 'sha384-uTttxo/aOKbdE5RlD/SPzSDoDmNvGlUYPjONi2MN/b7c9HPSvW07OIuyP7uL6jxK',
        'maplibre-gl.js': 'sha384-5+cfbwT0iiub6VsQAdn6yz16nr6sDiQoHx6tm4O8OVYXHYOxcffFmCJBL0dgdvGp',
        'deck.gl.js': 'sha384-NrpHmp6N6IhXZ+gSV+uRLo+Hqprkw4BfdGzmxgWXhjakjkAabyfQxokSmn/aK0VB',
    },
    SATELLITE_TILES: ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'],
    // Tuiles de relief brutes (AWS Terrarium / Mapzen). Elles sont servies à MapLibre
    // via un protocole personnalisé (voir _registerSmoothTerrainProtocol) qui les lisse
    // avant de les donner au moteur de terrain : sur cette source gratuite, le bruit du
    // relief n'est PAS un problème de zoom (vérifié en comparant les pixels bruts de z10
    // à z14 sur une même zone : le nombre de pixels identiques consécutifs saute de 22 à
    // 171 puis retombe à 49 sans logique de zoom) - c'est une donnée intrinsèquement
    // grossière par endroits (zones de sable/estran, mal mesurées par les sources
    // altimétriques satellite d'origine). Un plafond de zoom n'y change donc rien ; il
    // faut lisser les valeurs d'altitude elles-mêmes.
    TERRAIN_TILES_RAW: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
    TERRAIN_SMOOTH_PROTOCOL: 'smoothdem',
    TERRAIN_SMOOTH_BLUR_RADIUS: 3,
    TERRAIN_SMOOTH_PASSES: 2,
    PATH_WIDTH_METERS: 3,
    PATH_WIDTH_MIN_PIXELS: 2,
    PILOT_MARKER_RADIUS_PIXELS: 7,
    // Palette variomètre : bleu (fort taux de chute) -> gris (neutre) -> rouge (forte
    // ascendance), aux repères usuels en vol libre (m/s).
    /** @type {Array<[number, number[]]>} */
    VARIO_COLOR_STOPS: [
        [-3, [37, 99, 235]],
        [-1, [125, 211, 252]],
        [0, [203, 213, 225]],
        [1, [251, 191, 36]],
        [3, [220, 38, 38]],
    ],
    PLAYBACK_INTERVAL_MS: 100,
    // Trace, point et étiquette toujours dessinés par-dessus le relief : le relief gratuit est
    // grossier (pas de ~30 m), il étale par exemple la falaise du Blanc-Nez sur la plage (27 m au
    // lieu de 0 m). Testés contre lui, des morceaux de trace et l'étiquette d'altitude passaient
    // sous le sol et disparaissaient. (deck.gl 9 : depthCompare remplace depthTest: false.)
    ABOVE_TERRAIN: { depthCompare: 'always', depthWriteEnabled: false },
    _loadDependenciesPromise: null,

    /**
     * Charge à la demande les dépendances MapLibre GL et deck.gl (scripts et styles)
     * pour alléger le chargement initial du site de ~2.4 Mo de code WebGL.
     * @returns {Promise<void>}
     */
    ensureDependenciesLoaded: function () {
        if (typeof maplibregl !== 'undefined' && typeof deck !== 'undefined') {
            return Promise.resolve();
        }
        if (this._loadDependenciesPromise) {
            return this._loadDependenciesPromise;
        }

        this._loadDependenciesPromise = /** @type {Promise<void>} */ (
            new Promise((resolve, reject) => {
                const loadScript = (src, integrity) => {
                    return /** @type {Promise<void>} */ (
                        new Promise((res, rej) => {
                            const existing = /** @type {HTMLScriptElement} */ (
                                document.querySelector(`script[src="${src}"]`)
                            );
                            if (existing) {
                                if (existing.dataset.loaded === 'true') return res();
                                existing.addEventListener('load', () => res(), { once: true });
                                existing.addEventListener('error', (err) => rej(err), { once: true });
                                return;
                            }
                            const s = document.createElement('script');
                            s.src = src;
                            s.async = true;
                            s.integrity = integrity;
                            s.crossOrigin = 'anonymous';
                            s.onload = () => {
                                s.dataset.loaded = 'true';
                                res();
                            };
                            s.onerror = () => rej(new Error(`Impossible de charger le script : ${src}`));
                            document.head.appendChild(s);
                        })
                    );
                };

                const loadCss = (href, integrity) => {
                    if (document.querySelector(`link[href="${href}"]`)) return;
                    const link = document.createElement('link');
                    link.rel = 'stylesheet';
                    link.href = href;
                    link.integrity = integrity;
                    link.crossOrigin = 'anonymous';
                    document.head.appendChild(link);
                };

                loadCss(
                    `https://unpkg.com/maplibre-gl@${this.MAPLIBRE_VERSION}/dist/maplibre-gl.css`,
                    this.CDN_INTEGRITY['maplibre-gl.css'],
                );

                Promise.all([
                    loadScript(
                        `https://unpkg.com/maplibre-gl@${this.MAPLIBRE_VERSION}/dist/maplibre-gl.js`,
                        this.CDN_INTEGRITY['maplibre-gl.js'],
                    ),
                    loadScript('https://unpkg.com/deck.gl@9.4.0/dist.min.js', this.CDN_INTEGRITY['deck.gl.js']),
                ])
                    .then(() => resolve())
                    .catch((err) => {
                        this._loadDependenciesPromise = null;
                        reject(err);
                    });
            })
        );

        return this._loadDependenciesPromise;
    },

    /**
     * Initialise et affiche la trace 3D dans le conteneur donné.
     * @param {string} sessionId L'ID de la session
     * @param {Array} traceGps Le tableau de points GPS {lat, lon, alt, time}
     * @param {HTMLElement} container L'élément DOM conteneur
     */
    showTrace: async function (sessionId, traceGps, container) {
        if (!traceGps || traceGps.length === 0) return;

        if (typeof maplibregl === 'undefined' || typeof deck === 'undefined') {
            container.innerHTML = `
                <div style="padding: 40px; text-align: center; color: var(--text-secondary);">
                    <i class="ri-loader-4-line ri-spin" style="font-size: 2rem; display: block; margin-bottom: 12px; color: var(--accent-orange);"></i>
                    <p style="margin: 0; font-size: 0.95rem;">${escapeHTML(t('map3d.loading'))}</p>
                </div>
            `;
            try {
                await this.ensureDependenciesLoaded();
            } catch (err) {
                console.error('[Map3D] Échec de chargement des dépendances 3D :', err);
                container.innerHTML = this._errorHtml(t('map3d.librariesError'));
                return;
            }
        }

        if (typeof maplibregl.supported === 'function' && !maplibregl.supported()) {
            container.innerHTML = this._errorHtml(t('map3d.webglError'));
            return;
        }

        this.clearPlayback();
        this._registerSmoothTerrainProtocol();
        container.innerHTML = this._playerHtml(sessionId, traceGps.length - 1);

        const slider = /** @type {HTMLInputElement} */ (document.getElementById(`slider-${sessionId}`));
        const playBtn = document.getElementById(`play-btn-${sessionId}`);
        const info = document.getElementById(`info-${sessionId}`);

        const varioSeries = this._computeVarioSeries(traceGps);
        const pathSegments = this._buildPathSegments(traceGps, varioSeries);

        let map3D;
        try {
            map3D = new maplibregl.Map({
                container: `map-3d-container-${sessionId}`,
                style: this._buildStyle(),
                center: [traceGps[0].lon, traceGps[0].lat],
                zoom: 13.5,
                maxZoom: 17,
                pitch: 60,
                bearing: 0,
                interactive: true,
            });
        } catch (err) {
            console.error('[Map3D] Échec de création de la carte :', err);
            container.innerHTML = this._errorHtml(t('map3d.initError'));
            return;
        }

        map3D.dragRotate.enable();
        map3D.touchZoomRotate.enable();
        map3D.addControl(new maplibregl.NavigationControl({ visualizePitch: true, showZoom: true, showCompass: true }));
        map3D.addControl(
            new maplibregl.FullscreenControl({ container: document.getElementById(`player-3d-wrapper-${sessionId}`) }),
        );
        map3D.on('error', (e) => console.error('[Map3D] Erreur MapLibre :', e && e.error));

        let deckOverlay = null;

        const updatePosition = () => {
            const index = parseInt(slider.value, 10);
            const pt = traceGps[index];
            const vario = varioSeries[index];

            if (deckOverlay) {
                deckOverlay.setProps({ layers: this._buildDeckLayers(traceGps, pathSegments, varioSeries, index) });
            }

            if (!map3D.isMoving()) {
                map3D.easeTo({ center: [pt.lon, pt.lat], duration: this.PLAYBACK_INTERVAL_MS, easing: (t) => t });
            }

            const strong = (color, value) => `<strong style="color:${color};">${escapeHTML(String(value))}</strong>`;
            info.innerHTML = [
                escapeHTML(t('map3d.time')).replace('{value}', strong('var(--text-primary)', pt.time)),
                escapeHTML(t('map3d.altitude')).replace(
                    '{value}',
                    strong('var(--text-primary)', t('map3d.altitudeValue', { alt: Math.round(pt.alt) })),
                ),
                escapeHTML(t('map3d.vario')).replace(
                    '{value}',
                    strong(
                        this._varioTextColor(vario),
                        t('map3d.varioValue', { vario: `${vario >= 0 ? '+' : ''}${vario.toFixed(1)}` }),
                    ),
                ),
            ].join(' &nbsp;·&nbsp; ');
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
                return;
            }
            playBtn.innerHTML = '<i class="ri-pause-fill"></i>';
            if (parseInt(slider.value, 10) >= traceGps.length - 1) slider.value = String(0);

            this.activeInterval = setInterval(() => {
                const val = parseInt(slider.value, 10);
                let step = 1;
                if (traceGps.length > 2000) step = 3;
                else if (traceGps.length > 1000) step = 2;

                if (val < traceGps.length - 1) {
                    slider.value = String(Math.min(val + step, traceGps.length - 1));
                    updatePosition();
                } else {
                    this.clearPlayback();
                    playBtn.innerHTML = '<i class="ri-play-fill"></i>';
                }
            }, this.PLAYBACK_INTERVAL_MS);
        });

        // L'overlay deck.gl (surtout en mode interleaved, qui s'accroche au pipeline de
        // rendu de MapLibre) et fitBounds ont besoin que le style/painter de la carte
        // soit prêt : on attend l'évènement 'load' plutôt que de les appeler juste après
        // le constructeur.
        map3D.on('load', () => {
            deckOverlay = new deck.MapboxOverlay({
                interleaved: true,
                layers: this._buildDeckLayers(traceGps, pathSegments, varioSeries, parseInt(slider.value, 10)),
            });
            map3D.addControl(deckOverlay);

            updatePosition();

            const bounds = new maplibregl.LngLatBounds(
                [traceGps[0].lon, traceGps[0].lat],
                [traceGps[0].lon, traceGps[0].lat],
            );
            for (const pt of traceGps) bounds.extend([pt.lon, pt.lat]);
            map3D.fitBounds(bounds, { padding: 50, pitch: 60, bearing: 0 });
        });
    },

    // --- Lissage du relief brut ----------------------------------------------------
    // La donnée d'altitude gratuite (AWS Terrarium/Mapzen) est par endroits nativement
    // grossière (larges zones de pixels identiques, visibles en escaliers une fois
    // maillées en 3D), et ce indépendamment du niveau de zoom demandé - vérifié en
    // comparant les tuiles brutes de z10 à z14 sur une même zone de sable/estran,
    // aucune corrélation nette. On intercepte donc chaque tuile via un protocole
    // MapLibre personnalisé, on décode son altitude pixel par pixel (formule
    // "terrarium"), on lisse la grille (flou en boîte séparable, appliqué deux fois
    // pour approcher un flou gaussien), puis on la ré-encode avant de la transmettre au
    // moteur de terrain. Les marches deviennent des pentes douces, sans dépendre d'un
    // quelconque plafond de zoom.
    _registerSmoothTerrainProtocol: function () {
        if (this._smoothProtocolRegistered) return;
        if (typeof maplibregl === 'undefined' || typeof maplibregl.addProtocol !== 'function') return;

        const protocol = this.TERRAIN_SMOOTH_PROTOCOL;
        const blurRadius = this.TERRAIN_SMOOTH_BLUR_RADIUS;
        const passes = this.TERRAIN_SMOOTH_PASSES;
        const boxBlur1D = this._boxBlur1D.bind(this);

        maplibregl.addProtocol(protocol, async (params, abortController) => {
            const realUrl = params.url.replace(`${protocol}://`, '');
            const response = await fetch(realUrl, { signal: abortController && abortController.signal });
            if (!response.ok)
                throw new Error(`[Map3D] Échec de récupération de la tuile de relief : ${response.status}`);
            const blob = await response.blob();
            const bitmap = await createImageBitmap(blob);

            const w = bitmap.width,
                h = bitmap.height;
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(bitmap, 0, 0);
            const imgData = ctx.getImageData(0, 0, w, h);
            const px = imgData.data;

            let elev = new Float32Array(w * h);
            for (let i = 0; i < w * h; i++) {
                const o = i * 4;
                elev[i] = px[o] * 256 + px[o + 1] + px[o + 2] / 256 - 32768;
            }

            for (let p = 0; p < passes; p++) {
                elev = boxBlur1D(elev, w, h, blurRadius, true);
                elev = boxBlur1D(elev, w, h, blurRadius, false);
            }

            for (let i = 0; i < w * h; i++) {
                const o = i * 4;
                const v = elev[i] + 32768;
                const vFloor = Math.floor(v);
                px[o] = Math.max(0, Math.min(255, Math.floor(v / 256)));
                px[o + 1] = Math.max(0, Math.min(255, vFloor % 256));
                px[o + 2] = Math.max(0, Math.min(255, Math.floor((v - vFloor) * 256)));
                px[o + 3] = 255;
            }

            ctx.putImageData(imgData, 0, 0);
            const outBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
            const buffer = await outBlob.arrayBuffer();
            return { data: buffer };
        });

        this._smoothProtocolRegistered = true;
    },

    _boxBlur1D: function (src, w, h, radius, horizontal) {
        const out = new Float32Array(w * h);
        if (horizontal) {
            for (let y = 0; y < h; y++) {
                const rowOffset = y * w;
                for (let x = 0; x < w; x++) {
                    let sum = 0,
                        count = 0;
                    for (let k = -radius; k <= radius; k++) {
                        const xx = x + k;
                        if (xx >= 0 && xx < w) {
                            sum += src[rowOffset + xx];
                            count++;
                        }
                    }
                    out[rowOffset + x] = sum / count;
                }
            }
        } else {
            for (let x = 0; x < w; x++) {
                for (let y = 0; y < h; y++) {
                    let sum = 0,
                        count = 0;
                    for (let k = -radius; k <= radius; k++) {
                        const yy = y + k;
                        if (yy >= 0 && yy < h) {
                            sum += src[yy * w + x];
                            count++;
                        }
                    }
                    out[y * w + x] = sum / count;
                }
            }
        }
        return out;
    },

    // --- Style de la carte (relief + satellite) -----------------------------------
    _buildStyle: function () {
        return {
            version: 8,
            glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
            sources: {
                satellite: {
                    type: 'raster',
                    tiles: this.SATELLITE_TILES,
                    tileSize: 256,
                    attribution: '© Google',
                },
                terrainSource: {
                    type: 'raster-dem',
                    tiles: [`${this.TERRAIN_SMOOTH_PROTOCOL}://${this.TERRAIN_TILES_RAW}`],
                    encoding: 'terrarium',
                    tileSize: 256,
                    maxzoom: 15,
                },
            },
            layers: [
                { id: 'satellite', type: 'raster', source: 'satellite' },
                // Ombrage du relief en complément de la texture satellite : ajoute du
                // détail perçu (creux/bosses) indépendamment de la densité du maillage 3D.
                {
                    id: 'hillshade',
                    type: 'hillshade',
                    source: 'terrainSource',
                    paint: {
                        'hillshade-illumination-direction': 315,
                        'hillshade-exaggeration': 0.6,
                        'hillshade-shadow-color': '#1a1a1a',
                        'hillshade-highlight-color': '#ffffff',
                        'hillshade-accent-color': '#000000',
                    },
                },
            ],
            terrain: { source: 'terrainSource', exaggeration: 1.0 },
        };
    },

    // --- Variomètre ---------------------------------------------------------------
    _timeToSeconds: function (tStr) {
        const p = tStr.split(':');
        return parseInt(p[0], 10) * 3600 + parseInt(p[1], 10) * 60 + parseInt(p[2], 10);
    },

    // Vario instantané par point (m/s), lissé légèrement pour ne pas scintiller entre
    // deux points GPS très rapprochés dans le temps.
    _computeVarioSeries: function (traceGps) {
        const raw = traceGps.map((pt, i) => {
            if (i === 0) return 0;
            const prev = traceGps[i - 1];
            const dt = this._timeToSeconds(pt.time) - this._timeToSeconds(prev.time);
            if (dt <= 0) return 0;
            return (pt.alt - prev.alt) / dt;
        });
        const half = 1;
        return raw.map((_, i) => {
            let sum = 0,
                count = 0;
            for (let k = -half; k <= half; k++) {
                const idx = i + k;
                if (idx >= 0 && idx < raw.length) {
                    sum += raw[idx];
                    count++;
                }
            }
            return sum / count;
        });
    },

    _varioColor: function (vario) {
        const stops = this.VARIO_COLOR_STOPS;
        if (vario <= stops[0][0]) return stops[0][1];
        if (vario >= stops[stops.length - 1][0]) return stops[stops.length - 1][1];
        for (let i = 0; i < stops.length - 1; i++) {
            const [v1, c1] = stops[i];
            const [v2, c2] = stops[i + 1];
            if (vario >= v1 && vario <= v2) {
                const t = (vario - v1) / (v2 - v1);
                return [
                    Math.round(c1[0] + (c2[0] - c1[0]) * t),
                    Math.round(c1[1] + (c2[1] - c1[1]) * t),
                    Math.round(c1[2] + (c2[2] - c1[2]) * t),
                ];
            }
        }
        return stops[stops.length - 1][1];
    },

    _varioTextColor: function (vario) {
        if (vario >= 1) return '#dc2626';
        if (vario <= -1) return '#2563eb';
        return 'var(--text-secondary)';
    },

    // --- Trace de vol (deck.gl PathLayer, altitude réelle) ------------------------
    // Un segment par paire de points consécutifs, chacun coloré selon son vario moyen :
    // deck.gl dessine une vraie ligne (avec jointures propres), donc contrairement à des
    // polygones extrudés superposés, des centaines de segments qui repassent au même
    // endroit (vol de soaring) ne fusionnent pas en un bloc plein.
    _buildPathSegments: function (traceGps, varioSeries) {
        const segments = [];
        for (let i = 0; i < traceGps.length - 1; i++) {
            const p1 = traceGps[i];
            const p2 = traceGps[i + 1];
            const vario = (varioSeries[i] + varioSeries[i + 1]) / 2;
            segments.push({
                path: [
                    [p1.lon, p1.lat, p1.alt],
                    [p2.lon, p2.lat, p2.alt],
                ],
                color: this._varioColor(vario),
            });
        }
        return segments;
    },

    _buildDeckLayers: function (traceGps, pathSegments, varioSeries, currentIndex) {
        const pt = traceGps[currentIndex];
        const vario = varioSeries[currentIndex];

        const pathLayer = new deck.PathLayer({
            id: 'flight-path',
            data: pathSegments,
            getPath: (d) => d.path,
            getColor: (d) => d.color,
            getWidth: this.PATH_WIDTH_METERS,
            widthUnits: 'meters',
            widthMinPixels: this.PATH_WIDTH_MIN_PIXELS,
            capRounded: true,
            jointRounded: true,
            positionFormat: 'XYZ',
            pickable: false,
            parameters: this.ABOVE_TERRAIN,
        });

        // Position actuelle : un point + une étiquette, tous deux à la vraie altitude du
        // vol (deck.gl gère nativement le Z, contrairement aux calques symbol de MapLibre).
        const pilotMarkerLayer = new deck.ScatterplotLayer({
            id: 'pilot-marker',
            data: [pt],
            getPosition: (d) => [d.lon, d.lat, d.alt],
            getFillColor: [255, 255, 255, 255],
            getLineColor: [...this._varioColor(vario), 255],
            lineWidthMinPixels: 2,
            stroked: true,
            filled: true,
            getRadius: this.PILOT_MARKER_RADIUS_PIXELS,
            radiusUnits: 'pixels',
            positionFormat: 'XYZ',
            parameters: this.ABOVE_TERRAIN,
        });

        const pilotLabelLayer = new deck.TextLayer({
            id: 'pilot-label',
            data: [pt],
            getPosition: (d) => [d.lon, d.lat, d.alt],
            getText: (d) =>
                t('map3d.label', { alt: Math.round(d.alt), vario: `${vario >= 0 ? '+' : ''}${vario.toFixed(1)}` }),
            getSize: 13,
            getColor: [255, 255, 255, 255],
            getPixelOffset: [0, -22],
            background: true,
            getBackgroundColor: [...this._varioColor(vario), 220],
            backgroundPadding: [6, 3],
            fontFamily: '"Segoe UI", Arial, sans-serif',
            positionFormat: 'XYZ',
            parameters: this.ABOVE_TERRAIN,
        });

        return [pathLayer, pilotMarkerLayer, pilotLabelLayer];
    },

    // --- Markup --------------------------------------------------------------------
    _playerHtml: function (sessionId, maxIndex) {
        const gradientStops = this._varioLegendGradient();
        return `
            <div id="player-3d-wrapper-${sessionId}" style="display: flex; flex-direction: column; width: 100%; height: 100%; background: var(--bg-surface);">
                <div style="position: relative; flex: 1; min-height: 400px; width: 100%; border-radius: var(--radius-md); overflow: hidden; border: 1px solid var(--border-light);">
                    <div id="map-3d-container-${sessionId}" style="position: absolute; top: 0; left: 0; height: 100%; width: 100%; background: #dde3e8;"></div>
                </div>
                <div style="padding: 10px; background: var(--bg-card); display: flex; flex-direction: column; gap: 10px; margin-top: 10px; border-radius: var(--radius-md);">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <button id="play-btn-${sessionId}" class="action-btn-primary" style="padding: 4px 12px; min-width: 60px;"><i class="ri-play-fill"></i></button>
                        <input type="range" id="slider-${sessionId}" min="0" max="${maxIndex}" value="0" style="flex: 1; cursor: pointer;">
                    </div>
                    <div id="info-${sessionId}" style="font-size: 0.85rem; font-family: monospace; color: var(--text-secondary); text-align: center;">
                        ${escapeHTML(t('map3d.timeEmpty'))}
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; font-size: 0.7rem; color: var(--text-secondary); justify-content: center;">
                        <span>${escapeHTML(t('map3d.sink'))}</span>
                        <div style="width: 120px; height: 8px; border-radius: 4px; background: linear-gradient(to right, ${gradientStops});"></div>
                        <span>${escapeHTML(t('map3d.climb'))}</span>
                    </div>
                </div>
            </div>
        `;
    },

    _varioLegendGradient: function () {
        const stops = this.VARIO_COLOR_STOPS;
        const min = stops[0][0],
            max = stops[stops.length - 1][0];
        return stops
            .map(([v, c]) => {
                const pct = ((v - min) / (max - min)) * 100;
                return `rgb(${c[0]},${c[1]},${c[2]}) ${pct}%`;
            })
            .join(', ');
    },

    _errorHtml: function (message) {
        return `<div style="padding: 20px; text-align: center; color: var(--text-secondary);">${message}</div>`;
    },

    clearPlayback: function () {
        if (this.activeInterval) {
            clearInterval(this.activeInterval);
            this.activeInterval = null;
        }
    },
};

export default Map3DComponent;
