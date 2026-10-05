// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { FR } from '../../js/i18n/fr.js';
import { stripDeveloperText, findInlineTexts, catalogueKeys } from '../helpers/inline_texts.js';

// Contrainte « Language » de la constitution (écart d'audit C8) : aucun texte affiché au pilote
// n'est écrit en dur dans les écrans migrés ; tout passe par le catalogue js/i18n/fr.js.
// Un écran s'ajoute ici quand ses textes ont été déplacés (specs 014, 015, 019, 021, 024…).
const SCREENS = [
    // Valeurs enregistrées dans le carnet (données, pas textes d'interface).
    { file: 'js/views/logbook.js', spec: '014', prefix: 'logbook.', dataValues: ['Autre', 'Plouf'], minKeys: 100 },
    // Code de niveau enregistré dans les préférences.
    { file: 'js/views/sites.js', spec: '015', prefix: 'sites.', dataValues: ['ALL'], minKeys: 80 },
    { file: 'js/views/safety.js', spec: '019', prefix: 'safety.', dataValues: [], minKeys: 15 },
    // Codes d'erreur renvoyés au code appelant (jamais affichés) et codes de niveau / catégorie.
    {
        file: 'js/services/firebase_service.js',
        spec: '021',
        prefix: 'account.',
        dataValues: [
            'Not logged in',
            'Not enabled or logged in',
            'Not enabled, syncing or not logged in',
            'Missing VAPID key',
            'Permission denied',
            'No token',
        ],
        minKeys: 30,
    },
    // Noms de thèmes du fichier des questions et codes de niveau (données).
    {
        file: 'js/views/quiz.js',
        spec: '024',
        prefix: 'quiz.',
        helpers: ['tq', 'tqh', 'tql'],
        dataValues: [
            'Météo',
            'Mécavol',
            'Matériel',
            'Pilotage',
            'Réglementation',
            'Facteurs humains',
            'Milieu naturel',
            'Autre',
            'BI',
            'ALL',
        ],
        minKeys: 60,
    },
    {
        file: 'js/views/manual.js',
        spec: '021',
        prefix: 'library.',
        dataValues: ['ALL', 'GENERAL', 'Autre'],
        minKeys: 2,
    },
];

const resolves = (key) => typeof key.split('.').reduce((node, part) => node?.[part], FR) === 'string';

describe.each(SCREENS)('$file (spec $spec)', ({ file, prefix, helpers = ['tt', 'th', 'tl'], dataValues, minKeys }) => {
    const source = readFileSync(file, 'utf8');

    it('writes no user-facing text inline', () => {
        expect(findInlineTexts(stripDeveloperText(source), { dataValues })).toEqual([]);
    });

    it('uses only catalogue keys that exist', () => {
        const keys = catalogueKeys(source, { prefix, helpers });
        expect(keys.size).toBeGreaterThanOrEqual(minKeys);
        expect([...keys].filter((key) => !resolves(key))).toEqual([]);
    });
});

describe('the inline-text check itself', () => {
    it('catches a text added inline', () => {
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

    it('does not flag data values, file paths or developer messages', () => {
        const sample = [
            "if (value === 'Autre') selectEl.value = 'Autre';",
            '`<option value="${escapeHTML(v)}">${escapeHTML(v)}</option>`',
            "console.log('Vol chargé', id);",
            '// Commentaire en français',
            "el.style.display = 'none';",
            "const c = ok ? 'var(--accent-green)' : 'rgba(0,0,0,0.1)';",
            "const i = ok ? 'ri-star-fill' : 'ri-star-line';",
            "const SOURCES = { A: 'courses/BREVET INITIAL - VERT/livret.pdf#page=15' };",
        ].join('\n');
        expect(findInlineTexts(stripDeveloperText(sample), { dataValues: ['Autre'] })).toEqual([]);
    });
});
