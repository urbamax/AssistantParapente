import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import SitesView from '../../js/views/sites.js';

// Spec 003 : les fiches abîmées s'affichent en entier, avec leurs liens sûrs.
const SITES = JSON.parse(readFileSync('js/data/sites_data.json', 'utf8')); // racine du projet
const byId = (id) => ({ ...SITES.find((s) => s.id === id) });

function cardText(site) {
    const div = document.createElement('div');
    div.innerHTML = SitesView.buildSiteCardHtml(site, '', '', '', '', '', '', '', false);
    return div;
}

describe('site details in the card (spec 003, US1)', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('SORGIA shows « <Les terrains concédés » as text', () => {
        expect(cardText(byId('sorgia-602')).textContent).toContain('<Les terrains concédés');
    });

    it('MATHAY shows « <<corniches calcaires du Doubs>> » as text', () => {
        expect(cardText(byId('mathay-13452')).textContent).toContain('<<corniches calcaires du Doubs>>');
    });

    it('NOTRE-DAME-DE-LA-MER keeps its charter link, opening safely', () => {
        const link = cardText(byId('notre-dame-de-la-mer-1098')).querySelector('a[href*="thermiquefrancilien.org"]');
        expect(link).not.toBeNull();
        expect(link.getAttribute('rel')).toBe('noopener noreferrer');
        expect(link.getAttribute('target')).toBe('_blank');
    });

    it('COL DES LIMOUCHES keeps its bold warning', () => {
        const bolds = [...cardText(byId('col-des-limouches-728')).querySelectorAll('b')].map((b) => b.textContent);
        expect(bolds.some((text) => text.includes('NO Toplanding'))).toBe(true);
    });

    it('renders no FFVL link for a non-http address, in the card and the map popup', () => {
        const site = { ...byId('sorgia-602'), url: 'javascript:alert(1)' };
        expect(cardText(site).querySelector('.ffvl-btn')).toBeNull();
        const popup = document.createElement('div');
        popup.innerHTML = SitesView.buildMapPopupHtml(site, '');
        expect(popup.querySelector('.ffvl-btn')).toBeNull();
        expect(popup.innerHTML).not.toContain('javascript:');
    });

    it('keeps the FFVL link for an http(s) address', () => {
        const site = { ...byId('sorgia-602'), url: 'https://federation.ffvl.fr/terrain/602' };
        expect(cardText(site).querySelector('.ffvl-btn')?.getAttribute('href')).toBe(
            'https://federation.ffvl.fr/terrain/602',
        );
    });
});
