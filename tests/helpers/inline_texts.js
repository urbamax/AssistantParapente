/**
 * Détection des textes d'interface écrits en dur dans un écran (constitution, contrainte
 * « Language » ; specs 014 et 015). Heuristique ciblée sur les endroits où un texte atteint le
 * pilote : texte entre balises, attributs lus, boîtes de dialogue, propriétés de texte, libellés.
 * Les commentaires et les messages console (destinés aux développeurs) sont ignorés.
 */

/** Retire commentaires et messages console, en gardant les numéros de ligne. */
export function stripDeveloperText(src) {
    const blank = (m) => m.replace(/[^\n]/g, ' ');
    return src
        .replace(/\/\*[\s\S]*?\*\//g, blank)
        .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (m, p) => p + blank(m.slice(p.length)))
        .replace(/console\.(log|warn|error|info|debug|time|timeEnd)\((?:[^()]|\([^()]*\))*\)/g, blank);
}

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

const letters = /[A-Za-zÀ-ÿ]{2,}/;
const visible = (s) => stripExpressions(s).replace(/&[a-z]+;/g, '');
/** Une phrase (au moins un mot de 3 lettres et une espace) ou un mot accentué. */
const sentence = (s) => (/[A-Za-zÀ-ÿ]{3,}/.test(s) && / /.test(s.trim())) || /[À-ÿ]/.test(s);

function rules(dataValues) {
    return [
        // Texte entre deux balises, ou en fin de gabarit (« </i> Comparer` »). Pas après « = » ni
        // « - » : comparaisons et flèches du code JavaScript.
        {
            name: 'text node',
            re: /(?<![=-])>([^<>`]+?)(?=<|`)/g,
            test: (g) =>
                !/;|&&|===|=>|\)\s*\{/.test(g[1]) && !/^\s*[\d.]+\s*[?)&|]/.test(g[1]) && letters.test(visible(g[1])),
        },
        // Attributs lus par le pilote ou les lecteurs d'écran.
        {
            name: 'attribute',
            re: /\b(?:title|placeholder|alt|aria-label|aria-valuetext)="([^"]*)"/g,
            test: (g) => letters.test(visible(g[1])),
        },
        {
            name: 'attribute',
            re: /setAttribute\(\s*'(?:title|placeholder|alt|aria-label|aria-valuetext)',\s*(['"`])((?:(?!\1).)*)\1/g,
            test: (g) => letters.test(visible(g[2])),
        },
        // Boîtes de dialogue.
        { name: 'dialog', re: /\b(?:alert|confirm)\(\s*(['"`])/g, test: () => true },
        // Texte affecté à un bouton, un libellé ou un champ.
        {
            name: 'assigned text',
            re: /\.(?:innerText|textContent|value|placeholder|title)\s*=\s*(['"`])((?:(?!\1).)*)\1/g,
            test: (g) => sentence(visible(g[2])) && !dataValues.includes(g[2]),
        },
        // Valeur de repli affichée (ex. `|| 'Enregistrer'`) ; les valeurs enregistrées sont permises.
        {
            name: 'fallback text',
            re: /\|\|\s*(['"])([A-ZÀ-Ý][^'"]*)\1/g,
            test: (g) => letters.test(g[2]) && !dataValues.includes(g[2]),
        },
        // Libellé d'une liste affichée (`label: 'Site Naturel'`).
        {
            name: 'label',
            re: /\blabel:\s*(['"])([^'"]*)\1/g,
            test: (g) => letters.test(g[2]) && !dataValues.includes(g[2]),
        },
        // Phrase choisie par une condition ou valeur d'un objet de libellés (`cond ? 'Masquer les
        // détails' : …`, `ALL: 'Tous niveaux'`). Le CSS (« ; »), le HTML (« < », déjà vérifié par
        // la règle du texte entre balises) et les classes d'icônes ne sont pas des textes.
        {
            name: 'conditional text',
            re: /[?:]\s*(['"])((?:(?!\1)[^\n])*)\1/g,
            test: (g) =>
                sentence(g[2]) &&
                !/[;<]/.test(g[2]) &&
                !/^(ri-|var\(|rgba?\(|#|https?:)/.test(g[2]) &&
                !/\.(pdf|png|jpe?g|svg|js|json|csv)(#|$)/.test(g[2]) &&
                !dataValues.includes(g[2]),
        },
    ];
}

/**
 * @param {string} code source déjà passée par stripDeveloperText
 * @param {{ dataValues?: string[] }} [options] valeurs enregistrées permises (données, pas textes)
 * @returns {string[]} « ligne: [règle] extrait »
 */
export function findInlineTexts(code, { dataValues = [] } = {}) {
    const lineOf = (index) => code.slice(0, index).split('\n').length;
    const found = [];
    for (const rule of rules(dataValues)) {
        for (const match of code.matchAll(rule.re)) {
            if (rule.test(match)) found.push(`${lineOf(match.index)}: [${rule.name}] ${match[0].trim().slice(0, 80)}`);
        }
    }
    return found;
}

/** Clés du catalogue lues par un écran via t('…') et ses raccourcis (préfixe ajouté). */
export function catalogueKeys(source, { prefix, helpers = [] } = {}) {
    const keys = new Set();
    for (const m of source.matchAll(/\bt\(\s*'([^']+)'/g)) keys.add(m[1]);
    for (const helper of helpers) {
        for (const m of source.matchAll(new RegExp(`\\b${helper}\\(\\s*'([^']+)'`, 'g'))) keys.add(`${prefix}${m[1]}`);
        for (const m of source.matchAll(
            new RegExp(`\\b${helper}\\(\\s*[^'()]*\\?\\s*'([^']+)'\\s*:\\s*'([^']+)'`, 'g'),
        )) {
            keys.add(`${prefix}${m[1]}`);
            keys.add(`${prefix}${m[2]}`);
        }
    }
    return keys;
}
