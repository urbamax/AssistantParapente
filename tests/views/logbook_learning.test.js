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
    vol('PLAINE', { typeVol: 'Treuil', techDecollage: 'Dos voile', voile: 'Voile école', ecole: 'ÉCOLE TEST' });
const $ = (id) => /** @type {HTMLInputElement} */ (document.getElementById(id));
const change = (id, value) => {
    $(id).value = value;
    $(id).dispatchEvent(new Event('change', { bubbles: true }));
};
const addCompanion = (name) => {
    $('lb-accompagnateur-new').value = name;
    LogbookView.addChecklistItem('accompagnateur');
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
    const history = () => [winch(), winch(), ...Array.from({ length: 10 }, () => vol('DUNE'))];

    it('applies the habits of the site the pilot types', () => {
        setup(history());
        change('lb-site', 'Plaine');
        expect($('lb-typeVol').value).toBe('Treuil');
        expect($('lb-tech-decollage').value).toBe('Dos voile');
        expect($('lb-voile').value).toBe('Voile école');
        expect($('lb-ecole-check').checked).toBe(true);
        expect($('lb-ecole').value).toBe('ÉCOLE TEST');
        expect($('lb-learned-summary').textContent).toContain('voile (utilisée la dernière fois ici)');

        change('lb-site', 'Dune');
        expect($('lb-typeVol').value).toBe('Soaring');
        expect($('lb-tech-decollage').value).toBe('Face voile');
        expect($('lb-voile').value).toBe('Voile côte');
        expect($('lb-ecole-check').checked).toBe(false); // l'école proposée pour Plaine est retirée
    });

    it('never overrides what the pilot chose', () => {
        setup(history());
        change('lb-tech-decollage', 'Face voile');
        change('lb-site', 'Plaine');
        expect($('lb-typeVol').value).toBe('Treuil');
        expect($('lb-tech-decollage').value).toBe('Face voile');
        expect($('lb-learned-summary').textContent).not.toContain('technique');
    });

    it('at the winch, suggests back-facing for a pilot who always launches forward elsewhere', () => {
        setup(Array.from({ length: 10 }, () => vol('DUNE')));
        change('lb-typeVol', 'Treuil');
        expect($('lb-tech-decollage').value).toBe('Dos voile');
        expect($('lb-learned-summary').textContent).toContain('au treuil, on décolle presque toujours dos voile');
    });

    it('a winch launch found in the trace wins over the habits, and brings back-facing with it', async () => {
        setup(Array.from({ length: 10 }, () => vol('DUNE')));
        const igc = new File([readFileSync('tests/fixtures/syride-winch-flight.igc', 'utf8')], 'f.igc');
        await LogbookView._processFiles([igc]);
        expect($('lb-typeVol').value).toBe('Treuil');
        expect($('lb-tech-decollage').value).toBe('Dos voile');
        expect($('lb-learned-summary').textContent).toContain('départ au treuil détecté dans la trace');
    });

    it('never fills the empty fields of a session being edited', () => {
        setup([...history(), vol('PLAINE', { id: 'old', voile: '', sellette: '', techDecollage: '', ecole: '' })]);
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
        expect(options).toEqual(['DUNE', 'PLAINE', 'AAA PREMIER ALPHABÉTIQUE']);
    });

    it('pre-selects the pilots of a session less than 3 hours away on the same site', () => {
        const earlier = vol('PLAINE', { datetime: '2026-10-03T12:06', pilotes: ['Gilbert', 'Julie'] });
        const otherDay = vol('PLAINE', { datetime: '2026-09-20T12:00', pilotes: ['Marc'] });
        setup([earlier, otherDay]);
        change('lb-datetime', '2026-10-03T13:57');
        change('lb-site', 'Plaine');
        expect(LogbookView.getChecklistValues('pilotes')).toEqual(['Gilbert', 'Julie']);
        expect($('lb-learned-summary').textContent).toContain('pilotes (comme ta session de moins de 3 h ici)');

        // Plus de 3 h plus tard : plus de pré-sélection
        change('lb-datetime', '2026-10-03T17:30');
        expect(LogbookView.getChecklistValues('pilotes')).toEqual([]);
        // Autre site
        change('lb-datetime', '2026-10-03T13:57');
        change('lb-site', 'Dune');
        expect(LogbookView.getChecklistValues('pilotes')).toEqual([]);
    });

    it('stops pre-selecting pilots once the pilot edits the list', () => {
        setup([vol('PLAINE', { datetime: '2026-10-03T12:06', pilotes: ['Gilbert', 'Julie'] })]);
        change('lb-datetime', '2026-10-03T13:57');
        change('lb-site', 'Plaine');
        /** @type {HTMLElement} */ (document.querySelector('#lb-pilotes-group .lb-chip-remove')).click();
        expect(LogbookView.getChecklistValues('pilotes')).toEqual(['Julie']);
        change('lb-site', 'Dune');
        change('lb-site', 'Plaine');
        expect(LogbookView.getChecklistValues('pilotes')).toEqual(['Julie']);
    });

    it('fills the usual ground handling place', () => {
        const ground = (lieu) => ({ id: `g${n++}`, type: 'gonflage', datetime: '2026-09-01T10:00', lieu, duree: 30 });
        setup([ground('Pente école'), ground('Pente école'), ground('Plage')]);
        LogbookView.setFormType('gonflage');
        expect($('lb-lieu').value).toBe('Pente école');
    });
});

