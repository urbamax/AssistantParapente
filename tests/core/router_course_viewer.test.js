import { describe, it, expect, vi, afterEach } from 'vitest';
import AppRouter from '../../js/core/router.js';

// Le retour (geste ou bouton du téléphone) qui ferme la visionneuse de cours ne doit pas remonter l'écran
// en dessous : le pilote retrouve l'application exactement comme il l'a laissée.
describe('retour depuis la visionneuse de cours', () => {
    afterEach(() => {
        document.body.classList.remove('course-viewer-open');
        vi.restoreAllMocks();
    });

    it('le routeur ignore le retour tant que la visionneuse est ouverte, pas ensuite', () => {
        const navigate = vi.spyOn(AppRouter, 'navigate').mockResolvedValue(undefined);
        AppRouter.initHistory();

        document.body.classList.add('course-viewer-open');
        window.dispatchEvent(new PopStateEvent('popstate', { state: { mode: 'QCM', params: {} } }));
        expect(navigate).not.toHaveBeenCalled();

        document.body.classList.remove('course-viewer-open');
        window.dispatchEvent(new PopStateEvent('popstate', { state: { mode: 'QCM', params: {} } }));
        expect(navigate).toHaveBeenCalledWith('QCM', expect.objectContaining({ pushState: false }));
    });
});
