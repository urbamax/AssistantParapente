import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import AppRouter from '../../js/core/router.js';
import IceService from '../../js/services/ice_service.js';
import { renderIceTabHtml, testIceView, printIceSticker } from '../../js/views/safety_ice.js';
import IceView from '../../js/views/ice_viewer.js';

// Les boutons de la fiche ICE ne s'affichaient que comme du texte (classes « btn » sans aucune règle CSS) et
// « Tester la vue Secours » renvoyait à l'accueil (le hash modifié déclenchait « popstate » : routeur -> MENU).
describe('boutons de la fiche ICE', () => {
    beforeEach(() => {
        localStorage.clear();
        document.body.innerHTML = '<div id="ice-root"></div>';
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        window.history.replaceState({}, '', '/');
    });

    it('utilisent le style des boutons de l’écran Sécurité, pas des classes sans règle', () => {
        const html = renderIceTabHtml();
        for (const action of [
            'SafetysaveIceProfile',
            'SafetyclearIceProfile',
            'SafetyprintIceSticker',
            'SafetytestIceView',
        ]) {
            const tag = html.match(new RegExp(`<button[^>]*data-action="${action}"[^>]*>`))[0];
            expect(tag, action).toMatch(/class="safety-btn/);
            expect(tag, action).not.toMatch(/class="btn /);
        }
        expect(html).toMatch(/class="safety-btn safety-btn-primary"[^>]*data-action="SafetyprintIceSticker"/);
    });

    it('les boutons de la page de secours aussi', async () => {
        await IceView.mount({});
        const html = document.getElementById('ice-root').innerHTML;
        expect(html).not.toMatch(/class="btn /);
        expect(html).toMatch(/class="safety-btn ice-import-btn"/);
    });

    it('« Tester la vue Secours » ouvre la fiche sans déclencher popstate (donc sans retour à l’accueil)', () => {
        document.body.innerHTML += '<input id="ice-prenom" value="Thomas" /><input id="ice-nom" value="Dupont" />';
        const navigate = vi.spyOn(AppRouter, 'navigate').mockResolvedValue(undefined);
        const popstate = vi.fn();
        window.addEventListener('popstate', popstate);
        window.history.replaceState({ mode: 'SAFETY' }, '', '/?mode=SAFETY');

        testIceView();

        window.removeEventListener('popstate', popstate);
        expect(popstate).not.toHaveBeenCalled();
        expect(navigate).toHaveBeenCalledWith('ICE');
        expect(window.location.search).toBe('?mode=SAFETY');
        expect(window.location.hash).toContain('n=Dupont');
        expect(window.location.hash).toContain('p=Thomas');
        // Rien n'est enregistré par un simple essai.
        expect(IceService.getProfile().nom).toBe('');
    });

    it('« Imprimer » enregistre, ajoute la copie compacte puis lance l’impression', () => {
        document.body.innerHTML =
            '<div id="ice-sticker-wrapper"></div><input id="ice-prenom" value="Thomas" /><input id="ice-nom" value="Dupont" />';
        const print = vi.fn();
        vi.stubGlobal('print', print);
        window.print = print;
        printIceSticker();
        expect(print).toHaveBeenCalledTimes(1);
        expect(IceService.getProfile().nom).toBe('Dupont');
    });
});
