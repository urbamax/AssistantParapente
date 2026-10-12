import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import LogbookService from '../../js/services/logbook_service.js';
import SitesService from '../../js/services/sites_service.js';
import LogbookView from '../../js/views/logbook.js';

// Les statistiques du carnet sont cliquables : un clic filtre l'historique.
const INDEX = readFileSync('index.html', 'utf8');
const LOGBOOK_SCREEN = ['logbook-screen', 'logbook-session-modal']
    .map((id) => {
        const tpl = document.createElement('template');
        tpl.innerHTML = INDEX.slice(INDEX.search(new RegExp(`<(div|dialog)\\s[^>]*id="${id}"`)));
        return tpl.content.getElementById(id).outerHTML;
    })
    .join('');

const flight = (id, site, extra = {}) => ({
    id,
    type: 'vol',
    datetime: `2026-09-${10 + Number(id.slice(1))}T10:00`,
    site,
    voile: "Gin Bonanza d'école",
    ecole: 'ÉCOLE & CO',
    typeVol: 'Plouf',
    techDecollage: 'Face voile',
    duree: 20,
    ...extra,
});

function setup(flights) {
    LogbookService.flights = flights;
    LogbookService.equipment = [];
    document.body.innerHTML = `${LOGBOOK_SCREEN}<input type="file" id="global-igc-input">`;
    LogbookView.setupEventListeners();
    LogbookView.renderStats();
}

const stat = (type, value) =>
    [...document.querySelectorAll('[data-action="filterHistoryByStat"]')].find(
        (el) => el.dataset.statType === type && el.dataset.statValue === value,
    );

beforeEach(() => {
    localStorage.clear();
    LogbookView.activeFilter = null;
    vi.spyOn(SitesService, 'getSites').mockReturnValue([]);
    vi.spyOn(SitesService, 'ensureSitesLoaded').mockResolvedValue(undefined);
    vi.spyOn(LogbookView, 'fetchWeatherForSession').mockResolvedValue(undefined);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('logbook stats: tooltips', () => {
    it('show names with an apostrophe or an ampersand as they are written', () => {
        setup([flight('f1', "Col de l'Arpettaz"), flight('f2', 'Plaine Joux')]);
        expect(stat('site', "Col de l'Arpettaz")?.title).toBe("Filtrer par Col de l'Arpettaz");
        expect(stat('voile', "Gin Bonanza d'école")?.title).toBe("Filtrer par Gin Bonanza d'école");
        expect(stat('ecole', 'ÉCOLE & CO')?.title).toBe('Filtrer par ÉCOLE & CO');
    });
});

describe('logbook stats: click to filter the history', () => {
    it('shows only the matching sessions with a banner, and clears', () => {
        setup([flight('f1', "Col de l'Arpettaz"), flight('f2', 'Plaine Joux'), flight('f3', "Col de l'Arpettaz")]);
        stat('site', "Col de l'Arpettaz").click();
        LogbookView.filterHistoryByStat(null, null, stat('site', "Col de l'Arpettaz"));

        const list = document.getElementById('logbook-history-list');
        expect(list.querySelectorAll('.logbook-card')).toHaveLength(2);
        expect(list.querySelector('.logbook-filter-banner').textContent).toContain("Col de l'Arpettaz");
        expect(list.querySelector('.logbook-filter-banner').textContent).toContain('2 / 3');

        LogbookView.clearHistoryFilter();
        expect(list.querySelectorAll('.logbook-card')).toHaveLength(3);
        expect(list.querySelector('.logbook-filter-banner')).toBeNull();
    });

    it('jumping to a record clears the filter so the session can be reached', () => {
        setup([flight('f1', 'A'), flight('f2', 'B')]);
        LogbookView.applyHistoryFilter('site', 'A');
        Element.prototype.scrollIntoView = () => {};
        LogbookView.scrollToSession('f2');
        expect(LogbookView.activeFilter).toBeNull();
    });
});
