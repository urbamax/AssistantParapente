import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import LogbookService from '../../js/services/logbook_service.js';
import SitesService from '../../js/services/sites_service.js';
import IGCParser from '../../js/services/igc_parser.js';
import LogbookView from '../../js/views/logbook.js';
import { buildFlight, thermal, glide, toIgc } from '../helpers/synthetic_flight.js';

// Spec 034 : le type de vol se pré-remplit d'après la trace importée.
const INDEX = readFileSync('index.html', 'utf8');
const LOGBOOK_SCREEN = ['logbook-screen', 'logbook-session-modal']
    .map((id) => {
        const tpl = document.createElement('template');
        tpl.innerHTML = INDEX.slice(INDEX.search(new RegExp(`<(div|dialog)\\s[^>]*id="${id}"`)));
        return tpl.content.getElementById(id).outerHTML;
    })
    .join('');

const $ = (id) => /** @type {HTMLInputElement} */ (document.getElementById(id));
const igcFile = (phases) => new File([toIgc(buildFlight(phases))], 'vol.igc');
const thermalFlight = () => [glide(120), thermal(180, 2), glide(120)];
const straightGlide = () => [glide(420)];

function setup(flights = []) {
    LogbookService.flights = flights;
    LogbookService.equipment = [];
    LogbookView.currentFormType = 'vol';
    document.body.innerHTML = `${LOGBOOK_SCREEN}<input type="file" id="global-igc-input">`;
    LogbookView.setupEventListeners();
    LogbookView.resetForm();
}

beforeEach(() => {
    localStorage.clear();
    Element.prototype.scrollIntoView = () => {};
    vi.spyOn(SitesService, 'getSites').mockReturnValue([]);
    vi.spyOn(SitesService, 'ensureSitesLoaded').mockResolvedValue(undefined);
    vi.spyOn(LogbookService, 'saveFlights').mockImplementation(() => {});
    vi.spyOn(LogbookService, 'reverseGeocode').mockResolvedValue({ success: true, data: { city: null } });
    vi.spyOn(LogbookView, 'fetchWeatherForSession').mockResolvedValue(undefined);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('logbook: flight type read from the imported trace', () => {
    it('fills the type of a new session and says why', async () => {
        setup();
        await LogbookView._processFiles([igcFile(thermalFlight())]);
        expect($('lb-typeVol').value).toBe('Thermique');
        expect($('lb-learned-summary').textContent).toContain('thermiques repérés dans la trace');
    });

    it('fills a Plouf for a direct descent', async () => {
        setup();
        await LogbookView._processFiles([igcFile(straightGlide())]);
        expect($('lb-typeVol').value).toBe('Plouf');
        expect($('lb-learned-summary').textContent).toContain('descente directe repérée dans la trace');
    });

    it('keeps the type the pilot chose before importing', async () => {
        setup();
        $('lb-typeVol').value = 'Restit';
        $('lb-typeVol').dispatchEvent(new Event('change', { bubbles: true }));
        await LogbookView._processFiles([igcFile(thermalFlight())]);
        expect($('lb-typeVol').value).toBe('Restit');
    });

    it('keeps the type of a session being edited, except for a winch tow', () => {
        setup([{ id: 'old', type: 'vol', datetime: '2026-09-01T10:00', site: 'Plaine', duree: 5, typeVol: 'Restit' }]);
        LogbookView.editEntry('old');
        LogbookView._fillFormFromIgc(IGCParser.parse(toIgc(buildFlight(thermalFlight()))));
        expect($('lb-typeVol').value).toBe('Restit');

        $('lb-typeVol').value = 'Plouf';
        LogbookView._fillFormFromIgc(IGCParser.parse(readFileSync('tests/fixtures/syride-winch-flight.igc', 'utf8')));
        expect($('lb-typeVol').value).toBe('Treuil');
    });

    it('leaves the type alone when the trace is too short to be analysed', async () => {
        setup();
        await LogbookView._processFiles([igcFile([glide(2)])]);
        expect($('lb-typeVol').value).toBe('Plouf');
        expect($('lb-learned-summary').hidden).toBe(true);
    });
});
