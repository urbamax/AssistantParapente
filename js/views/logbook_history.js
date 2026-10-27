/**
 * VIEW - Logbook history (Historique tab)
 * Base class of LogbookView (see logbook.js): the list of sessions with its filter, the weather
 * block of a card, trace display, IGC download and PDF export. Kept in its own file so logbook.js
 * stays about the session form; behaviour is unchanged.
 */
import LogbookService from '../services/logbook_service.js';
import SitesService from '../services/sites_service.js';
import { EXTENDED_WIND_DIRECTIONS } from '../data/weather_config.js';
import { getSpotairWidgetId } from '../data/spotair_widgets.js';
import { escapeHTML } from '../core/security.js';
import { companionsOf, instructorsOf, isCourseSession, courseKey } from '../services/logbook_courses.js';
import { formatDuration, formatDateTime, addMinutesToDatetimeLocal } from '../utils/date_utils.js';
import { t } from '../utils/i18n.js';
import { buildIgcFileName, buildLogbookReportHtml } from '../services/logbook_export.js';
import { saveTextFile } from '../utils/download.js';
import { printHtml } from '../utils/print.js';
import { tt, tl } from './logbook_strings.js';
import { LogbookStatsBase } from './logbook_stats.js';

// Le visualiseur 3D (28 Ko) ne sert qu'au clic sur « Voir la trace » : il est téléchargé à ce moment-là.
const loadMap3D = () => import('../components/map_3d.js').then((m) => m.default);

export class LogbookHistoryBase extends LogbookStatsBase {
    constructor() {
        super();
        this.activeFilter = null;
    }

    // À fournir par LogbookView (onglets, formulaire et aides de recherche de sites).
    switchTab(_tabName) {
        throw new Error('LogbookView must implement switchTab()');
    }

    /** @returns {any} */
    normalizeString(_str) {
        throw new Error('LogbookView must implement normalizeString()');
    }

    /** @returns {any} */
    findSiteByName(_siteName) {
        throw new Error('LogbookView must implement findSiteByName()');
    }

    /** @returns {any} */
    getSiteCoords(_site) {
        throw new Error('LogbookView must implement getSiteCoords()');
    }

    /**
     * Accompagnateurs d'une session, en liste. Ils peuvent être plusieurs ; les sessions plus
     * anciennes n'en gardaient qu'un, en texte.
     * @param {{accompagnateur?: unknown}} session
     * @returns {string[]}
     */
    static companionsOf(session) {
        return companionsOf(session);
    }

    scrollToSession(id) {
        if (this.activeFilter) {
            this.activeFilter = null;
        }
        this.switchTab('history');
        // Let the tab display before trying to scroll
        setTimeout(() => {
            const card = /** @type {HTMLElement|null} */ (
                document.querySelector(`.logbook-card[data-session-id="${id}"]`)
            );
            if (card) {
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Highlight the card
                card.style.transition = 'box-shadow 0.3s ease-in-out';
                card.style.boxShadow = '0 0 15px rgba(14, 165, 233, 0.8)';
                setTimeout(() => {
                    card.style.boxShadow = '';
                }, 2000);
            }
        }, 100);
    }

    filterHistoryByStat(_args, _e, target) {
        const el = target ? target.closest('[data-stat-type]') : null;
        if (!el) return;
        const type = el.dataset.statType;
        const value = el.dataset.statValue;
        if (type && value) {
            this.applyHistoryFilter(type, value);
        }
    }

    applyHistoryFilter(type, value) {
        this.activeFilter = { type, value };
        this.switchTab('history');
    }

    clearHistoryFilter() {
        this.activeFilter = null;
        this.renderHistory();
    }

    deleteEntry(id) {
        if (confirm(tl('history.deleteConfirm'))) {
            LogbookService.deleteFlight(id);
            this.renderHistory();
        }
    }

