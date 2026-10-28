import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import LogbookService from '../../js/services/logbook_service.js';
import SitesService from '../../js/services/sites_service.js';
import IGCParser from '../../js/services/igc_parser.js';
import LogbookView from '../../js/views/logbook.js';
import { buildIgc, GROUND, FLIGHT_10MIN } from '../helpers/synthetic_igc.js';

// La prise de terrain se pré-remplit d'après la dernière descente de la trace importée.
const INDEX = readFileSync('index.html', 'utf8');
const LOGBOOK_SCREEN = ['logbook-screen', 'logbook-session-modal']
    .map((id) => {
        const tpl = document.createElement('template');
        tpl.innerHTML = INDEX.slice(INDEX.search(new RegExp(`<(div|dialog)\\s[^>]*id="${id}"`)));
        return tpl.content.getElementById(id).outerHTML;
    })
    .join('');

const $ = (id) => /** @type {HTMLInputElement} */ (document.getElementById(id));
const straight = (seconds) => ({ seconds, speedKmh: 36, verticalMs: -1 });
const turn = (seconds, turnDegPerS = 6) => ({ ...straight(seconds), turnDegPerS });
const uApproach = () => [GROUND, FLIGHT_10MIN, straight(40), turn(15), straight(10), turn(15), straight(40), GROUND];
const spiralApproach = () => [GROUND, FLIGHT_10MIN, straight(30), turn(60), straight(30), GROUND];
const igcFile = (phases) => new File([buildIgc(phases)], 'vol.igc');

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

describe('logbook: landing approach read from the imported trace', () => {
    it('fills the approach of a new session and says why', async () => {
        setup();
        await LogbookView._processFiles([igcFile(uApproach())]);
        expect($('lb-prise-terrain').value).toBe('En U');
        expect($('lb-learned-summary').textContent).toContain('prise de terrain (forme de la dernière descente');
    });

    it('leaves the field empty when the trace is ambiguous', async () => {
        setup();
        await LogbookView._processFiles([igcFile(spiralApproach())]);
        expect($('lb-prise-terrain').value).toBe('');
    });

    it('keeps the approach the pilot chose before importing', async () => {
        setup();
        $('lb-prise-terrain').value = 'Directe';
        $('lb-prise-terrain').dispatchEvent(new Event('change', { bubbles: true }));
        await LogbookView._processFiles([igcFile(uApproach())]);
        expect($('lb-prise-terrain').value).toBe('Directe');
    });

    it('replaces its own suggestion when another trace is imported, and clears it if that one is ambiguous', async () => {
        setup();
        await LogbookView._processFiles([igcFile(uApproach())]);
        expect($('lb-prise-terrain').value).toBe('En U');
        await LogbookView._processFiles([igcFile(spiralApproach())]);
        expect($('lb-prise-terrain').value).toBe('');
        expect($('lb-learned-summary').textContent).not.toContain('prise de terrain');
    });

    it('does not overwrite the approach of a session being edited', () => {
        setup([
            { id: 'old', type: 'vol', datetime: '2026-09-01T10:00', site: 'Plaine', duree: 5, priseTerrain: 'En S' },
            { id: 'bare', type: 'vol', datetime: '2026-09-02T10:00', site: 'Plaine', duree: 5, priseTerrain: '' },
        ]);
        LogbookView.editEntry('old');
        LogbookView._fillFormFromIgc(IGCParser.parse(buildIgc(uApproach())));
        expect($('lb-prise-terrain').value).toBe('En S');

        // Une session sans prise de terrain enregistrée peut recevoir la suggestion de la trace
        LogbookView.editEntry('bare');
        LogbookView._fillFormFromIgc(IGCParser.parse(buildIgc(uApproach())));
        expect($('lb-prise-terrain').value).toBe('En U');
    });
});
