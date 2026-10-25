import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import LogbookService from '../../js/services/logbook_service.js';
import SitesService from '../../js/services/sites_service.js';
import LogbookView from '../../js/views/logbook.js';

// Les stages des sessions d'école apparaissent dans les statistiques du carnet (spec 038).
const INDEX = readFileSync('index.html', 'utf8');
const LOGBOOK_SCREEN = ['logbook-screen', 'logbook-session-modal']
    .map((id) => {
        const tpl = document.createElement('template');
        tpl.innerHTML = INDEX.slice(INDEX.search(new RegExp(`<(div|dialog)\\s[^>]*id="${id}"`)));
        return tpl.content.getElementById(id).outerHTML;
    })
    .join('');

let n = 0;
const session = (type, extra = {}) => ({
    id: `s${n++}`,
    type,
    datetime: `2026-09-${String(30 - n).padStart(2, '0')}T10:00`,
    ...(type === 'vol' ? { site: 'Plaine', typeVol: 'Plouf' } : { lieu: 'Pente' }),
    voile: 'Voile école',
    duree: 20,
    ecole: 'ÉCOLE & CO',
    ...extra,
});
const flight = (extra) => session('vol', extra);
const ground = (extra) => session('gonflage', extra);

function setup(flights) {
    LogbookService.flights = flights;
    LogbookService.equipment = [];
    document.body.innerHTML = `${LOGBOOK_SCREEN}<input type="file" id="global-igc-input">`;
    LogbookView.setupEventListeners();
    LogbookView.renderStats();
}

const tiles = () => [...document.querySelectorAll('[data-stat-type="stage"], [data-stat-type="stageUnnamed"]')];
const tile = (value) => tiles().find((el) => el.dataset.statValue === value);
const card = () => document.querySelector('[data-stage-stats]');

