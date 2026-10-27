import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import LogbookView from '../../js/views/logbook.js';
import LogbookService from '../../js/services/logbook_service.js';
import SitesService from '../../js/services/sites_service.js';
import BrevetService from '../../js/services/brevet_service.js';
import GlobalState from '../../js/core/app_state.js';

const INDEX = readFileSync('index.html', 'utf8');
const LOGBOOK_SCREEN = ['logbook-screen', 'logbook-session-modal']
    .map((id) => {
        const tpl = document.createElement('template');
        tpl.innerHTML = INDEX.slice(INDEX.search(new RegExp(`<(div|dialog)\\s[^>]*id="${id}"`)));
        return tpl.content.getElementById(id).outerHTML;
    })
    .join('');

const $ = (id) => /** @type {HTMLInputElement & HTMLSelectElement} */ (document.getElementById(id));

describe('Logbook — Brevets & Progression (spec 042)', () => {
    beforeEach(() => {
        localStorage.clear();
        GlobalState.init();
        GlobalState.set('level', 'BI');
        Element.prototype.scrollIntoView = () => {};
        vi.spyOn(SitesService, 'getSites').mockReturnValue([]);
        vi.spyOn(SitesService, 'ensureSitesLoaded').mockResolvedValue(undefined);
        vi.spyOn(LogbookView, 'fetchWeatherForSession').mockResolvedValue(undefined);

        LogbookService.flights = [];
        LogbookService.equipment = [{ id: 'w1', nom: 'Alpha 7', type: 'voile', statut: 'actif' }];
        LogbookView.currentFormType = 'vol';
        document.body.innerHTML = `${LOGBOOK_SCREEN}<input type="file" id="global-igc-input">`;
        LogbookView.setupEventListeners();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders #lb-brevet-prepare in the school block, saves brevetPrepare, and clears it when school is unticked', () => {
        LogbookView.resetForm();
        const select = $('lb-brevet-prepare');
        expect(select).toBeTruthy();
        expect(Array.from(select.options).map((o) => o.value)).toEqual(['', 'BI', 'BP', 'BPC', 'TREUIL']);

        $('lb-datetime').value = '2026-10-20T10:00';
        $('lb-site').value = 'Planfait';
        $('lb-voile').value = 'Alpha 7';
        $('lb-duree').value = '30';
        LogbookView.setSchoolField(true, 'Cumulus Parapente');
        select.value = 'BI';

        // Switching between vol and gonflage preserves #lb-brevet-prepare
        LogbookView.setFormType('gonflage');
        expect($('lb-brevet-prepare').value).toBe('BI');
        LogbookView.setFormType('vol');
        expect($('lb-brevet-prepare').value).toBe('BI');

        LogbookView.submitForm();
        expect(LogbookService.flights).toHaveLength(1);
        expect(LogbookService.flights[0].brevetPrepare).toBe('BI');

        // Editing the session restores #lb-brevet-prepare, and unticking school clears brevetPrepare on save
        const savedId = LogbookService.flights[0].id;
        LogbookView.editEntry(savedId);
        expect($('lb-brevet-prepare').value).toBe('BI');

        LogbookView.setSchoolField(false);
        LogbookView.submitForm();
        expect(LogbookService.flights[0].ecole).toBe('');
        expect(LogbookService.flights[0].brevetPrepare).toBe('');
    });

    it('displays the target brevet on the history card and filters history by brevet', () => {
        LogbookService.flights = [
            {
                id: 'f1',
                type: 'vol',
                datetime: '2026-10-20T10:00',
                site: 'Planfait',
                voile: 'Alpha 7',
                duree: 30,
                typeVol: 'Plouf',
                ecole: 'Cumulus Parapente',
                brevetPrepare: 'BI',
            },
            {
                id: 'f2',
                type: 'vol',
                datetime: '2026-10-21T10:00',
                site: 'Forclaz',
                voile: 'Alpha 7',
                duree: 45,
                typeVol: 'Thermique',
                ecole: '',
                brevetPrepare: '',
            },
        ];

        LogbookView.renderHistory();
        const card1 = document.querySelector('.logbook-card[data-session-id="f1"]');
        expect(card1.textContent).toContain('BI — Brevet Initial');

        LogbookView.applyHistoryFilter('brevet', 'BI');
        const visibleCards = document.querySelectorAll('#logbook-history-list .logbook-card');
        expect(visibleCards).toHaveLength(1);
        expect(visibleCards[0].getAttribute('data-session-id')).toBe('f1');
    });

    it('renders the Mes Brevets & Progression section even when the logbook is empty', () => {
        LogbookService.flights = [];
        LogbookView.renderStats();

        const section = document.querySelector('[data-brevets-stats]');
        expect(section).toBeTruthy();
        expect(section.querySelectorAll('[data-brevet-card]')).toHaveLength(4);
        expect(section.querySelector('[data-brevet-card="BI"]')).toBeTruthy();
        expect(section.querySelector('[data-brevet-card="BP"]')).toBeTruthy();
        expect(section.querySelector('[data-brevet-card="BPC"]')).toBeTruthy();
        expect(section.querySelector('[data-brevet-card="TREUIL"]')).toBeTruthy();
    });

    it('edits and validates a brevet (theory 28/30 -> 93% + practical) via #lb-brevet-modal and advances QCM level', () => {
        LogbookView.renderStats();
        LogbookView.openBrevetModal('BI');

        const modal = document.getElementById('lb-brevet-modal');
        expect(modal).toBeTruthy();
        expect(modal.hidden).toBe(false);
        expect(modal.classList.contains('gdpr-modal-overlay')).toBe(true);
        expect(modal.classList.contains('active')).toBe(true);
        expect(modal.querySelector('.gdpr-modal')).toBeTruthy();

        $('lb-brevet-practical-validated').checked = true;
        $('lb-brevet-practical-date').value = '2026-10-26';
        $('lb-brevet-practical-school').value = 'Cumulus Parapente';
        $('lb-brevet-practical-instructor').value = 'Jean Dupont';

        $('lb-brevet-theory-passed').checked = true;
        $('lb-brevet-theory-date').value = '2026-10-15';
        $('lb-brevet-theory-score').value = '28';
        $('lb-brevet-theory-total').value = '30';
        LogbookView.updateBrevetModalPct();
        expect($('lb-brevet-theory-pct').value).toBe('93');
        $('lb-brevet-theory-school').value = 'Cumulus Parapente';
        $('lb-brevet-theory-examiner').value = 'Marc Martin';

        LogbookView.saveBrevetModal();

        const bi = BrevetService.getBrevet('BI');
        expect(bi.practical.validated).toBe(true);
        expect(bi.practical.date).toBe('2026-10-26');
        expect(bi.theory.passed).toBe(true);
        expect(bi.theory.percentage).toBe(93);
        expect(GlobalState.get('level')).toBe('BP');

        const biCard = document.querySelector('[data-brevet-card="BI"]');
        expect(biCard.textContent).toContain('28/30 (93%)');
        expect(biCard.textContent).toContain('Cumulus Parapente');
    });

    it('batch-assigns existing unassigned school sessions to BI via #lb-brevet-batch-modal', () => {
        LogbookService.flights = [
            {
                id: 's1',
                type: 'vol',
                datetime: '2026-10-18T10:00',
                site: 'Planfait',
                duree: 25,
                ecole: 'Cumulus',
                brevetPrepare: '',
            },
            {
                id: 's2',
                type: 'gonflage',
                datetime: '2026-10-19T14:00',
                lieu: 'Pente école',
                duree: 90,
                ecole: 'Cumulus',
                brevetPrepare: '',
            },
        ];

        LogbookView.renderStats();
        const biCardBefore = document.querySelector('[data-brevet-card="BI"]');
        expect(biCardBefore.querySelector('[data-action="openBrevetBatchModal"]')).toBeTruthy();

        LogbookView.openBrevetBatchModal('BI');
        const batchModal = document.getElementById('lb-brevet-batch-modal');
        expect(batchModal).toBeTruthy();
        expect(batchModal.hidden).toBe(false);
        expect(batchModal.classList.contains('gdpr-modal-overlay')).toBe(true);
        expect(batchModal.classList.contains('active')).toBe(true);
        expect(batchModal.querySelector('.gdpr-modal')).toBeTruthy();

        const checkboxes = batchModal.querySelectorAll('input[data-brevet-batch-item]');
        expect(checkboxes).toHaveLength(2);
        expect(/** @type {HTMLInputElement} */ (checkboxes[0]).checked).toBe(true);
        expect(/** @type {HTMLInputElement} */ (checkboxes[1]).checked).toBe(true);

        LogbookView.applyBrevetBatchAssign();

        expect(LogbookService.flights[0].brevetPrepare).toBe('BI');
        expect(LogbookService.flights[1].brevetPrepare).toBe('BI');

        const biCardAfter = document.querySelector('[data-brevet-card="BI"]');
        expect(biCardAfter.textContent).toContain('Vols: 1');
        expect(biCardAfter.textContent).toContain('Gonflage: 1');
    });
});
