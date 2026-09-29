import { describe, it, expect } from 'vitest';
import { escapeHTML, renderSiteText, safeHttpUrl } from '../../js/core/security.js';

// Spec 003 : les détails des sites (données FFVL / communautaires) ne gardent que les retours à
// la ligne, le gras et les liens http(s) ; tout le reste s'affiche comme du texte.
const parse = (html) => {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div;
};
const ALLOWED_TAGS = new Set(['BR', 'B', 'A']);
const ALLOWED_ATTRS = new Set(['href', 'target', 'rel']);

function assertSafe(html) {
    const div = parse(html);
    for (const el of div.querySelectorAll('*')) {
        expect(ALLOWED_TAGS.has(el.tagName)).toBe(true);
        for (const attr of el.attributes) expect(ALLOWED_ATTRS.has(attr.name)).toBe(true);
        if (el.tagName === 'A') {
            expect(el.getAttribute('href')).toMatch(/^https?:\/\//i);
            expect(el.getAttribute('rel')).toBe('noopener noreferrer');
            expect(el.getAttribute('target')).toBe('_blank');
        }
    }
    return div;
}

describe('escapeHTML', () => {
    it('escapes the five HTML special characters', () => {
        expect(escapeHTML(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
    });
});

describe('renderSiteText (spec 003, contracts/sanitizer.md)', () => {
    it('keeps line breaks in their three spellings', () => {
        const div = assertSafe(renderSiteText('a<br>b<br/>c<br />d'));
        expect(div.querySelectorAll('br')).toHaveLength(3);
        expect(div.textContent).toBe('abcd');
    });

    it('keeps bold text', () => {
        const div = assertSafe(renderSiteText('<b> NO Toplanding in fields behind TO!</b>'));
        expect(div.querySelector('b').textContent).toBe(' NO Toplanding in fields behind TO!');
    });

    it('keeps http(s) links, opening in a new tab without access to the app', () => {
        const div = assertSafe(renderSiteText('voir <a href="https://a.fr/p?x=1&y=2">la charte</a>.'));
        const a = div.querySelector('a');
        expect(a.getAttribute('href')).toBe('https://a.fr/p?x=1&y=2');
        expect(a.textContent).toBe('la charte');
        expect(div.textContent).toBe('voir la charte.');
    });

    it.each([
        ['<Les terrains concédés sont affectés au vol libre'],
        ['zone de biotope des <<corniches calcaires du Doubs>> et'],
        ['vent < 25 km/h et > 10 km/h'],
        ['<b>gras jamais fermé'],
    ])('shows « %s » in full, as text', (text) => {
        expect(assertSafe(renderSiteText(text)).textContent).toBe(text);
    });

    it('keeps the text of a link whose address is not http(s), without the link', () => {
        const div = assertSafe(renderSiteText('<a href="javascript:alert(1)">clique</a>'));
        expect(div.querySelector('a')).toBeNull();
        expect(div.textContent).toBe('clique');
    });

    it.each([
        ['<script>alert(1)</script>'],
        ['<img src=x onerror=alert(1)>'],
        ['<svg onload=alert(1)>'],
        ['<a href="javascript:alert(1)">x</a>'],
        ['<a href="data:text/html,<script>alert(1)</script>">x</a>'],
        ['<a href="https://x.fr" onclick="alert(1)">x</a>'],
        ['<b onmouseover=alert(1)>x</b>'],
        ['<iframe src="https://evil.example"></iframe>'],
        ['"><script>alert(1)</script>'],
        ["<a href='https://x.fr'>x</a>"],
        ['<A HREF="HTTPS://X.FR">x</A>'],
        ['<a href="https://x.fr" style="position:fixed">x</a>'],
    ])('neutralises %s', (attack) => {
        assertSafe(renderSiteText(attack));
    });

    it('renders empty values as an empty string', () => {
        expect(renderSiteText(null)).toBe('');
        expect(renderSiteText(undefined)).toBe('');
        expect(renderSiteText('')).toBe('');
    });
});

describe('safeHttpUrl (spec 003, FR-004)', () => {
    it('keeps http and https addresses', () => {
        expect(safeHttpUrl('https://federation.ffvl.fr/terrain/728')).toBe('https://federation.ffvl.fr/terrain/728');
        expect(safeHttpUrl('http://lavl.free.fr')).toBe('http://lavl.free.fr');
    });

    it.each([['javascript:alert(1)'], ['data:text/html,x'], ['/relative'], [''], [null], ['http//broken'], ['  ']])(
        'rejects %s',
        (url) => {
            expect(safeHttpUrl(url)).toBe('');
        },
    );
});
