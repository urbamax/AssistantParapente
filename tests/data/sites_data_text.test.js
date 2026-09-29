import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderSiteText } from '../../js/core/security.js';

// Spec 003 : contrôle sur TOUTE la base des sites, pas seulement sur des exemples.
// Chemins relatifs à la racine du projet (dossier de lancement de Vitest).
const load = (path) => JSON.parse(readFileSync(path, 'utf8'));
const SITES = load('js/data/sites_data.json');
const DETAIL_FIELDS = [
    'dangers',
    'restrictions',
    'observations',
    'acces_topo',
    'secours_acces',
    'aerologie_ideale',
    'reglementation',
    'praticabilite',
    'conventionnement',
    'structure_gestionnaire',
];

/** Texte attendu à l'écran : la source, sans les seules balises restaurées par renderSiteText. */
function expectedText(source) {
    return source
        .replace(/<br\s*\/?>/gi, '')
        .replace(/<b>([\s\S]*?)<\/b>/gi, '$1')
        .replace(/<a href="https?:\/\/[^\s"<>]+?">([\s\S]*?)<\/a>/gi, '$1');
}

describe('site details shown in full (spec 003, SC-001)', () => {
    const cases = [];
    for (const site of SITES) {
        for (const field of DETAIL_FIELDS) {
            if (typeof site[field] === 'string' && site[field]) cases.push([site.id, field, site[field]]);
        }
    }

    it('checks a meaningful number of fields', () => {
        expect(cases.length).toBeGreaterThan(1000);
    });

    it('never loses a character of any detail', () => {
        const lost = [];
        const div = document.createElement('div');
        for (const [id, field, text] of cases) {
            div.innerHTML = renderSiteText(text);
            if (div.textContent !== expectedText(text)) lost.push(`${id}.${field}`);
        }
        expect(lost).toEqual([]);
    });
});
