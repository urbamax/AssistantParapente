import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { canOpenRoute } from '../../js/core/router.js';
import AccessService from '../../js/services/access_service.js';

// La page des sites de vol est réservée au propriétaire (rôle « owner ») : ni beta, ni visiteur.
describe('canOpenRoute', () => {
    beforeEach(() => AccessService.clear());
    afterEach(() => AccessService.clear());

    it('refuse SITES sans compte et avec le seul rôle « beta »', () => {
        expect(canOpenRoute('SITES')).toBe(false);
        AccessService.setRoles('pilote-A', ['beta']);
        expect(canOpenRoute('SITES')).toBe(false);
    });

    it('accepte SITES pour le propriétaire', () => {
        AccessService.setRoles('pilote-A', ['owner']);
        expect(canOpenRoute('SITES')).toBe(true);
    });

    it('laisse les autres écrans ouverts à tous', () => {
        for (const mode of ['MENU', 'LOGBOOK', 'QCM', 'LIBRARY', 'SAFETY', 'WELCOME'])
            expect(canOpenRoute(mode)).toBe(true);
    });
});