    // Bloc météo d'une carte de l'historique (données AROME + graphe de balise).
    renderSessionWeatherHtml(session) {
        if (session.meteo) {
            // Une séance de gonflage n'a ni décollage ni atterrissage : on parle de début et de fin.
            const isVol = session.type === 'vol';

            let startLabel = isVol ? 'weather.rowTakeoff' : 'weather.rowStart';
            if (session.meteoAtterroSame) {
                startLabel = isVol ? 'weather.rowTakeoffLanding' : 'weather.rowStartEnd';
            }

            const decollageRow = this.renderWeatherPointRow(session.meteo, t(startLabel));
            const atterroRow = session.meteoAtterro
                ? this.renderWeatherPointRow(session.meteoAtterro, t(isVol ? 'weather.rowLanding' : 'weather.rowEnd'))
                : '';
            const baliseHtml = this.renderBaliseHistoBlock(session);

            return `
            <div class="logbook-card-weather" style="margin-top: 10px; padding: 10px; background: rgba(14,165,233,0.06); border-radius: var(--radius-sm); border: 1px solid rgba(14,165,233,0.15); font-size: 0.85rem; color: var(--text-secondary);">
                ${decollageRow}
                ${atterroRow}
                <button data-action="forceWeatherRefresh" data-args="${session.id}" title="${tt('weather.refreshTitle')}" style="margin-top: 6px; color: var(--text-muted); cursor: pointer; border: none; background: none; padding: 2px 4px; font-size: 0.78rem; display: inline-flex; align-items: center; gap: 4px;">
                    <i class="ri-refresh-line"></i> ${tt('weather.refresh')}
                </button>
            </div>
            ${baliseHtml}`;
        } else {
            return `
            <div id="weather-container-${session.id}" class="logbook-card-weather-empty" style="margin-top: 10px; font-size: 0.85rem;">
                <button id="refresh-weather-btn-${session.id}" class="action-btn-text" data-action="forceWeatherRefresh" data-args="${session.id}" style="color: var(--text-muted); cursor: pointer; border: none; background: rgba(0,0,0,0.03); border-radius: var(--radius-sm); padding: 6px 12px; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s;">
                    <i class="ri-refresh-line"></i> ${tt('weather.fetch')}
                </button>
            </div>`;
        }
    }

