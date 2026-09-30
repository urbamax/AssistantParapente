import { describe, it, expect, beforeEach } from 'vitest';
import LogbookService from '../../js/services/logbook_service.js';
import LogbookView from '../../js/views/logbook.js';

// A free-text field ("Saisie libre") stored via StorageService and re-rendered into a <select>
// as <option value="...">...</option> without escapeHTML let a stored value break out of the
// value="" attribute and inject an element — e.g. an onerror handler firing as soon as the
// option list renders. escapeHTML must survive both the attribute and the text position.
const PAYLOAD = `"><img src=x onerror=window.__xss=1>`;
const ESCAPED_OPEN = '&lt;img';

describe('LogbookView equipment dropdowns escape stored free-text values', () => {
    beforeEach(() => {
        localStorage.clear();
        document.body.innerHTML = `
            <select id="eq-marque"></select>
            <select id="eq-modele"></select>
            <select id="eq-taille"></select>
            <select id="eq-couleur"></select>
            <select id="lb-voile"></select>
            <select id="lb-sellette"></select>
        `;
        LogbookService.equipment = [];
    });

    it('populateEquipmentDropdowns escapes a custom marque/modele/taille/couleur value', () => {
        localStorage.setItem('customEquipMarques', JSON.stringify([PAYLOAD]));

        LogbookView.populateEquipmentDropdowns();

        const html = document.getElementById('eq-marque').innerHTML;
        expect(html).not.toContain(PAYLOAD);
        expect(html).toContain(ESCAPED_OPEN);
    });

    it('populateDropdowns escapes a wing/harness name coming from stored equipment', () => {
        LogbookService.equipment = [{ id: 'w1', type: 'voile', nom: PAYLOAD, statut: 'actif' }];

        LogbookView.populateDropdowns();

        const html = document.getElementById('lb-voile').innerHTML;
        expect(html).not.toContain(PAYLOAD);
        expect(html).toContain(ESCAPED_OPEN);
    });
});

// renderStats() used to insert the wing name, places, flight types, take-off techniques and
// ground handling exercises raw into the statistics page. Those values can come from cloud sync
// or a JSON import, so each one must be escaped (spec 014).
describe('LogbookView statistics escape pilot-entered values', () => {
    const payload = (field) => `"><img src=x onerror=window.__xss=1 data-field=${field}>`;

    beforeEach(() => {
        delete window.__xss;
        document.body.innerHTML = '<div id="logbook-stats-container"></div>';
        LogbookService.equipment = [];
        LogbookService.flights = [
            {
                id: 'f1',
                type: 'vol',
                duree: 30,
                site: payload('site'),
                typeVol: payload('typeVol'),
                techDecollage: payload('techDecollage'),
                voile: payload('voile'),
            },
            {
                id: 'g1',
                type: 'gonflage',
                duree: 20,
                lieu: payload('lieu'),
                typeExercice: [payload('exercice')],
            },
        ];
    });

    it('renders every value as text without injecting elements or attributes', () => {
        LogbookView.renderStats();

        const container = document.getElementById('logbook-stats-container');
        expect(container.querySelector('img')).toBeNull();
        expect(container.querySelector('[onerror]')).toBeNull();

        const texts = [...container.querySelectorAll('.equip-name, .bar-label')].map((el) => el.textContent.trim());
        for (const field of ['voile', 'site', 'lieu', 'typeVol', 'techDecollage', 'exercice']) {
            expect(texts).toContain(payload(field));
        }

        const decoLabel = [...container.querySelectorAll('.bar-label[title]')].find((el) =>
            el.textContent.includes('techDecollage'),
        );
        expect(decoLabel.getAttribute('title')).toBe(payload('techDecollage'));
    });
});
