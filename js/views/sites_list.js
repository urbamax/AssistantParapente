/**
 * VIEW - Sites list and cards
 * Base class of SitesView (see sites.js): the list of sites and their cards (rendering, pre-
 * flight brief, forecast notices, details toggle), the favourites comparator and the jump to a
 * site card. Kept in its own file so sites.js stays smaller; behaviour is unchanged.
 */
import GlobalState from '../core/app_state.js';
import SitesService from '../services/sites_service.js';
import LogbookService from '../services/logbook_service.js';
import { getSpotairWidgetId } from '../data/spotair_widgets.js';
import { FR } from '../i18n/fr.js';
import { escapeHTML, renderSiteText, safeHttpUrl } from '../core/security.js';
import { t } from '../utils/i18n.js';
import {
    forecastValue,
    missingValuesText,
    verdictColor,
    verdictReminderHtml,
    modelLabel,
    modelAgreementHtml,
    forecastContextHtml,
    verdictLabel,
} from './sites_forecast.js';
import { tt, th, tl } from './sites_strings.js';
import { SitesMapBase } from './sites_map.js';

export class SitesListBase extends SitesMapBase {
    // À fournir par SitesView (met à jour les pastilles des filtres après un rendu de la liste).
    updateBadges() {
        throw new Error('SitesView must implement updateBadges()');
    }

    isFieldFilled(val) {
        if (val === null || val === undefined) return false;
        if (typeof val !== 'string') return !!val;
        const cleaned = val.trim().toLowerCase();
        if (cleaned === '' || cleaned === '-' || cleaned === '--') return false;

        const placeholders = [
            'non renseigné',
            'non renseigne',
            'ras',
            'r.a.s.',
            'r.a.s',
            'rien',
            'néant',
            'neant',
            'n/a',
            'na',
            'aucun',
            'aucun danger',
            'aucun danger particulier',
            'aucun danger signalé',
            'aucun danger signale',
        ];
        return !placeholders.includes(cleaned);
    }

    toggleSitesComparator() {
        this.state.showComparator = !this.state.showComparator;
        const btn = document.getElementById('btn-compare-favorites');
        if (btn) {
            if (this.state.showComparator) {
                btn.classList.add('active');
                btn.innerHTML = `<i class="ri-table-line" style="color: var(--accent-orange);"></i> ${tt('comparator.button')}`;
                btn.style.background = 'rgba(59, 130, 246, 0.15)';
                btn.style.borderColor = 'rgba(59, 130, 246, 0.3)';
            } else {
                btn.classList.remove('active');
                btn.innerHTML = `<i class="ri-table-line"></i> ${tt('comparator.button')}`;
                btn.style.background = 'transparent';
                btn.style.borderColor = 'var(--border-color)';
            }
        }
        this.renderList();
    }

