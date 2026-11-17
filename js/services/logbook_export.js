/**
 * SERVICE - Logbook export
 * Pure builders for what leaves the logbook: the name of a downloaded IGC file and the printable
 * A4 landscape report. No DOM access here: the view hands the result to the browser (download, print).
 */
import { t } from '../utils/i18n.js';
import { escapeHTML } from '../core/security.js';
import { formatDateOnly, formatDuration, parseDateToMs } from '../utils/date_utils.js';
import { degreesToCardinal } from '../utils/geo_utils.js';
import { companionsOf, instructorsOf } from './logbook_courses.js';
import {
    BREVET_CODES,
    PROGRESSION_CHAIN,
    brevetSummary,
    hasAnyBrevetData,
    normalizeBrevetsMap,
} from './brevet_service.js';

/**
 * @typedef {object} ExportedSession
 * @property {string} [id]
 * @property {string} [type] 'vol' ou 'gonflage'
 * @property {string} [datetime]
 * @property {string} [date]
 * @property {boolean} [dateOnly]
 * @property {string} [site]
 * @property {string} [lieu]
 * @property {string} [voile]
 * @property {string} [sellette]
 * @property {boolean} [rescueDeployed]
 * @property {string} [rescueId]
 * @property {number|string} [duree] minutes
 * @property {string} [typeVol]
 * @property {string} [techDecollage]
 * @property {string} [priseTerrain]
 * @property {boolean} [vache]
 * @property {string|string[]} [typeExercice]
 * @property {number|string|null} [altitudeMax]
 * @property {number|string|null} [gain]
 * @property {number|string|null} [altOffset]
 * @property {number|string|null} [distanceKm]
 * @property {number|string|null} [maxClimbRate]
 * @property {number|string|null} [maxSpeedKmh]
 * @property {number|string|null} [avgSpeedKmh]
 * @property {Record<string, any>|null} [igcStats]
 * @property {Record<string, any>|null} [sensorStats]
 * @property {Record<string, any>|null} [instrument]
 * @property {string} [ecole]
 * @property {string} [brevetPrepare]
 * @property {string} [stageName]
 * @property {string} [stageSpecialty]
 * @property {string|string[]} [moniteur]
 * @property {string|string[]} [accompagnateur]
 * @property {string} [treuilleur]
 * @property {string|string[]} [pilotes]
 * @property {Record<string, any>|null} [meteo]
 * @property {Record<string, any>|null} [meteoAtterro]
 * @property {boolean} [meteoAtterroSame]
 * @property {string} [rawIgc]
 * @property {any} [traceCloud]
 * @property {any[]} [traceGps]
 * @property {Record<string, any>} [import]
 * @property {boolean} [varioInFlight]
 * @property {boolean} [varioOffInFlight]
 * @property {string} [commentaire]
 */

const timeFormatter = new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
});

