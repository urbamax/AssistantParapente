import { describe, it, expect, beforeEach, vi } from 'vitest';
import IceView from '../../js/views/ice_viewer.js';
import IceService, { encodePayload } from '../../js/services/ice_service.js';

describe('IceView (js/views/ice_viewer.js)', () => {
    beforeEach(() => {
        localStorage.clear();
        document.body.innerHTML = '<div id="ice-root"></div>';
        window.location.hash = '';
    });

    it('renders empty fallback when no data is provided', async () => {
        await IceView.mount({});
        const root = document.getElementById('ice-root');
        expect(root.textContent).toContain('URGENCE PILOTE · ICE');
        expect(root.textContent).toContain('Pilote non renseigné');
        expect(root.textContent).toContain("Aucun contact d'urgence");
    });

    it('reads ICE data from window.location.hash and displays full emergency card', async () => {
        const payload = encodePayload({
            nom: 'Urbaniak',
            prenom: 'Maxime',
            birthYear: '1990',
            contact1Name: 'Sophie',
            contact1Phone: '0612345678',
            contact1Rel: 'Conjointe',
            bloodGroup: 'O+',
            allergies: 'Pénicilline',
            remarques: 'Aucun',
            ffvl: '1234567',
            insurance: 'Europ Assistance',
        });

        window.location.hash = '#' + payload;
        await IceView.mount({});

        const root = document.getElementById('ice-root');
        expect(root.textContent).toContain('Maxime Urbaniak');
        expect(root.textContent).toContain('O+');
        expect(root.textContent).toContain('Sophie');
        // Numéro au format international : un secouriste étranger le compose tel quel.
        expect(root.textContent).toContain('+33 6 12 34 56 78');
        expect(root.textContent).toContain('Pénicilline');
        expect(root.textContent).toContain('1234567');

        // Vérifie les liens d'appel direct
        const callBtn = root.querySelector('a[href="tel:+33612345678"]');
        expect(callBtn).not.toBeNull();
        expect(root.querySelector('a[href="tel:112"]')).not.toBeNull();
    });

    it('imports profile data into local storage on importToProfile()', async () => {
        IceView.profile = {
            nom: 'Test',
            prenom: 'Jean',
            contact1Phone: '0600000000',
        };

        window.alert = vi.fn();
        IceView.importToProfile();

        const stored = IceService.getProfile();
        expect(stored.nom).toBe('Test');
        expect(stored.prenom).toBe('Jean');
        expect(window.alert).toHaveBeenCalled();
    });
});