    // Tableau côte-à-côte des sites favoris pour le créneau actuellement affiché (même offset
    // que la liste normale). Ne recalcule rien : réutilise flyableHours/maxConsecutiveHours
    // (déjà calculés par SitesService.getFilteredAndSortedSites pour les badges de la liste)
    // et isForecastFlyable pour le statut météo du créneau en cours.
    renderComparator(activeSites) {
        const listDiv = document.getElementById('sites-list-container');
        if (!listDiv) return;

        const favoriteIds =
            (SitesService.state.userPreferences && SitesService.state.userPreferences.favoriteSites) || [];
        const favoriteSites = activeSites.filter((s) => favoriteIds.includes(s.id));

        listDiv.style.display = 'block';

        if (favoriteSites.length === 0) {
            listDiv.innerHTML = `<div class="card" style="text-align: center; padding: 20px;">${tt('comparator.empty')}</div>`;
            return;
        }

        // Contexte des prévisions (spec 002) : une seule ligne si tous les favoris viennent de la
        // même récupération, sinon une par ligne du tableau.
        const provenanceKeys = new Set(
            favoriteSites.map((site) => {
                const p = SitesService.getForecastProvenance(site.id);
                return p ? `${p.modelKey}|${p.fetchedAt}` : 'none';
            }),
        );
        const sharedContext = provenanceKeys.size === 1;
        const tableContextHtml = sharedContext && favoriteSites.length ? forecastContextHtml(favoriteSites[0].id) : '';

        const rows = favoriteSites
            .map((site) => {
                const forecasts = SitesService.state.weatherForecasts[site.id] || [];
                const weather = forecasts[SitesService.state.forecastOffset];
                const status = weather ? SitesService.isForecastFlyable(site, weather) : null;
                const statusHtml = status
                    ? `<span class="${status.class}" style="display: inline-flex; align-items: center; gap: 4px; font-weight: 600;"><i class="${status.icon}"></i> ${escapeHTML(verdictLabel(status))}</span>`
                    : `<span style="color: var(--text-muted);">${tt('comparator.loading')}</span>`;

                // Meilleur créneau à venir = le plus long slot volable de flyableSlots (déjà groupé
                // par jour par getFilteredAndSortedSites) sur toute la fenêtre de prévision choisie
                // (jusqu'à 7 jours) — c'est le digest "meilleure fenêtre à venir".
                const slots = site.flyableSlots || [];
                const bestSlot = slots.reduce((best, s) => {
                    const duration = s.end - s.start;
                    return !best || duration > best.end - best.start ? s : best;
                }, null);
                const bestSlotHtml = bestSlot
                    ? tt('comparator.slot', { day: bestSlot.dayLabel, start: bestSlot.start, end: bestSlot.end + 1 })
                    : `<span style="color: var(--text-muted);">${tt('comparator.none')}</span>`;

                // Accord du second modèle pour l'heure affichée (spec 002, US3).
                const confidenceHtml = modelAgreementHtml(site) || '<span style="color: var(--text-muted);">—</span>';

                return `
                <tr>
                    <td style="padding: 10px; font-weight: 700;">${escapeHTML(site.nom || site.name || '')}</td>
                    <td style="padding: 10px;">${statusHtml}${sharedContext ? '' : forecastContextHtml(site.id)}</td>
                    <td style="padding: 10px; text-align: center;">${tt('comparator.hours', { hours: site.flyableHours || 0 })}</td>
                    <td style="padding: 10px; text-align: center;">${bestSlotHtml}</td>
                    <td style="padding: 10px;">${confidenceHtml}</td>
                </tr>
            `;
            })
            .join('');

        listDiv.innerHTML = `
            <div class="card" style="padding: 16px; overflow-x: auto;">
                ${tableContextHtml}
                ${verdictReminderHtml(null)}
                <table style="width: 100%; border-collapse: collapse; min-width: 480px;">
                    <thead>
                        <tr style="border-bottom: 1px solid var(--border-color); text-align: left;">
                            <th style="padding: 10px;">${tt('comparator.site')}</th>
                            <th style="padding: 10px;">${tt('comparator.weather')}</th>
                            <th style="padding: 10px; text-align: center;" title="${tt('comparator.flyableTitle')}">${tt('comparator.flyable')}</th>
                            <th style="padding: 10px;" title="${tt('comparator.bestSlotTitle')}">${tt('comparator.bestSlot')}</th>
                            <th style="padding: 10px;" title="${tt('comparator.confidenceTitle')}">${tt('comparator.confidence')}</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
                <p style="margin: 12px 0 0; font-size: 0.8rem; color: var(--text-muted);">${tt('comparator.tip')}</p>
            </div>
        `;
    }

    /**
     * Message « Recherche centrée sur Boulogne-sur-Mer » tant qu'aucune position (GPS, adresse)
     * n'est connue (spec 002, FR-017). Appelé à chaque rendu de la liste.
     */
    renderLocationContext() {
        const notice = document.getElementById('default-location-notice');
        if (!notice) return;
        const isDefault = !!SitesService.getEffectiveLocation().isDefault;
        notice.hidden = !isDefault;
        notice.textContent = isDefault ? t('forecast.defaultLocationNotice') : '';
    }

    /**
     * Message affiché tant que la liste montre des prévisions restaurées depuis l'appareil
     * (spec 007, FR-004) : hors ligne ou service indisponible, et date de récupération.
     */
    buildOfflineForecastNotice() {
        if (SitesService.state.forecastSource !== 'saved') return '';
        const times = Object.values(SitesService.state.forecastProvenance || {}).map((p) => p.fetchedAt);
        if (times.length === 0) return '';
        const oldest = new Date(Math.min(...times));
        const now = new Date();
        const sameDay = oldest.toDateString() === now.toDateString();
        const time = `${String(oldest.getHours()).padStart(2, '0')} h ${String(oldest.getMinutes()).padStart(2, '0')}`;
        const when = sameDay
            ? tl('notice.today', { time })
            : tl('notice.otherDay', {
                  date: oldest.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
                  time,
              });
        const key = navigator.onLine === false ? 'forecast.offlineSaved' : 'forecast.serviceDownSaved';
        return `<p id="offline-forecast-notice" class="location-notice offline-forecast-notice" role="status"><i class="ri-wifi-off-line" aria-hidden="true"></i> ${escapeHTML(t(key, { when }))}</p>`;
    }

