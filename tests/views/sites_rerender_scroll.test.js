import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import SitesService from '../../js/services/sites_service.js';
import SitesView from '../../js/views/sites.js';

// Re-rendering the list (the "+" of a card, a favourite, a cloud sync…) must not send the pilot back
// to the top: the container is no longer emptied before it is refilled, and the reading position is
// put back at the end of the render.
describe('sites: re-rendering the list keeps the scroll position', () => {
    /** @type {HTMLElement} */
    let screen;
    /** @type {HTMLElement} */
    let list;
    /** @type {string[]} */
    let assigned;

    beforeEach(() => {
        document.body.innerHTML = '<div id="sites-screen"><div id="sites-list-container"></div></div>';
        screen = /** @type {HTMLElement} */ (document.getElementById('sites-screen'));
        list = /** @type {HTMLElement} */ (document.getElementById('sites-list-container'));

        // A browser that measures an emptied container clamps the scroll position to the top.
        assigned = [];
        const real = /** @type {PropertyDescriptor} */ (
            Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML')
        );
        Object.defineProperty(list, 'innerHTML', {
            configurable: true,
            get() {
                return real.get?.call(this);
            },
            set(value) {
                assigned.push(String(value));
                if (value === '') screen.scrollTop = 0;
                real.set?.call(this, value);
            },
        });

        vi.spyOn(SitesService, 'getSites').mockReturnValue([]);
        vi.spyOn(SitesService, 'getFilteredAndSortedSites').mockReturnValue([]);
        vi.spyOn(SitesView, 'renderLocationContext').mockImplementation(() => {});
        vi.spyOn(SitesView, 'updateBadges').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    it('never empties the container before filling it', () => {
        SitesView.renderList();
        expect(assigned).toHaveLength(1);
        expect(assigned[0]).not.toBe('');
    });

    it('keeps the reading position across a re-render', () => {
        screen.scrollTop = 640;
        SitesView.renderList();
        expect(screen.scrollTop).toBe(640);
    });
});
