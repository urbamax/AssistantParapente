/**
 * VIEW - Logbook statistics (Stats tab)
 * Base class of LogbookView (see logbook.js): KPI cards, personal records, charts, the detailed
 * analysis of a flight and "Tout recalculer". Kept in its own file so logbook.js stays about
 * sessions; behaviour is unchanged.
 */
import LogbookService from '../services/logbook_service.js';
import { escapeHTML } from '../core/security.js';
import { formatDuration, formatDateOnly } from '../utils/date_utils.js';
import { toSorted } from '../utils/array_utils.js';
import { courseStats } from '../services/logbook_courses.js';
import { tt, tl } from './logbook_strings.js';
import { LogbookEquipmentBase } from './logbook_equipment.js';

export class LogbookStatsBase extends LogbookEquipmentBase {
    /** À fournir par LogbookView : « Tout recalculer » redessine l'historique. */
    renderHistory() {
        throw new Error('LogbookView must implement renderHistory()');
    }

    // Statistiques détaillées d'un vol calculées depuis sa trace (IGCParser.analyzeFlight),
    // repliées sous la carte. Les altitudes absolues reçoivent la correction du pilote.
    // Statistiques détaillées d'un vol calculées depuis sa trace (IGCParser.analyzeFlight),
    // repliées sous la carte. Les altitudes absolues reçoivent la correction du pilote.
    renderFlightAnalysis(session) {
        const sensors = session.sensorStats && typeof session.sensorStats === 'object' ? session.sensorStats : null;
        const device = session.instrument && typeof session.instrument === 'object' ? session.instrument : null;
        const a =
            session.igcStats && typeof session.igcStats === 'object' ? session.igcStats : sensors || device ? {} : null;
        if (!a) return '';
        const offset = Number(session.altOffset) || 0;
        const num = (v) => typeof v === 'number' && Number.isFinite(v);
        const row = (key, value, cond = true) =>
            cond
                ? `<div class="flight-analysis-row"><span>${tt(`analysis.${key}`)}</span><strong>${value}</strong></div>`
                : '';
        const group = (title, rows) =>
            rows.trim() ? `<div class="flight-analysis-group"><h4>${tt(`analysis.${title}`)}</h4>${rows}</div>` : '';

        const altitudes =
            row('takeoffAlt', `${a.takeoffAlt + offset} m`, num(a.takeoffAlt)) +
            row('landingAlt', `${a.landingAlt + offset} m`, num(a.landingAlt)) +
            row('minAlt', `${a.minAlt + offset} m`, num(a.minAlt)) +
            row('maxAboveTakeoff', `${a.maxAltAboveTakeoff} m`, num(a.maxAltAboveTakeoff)) +
            row('cumulativeClimb', `${a.cumulativeClimb} m`, num(a.cumulativeClimb));
        const vario =
            row('maxClimb', `+${session.maxClimbRate} m/s`, num(session.maxClimbRate)) +
            row('maxSink', `${a.maxSinkRate} m/s`, num(a.maxSinkRate)) +
            row('avgVario', `${a.avgVario > 0 ? '+' : ''}${a.avgVario} m/s`, num(a.avgVario));
        const thermals = !num(a.thermalCount)
            ? ''
            : a.thermalCount
              ? row('thermalCount', a.thermalCount) +
                row('thermalTime', `${a.thermalMinutes} min (${a.thermalPercent} %)`) +
                row('avgThermalClimb', `+${a.avgThermalClimb} m/s`) +
                row('bestThermalClimb', `+${a.bestThermalClimb} m/s`) +
                row('maxThermalGain', `${a.maxThermalGain} m`) +
                row('turns', tt('analysis.turnsValue', { left: a.turnsLeft, right: a.turnsRight }))
              : row('thermalCount', '0');
        const glides =
            row('glideRatio', a.glideRatio, num(a.glideRatio)) +
            row('bestGlideRatio', a.bestGlideRatio, num(a.bestGlideRatio)) +
            row('glideSpeed', `${a.glideSpeedKmh} km/h`, num(a.glideSpeedKmh)) +
            row('maxSpeed', `${session.maxSpeedKmh} km/h`, num(session.maxSpeedKmh)) +
            row('avgSpeed', `${session.avgSpeedKmh} km/h`, num(session.avgSpeedKmh));
        const distances =
            row('pathDistance', `${session.distanceKm} km`, num(session.distanceKm)) +
            row('freeDistance', `${a.freeDistanceKm} km`, num(a.freeDistanceKm)) +
            row('maxFromTakeoff', `${a.maxFromTakeoffKm} km`, num(a.maxFromTakeoffKm)) +
            row('straightDistance', `${a.straightDistanceKm} km`, num(a.straightDistanceKm));

        const w = a.winch && typeof a.winch === 'object' ? a.winch : null;
        const winch = w
            ? row('towTime', formatDuration(Math.round(w.towSeconds / 60)) + ` (${w.towSeconds} s)`) +
              row('release', tt('analysis.releaseValue', { alt: w.releaseAlt + offset, height: w.releaseHeight })) +
              row('towClimb', tt('analysis.towClimbValue', { avg: w.avgClimb, max: w.maxClimb })) +
              row('towDistance', `${Math.round(w.towDistanceKm * 1000)} m`) +
              row('gRelease', `${sensors && sensors.gRelease} g`, Boolean(sensors && num(sensors.gRelease)))
            : '';

        // Facteur de charge : mesuré par l'accéléromètre (.sdf Syride), sinon estimé depuis
        // les virages de la trace.
        const loads = sensors
            ? row('gMax', `${sensors.gMax} g`, num(sensors.gMax)) + row('gMin', `${sensors.gMin} g`, num(sensors.gMin))
            : row('gEstimated', `≈ ${a.estimatedMaxG} g`, num(a.estimatedMaxG));

        // Instrument qui a enregistré la trace (en-tête de l'IGC)
        const text = (v) => escapeHTML(String(v));
        const instrument = device
            ? row('instrumentBrand', text(device.brand), Boolean(device.brand)) +
              row('instrumentModel', text(device.model), Boolean(device.model)) +
              row('instrumentSerial', text(device.serial), Boolean(device.serial)) +
              row('instrumentFirmware', text(device.firmware), Boolean(device.firmware)) +
              row('instrumentHardware', text(device.hardware), Boolean(device.hardware)) +
              row('instrumentGps', text(device.gps), Boolean(device.gps)) +
              row('instrumentPressure', text(device.pressureSensor), Boolean(device.pressureSensor))
            : '';

        return `
                    <details class="flight-analysis">
                        <summary><i class="ri-bar-chart-2-line"></i> ${tt('analysis.title')}</summary>
                        <div class="flight-analysis-grid">
                            ${group('winch', winch)}
                            ${group('altitudes', altitudes)}
                            ${group('vario', vario)}
                            ${group('thermals', thermals)}
                            ${group('glides', glides)}
                            ${group('distances', distances)}
                            ${group(sensors ? 'sensors' : 'loads', loads)}
                            ${group('instrument', instrument)}
                        </div>
                    </details>`;
    }

