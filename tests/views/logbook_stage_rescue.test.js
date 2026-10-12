import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import LogbookService from '../../js/services/logbook_service.js';
import SitesService from '../../js/services/sites_service.js';
import LogbookView from '../../js/views/logbook.js';

// Session d'école : stage (nom + spécialité). Vol : secours ouvert, repris de la sellette si elle en porte un.
const INDEX = readFileSync('index.html', 'utf8');
const LOGBOOK_SCREEN = ['logbook-screen', 'logbook-session-modal']
    .map((id) => {
        const tpl = document.createElement('template');
        tpl.innerHTML = INDEX.slice(INDEX.search(new RegExp(`<(div|dialog)\\s[^>]*id="${id}"`)));
        return tpl.content.getElementById(id).outerHTML;
    })
    .join('');

const $ = (id) => /** @type {HTMLInputElement} */ (document.getElementById(id));
const toggle = (id, checked) => {
    $(id).checked = checked;
    $(id).dispatchEvent(new Event('change', { bubbles: true }));
};
const choose = (id, value) => {
    $(id).value = value;
    $(id).dispatchEvent(new Event('change', { bubbles: true }));
};
const history = () => {
    LogbookView.renderHistory();
    return document.getElementById('logbook-history-list')?.textContent ?? '';
};
const lastFlight = () => LogbookService.getFlights()[0];

function setup() {
    LogbookService.flights = [];
    LogbookService.equipment = [
        { id: 'v1', nom: 'Voile', type: 'voile', statut: 'actif' },
        { id: 'h1', nom: 'Sellette', type: 'sellette', statut: 'actif', linkedRescueId: 's1' },
        { id: 's1', nom: 'Secours A', type: 'secours', statut: 'actif' },
        { id: 's2', nom: 'Secours B', type: 'secours', statut: 'actif' },
    ];
    LogbookView.currentFormType = 'vol';
    document.body.innerHTML = `${LOGBOOK_SCREEN}<input type="file" id="global-igc-input">`;
    LogbookView.setupEventListeners();
    LogbookView.populateEquipmentDropdowns();
    LogbookView.resetForm();
    $('lb-site').value = 'Plaine';
    $('lb-duree').value = '5';
    $('lb-voile').value = 'Voile';
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

describe('logbook: course of a school session', () => {
    const fillSchool = () => {
        toggle('lb-ecole-check', true);
        $('lb-ecole').value = 'ÉCOLE TEST';
    };

    it('shows the course fields only when the box is checked', () => {
        setup();
        expect($('lb-stage-group').hidden).toBe(true);
        toggle('lb-stage-check', true);
        expect($('lb-stage-group').hidden).toBe(false);
    });

    it('is saved, shown in the history and reloaded when editing', () => {
        setup();
        fillSchool();
        toggle('lb-stage-check', true);
        $('lb-stage-nom').value = 'Stage été';
        $('lb-stage-specialite').value = 'SIV';
        LogbookView.submitForm();

        expect(lastFlight()).toMatchObject({ stageName: 'Stage été', stageSpecialty: 'SIV' });
        expect(history()).toContain('Stage été | ÉCOLE TEST');
        expect(history()).toContain('Spécialité : SIV');

        LogbookView.editEntry(lastFlight().id);
        expect($('lb-stage-check').checked).toBe(true);
        expect($('lb-stage-group').hidden).toBe(false);
        expect($('lb-stage-nom').value).toBe('Stage été');
        expect($('lb-stage-specialite').value).toBe('SIV');
    });

    it('is not kept when the course box is unchecked', () => {
        setup();
        fillSchool();
        $('lb-stage-nom').value = 'Stage été';
        LogbookView.submitForm();
        expect(lastFlight()).toMatchObject({ stageName: '', stageSpecialty: '' });
    });

    it('is not kept without a school', () => {
        setup();
        toggle('lb-stage-check', true);
        $('lb-stage-nom').value = 'Stage été';
        LogbookView.submitForm();
        expect(lastFlight()).toMatchObject({ stageName: '', stageSpecialty: '' });
    });
});

describe('logbook: rescue deployed during a flight', () => {
    it('lists the rescues of the equipment and shows the choice only when checked', () => {
        setup();
        expect($('lb-rescue-group').hidden).toBe(true);
        toggle('lb-rescue-check', true);
        expect($('lb-rescue-group').hidden).toBe(false);
        const values = Array.from($('lb-rescue').querySelectorAll('option')).map((o) => o.value);
        expect(values).toEqual(['', 'Secours A', 'Secours B', 'Autre']);
    });

    it('is saved, shown in the history and reloaded when editing', () => {
        setup();
        toggle('lb-rescue-check', true);
        $('lb-rescue').value = 'Secours B';
        LogbookView.submitForm();

        expect(lastFlight()).toMatchObject({ rescueDeployed: true, rescueId: 'Secours B' });
        expect(history()).toContain('Secours ouvert');
        expect(history()).toContain('Secours B');

        LogbookView.editEntry(lastFlight().id);
        expect($('lb-rescue-check').checked).toBe(true);
        expect($('lb-rescue-group').hidden).toBe(false);
        expect($('lb-rescue').value).toBe('Secours B');
    });

    it('is not recorded when the box is unchecked', () => {
        setup();
        $('lb-rescue').value = 'Secours B';
        LogbookView.submitForm();
        expect(lastFlight()).toMatchObject({ rescueDeployed: false, rescueId: '' });
        expect(history()).not.toContain('Secours ouvert');
    });

    it('preselects the rescue mounted on the chosen harness', () => {
        setup();
        toggle('lb-rescue-check', true);
        choose('lb-sellette', 'Sellette');
        expect($('lb-rescue').value).toBe('Secours A');
    });

    it('does not override the rescue when the harness has none', () => {
        setup();
        LogbookService.equipment[1].linkedRescueId = null;
        toggle('lb-rescue-check', true);
        $('lb-rescue').value = 'Secours B';
        choose('lb-sellette', 'Sellette');
        expect($('lb-rescue').value).toBe('Secours B');
    });
});

describe('equipment: a rescue that was opened', () => {
    const card = () => document.querySelector('.equip-card.status-danger');

    it('shows the number of openings and is in default until it is repacked', () => {
        setup();
        toggle('lb-rescue-check', true);
        $('lb-rescue').value = 'Secours B';
        LogbookView.submitForm();

        LogbookView.renderEquipment();
        expect(card()?.textContent).toContain('Secours ouvert le');
        expect(card()?.textContent).toContain('Ouvertures : 1');

        LogbookService.equipment.find((e) => e.id === 's2').derniereRevision = '2999-01-01';
        LogbookView.renderEquipment();
        expect(card()).toBeNull();
        expect(document.body.textContent).toContain('Ouvertures : 1');
    });
});
