import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import LogbookView from '../../js/views/logbook.js';

// Fermer la fenêtre de session rend le focus à l'élément qui l'avait avant son ouverture, et le
// navigateur fait défiler la page jusqu'à lui (constaté sous WebKit Linux : la liste du carnet
// remontait de 572 à 106 après l'enregistrement d'une session modifiée). La position du carnet
// doit rester celle d'avant la fermeture.
describe('closing the session dialog keeps the logbook position', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="logbook-screen" style="height:100px; overflow:auto">
                <button id="section-btn">Historique</button>
                <div style="height:2000px"></div>
            </div>
            <dialog id="logbook-session-modal"></dialog>`;
        vi.spyOn(LogbookView, 'releaseCoordsMap').mockImplementation(() => {});
        vi.spyOn(LogbookView, 'resetForm').mockImplementation(() => {});
    });

    afterEach(() => vi.restoreAllMocks());

    it('restores the scroll position moved by the focus returning on close', () => {
        const screen = document.getElementById('logbook-screen');
        const modal = /** @type {HTMLDialogElement} */ (document.getElementById('logbook-session-modal'));
        screen.scrollTop = 572;
        Object.defineProperty(modal, 'open', { configurable: true, value: true });
        // Le retour du focus fait défiler la page, comme le navigateur.
        modal.close = () => {
            screen.scrollTop = 106;
        };

        LogbookView.closeSessionModal();

        expect(screen.scrollTop).toBe(572);
    });
});