    /** Sites trouvés par la recherche mais hors du rayon : signalés, jamais interrogés (FR-019). */
    buildSearchOutsideNotice() {
        const count = SitesService.countSearchMatchesOutsideRadius();
        if (!count) return '';
        const km = SitesService.state.radiusLimit;
        const text =
            count === 1
                ? t('forecast.searchOutsideRadiusOne', { km })
                : t('forecast.searchOutsideRadius', { count, km });
        return `<p class="location-notice search-outside-notice" role="status">${escapeHTML(text)}</p>`;
    }

    renderList() {
        const listDiv = document.getElementById('sites-list-container');
        if (!listDiv) return;

        const activeSites = SitesService.getFilteredAndSortedSites(SitesService.getSites());
        this.renderLocationContext();

        // Le comparateur ne montre que de la météo calculée : sans le rôle « beta », retour à la liste.
        if (this.state.showComparator && !SitesService.canUseForecast()) this.state.showComparator = false;
        if (this.state.showComparator) {
            this.renderComparator(activeSites);
            return;
        }

        listDiv.innerHTML = '';
        if (activeSites.length === 0) {
            listDiv.style.display = 'block';
            listDiv.innerHTML =
                this.buildOfflineForecastNotice() +
                this.buildSearchOutsideNotice() +
                `<div class="card" style="text-align: center; padding: 20px;">${tt('list.empty')}</div>`;
        } else {
            listDiv.style.display = 'flex';
            let html = '';
            // Limit render to 50 for performance
            for (let i = 0; i < Math.min(activeSites.length, 50); i++) {
                const site = activeSites[i];
                let orientations = [];
                if (Array.isArray(site.orientations_vent)) orientations = site.orientations_vent;
                else if (typeof site.orientations_vent === 'string')
                    orientations = site.orientations_vent.split(',').map((v) => v.trim());
                else if (site.orientation) orientations = site.orientation.split(',').map((v) => v.trim());

                const windTags = orientations
                    .map(
                        (w) =>
                            `<span role="button" tabindex="0" class="wind-tag" data-action="SitesfilterByTag" data-args="${escapeHTML(w)}" title="${tt('filters.windTitle', { wind: w })}">${w}</span>`,
                    )
                    .join('');

                const st = site.site_sous_type || site.type || tl('list.unknownType');
                const siteTypes = Array.isArray(st) ? st : [st];
                const typeLabel = siteTypes
                    .map((t) => {
                        return `<span role="button" tabindex="0" class="site-coords-badge site-type-badge" data-action="SitesfilterByType" data-args="${escapeHTML(t)}" style="cursor: pointer;" title="${tt('filters.typeTitle', { type: t })}">${t}</span>`;
                    })
                    .join(' ');

                let distanceHtml = '';
                if (site.distance !== undefined) {
                    distanceHtml = `
                        <span class="site-coords-badge site-dist-badge">
                            <i class="ri-navigation-fill"></i> ${tt('list.distance', { km: site.distance.toFixed(1) })}
                        </span>
                    `;
                }

                // Sans le rôle « beta », la fiche ne montre rien de calculé (voir access_service.js).
                const withForecast = SitesService.canUseForecast();
                const flyableHoursHtml = !withForecast
                    ? ''
                    : `
                    <span class="site-coords-badge" style="background: ${site.flyableHours > 0 ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.03)'}; border-color: ${site.flyableHours > 0 ? 'rgba(34,197,94,0.3)' : 'var(--border-color)'}; color: ${site.flyableHours > 0 ? 'var(--accent-green)' : 'var(--text-muted)'}; font-weight: 700;">
                        <i class="ri-time-line"></i> ${tt('list.flyableHours', { hours: site.flyableHours || 0 })} ${(site.maxConsecutiveHours || 0) > 0 ? tt('list.consecutive', { hours: site.maxConsecutiveHours }) : ''}
                    </span>
                `;

                let weatherHtml;
                let weather = null;
                // Distingue "jamais interrogé" (weatherForecasts[site.id] absent) de "requête
                // terminée mais Open-Meteo n'a renvoyé aucune heure exploitable pour ce site"
                // (entrée présente mais vide, ex: coordonnées hors couverture) : sans ça, ce
                // deuxième cas réaffiche indéfiniment "Chargement météo..." puisque plus rien
                // ne vient jamais la remplacer.
                const hasWeatherEntry = Object.prototype.hasOwnProperty.call(
                    SitesService.state.weatherForecasts,
                    site.id,
                );
                const forecasts = SitesService.state.weatherForecasts[site.id] || [];
                if (forecasts && forecasts[SitesService.state.forecastOffset]) {
                    weather = forecasts[SitesService.state.forecastOffset];
                }
                if (!withForecast) {
                    weatherHtml = '';
                } else if (weather) {
                    const status = SitesService.isForecastFlyable(site, weather);
                    weatherHtml = `
                        <div class="site-weather-row ${status.class}" style="display: flex; flex-direction: column; gap: 6px; margin-top: 12px; padding: 8px 12px; border-radius: 8px; font-size: 0.9rem; font-weight: 500;">
                            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%;">
                                <span style="display: flex; align-items: center; gap: 6px;">
                                    <i class="ri-windy-line"></i>
                                    <span>${th('list.windRow', {
                                        card: `<b>${escapeHTML(String(forecastValue(weather.windCard)))}</b>`,
                                        deg: escapeHTML(String(forecastValue(weather.windDirDeg))),
                                        speed: `<b>${tt('list.speed', { value: forecastValue(weather.windSpeed) })}</b>`,
                                        gust: `<b>${escapeHTML(String(forecastValue(weather.windGust)))}</b>`,
                                    })}</span>
                                </span>
                                <span style="display: flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; text-transform: uppercase;">
                                    <i class="${status.icon}"></i> ${escapeHTML(status.reason)}
                                </span>
                            </div>
                            ${missingValuesText(status) ? `<div class="weather-missing-values" style="font-size: 0.8rem;">${escapeHTML(missingValuesText(status))}</div>` : ''}
                        </div>
                        ${status.status === 'incomplete' ? '' : modelAgreementHtml(site)}
                        ${forecastContextHtml(site.id)}
                        ${verdictReminderHtml(status)}
                    `;
                } else if (SitesService.state.forecastSource === 'saved') {
                    // Hors ligne : ce site n'a pas de prévision enregistrée sur l'appareil (spec 007).
                    weatherHtml = `
                        <div class="weather-loading">
                            <i class="ri-wifi-off-line"></i>
                            <span>${escapeHTML(t('forecast.unavailableOffline'))}</span>
                        </div>
                    `;
                } else if (hasWeatherEntry) {
                    weatherHtml = `
                        <div class="weather-loading">
                            <i class="ri-error-warning-line"></i>
                            <span>${tt('weather.unavailableForSite')}</span>
                        </div>
                    `;
                } else {
                    weatherHtml = `
                        <div class="weather-loading">
                            <i class="ri-loader-4-line" style="animation: spin 1s linear infinite;"></i>
                            <span>${escapeHTML(t('forecast.loading', { model: modelLabel(SitesService.state.weatherModel) }))}</span>
                        </div>
                    `;
                }

                let slotsTextHtml = '';
                if (!withForecast) {
                    slotsTextHtml = '';
                } else if (site.flyableSlots && site.flyableSlots.length > 0) {
                    const groupedByDay = {};
                    site.flyableSlots.forEach((slot) => {
                        if (!groupedByDay[slot.dayLabel]) groupedByDay[slot.dayLabel] = [];
                        groupedByDay[slot.dayLabel].push(tl('list.slotRange', { start: slot.start, end: slot.end }));
                    });
                    const slotsDetails = Object.keys(groupedByDay)
                        .map((day) => {
                            return `<span><b>${day}</b> (${groupedByDay[day].join(', ')})</span>`;
                        })
                        .join(' | ');
                    slotsTextHtml = `
                        <div class="creneaux-list good">
                            <i class="ri-calendar-todo-line"></i> ${th('list.nextSlots', { slots: slotsDetails })}
                        </div>
                    `;
                } else if (forecasts.length > 0 && site.completeHours === 0) {
                    // Aucune heure complète : ne pas laisser croire que les conditions sont
                    // mauvaises, il n'y a simplement pas de prévision fiable (spec 001, FR-009).
                    slotsTextHtml = `
                        <div class="creneaux-list incomplete">
                            <i class="ri-question-line"></i> ${escapeHTML(t('weather.noReliableForecast'))}
                        </div>
                    `;
                } else if (!site.flyableHours) {
                    const maxRange = SitesService.state.forecastMaxRange || 120;
                    slotsTextHtml = `
                        <div class="creneaux-list bad">
                            <i class="ri-error-warning-line"></i> ${tt('list.noSlot', { hours: maxRange })}
                        </div>
                    `;
                }

                let timelineBarsHtml = '';
                const maxRange = SitesService.state.forecastMaxRange || 120;
                const forecastsToUse = forecasts.slice(0, maxRange);
                for (let j = 0; withForecast && j < maxRange; j++) {
                    const w = forecastsToUse[j];
                    let barColor = 'rgba(255,255,255,0.05)';
                    let statusLabel = tl('list.unknownStatus');
                    let timeStr = `+${j}h`;
                    let dotClass = 'timeline-hour-dot';

                    if (w) {
                        const status = SitesService.isForecastFlyable(site, w);
                        const date = new Date(w.time);
                        const h = String(date.getHours()).padStart(2, '0');
                        const m = String(date.getMinutes()).padStart(2, '0');
                        const days = FR.sites.list.weekdays;
                        timeStr = `${days[date.getDay()]} ${h}:${m}`;
                        barColor = verdictColor(status, { bar: true });
                        if (status.status === 'incomplete') {
                            dotClass += ' timeline-hour-dot--incomplete';
                            statusLabel = verdictLabel(status);
                        } else if (status.flyable) {
                            statusLabel = status.warning
                                ? tl('list.warningTooltip', {
                                      card: forecastValue(w.windCard),
                                      speed: forecastValue(w.windSpeed),
                                      reason: status.reason,
                                  })
                                : tl('list.flyableTooltip', {
                                      card: forecastValue(w.windCard),
                                      speed: forecastValue(w.windSpeed),
                                      gust: forecastValue(w.windGust),
                                  });
                        } else {
                            statusLabel = status.reason;
                        }
                    }
                    // Une heure incomplète garde le fond hachuré de sa classe CSS (pas de couleur).
                    const background = dotClass.includes('--incomplete') ? '' : ` background: ${barColor};`;
                    let dotStyle = `flex: 1; height: 100%;${background} transition: all 0.2s; cursor: pointer;`;
                    if (j === SitesService.state.forecastOffset) {
                        dotStyle += ` outline: 1.5px solid var(--text-main); transform: scaleY(1.3); z-index: 5; box-shadow: 0 0 6px var(--accent-orange);`;
                    }
                    timelineBarsHtml += `<div role="button" tabindex="0" class="${dotClass}" style="${dotStyle}" title="${escapeHTML(`${timeStr} : ${statusLabel}`)}" data-action="SitessetForecastOffset" data-args="${j}"></div>`;
                }

                const isFav =
                    SitesService.state.userPreferences &&
                    SitesService.state.userPreferences.favoriteSites &&
                    SitesService.state.userPreferences.favoriteSites.includes(site.id);
                const userToggled =
                    SitesService.state.userPreferences &&
                    SitesService.state.userPreferences.minimizedSites &&
                    SitesService.state.userPreferences.minimizedSites.includes(site.id);

                const isMinimized = isFav ? userToggled : !userToggled;

                html +=
                    `<div class="site-card ${isMinimized ? 'minimized' : ''}">` +
                    this.buildSiteCardHtml(
                        site,
                        windTags,
                        typeLabel,
                        distanceHtml,
                        flyableHoursHtml,
                        weatherHtml,
                        timelineBarsHtml,
                        slotsTextHtml,
                        isMinimized,
                        withForecast,
                    ) +
                    `</div>`;
            }
            listDiv.innerHTML = this.buildOfflineForecastNotice() + this.buildSearchOutsideNotice() + html;
        }

        this.updateBadges();
    }