/** « Écharpe à Gérôme » → « echarpe-a-gerome » ; chaîne vide si rien d'exploitable. */
function slugify(text) {
    return String(text || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/**
 * Nom du fichier `.igc` téléchargé pour un vol : `<date>_<site>.igc`.
 * @param {ExportedSession} flight
 * @returns {string}
 */
export function buildIgcFileName(flight) {
    const date = (flight?.datetime || '').slice(0, 10) || 'vol';
    const site = slugify(flight?.site || flight?.lieu) || 'trace';
    return `${date}_${site}.igc`;
}

function textVal(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function finiteNum(value) {
    if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function stringList(value) {
    const raw = Array.isArray(value) ? value : [value];
    return raw.map(textVal).filter(Boolean);
}

function isGroundSession(session) {
    return session?.type === 'gonflage' || (session?.type !== 'vol' && Boolean(session?.lieu && !session?.site));
}

function sessionMinutes(session) {
    const mins = finiteNum(session?.duree);
    return mins !== null && mins > 0 ? Math.round(mins) : 0;
}

function rawDateString(session) {
    return textVal(session?.datetime) || textVal(session?.date);
}

function sessionSortMs(session) {
    const raw = rawDateString(session);
    if (!raw) return 0;
    const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00` : raw;
    return parseDateToMs(normalized);
}

function formatSafeDateOnly(raw) {
    if (!raw) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return formatDateOnly(`${raw}T12:00`);
    if (/^\d{4}-\d{2}-\d{2}T00:00(?::00)?$/.test(raw)) return formatDateOnly(`${raw.slice(0, 10)}T12:00`);
    return formatDateOnly(raw);
}

function formatSessionDateParts(session) {
    const raw = rawDateString(session);
    if (!raw) return { date: '', time: '' };
    const pureDate = /^\d{4}-\d{2}-\d{2}$/.test(raw);
    if (session?.dateOnly || pureDate) {
        return { date: formatSafeDateOnly(raw), time: '' };
    }
    const date = formatDateOnly(raw);
    const parsed = new Date(raw);
    const time = !isNaN(parsed.getTime()) ? timeFormatter.format(parsed) : '';
    return { date, time };
}

function hasGpsTrace(session) {
    return Boolean(
        session?.rawIgc || session?.traceCloud || (Array.isArray(session?.traceGps) && session.traceGps.length > 0),
    );
}

function linesHtml(items) {
    const valid = items.filter(Boolean);
    return valid.length ? valid.join('') : '<span class="muted">—</span>';
}

function subLine(text) {
    return text ? `<div class="sub">${escapeHTML(text)}</div>` : '';
}

function badge(text, cls = '') {
    return `<span class="badge${cls ? ` ${cls}` : ''}">${escapeHTML(text)}</span>`;
}

function formatWeatherPoint(w, labelKey) {
    if (!w || typeof w !== 'object') return '';
    const parts = [];
    const temp = finiteNum(w.temperature);
    if (temp !== null) parts.push(`${Math.round(temp)}°C`);
    const speed = finiteNum(w.ventVitesse);
    const gusts = finiteNum(w.ventRafales);
    if (speed !== null) {
        let wind = t('logbook.export.labels.weatherWind', { speed: Math.round(speed) });
        if (gusts !== null) wind += ` ${t('logbook.export.labels.weatherGusts', { gusts: Math.round(gusts) })}`;
        parts.push(wind);
    }
    const dir = finiteNum(w.ventDirection);
    if (dir !== null) parts.push(`${degreesToCardinal(dir)} (${Math.round(dir)}°)`);
    if (parts.length === 0) return '';
    return subLine(t(labelKey, { value: parts.join(' · ') }));
}

function computeSummary(sessions) {
    const flightsList = sessions.filter((s) => !isGroundSession(s));
    const groundList = sessions.filter(isGroundSession);
    const sumDuration = (list) => list.reduce((sum, s) => sum + sessionMinutes(s), 0);

    let longestFlight = 0;
    let maxAltitude = null;
    let totalGain = 0;
    let totalDescent = 0;
    let totalDistanceKm = 0;
    let maxFreeDistanceKm = 0;
    let schoolCount = 0;
    const sites = new Set();
    /** @type {Map<string, {name: string, flights: number, flightMinutes: number, ground: number, groundMinutes: number}>} */
    const wings = new Map();

    for (const s of sessions) {
        const mins = sessionMinutes(s);
        const place = textVal(s.site) || textVal(s.lieu);
        if (place) sites.add(place.toLowerCase());
        if (textVal(s.ecole)) schoolCount++;

        const wingName = textVal(s.voile);
        if (wingName) {
            const key = wingName.toLowerCase();
            let entry = wings.get(key);
            if (!entry) {
                entry = { name: wingName, flights: 0, flightMinutes: 0, ground: 0, groundMinutes: 0 };
                wings.set(key, entry);
            }
            if (isGroundSession(s)) {
                entry.ground++;
                entry.groundMinutes += mins;
            } else {
                entry.flights++;
                entry.flightMinutes += mins;
            }
        }

        if (isGroundSession(s)) continue;
        if (mins > longestFlight) longestFlight = mins;

        const altMax = finiteNum(s.altitudeMax);
        if (altMax !== null && (maxAltitude === null || altMax > maxAltitude)) maxAltitude = Math.round(altMax);

        const gain = finiteNum(s.gain);
        if (gain !== null && gain > 0) totalGain += Math.round(gain);

        const stats = s.igcStats && typeof s.igcStats === 'object' ? s.igcStats : null;
        const tAlt = finiteNum(stats?.takeoffAlt);
        const lAlt = finiteNum(stats?.landingAlt);
        if (tAlt !== null && lAlt !== null && tAlt - lAlt > 0) totalDescent += Math.round(tAlt - lAlt);

        const dist = finiteNum(s.distanceKm);
        if (dist !== null && dist > 0) totalDistanceKm += dist;

        const freeDist = finiteNum(stats?.freeDistanceKm);
        if (freeDist !== null && freeDist > maxFreeDistanceKm) maxFreeDistanceKm = freeDist;
    }

    const dates = sessions.map((s) => formatSessionDateParts(s).date).filter(Boolean);
    return {
        totalSessions: sessions.length,
        flightCount: flightsList.length,
        flightMinutes: sumDuration(flightsList),
        groundCount: groundList.length,
        groundMinutes: sumDuration(groundList),
        longestFlight,
        uniqueSitesCount: sites.size,
        maxAltitude,
        totalGain,
        totalDescent,
        totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
        maxFreeDistanceKm: Math.round(maxFreeDistanceKm * 10) / 10,
        schoolCount,
        firstDate: dates[0] || '',
        lastDate: dates[dates.length - 1] || '',
        wings: [...wings.values()],
    };
}

function renderSummaryGrid(summary) {
    const flightLabel = t(
        summary.flightCount === 1 ? 'logbook.export.summary.flightCountOne' : 'logbook.export.summary.flightCountMany',
        { count: summary.flightCount },
    );
    const groundLabel = t(
        summary.groundCount === 1 ? 'logbook.export.summary.groundCountOne' : 'logbook.export.summary.groundCountMany',
        { count: summary.groundCount },
    );
    const totalLabel = t(summary.totalSessions === 1 ? 'logbook.export.totalSession' : 'logbook.export.totalSessions', {
        count: summary.totalSessions,
    });

    const flightSub = [
        summary.longestFlight > 0
            ? t('logbook.export.summary.longestFlight', { duration: formatDuration(summary.longestFlight) })
            : '',
        summary.uniqueSitesCount > 0
            ? t(
                  summary.uniqueSitesCount === 1
                      ? 'logbook.export.summary.siteVisitedOne'
                      : 'logbook.export.summary.sitesVisited',
                  { count: summary.uniqueSitesCount },
              )
            : '',
    ]
        .filter(Boolean)
        .join(' · ');

    const groundSub = `${totalLabel} · ${t('logbook.export.summary.totalCumulated', {
        duration: formatDuration(summary.flightMinutes + summary.groundMinutes),
    })}`;

    const altLines = [
        summary.maxAltitude !== null ? t('logbook.export.summary.maxAlt', { value: summary.maxAltitude }) : '',
        summary.totalGain > 0 ? t('logbook.export.summary.totalGain', { value: summary.totalGain }) : '',
        summary.totalDescent > 0 ? t('logbook.export.summary.totalDescent', { value: summary.totalDescent }) : '',
    ].filter(Boolean);

    const distLines = [
        summary.totalDistanceKm > 0
            ? t('logbook.export.summary.totalDistance', { value: summary.totalDistanceKm })
            : '',
        summary.maxFreeDistanceKm > 0
            ? t('logbook.export.summary.maxFreeDistance', { value: summary.maxFreeDistanceKm })
            : '',
        summary.schoolCount > 0 ? t('logbook.export.summary.schoolCount', { count: summary.schoolCount }) : '',
    ].filter(Boolean);

    return `<section class="summary-grid">
        <div class="summary-card">
            <div class="summary-title">${escapeHTML(t('logbook.export.summary.flightsTitle'))}</div>
            <div class="summary-main">${escapeHTML(`${flightLabel} · ${formatDuration(summary.flightMinutes)}`)}</div>
            ${flightSub ? `<div class="summary-sub">${escapeHTML(flightSub)}</div>` : ''}
        </div>
        <div class="summary-card">
            <div class="summary-title">${escapeHTML(t('logbook.export.summary.groundTitle'))}</div>
            <div class="summary-main">${escapeHTML(`${groundLabel} · ${formatDuration(summary.groundMinutes)}`)}</div>
            <div class="summary-sub">${escapeHTML(groundSub)}</div>
        </div>
        <div class="summary-card">
            <div class="summary-title">${escapeHTML(t('logbook.export.summary.altitudesTitle'))}</div>
            ${
                altLines.length
                    ? `<div class="summary-main">${escapeHTML(altLines[0])}</div>${altLines
                          .slice(1)
                          .map((l) => `<div class="summary-sub">${escapeHTML(l)}</div>`)
                          .join('')}`
                    : '<div class="summary-main muted">—</div>'
            }
        </div>
        <div class="summary-card">
            <div class="summary-title">${escapeHTML(t('logbook.export.summary.distancesTitle'))}</div>
            ${
                distLines.length
                    ? `<div class="summary-main">${escapeHTML(distLines[0])}</div>${distLines
                          .slice(1)
                          .map((l) => `<div class="summary-sub">${escapeHTML(l)}</div>`)
                          .join('')}`
                    : '<div class="summary-main muted">—</div>'
            }
        </div>
    </section>`;
}

function renderWingsSection(wings) {
    if (!wings.length) return '';
    const cards = wings
        .map((w) => {
            const fl = t(
                w.flights === 1 ? 'logbook.export.summary.flightCountOne' : 'logbook.export.summary.flightCountMany',
                { count: w.flights },
            );
            const gr = t(
                w.ground === 1 ? 'logbook.export.summary.groundCountOne' : 'logbook.export.summary.groundCountMany',
                { count: w.ground },
            );
            const detail = t('logbook.export.summary.wingLine', {
                flights: `${fl} (${formatDuration(w.flightMinutes)})`,
                ground: `${gr} (${formatDuration(w.groundMinutes)})`,
                total: formatDuration(w.flightMinutes + w.groundMinutes),
            });
            return `<div class="mini-card">
                <div class="mini-title">${escapeHTML(w.name)}</div>
                <div class="mini-sub">${escapeHTML(detail)}</div>
            </div>`;
        })
        .join('');
    return `<section class="section-block">
        <h2>${escapeHTML(t('logbook.export.summary.wingsTitle'))}</h2>
        <div class="mini-grid">${cards}</div>
    </section>`;
}

function renderBrevetsSection(sessions, brevets) {
    const hasPrepared = sessions.some((s) => Boolean(textVal(s.ecole) && textVal(s.brevetPrepare)));
    const map = normalizeBrevetsMap(brevets || {});
    if (!hasPrepared && !hasAnyBrevetData(map)) return '';

    const cards = BREVET_CODES.map((code) => {
        const sum = brevetSummary(code, sessions, map);
        const pr = sum.entry.practical;
        const th = sum.entry.theory;
        const isQualification = !PROGRESSION_CHAIN.includes(code);

        let statusText;
        let statusClass = 'badge-muted';
        if (pr.validated) {
            statusClass = 'badge-ok';
            const dateText = pr.date ? formatSafeDateOnly(pr.date) : '';
            statusText = dateText
                ? t(
                      isQualification
                          ? 'logbook.stats.brevets.statusQualificationValidatedOn'
                          : 'logbook.stats.brevets.statusValidatedOn',
                      { date: dateText },
                  )
                : t(
                      isQualification
                          ? 'logbook.stats.brevets.statusQualificationValidated'
                          : 'logbook.stats.brevets.statusValidated',
                  );
        } else if (!isQualification && th.passed) {
            statusClass = 'badge-info';
            const dateText = th.date ? formatSafeDateOnly(th.date) : '';
            statusText = dateText
                ? t('logbook.stats.brevets.statusTheoryPassedOn', { date: dateText })
                : t('logbook.stats.brevets.statusTheoryPassed');
        } else if (sum.sessions > 0) {
            statusClass = 'badge-warn';
            statusText = t('logbook.stats.brevets.statusInProgress');
        } else {
            statusText = t('logbook.stats.brevets.statusNotStarted');
        }

        const practicalParts = [pr.date ? formatSafeDateOnly(pr.date) : '', pr.school, pr.instructor, pr.notes].filter(
            Boolean,
        );
        const practicalLine = practicalParts.length
            ? `<div class="mini-sub">${escapeHTML(
                  t('logbook.export.summary.brevetPractical', { details: practicalParts.join(' · ') }),
              )}</div>`
            : '';

        const scorePart =
            th.score !== null && th.total !== null
                ? t('logbook.stats.brevets.theoryScoreDetail', {
                      score: th.score,
                      total: th.total,
                      pct: th.percentage ?? 0,
                  })
                : th.percentage !== null
                  ? t('logbook.stats.brevets.theoryPctOnly', { pct: th.percentage })
                  : '';
        const theoryParts = !isQualification
            ? [th.date ? formatSafeDateOnly(th.date) : '', scorePart, th.school, th.examiner].filter(Boolean)
            : [];
        const theoryLine = theoryParts.length
            ? `<div class="mini-sub">${escapeHTML(
                  t('logbook.export.summary.brevetTheory', { details: theoryParts.join(' · ') }),
              )}</div>`
            : '';

        const trainingLine =
            sum.sessions > 0
                ? `<div class="mini-sub">${escapeHTML(
                      t('logbook.export.summary.brevetTraining', {
                          flights: `${t(
                              sum.flights === 1
                                  ? 'logbook.export.summary.flightCountOne'
                                  : 'logbook.export.summary.flightCountMany',
                              { count: sum.flights },
                          )} (${formatDuration(sum.flightMinutes)})`,
                          ground: `${t(
                              sum.groundSessions === 1
                                  ? 'logbook.export.summary.groundCountOne'
                                  : 'logbook.export.summary.groundCountMany',
                              { count: sum.groundSessions },
                          )} (${formatDuration(sum.groundMinutes)})`,
                      }),
                  )}</div>`
                : '';

        return `<div class="brevet-card">
            <div class="brevet-head">
                <span class="mini-title">${escapeHTML(`${code} — ${t(`logbook.stats.brevets.names.${code}`)}`)}</span>
                ${badge(statusText, statusClass)}
            </div>
            ${practicalLine}
            ${theoryLine}
            ${trainingLine}
        </div>`;
    }).join('');

    return `<section class="section-block">
        <h2>${escapeHTML(t('logbook.export.summary.brevetsTitle'))}</h2>
        <div class="brevets-grid">${cards}</div>
    </section>`;
}

function renderDateCell(f) {
    const { date, time } = formatSessionDateParts(f);
    const items = [date ? `<div class="cell-main">${escapeHTML(date)}</div>` : '', time ? subLine(time) : ''];
    const tags = [];
    if (hasGpsTrace(f)) tags.push(badge(t('logbook.export.tags.gpsTrace'), 'badge-info'));
    if (f.import?.source) tags.push(badge(t('logbook.export.tags.ffvlImport'), 'badge-muted'));
    if (tags.length) items.push(`<div class="badges">${tags.join('')}</div>`);
    return linesHtml(items);
}

function renderTypeCell(f, isGround) {
    const kind = t(isGround ? 'logbook.export.typeGround' : 'logbook.export.typeFlight');
    const items = [`<div class="cell-main">${escapeHTML(kind)}</div>`];
    if (!isGround && textVal(f.typeVol)) {
        items.push(subLine(textVal(f.typeVol)));
    }
    return linesHtml(items);
}

function renderSiteCell(f, isGround) {
    const place = textVal(f.site) || textVal(f.lieu);
    const items = [place ? `<div class="cell-main">${escapeHTML(place)}</div>` : ''];
    if (!isGround) {
        if (textVal(f.techDecollage))
            items.push(subLine(t('logbook.export.labels.takeoff', { value: textVal(f.techDecollage) })));
        if (textVal(f.priseTerrain))
            items.push(subLine(t('logbook.export.labels.approach', { value: textVal(f.priseTerrain) })));
        if (f.vache) items.push(`<div class="badges">${badge(t('logbook.export.tags.landedOut'), 'badge-warn')}</div>`);
    } else {
        const exercises = stringList(f.typeExercice);
        if (exercises.length) {
            items.push(subLine(t('logbook.export.labels.exercises', { value: exercises.join(', ') })));
        }
    }
    return linesHtml(items);
}

function renderGearCell(f) {
    const items = [];
    if (textVal(f.voile)) items.push(`<div class="cell-main">${escapeHTML(textVal(f.voile))}</div>`);
    if (textVal(f.sellette)) items.push(subLine(t('logbook.export.labels.harness', { value: textVal(f.sellette) })));
    if (f.rescueDeployed) {
        const rescueLabel = textVal(f.rescueId) || t('logbook.history.yes');
        items.push(
            `<div class="sub danger">${escapeHTML(t('logbook.export.labels.rescueDeployed', { value: rescueLabel }))}</div>`,
        );
    }
    const inst = f.instrument && typeof f.instrument === 'object' ? f.instrument : null;
    if (inst) {
        const instLabel = [textVal(inst.brand), textVal(inst.model)].filter(Boolean).join(' ');
        if (instLabel) items.push(subLine(t('logbook.export.labels.instrument', { value: instLabel })));
    }
    return linesHtml(items);
}

function renderDurationCell(f) {
    const items = [`<div class="cell-main">${escapeHTML(formatDuration(sessionMinutes(f)))}</div>`];
    if (f.varioInFlight) items.push(subLine(t('logbook.export.tags.varioInFlight')));
    if (f.varioOffInFlight) items.push(subLine(t('logbook.export.tags.varioOffInFlight')));
    return linesHtml(items);
}

function renderAltitudeCell(f) {
    const items = [];
    const altMax = finiteNum(f.altitudeMax);
    if (altMax !== null) items.push(subLine(t('logbook.export.labels.altMax', { value: Math.round(altMax) })));

    const gain = finiteNum(f.gain);
    if (gain !== null) items.push(subLine(t('logbook.export.labels.gain', { value: Math.round(gain) })));

    const a = f.igcStats && typeof f.igcStats === 'object' ? f.igcStats : null;
    if (a) {
        // `altitudeMax` already includes `altOffset`, whereas `igcStats` keeps raw vario altitudes.
        const offset = finiteNum(f.altOffset) || 0;
        const tAlt = finiteNum(a.takeoffAlt);
        const lAlt = finiteNum(a.landingAlt);
        if (tAlt !== null && lAlt !== null) {
            items.push(subLine(t('logbook.export.labels.descent', { value: Math.round(tAlt - lAlt) })));
            items.push(
                subLine(
                    t('logbook.export.labels.takeoffToLandingAlt', {
                        takeoff: Math.round(tAlt + offset),
                        landing: Math.round(lAlt + offset),
                    }),
                ),
            );
        }
        const cumClimb = finiteNum(a.cumulativeClimb);
        if (cumClimb !== null && cumClimb > 0) {
            items.push(subLine(t('logbook.export.labels.cumulativeClimb', { value: Math.round(cumClimb) })));
        }
        const w = a.winch && typeof a.winch === 'object' ? a.winch : null;
        if (
            w &&
            finiteNum(w.releaseAlt) !== null &&
            finiteNum(w.releaseHeight) !== null &&
            finiteNum(w.towSeconds) !== null
        ) {
            items.push(
                subLine(
                    t('logbook.export.labels.winchRelease', {
                        alt: Math.round(Number(w.releaseAlt) + offset),
                        height: Math.round(Number(w.releaseHeight)),
                        seconds: Math.round(Number(w.towSeconds)),
                    }),
                ),
            );
        }
    }
    return linesHtml(items);
}

function renderPerformanceCell(f) {
    const items = [];
    const a = f.igcStats && typeof f.igcStats === 'object' ? f.igcStats : null;
    const dist = finiteNum(f.distanceKm);
    if (dist !== null) items.push(subLine(t('logbook.export.labels.distance', { value: dist })));

    const freeDist = finiteNum(a?.freeDistanceKm);
    if (freeDist !== null) items.push(subLine(t('logbook.export.labels.freeDistance', { value: freeDist })));

    const maxFromTakeoff = finiteNum(a?.maxFromTakeoffKm);
    if (maxFromTakeoff !== null && maxFromTakeoff > 0) {
        items.push(subLine(t('logbook.export.labels.maxFromTakeoff', { value: maxFromTakeoff })));
    }

    const climb = finiteNum(f.maxClimbRate);
    const sink = finiteNum(a?.maxSinkRate);
    if (climb !== null) {
        items.push(
            subLine(
                sink !== null
                    ? t('logbook.export.labels.varioWithSink', { climb, sink })
                    : t('logbook.export.labels.vario', { climb }),
            ),
        );
    }

    const thermalCount = finiteNum(a?.thermalCount);
    if (thermalCount !== null && thermalCount > 0) {
        items.push(
            subLine(
                t('logbook.export.labels.thermals', {
                    count: Math.round(thermalCount),
                    minutes: Math.round(finiteNum(a?.thermalMinutes) ?? 0),
                    best: finiteNum(a?.bestThermalClimb) ?? 0,
                }),
            ),
        );
    }

    const maxSpd = finiteNum(f.maxSpeedKmh);
    const avgSpd = finiteNum(f.avgSpeedKmh);
    if (maxSpd !== null) {
        items.push(
            subLine(
                avgSpd !== null
                    ? t('logbook.export.labels.speed', { max: maxSpd, avg: avgSpd })
                    : t('logbook.export.labels.speedMaxOnly', { max: maxSpd }),
            ),
        );
    }

    const glide = finiteNum(a?.glideRatio);
    if (glide !== null) items.push(subLine(t('logbook.export.labels.glide', { value: glide })));

    const sensors = f.sensorStats && typeof f.sensorStats === 'object' ? f.sensorStats : null;
    const gMax = finiteNum(sensors?.gMax);
    const gMin = finiteNum(sensors?.gMin);
    if (gMax !== null) {
        items.push(
            subLine(
                gMin !== null
                    ? t('logbook.export.labels.gLoad', { max: gMax, min: gMin })
                    : t('logbook.export.labels.gLoadMaxOnly', { max: gMax }),
            ),
        );
    }

    return linesHtml(items);
}

function renderDetailsCell(f, isGround) {
    const items = [];
    const school = textVal(f.ecole);
    if (school) {
        const brevet = textVal(f.brevetPrepare);
        const schoolParts = [t('logbook.export.labels.school', { value: school })];
        if (brevet) schoolParts.push(t('logbook.export.labels.brevet', { value: brevet }));
        items.push(subLine(schoolParts.join(' · ')));

        const stageName = textVal(f.stageName);
        const stageSpec = textVal(f.stageSpecialty);
        if (stageName || stageSpec) {
            const label = stageName || t('logbook.export.labels.courseUnnamed');
            const full = stageSpec ? `${label} (${stageSpec})` : label;
            items.push(subLine(t('logbook.export.labels.course', { value: full })));
        }

        const instructors = instructorsOf(f);
        if (instructors.length) {
            items.push(subLine(t('logbook.export.labels.instructors', { value: instructors.join(', ') })));
        }
        const companions = companionsOf(f);
        if (companions.length) {
            items.push(subLine(t('logbook.export.labels.companions', { value: companions.join(', ') })));
        }
    }

    if (!isGround && f.typeVol === 'Treuil' && textVal(f.treuilleur)) {
        items.push(subLine(t('logbook.export.labels.winchOperator', { value: textVal(f.treuilleur) })));
    }
    if (!isGround) {
        const exercises = stringList(f.typeExercice);
        if (exercises.length) {
            items.push(subLine(t('logbook.export.labels.exercises', { value: exercises.join(', ') })));
        }
    }

    const pilots = stringList(f.pilotes);
    if (pilots.length) items.push(subLine(t('logbook.export.labels.pilots', { value: pilots.join(', ') })));

    if (f.meteo) {
        const startKey = f.meteoAtterroSame
            ? isGround
                ? 'logbook.export.labels.weatherStartEnd'
                : 'logbook.export.labels.weatherTakeoffLanding'
            : isGround
              ? 'logbook.export.labels.weatherStart'
              : 'logbook.export.labels.weatherTakeoff';
        items.push(formatWeatherPoint(f.meteo, startKey));
    }
    if (f.meteoAtterro && !f.meteoAtterroSame) {
        const endKey = isGround ? 'logbook.export.labels.weatherEnd' : 'logbook.export.labels.weatherLanding';
        items.push(formatWeatherPoint(f.meteoAtterro, endKey));
    }

    const comment = textVal(f.commentaire);
    if (comment) items.push(`<div class="comment">${escapeHTML(comment)}</div>`);

    return linesHtml(items);
}

const REPORT_STYLE = `
    @page { size: A4 landscape; margin: 10mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; margin: 0; color: #111827; font-size: 9.5px; line-height: 1.35; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .report-header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 2px solid #0284c7; padding-bottom: 6px; margin-bottom: 10px; }
    h1 { font-size: 18px; margin: 0; color: #0f172a; }
    h2 { font-size: 11px; margin: 0 0 5px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.03em; }
    .meta { color: #475569; font-size: 10px; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 10px; }
    .summary-card, .mini-card, .brevet-card { border: 1px solid #cbd5e1; border-radius: 5px; padding: 6px 8px; background: #f8fafc; break-inside: avoid; page-break-inside: avoid; }
    .summary-title { font-size: 8.5px; font-weight: bold; text-transform: uppercase; color: #475569; margin-bottom: 2px; }
    .summary-main { font-size: 11px; font-weight: bold; color: #0f172a; }
    .summary-sub, .mini-sub { font-size: 8.5px; color: #475569; margin-top: 2px; }
    .section-block { margin-bottom: 10px; break-inside: avoid; page-break-inside: avoid; }
    .mini-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 6px; }
    .brevets-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
    .brevet-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 4px; margin-bottom: 3px; }
    .mini-title { font-size: 9.5px; font-weight: bold; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; font-size: 9px; table-layout: fixed; }
    thead { display: table-header-group; }
    th, td { border: 1px solid #cbd5e1; padding: 4px 5px; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
    th { background: #e2e8f0; color: #0f172a; font-weight: bold; font-size: 8.5px; }
    tbody tr:nth-child(even) { background: #f8fafc; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    .col-date { width: 9%; }
    .col-type { width: 7%; }
    .col-site { width: 14%; }
    .col-gear { width: 12%; }
    .col-duration { width: 6%; }
    .col-altitude { width: 13%; }
    .col-perf { width: 14%; }
    .col-details { width: 25%; }
    .cell-main { font-weight: bold; color: #0f172a; }
    .sub { color: #334155; margin-top: 1px; }
    .danger { color: #b91c1c; font-weight: bold; }
    .comment { margin-top: 2px; font-style: italic; color: #1e293b; }
    .muted { color: #94a3b8; }
    .badges { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 2px; }
    .badge { display: inline-block; padding: 1px 4px; border-radius: 3px; font-size: 7.5px; font-weight: bold; background: #e2e8f0; color: #334155; }
    .badge-ok { background: #dcfce7; color: #166534; }
    .badge-info { background: #e0f2fe; color: #075985; }
    .badge-warn { background: #fef3c7; color: #92400e; }
    .badge-muted { background: #f1f5f9; color: #475569; }
    .totals { margin-top: 10px; padding: 6px 8px; border-top: 2px solid #0284c7; background: #f8fafc; font-size: 10px; font-weight: bold; color: #0f172a; }
`;

/**
 * Document HTML imprimable (A4 paysage) du carnet : bilan global, matériel, brevets,
 * sessions détaillées par ordre chronologique et totaux.
 * @param {ExportedSession[]} flights
 * @param {{generatedAt?: string|Date, brevets?: Record<string, any>|null}} [options]
 * @returns {string}
 */
export function buildLogbookReportHtml(flights, { generatedAt = new Date(), brevets = null } = {}) {
    const sessions = [...flights].sort((a, b) => {
        const diff = sessionSortMs(a) - sessionSortMs(b);
        return diff !== 0 ? diff : rawDateString(a).localeCompare(rawDateString(b));
    });
    const summary = computeSummary(sessions);

    const rows = sessions
        .map((f) => {
            const isGround = isGroundSession(f);
            return `
        <tr>
            <td>${renderDateCell(f)}</td>
            <td>${renderTypeCell(f, isGround)}</td>
            <td>${renderSiteCell(f, isGround)}</td>
            <td>${renderGearCell(f)}</td>
            <td>${renderDurationCell(f)}</td>
            <td>${renderAltitudeCell(f)}</td>
            <td>${renderPerformanceCell(f)}</td>
            <td>${renderDetailsCell(f, isGround)}</td>
        </tr>`;
        })
        .join('');

    const columnDefs = [
        ['date', 'col-date'],
        ['type', 'col-type'],
        ['site', 'col-site'],
        ['gear', 'col-gear'],
        ['duration', 'col-duration'],
        ['altitude', 'col-altitude'],
        ['performance', 'col-perf'],
        ['details', 'col-details'],
    ];
    const columns = columnDefs
        .map(([key, cls]) => `<th class="${cls}">${escapeHTML(t(`logbook.export.columns.${key}`))}</th>`)
        .join('');

    const periodText =
        summary.firstDate && summary.lastDate
            ? summary.firstDate === summary.lastDate
                ? t('logbook.export.periodSingle', { date: summary.firstDate })
                : t('logbook.export.periodRange', { from: summary.firstDate, to: summary.lastDate })
            : '';

    const countLabel = t(summary.totalSessions === 1 ? 'logbook.export.totalSession' : 'logbook.export.totalSessions', {
        count: summary.totalSessions,
    });
    const metaParts = [
        t('logbook.export.generated', { date: formatDateOnly(generatedAt) }),
        periodText,
        countLabel,
    ].filter(Boolean);

    const flightCountText = t(
        summary.flightCount === 1 ? 'logbook.export.summary.flightCountOne' : 'logbook.export.summary.flightCountMany',
        { count: summary.flightCount },
    );
    const groundCountText = t(
        summary.groundCount === 1 ? 'logbook.export.summary.groundCountOne' : 'logbook.export.summary.groundCountMany',
        { count: summary.groundCount },
    );
    const totals = [
        countLabel,
        `${flightCountText} (${formatDuration(summary.flightMinutes)})`,
        `${groundCountText} (${formatDuration(summary.groundMinutes)})`,
        summary.totalDistanceKm > 0
            ? t('logbook.export.summary.totalDistance', { value: summary.totalDistanceKm })
            : '',
        summary.totalGain > 0 ? t('logbook.export.summary.totalGain', { value: summary.totalGain }) : '',
    ].filter(Boolean);

    return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>${escapeHTML(t('logbook.export.title'))}</title>
<style>${REPORT_STYLE}</style>
</head>
<body>
<header class="report-header">
    <h1>${escapeHTML(t('logbook.export.title'))}</h1>
    <div class="meta">${metaParts.map(escapeHTML).join(' · ')}</div>
</header>
${renderSummaryGrid(summary)}
${renderWingsSection(summary.wings)}
${renderBrevetsSection(sessions, brevets)}
<table>
<thead><tr>${columns}</tr></thead>
<tbody>${rows}
</tbody>
</table>
<div class="totals">${totals.map(escapeHTML).join(' · ')}</div>
</body>
</html>
`;
}
