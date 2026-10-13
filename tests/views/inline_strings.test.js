// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { FR } from '../../js/i18n/fr.js';
import { stripDeveloperText, findInlineTexts, catalogueKeys } from '../helpers/inline_texts.js';

// Contrainte « Language » de la constitution (écart d'audit C8) : aucun texte affiché au pilote
// n'est écrit en dur dans les écrans migrés ; tout passe par le catalogue js/i18n/fr.js.
// Un écran s'ajoute ici quand ses textes ont été déplacés (specs 014, 015, 019, 021, 024, 029…).
const SCREENS = [
    // Valeurs enregistrées dans le carnet (données, pas textes d'interface).
    // logbook.js a été découpé (specs 014, puis étapes du découpage) : chaque fichier reste contrôlé.
    ...[
        ['js/views/logbook.js', 46],
        ['js/views/logbook_equipment.js', 25],
        ['js/views/logbook_stats.js', 25],
        ['js/views/logbook_history.js', 50],
        ['js/views/logbook_coords.js', 10],
        ['js/views/logbook_sites.js', 1],
        ['js/views/logbook_checklists.js', 14],
        ['js/views/logbook_learned.js', 1],
        ['js/views/logbook_igc_import.js', 12],
    ].map(([file, minKeys]) => ({ file, spec: '014', prefix: 'logbook.', dataValues: ['Autre', 'Plouf'], minKeys })),
    // Code de niveau enregistré dans les préférences.
    // sites.js a été découpé : chaque fichier reste contrôlé.
    ...[
        ['js/views/sites.js', 80],
        ['js/views/sites_forecast.js', 16],
        ['js/views/sites_map.js', 21],
    ].map(([file, minKeys]) => ({ file, spec: '015', prefix: 'sites.', dataValues: ['ALL'], minKeys })),
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
    // Spec 029 : les autres fichiers qui affichent du texte (bannière, erreurs, thème, confidentialité,
    // carte 3D, dates, messages des services). Données : thèmes du fichier des questions, symboles,
    // mention légale des fonds de carte, police de caractères, valeurs internes de filtre.
    ...[
        ['js/core/app_update.js', ['×']],
        ['js/core/base_view.js', []],
        ['js/core/router.js', []],
        ['js/core/ui_manager.js', []],
        ['js/gdpr_engine.js', []],
        ['js/components/map_3d.js', ['© Google', '"Segoe UI", Arial, sans-serif']],
        ['js/utils/date_utils.js', []],
        [
            'js/services/quiz_service.js',
            [
                'Météo',
                'Mécavol',
                'Matériel',
                'Pilotage',
                'Réglementation',
                'Facteurs humains',
                'Milieu naturel',
                'Autre',
            ],
        ],
        ['js/services/logbook_service.js', []],
        ['js/services/sites_service.js', ['Inconnu']],
    ].map(([file, dataValues]) => ({ file, spec: '029', prefix: '', dataValues, minKeys: 1 })),
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
