import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import LogbookService from '../../js/services/logbook_service.js';
import SitesService from '../../js/services/sites_service.js';
import LogbookView from '../../js/views/logbook.js';

// A logbook session can be marked as taught by a school, with the school's name.
const INDEX = readFileSync('index.html', 'utf8');
// Le formulaire d'ajout / modification vit dans sa fenêtre (#logbook-session-modal), hors de l'écran.
const LOGBOOK_SCREEN = ['logbook-screen', 'logbook-session-modal']
    .map((id) => {
        const tpl = document.createElement('template');
        tpl.innerHTML = INDEX.slice(INDEX.search(new RegExp(`<(div|dialog)\\s[^>]*id="${id}"`)));
        return tpl.content.getElementById(id).outerHTML;
    })
    .join('');

const GROUND = {
    id: 'g1',
    type: 'gonflage',
    datetime: '2026-09-18T18:00',
    lieu: 'Pente école',
    voile: 'Ma voile',
    duree: 45,
    typeExercice: [],
    ecole: 'École <b>du Vent</b>',
};

const $ = (id) => /** @type {HTMLInputElement} */ (document.getElementById(id));

function fillFlight() {
    $('lb-site').value = 'Mont Lambert';
    const wing = /** @type {HTMLSelectElement} */ (document.getElementById('lb-voile'));
    wing.innerHTML = '<option value="Ma voile">Ma voile</option>';
    wing.value = 'Ma voile';
    $('lb-duree').value = '30';
}

function checkSchool(checked) {
    $('lb-ecole-check').checked = checked;
    $('lb-ecole-check').dispatchEvent(new Event('change', { bubbles: true }));
}

beforeEach(() => {
    localStorage.clear();
    Element.prototype.scrollIntoView = () => {};
    vi.spyOn(SitesService, 'getSites').mockReturnValue([]);
    vi.spyOn(SitesService, 'ensureSitesLoaded').mockResolvedValue(undefined);
    vi.spyOn(LogbookService, 'saveFlights').mockImplementation(() => {});
    vi.spyOn(LogbookView, 'fetchWeatherForSession').mockResolvedValue(undefined);
    LogbookService.flights = [structuredClone(GROUND)];
    LogbookView.currentFormType = 'vol';
    document.body.innerHTML = `${LOGBOOK_SCREEN}<input type="file" id="global-igc-input">`;
    LogbookView.setupEventListeners();
    LogbookView.renderForm();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('logbook: session taught by a school', () => {
    it('asks for the school name only when the box is ticked', () => {
        expect($('lb-ecole-group').hidden).toBe(true);
        expect($('lb-ecole').required).toBe(false);
        checkSchool(true);
        expect($('lb-ecole-group').hidden).toBe(false);
        expect($('lb-ecole').required).toBe(true);
        checkSchool(false);
        expect($('lb-ecole-group').hidden).toBe(true);
        expect($('lb-ecole').required).toBe(false);
    });

    it('suggests the schools already used in the logbook', () => {
        const options = Array.from(document.querySelectorAll('#ecoles-list option')).map(
            (o) => /** @type {HTMLOptionElement} */ (o).value,
        );
        expect(options).toEqual(['École <b>du Vent</b>']);
    });

    it('saves the school name with the session', () => {
        fillFlight();
        checkSchool(true);
        $('lb-ecole').value = '  Air École  ';
        LogbookView.submitForm();
        expect(LogbookService.flights.find((f) => f.type === 'vol').ecole).toBe('Air École');
    });

    it('saves no school when the box is not ticked, even with a name typed', () => {
        fillFlight();
        checkSchool(true);
        $('lb-ecole').value = 'Air École';
        checkSchool(false);
        LogbookView.submitForm();
        expect(LogbookService.flights.find((f) => f.type === 'vol').ecole).toBe('');
    });

    it('shows the school when editing and clears it when unticked', () => {
        LogbookView.editEntry('g1');
        expect($('lb-ecole-check').checked).toBe(true);
        expect($('lb-ecole').value).toBe('École <b>du Vent</b>');
        checkSchool(false);
        LogbookView.submitForm();
        expect(LogbookService.getFlightById('g1').ecole).toBe('');
    });

    it('keeps the school when switching between flight and ground handling', () => {
        checkSchool(true);
        $('lb-ecole').value = 'Air École';
        LogbookView.setFormType('gonflage');
        expect($('lb-ecole-check').checked).toBe(true);
        expect($('lb-ecole').value).toBe('Air École');
    });

    it('shows the school on the history card, escaped', () => {
        LogbookView.renderHistory();
        const card = document.getElementById('logbook-history-list');
        expect(card.textContent).toContain('École : École <b>du Vent</b>');
        expect(card.querySelector('b')).toBeNull();
    });
});

describe('logbook statistics: sessions taught by a school', () => {
    it('counts flights and ground handling sessions per school, escaped', () => {
        LogbookService.flights.push(
            { id: 'v1', type: 'vol', datetime: '2026-09-19T12:00', site: 'A', duree: 30, ecole: 'Air École' },
            { id: 'v2', type: 'vol', datetime: '2026-09-20T12:00', site: 'A', duree: 20, ecole: 'Air École' },
            { id: 'v3', type: 'vol', datetime: '2026-09-21T12:00', site: 'A', duree: 10, ecole: '' },
        );
        LogbookView.renderStats();
        const stats = document.getElementById('logbook-stats-container');
        expect(stats.textContent).toContain('Sessions en école');
        expect(stats.textContent).toContain('3 sessions en école sur 4 au total');
        const cards = Array.from(stats.querySelectorAll('.equip-card')).filter((c) =>
            ['Air École', 'École <b>du Vent</b>'].includes(c.querySelector('.equip-name').textContent),
        );
        // Most frequented school first
        expect(cards.map((c) => c.querySelector('.equip-name').textContent)).toEqual([
            'Air École',
            'École <b>du Vent</b>',
        ]);
        expect(cards[0].textContent).toContain('Vols: 2');
        expect(cards[1].textContent).toContain('Gonflage: 1');
        expect(stats.querySelector('b')).toBeNull();
    });

    it('shows no school section when no session was taught by a school', () => {
        LogbookService.flights = [{ ...structuredClone(GROUND), ecole: '' }];
        LogbookView.renderStats();
        expect(document.getElementById('logbook-stats-container').textContent).not.toContain('Sessions en école');
    });
});
