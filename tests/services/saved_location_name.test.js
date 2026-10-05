import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import SitesService from '../../js/services/sites_service.js';

// Spec 029 : enregistrer sa position sans rien taper nommait le lieu d'après l'indication du champ
// (« Adresse ou ville (ex: Annecy)... »), car le code la comparait à un ancien texte. Le code lit
// maintenant l'indication réelle de la page, celle du catalogue.
const placeholder = readFileSync('index.html', 'utf8').match(/id="address-input"[\s\S]*?placeholder="([^"]+)"/)[1];

describe('saving the current place without typing a name', () => {
    beforeEach(() => {
        document.body.innerHTML = `<input id="address-input" value="" placeholder="${placeholder}">`;
        SitesService.state.userLocation = { lat: 50.7, lng: 1.6 };
        SitesService.state.userPreferences = { ...SitesService.state.userPreferences, savedLocations: [] };
        vi.spyOn(SitesService, 'savePreferences').mockImplementation(() => {});
    });

    afterEach(() => vi.restoreAllMocks());

    it('names it « Nouveau lieu », not the hint of the field', () => {
        SitesService.saveCurrentLocation();
        expect(SitesService.state.userPreferences.savedLocations.map((l) => l.name)).toEqual(['Nouveau lieu']);
    });

    it('keeps a name shown in the field hint after a GPS fix', () => {
        document.getElementById('address-input').placeholder = 'Ma position GPS';
        SitesService.saveCurrentLocation();
        expect(SitesService.state.userPreferences.savedLocations[0].name).toBe('Ma position GPS');
    });
});