describe('logbook: instructor of a school session', () => {
    it('is saved with the school, proposed again, and shown on the card', () => {
        setup([]);
        $('lb-site').value = 'Plaine';
        const wing = /** @type {HTMLSelectElement} */ (document.getElementById('lb-voile'));
        wing.value = 'Voile école';
        $('lb-duree').value = '5';
        $('lb-ecole-check').checked = true;
        $('lb-ecole-check').dispatchEvent(new Event('change', { bubbles: true }));
        $('lb-ecole').value = 'ÉCOLE TEST';
        $('lb-moniteur').value = 'Gilbert';
        LogbookView.submitForm();
        expect(LogbookService.getFlights()[0]).toMatchObject({ ecole: 'ÉCOLE TEST', moniteur: 'Gilbert' });

        LogbookView.renderHistory();
        expect(document.getElementById('logbook-history-list')?.innerHTML).toContain('Moniteur :</strong> Gilbert');

        // Nouvelle session au même endroit : école et moniteur proposés
        LogbookView.resetForm();
        change('lb-site', 'Plaine');
        expect($('lb-ecole-check').checked).toBe(true);
        expect($('lb-moniteur').value).toBe('Gilbert');
        const options = Array.from(document.querySelectorAll('#moniteurs-list option')).map(
            (o) => /** @type {HTMLOptionElement} */ (o).value,
        );
        expect(options).toEqual(['Gilbert']);
    });

    it('has companions under the instructor, saved and proposed like him', () => {
        setup([]);
        $('lb-site').value = 'Plaine';
        $('lb-datetime').value = '2026-10-03T12:06';
        /** @type {HTMLSelectElement} */ (document.getElementById('lb-voile')).value = 'Voile école';
        $('lb-duree').value = '5';
        $('lb-ecole-check').checked = true;
        $('lb-ecole-check').dispatchEvent(new Event('change', { bubbles: true }));
        $('lb-ecole').value = 'ÉCOLE TEST';
        $('lb-moniteur').value = 'Gilbert';
        addCompanion('Sophie');
        addCompanion('Jérémie');
        LogbookView.submitForm();
        expect(LogbookService.getFlights()[0]).toMatchObject({
            moniteur: 'Gilbert',
            accompagnateur: ['Sophie', 'Jérémie'],
        });
        LogbookView.renderHistory();
        expect(document.getElementById('logbook-history-list')?.innerHTML).toContain(
            'Accompagnateurs :</strong> Sophie, Jérémie',
        );

        // Vol suivant, même site, 1 h plus tard : mêmes accompagnateurs
        LogbookView.resetForm();
        change('lb-datetime', '2026-10-03T13:06');
        change('lb-site', 'Plaine');
        expect(LogbookView.getChecklistValues('accompagnateur')).toEqual(['Sophie', 'Jérémie']);
    });

    it('reads the single companion of older sessions', () => {
        const old = {
            id: 'old',
            type: 'vol',
            datetime: '2026-09-01T10:00',
            site: 'Plaine',
            duree: 5,
            ecole: 'ÉCOLE TEST',
            moniteur: 'Gilbert',
            accompagnateur: 'Sophie',
            voile: 'Voile école',
        };
        setup([old]);
        LogbookView.renderHistory();
        expect(document.getElementById('logbook-history-list')?.innerHTML).toContain(
            'Accompagnateurs :</strong> Sophie',
        );
        LogbookView.editEntry('old');
        expect(LogbookView.getChecklistValues('accompagnateur')).toEqual(['Sophie']);
        // Nom tapé sans cliquer sur « Ajouter » : gardé à l'enregistrement
        $('lb-accompagnateur-new').value = 'Jérémie';
        LogbookView.submitForm();
        expect(LogbookService.getFlights()[0].accompagnateur).toEqual(['Sophie', 'Jérémie']);
    });

    it('is not kept without a school', () => {
        setup([]);
        $('lb-site').value = 'Plaine';
        /** @type {HTMLSelectElement} */ (document.getElementById('lb-voile')).value = 'Voile école';
        $('lb-duree').value = '5';
        $('lb-moniteur').value = 'Gilbert';
        addCompanion('Sophie');
        LogbookView.submitForm();
        expect(LogbookService.getFlights()[0].moniteur).toBe('');
        expect(LogbookService.getFlights()[0].accompagnateur).toEqual([]);
    });
});

