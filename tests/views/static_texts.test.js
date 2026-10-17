import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { FR } from '../../js/i18n/fr.js';
import { FR_HTML } from '../../js/i18n/fr_html.js';
import { applyStaticTexts, STATIC_TEXT_ATTRIBUTES } from '../../js/utils/i18n_dom.js';

// Spec 026 (contrainte « Language », écart d'audit C8) : chaque texte fixe de index.html et des
// composants porte une clé du catalogue, et le texte affiché est identique au catalogue.
const FILES = ['index.html', 'components/header.html', 'components/footer.html'];
const SKIPPED = 'script, style, svg, noscript, title, template';

/** Fichier HTML lu sans rien charger ni exécuter (un <template> n'exécute aucun script). */
function load(file) {
    const tpl = document.createElement('template');
    tpl.innerHTML = readFileSync(file, 'utf8');
    return tpl.content;
}

const norm = (s) => String(s).replace(/\s+/g, ' ').trim();
const directText = (el) =>
    norm(
        [...el.childNodes]
            .filter((n) => n.nodeType === 3)
            .map((n) => n.textContent)
            .join(' '),
    );
/** HTML comparé tel que le navigateur le relit (guillemets, entités, espaces). */
const asHtml = (html) => {
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    return norm(tpl.innerHTML);
};
/** Texte d'une clé « html.… » du catalogue complet des textes du HTML (js/i18n/fr_html.js). */
const t = (key) => {
    const node = key
        .replace(/^html\./, '')
        .split('.')
        .reduce((n, part) => n?.[part], FR_HTML);
    return typeof node === 'string' ? node : key;
};
const known = (key) => t(key) !== key;
const hasLetters = (s) => /[A-Za-zÀ-ÿ]{2,}/.test(s);

describe.each(FILES)('%s (spec 026)', (file) => {
    const root = load(file);
    const all = [...root.querySelectorAll('*')].filter((el) => !el.closest(SKIPPED));

    it('every text and readable attribute has a catalogue key', () => {
        const missing = [];
        for (const el of all) {
            if (el.closest('[data-i18n-html]')) continue;
            if (hasLetters(directText(el)) && !el.hasAttribute('data-i18n'))
                missing.push(`<${el.tagName.toLowerCase()}> ${directText(el).slice(0, 60)}`);
            for (const attr of STATIC_TEXT_ATTRIBUTES) {
                const value = el.getAttribute(attr);
                if (value && hasLetters(value) && !el.hasAttribute(`data-i18n-${attr}`))
                    missing.push(`${attr}="${value.slice(0, 60)}"`);
            }
        }
        expect(missing).toEqual([]);
    });

    it('the HTML text is identical to the catalogue', () => {
        const different = [];
        root.querySelectorAll('[data-i18n]').forEach((el) => {
            const key = `html.${el.getAttribute('data-i18n')}`;
            if (!known(key) || directText(el) !== norm(t(key))) different.push(key);
        });
        root.querySelectorAll('[data-i18n-html]').forEach((el) => {
            const key = `html.${el.getAttribute('data-i18n-html')}`;
            if (!known(key) || norm(el.innerHTML) !== asHtml(t(key))) different.push(key);
        });
        for (const attr of STATIC_TEXT_ATTRIBUTES) {
            root.querySelectorAll(`[data-i18n-${attr}]`).forEach((el) => {
                const key = `html.${el.getAttribute(`data-i18n-${attr}`)}`;
                if (!known(key) || norm(el.getAttribute(attr)) !== norm(t(key))) different.push(key);
            });
        }
        expect(different).toEqual([]);
    });
});

describe('applyStaticTexts (future translations)', () => {
    it('replaces texts, rich texts and attributes, and keeps child elements such as icons', () => {
        document.body.innerHTML = `
            <button data-i18n="a.save"><i class="ri-save"></i> Enregistrer</button>
            <p data-i18n-html="a.rich">Voir <a href="#">le cours</a>.</p>
            <input data-i18n-placeholder="a.search" placeholder="Rechercher">`;
        const english = {
            'html.a.save': 'Save',
            'html.a.rich': 'See <a href="#">the course</a>.',
            'html.a.search': 'Search',
        };
        applyStaticTexts(document.body, (key) => english[key]);
        const button = document.querySelector('button');
        expect(button.querySelector('i.ri-save')).not.toBeNull();
        expect(norm(button.textContent)).toBe('Save');
        expect(document.querySelector('p').innerHTML).toBe('See <a href="#">the course</a>.');
        expect(document.querySelector('input').getAttribute('placeholder')).toBe('Search');
    });

    it('applied with the French catalogue, changes no visible text of index.html', () => {
        const root = load('index.html');
        const before = norm(root.textContent);
        applyStaticTexts(root, t);
        expect(norm(root.textContent)).toBe(before);
    });
});

describe('les clés « html. » que le code lit (js/i18n/fr.js)', () => {
    const collect = (node, prefix = '') =>
        Object.entries(node).flatMap(([k, v]) =>
            typeof v === 'string' ? [[prefix + k, v]] : collect(v, `${prefix}${k}.`),
        );

    it('sont identiques à celles du catalogue complet', () => {
        const runtime = collect(FR.html);
        expect(runtime.length).toBeGreaterThanOrEqual(3);
        for (const [key, value] of runtime) expect(t(`html.${key}`)).toBe(value);
    });
});