    // Brief pré-vol : rappelle le niveau de brevet actuellement sélectionné (à confronter avec
    // la praticabilité/les dangers du site affichés juste en dessous dans le même panneau — la
    // base FFVL ne fournit pas de niveau requis structuré par site, donc pas de verdict
    // compatible/incompatible fabriqué ici) et l'état du matériel du pilote, en réutilisant
    // LogbookService.computeEquipmentWear() (déjà utilisé pour le badge de révision du Carnet).
    buildPreFlightBriefHtml() {
        const level = GlobalState.get('level') || 'ALL';
        const levelLabel = FR.sites.brief.levels[level] || level;

        let equipmentHtml = `<span style="color: var(--text-muted);">${tt('brief.noEquipment')}</span>`;
        try {
            const wear = LogbookService.computeEquipmentWear();
            const alertCount = LogbookService.countEquipmentAlerts(wear);
            if (alertCount > 0) {
                equipmentHtml = `<span style="color: #f59e0b; font-weight: 600;">${tt(alertCount > 1 ? 'brief.toReviewMany' : 'brief.toReviewOne', { count: alertCount })}</span>`;
            } else if (Object.keys(wear).length > 0) {
                equipmentHtml = `<span style="color: var(--accent-green); font-weight: 600;">${tt('brief.upToDate')}</span>`;
            }
        } catch {
            // Carnet non disponible : on garde le message par défaut plutôt que de faire planter la carte.
        }

        return `
        <div class="rich-detail-item default" style="background: rgba(59, 130, 246, 0.06); border-radius: 8px;">
            <i class="ri-flight-takeoff-line rich-detail-icon blue"></i>
            <div>
                <strong class="rich-detail-label muted">${tt('brief.title')}</strong>
                <span class="rich-detail-value">${th('brief.level', { level: `<b>${escapeHTML(levelLabel)}</b>` })}</span>
                <div style="margin-top: 4px; font-size: 0.9rem;">${th('brief.equipment', { equipment: equipmentHtml })}</div>
            </div>
        </div>
    `;
    }

