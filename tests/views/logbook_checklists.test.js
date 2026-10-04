import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import LogbookService from '../../js/services/logbook_service.js';
import SitesService from '../../js/services/sites_service.js';
import LogbookView from '../../js/views/logbook.js';

// Exercices d'une session en école et pilotes avec qui on a volé : listes à cocher, complétées à
// la main, et dont les valeurs ajoutées sont reproposées sur les sessions suivantes.
const INDEX = readFileSync('index.html', 'utf8');
const LOGBOOK_SCREEN = ['logbook-screen', 'logbook-session-modal']
    .map((id) => {
        const tpl = document.createElement('template');
        tpl.innerHTML = INDEX.slice(INDEX.search(new RegExp(`<(div|dialog)\\s[^>]*id="${id}"`)));
        return tpl.content.getElementById(id).outerHTML;
    })
    .join('');

const $ = (id) => /** @type {HTMLInputElement} */ (document.getElementById(id));
// Valeurs proposées dans la liste déroulante du champ « Ajouter »
const options = (name) => LogbookView.getChecklistOptions(name);

function fillFlight() {
    $('lb-site').value = 'Mont Lambert';
    const wing = /** @type {HTMLSelectElement} */ (document.getElementById('lb-voile'));
    wing.innerHTML = '<option value="Ma voile">Ma voile</option>';
    wing.value = 'Ma voile';
    $('lb-duree').value = '30';
}

function addItem(name, value, { enter = false } = {}) {
    $(`lb-${name}-new`).value = value;
    if (enter) {
        $(`lb-${name}-new`).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    } else {
        LogbookView.addChecklistItem(name);
    }
}

function checkSchool() {
    $('lb-ecole-check').checked = true;
    $('lb-ecole-check').dispatchEvent(new Event('change', { bubbles: true }));
    $('lb-ecole').value = 'ÉCOLE TEST';
}

beforeEach(() => {
    localStorage.clear();
    Element.prototype.scrollIntoView = () => {};
    vi.spyOn(SitesService, 'getSites').mockReturnValue([]);
    vi.spyOn(SitesService, 'ensureSitesLoaded').mockResolvedValue(undefined);
    vi.spyOn(LogbookService, 'saveFlights').mockImplementation(() => {});
    vi.spyOn(LogbookView, 'fetchWeatherForSession').mockResolvedValue(undefined);
    LogbookService.flights = [];
    LogbookView.currentFormType = 'vol';
    document.body.innerHTML = `${LOGBOOK_SCREEN}<input type="file" id="global-igc-input">`;
    LogbookView.setupEventListeners();
    LogbookView.renderForm();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('logbook: exercises of a school flight', () => {
    it('saves the ticked and added exercises, and offers the new one next time', () => {
        fillFlight();
        checkSchool();
        addItem('typeExercice', 'Oreilles');
        addItem('typeExercice', 'Wingover', { enter: true });
        LogbookView.submitForm();

        expect(LogbookService.getFlights()[0].typeExercice).toEqual(['Oreilles', 'Wingover']);
        LogbookView.renderForm();
        expect(options('typeExercice')).toContain('Wingover');
    });

    it('does not keep exercises on a flight that is not a school session', () => {
        fillFlight();
        checkSchool();
        addItem('typeExercice', 'Wingover');
        $('lb-ecole-check').checked = false;
        $('lb-ecole-check').dispatchEvent(new Event('change', { bubbles: true }));
        LogbookView.submitForm();
        expect(LogbookService.getFlights()[0].typeExercice).toEqual([]);
    });

    it('picks an existing exercise instead of duplicating it, and only once', () => {
        addItem('typeExercice', 'oreilles');
        addItem('typeExercice', 'OREILLES');
        expect(options('typeExercice').filter((v) => v.toLowerCase() === 'oreilles')).toHaveLength(1);
        expect(LogbookView.getChecklistValues('typeExercice')).toEqual(['Oreilles']);
    });

    it('shows the chosen values as tags that can be removed', () => {
        addItem('typeExercice', 'Oreilles');
        addItem('typeExercice', 'Wingover');
        const chips = document.querySelectorAll('#lb-typeExercice-group .lb-chip');
        expect(Array.from(chips).map((c) => c.textContent.trim())).toEqual(['Oreilles', 'Wingover']);
        /** @type {HTMLElement} */ (chips[0].querySelector('.lb-chip-remove')).click();
        expect(LogbookView.getChecklistValues('typeExercice')).toEqual(['Wingover']);
    });

    it('adds a value picked in the dropdown list right away', () => {
        $('lb-typeExercice-new').value = 'Accélérateur';
        $('lb-typeExercice-new').dispatchEvent(new Event('input', { bubbles: true })); // choix dans la liste
        expect(LogbookView.getChecklistValues('typeExercice')).toEqual(['Accélérateur']);
        expect($('lb-typeExercice-new').value).toBe('');
    });
});

describe('logbook: pilots flown with', () => {
    it('are offered on every session, school or not, and build up a list', () => {
        fillFlight();
        addItem('pilotes', 'Julie');
        addItem('pilotes', 'Marc');
        LogbookView.submitForm();
        expect(LogbookService.getFlights()[0].pilotes).toEqual(['Julie', 'Marc']);
        expect(LogbookService.getFlights()[0].ecole).toBe('');

        LogbookView.setFormType('gonflage');
        expect(options('pilotes')).toEqual(['Julie', 'Marc']);
        expect(LogbookView.getChecklistValues('pilotes')).toEqual([]);
    });

    it('are ticked again when editing, and shown on the card', () => {
        LogbookService.flights = [
            {
                id: 'f1',
                type: 'vol',
                datetime: '2026-07-01T12:06',
                site: 'Plaine',
                voile: 'V',
                duree: 5,
                pilotes: ['Léa <b>'],
            },
        ];
        LogbookView.renderForm();
        LogbookView.editEntry('f1');
        expect(LogbookView.getChecklistValues('pilotes')).toEqual(['Léa <b>']);

        LogbookView.renderHistory();
        const card = document.getElementById('logbook-history-list')?.innerHTML || '';
        expect(card).toContain('Pilotes :');
        expect(card).toContain('Léa &lt;b&gt;');
    });

    it('keeps the ticked pilots when switching between flight and ground handling', () => {
        addItem('pilotes', 'Julie');
        LogbookView.setFormType('gonflage');
        expect(LogbookView.getChecklistValues('pilotes')).toEqual(['Julie']);
    });
});
