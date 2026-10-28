import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import LogbookService from '../../js/services/logbook_service.js';
import SitesService from '../../js/services/sites_service.js';
import LogbookView from '../../js/views/logbook.js';
import { t } from '../../js/utils/i18n.js';
import { buildXlsx, ffvlExport } from '../helpers/xlsx_fixture.js';

// Import de l'export Excel du carnet FFVL (spec 046) : choix du fichier, tableau de revue, import, repérage
// des vols importés dans l'historique et annulation d'un import.
const INDEX = readFileSync('index.html', 'utf8');
const SCREEN = ['logbook-screen', 'logbook-session-modal', 'logbook-ffvl-modal']
    .map((id) => {
        const tpl = document.createElement('template');
        tpl.innerHTML = INDEX.slice(INDEX.search(new RegExp(`<(div|dialog)\\s[^>]*id="${id}"`)));
        return tpl.content.getElementById(id).outerHTML;
    })
    .join('');

const s = (key, params) => t(`logbook.ffvl.${key}`, params);
const $ = (selector) => /** @type {HTMLElement} */ (document.querySelector(selector));
const all = (selector) => /** @type {HTMLElement[]} */ ([...document.querySelectorAll(selector)]);
const rowEl = (id) => $(`#logbook-ffvl-table tr[data-row="${id}"]`);
const field = (id, name) => /** @type {HTMLInputElement} */ (rowEl(id).querySelector(`[data-ffvl-field="${name}"]`));
const importButton = () => /** @type {HTMLButtonElement} */ ($('#logbook-ffvl-import'));
const edit = (el, value, event = 'input') => {
    el.value = value;
    el.dispatchEvent(new Event(event, { bubbles: true }));
};
const tick = (el, checked) => {
    el.checked = checked;
    el.dispatchEvent(new Event('change', { bubbles: true }));
};

const SAMPLE = [['2026-10-27', 'SANARY', 100, '60 minutes', 'Analyse personnelle', 'Jean Dupont']];
const TWO = [...SAMPLE, ['2026-10-28', 'ANNECY', 250, '30 minutes', '', 'Jean Dupont']];
const xlsxFile = (flights = SAMPLE, name = 'Carnet_vols.xlsx') => new File([ffvlExport(flights)], name);

const manual = {
    id: 'm1',
    type: 'vol',
    datetime: '2026-09-01T10:15',
    site: 'Annecy',
    duree: 20,
    voile: 'Ma voile',
    typeVol: 'Thermique',
};

function setup({ flights = [] } = {}) {
    LogbookService.flights = flights;
    LogbookService.equipment = [];
    document.body.innerHTML = SCREEN;
    LogbookView.currentFormType = 'vol';
    LogbookView.setupEventListeners();
    LogbookView.activeFilter = null;
    LogbookView.ffvl = null;
}

