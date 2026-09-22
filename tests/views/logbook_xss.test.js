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
