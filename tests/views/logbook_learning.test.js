import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import LogbookService from '../../js/services/logbook_service.js';
import SitesService from '../../js/services/sites_service.js';
import LogbookView from '../../js/views/logbook.js';

// Le formulaire d'une nouvelle session se pré-remplit d'après les habitudes du pilote.
const INDEX = readFileSync('index.html', 'utf8');
const LOGBOOK_SCREEN = ['logbook-screen', 'logbook-session-modal']
    .map((id) => {
        const tpl = document.createElement('template');
        tpl.innerHTML = INDEX.slice(INDEX.search(new RegExp(`<(div|dialog)\\s[^>]*id="${id}"`)));
        return tpl.content.getElementById(id).outerHTML;
    })
    .join('');

let n = 0;
const vol = (site, extra = {}) => ({
    id: `v${n++}`,
    type: 'vol',
    datetime: `2026-09-${String(28 - n).padStart(2, '0')}T12:00`,
    site,
    duree: 10,
    typeVol: 'Soaring',
    techDecollage: 'Face voile',
    voile: 'Voile côte',
    sellette: 'Sellette',
    ecole: '',
    ...extra,
});
const winch = () =>
    vol('ANTIN', { typeVol: 'Treuil', techDecollage: 'Dos voile', voile: 'Voile école', ecole: 'FIL D’ARIANE' });
const $ = (id) => /** @type {HTMLInputElement} */ (document.getElementById(id));
const change = (id, value) => {
    $(id).value = value;
    $(id).dispatchEvent(new Event('change', { bubbles: true }));
};

function setup(flights) {
    LogbookService.flights = flights;
    LogbookService.equipment = ['Voile côte', 'Voile école', 'Sellette'].map((nom, i) => ({
        id: `e${i}`,
        nom,
        type: nom.startsWith('Voile') ? 'voile' : 'sellette',
        statut: 'actif',
    }));
    LogbookView.currentFormType = 'vol';
    document.body.innerHTML = `${LOGBOOK_SCREEN}<input type="file" id="global-igc-input">`;
    LogbookView.setupEventListeners();
    LogbookView.resetForm();
}

beforeEach(() => {
    n = 0;
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

describe('logbook: the form learns from the pilot', () => {
    const history = () => [winch(), winch(), ...Array.from({ length: 10 }, () => vol('WISSANT'))];

    it('applies the habits of the site the pilot types', () => {
        setup(history());
        change('lb-site', 'Antin');
        expect($('lb-typeVol').value).toBe('Treuil');
        expect($('lb-tech-decollage').value).toBe('Dos voile');
        expect($('lb-voile').value).toBe('Voile école');
        expect($('lb-ecole-check').checked).toBe(true);
        expect($('lb-ecole').value).toBe('FIL D’ARIANE');
        expect($('lb-learned-summary').textContent).toContain('voile (utilisée la dernière fois ici)');

        change('lb-site', 'Wissant');
        expect($('lb-typeVol').value).toBe('Soaring');
        expect($('lb-tech-decollage').value).toBe('Face voile');
        expect($('lb-voile').value).toBe('Voile côte');
        expect($('lb-ecole-check').checked).toBe(false); // l'école proposée pour Antin est retirée
    });

    it('never overrides what the pilot chose', () => {
        setup(history());
        change('lb-tech-decollage', 'Face voile');
        change('lb-site', 'Antin');
        expect($('lb-typeVol').value).toBe('Treuil');
        expect($('lb-tech-decollage').value).toBe('Face voile');
        expect($('lb-learned-summary').textContent).not.toContain('technique');
    });

    it('at the winch, suggests back-facing for a pilot who always launches forward elsewhere', () => {
        setup(Array.from({ length: 10 }, () => vol('WISSANT')));
        change('lb-typeVol', 'Treuil');
        expect($('lb-tech-decollage').value).toBe('Dos voile');
        expect($('lb-learned-summary').textContent).toContain('au treuil, on décolle presque toujours dos voile');
    });

    it('a winch launch found in the trace wins over the habits, and brings back-facing with it', async () => {
        setup(Array.from({ length: 10 }, () => vol('WISSANT')));
        const igc = new File([readFileSync('tests/fixtures/syride-2026-10-03.igc', 'utf8')], 'f.igc');
        await LogbookView._processFiles([igc]);
        expect($('lb-typeVol').value).toBe('Treuil');
        expect($('lb-tech-decollage').value).toBe('Dos voile');
        expect($('lb-learned-summary').textContent).toContain('départ au treuil détecté dans la trace');
    });

    it('never fills the empty fields of a session being edited', () => {
        setup([...history(), vol('ANTIN', { id: 'old', voile: '', sellette: '', techDecollage: '', ecole: '' })]);
        LogbookView.editEntry('old');
        expect($('lb-voile').value).toBe('');
        expect($('lb-ecole-check').checked).toBe(false);
        expect($('lb-learned-summary').hidden).toBe(true);
    });

    it('lists the sites the pilot goes to most at the top of the suggestions', () => {
        SitesService.getSites.mockReturnValue([{ nom: 'AAA PREMIER ALPHABÉTIQUE', affiche: true }]);
        setup(history());
        const options = Array.from(document.querySelectorAll('#sites-list option')).map(
            (o) => /** @type {HTMLOptionElement} */ (o).value,
        );
        expect(options).toEqual(['WISSANT', 'ANTIN', 'AAA PREMIER ALPHABÉTIQUE']);
    });

    it('fills the usual ground handling place', () => {
        const ground = (lieu) => ({ id: `g${n++}`, type: 'gonflage', datetime: '2026-09-01T10:00', lieu, duree: 30 });
        setup([ground('Pente école'), ground('Pente école'), ground('Plage')]);
        LogbookView.setFormType('gonflage');
        expect($('lb-lieu').value).toBe('Pente école');
    });
});