beforeEach(() => {
    n = 0;
    localStorage.clear();
    LogbookView.activeFilter = null;
    vi.spyOn(SitesService, 'getSites').mockReturnValue([]);
    vi.spyOn(SitesService, 'ensureSitesLoaded').mockResolvedValue(undefined);
    vi.spyOn(LogbookView, 'fetchWeatherForSession').mockResolvedValue(undefined);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('logbook stats: courses', () => {
    it('are not shown when no session belongs to a course', () => {
        setup([flight(), ground(), flight({ ecole: '', stageName: 'Orphelin' })]);
        expect(card()).toBeNull();
        expect(tiles()).toHaveLength(0);
    });

    it('list each course with its school, specialty, flights and ground sessions', () => {
        setup([
            flight({ stageName: 'Stage été', stageSpecialty: 'SIV', duree: 30 }),
            flight({ stageName: 'Stage été', stageSpecialty: 'SIV', duree: 45 }),
            ground({ stageName: 'Stage été', stageSpecialty: 'SIV', duree: 60 }),
            flight({ stageName: 'Perf', ecole: 'AUTRE ÉCOLE', stageSpecialty: 'Cross' }),
            flight(),
        ]);
        expect(card()).not.toBeNull();
        expect(tiles()).toHaveLength(2);
        const summer = tile('Stage été');
        expect(summer.textContent).toContain('ÉCOLE & CO');
        expect(summer.textContent).toContain('SIV');
        expect(summer.textContent).toContain('Vols: 2 (1h 15min)');
        expect(summer.textContent).toContain('Gonflage: 1 (1h 00min)');
        expect(tile('Perf').textContent).toContain('AUTRE ÉCOLE');
    });

    it('put the most active course first and tell how many sessions are in a course', () => {
        setup([
            flight({ stageName: 'Seul' }),
            flight({ stageName: 'Deux' }),
            ground({ stageName: 'Deux' }),
            flight(),
            flight(),
        ]);
        expect(tiles().map((el) => el.dataset.statValue)).toEqual(['Deux', 'Seul']);
        expect(card().textContent).toContain('3 sessions en stage sur 5 au total');
    });

    it('count a course once whatever the case or the spaces of its name', () => {
        setup([
            flight({ stageName: 'Stage Été' }),
            flight({ stageName: ' stage été ' }),
            ground({ stageName: 'STAGE ÉTÉ' }),
        ]);
        expect(tiles()).toHaveLength(1);
        expect(tiles()[0].textContent).toContain('Vols: 2');
        expect(tiles()[0].textContent).toContain('Gonflage: 1');
    });

    it('group sessions with a specialty but no name in one unnamed course', () => {
        setup([
            flight({ stageSpecialty: 'SIV' }),
            ground({ stageSpecialty: 'Initiation' }),
            flight({ stageName: 'Perf' }),
        ]);
        const unnamed = tiles().find((el) => el.dataset.statType === 'stageUnnamed');
        expect(unnamed.textContent).toContain('Stage sans nom');
        expect(unnamed.textContent).toContain('Vols: 1');
        expect(unnamed.textContent).toContain('Gonflage: 1');
    });

    it('show names with an ampersand or an apostrophe as they are written', () => {
        setup([flight({ stageName: "Stage d'été & co" })]);
        expect(tile("Stage d'été & co")?.title).toBe("Filtrer par Stage d'été & co");
        expect(tile("Stage d'été & co").textContent).toContain("Stage d'été & co");
    });

    it('can be reached with the keyboard like the other statistics', () => {
        setup([flight({ stageName: 'Perf' })]);
        expect(tile('Perf').getAttribute('role')).toBe('button');
        expect(tile('Perf').getAttribute('tabindex')).toBe('0');
        expect(tile('Perf').dataset.action).toBe('filterHistoryByStat');
    });
});

describe('logbook stats: touching a course filters the history', () => {
    const history = () => document.getElementById('logbook-history-list');

    it('shows only the sessions of that course, whatever the spelling, with a banner that clears', () => {
        setup([
            flight({ stageName: 'Stage été' }),
            ground({ stageName: 'stage été ' }),
            flight({ stageName: 'Perf' }),
            flight(),
        ]);
        LogbookView.filterHistoryByStat(null, null, tile('Stage été'));
        expect(history().querySelectorAll('.logbook-card')).toHaveLength(2);
        const banner = history().querySelector('.logbook-filter-banner');
        expect(banner.textContent).toContain('Stage été');
        expect(banner.textContent).toContain('2 / 4');

        LogbookView.clearHistoryFilter();
        expect(history().querySelectorAll('.logbook-card')).toHaveLength(4);
        expect(history().querySelector('.logbook-filter-banner')).toBeNull();
    });

    it('shows only the sessions of the unnamed course', () => {
        setup([flight({ stageSpecialty: 'SIV' }), flight({ stageName: 'Perf' }), flight()]);
        const unnamed = tiles().find((el) => el.dataset.statType === 'stageUnnamed');
        LogbookView.filterHistoryByStat(null, null, unnamed);
        expect(history().querySelectorAll('.logbook-card')).toHaveLength(1);
        expect(history().querySelector('.logbook-filter-banner').textContent).toContain('Stage sans nom');
    });

    it('does not mix a course named like the unnamed label with the unnamed course', () => {
        setup([flight({ stageName: 'Stage sans nom' }), flight({ stageSpecialty: 'SIV' })]);
        LogbookView.filterHistoryByStat(null, null, tile('Stage sans nom'));
        expect(history().querySelectorAll('.logbook-card')).toHaveLength(1);
    });

    it('count in the history exactly what the statistics counted', () => {
        setup([
            flight({ stageName: 'A' }),
            ground({ stageName: 'a' }),
            flight({ stageName: 'B' }),
            flight({ stageSpecialty: 'SIV' }),
        ]);
        const counted = tiles().reduce((sum, el) => {
            LogbookView.filterHistoryByStat(null, null, el);
            return sum + history().querySelectorAll('.logbook-card').length;
        }, 0);
        expect(counted).toBe(4);
    });
});
