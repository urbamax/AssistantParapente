import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import BaseView from '../../js/core/base_view.js';

describe('BaseView', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('tracks mounted state across mount() and unmount()', async () => {
        const view = new BaseView();
        expect(view._isMounted).toBe(false);
        await view.mount({ id: 1 });
        expect(view._isMounted).toBe(true);
        await view.unmount();
        expect(view._isMounted).toBe(false);
    });

    it('renderErrorState hides target container, escapes HTML, and renders retry button', () => {
        document.body.innerHTML = '<div id="wrapper"><div id="test-screen">content</div></div>';
        const view = new BaseView();

        view.renderErrorState('<img src=x onerror=alert(1)> Boom', 'test-screen');

        expect(document.getElementById('test-screen').style.display).toBe('none');
        const errBox = document.getElementById('global-view-error');
        expect(errBox).not.toBeNull();
        expect(errBox.parentNode).toBe(document.getElementById('wrapper'));
        expect(errBox.querySelector('img')).toBeNull();
        expect(errBox.textContent).toContain('<img src=x onerror=alert(1)> Boom');
        expect(errBox.querySelector('[data-action="reloadApp"]')).not.toBeNull();
    });

    it('renderErrorState falls back to document.body and reuses existing #global-view-error', () => {
        const view = new BaseView();
        view.renderErrorState('Erreur 1');
        view.renderErrorState('Erreur 2');

        const boxes = document.querySelectorAll('#global-view-error');
        expect(boxes).toHaveLength(1);
        expect(boxes[0].textContent).toContain('Erreur 2');
    });
});
