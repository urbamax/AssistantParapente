import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AppRouter from '../../js/core/router.js';
import AccessService from '../../js/services/access_service.js';
import '../../js/error_overlay.js';

// Les erreurs techniques (bannière rouge, détail de l'écran d'erreur) ne sont montrées qu'à la
// bêta et au propriétaire (js/services/access_service.js).
beforeEach(() => {
    document.body.innerHTML = '';
    AccessService.clear();
    vi.spyOn(console, 'time').mockImplementation(() => {});
    vi.spyOn(console, 'timeEnd').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
    vi.restoreAllMocks();
    AccessService.clear();
});

const banner = () => document.body.textContent;

function throwGlobalError() {
    window.dispatchEvent(new ErrorEvent('error', { message: 'boum', filename: 'x.js', lineno: 1, colno: 2 }));
}

function rejectGlobally() {
    const event = new Event('unhandledrejection');
    Object.assign(event, { reason: new Error('refusée') });
    window.dispatchEvent(event);
}

describe('bannière rouge des erreurs globales', () => {
    it('ne montre rien à un visiteur ni à un compte sans rôle', () => {
        throwGlobalError();
        rejectGlobally();
        expect(banner()).toBe('');
        AccessService.setRoles('pilote-A', []);
        throwGlobalError();
        expect(banner()).toBe('');
    });

    it.each(['beta', 'owner'])('montre les erreurs au rôle « %s »', (role) => {
        AccessService.setRoles('pilote-A', [role]);
        throwGlobalError();
        rejectGlobally();
        expect(banner()).toContain('GLOBAL ERROR: boum');
        expect(banner()).toContain('UNHANDLED REJECTION');
    });

    it("ne se laisse pas tromper par un cache d'appareil abîmé", () => {
        localStorage.setItem('parapente_access', '{pas du json');
        throwGlobalError();
        localStorage.setItem('parapente_access', JSON.stringify({ roles: 'beta' }));
        throwGlobalError();
        expect(banner()).toBe('');
    });
});

describe("écran d'erreur d'une vue qui plante", () => {
    async function crash() {
        const mode = 'CRASHTEST';
        const screen = document.createElement('div');
        screen.id = 'crashtest-screen';
        document.body.appendChild(screen);
        AppRouter.register(mode, {
            mount: async () => {
                throw new Error('détail-technique-secret');
            },
            unmount: async () => {},
        });
        await AppRouter.navigate(mode, { pushState: false });
        return screen;
    }

    it('garde le message et le bouton « recharger » pour tous, mais pas le détail technique', async () => {
        const screen = await crash();
        expect(screen.querySelector('[data-action="reloadApp"]')).not.toBeNull();
        expect(screen.querySelector('pre')).toBeNull();
        expect(screen.textContent).not.toContain('détail-technique-secret');
    });

    it('ajoute le détail technique pour la bêta et le propriétaire', async () => {
        AccessService.setRoles('pilote-A', ['owner']);
        const screen = await crash();
        expect(screen.querySelector('pre').textContent).toContain('détail-technique-secret');
    });
});
