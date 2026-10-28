import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isInstalledApp, openLink, installCourseLinkInterception } from '../../js/core/course_link.js';

// Application installée : un PDF ouvert normalement remplace l'application sans bouton retour.
// Elle passe donc par la visionneuse (js/views/course_viewer.js) ; un onglet de navigateur est inchangé.

const viewer = vi.hoisted(() => ({ openCourseViewer: vi.fn() }));
vi.mock('../../js/views/course_viewer.js', () => viewer);

function setDisplayMode(mode) {
    window.matchMedia = vi.fn((query) => ({ matches: query === `(display-mode: ${mode})` }));
}

describe('ouverture des liens et des cours', () => {
    beforeEach(() => {
        viewer.openCourseViewer.mockClear();
        vi.spyOn(window, 'open').mockImplementation(() => null);
        setDisplayMode('browser');
    });
    afterEach(() => {
        vi.restoreAllMocks();
        delete window.navigator.standalone;
    });

    it("reconnaît l'application installée (Android/bureau et Safari iOS)", () => {
        expect(isInstalledApp()).toBe(false);
        setDisplayMode('standalone');
        expect(isInstalledApp()).toBe(true);
        setDisplayMode('browser');
        Object.defineProperty(window.navigator, 'standalone', { value: true, configurable: true });
        expect(isInstalledApp()).toBe(true);
    });

    it('ouvre un cours dans un nouvel onglet quand on est dans le navigateur', () => {
        openLink('courses/abc.pdf#page=3');
        expect(window.open).toHaveBeenCalledWith('courses/abc.pdf#page=3', '_blank', 'noopener,noreferrer');
        expect(viewer.openCourseViewer).not.toHaveBeenCalled();
    });

    it("ouvre un cours dans la visionneuse quand l'application est installée", async () => {
        setDisplayMode('standalone');
        openLink('courses/abc.pdf#page=3');
        await vi.waitFor(() => expect(viewer.openCourseViewer).toHaveBeenCalledWith('courses/abc.pdf#page=3'));
        expect(window.open).not.toHaveBeenCalled();
    });

    it("garde un nouvel onglet pour un lien qui n'est pas un cours du site, même installée", () => {
        setDisplayMode('standalone');
        openLink('https://example.com/doc.pdf');
        openLink('https://example.com/page');
        expect(window.open).toHaveBeenCalledTimes(2);
        expect(viewer.openCourseViewer).not.toHaveBeenCalled();
    });

    it('intercepte les liens <a target="_blank"> vers un cours, seulement quand l’application est installée', async () => {
        installCourseLinkInterception();
        document.body.innerHTML =
            '<a id="pdf" href="courses/abc.pdf#page=2" target="_blank"><span id="inner">x</span></a>' +
            '<a id="web" href="https://example.com/" target="_blank">y</a>';

        // Lu au bout de la remontée, puis annulé pour que le simulateur ne tente pas de charger la page.
        const click = (id) => {
            let intercepted = false;
            const last = (event) => {
                intercepted = event.defaultPrevented;
                event.preventDefault();
            };
            window.addEventListener('click', last, { once: true });
            document.getElementById(id).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            return intercepted;
        };
        // Dans le navigateur (hors installée), isInstalledApp() est faux : le lien n'est jamais touché.
        expect(isInstalledApp()).toBe(false);

        setDisplayMode('standalone');
        expect(click('web')).toBe(false);
        expect(click('inner')).toBe(true);
        await vi.waitFor(() => expect(viewer.openCourseViewer).toHaveBeenCalledTimes(1));
        expect(viewer.openCourseViewer.mock.calls[0][0]).toMatch(/courses\/abc\.pdf#page=2$/);
    });
});
