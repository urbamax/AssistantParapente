import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import LogbookService from '../../js/services/logbook_service.js';
import SitesService from '../../js/services/sites_service.js';
import LogbookView from '../../js/views/logbook.js';
import { t } from '../../js/utils/i18n.js';
import { buildFlight as makeFlight, CORRUPTED_IGC, fileOf } from '../helpers/igc_fixture.js';

// Plusieurs vols importés d'un coup dans un tableau modifiable (spec 039).
const INDEX = readFileSync('index.html', 'utf8');
const SCREEN = ['logbook-screen', 'logbook-session-modal', 'logbook-batch-modal']
    .map((id) => {
        const tpl = document.createElement('template');
        tpl.innerHTML = INDEX.slice(INDEX.search(new RegExp(`<(div|dialog)\\s[^>]*id="${id}"`)));
        return tpl.content.getElementById(id).outerHTML;
    })
    .join('');

const s = (key, params) => t(`logbook.batch.${key}`, params);
const $ = (selector) => /** @type {HTMLElement} */ (document.querySelector(selector));
const all = (selector) => /** @type {HTMLElement[]} */ ([...document.querySelectorAll(selector)]);
const rowEl = (id) => $(`tr[data-row="${id}"]`);
const field = (id, name) => /** @type {HTMLInputElement} */ (rowEl(id).querySelector(`[data-batch-field="${name}"]`));
const rowIds = () => all('#logbook-batch-table tbody tr').map((tr) => tr.dataset.row);
const edit = (el, value, event = 'change') => {
    el.value = value;
    el.dispatchEvent(new Event(event, { bubbles: true }));
};
const tick = (el, checked) => {
    el.checked = checked;
    el.dispatchEvent(new Event('change', { bubbles: true }));
};

const morning = () => makeFlight({ start: '07:30:00', heading: 90, speed: 8, sink: 1 });
const noon = () => makeFlight({ start: '09:00:00', heading: 200, speed: 9, sink: 1.3 });
const afternoon = () => makeFlight({ start: '12:30:00', heading: 300, speed: 7, sink: 0.8 });
const igcFile = (name, flight) => fileOf(name, flight.igc);

const course = {
    id: 'old',
    type: 'vol',
    datetime: '2026-08-01T10:00',
    site: 'Ailleurs',
    duree: 10,
    voile: 'Voile école',
    sellette: 'Sellette',
    typeVol: 'Plouf',
    techDecollage: 'Face voile',
    ecole: 'ÉCOLE TEST',
    stageName: 'Stage été',
    stageSpecialty: 'SIV',
    moniteur: ['Gilbert', 'Marie'],
    accompagnateur: ['Sophie'],
    pilotes: ['Julie', 'Marc'],
};

function setup({ flights = [], sites = ['Col de la Test'] } = {}) {
    LogbookService.flights = flights;
    LogbookService.equipment = ['Voile école', 'Voile côte', 'Sellette'].map((nom, i) => ({
        id: `e${i}`,
        nom,
        type: nom.startsWith('Voile') ? 'voile' : 'sellette',
        statut: 'actif',
    }));
    document.body.innerHTML = `${SCREEN}<input type="file" id="global-igc-input">`;
    LogbookView.currentFormType = 'vol';
    LogbookView.setupEventListeners();
    LogbookView.activeFilter = null;
    SitesService.getSites.mockReturnValue(sites.map((nom) => ({ nom, lat: 46.4, lon: 3.4, type: 'Décollage' })));
    vi.spyOn(LogbookView, 'findNearbySites').mockImplementation(() => sites.map((nom) => ({ nom })));
}

