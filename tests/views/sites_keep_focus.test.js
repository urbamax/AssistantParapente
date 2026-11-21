import { describe, it, expect, beforeEach } from 'vitest';
import { captureListFocus, restoreListFocus } from '../../js/views/sites_list.js';

const card = (id, types) =>
    `<div id="site-card-${id}" class="site-card">${types
        .map((t) => `<span role="button" tabindex="0" data-action="SitesfilterByType" data-args="${t}">${t}</span>`)
        .join('')}<button data-action="SitestoggleFavorite" data-args="${id}">★</button></div>`;

describe('the sites list keeps the keyboard focus when it is rendered again', () => {
    let list;
    beforeEach(() => {
        document.body.innerHTML = '<div id="sites-list-container"></div>';
        list = document.getElementById('sites-list-container');
        list.innerHTML = card('a', ['NATUREL', 'DUNE']) + card('b', ['NATUREL']);
    });

    it('gives the focus back to the same filter of the same site', () => {
        list.querySelector('#site-card-b [data-args="NATUREL"]').focus();
        const anchor = captureListFocus(list);
        list.innerHTML = card('a', ['NATUREL', 'DUNE']) + card('b', ['NATUREL']);
        expect(document.activeElement).toBe(document.body);
        restoreListFocus(list, anchor);
        expect(document.activeElement).toBe(list.querySelector('#site-card-b [data-args="NATUREL"]'));
    });

    it('follows the site when the order of the list changes', () => {
        list.querySelector('#site-card-a [data-action="SitestoggleFavorite"]').focus();
        const anchor = captureListFocus(list);
        list.innerHTML = card('b', ['NATUREL']) + card('a', ['NATUREL', 'DUNE']);
        restoreListFocus(list, anchor);
        expect(document.activeElement).toBe(list.querySelector('#site-card-a [data-action="SitestoggleFavorite"]'));
    });

    it('does nothing when the focus was outside the list or the site is gone', () => {
        expect(captureListFocus(list)).toBeNull();
        list.querySelector('#site-card-b [data-args="NATUREL"]').focus();
        const anchor = captureListFocus(list);
        list.innerHTML = card('a', ['NATUREL']);
        restoreListFocus(list, anchor);
        expect(document.activeElement).toBe(document.body);
    });
});
