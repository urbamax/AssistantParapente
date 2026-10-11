import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import LogbookService from '../../js/services/logbook_service.js';
import SitesService from '../../js/services/sites_service.js';
import LogbookView from '../../js/views/logbook.js';
import { saveTextFile } from '../../js/utils/download.js';
import { printHtml } from '../../js/utils/print.js';
import { FR } from '../../js/i18n/fr.js';

vi.mock('../../js/utils/download.js', () => ({ saveTextFile: vi.fn() }));
vi.mock('../../js/utils/print.js', () => ({ printHtml: vi.fn() }));

const INDEX = readFileSync('index.html', 'utf8');
const LOGBOOK_SCREEN = ['logbook-screen', 'logbook-session-modal']
    .map((id) => {
        const tpl = document.createElement('template');
        tpl.innerHTML = INDEX.slice(INDEX.search(new RegExp(`<(div|dialog)\\s[^>]*id="${id}"`)));
        return tpl.content.getElementById(id).outerHTML;
    })
    .join('');

const withTrace = {
    id: 'f1',
    type: 'vol',
    datetime: '2026-09-14T10:00',
    site: 'Plaine Joux',
    duree: 30,
    rawIgc: 'HFDTE140926',
};
const noTrace = { id: 'f2', type: 'vol', datetime: '2026-09-15T10:00', site: 'Dune', duree: 20 };

function setup(flights) {
    LogbookService.flights = flights;
    LogbookService.equipment = [];
    document.body.innerHTML = `${LOGBOOK_SCREEN}<input type="file" id="global-igc-input">`;
    LogbookView.setupEventListeners();
    LogbookView.renderHistory();
}

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.stubGlobal('alert', vi.fn());
    vi.spyOn(SitesService, 'getSites').mockReturnValue([]);
    vi.spyOn(SitesService, 'ensureSitesLoaded').mockResolvedValue(undefined);
    vi.spyOn(LogbookView, 'fetchWeatherForSession').mockResolvedValue(undefined);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('logbook export: IGC download', () => {
    it('offers the download only on flights that have a trace', () => {
        setup([withTrace, noTrace]);
        const buttons = document.querySelectorAll('[data-action="downloadTrace"]');
        expect(buttons).toHaveLength(1);
        expect(buttons[0].getAttribute('data-args')).toBe('f1');
        expect(buttons[0].textContent).toContain(FR.logbook.history.downloadIgc);
    });

    it('saves the stored trace untouched under a name made of the date and the site', async () => {
        setup([withTrace]);
        await LogbookView.downloadTrace('f1');
        expect(saveTextFile).toHaveBeenCalledWith('2026-09-14_plaine-joux.igc', 'HFDTE140926', expect.any(String));
    });

    it('tells the pilot when the trace cannot be found', async () => {
        setup([noTrace]);
        await LogbookView.downloadTrace('f2');
        expect(saveTextFile).not.toHaveBeenCalled();
        expect(alert).toHaveBeenCalledWith(FR.logbook.export.noTrace);
    });
});

describe('logbook export: PDF report', () => {
    it('has a button next to the other history actions', () => {
        setup([withTrace]);
        const button = document.querySelector('.logbook-history-actions [data-action="exportLogbookPdf"]');
        expect(button).not.toBeNull();
    });

    it('prints a report with every session', () => {
        setup([withTrace, noTrace]);
        LogbookView.exportLogbookPdf();
        expect(printHtml).toHaveBeenCalledTimes(1);
        const html = vi.mocked(printHtml).mock.calls[0][0];
        expect(html).toContain('Plaine Joux');
        expect(html).toContain('Dune');
    });

    it('does not print an empty logbook and says so', () => {
        setup([]);
        LogbookView.exportLogbookPdf();
        expect(printHtml).not.toHaveBeenCalled();
        expect(alert).toHaveBeenCalledWith(FR.logbook.export.empty);
    });
});