async function open(files) {
    await LogbookView.openBatchImport(files);
    await LogbookView.batch.placesDone;
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
    vi.spyOn(SitesService, 'getSites').mockReturnValue([]);
    vi.spyOn(SitesService, 'ensureSitesLoaded').mockResolvedValue(undefined);
    vi.spyOn(LogbookService, 'saveFlights').mockImplementation(() => {});
    vi.spyOn(LogbookService, 'reverseGeocode').mockResolvedValue({ success: true, data: { city: 'Ville' } });
    vi.spyOn(LogbookView, 'fetchWeatherForSession').mockResolvedValue(undefined);
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

describe('batch import: when it opens', () => {
    it('keeps the one-flight form for a single file', async () => {
        setup();
        const opened = vi.spyOn(LogbookView, 'openBatchImport');
        const single = vi.spyOn(LogbookView, '_processIgcFile').mockResolvedValue(undefined);
        await LogbookView._processFiles([igcFile('a.igc', morning())]);
        expect(single).toHaveBeenCalledTimes(1);
        expect(opened).not.toHaveBeenCalled();
    });

    it('opens the table for two flight files or more, instead of the form', async () => {
        setup();
        const opened = vi.spyOn(LogbookView, 'openBatchImport').mockResolvedValue(undefined);
        const single = vi.spyOn(LogbookView, '_processIgcFile').mockResolvedValue(undefined);
        const files = [igcFile('a.igc', morning()), igcFile('b.igc', noon())];
        await LogbookView._processFiles(files);
        expect(opened).toHaveBeenCalledWith(files);
        expect(single).not.toHaveBeenCalled();
    });

    it('shows one row per file, ordered by date, with the starting values', async () => {
        setup({ flights: [{ ...course, site: 'Col de la Test', voile: 'Voile côte' }] });
        await open([
            igcFile('apres-midi.igc', afternoon()),
            igcFile('matin.igc', morning()),
            igcFile('midi.igc', noon()),
        ]);
        expect($('#logbook-batch-modal').hasAttribute('open')).toBe(true);
        expect(rowIds()).toEqual(['r0', 'r1', 'r2']);
        expect(all('#logbook-batch-table tbody tr').map((tr) => tr.querySelector('.batch-file').textContent)).toEqual([
            expect.stringContaining('matin.igc'),
            expect.stringContaining('midi.igc'),
            expect.stringContaining('apres-midi.igc'),
        ]);
        expect(field('r0', 'site').value).toBe('Col de la Test');
        expect(field('r0', 'voile').value).toBe('Voile côte');
        expect(field('r0', 'duree').value).toBe('12');
        expect(field('r0', 'datetime').value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    });

    it('lists every file, with the reason and without a way to include it, when it is unreadable', async () => {
        setup();
        await open([
            igcFile('ok.igc', morning()),
            fileOf('junk.igc', CORRUPTED_IGC),
            fileOf('photo.jpg', 'x'),
            igcFile('autre.igc', noon()),
        ]);
        expect(rowIds()).toHaveLength(4);
        const junk = all('#logbook-batch-table tbody tr').find((tr) => tr.textContent.includes('junk.igc'));
        expect(junk.querySelector('.batch-status').textContent).toBe(s('status.unreadable'));
        expect(junk.textContent).toContain(s('reasons.unreadable'));
        expect(/** @type {HTMLInputElement} */ (junk.querySelector('[data-batch-field="included"]')).disabled).toBe(
            true,
        );
        const photo = all('#logbook-batch-table tbody tr').find((tr) => tr.textContent.includes('photo.jpg'));
        expect(photo.textContent).toContain(s('reasons.unsupported'));
    });

    it('lists the sensor files that matched no flight', async () => {
        setup();
        await open([
            igcFile('a.igc', morning()),
            igcFile('b.igc', noon()),
            fileOf('orphelin.sdf', new Uint8Array(afternoon().sdf)),
        ]);
        expect($('#logbook-batch-sensors').textContent).toContain('orphelin.sdf');
        expect($('#logbook-batch-sensors').textContent).toContain(s('sensor.notAttached', { name: 'orphelin.sdf' }));
    });

    it('shows a sensor file attached to the row of its flight', async () => {
        setup();
        const a = morning();
        const b = noon();
        await open([igcFile('a.igc', a), igcFile('b.igc', b), fileOf('zzz.sdf', new Uint8Array(b.sdf))]);
        expect(rowEl('r1').textContent).toContain(s('sensor.attached', { name: 'zzz.sdf' }));
        expect(rowEl('r0').textContent).not.toContain('zzz.sdf');
        expect($('#logbook-batch-sensors').textContent).not.toContain('zzz.sdf');
    });

    it('says how many flights are ready, to check, and ignored', async () => {
        setup({ flights: [{ ...course, site: 'Col de la Test' }] });
        await open([igcFile('a.igc', morning()), igcFile('b.igc', noon()), fileOf('junk.igc', CORRUPTED_IGC)]);
        expect($('#logbook-batch-summary').textContent).toBe(s('summary', { ready: 2, fix: 0, skipped: 1 }));
        expect($('#logbook-batch-import').textContent).toBe(s('buttons.importMany', { count: 2 }));
    });
});

describe('batch import: rows that are not new', () => {
    it('flags a flight already in the logbook, unticked, and lets it be ticked', async () => {
        const flight = morning();
        setup();
        await open([igcFile('a.igc', flight), igcFile('b.igc', noon())]);
        const date = field('r0', 'datetime').value;
        const existing = {
            id: 'e',
            type: 'vol',
            datetime: date,
            site: 'Col de la Test',
            lat: 46.4,
            lon: 3.4,
            duree: 12,
        };
        await LogbookView.closeBatchImport();
        setup({ flights: [existing] });
        await open([igcFile('a.igc', flight), igcFile('b.igc', noon())]);
        expect(rowEl('r0').querySelector('.batch-status').textContent).toBe(s('status.known'));
        expect(field('r0', 'included').checked).toBe(false);
        expect(field('r0', 'included').disabled).toBe(false);
        tick(field('r0', 'included'), true);
        expect(field('r0', 'included').checked).toBe(true);
    });

    it('flags the same file chosen twice as a duplicate, unticked', async () => {
        setup();
        const flight = morning();
        await open([igcFile('copie.igc', flight), igcFile('original.igc', flight)]);
        const statuses = all('#logbook-batch-table tbody tr').map(
            (tr) => tr.querySelector('.batch-status').textContent,
        );
        expect(statuses.filter((x) => x === s('status.duplicate'))).toHaveLength(1);
        expect($('#logbook-batch-summary').textContent).toContain('1 ignorés');
    });
});

describe('batch import: editing a row', () => {
    it('changes only that row, and its status follows', async () => {
        setup();
        await open([igcFile('a.igc', morning()), igcFile('b.igc', noon()), igcFile('c.igc', afternoon())]);
        expect(rowEl('r1').querySelector('.batch-status').textContent).toBe(s('status.fix'));
        edit(field('r1', 'voile'), 'Voile école');
        expect(rowEl('r1').querySelector('.batch-status').textContent).toBe(s('status.ready'));
        expect(field('r0', 'voile').value).toBe('');
        expect(field('r2', 'voile').value).toBe('');
        expect(LogbookView.batch.rows[1].values.voile).toBe('Voile école');
        expect(LogbookView.batch.rows[1].edited.has('voile')).toBe(true);
        expect($('#logbook-batch-summary').textContent).toBe(s('summary', { ready: 1, fix: 2, skipped: 0 }));
    });

    it('takes a wing that is not in the equipment through "Autre" with a free text', async () => {
        setup();
        await open([igcFile('a.igc', morning()), igcFile('b.igc', noon())]);
        edit(field('r0', 'voile'), 'Autre');
        const other = rowEl('r0').querySelector('[data-batch-field="voileOther"]');
        expect(other.hasAttribute('hidden') || other.style.display === 'none').toBe(false);
        edit(other, 'Ma voile maison', 'input');
        expect(LogbookView.batch.rows[0].values.voile).toBe('Ma voile maison');
    });

    it('edits the date, the site and the duration live, and refuses a duration below one minute', async () => {
        setup();
        await open([igcFile('a.igc', morning()), igcFile('b.igc', noon())]);
        edit(field('r0', 'site'), 'Mon site', 'input');
        edit(field('r0', 'duree'), '0', 'input');
        expect(LogbookView.batch.rows[0].values.site).toBe('Mon site');
        expect(rowEl('r0').querySelector('[data-batch-field="duree"]').getAttribute('aria-invalid')).toBe('true');
        edit(field('r0', 'duree'), '30', 'input');
        expect(LogbookView.batch.rows[0].values.duree).toBe(30);
        expect(rowEl('r0').querySelector('[data-batch-field="duree"]').getAttribute('aria-invalid')).not.toBe('true');
        edit(field('r0', 'datetime'), '2026-09-21T10:15', 'input');
        expect(LogbookView.batch.rows[0].values.datetime).toBe('2026-09-21T10:15');
    });

    it('fills school, instructors and pilots of a known course picked on a row, keeping what was edited', async () => {
        setup({ flights: [course] });
        await open([igcFile('a.igc', morning()), igcFile('b.igc', noon())]);
        const pilotsInput = rowEl('r0').querySelector('[data-batch-field="pilot-new"]');
        edit(pilotsInput, 'Moi', 'input');
        pilotsInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        edit(field('r0', 'stageName'), 'STAGE ÉTÉ');
        expect(LogbookView.batch.rows[0].values).toMatchObject({
            ecole: 'ÉCOLE TEST',
            stageSpecialty: 'SIV',
            moniteur: ['Gilbert', 'Marie'],
            pilotes: ['Moi'],
        });
        expect(field('r0', 'ecole').value).toBe('ÉCOLE TEST');
        expect(all('tr[data-row="r0"] [data-batch-pilot]').map((c) => c.dataset.batchPilot)).toEqual(['Moi']);
        expect(LogbookView.batch.rows[1].values.stageName).not.toBe('STAGE ÉTÉ');
    });

    it('adds and removes pilots as tags on a row', async () => {
        setup();
        await open([igcFile('a.igc', morning()), igcFile('b.igc', noon())]);
        for (const name of ['Julie', 'Marc']) {
            // La ligne est redessinée après chaque ajout : le champ est relu à chaque fois
            const input = rowEl('r1').querySelector('[data-batch-field="pilot-new"]');
            edit(input, name, 'input');
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        }
        expect(LogbookView.batch.rows[1].values.pilotes).toEqual(['Julie', 'Marc']);
        /** @type {HTMLElement} */ (rowEl('r1').querySelector('[data-batch-pilot-remove="Julie"]')).click();
        expect(LogbookView.batch.rows[1].values.pilotes).toEqual(['Marc']);
        expect(LogbookView.batch.rows[0].values.pilotes).toEqual([]);
    });

    it('applies a column to the other rows, except those edited in that column', async () => {
        setup();
        await open([igcFile('a.igc', morning()), igcFile('b.igc', noon()), igcFile('c.igc', afternoon())]);
        edit(field('r0', 'voile'), 'Voile école');
        edit(field('r2', 'voile'), 'Voile côte');
        /** @type {HTMLElement} */ ($('[data-batch-apply="voile"]')).click();
        expect(field('r1', 'voile').value).toBe('Voile école');
        expect(field('r2', 'voile').value).toBe('Voile côte');
        expect(rowEl('r1').querySelector('.batch-status').textContent).toBe(s('status.ready'));
    });

    it('removes a row, and only that one', async () => {
        setup();
        await open([igcFile('a.igc', morning()), igcFile('b.igc', noon()), igcFile('c.igc', afternoon())]);
        /** @type {HTMLElement} */ (rowEl('r1').querySelector('[data-batch-remove]')).click();
        expect(rowIds()).toEqual(['r0', 'r2']);
    });

    it('looks the place of a row up after the table is shown, and leaves it to fill offline', async () => {
        setup({ sites: [] });
        await open([igcFile('a.igc', morning()), igcFile('b.igc', noon())]);
        expect(field('r0', 'site').value).toContain('Ville');
        expect(LogbookService.reverseGeocode).toHaveBeenCalledTimes(2);

        await LogbookView.closeBatchImport();
        setup({ sites: [] });
        vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
        await open([igcFile('a.igc', morning()), igcFile('b.igc', noon())]);
        expect(field('r0', 'site').value).toBe('');
        expect(rowEl('r0').querySelector('.batch-reason').textContent).toContain(s('fields.site'));
    });
});

describe('batch import: the import', () => {
    const fillWings = () => {
        for (const id of ['r0', 'r1']) edit(field(id, 'voile'), 'Voile école');
    };

    it('adds every included row at once, closes, opens the history and tells how many', async () => {
        setup();
        const a = morning();
        await open([igcFile('a.igc', a), igcFile('b.igc', noon()), fileOf('junk.igc', CORRUPTED_IGC)]);
        fillWings();
        edit(field('r1', 'voile'), 'Voile côte');
        const switchTab = vi.spyOn(LogbookView, 'switchTab');
        await LogbookView.importBatch();

        const flights = LogbookService.getFlights();
        expect(flights).toHaveLength(2);
        expect(flights.map((f) => f.voile).sort()).toEqual(['Voile côte', 'Voile école']);
        expect(flights.every((f) => f.rawIgc && f.type === 'vol' && f.syncPending)).toBe(true);
        expect(LogbookService.saveFlights).toHaveBeenCalledTimes(1);
        expect($('#logbook-batch-modal').hasAttribute('open')).toBe(false);
        expect(switchTab).toHaveBeenCalledWith('history');
        expect(alert).toHaveBeenCalledWith(s('done.many', { count: 2 }));
        expect(LogbookView.fetchWeatherForSession).toHaveBeenCalledTimes(2);
    });

    it('adds once when the button is activated twice', async () => {
        setup();
        await open([igcFile('a.igc', morning()), igcFile('b.igc', noon())]);
        fillWings();
        await Promise.all([LogbookView.importBatch(), LogbookView.importBatch()]);
        expect(LogbookService.getFlights()).toHaveLength(2);
    });

    it('blocks the import while a mandatory value is missing, marks it and adds nothing', async () => {
        setup();
        await open([igcFile('a.igc', morning()), igcFile('b.igc', noon())]);
        edit(field('r0', 'voile'), 'Voile école');
        await LogbookView.importBatch();
        expect(LogbookService.getFlights()).toHaveLength(0);
        expect($('#logbook-batch-modal').hasAttribute('open')).toBe(true);
        expect(field('r1', 'voile').getAttribute('aria-invalid')).toBe('true');
        expect($('#logbook-batch-live').textContent).toContain(s('blocked'));
        // Décocher la ligne incomplète débloque
        tick(field('r1', 'included'), false);
        await LogbookView.importBatch();
        expect(LogbookService.getFlights()).toHaveLength(1);
        expect(alert).toHaveBeenCalledWith(s('done.one'));
    });

    it('keeps the table and says so when the logbook cannot be saved', async () => {
        setup();
        await open([igcFile('a.igc', morning()), igcFile('b.igc', noon())]);
        fillWings();
        LogbookService.saveFlights.mockImplementation(() => {
            throw new Error('quota');
        });
        await LogbookView.importBatch();
        expect(LogbookService.getFlights()).toHaveLength(0);
        expect($('#logbook-batch-modal').hasAttribute('open')).toBe(true);
        expect(alert).toHaveBeenCalledWith(s('failed', { error: 'quota' }));
        expect(/** @type {HTMLButtonElement} */ ($('#logbook-batch-import')).disabled).toBe(false);
    });

    it('stores the same flight as the form for the same trace', async () => {
        setup();
        const flight = morning();
        await open([igcFile('a.igc', flight), igcFile('b.igc', noon())]);
        edit(field('r0', 'voile'), 'Voile école');
        edit(field('r0', 'site'), 'Mon site', 'input');
        tick(field('r1', 'included'), false);
        await LogbookView.importBatch();
        const fromTable = LogbookService.getFlights()[0];

        // Le même vol par le formulaire d'un vol
        LogbookService.flights = [];
        LogbookView.resetForm();
        await LogbookView._processFiles([igcFile('a.igc', flight)]);
        /** @type {HTMLInputElement} */ (document.getElementById('lb-site')).value = 'Mon site';
        /** @type {HTMLSelectElement} */ (document.getElementById('lb-voile')).value = 'Voile école';
        LogbookView.submitForm();
        const fromForm = LogbookService.getFlights()[0];

        const strip = (flight) => {
            const copy = { ...flight };
            for (const key of ['id', 'updatedAt', 'syncPending', 'traceUpdatedAt', 'meteo', 'meteoAtterro'])
                delete copy[key];
            return copy;
        };
        expect(strip(fromTable)).toEqual(strip(fromForm));
    });
});

describe('batch import: closing', () => {
    it('adds nothing when cancelled', async () => {
        setup();
        await open([igcFile('a.igc', morning()), igcFile('b.igc', noon())]);
        await LogbookView.closeBatchImport();
        expect(LogbookService.getFlights()).toHaveLength(0);
        expect($('#logbook-batch-modal').hasAttribute('open')).toBe(false);
    });

    it('asks before throwing away corrections, and stays open when refused', async () => {
        setup();
        await open([igcFile('a.igc', morning()), igcFile('b.igc', noon())]);
        edit(field('r0', 'voile'), 'Voile école');
        confirm.mockReturnValue(false);
        await LogbookView.closeBatchImport();
        expect(confirm).toHaveBeenCalledWith(s('confirmClose'));
        expect($('#logbook-batch-modal').hasAttribute('open')).toBe(true);
        confirm.mockReturnValue(true);
        await LogbookView.closeBatchImport();
        expect($('#logbook-batch-modal').hasAttribute('open')).toBe(false);
    });

    it('does not ask when nothing was edited', async () => {
        setup();
        await open([igcFile('a.igc', morning()), igcFile('b.igc', noon())]);
        await LogbookView.closeBatchImport();
        expect(confirm).not.toHaveBeenCalled();
    });
});

describe('batch import: accessibility and escaping', () => {
    it('uses a real table with labelled controls and announces the state', async () => {
        setup();
        await open([igcFile('a.igc', morning()), igcFile('b.igc', noon())]);
        expect($('#logbook-batch-table table')).not.toBeNull();
        expect(all('#logbook-batch-table thead th[scope="col"]').length).toBeGreaterThanOrEqual(10);
        for (const control of all('#logbook-batch-table input, #logbook-batch-table select')) {
            expect(control.getAttribute('aria-label') || control.id).toBeTruthy();
        }
        expect($('#logbook-batch-live').getAttribute('aria-live')).toBe('polite');
    });

    it('shows file names, sites, wings and pilots with escaping', async () => {
        setup({ flights: [{ ...course, pilotes: ['<b>Zoé</b>'], site: 'Col de la Test' }] });
        await open([igcFile('<img src=x onerror=alert(1)>.igc', morning()), igcFile('b.igc', noon())]);
        expect($('#logbook-batch-table img')).toBeNull();
        expect($('#logbook-batch-table b')).toBeNull();
        expect($('#logbook-batch-table').textContent).toContain('<img src=x onerror=alert(1)>.igc');
    });
});