    buildSiteCardHtml(
        site,
        windTags,
        typeLabel,
        distanceHtml,
        flyableHoursHtml,
        weatherHtml,
        timelineBarsHtml,
        slotsTextHtml,
        isMinimized,
        withForecast = true,
    ) {
        const isFav =
            SitesService.state.userPreferences && SitesService.state.userPreferences.favoriteSites.includes(site.id);
        const starIcon = isFav ? 'ri-star-fill' : 'ri-star-line';
        const starColor = isFav ? '#fbbf24' : 'var(--text-muted)';
        const minIcon = isMinimized ? 'ri-add-line' : 'ri-subtract-line';

        // Pas de widget iframe tiers dans la carte (rendu blanc non maîtrisable,
        // impossible à intégrer proprement dans le thème sombre) : un simple badge
        // natif, cohérent avec les autres badges de la carte, qui ouvre le détail
        // complet (graphique, rose des vents) dans la modale au clic.
        const spotairId = !isMinimized ? getSpotairWidgetId(site) : null;
        const spotairBadgeHtml = spotairId
            ? `
        <button class="site-coords-badge site-spotair-badge" data-spotair-id="${spotairId}" data-site-id="${site.id}"
            data-action="SitesopenSpotairModal"
            title="${tt('card.spotairTitle')}">
            <i class="ri-windy-line"></i> ${tt('card.spotairBadge')}
        </button>
    `
            : '';

        return `
            <div class="site-card-header site-card-header-row">
                <div class="site-info site-info-row">
                    <div class="site-title-row">
                        <button class="favorite-toggle-btn" data-action="toggleFavorite" data-args="'${site.id}'" title="${tt('card.favorite')}" style="background: none; border: none; font-size: 1.4rem; color: ${starColor}; cursor: pointer; padding: 0;">
                            <i class="${starIcon}"></i>
                        </button>
                        <button class="minimize-toggle-btn" data-action="toggleMinimize" data-args="'${site.id}'" title="${tt('card.minimize')}" style="background: none; border: none; font-size: 1.4rem; color: var(--text-muted); cursor: pointer; padding: 0;">
                            <i class="${minIcon}"></i>
                        </button>
                        <h3 class="site-card-title">${escapeHTML(site.nom)}</h3>
                    </div>
                    <div class="site-badges-row">
                        ${
                            site.alt
                                ? `
                        <span class="site-coords-badge site-altitude-badge" title="${tt('card.altitudeTitle')}">
                            <i class="ri-landscape-fill"></i> ${tt('card.altitude', { alt: site.alt })}
                        </span>
                        `
                                : ''
                        }
                        <div class="site-wind-tags site-wind-tags-row">${windTags}</div>
                        ${typeLabel}
                        ${spotairBadgeHtml}
                        <button class="site-coords-badge copy-coords-btn" data-action="copyCoords" data-args="'${parseFloat(site.latitude || site.lat)}', '${parseFloat(site.longitude || site.lon)}'" title="${tt('card.copyTitle')}">
                            <i class="ri-map-pin-2-line"></i> <span class="coords-text">${parseFloat(site.latitude || site.lat)}, ${parseFloat(site.longitude || site.lon)}</span>
                        </button>
                        ${distanceHtml}
                        ${flyableHoursHtml}
                    </div>
                </div>
                <div class="site-actions-container">
                    ${
                        safeHttpUrl(site.url)
                            ? `
                    <a class="action-btn-secondary ffvl-btn" href="${escapeHTML(safeHttpUrl(site.url))}" target="_blank" rel="noopener noreferrer" title="${tt('card.ffvlTitle')}">
                        <img src="img/logos/ffvl.png" alt="${tt('card.ffvl')}"> ${tt('card.ffvl')}
                    </a>
                    `
                            : ''
                    }
                    <button class="action-btn-spot spot-it-btn" data-action="spotSite" data-args="'${parseFloat(site.latitude || site.lat)}', '${parseFloat(site.longitude || site.lon)}', '${escapeHTML(site.nom)}', '${site.id || ''}'" title="${tt('card.spotItTitle')}">
                        <i class="ri-focus-3-line"></i> ${tt('card.spotIt')}
                    </button>
                    <button class="action-btn-primary gps-btn" data-action="openGpsMenu" data-args="'${parseFloat(site.latitude || site.lat)}', '${parseFloat(site.longitude || site.lon)}'">
                        <i class="ri-navigation-line"></i> ${tt('card.goThere')}
                    </button>
                </div>
            </div>
            ${
                isMinimized
                    ? ''
                    : `
            ${
                withForecast
                    ? `${weatherHtml}
            <div style="margin-top: 14px;">
                <div class="timeline-labels">
                    <span>${tt('list.now')}</span><span>${tt('list.forecasts', { hours: SitesService.state.forecastMaxRange || 120 })}</span><span>${tt('list.inDays', { days: (SitesService.state.forecastMaxRange || 120) / 24 })}</span>
                </div>
                <div class="ranking-timeline">
                    ${timelineBarsHtml}
                </div>
                <div class="timeline-legend">
                    <span class="legend-item"><span class="legend-color" style="background:#22c55e;"></span> ${tt('list.legend.flyable')}</span>
                    <span class="legend-item"><span class="legend-color" style="background:#eab308;"></span> ${tt('list.legend.unknownOrientation')}</span>
                    <span class="legend-item"><span class="legend-color" style="background:#ef4444;"></span> ${tt('list.legend.wind')}</span>
                    <span class="legend-item"><span class="legend-color" style="background:#f97316;"></span> ${tt('list.legend.wrongOrientation')}</span>
                    <span class="legend-item"><span class="legend-color" style="background:#3b82f6;"></span> ${tt('list.legend.rain')}</span>
                    <span class="legend-item"><span class="legend-color" style="background:rgba(100,100,120,0.5);"></span> ${tt('list.legend.night')}</span>
                    <span class="legend-item"><span class="legend-color legend-color--incomplete"></span> ${escapeHTML(t('weather.legendIncomplete'))}</span>
                </div>
            </div>
            ${slotsTextHtml}`
                    : ''
            }
            ${(() => {
                const showConv = this.isFieldFilled(site.conventionnement);
                const showPrat = this.isFieldFilled(site.praticabilite);
                const showGest = this.isFieldFilled(site.structure_gestionnaire);
                const showAero = this.isFieldFilled(site.aerologie_ideale);
                const showSec = this.isFieldFilled(site.secours_acces);
                const showDang = this.isFieldFilled(site.dangers);
                const showTopo = this.isFieldFilled(site.acces_topo);

                const showObs = this.isFieldFilled(site.observations);
                const showRes = this.isFieldFilled(site.restrictions);
                const showReg = this.isFieldFilled(site.reglementation);

                const isOpen = this.state.expandedSites[site.id] ? 'open' : '';
                const toggleText = tt(this.state.expandedSites[site.id] ? 'card.lessInfo' : 'card.moreInfo');

                return `
                    <details class="site-details-toggle" ${isOpen} data-site-id="${site.id}">
                        <summary>
                            <span class="toggle-text">${toggleText}</span>
                            <i class="ri-arrow-down-s-line"></i>
                        </summary>
                        <div class="site-rich-details">

                            ${this.buildPreFlightBriefHtml()}

                            ${
                                showConv
                                    ? `
                            <div class="rich-detail-item default">
                                <i class="ri-shield-check-line rich-detail-icon blue"></i>
                                <div>
                                    <strong class="rich-detail-label muted">${tt('details.conventionnement')}</strong>
                                    <span class="rich-detail-value">${renderSiteText(site.conventionnement)}</span>
                                </div>
                            </div>
                            `
                                    : ''
                            }
                            ${
                                showPrat
                                    ? `
                            <div class="rich-detail-item default">
                                <i class="ri-checkbox-circle-line rich-detail-icon ${site.affiche ? 'green' : 'red'}"></i>
                                <div>
                                    <strong class="rich-detail-label muted">${tt('details.praticabilite')}</strong>
                                    <span class="rich-detail-value">${renderSiteText(site.praticabilite)}</span>
                                </div>
                            </div>
                            `
                                    : ''
                            }
                            ${
                                showGest
                                    ? `
                            <div class="rich-detail-item default">
                                <i class="ri-group-line rich-detail-icon secondary"></i>
                                <div>
                                    <strong class="rich-detail-label muted">${tt('details.gestionnaire')}</strong>
                                    <span class="rich-detail-value">${renderSiteText(site.structure_gestionnaire)}</span>
                                </div>
                            </div>
                            `
                                    : ''
                            }
                            ${
                                showAero
                                    ? `
                            <div class="rich-detail-item default">
                                <i class="ri-compass-3-line rich-detail-icon blue"></i>
                                <div>
                                    <strong class="rich-detail-label muted">${tt('details.aerologie')}</strong>
                                    <span class="rich-detail-value">${renderSiteText(site.aerologie_ideale)}</span>
                                </div>
                            </div>
                            `
                                    : ''
                            }
                            ${
                                showSec
                                    ? `
                            <div class="rich-detail-item default">
                                <i class="ri-first-aid-kit-line rich-detail-icon green"></i>
                                <div>
                                    <strong class="rich-detail-label muted">${tt('details.secours')}</strong>
                                    <span class="rich-detail-value">${renderSiteText(site.secours_acces)}</span>
                                </div>
                            </div>
                            `
                                    : ''
                            }
                            ${
                                showDang
                                    ? `
                            <div class="rich-detail-item danger">
                                <i class="ri-error-warning-line rich-detail-icon red"></i>
                                <div>
                                    <strong class="rich-detail-label red">${tt('details.dangers')}</strong>
                                    <span class="rich-detail-value">${renderSiteText(site.dangers)}</span>
                                </div>
                            </div>
                            `
                                    : ''
                            }
                            ${
                                showTopo
                                    ? `
                            <div class="rich-detail-item default full-width">
                                <i class="ri-walk-line rich-detail-icon secondary"></i>
                                <div>
                                    <strong class="rich-detail-label muted">${tt('details.topo')}</strong>
                                    <span class="rich-detail-value">${renderSiteText(site.acces_topo)}</span>
                                </div>
                            </div>
                            `
                                    : ''
                            }
                            ${
                                showObs
                                    ? `
                            <div class="rich-detail-item obs">
                                <i class="ri-information-line rich-detail-icon blue"></i>
                                <div>
                                    <strong class="rich-detail-label muted">${tt('details.observations')}</strong>
                                    <span class="rich-detail-value">${renderSiteText(site.observations)}</span>
                                </div>
                            </div>
                            `
                                    : ''
                            }
                            ${
                                showRes
                                    ? `
                            <div class="rich-detail-item danger">
                                <i class="ri-forbid-line rich-detail-icon red"></i>
                                <div>
                                    <strong class="rich-detail-label red">${tt('details.restrictions')}</strong>
                                    <span class="rich-detail-value">${renderSiteText(site.restrictions)}</span>
                                </div>
                            </div>
                            `
                                    : ''
                            }
                            ${
                                showReg
                                    ? `
                            <div class="rich-detail-item obs">
                                <i class="ri-article-line rich-detail-icon blue"></i>
                                <div>
                                    <strong class="rich-detail-label muted">${tt('details.reglementation')}</strong>
                                    <span class="rich-detail-value">${renderSiteText(site.reglementation)}</span>
                                </div>
                            </div>
                            `
                                    : ''
                            }
                        </div>
                    </details>
                `;
            })()}
            `
            }
        `;
    }

