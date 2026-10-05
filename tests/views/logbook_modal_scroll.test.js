import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import LogbookView from '../../js/views/logbook.js';

// La liste du carnet doit rester à sa place derrière la fenêtre de session. Sous WebKit (Linux), le
// navigateur la faisait sauter seul (572 → 106), à l'ouverture de la fenêtre ou au retour du focus
// à sa fermeture ; le carnet enregistrait ensuite cette mauvaise position (spec 028).
describe('the session dialog keeps the logbook position', () => {
    let screen;
    let modal;

    beforeEach(() => {
        document.body.innerHTML = `
            <div id="logbook-screen" style="height:100px; overflow:auto">
                <button id="section-btn">Historique</button>
                <div style="height:2000px"></div>
            </div>
            <dialog id="logbook-session-modal"><div class="gdpr-modal-body"></div></dialog>`;
        screen = document.getElementById('logbook-screen');
        modal = /** @type {HTMLDialogElement} */ (document.getElementById('logbook-session-modal'));
        vi.spyOn(LogbookView, 'renderForm').mockImplementation(() => {});
        vi.spyOn(LogbookView, 'setSessionModalTitle').mockImplementation(() => {});
        vi.spyOn(LogbookView, 'releaseCoordsMap').mockImplementation(() => {});
        vi.spyOn(LogbookView, 'resetForm').mockImplementation(() => {});
        let open = false;
        Object.defineProperty(modal, 'open', { configurable: true, get: () => open });
        modal.showModal = () => {
            open = true;
            screen.scrollTop = 106; // saut provoqué par le navigateur à l'ouverture
        };
        modal.close = () => {
            open = false;
            screen.scrollTop = 106; // retour du focus vers un élément en haut du carnet
        };
    });

    afterEach(() => vi.restoreAllMocks());

    it('keeps the position when the dialog opens', () => {
        screen.scrollTop = 572;
        LogbookView.openSessionModal();
        expect(screen.scrollTop).toBe(572);
    });

    it('gives back the position the logbook had when the dialog opened, after it closes', () => {
        screen.scrollTop = 572;
        LogbookView.openSessionModal();
        screen.scrollTop = 300; // déplacé pendant que la fenêtre est ouverte
        LogbookView.closeSessionModal();
        expect(screen.scrollTop).toBe(572);
    });
});