    // Met à jour le seul bloc météo d'une carte, sans reconstruire la liste : reconstruire
    // l'historique ferme la trace GPS ouverte et détruit sa carte 3D (position, lecture).
    refreshSessionWeather(sessionId) {
        const session = LogbookService.getFlightById(sessionId);
        const slot = [
            .../** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('[data-session-weather]')),
        ].find((el) => el.dataset.sessionWeather === String(sessionId));
        if (session && slot) slot.innerHTML = this.renderSessionWeatherHtml(session);
    }

    // « Nom du stage » d'une session (« Stage » seul si seule la spécialité est renseignée).
    getCourseLabel(session) {
        if (session.stageName) return escapeHTML(session.stageName);
        return session.stageSpecialty ? tt('history.course') : '';
    }

    renderHistory() {
        const container = document.getElementById('logbook-history-list');
        if (!container) return;

        const allFlights = LogbookService.getFlights();
        if (allFlights.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="ri-history-line"></i>
                    <p>${tt('history.empty')}</p>
                </div>
            `;
            return;
        }

        let flights = allFlights;
        let filterBannerHtml = '';
        if (this.activeFilter && this.activeFilter.type && this.activeFilter.value) {
            const { type, value } = this.activeFilter;
            flights = allFlights.filter((s) => {
                if (type === 'site') return (s.site || s.lieu) === value;
                if (type === 'typeVol') return s.typeVol === value;
                if (type === 'techDecollage') return s.techDecollage === value;
                if (type === 'exercice') {
                    return Array.isArray(s.typeExercice) ? s.typeExercice.includes(value) : s.typeExercice === value;
                }
                if (type === 'voile') return s.voile === value;
                if (type === 'ecole') return s.ecole === value;
                if (type === 'brevet') return Boolean(s.ecole?.trim()) && s.brevetPrepare === value;
                if (type === 'stage') return isCourseSession(s) && courseKey(s) === value.trim().toLowerCase();
                if (type === 'stageUnnamed') return isCourseSession(s) && courseKey(s) === '';
                if (type === 'type') return s.type === value;
                return true;
            });
            filterBannerHtml = `
                <div class="logbook-filter-banner">
                    <div class="filter-banner-text">
                        <i class="ri-filter-3-line"></i>
                        <span>${tt('history.filterActive', { value })} <strong>(${flights.length} / ${allFlights.length})</strong></span>
                    </div>
                    <button type="button" class="filter-banner-clear" data-action="clearHistoryFilter">
                        <i class="ri-close-line"></i> ${tt('history.filterClear')}
                    </button>
                </div>
            `;
        }

        if (flights.length === 0) {
            container.innerHTML =
                filterBannerHtml +
                `
                <div class="empty-state">
                    <i class="ri-filter-line"></i>
                    <p>${tt('history.empty')}</p>
                </div>
            `;
            return;
        }

        let html = filterBannerHtml;
        flights.forEach((session) => {
            try {
                const isVol = session.type === 'vol';
                const icon = isVol ? 'ri-windy-line' : 'ri-footprint-line';
                const typeColor = isVol ? 'var(--accent-orange)' : '#f59e0b';
                const location = isVol ? session.site : session.lieu;
                // Repli sur '' : un enregistrement corrompu/partiel (import JSON manuel, ancien
                // format, fusion cloud incomplète) sans typeVol/typeExercice ferait planter tout le
                // carnet ici (.toLowerCase() sur undefined un peu plus bas), au lieu de sauter
                // juste cette carte.
                const subtitle =
                    (isVol
                        ? session.typeVol
                        : Array.isArray(session.typeExercice)
                          ? session.typeExercice.join(', ')
                          : session.typeExercice) || '';

                let extraInfo = '';
                if (isVol) {
                    const badgeStyle =
                        'background: var(--bg-card-hover, rgba(0,0,0,0.05)); padding: 4px 8px; border-radius: 6px; border: 1px solid var(--border-light, rgba(0,0,0,0.05)); font-weight: 500; display: inline-flex; align-items: center; gap: 4px;';
                    const decoInfo = session.techDecollage
                        ? `<span style="${badgeStyle}" title="${tt('history.takeoffTitle')}"><i class="ri-takeaway-line"></i> ${tt('history.takeoff', { technique: session.techDecollage })}</span>`
                        : '';
                    const landingInfo = session.priseTerrain
                        ? `<span style="${badgeStyle}" title="${tt('history.landingTitle')}"><i class="ri-arrow-left-down-line"></i> ${tt('history.landingApproach', { approach: session.priseTerrain })}</span>`
                        : '';
                    const landedOutInfo = session.vache
                        ? `<span style="${badgeStyle}" title="${tt('history.landedOutTitle')}"><i class="ri-map-pin-line"></i> ${tt('history.landedOut')}</span>`
                        : '';
                    const altInfo = session.altitudeMax
                        ? `<span style="${badgeStyle}" title="${tt('history.altMaxTitle')}">${tt('history.altMax', { value: session.altitudeMax })}</span>`
                        : '';
                    const gainInfo =
                        session.gain !== undefined && session.gain !== null && session.gain !== ''
                            ? `<span style="${badgeStyle}" title="${tt('history.gainTitle')}">${tt('history.gain', { value: session.gain })}</span>`
                            : '';
                    const distanceInfo = session.distanceKm
                        ? `<span style="${badgeStyle}" title="${tt('history.distanceTitle')}">${tt('history.distance', { value: session.distanceKm })}</span>`
                        : '';
                    const climbInfo = session.maxClimbRate
                        ? `<span style="${badgeStyle}" title="${tt('history.climbTitle')}">${tt('history.climb', { value: session.maxClimbRate })}</span>`
                        : '';
                    const speedInfo = session.maxSpeedKmh
                        ? `<span style="${badgeStyle}" title="${tt('history.speedTitle')}">${tt('history.speed', { max: session.maxSpeedKmh, avg: session.avgSpeedKmh })}</span>`
                        : '';

                    if (
                        decoInfo ||
                        landingInfo ||
                        landedOutInfo ||
                        altInfo ||
                        gainInfo ||
                        distanceInfo ||
                        climbInfo ||
                        speedInfo
                    ) {
                        extraInfo = `<div class="session-extra-info" style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; font-size: 0.82rem; color: var(--text-secondary);">
                        ${decoInfo}${landingInfo}${landedOutInfo}
                        ${altInfo}
                        ${gainInfo}
                        ${distanceInfo}
                        ${climbInfo}
                        ${speedInfo}
                    </div>`;
                    }
                    extraInfo += this.renderFlightAnalysis(session);
                }

                const meteoHtml = this.renderSessionWeatherHtml(session);

                html += `
                <div class="logbook-card" data-session-id="${escapeHTML(session.id)}">
                    <div class="logbook-card-header">
                        <div class="session-badge" style="background-color: ${typeColor}22; color: ${typeColor};">
                            <i class="${icon}"></i> ${tt(isVol ? 'history.badgeFlight' : 'history.badgeGround')}
                        </div>
                        <div class="session-date">${formatDateTime(session.datetime)}</div>
                        <div style="display: flex; gap: 8px;">
                            <button class="edit-btn" data-action="editEntry" data-args="${session.id}" title="${tt('history.edit')}" style="background: none; border: none; color: var(--text-secondary); cursor: pointer; padding: 4px; border-radius: 4px; transition: all 0.2s;">
                                <i class="ri-edit-line"></i>
                            </button>
                            <button class="delete-btn" data-action="deleteEntry" data-args="${session.id}" title="${tt('history.delete')}" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 4px; border-radius: 4px; transition: all 0.2s;">
                                <i class="ri-delete-bin-line"></i>
                            </button>
                        </div>
                    </div>
                    <div class="logbook-card-body">
                        <div class="session-location">${escapeHTML(location)}</div>
                        <div class="session-details">
                            <span class="detail-item"><i class="ri-time-line"></i> ${formatDuration(session.duree)}</span>
                            <span class="detail-item"><i class="${subtitle.toLowerCase().includes('treuil') ? 'ri-arrow-up-double-line' : subtitle.toLowerCase().includes('thermique') ? 'ri-fire-line' : subtitle.toLowerCase().includes('cross') ? 'ri-route-line' : subtitle.toLowerCase().includes('plouf') ? 'ri-arrow-left-down-line' : subtitle.toLowerCase().includes('restit') || subtitle.toLowerCase().includes('soaring') ? 'ri-sun-cloudy-line' : subtitle.toLowerCase().includes('gonflage') ? 'ri-footprint-line' : 'ri-price-tag-3-line'}"></i> ${escapeHTML(subtitle)}</span>
                        </div>
                        ${extraInfo}
                        <div class="session-equip">
                            ${session.voile ? `<div><strong>${tt('history.wing')}</strong> ${escapeHTML(session.voile)}</div>` : ''}
                            ${session.sellette ? `<div><strong>${tt('history.harness')}</strong> ${escapeHTML(session.sellette)}</div>` : ''}
                            ${session.rescueDeployed ? `<div style="color: #ef4444;"><strong>${tt('history.rescueDeployed')}</strong> ${escapeHTML(session.rescueId || tt('history.yes'))}</div>` : ''}
                            ${session.ecole ? `<div><strong>${tt('history.school')}</strong> ${[this.getCourseLabel(session), escapeHTML(session.ecole)].filter(Boolean).join(' | ')}</div>` : ''}
                            ${session.ecole && session.brevetPrepare ? `<div><strong>${tt('history.brevetPrepare')}</strong> ${tt(`form.brevetOptions.${session.brevetPrepare}`)}</div>` : ''}
                            ${session.ecole && session.stageSpecialty ? `<div><strong>${tt('history.specialty')}</strong> ${escapeHTML(session.stageSpecialty)}</div>` : ''}
                            ${isVol && session.typeVol === 'Treuil' && session.treuilleur ? `<div><strong>${tt('history.winchOperator')}</strong> ${escapeHTML(session.treuilleur)}</div>` : ''}
                            ${session.ecole && instructorsOf(session).length > 0 ? `<div><strong>${tt('history.instructor')}</strong> ${escapeHTML(instructorsOf(session).join(', '))}</div>` : ''}
                            ${session.ecole && LogbookHistoryBase.companionsOf(session).length > 0 ? `<div><strong>${tt('history.companion')}</strong> ${escapeHTML(LogbookHistoryBase.companionsOf(session).join(', '))}</div>` : ''}
                            ${session.instrument && (session.instrument.brand || session.instrument.model) ? `<div><strong>${tt('history.instrument')}</strong> ${escapeHTML([session.instrument.brand, session.instrument.model].filter(Boolean).join(' '))}${session.instrument.firmware ? ` ${tt('history.firmware', { version: session.instrument.firmware })}` : ''}</div>` : ''}
                            ${isVol && Array.isArray(session.typeExercice) && session.typeExercice.length > 0 ? `<div><strong>${tt('history.exercises')}</strong> ${escapeHTML(session.typeExercice.join(', '))}</div>` : ''}
                            ${Array.isArray(session.pilotes) && session.pilotes.length > 0 ? `<div><strong>${tt('history.pilots')}</strong> ${escapeHTML(session.pilotes.join(', '))}</div>` : ''}
                        </div>
                        ${session.commentaire ? `<div class="session-comment">"${escapeHTML(session.commentaire)}"</div>` : ''}
                        ${session.rawIgc || session.traceCloud || (session.traceGps && session.traceGps.length > 0) ? `<button class="btn-view-trace action-btn-secondary" style="margin-top: 10px; width: 100%; border: 1px solid var(--accent-orange); color: var(--accent-orange); padding: 8px; border-radius: 6px; cursor: pointer; background: transparent; transition: all 0.2s;" data-action="showTrace" data-args="${session.id}"><i class="ri-route-line"></i> ${tt('history.showTrace')}</button><button class="btn-download-trace action-btn-secondary" style="margin-top: 6px; width: 100%; padding: 8px; border-radius: 6px; cursor: pointer;" data-action="downloadTrace" data-args="${session.id}"><i class="ri-download-2-line"></i> ${tt('history.downloadIgc')}</button><div id="trace-container-${session.id}" style="display:none; margin-top: 10px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border-light);"></div>` : ''}
                        <div data-session-weather="${session.id}">${meteoHtml}</div>
                    </div>
                </div>
            `;
            } catch (err) {
                // Un enregistrement corrompu/partiel ne doit plus faire disparaître tout le
                // carnet (cf. bugs .toLowerCase() sur un champ manquant) : on saute cette carte
                // et on continue le rendu des autres vols.
                console.warn('[LogbookView] Vol illisible ignoré lors du rendu :', session?.id, err);
            }
        });

        const state = this._captureHistoryState(container);
        container.innerHTML = html;
        this._restoreHistoryState(container, state);
    }

    // Redessiner le carnet (après une modification, une synchro qui a changé des données…) ne doit
    // pas faire perdre au pilote ce qu'il regardait : position dans la liste, encarts dépliés
    // (statistiques détaillées, balise) et traces affichées sont gardés.
    _captureHistoryState(container) {
        const scroller = document.getElementById('logbook-screen');
        const openDetails = [];
        container.querySelectorAll('.logbook-card[data-session-id]').forEach((card) => {
            const id = /** @type {HTMLElement} */ (card).dataset.sessionId;
            card.querySelectorAll('details').forEach((details, index) => {
                if (/** @type {HTMLDetailsElement} */ (details).open) openDetails.push({ id, index });
            });
        });
        const openTraces = Array.from(container.querySelectorAll('[id^="trace-container-"]'))
            .filter((el) => /** @type {HTMLElement} */ (el).style.display === 'block')
            .map((el) => el.id.slice('trace-container-'.length));
        return { scrollTop: scroller ? scroller.scrollTop : null, openDetails, openTraces };
    }

    _restoreHistoryState(container, state) {
        const cardOf = (id) =>
            Array.from(container.querySelectorAll('.logbook-card[data-session-id]')).find(
                (card) => /** @type {HTMLElement} */ (card).dataset.sessionId === id,
            );
        state.openDetails.forEach(({ id, index }) => {
            const details = cardOf(id)?.querySelectorAll('details')[index];
            if (details) /** @type {HTMLDetailsElement} */ (details).open = true;
        });
        const scroller = document.getElementById('logbook-screen');
        const restoreScroll = () => {
            if (scroller && state.scrollTop !== null) scroller.scrollTop = state.scrollTop;
        };
        restoreScroll();
        if (state.openTraces.length) {
            Promise.all(state.openTraces.filter((id) => cardOf(id)).map((id) => this.showTrace(id)))
                .catch((err) => console.warn('[LogbookView] Trace non rouverte :', err))
                .then(restoreScroll);
        }
    }

    // Télécharge le fichier .igc d'origine du vol, tel qu'il a été importé.
    async downloadTrace(sessionId) {
        const flight = LogbookService.getFlightById(sessionId);
        const rawIgc = flight ? await LogbookService.getFlightTrace(sessionId) : null;
        if (!rawIgc) {
            // Une trace qui est dans le compte mais n'a pas pu être récupérée n'est pas « introuvable ».
            alert(tl(flight?.traceCloud ? 'cloudTrace.unavailable' : 'export.noTrace'));
            return;
        }
        saveTextFile(buildIgcFileName(flight), rawIgc, 'application/octet-stream');
    }

    // Ouvre le bilan imprimable du carnet (« Enregistrer au format PDF » dans la boîte d'impression).
    async exportLogbookPdf() {
        const flights = LogbookService.getFlights();
        if (flights.length === 0) {
            alert(tl('export.empty'));
            return;
        }
        try {
            await printHtml(buildLogbookReportHtml(flights));
        } catch (error) {
            console.error('Logbook print failed', error);
            alert(tl('export.printError'));
        }
    }

    async showTrace(sessionId) {
        const container = document.getElementById(`trace-container-${sessionId}`);
        if (!container) return;

        if (container.style.display === 'block') {
            container.style.display = 'none';
            (await loadMap3D()).clearPlayback();
            return;
        }

        const session = LogbookService.getFlightById(sessionId);
        if (!session) return;

        let rawIgc = session.rawIgc;
        const hasGpsPoints = Boolean(session.traceGps && session.traceGps.length > 0);
        if (!rawIgc && !hasGpsPoints) {
            // Trace seulement dans le compte (vol importé sur un autre appareil) : on le dit pendant le téléchargement.
            const fromCloud = Boolean(session.traceCloud) && !(await LogbookService.getLocalFlightTrace(sessionId));
            if (fromCloud) {
                container.style.display = 'block';
                container.textContent = tl('cloudTrace.loading');
            }
            rawIgc = await LogbookService.getFlightTrace(sessionId);
            if (!rawIgc) {
                if (fromCloud) container.textContent = tl('cloudTrace.unavailable');
                return;
            }
        }

        let points = session.traceGps;
        if (rawIgc) {
            const result = LogbookService.parseIGC(rawIgc, session.altOffset || 0);
            if (result.success && result.data.points) {
                points = result.data.points;
            } else {
                console.error('Erreur de parsing IGC à la volée :', result.error);
                return;
            }
        }

        container.style.display = 'block';

        try {
            await (await loadMap3D()).showTrace(sessionId, points, container);
        } catch (error) {
            console.error('Map3DComponent Error: Erreur lors du dessin de la trace.', error);
            container.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-secondary);">${tt('history.trace3dError', { error: error.message })}</div>`;
        }
    }

    getWeatherEmoji(code) {
        if (code === 0) return '☀️';
        if (code === 1 || code === 2) return '🌤️';
        if (code === 3) return '☁️';
        if (code >= 45 && code <= 48) return '🌫️';
        if (code >= 51 && code <= 67) return '🌧️';
        if (code >= 71 && code <= 77) return '❄️';
        if (code >= 80 && code <= 82) return '🌦️';
        if (code >= 95) return '⛈️';
        return '☀️';
    }

    getWindDirectionString(deg) {
        if (deg === null || deg === undefined) return '';
        const dirs = EXTENDED_WIND_DIRECTIONS;
        const val = Math.floor(deg / 22.5 + 0.5);
        return dirs[val % 16];
    }

    // Une ligne "Décollage"/"Atterrissage" (ou "Début"/"Fin" pour un gonflage) du bloc météo (modèle Open-Meteo/AROME,
    // valeur estimée au point GPS du site à l'heure donnée).
    renderWeatherPointRow(m, label) {
        if (!m) return '';
        const weatherIcon =
            m.weatherCode !== null && m.weatherCode !== undefined ? this.getWeatherEmoji(m.weatherCode) : '🌤️';
        const dirStr =
            m.ventDirection !== null && m.ventDirection !== undefined
                ? this.getWindDirectionString(m.ventDirection)
                : '';

        return `
        <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 4px 0;">
            <span style="font-weight: 600; min-width: 90px;">${escapeHTML(label)} :</span>
            <span title="${tt('weather.temperatureTitle')}"><strong>${weatherIcon} ${tt('weather.temperature', { value: m.temperature })}</strong></span>
            <span style="color: rgba(0,0,0,0.2);">|</span>
            <span title="${tt('weather.windTitle')}"><i class="ri-windy-line" style="color: var(--accent-orange);"></i> <strong>${tt('weather.wind')}</strong> ${tt('weather.windSpeed', { value: m.ventVitesse })} ${m.ventRafales ? tt('weather.gusts', { value: m.ventRafales }) : ''}</span>
            ${
                m.ventDirection !== null && m.ventDirection !== undefined
                    ? `
            <span style="color: rgba(0,0,0,0.2);">|</span>
            <span title="${tt('weather.directionTitle')}"><i class="ri-arrow-up-fill" style="color: #10b981; font-size: 1.05em; display:inline-block; transform: rotate(${m.ventDirection}deg);"></i> <strong>${tt('weather.direction')}</strong> ${dirStr} (${m.ventDirection}°)</span>
            `
                    : ''
            }
        </div>`;
    }

    // Graphe réel de la balise météo FFVL associée au site, pour le jour du vol.
    // Contrairement au bloc ci-dessus (modèle AROME estimé au point GPS), c'est la
    // mesure effective de la balise la plus proche -- balisemeteo.com n'expose pas
    // de valeur numérique historique en API, seulement ce graphe image par jour, donc
    // on l'affiche tel quel avec un lien pour lire la valeur précise à l'heure du vol.
    renderBaliseHistoBlock(session) {
        if (!session.baliseId) return '';
        const dateStr = (session.datetime || '').split('T')[0];
        if (!dateStr) return '';

        const histoPageUrl = `https://balisemeteo.com/balise_histo.php?idBalise=${encodeURIComponent(session.baliseId)}&date=${encodeURIComponent(dateStr)}`;
        const graphUrl = `https://balisemeteo.com/graphs/histo_vent.php?idBalise=${encodeURIComponent(session.baliseId)}&interval=1&marks=false&date=${encodeURIComponent(dateStr)}`;

        return `
        <details class="logbook-card-balise" style="margin-top: 8px; padding: 10px; background: var(--bg-card-hover, rgba(0,0,0,0.03)); border-radius: var(--radius-sm); border: 1px solid var(--border-light, rgba(0,0,0,0.06)); font-size: 0.82rem; color: var(--text-secondary);">
            <summary style="cursor: pointer; display: flex; align-items: center; gap: 6px; list-style: revert;">
                <i class="ri-broadcast-line" style="color: var(--accent-orange);"></i> <strong>${tt('weather.beacon', { date: dateStr.split('-').reverse().join('/') })}</strong>
            </summary>
            <div style="margin-top: 8px;">
                <a href="${histoPageUrl}" target="_blank" rel="noopener noreferrer">
                    <img src="${graphUrl}" alt="${tt('weather.beaconAlt')}" loading="lazy" style="width: 100%; max-width: 500px; height: auto; border-radius: 4px; display: block;">
                </a>
                <a href="${histoPageUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; margin-top: 6px; color: var(--accent-orange); text-decoration: none; font-size: 0.78rem;">
                    ${tt('weather.beaconHistory')} <i class="ri-external-link-line"></i>
                </a>
            </div>
        </details>`;
    }

    forceWeatherRefresh(sessionId) {
        const session = LogbookService.getFlights().find((s) => s.id === sessionId);
        if (!session) return;

        // 1. Immediately show loading state in the UI to remove any error banner
        const container = document.getElementById('weather-container-' + sessionId);
        if (container) {
            container.innerHTML = `<div style="color: var(--accent-orange); font-size: 0.85rem; padding: 8px 12px; background: rgba(14,165,233,0.08); border-radius: var(--radius-sm); display: inline-flex; align-items: center; gap: 6px;"><i class="ri-loader-4-line ri-spin"></i> <strong>${tt('weather.loading')}</strong></div>`;
        }

        let lat = null,
            lon = null;
        let baliseId = null;
        const siteName = session.site || session.lieu || '';

        if (session.lat && session.lon) {
            lat = session.lat;
            lon = session.lon;
            console.log('[Météo Logbook] Utilisation des coordonnées IGC en dur (Refresh) :', lat, lon);
        } else {
            if (siteName) {
                console.log('[Météo Logbook] Saisie (Refresh) :', siteName);

                const foundSite = this.findSiteByName(siteName);
                if (foundSite) {
                    console.log('[Météo Logbook] Site trouvé au rafraîchissement :', foundSite.nom);
                    const coords = this.getSiteCoords(foundSite);
                    if (coords.lat && coords.lon) {
                        lat = coords.lat;
                        lon = coords.lon;
                    } else {
                        console.warn("[Météo Logbook] Le site n'a pas de coordonnées valides :", foundSite);
                    }
                    baliseId = getSpotairWidgetId(foundSite);
                } else {
                    console.error('[Météo Logbook] Aucun match pour :', siteName);
                }
            }
        }

        if (lat && lon) {
            this.fetchWeatherForSession(lat, lon, session.datetime, session.id, session.duree, baliseId);
        } else {
            if (container) {
                const searchedString = this.normalizeString(siteName || tl('weather.emptyInput'));
                const sites = SitesService.getSites();
                const availableNamesSample =
                    sites.length > 0
                        ? sites
                              .slice(0, 3)
                              .map((s) => this.normalizeString(s.nom))
                              .join(' | ')
                        : tl('weather.emptyBase');
                container.innerHTML = `<div style="color: #ef4444; font-size: 0.85rem; padding: 8px 12px; background: rgba(239,68,68,0.08); border-radius: var(--radius-sm); line-height: 1.4;"><i class="ri-error-warning-line"></i> <strong>${tt('weather.errorTitle')}</strong> ${tt('weather.notFound', { input: searchedString })}<br><span style="font-size: 0.75rem; opacity: 0.8; word-break: break-all;">${tt('weather.sample', { sample: availableNamesSample })}</span></div>`;
            }
        }
    }

    // --- WEATHER MODULE (Open-Meteo pour les chiffres + balise FFVL réelle pour la vérif visuelle) ---
    async fetchWeatherForSession(lat, lon, datetimeStr, sessionId, dureeMin, baliseId) {
        console.log(`Fetching weather for session ${sessionId}...`);
        const landingDatetimeStr = addMinutesToDatetimeLocal(datetimeStr, dureeMin);

        const [decollageResult, atterroResult] = await Promise.all([
            LogbookService.fetchSessionWeather(lat, lon, datetimeStr),
            landingDatetimeStr && landingDatetimeStr !== datetimeStr
                ? LogbookService.fetchSessionWeather(lat, lon, landingDatetimeStr)
                : Promise.resolve({ success: false, data: null, error: null }),
        ]);

        if (decollageResult.success) {
            const sessionIndex = LogbookService.getFlights().findIndex((s) => s.id === sessionId);
            if (sessionIndex !== -1) {
                const target = LogbookService.getFlights()[sessionIndex];
                target.meteo = decollageResult.data;
                target.meteoAtterro = atterroResult.success ? atterroResult.data : null;

                // Météo rigoureusement identique au décollage et à l'atterrissage : une seule ligne,
                // « Décollage et atterrissage ». L'indicateur est explicite : une météo d'atterrissage
                // absente (échec, séance ancienne) ne doit jamais être présentée comme identique.
                target.meteoAtterroSame =
                    !!target.meteoAtterro && JSON.stringify(target.meteo) === JSON.stringify(target.meteoAtterro);
                if (target.meteoAtterroSame) target.meteoAtterro = null;

                target.baliseId = baliseId || null;
                LogbookService.saveFlights(); // Persiste en localStorage et déclenche la synchro Firestore

                this.refreshSessionWeather(sessionId);
                console.log(`Weather data fetched successfully for session ${sessionId}.`);
            }
        } else {
            console.error('Error fetching weather for session:', decollageResult.error);
            const container = document.getElementById('weather-container-' + sessionId);
            if (container) {
                container.innerHTML = `<div style="color: #f59e0b; font-size: 0.85rem; padding: 8px 12px; background: rgba(245,158,11,0.08); border-radius: var(--radius-sm);"><i class="ri-alert-line"></i> ${tt('weather.unavailable', { error: decollageResult.error })}</div>`;
            }
        }
    } // Ends fetchWeather method
}
