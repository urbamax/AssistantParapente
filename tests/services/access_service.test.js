import { describe, it, expect, beforeEach, vi } from 'vitest';
import AccessService, { ACCESS_EVENTS, ROLES, applyRoleVisibility } from '../../js/services/access_service.js';
import StorageService from '../../js/services/storage.js';

beforeEach(() => {
    AccessService.clear();
});

describe('AccessService : rôles du pilote', () => {
    it('ne donne aucun droit par défaut', () => {
        expect(AccessService.canUseForecast()).toBe(false);
        expect(AccessService.getRoles()).toEqual([]);
    });

    it('donne le droit à la météo calculée avec le rôle « beta »', () => {
        AccessService.setRoles('pilote-A', [ROLES.BETA]);
        expect(AccessService.canUseForecast()).toBe(true);
        expect(AccessService.has('beta')).toBe(true);
    });

    it('donne tous les droits au propriétaire (rôle « owner »)', () => {
        AccessService.setRoles('pilote-A', [ROLES.OWNER]);
        expect(AccessService.canUseForecast()).toBe(true);
        expect(AccessService.has('beta')).toBe(true);
        expect(AccessService.has('un-futur-role')).toBe(true);
    });

    it("ignore tout ce qui n'est pas une liste de textes", () => {
        AccessService.setRoles('pilote-A', 'beta');
        expect(AccessService.canUseForecast()).toBe(false);
        AccessService.setRoles('pilote-A', [42, null, 'beta']);
        expect(AccessService.getRoles()).toEqual(['beta']);
        AccessService.setRoles('pilote-A', undefined);
        expect(AccessService.getRoles()).toEqual([]);
    });

    it('annonce un changement de rôles, et seulement quand ils changent', () => {
        const onChange = vi.fn();
        AccessService.on(ACCESS_EVENTS.CHANGED, onChange);
        AccessService.setRoles('pilote-A', ['beta']);
        AccessService.setRoles('pilote-A', ['beta']);
        expect(onChange).toHaveBeenCalledTimes(1);
        AccessService.clear();
        expect(onChange).toHaveBeenCalledTimes(2);
        expect(AccessService.canUseForecast()).toBe(false);
    });

    it("garde les rôles sur l'appareil pour le prochain démarrage, et les efface à la déconnexion", () => {
        AccessService.setRoles('pilote-A', ['beta']);
        AccessService._reloadFromStorage();
        expect(AccessService.canUseForecast()).toBe(true);

        AccessService.clear();
        expect(StorageService.get(StorageService.KEYS.ACCESS)).toBeNull();
        AccessService._reloadFromStorage();
        expect(AccessService.canUseForecast()).toBe(false);
    });

    it("n'accorde rien sur la foi d'un cache abîmé", () => {
        StorageService.set(StorageService.KEYS.ACCESS, { uid: 'pilote-A', roles: 'beta' });
        AccessService._reloadFromStorage();
        expect(AccessService.canUseForecast()).toBe(false);
        StorageService.set(StorageService.KEYS.ACCESS, 'beta');
        AccessService._reloadFromStorage();
        expect(AccessService.canUseForecast()).toBe(false);
    });

    it("retire les rôles gardés d'un autre compte quand un nouveau compte se connecte", () => {
        AccessService.setRoles('pilote-A', ['beta']);
        AccessService.expectUser('pilote-A');
        expect(AccessService.canUseForecast()).toBe(true);

        AccessService.expectUser('pilote-B');
        expect(AccessService.canUseForecast()).toBe(false);
    });
});

describe('applyRoleVisibility', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <section id="with" data-requires-role="beta" hidden></section>
            <section id="without" data-hidden-with-role="beta"></section>
            <section id="free"></section>`;
    });
    const hidden = (id) => document.getElementById(id).hidden;

    it('cache la météo calculée et montre le texte de remplacement sans le rôle', () => {
        applyRoleVisibility();
        expect(hidden('with')).toBe(true);
        expect(hidden('without')).toBe(false);
        expect(hidden('free')).toBe(false);
    });

    it('montre la météo calculée avec le rôle, et la retire quand le rôle disparaît', () => {
        AccessService.setRoles('pilote-A', ['beta']);
        applyRoleVisibility();
        expect(hidden('with')).toBe(false);
        expect(hidden('without')).toBe(true);

        AccessService.clear();
        applyRoleVisibility();
        expect(hidden('with')).toBe(true);
        expect(hidden('without')).toBe(false);
    });
});
