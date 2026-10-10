import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import LogbookService from '../../js/services/logbook_service.js';
import SitesService from '../../js/services/sites_service.js';
import LogbookView from '../../js/views/logbook.js';
import { FR as fr } from '../../js/i18n/fr.js';

// Matériel : secours lié à la sellette, libellés « pliage » / « révision »,
// et validation du formulaire de session (message adapté au champ manquant).
const INDEX = readFileSync('index.html', 'utf8');
const LOGBOOK_SCREEN = ['logbook-screen', 'logbook-session-modal']
    .map((id) => {
        const tpl = document.createElement('template');
        tpl.innerHTML = INDEX.slice(INDEX.search(new RegExp(`<(div|dialog)\\s[^>]*id="${id}"`)));
        return tpl.content.getElementById(id).outerHTML;
    })
    .join('');

const $ = (id) => /** @type {HTMLInputElement} */ (document.getElementById(id));
const equip = (id, type, extra = {}) => ({ id, nom: `${type} ${id}`, type, statut: 'actif', ...extra });

function setup(equipment, flights = []) {
    LogbookService.flights = flights;
    LogbookService.equipment = equipment;
    LogbookView.currentFormType = 'vol';
    document.body.innerHTML = `${LOGBOOK_SCREEN}<input type="file" id="global-igc-input">`;
    LogbookView.setupEventListeners();
    LogbookView.populateEquipmentDropdowns();
    LogbookView.resetForm();
}

beforeEach(() => {
    localStorage.clear();
    Element.prototype.scrollIntoView = () => {};
    vi.spyOn(SitesService, 'getSites').mockReturnValue([]);
    vi.spyOn(SitesService, 'ensureSitesLoaded').mockResolvedValue(undefined);
    vi.spyOn(LogbookService, 'saveFlights').mockImplementation(() => {});
    vi.spyOn(LogbookService, 'saveEquipment').mockImplementation(() => {});
    vi.spyOn(LogbookView, 'fetchWeatherForSession').mockResolvedValue(undefined);
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
});

describe('equipment: rescue linked to a harness', () => {
    const items = () => [
        equip('h1', 'sellette', { linkedRescueId: 's2' }),
        equip('s1', 'secours', { nom: 'Secours archivé', statut: 'archive' }),
        equip('s2', 'secours', { nom: 'Secours actif' }),
    ];

    it('only proposes active rescues', () => {
        setup(items());
        const values = Array.from($('eq-linked-rescue').querySelectorAll('option')).map((o) => o.value);
        expect(values).toEqual(['', 's2']);
    });

    it('shows the linked rescue field for a harness only, and prefills it when editing', () => {
        setup(items());
        LogbookView.editEquipment('h1');
        expect($('eq-linked-rescue-group').style.display).toBe('block');
        expect($('eq-linked-rescue').value).toBe('s2');

        LogbookView.editEquipment('s2');
        expect($('eq-linked-rescue-group').style.display).toBe('none');
    });
});

describe('equipment: date label follows the type', () => {
    it('says « pliage » for a rescue and « révision » otherwise', () => {
        setup([]);
        const label = () => document.querySelector('label[for="eq-derniere-revision"]').textContent;
        LogbookView.updateEquipmentLabels('secours');
        expect(label()).toBe(fr.html.logbookScreen.dernierPliage);
        LogbookView.updateEquipmentLabels('voile');
        expect(label()).toBe(fr.html.logbookScreen.derniereRevision);
    });
});

describe('logbook: required wing', () => {
    const submitWithoutWing = () => {
        vi.stubGlobal('alert', vi.fn());
        $('lb-site').value = 'Plaine';
        $('lb-duree').value = '5';
        $('lb-voile').value = '';
        LogbookView.submitForm();
        return /** @type {import('vitest').Mock} */ (alert);
    };

    it('tells the pilot to configure a wing when none exists', () => {
        setup([]);
        expect(submitWithoutWing()).toHaveBeenCalledWith(fr.logbook.form.alertMissingWingConfig);
        expect(LogbookService.getFlights()).toHaveLength(0);
    });

    it('asks to pick a wing when some are configured', () => {
        setup([equip('v1', 'voile')]);
        expect(submitWithoutWing()).toHaveBeenCalledWith(fr.logbook.form.alertMissingWing);
        expect(LogbookService.getFlights()).toHaveLength(0);
    });
});

describe('stats: a record opens its session', () => {
    it('switches to the history tab and highlights the card', () => {
        vi.useFakeTimers();
        setup([], [{ id: 'f1', type: 'vol', datetime: '2026-09-01T10:00', site: 'Plaine', duree: 5 }]);
        LogbookView.renderHistory();
        const card = () => /** @type {HTMLElement} */ (document.querySelector('.logbook-card[data-session-id="f1"]'));
        expect(card()).not.toBeNull();
        const switchTab = vi.spyOn(LogbookView, 'switchTab');

        LogbookView.scrollToSession('f1');
        expect(switchTab).toHaveBeenCalledWith('history');
        vi.advanceTimersByTime(100);
        expect(card().style.boxShadow).not.toBe('');
        vi.advanceTimersByTime(2000);
        expect(card().style.boxShadow).toBe('');
    });
});
