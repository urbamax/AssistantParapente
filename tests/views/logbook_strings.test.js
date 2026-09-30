// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { FR } from '../../js/i18n/fr.js';
import { stripDeveloperText, findInlineTexts, catalogueKeys } from '../helpers/inline_texts.js';

// Spec 014 (contrainte « Language » de la constitution) : aucun texte affiché au pilote n'est écrit
// en dur dans l'écran du carnet ; tout passe par le catalogue js/i18n/fr.js.
const SOURCE = readFileSync('js/views/logbook.js', 'utf8');
// Valeurs enregistrées dans le carnet (données, pas textes d'interface).
const DATA_VALUES = ['Autre', 'Plouf'];

describe('logbook texts live in the strings catalogue (spec 014)', () => {
    it('js/views/logbook.js writes no user-facing text inline', () => {
        expect(findInlineTexts(stripDeveloperText(SOURCE), { dataValues: DATA_VALUES })).toEqual([]);
    });

    it('every catalogue key used by the logbook exists (FR-006)', () => {
        const keys = catalogueKeys(SOURCE, { prefix: 'logbook.', helpers: ['tt', 'th', 'tl'] });
        const missing = [...keys].filter(
            (key) => typeof key.split('.').reduce((node, part) => node?.[part], FR) !== 'string',
        );
        expect(keys.size).toBeGreaterThan(100);
        expect(missing).toEqual([]);
    });

    it('the check catches a text added inline', () => {
        const sample = [
            'x.innerHTML = `<p>Votre carnet est vide.</p>`;',
            'y = `<button title="Supprimer">`;',
            "confirm('Supprimer ?');",
            "btn.innerText = 'Modifier la session';",
            "const s = el?.innerText || 'Enregistrer';",
            "b.innerHTML = `<i class='ri-table-line'></i> Comparer`;",
            "el.setAttribute('aria-label', `Charger le lieu : ${n}`);",
            "const types = [{ id: 'DUNE', label: 'Dune' }];",
            "el.textContent = open ? 'Masquer les détails' : 'Voir plus';",
        ].join('\n');
        expect(findInlineTexts(sample)).toHaveLength(10);
    });

    it('data values and developer messages are not flagged', () => {
        const sample = [
            "if (value === 'Autre') selectEl.value = 'Autre';",
            '`<option value="${escapeHTML(v)}">${escapeHTML(v)}</option>`',
            "console.log('Vol chargé', id);",
            '// Commentaire en français',
            "el.style.display = 'none';",
            "const c = ok ? 'var(--accent-green)' : 'rgba(0,0,0,0.1)';",
            "const i = ok ? 'ri-star-fill' : 'ri-star-line';",
        ].join('\n');
        expect(findInlineTexts(stripDeveloperText(sample), { dataValues: DATA_VALUES })).toEqual([]);
    });
});
