import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import AppEvents from '../../js/core/events.js';
import SitesService from '../../js/services/sites_service.js';
import SitesView from '../../js/views/sites.js';

// Spec 016 : les contrôles de l'écran des sites (data-action nu, ex. « toggleDropdown ») sont
// exécutés par la délégation propre à SitesView (phase de capture). La délégation globale ne doit
// ni avertir « Unregistered action triggered » ni les exécuter une seconde fois.
describe('sites controls with both delegations active (spec 016)', () => {
    let warn;

    beforeAll(() => {
        AppEvents.init();
    });

    beforeEach(() => {
        SitesView.setupEventListeners(); // replaces the previous test's listeners
        vi.spyOn(SitesView, 'renderList').mockImplementation(() => {});
        vi.spyOn(SitesView, 'updateMapMarkers').mockImplementation(() => {});
        warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    const unregisteredWarnings = () =>
        warn.mock.calls.filter((args) => String(args[0]).startsWith('Unregistered action triggered'));

    it('runs a screen action once and does not warn (menu opens, then closes)', () => {
        document.body.innerHTML = `
            <button data-action="toggleDropdown" data-args="'map-settings'">Cartes actives</button>
            <div id="menu-map-settings" class="filter-dropdown-menu"></div>`;
        const toggle = vi.spyOn(SitesView, 'toggleDropdown');
        const button = document.querySelector('button');
        const menu = document.getElementById('menu-map-settings');

        button.click();
        expect(toggle).toHaveBeenCalledTimes(1);
        expect(menu.classList.contains('show')).toBe(true);

        button.click();
        expect(toggle).toHaveBeenCalledTimes(2);
        expect(menu.classList.contains('show')).toBe(false);

        expect(unregisteredWarnings()).toEqual([]);
    });

    it('runs a service action once and does not warn', () => {
        document.body.innerHTML = `<button data-action="toggleFilterFavoritesOnly">Favoris</button>`;
        const toggle = vi.spyOn(SitesService, 'toggleFilterFavoritesOnly').mockImplementation(() => {});

        document.querySelector('button').click();

        expect(toggle).toHaveBeenCalledTimes(1);
        expect(unregisteredWarnings()).toEqual([]);
    });

    it('applies a select change once and does not warn', () => {
        document.body.innerHTML = `
            <select data-action="changeSortMode"><option value="DISTANCE">A</option><option value="SCORE">B</option></select>`;
        const change = vi.spyOn(SitesService, 'changeSortMode').mockImplementation(() => {});
        const select = document.querySelector('select');
        select.value = 'SCORE';

        select.dispatchEvent(new Event('change', { bubbles: true }));

        expect(change).toHaveBeenCalledTimes(1);
        expect(change).toHaveBeenCalledWith('SCORE');
        expect(unregisteredWarnings()).toEqual([]);
    });

    it('still warns for an action nobody handles', () => {
        document.body.innerHTML = `<button data-action="spec016NoSuchAction">?</button>`;

        document.querySelector('button').click();

        expect(unregisteredWarnings()).toEqual([['Unregistered action triggered: spec016NoSuchAction']]);
    });
});
