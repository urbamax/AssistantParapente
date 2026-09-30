import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import AppEvents from '../../js/core/events.js';
import SitesService from '../../js/services/sites_service.js';
import SitesView from '../../js/views/sites.js';
import { FirebaseAuthEngine } from '../../js/services/firebase_service.js';

// Spec 019 : ouvrir un menu déroulant (un clic) ne doit rien changer ; seul le choix d'une option
// (changement de valeur) lance son action. Et « Mot de passe oublié ? » demande bien l'e-mail.
describe('drop-down menus act on change only (spec 019)', () => {
    const calls = [];

    beforeAll(() => {
        AppEvents.init();
        AppEvents.register('spec019Setting', (value) => calls.push(value));
    });

    afterEach(() => {
        calls.length = 0;
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    const menu = (action) => {
        document.body.innerHTML = `
            <select data-action="${action}"><option value="BI">BI</option><option value="BP">BP</option></select>`;
        return /** @type {HTMLSelectElement} */ (document.querySelector('select'));
    };

    it('opening a menu (click) does not run its action', () => {
        menu('spec019Setting').click();
        expect(calls).toEqual([]);
    });

    it('choosing an option runs the action once with the chosen value', () => {
        const select = menu('spec019Setting');
        select.value = 'BP';
        select.dispatchEvent(new Event('change', { bubbles: true }));
        expect(calls).toEqual(['BP']);
    });

    it('buttons still run their action on click', () => {
        document.body.innerHTML = `<button data-action="spec019Setting" data-args="'go'">Go</button>`;
        document.querySelector('button').click();
        expect(calls).toEqual(['go']);
    });

    describe('sites screen menus', () => {
        afterEach(() => {
            if (SitesView._clickHandler) document.body.removeEventListener('click', SitesView._clickHandler, true);
            if (SitesView._changeHandler) document.body.removeEventListener('change', SitesView._changeHandler, true);
        });

        it('opening the sort menu keeps the sort; choosing an option applies it once', () => {
            SitesView.setupEventListeners();
            vi.spyOn(SitesView, 'renderList').mockImplementation(() => {});
            vi.spyOn(SitesView, 'updateMapMarkers').mockImplementation(() => {});
            const change = vi.spyOn(SitesService, 'changeSortMode').mockImplementation(() => {});
            document.body.innerHTML = `
                <select data-action="changeSortMode"><option value="CONDITIONS">C</option><option value="AZ">A-Z</option></select>`;
            const select = /** @type {HTMLSelectElement} */ (document.querySelector('select'));

            select.click();
            expect(change).not.toHaveBeenCalled();

            select.value = 'AZ';
            select.dispatchEvent(new Event('change', { bubbles: true }));
            expect(change).toHaveBeenCalledTimes(1);
            expect(change).toHaveBeenCalledWith('AZ');
        });
    });
});

describe('forgot password (spec 019)', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    it('requests a reset email for the typed address', async () => {
        document.body.innerHTML = '<input id="login-email" value="  pilote@example.com ">';
        const reset = vi.spyOn(FirebaseAuthEngine, 'resetPassword').mockResolvedValue(undefined);

        await FirebaseAuthEngine.forgotPassword();

        expect(reset).toHaveBeenCalledWith('pilote@example.com');
    });

    it('asks for the address when the field is empty', async () => {
        document.body.innerHTML = '<input id="login-email" value="">';
        const reset = vi.spyOn(FirebaseAuthEngine, 'resetPassword').mockResolvedValue(undefined);
        const alert = vi.spyOn(FirebaseAuthEngine, 'showAlert').mockImplementation(() => {});

        await FirebaseAuthEngine.forgotPassword();

        expect(reset).not.toHaveBeenCalled();
        expect(alert).toHaveBeenCalledWith(expect.stringContaining('adresse e-mail'), 'error');
    });
});