    // Records personnels tirés des vols (et de leurs traces GPS) : valeur, date et site.
    renderRecords(flights) {
        const stat = (f, path) => path.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), f);
        /** @type {Array<[string, string, (v: number) => string | number]>} */
        const records = [
            ['longestFlight', 'duree', (v) => formatDuration(v)],
            ['highest', 'altitudeMax', (v) => `${v} m`],
            ['freeDistance', 'igcStats.freeDistanceKm', (v) => `${v} km`],
            ['maxFromTakeoff', 'igcStats.maxFromTakeoffKm', (v) => `${v} km`],
            ['bestThermal', 'igcStats.bestThermalClimb', (v) => `+${v} m/s`],
            ['maxThermalGain', 'igcStats.maxThermalGain', (v) => `${v} m`],
            ['cumulativeClimb', 'igcStats.cumulativeClimb', (v) => `${v} m`],
            ['maxClimb', 'maxClimbRate', (v) => `+${v} m/s`],
            ['bestGlide', 'igcStats.bestGlideRatio', (v) => v],
            ['maxSpeed', 'maxSpeedKmh', (v) => `${v} km/h`],
            ['gMax', 'sensorStats.gMax', (v) => `${v} g`],
            ['highestRelease', 'igcStats.winch.releaseHeight', (v) => `${v} m`],
        ];
        let rows = '';
        for (const [key, path, format] of records) {
            let best = null;
            for (const f of flights) {
                const v = stat(f, path);
                if (typeof v === 'number' && Number.isFinite(v) && v > 0 && (!best || v > best.v)) best = { v, f };
            }
            if (!best) continue;
            const icons = {
                longestFlight: 'ri-time-line',
                highest: 'ri-arrow-up-circle-line',
                freeDistance: 'ri-route-line',
                maxFromTakeoff: 'ri-flight-takeoff-line',
                bestThermal: 'ri-fire-line',
                maxThermalGain: 'ri-arrow-up-line',
                cumulativeClimb: 'ri-funds-line',
                maxClimb: 'ri-stock-line',
                bestGlide: 'ri-flight-land-line',
                maxSpeed: 'ri-speed-up-line',
                gMax: 'ri-dashboard-3-line',
                highestRelease: 'ri-arrow-up-double-line',
            };
            const iconClass = icons[key] || 'ri-trophy-line';
            rows += `
                    <div class="record-row" role="button" tabindex="0" data-action="scrollToSession" data-args="${best.f.id}">
                        <div class="record-icon"><i class="${iconClass}"></i></div>
                        <div class="record-content">
                            <div class="record-label">${tt(`records.${key}`)}</div>
                            <div class="record-when"><i class="ri-calendar-event-line"></i> ${escapeHTML(formatDateOnly(best.f.datetime))} ${best.f.site ? `• <i class="ri-map-pin-line"></i> ${escapeHTML(best.f.site)}` : ''}</div>
                        </div>
                        <div class="record-value-container">
                            <strong class="record-value">${format(best.v)}</strong>
                            <i class="ri-arrow-right-s-line record-chevron"></i>
                        </div>
                    </div>`;
        }

        // Cumuls sur les vols avec trace analysée
        const analysed = flights.filter((f) => f.igcStats && typeof f.igcStats === 'object');
        const sum = (fn) => analysed.reduce((acc, f) => acc + (Number(fn(f)) || 0), 0);
        const totals = analysed.length
            ? tt('records.totals', {
                  flights: analysed.length,
                  distance: Math.round(sum((f) => f.distanceKm) * 10) / 10,
                  climb: Math.round(sum((f) => f.igcStats.cumulativeClimb)),
                  thermals: sum((f) => f.igcStats.thermalCount),
                  thermalTime: formatDuration(sum((f) => f.igcStats.thermalMinutes)),
              })
            : '';

        // Vols avec trace dont l'analyse détaillée manque (importés avant cette version)
        const withTrace = flights.filter((f) => f.rawIgc || (f.traceGps && f.traceGps.length > 0));
        const missing = withTrace.filter((f) => !f.igcStats).length;

        if (!rows && !withTrace.length) return '';
        return `
            <div class="stats-section-box">
                <h3 class="stats-section-title"><i class="ri-trophy-line" style="color: #f59e0b"></i> ${tt('records.title')}</h3>
                ${totals ? `<p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0 0 12px;">${totals}</p>` : ''}
                <div class="records-grid">${rows}</div>
                <button type="button" class="action-btn-secondary" data-action="recomputeAllTraceStats" style="margin-top: 14px; width: 100%; border: 1px solid var(--accent-orange); color: var(--accent-orange); padding: 10px; border-radius: var(--radius-md, 8px); cursor: pointer; background: transparent; font-weight: 600;">
                    <i class="ri-refresh-line"></i> ${missing ? tt('records.recomputeMissing', { count: missing }) : tt('records.recompute')}
                </button>
            </div>`;
    }

    // « Tout recalculer » (à côté d'« Ajouter une session », et dans les records) : chaque vol avec
    // trace est recalculé comme avec son bouton « Recalculer », après confirmation.
    async recomputeAllTraceStats(_args, _event, button) {
        if (!confirm(tl('records.recomputeConfirm'))) return;
        if (button && button.disabled !== undefined) button.disabled = true;
        const count = await LogbookService.recomputeAllTraceStats();
        if (button && button.disabled !== undefined) button.disabled = false;
        alert(tl('records.recomputed', { count }));
        this.renderStats();
        this.renderHistory();
    }

    renderStats() {
        const container = document.getElementById('logbook-stats-container');
        if (!container) return;

        if (LogbookService.getFlights().length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>${tt('stats.empty')}</p>
                </div>
            `;
            return;
        }

        // Calculations
        let totalVols = 0;
        let totalTimeVols = 0;
        let totalGonflages = 0;
        let totalTimeGonflages = 0;

        const equipStats = {}; // { voileName: { vols: 0, timeVols: 0, gonflages: 0, timeGonflages: 0 } }
        const sitesStats = {}; // { siteName: count }
        const volTypes = {}; // { typeName: count }
        const exoTypes = {}; // { typeName: count }
        const decoTypes = {}; // { typeName: count }
        const schoolStats = {}; // { schoolName: { vols: 0, timeVols: 0, gonflages: 0, timeGonflages: 0 } }

        let maxAltitudeReached = 0;
        let totalGain = 0;

        LogbookService.getFlights().forEach((s) => {
            if (s.type === 'vol') {
                totalVols++;
                totalTimeVols += s.duree;

                // Location
                sitesStats[s.site] = (sitesStats[s.site] || 0) + 1;
                // Type
                volTypes[s.typeVol] = (volTypes[s.typeVol] || 0) + 1;
                // Deco
                if (s.techDecollage) {
                    decoTypes[s.techDecollage] = (decoTypes[s.techDecollage] || 0) + 1;
                }
                // Stats globales
                if (s.altitudeMax && s.altitudeMax > maxAltitudeReached) {
                    maxAltitudeReached = s.altitudeMax;
                }
                if (s.gain && s.gain > 0) {
                    totalGain += s.gain;
                }
            } else {
                totalGonflages++;
                totalTimeGonflages += s.duree;

                // Location
                sitesStats[s.lieu] = (sitesStats[s.lieu] || 0) + 1;
                // Type
                if (s.typeExercice) {
                    if (Array.isArray(s.typeExercice)) {
                        s.typeExercice.forEach((exo) => {
                            exoTypes[exo] = (exoTypes[exo] || 0) + 1;
                        });
                    } else {
                        exoTypes[s.typeExercice] = (exoTypes[s.typeExercice] || 0) + 1;
                    }
                }
            }

            // Sessions encadrées par une école
            const school = typeof s.ecole === 'string' ? s.ecole.trim() : '';
            if (school) {
                if (!schoolStats[school]) {
                    schoolStats[school] = { vols: 0, timeVols: 0, gonflages: 0, timeGonflages: 0 };
                }
                if (s.type === 'vol') {
                    schoolStats[school].vols++;
                    schoolStats[school].timeVols += s.duree;
                } else {
                    schoolStats[school].gonflages++;
                    schoolStats[school].timeGonflages += s.duree;
                }
            }

            // Equipment (Grouping by Voile)
            const equipKey = s.voile;
            if (equipKey) {
                if (!equipStats[equipKey]) {
                    equipStats[equipKey] = { vols: 0, timeVols: 0, gonflages: 0, timeGonflages: 0 };
                }
                if (s.type === 'vol') {
                    equipStats[equipKey].vols++;
                    equipStats[equipKey].timeVols += s.duree;
                } else {
                    equipStats[equipKey].gonflages++;
                    equipStats[equipKey].timeGonflages += s.duree;
                }
            }
        });

        // Top Sites (ES2023 toSorted)
        const topSites = toSorted(Object.entries(sitesStats), (a, b) => b[1] - a[1]).slice(0, 5);

        // Building HTML
        let html = `
            <div class="stats-grid">
                <!-- KPI: Vols -->
                <div class="kpi-card" role="button" tabindex="0" data-action="filterHistoryByStat" data-stat-type="type" data-stat-value="vol" title="${tt('stats.filterBy', { name: tl('history.badgeFlight') })}">
                    <div class="kpi-icon" style="background-color: var(--accent-orange); color: white;"><i class="ri-windy-line"></i></div>
                    <div class="kpi-info">
                        <div class="kpi-value">${tt('stats.flights', { count: totalVols })}</div>
                        <div class="kpi-label">${tt('stats.flightTime', { duration: formatDuration(totalTimeVols) })}</div>
                    </div>
                </div>
                <!-- KPI: Gonflages -->
                <div class="kpi-card" role="button" tabindex="0" data-action="filterHistoryByStat" data-stat-type="type" data-stat-value="gonflage" title="${tt('stats.filterBy', { name: tl('history.badgeGround') })}">
                    <div class="kpi-icon" style="background-color: #f59e0b; color: white;"><i class="ri-footprint-line"></i></div>
                    <div class="kpi-info">
                        <div class="kpi-value">${tt('stats.groundSessions', { count: totalGonflages })}</div>
                        <div class="kpi-label">${tt('stats.groundTime', { duration: formatDuration(totalTimeGonflages) })}</div>
                    </div>
                </div>
                <!-- KPI: Alt Max -->
                <div class="kpi-card">
                    <div class="kpi-icon" style="background-color: #8b5cf6; color: white;"><i class="ri-mist-line"></i></div>
                    <div class="kpi-info">
                        <div class="kpi-value">${maxAltitudeReached} m</div>
                        <div class="kpi-label">${tt('stats.maxAltitude')}</div>
                    </div>
                </div>
                <!-- KPI: Gain -->
                <div class="kpi-card">
                    <div class="kpi-icon" style="background: #10b981; color: white;"><i class="ri-arrow-up-line"></i></div>
                    <div class="kpi-info">
                        <div class="kpi-value">${totalGain} m</div>
                        <div class="kpi-label">${tt('stats.totalGain')}</div>
                    </div>
                </div>
            </div>
        `;

        html += this.renderRecords(LogbookService.getFlights().filter((f) => f.type === 'vol'));

        // Equipment Stats
        if (Object.keys(equipStats).length > 0) {
            html += `
            <div class="stats-section-box">
                <h3 class="stats-section-title"><i class="ri-umbrella-line" style="color: var(--accent-orange)"></i> ${tt('stats.wings')}</h3>
                <div class="equip-list">`;
            for (const [voile, st] of Object.entries(equipStats)) {
                html += `
                    <div class="equip-card" role="button" tabindex="0" data-action="filterHistoryByStat" data-stat-type="voile" data-stat-value="${escapeHTML(voile)}" title="${tt('stats.filterBy', { name: voile })}">
                        <div class="equip-name">${escapeHTML(voile)}</div>
                        <div class="equip-details">
                            <span style="color: var(--accent-orange)">${tt('stats.wingFlights', { count: st.vols, duration: formatDuration(st.timeVols) })}</span>
                            <span style="color: #f59e0b">${tt('stats.wingGround', { count: st.gonflages, duration: formatDuration(st.timeGonflages) })}</span>
                        </div>
                        ${(() => {
                            const equipObj = LogbookService.getEquipment().find(
                                (e) => (e.nom || '').toLowerCase() === voile.toLowerCase(),
                            );
                            if (equipObj && equipObj.periodiciteHeures > 0) {
                                const totalHours = (st.timeVols + st.timeGonflages) / 60;
                                const hoursRemaining = equipObj.periodiciteHeures - totalHours;
                                const hoursText =
                                    hoursRemaining <= 0
                                        ? `<span style="color:#ef4444; font-weight:bold;">${tt('equipment.overdueBy', { hours: Math.abs(Math.round(hoursRemaining * 10) / 10) })}</span>`
                                        : tt('stats.hoursLeft', { hours: Math.round(hoursRemaining * 10) / 10 });
                                return `<div style="font-size: 0.8rem; margin-top: 6px; color: var(--text-secondary);"><strong>${tt('stats.beforeRevision')}</strong> ${hoursText} ${tt('equipment.ofPeriod', { period: equipObj.periodiciteHeures })}</div>`;
                            }
                            return '';
                        })()}
                    </div>
                `;
            }
            html += `</div></div>`;
        }

        html += `<div class="charts-grid">`;

        // Top Sites Bar Chart
        if (topSites.length > 0) {
            html += `
                <div class="chart-card">
                    <div class="chart-card-header">
                        <h3 class="chart-card-title"><i class="ri-map-pin-2-line" style="color: var(--accent-green)"></i> ${tt('stats.topPlaces')}</h3>
                    </div>
                    <div class="chart-card-body">`;
            const maxVal = topSites[0][1];
            topSites.forEach(([site, count]) => {
                const percent = (count / maxVal) * 100;
                html += `
                    <div class="bar-row" role="button" tabindex="0" data-action="filterHistoryByStat" data-stat-type="site" data-stat-value="${escapeHTML(site)}" title="${tt('stats.filterBy', { name: site })}">
                        <div class="bar-info">
                            <div class="bar-label" title="${escapeHTML(site)}">${escapeHTML(site)}</div>
                            <div class="bar-value">${count}</div>
                        </div>
                        <div class="bar-track">
                            <div class="bar-fill" style="width: ${percent}%; background-color: var(--accent-green)"></div>
                        </div>
                    </div>
                `;
            });
            html += `</div></div>`;
        }

        // Sessions en école, de la plus fréquentée à la moins fréquentée
        const schools = toSorted(
            Object.entries(schoolStats),
            (a, b) => b[1].vols + b[1].gonflages - (a[1].vols + a[1].gonflages),
        );
        if (schools.length > 0) {
            const schoolSessions = schools.reduce((sum, [, st]) => sum + st.vols + st.gonflages, 0);
            html += `
                <div class="chart-card chart-card-wide">
                    <div class="chart-card-header">
                        <h3 class="chart-card-title"><i class="ri-graduation-cap-line" style="color: var(--accent-orange)"></i> ${tt('stats.schools')}</h3>
                        <span class="chart-card-subtitle" style="font-size: 0.85rem; color: var(--text-secondary);">${tt('stats.schoolShare', { count: schoolSessions, total: totalVols + totalGonflages })}</span>
                    </div>
                    <div class="chart-card-body">
                        <div class="equip-list">`;
            for (const [school, st] of schools) {
                html += `
                    <div class="equip-card" role="button" tabindex="0" data-action="filterHistoryByStat" data-stat-type="ecole" data-stat-value="${escapeHTML(school)}" title="${tt('stats.filterBy', { name: school })}">
                        <div class="equip-name">${escapeHTML(school)}</div>
                        <div class="equip-details">
                            <span style="color: var(--accent-orange)">${tt('stats.wingFlights', { count: st.vols, duration: formatDuration(st.timeVols) })}</span>
                            <span style="color: #f59e0b">${tt('stats.wingGround', { count: st.gonflages, duration: formatDuration(st.timeGonflages) })}</span>
                        </div>
                    </div>
                `;
            }
            html += `</div></div></div>`;
        }

        // Stages (sessions d'école rattachées à un stage), du plus fréquenté au moins fréquenté
        const courses = courseStats(LogbookService.getFlights());
        if (courses.length > 0) {
            const courseSessions = courses.reduce((sum, course) => sum + course.sessions, 0);
            html += `
                <div class="chart-card chart-card-wide" data-stage-stats>
                    <div class="chart-card-header">
                        <h3 class="chart-card-title"><i class="ri-calendar-event-line" style="color: var(--accent-orange)"></i> ${tt('stats.courses')}</h3>
                        <span class="chart-card-subtitle" style="font-size: 0.85rem; color: var(--text-secondary);">${tt('stats.courseShare', { count: courseSessions, total: totalVols + totalGonflages })}</span>
                    </div>
                    <div class="chart-card-body">
                        <div class="equip-list">`;
            for (const course of courses) {
                const named = course.key !== '';
                const label = named ? course.name : tl('history.unnamedCourse');
                const details = [course.school, course.specialty].filter(Boolean).map(escapeHTML).join(' · ');
                html += `
                    <div class="equip-card" role="button" tabindex="0" data-action="filterHistoryByStat" data-stat-type="${named ? 'stage' : 'stageUnnamed'}" data-stat-value="${escapeHTML(label)}" title="${tt('stats.filterBy', { name: label })}">
                        <div class="equip-name">${escapeHTML(label)}</div>
                        ${details ? `<div style="font-size: 0.8rem; color: var(--text-secondary);">${details}</div>` : ''}
                        <div class="equip-details">
                            <span style="color: var(--accent-orange)">${tt('stats.wingFlights', { count: course.flights, duration: formatDuration(course.flightMinutes) })}</span>
                            <span style="color: #f59e0b">${tt('stats.wingGround', { count: course.groundSessions, duration: formatDuration(course.groundMinutes) })}</span>
                        </div>
                    </div>
                `;
            }
            html += `</div></div></div>`;
        }

        // Types de Vol
        if (Object.keys(volTypes).length > 0) {
            html += `
                <div class="chart-card">
                    <div class="chart-card-header">
                        <h3 class="chart-card-title"><i class="ri-flight-takeoff-line" style="color: var(--accent-orange)"></i> ${tt('stats.flightTypes')}</h3>
                    </div>
                    <div class="chart-card-body">`;
            for (const [type, count] of Object.entries(volTypes)) {
                const percent = (count / totalVols) * 100;
                html += `
                    <div class="bar-row" role="button" tabindex="0" data-action="filterHistoryByStat" data-stat-type="typeVol" data-stat-value="${escapeHTML(type)}" title="${tt('stats.filterBy', { name: type })}">
                        <div class="bar-info">
                            <div class="bar-label" title="${escapeHTML(type)}">${escapeHTML(type)}</div>
                            <div class="bar-value">${count} (${Math.round(percent)}%)</div>
                        </div>
                        <div class="bar-track">
                            <div class="bar-fill" style="width: ${percent}%; background-color: var(--accent-orange)"></div>
                        </div>
                    </div>
                `;
            }
            html += `</div></div>`;
        }

        // Techniques de déco
        if (Object.keys(decoTypes).length > 0) {
            html += `
                <div class="chart-card">
                    <div class="chart-card-header">
                        <h3 class="chart-card-title"><i class="ri-compass-3-line" style="color: #8b5cf6"></i> ${tt('stats.takeoffTechniques')}</h3>
                    </div>
                    <div class="chart-card-body">`;
            const totalDeco = Object.values(decoTypes).reduce((a, b) => a + b, 0);
            for (const [type, count] of Object.entries(decoTypes)) {
                const percent = (count / totalDeco) * 100;
                html += `
                    <div class="bar-row" role="button" tabindex="0" data-action="filterHistoryByStat" data-stat-type="techDecollage" data-stat-value="${escapeHTML(type)}" title="${tt('stats.filterBy', { name: type })}">
                        <div class="bar-info">
                            <div class="bar-label" title="${escapeHTML(type)}" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHTML(type)}</div>
                            <div class="bar-value">${count} (${Math.round(percent)}%)</div>
                        </div>
                        <div class="bar-track">
                            <div class="bar-fill" style="width: ${percent}%; background-color: #8b5cf6"></div>
                        </div>
                    </div>
                `;
            }
            html += `</div></div>`;
        }

        // Types Exercice
        if (Object.keys(exoTypes).length > 0) {
            html += `
                <div class="chart-card">
                    <div class="chart-card-header">
                        <h3 class="chart-card-title"><i class="ri-footprint-line" style="color: #f59e0b"></i> ${tt('stats.groundExercises')}</h3>
                    </div>
                    <div class="chart-card-body">`;
            for (const [type, count] of Object.entries(exoTypes)) {
                const percent = (count / totalGonflages) * 100;
                html += `
                    <div class="bar-row" role="button" tabindex="0" data-action="filterHistoryByStat" data-stat-type="exercice" data-stat-value="${escapeHTML(type)}" title="${tt('stats.filterBy', { name: type })}">
                        <div class="bar-info">
                            <div class="bar-label" title="${escapeHTML(type)}">${escapeHTML(type)}</div>
                            <div class="bar-value">${count} (${Math.round(percent)}%)</div>
                        </div>
                        <div class="bar-track">
                            <div class="bar-fill" style="width: ${percent}%; background-color: #f59e0b"></div>
                        </div>
                    </div>
                `;
            }
            html += `</div></div>`;
        }

        html += `</div>`;

        container.innerHTML = html;
    }
}
