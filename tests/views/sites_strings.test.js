// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { FR } from '../../js/i18n/fr.js';
import { stripDeveloperText, findInlineTexts, catalogueKeys } from '../helpers/inline_texts.js';

// Spec 015 (contrainte « Language » de la constitution) : aucun texte affiché au pilote n'est écrit
// en dur dans l'écran des sites ; tout passe par le catalogue js/i18n/fr.js.
const SOURCE = readFileSync('js/views/sites.js', 'utf8');
// Codes enregistrés dans les préférences (données, pas textes d'interface).
const DATA_VALUES = ['ALL'];

describe('sites texts live in the strings catalogue (spec 015)', () => {
    it('js/views/sites.js writes no user-facing text inline', () => {
        expect(findInlineTexts(stripDeveloperText(SOURCE), { dataValues: DATA_VALUES })).toEqual([]);
    });

    it('every catalogue key used by the sites screen exists (FR-006)', () => {
        const keys = catalogueKeys(SOURCE, { prefix: 'sites.', helpers: ['tt', 'th', 'tl'] });
        const missing = [...keys].filter(
            (key) => typeof key.split('.').reduce((node, part) => node?.[part], FR) !== 'string',
        );
        expect(keys.size).toBeGreaterThan(80);
        expect(missing).toEqual([]);
    });
});
