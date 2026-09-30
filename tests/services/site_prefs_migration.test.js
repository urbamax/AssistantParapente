import { describe, it, expect } from 'vitest';
import { migrateSitePrefs } from '../../js/services/sites_service.js';
import FirebaseAuthEngine from '../../js/services/firebase_service.js';

// Spec 002, FR-018 : « Illimité » (ancienne valeur 210) n'existe plus et l'option « Meteoblue »
// n'utilisait pas Meteoblue. Les préférences enregistrées sont converties au chargement.
describe('migrateSitePrefs (spec 002, FR-018)', () => {
    it.each([
        [undefined, 50],
        [210, 50],
        [500, 50],
        [201, 50],
        [200, 200],
        [120, 120],
        [5, 10],
    ])('radiusLimit %s → %s', (from, to) => {
        const prefs = from === undefined ? {} : { radiusLimit: from };
        expect(migrateSitePrefs(prefs).radiusLimit).toBe(to);
    });

    it('renames the misleading "meteoblue" model to "best_match"', () => {
        expect(migrateSitePrefs({ weatherModel: 'meteoblue' }).weatherModel).toBe('best_match');
        expect(migrateSitePrefs({ weatherModel: 'gfs' }).weatherModel).toBe('gfs');
    });

    // Spec 019 : ouvrir le menu de tri ou de modèle enregistrait le texte « this.value ». Une valeur
    // inconnue est retirée : le réglage par défaut s'applique.
    it.each([
        ['sortMode', 'this.value'],
        ['weatherModel', 'this.value'],
        ['sortMode', null],
    ])('drops an unknown %s (%j)', (key, value) => {
        expect(migrateSitePrefs({ [key]: value })).not.toHaveProperty(key);
    });

    it.each([
        ['sortMode', ['CONDITIONS', 'DISTANCE', 'AZ']],
        ['weatherModel', ['meteofrance', 'iconeu', 'icon', 'ecmwf', 'gfs', 'best_match']],
    ])('keeps every valid %s', (key, values) => {
        for (const value of values) expect(migrateSitePrefs({ [key]: value })[key]).toBe(value);
    });

    it('leaves other keys untouched and does not mutate its input', () => {
        const input = Object.freeze({
            radiusLimit: 210,
            weatherModel: 'meteoblue',
            favoriteSites: [1, 2],
            sortMode: 'AZ',
        });
        const out = migrateSitePrefs(input);
        expect(out).toEqual({ radiusLimit: 50, weatherModel: 'best_match', favoriteSites: [1, 2], sortMode: 'AZ' });
        expect(input.radiusLimit).toBe(210);
    });

    it('is applied to preferences read from this device', () => {
        localStorage.setItem('parapente_user_prefs', JSON.stringify({ radiusLimit: 210, weatherModel: 'meteoblue' }));
        const prefs = FirebaseAuthEngine.getLocalPreferences();
        expect(prefs.radiusLimit).toBe(50);
        expect(prefs.weatherModel).toBe('best_match');
    });

    it('is applied when merging preferences coming from the cloud', () => {
        const merged = FirebaseAuthEngine.mergePreferences(
            { radiusLimit: 50 },
            { radiusLimit: 210, weatherModel: 'meteoblue' },
        );
        expect(merged.radiusLimit).toBe(50);
        expect(merged.weatherModel).toBe('best_match');
    });

    it('defaults a fresh device to 50 km', () => {
        localStorage.clear();
        expect(FirebaseAuthEngine.getLocalPreferences().radiusLimit).toBe(50);
    });
});

describe('SitesService.loadUserPreferences applies the migration (spec 002, FR-018)', () => {
    it('loads a saved "unlimited" radius as 50 km and "meteoblue" as best_match', async () => {
        const { default: SitesService } = await import('../../js/services/sites_service.js');
        const previous = window.FirebaseAuthEngine;
        delete window.FirebaseAuthEngine;
        localStorage.setItem('parapente_user_prefs', JSON.stringify({ radiusLimit: 210, weatherModel: 'meteoblue' }));
        SitesService.loadUserPreferences();
        window.FirebaseAuthEngine = previous;
        expect(SitesService.state.radiusLimit).toBe(50);
        expect(SitesService.state.weatherModel).toBe('best_match');
    });
});