beforeEach(() => {
    localStorage.clear();
    Element.prototype.scrollIntoView = () => {};
    HTMLDialogElement.prototype.showModal = function () {
        this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close = function () {
        this.removeAttribute('open');
    };
    vi.spyOn(SitesService, 'getSites').mockReturnValue([{ nom: 'Sanary', lat: 43.1, lon: 5.8 }]);
    vi.spyOn(SitesService, 'ensureSitesLoaded').mockResolvedValue(undefined);
    vi.spyOn(LogbookService, 'saveFlights').mockImplementation(() => {});
    vi.stubGlobal('alert', vi.fn());
    vi.stubGlobal(
        'confirm',
        vi.fn(() => true),
    );
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('FFVL import: choosing the file', () => {
    it('has a button in the history that opens the file chooser', () => {
        setup();
        const input = /** @type {HTMLInputElement} */ ($('#ffvl-import-input'));
        const click = vi.spyOn(input, 'click').mockImplementation(() => {});
        expect($('#logbook-ffvl-btn').dataset.action).toBe('triggerFfvlImport');
        expect(input.accept).toContain('.xlsx');
        LogbookView.triggerFfvlImport();
        expect(click).toHaveBeenCalled();
    });

    it('opens the table for the file picked in the file field, and lets the same file be picked again', async () => {
        setup();
        const input = /** @type {HTMLInputElement} */ ($('#ffvl-import-input'));
        const file = xlsxFile();
        Object.defineProperty(input, 'files', { value: [file], configurable: true });
        const valueSet = vi.fn();
        Object.defineProperty(input, 'value', { set: valueSet, get: () => '', configurable: true });
        await LogbookView.handleFfvlFile('', new Event('change'), input);
        expect(valueSet).toHaveBeenCalledWith('');
        expect($('#logbook-ffvl-modal').hasAttribute('open')).toBe(true);
    });

    it('does nothing when no file was picked', async () => {
        setup();
        await LogbookView.handleFfvlFile('', new Event('change'), { files: [], value: '' });
        expect($('#logbook-ffvl-modal').hasAttribute('open')).toBe(false);
    });

    it('says so, and opens nothing, for a file that is not an Excel workbook', async () => {
        setup();
        await LogbookView.openFfvlImport(new File(['Date;Site'], 'carnet.csv'));
        expect(alert).toHaveBeenCalledWith(s('errors.unreadable', { name: 'carnet.csv' }));
        expect($('#logbook-ffvl-modal').hasAttribute('open')).toBe(false);
    });

    it('says so for a workbook that is not an FFVL logbook', async () => {
        setup();
        const file = new File(
            [
                buildXlsx([
                    ['Produit', 'Prix'],
                    ['Voile', 1500],
                ]),
            ],
            'devis.xlsx',
        );
        await LogbookView.openFfvlImport(file);
        expect(alert).toHaveBeenCalledWith(s('errors.notFfvl', { name: 'devis.xlsx' }));
        expect($('#logbook-ffvl-modal').hasAttribute('open')).toBe(false);
    });

    it('says so for an export without any flight', async () => {
        setup();
        await LogbookView.openFfvlImport(xlsxFile([], 'vide.xlsx'));
        expect(alert).toHaveBeenCalledWith(s('errors.empty', { name: 'vide.xlsx' }));
        expect($('#logbook-ffvl-modal').hasAttribute('open')).toBe(false);
    });
});

describe('FFVL import: the table', () => {
    it('shows one row per flight, ready, with the values of the export', async () => {
        setup();
        await LogbookView.openFfvlImport(xlsxFile(TWO));
        expect($('#logbook-ffvl-modal').hasAttribute('open')).toBe(true);
        expect($('#logbook-ffvl-title').textContent).toBe(s('title'));
        const rows = all('#logbook-ffvl-table tbody tr');
        expect(rows.map((r) => r.dataset.row)).toEqual(['r0', 'r1']);
        expect(rows[0].textContent).toContain('27/10/2026');
        expect(rows[0].textContent).toContain('Analyse personnelle');
        expect(rows[0].textContent).toContain('Jean Dupont');
        expect(field('r0', 'site').value).toBe('Sanary');
        expect(field('r1', 'site').value).toBe('Annecy');
        expect(rows[0].querySelector('.batch-status').textContent).toBe(s('status.ready'));
        expect(field('r0', 'included').checked).toBe(true);
        expect($('#logbook-ffvl-summary').textContent).toBe(s('summary', { ready: 2, fix: 0, skipped: 0 }));
        expect(importButton().textContent).toBe(s('buttons.importMany', { count: 2 }));
        expect(importButton().disabled).toBe(false);
    });

    it('escapes what the file contains', async () => {
        setup();
        await LogbookView.openFfvlImport(
            xlsxFile([['2026-10-27', '<img src=x onerror=alert(1)>', 1, '5 minutes', '<b>x</b>', '"&']]),
        );
        expect(all('#logbook-ffvl-table img, #logbook-ffvl-table b')).toHaveLength(0);
        expect(field('r0', 'site').value).toBe('<img src=x onerror=alert(1)>');
    });

    it('cancel closes the table and adds nothing', async () => {
        setup();
        await LogbookView.openFfvlImport(xlsxFile());
        await LogbookView.closeFfvlImport();
        expect($('#logbook-ffvl-modal').hasAttribute('open')).toBe(false);
        expect(LogbookService.getFlights()).toEqual([]);
        expect(confirm).not.toHaveBeenCalled();
    });

    it('asks before closing after a correction, and stays open if the pilot refuses', async () => {
        setup();
        await LogbookView.openFfvlImport(xlsxFile());
        edit(field('r0', 'site'), 'Sanary-sur-Mer');
        confirm.mockReturnValueOnce(false);
        expect(await LogbookView.closeFfvlImport()).toBe(false);
        expect(confirm).toHaveBeenCalledWith(s('confirmClose'));
        expect($('#logbook-ffvl-modal').hasAttribute('open')).toBe(true);
        expect(await LogbookView.closeFfvlImport()).toBe(true);
        expect($('#logbook-ffvl-modal').hasAttribute('open')).toBe(false);
    });

    it('updates the summary when a row is unticked', async () => {
        setup();
        await LogbookView.openFfvlImport(xlsxFile(TWO));
        tick(field('r1', 'included'), false);
        expect($('#logbook-ffvl-summary').textContent).toBe(s('summary', { ready: 1, fix: 0, skipped: 1 }));
        expect(importButton().textContent).toBe(s('buttons.importOne'));
        tick(field('r0', 'included'), false);
        expect(importButton().disabled).toBe(true);
    });

    it('proposes the schools already in the logbook', async () => {
        setup({ flights: [{ ...manual, ecole: 'Ecole du Mont' }] });
        await LogbookView.openFfvlImport(xlsxFile());
        expect(all('#logbook-ffvl-schools option').map((o) => o.getAttribute('value'))).toEqual(['Ecole du Mont']);
    });
});

describe('FFVL import: importing', () => {
    it('adds the ticked rows once, closes the table, shows the history and says how many', async () => {
        setup();
        const switchTab = vi.spyOn(LogbookView, 'switchTab').mockImplementation(() => {});
        await LogbookView.openFfvlImport(xlsxFile(TWO));
        tick(field('r1', 'included'), false);
        LogbookView.importFfvl();
        LogbookView.importFfvl();
        const flights = LogbookService.getFlights();
        expect(flights).toHaveLength(1);
        expect(flights[0]).toMatchObject({
            type: 'vol',
            site: 'Sanary',
            duree: 60,
            datetime: '2026-10-27T00:00',
            dateOnly: true,
            voile: '',
            typeVol: '',
        });
        expect(flights[0].import).toMatchObject({ source: 'ffvl-xlsx' });
        expect(flights[0].updatedAt).toBe(flights[0].import.importedAt);
        expect($('#logbook-ffvl-modal').hasAttribute('open')).toBe(false);
        expect(switchTab).toHaveBeenCalledWith('history');
        expect(alert).toHaveBeenCalledWith(s('done.one'));
    });

    it('gives the flights of one import the same import mark', async () => {
        setup();
        vi.spyOn(LogbookView, 'switchTab').mockImplementation(() => {});
        await LogbookView.openFfvlImport(xlsxFile(TWO));
        LogbookView.importFfvl();
        const marks = LogbookService.getFlights().map((f) => f.import);
        expect(new Set(marks.map((m) => m.batchId)).size).toBe(1);
        expect(new Set(marks.map((m) => m.key)).size).toBe(2);
        expect(alert).toHaveBeenCalledWith(s('done.many', { count: 2 }));
    });

    it('records the instructor as the school instructor when a school is given', async () => {
        setup();
        vi.spyOn(LogbookView, 'switchTab').mockImplementation(() => {});
        await LogbookView.openFfvlImport(xlsxFile());
        edit($('#logbook-ffvl-school'), 'Ecole du Mont', 'change');
        LogbookView.importFfvl();
        expect(LogbookService.getFlights()[0]).toMatchObject({ ecole: 'Ecole du Mont', moniteur: ['Jean Dupont'] });
    });

    it('is blocked while a site is missing, marks the cell, and works once it is typed', async () => {
        setup();
        const switchTab = vi.spyOn(LogbookView, 'switchTab').mockImplementation(() => {});
        await LogbookView.openFfvlImport(xlsxFile([['2026-10-27', '', 10, '30 minutes', '', '']]));
        expect(rowEl('r0').querySelector('.batch-status').textContent).toBe(s('status.fix'));
        LogbookView.importFfvl();
        expect(LogbookService.getFlights()).toEqual([]);
        expect(field('r0', 'site').getAttribute('aria-invalid')).toBe('true');
        expect($('#logbook-ffvl-live').textContent).toContain(s('blocked'));
        edit(field('r0', 'site'), 'Annecy');
        expect(field('r0', 'site').hasAttribute('aria-invalid')).toBe(false);
        LogbookView.importFfvl();
        expect(LogbookService.getFlights()).toHaveLength(1);
        expect(switchTab).toHaveBeenCalledWith('history');
    });

    it('keeps the table and says so when the logbook cannot be saved', async () => {
        setup();
        await LogbookView.openFfvlImport(xlsxFile());
        vi.spyOn(LogbookService, 'addFlights').mockReturnValue({ success: false, data: [], error: 'quota' });
        LogbookView.importFfvl();
        expect(alert).toHaveBeenCalledWith(s('failed', { error: 'quota' }));
        expect($('#logbook-ffvl-modal').hasAttribute('open')).toBe(true);
        expect(importButton().disabled).toBe(false);
    });
});

describe('FFVL import: what was already imported', () => {
    const importOnce = async (flights = SAMPLE) => {
        vi.spyOn(LogbookView, 'switchTab').mockImplementation(() => {});
        await LogbookView.openFfvlImport(xlsxFile(flights));
        LogbookView.importFfvl();
    };

    it('flags every flight of the same file as already imported, unticked, and nothing can be imported', async () => {
        setup();
        await importOnce(TWO);
        await LogbookView.openFfvlImport(xlsxFile(TWO));
        for (const id of ['r0', 'r1']) {
            expect(rowEl(id).querySelector('.batch-status').textContent).toBe(s('status.imported'));
            expect(field(id, 'included').checked).toBe(false);
        }
        expect(rowEl('r0').querySelector('.batch-reason').textContent).toContain(
            s('reasons.imported', { date: '' }).slice(0, 20),
        );
        expect(importButton().disabled).toBe(true);
        expect($('#logbook-ffvl-note').textContent).toBe(s('allImported'));
    });

    it('offers only the new flights of a longer export', async () => {
        setup();
        await importOnce(SAMPLE);
        await LogbookView.openFfvlImport(xlsxFile([...SAMPLE, ['2026-11-02', 'ANNECY', 80, '15 minutes', '', '']]));
        expect(rowEl('r0').querySelector('.batch-status').textContent).toBe(s('status.imported'));
        expect(rowEl('r1').querySelector('.batch-status').textContent).toBe(s('status.ready'));
        expect(importButton().textContent).toBe(s('buttons.importOne'));
        expect($('#logbook-ffvl-note').textContent).toBe('');
    });

    it('flags a similar flight entered by hand, and imports it only if the pilot ticks it', async () => {
        setup({ flights: [{ ...manual, datetime: '2026-10-27T10:00', site: 'Sanary', duree: 58 }] });
        await LogbookView.openFfvlImport(xlsxFile());
        expect(rowEl('r0').querySelector('.batch-status').textContent).toBe(s('status.similar'));
        expect(field('r0', 'included').checked).toBe(false);
        tick(field('r0', 'included'), true);
        expect(importButton().disabled).toBe(false);
        vi.spyOn(LogbookView, 'switchTab').mockImplementation(() => {});
        LogbookView.importFfvl();
        expect(LogbookService.getFlights()).toHaveLength(2);
    });

    it('imports a cancelled import as a first import', async () => {
        setup();
        await importOnce();
        LogbookService.undoImport(LogbookService.importBatches()[0].batchId);
        await LogbookView.openFfvlImport(xlsxFile());
        expect(rowEl('r0').querySelector('.batch-status').textContent).toBe(s('status.ready'));
        expect(field('r0', 'included').checked).toBe(true);
    });
});

describe('FFVL import: in the history', () => {
    const importedFlights = (importedAt = 1000) => [
        {
            id: 'i1',
            type: 'vol',
            datetime: '2026-10-27T00:00',
            dateOnly: true,
            site: 'Sanary',
            duree: 60,
            typeVol: '',
            commentaire: 'Dénivelé : 100 m',
            updatedAt: importedAt,
            import: { source: 'ffvl-xlsx', batchId: 'b1', importedAt, key: 'k1' },
        },
        {
            id: 'i2',
            type: 'vol',
            datetime: '2026-10-28T00:00',
            dateOnly: true,
            site: 'Annecy',
            duree: 30,
            typeVol: '',
            updatedAt: importedAt,
            import: { source: 'ffvl-xlsx', batchId: 'b1', importedAt, key: 'k2' },
        },
    ];

    it('marks an imported flight, and a flight entered by hand is not marked', () => {
        setup({ flights: [manual, ...importedFlights(new Date('2026-10-29T10:00:00').getTime())] });
        LogbookView.renderHistory();
        const imported = $('.logbook-card[data-session-id="i1"]');
        const badge = imported.querySelector('.session-import-badge');
        expect(badge.textContent).toContain(s('badge'));
        expect(badge.getAttribute('title')).toBe(s('badgeTitle', { date: '29/10/2026' }));
        expect($('.logbook-card[data-session-id="m1"]').querySelector('.session-import-badge')).toBe(null);
    });

    it('shows only the date of a flight that has no time', () => {
        setup({ flights: [manual, ...importedFlights()] });
        LogbookView.renderHistory();
        expect($('.logbook-card[data-session-id="i1"] .session-date').textContent).toBe('27/10/2026');
        expect($('.logbook-card[data-session-id="m1"] .session-date').textContent).toContain('10:15');
    });

    it('shows no empty flight type for an imported flight', () => {
        setup({ flights: importedFlights() });
        LogbookView.renderHistory();
        expect($('.logbook-card[data-session-id="i1"] .session-details').querySelector('.ri-price-tag-3-line')).toBe(
            null,
        );
    });

    it('lists the imports with their date and number of flights, newest first', () => {
        const flights = [
            ...importedFlights(new Date('2026-10-29T10:00:00').getTime()),
            {
                ...importedFlights()[0],
                id: 'o1',
                import: {
                    source: 'ffvl-xlsx',
                    batchId: 'b0',
                    importedAt: new Date('2026-09-01T10:00:00').getTime(),
                    key: 'k0',
                },
            },
        ];
        setup({ flights });
        LogbookView.renderHistory();
        const lines = all('.logbook-import-line');
        expect(lines.map((l) => l.querySelector('.logbook-import-text').textContent)).toEqual([
            s('imports.lineMany', { date: '29/10/2026', count: 2 }),
            s('imports.lineOne', { date: '01/09/2026' }),
        ]);
        expect(lines[0].querySelector('button').dataset.action).toBe('undoFfvlImport');
        expect(lines[0].querySelector('button').dataset.args).toBe('b1');
        expect(lines[0].querySelector('button').textContent).toContain(s('imports.undo'));
    });

    it('lists no import when none was made', () => {
        setup({ flights: [manual] });
        LogbookView.renderHistory();
        expect(all('.logbook-imports')).toHaveLength(0);
    });

    it('cancels an import after a confirmation that says how many flights go, and leaves the others', () => {
        setup({ flights: [manual, ...importedFlights()] });
        LogbookView.renderHistory();
        LogbookView.undoFfvlImport('b1');
        expect(confirm).toHaveBeenCalledTimes(1);
        const question = confirm.mock.calls[0][0];
        expect(question).toContain(s('imports.confirmMany', { count: 2 }));
        expect(question).toContain(s('imports.confirmUntouched'));
        expect(LogbookService.getFlights().map((f) => f.id)).toEqual(['m1']);
        expect(alert).toHaveBeenCalledWith(s('imports.undoneMany', { count: 2 }));
        expect(all('.logbook-imports')).toHaveLength(0);
        expect(all('.logbook-card')).toHaveLength(1);
    });

    it('warns that flights edited since the import lose their edits', () => {
        const flights = importedFlights();
        flights[0].updatedAt = 5000;
        setup({ flights });
        LogbookView.undoFfvlImport('b1');
        expect(confirm.mock.calls[0][0]).toContain(s('imports.editedOne'));
    });

    it('removes nothing when the pilot refuses', () => {
        setup({ flights: [manual, ...importedFlights()] });
        confirm.mockReturnValueOnce(false);
        LogbookView.undoFfvlImport('b1');
        expect(LogbookService.getFlights()).toHaveLength(3);
        expect(alert).not.toHaveBeenCalled();
    });

    it('does not show a nameless flight type in the statistics', () => {
        setup({ flights: [manual, ...importedFlights()] });
        LogbookView.renderStats();
        const html = $('#logbook-stats-container').innerHTML;
        expect(html).not.toContain('data-stat-type="typeVol" data-stat-value=""');
        expect(html).toContain('data-stat-value="Thermique"');
    });
});