describe('logbook: winch operator of a winch flight', () => {
    it('is asked only for a winch flight, saved, proposed again and shown on the card', () => {
        setup([]);
        expect(/** @type {HTMLElement} */ (document.getElementById('lb-treuilleur-group')).hidden).toBe(true);
        change('lb-typeVol', 'Treuil');
        expect(/** @type {HTMLElement} */ (document.getElementById('lb-treuilleur-group')).hidden).toBe(false);

        $('lb-site').value = 'Plaine';
        $('lb-datetime').value = '2026-10-03T12:06';
        /** @type {HTMLSelectElement} */ (document.getElementById('lb-voile')).value = 'Voile école';
        $('lb-duree').value = '5';
        $('lb-treuilleur').value = 'Bruno';
        LogbookView.submitForm();
        expect(LogbookService.getFlights()[0]).toMatchObject({ typeVol: 'Treuil', treuilleur: 'Bruno' });
        LogbookView.renderHistory();
        expect(document.getElementById('logbook-history-list')?.innerHTML).toContain('Treuilleur :</strong> Bruno');

        // Vol suivant au treuil, même site, 2 h plus tard : pas de pré-remplissage (souvent
        // plusieurs treuilleurs le même jour), mais ceux du jour en tête de la liste
        LogbookService.flights.push(
            ...[1, 2, 3].map((k) => ({
                ...vol('PLAINE', { typeVol: 'Treuil', treuilleur: 'Claude' }),
                datetime: `2026-09-0${k}T10:00`,
            })),
        );
        LogbookView.resetForm();
        change('lb-datetime', '2026-10-03T14:00');
        change('lb-site', 'Plaine');
        expect($('lb-typeVol').value).toBe('Treuil');
        expect($('lb-treuilleur').value).toBe('');
        const listed = () =>
            Array.from(document.querySelectorAll('#treuilleurs-list option')).map(
                (o) => /** @type {HTMLOptionElement} */ (o).value,
            );
        expect(listed()).toEqual(['Bruno', 'Claude']);
        // Un autre jour : le plus fréquent d'abord
        change('lb-datetime', '2026-10-10T14:00');
        expect(listed()).toEqual(['Claude', 'Bruno']);
    });

    it('is not kept on a flight that is not a winch flight', () => {
        setup([]);
        $('lb-site').value = 'Dune';
        /** @type {HTMLSelectElement} */ (document.getElementById('lb-voile')).value = 'Voile côte';
        $('lb-duree').value = '5';
        $('lb-treuilleur').value = 'Bruno';
        LogbookView.submitForm();
        expect(LogbookService.getFlights()[0].treuilleur).toBe('');
    });
});
