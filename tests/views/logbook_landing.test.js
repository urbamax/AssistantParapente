import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import LogbookService from '../../js/services/logbook_service.js';
import SitesService from '../../js/services/sites_service.js';
import LogbookView from '../../js/views/logbook.js';

// Prise de terrain et vache d'un vol : saisie, réédition et carte de l'historique.
const INDEX = readFileSync('index.html', 'utf8');
const LOGBOOK_SCREEN = ['logbook-screen', 'logbook-session-modal']
    .map((id) => {
        const tpl = document.createElement('template');
        tpl.innerHTML = INDEX.slice(INDEX.search(new RegExp(`<(div|dialog)\\s[^>]*id="${id}"`)));
        return tpl.content.getElementById(id).outerHTML;
    })
    .join('');

const $ = (id) => /** @type {HTMLInputElement} */ (document.getElementById(id));
const change = (id, value) => {
    $(id).value = value;
    $(id).dispatchEvent(new Event('change', { bubbles: true }));
};
const toggle = (id, checked) => {
    $(id).checked = checked;
    $(id).dispatchEvent(new Event('change', { bubbles: true }));
};
const history = () => document.getElementById('logbook-history-list')?.innerHTML ?? '';
const lastFlight = () => LogbookService.getFlights()[0];

function setup() {
    LogbookService.flights = [];
    LogbookService.equipment = [{ id: 'e0', nom: 'Voile école', type: 'voile', statut: 'actif' }];
    LogbookView.currentFormType = 'vol';
    document.body.innerHTML = `${LOGBOOK_SCREEN}<input type="file" id="global-igc-input">`;
    LogbookView.setupEventListeners();
    LogbookView.populateEquipmentDropdowns?.();
    LogbookView.resetForm();
    $('lb-site').value = 'Plaine';
    $('lb-voile').value = 'Voile école';
    $('lb-duree').value = '5';
}

beforeEach(() => {
    localStorage.clear();
    Element.prototype.scrollIntoView = () => {};
    vi.spyOn(SitesService, 'getSites').mockReturnValue([]);
    vi.spyOn(SitesService, 'ensureSitesLoaded').mockResolvedValue(undefined);
    vi.spyOn(LogbookService, 'saveFlights').mockImplementation(() => {});
    vi.spyOn(LogbookView, 'fetchWeatherForSession').mockResolvedValue(undefined);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('logbook: landing approach and landed-out flag', () => {
    it('are empty and unchecked by default', () => {
        setup();
        LogbookView.submitForm();
        expect(lastFlight().priseTerrain).toBe('');
        expect(lastFlight().vache).toBe(false);
        LogbookView.renderHistory();
        expect(history()).not.toContain('Prise de terrain');
        expect(history()).not.toContain('Vaché');
    });

    it('are saved, shown on the card and restored when editing', () => {
        setup();
        change('lb-prise-terrain', 'En S');
        toggle('lb-vache', true);
        LogbookView.submitForm();

        expect(lastFlight().priseTerrain).toBe('En S');
        expect(lastFlight().vache).toBe(true);
        LogbookView.renderHistory();
        expect(history()).toContain('Prise de terrain : En S');
        expect(history()).toContain('Vaché');

        LogbookView.editEntry(lastFlight().id);
        expect($('lb-prise-terrain').value).toBe('En S');
        expect($('lb-vache').checked).toBe(true);
    });

    it('remembers a custom approach typed under "Autre" for the next flights', () => {
        setup();
        change('lb-prise-terrain', 'Autre');
        $('lb-prise-terrain-autre').value = 'en zigzag';
        LogbookView.submitForm();

        expect(lastFlight().priseTerrain).toBe('En zigzag');
        LogbookView.resetForm();
        expect([...$('lb-prise-terrain').options].map((o) => o.value)).toContain('En zigzag');
    });
});
