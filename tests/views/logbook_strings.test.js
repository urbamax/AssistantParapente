// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { FR } from '../../js/i18n/fr.js';

// Spec 014 (contrainte « Language » de la constitution) : aucun texte affiché au pilote n'est écrit
// en dur dans l'écran du carnet ; tout passe par le catalogue js/i18n/fr.js.
const SOURCE = readFileSync('js/views/logbook.js', 'utf8');

/** Retire commentaires et messages console (destinés aux développeurs), en gardant les numéros de ligne. */
function stripDeveloperText(src) {
    const blank = (m) => m.replace(/[^\n]/g, ' ');
    return src
        .replace(/\/\*[\s\S]*?\*\//g, blank)
        .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (m, p) => p + blank(m.slice(p.length)))
        .replace(/console\.(log|warn|error|info|debug)\((?:[^()]|\([^()]*\))*\)/g, blank);
}

const CODE = stripDeveloperText(SOURCE);
const lineOf = (index) => CODE.slice(0, index).split('\n').length;
const letters = /[A-Za-zÀ-ÿ]{2,}/;

/** Retire les expressions ${…} (accolades imbriquées comprises, ou non refermées dans l'extrait). */
function stripExpressions(s) {
    let out = '';
    for (let i = 0; i < s.length; i++) {
        if (s[i] === '$' && s[i + 1] === '{') {
            let depth = 0;
            for (i += 1; i < s.length; i++) {
                if (s[i] === '{') depth++;
                else if (s[i] === '}' && --depth === 0) break;
            }
        } else out += s[i];
    }
    return out;
}

/** Texte visible restant après retrait des ${…} et des entités. */
const visible = (s) => stripExpressions(s).replace(/&[a-z]+;/g, '');

const DATA_VALUES = ['Autre', 'Plouf'];

const RULES = [
    // Texte entre deux balises, dans un gabarit HTML.
    // (Pas après « = » ni « - », pour ignorer les comparaisons et les flèches du code JavaScript.)
    {
        name: 'text node',
        re: /(?<![=-])>([^<>`]+)</g,
        test: (g) => !/;|&&|===|=>|\)\s*\{/.test(g[1]) && letters.test(visible(g[1])),
    },
    // Attributs lus par le pilote ou les lecteurs d'écran.
    {
        name: 'attribute',
        re: /\b(?:title|placeholder|alt|aria-label)="([^"]*)"/g,
        test: (g) => letters.test(visible(g[1])),
    },
    // Boîtes de dialogue.
    { name: 'dialog', re: /\b(?:alert|confirm)\(\s*(['"`])/g, test: () => true },
    // Texte affecté à un bouton, un libellé ou un champ.
    {
        name: 'assigned text',
        re: /\.(?:innerText|textContent|value)\s*=\s*(['"`])((?:(?!\1).)*)\1/g,
        test: (g) => / /.test(visible(g[2])) && letters.test(visible(g[2])),
    },
    // Valeur de repli affichée (ex. `|| 'Enregistrer'`).
    // Valeurs enregistrées (données du carnet, pas des textes d'interface) autorisées.
    {
        name: 'fallback text',
        re: /\|\|\s*(['"])([A-ZÀ-Ý][^'"]*)\1/g,
        test: (g) => letters.test(g[2]) && !DATA_VALUES.includes(g[2]),
    },
];

function findInlineTexts(code) {
    const found = [];
    for (const rule of RULES) {
        for (const match of code.matchAll(rule.re)) {
            if (rule.test(match)) found.push(`${lineOf(match.index)}: [${rule.name}] ${match[0].trim().slice(0, 80)}`);
        }
    }
    return found;
}

describe('logbook texts live in the strings catalogue (spec 014)', () => {
    it('js/views/logbook.js writes no user-facing text inline', () => {
        expect(findInlineTexts(CODE)).toEqual([]);
    });

    it('every catalogue key used by the logbook exists (FR-006)', () => {
        const keys = new Set();
        for (const m of SOURCE.matchAll(/\bt[tlh]\(\s*'([^']+)'/g)) keys.add(`logbook.${m[1]}`);
        for (const m of SOURCE.matchAll(/\bt[tlh]\(\s*[^'()]*\?\s*'([^']+)'\s*:\s*'([^']+)'/g)) {
            keys.add(`logbook.${m[1]}`);
            keys.add(`logbook.${m[2]}`);
        }
        for (const m of SOURCE.matchAll(/\bt\(\s*'([^']+)'/g)) keys.add(m[1]);
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
        ].join('\n');
        expect(findInlineTexts(sample)).toHaveLength(5);
    });

    it('data values and developer messages are not flagged', () => {
        const sample = [
            "if (value === 'Autre') selectEl.value = 'Autre';",
            '`<option value="${escapeHTML(v)}">${escapeHTML(v)}</option>`',
            "console.log('Vol chargé', id);",
            '// Commentaire en français',
            "el.style.display = 'none';",
        ].join('\n');
        expect(findInlineTexts(stripDeveloperText(sample))).toEqual([]);
    });
});