    copyCoords(lat, lng, btnRef) {
        const coords = lat + ', ' + lng;
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard
                .writeText(coords)
                .then(() => {
                    const originalHtml = btnRef.innerHTML;
                    btnRef.innerHTML = `<i class="ri-check-line" style="color: var(--accent-green);"></i> <span style="color: var(--accent-green);">${tt('card.copied')}</span>`;
                    btnRef.style.borderColor = 'var(--accent-green)';
                    setTimeout(() => {
                        btnRef.innerHTML = originalHtml;
                        btnRef.style.borderColor = '';
                    }, 2000);
                })
                .catch((err) => {
                    console.error('Failed to copy: ', err);
                });
        } else {
            const textarea = document.createElement('textarea');
            textarea.value = coords;
            textarea.style.position = 'fixed';
            document.body.appendChild(textarea);
            textarea.select();
            try {
                document.execCommand('copy');
                const originalHtml = btnRef.innerHTML;
                btnRef.innerHTML = `<i class="ri-check-line" style="color: var(--accent-green);"></i> <span style="color: var(--accent-green);">${tt('card.copied')}</span>`;
                btnRef.style.borderColor = 'var(--accent-green)';
                setTimeout(() => {
                    btnRef.innerHTML = originalHtml;
                    btnRef.style.borderColor = '';
                }, 2000);
            } catch (err) {
                console.error('Fallback copy failed', err);
            }
            document.body.removeChild(textarea);
        }
    }

    jumpToSiteCard(siteId) {
        const target = document.getElementById(`site-card-${siteId}`);
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            target.classList.add('highlight-glow');
            setTimeout(() => {
                target.classList.remove('highlight-glow');
            }, 2000);
        }
    }

    handleDetailsToggle(siteId, detailsEl) {
        if (!this.state.expandedSites) {
            this.state.expandedSites = {};
        }
        this.state.expandedSites[siteId] = detailsEl.open;
        const toggleTextEl = detailsEl.querySelector('.toggle-text');
        if (toggleTextEl) {
            toggleTextEl.textContent = tl(detailsEl.open ? 'card.lessInfo' : 'card.moreInfo');
        }
    }
}
