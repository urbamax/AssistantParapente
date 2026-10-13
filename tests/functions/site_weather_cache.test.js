// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createSiteWeatherCache } from '../../functions/evaluate.mjs';

// Audit : checkFavoriteSitesWeather demandait la météo d'un site à Open-Meteo une fois PAR PILOTE.
// Avec 50 pilotes ayant Annecy en favori, cela faisait 50 requêtes identiques toutes les 30 minutes.
const site = (id) => ({ id, latitude: 45.9, longitude: 6.1 });

describe('createSiteWeatherCache', () => {
    it('ne demande un site qu’une fois, quel que soit le nombre de pilotes', async () => {
        const fetchWeather = vi.fn(async (s) => ({ site: s.id }));
        const cache = createSiteWeatherCache(fetchWeather);
        const results = [];
        for (let pilot = 0; pilot < 50; pilot++) results.push(await cache.get('annecy', site('annecy')));
        expect(fetchWeather).toHaveBeenCalledTimes(1);
        expect(new Set(results.map((r) => r.site))).toEqual(new Set(['annecy']));
        expect(cache.requests).toBe(1);
    });

    it('interroge chaque site distinct une fois', async () => {
        const fetchWeather = vi.fn(async (s) => ({ site: s.id }));
        const cache = createSiteWeatherCache(fetchWeather);
        for (const id of ['annecy', 'pilat', 'annecy', 'saint-hilaire', 'pilat', 'annecy']) {
            await cache.get(id, site(id));
        }
        expect(fetchWeather).toHaveBeenCalledTimes(3);
        expect(cache.requests).toBe(3);
    });

    it('partage la même requête entre deux demandes simultanées', async () => {
        let release;
        const fetchWeather = vi.fn(() => new Promise((resolve) => (release = resolve)));
        const cache = createSiteWeatherCache(fetchWeather);
        const a = cache.get('annecy', site('annecy'));
        const b = cache.get('annecy', site('annecy'));
        release({ windSpeed: 12 });
        expect(await a).toEqual({ windSpeed: 12 });
        expect(await b).toEqual({ windSpeed: 12 });
        expect(fetchWeather).toHaveBeenCalledTimes(1);
    });

    it('partage une erreur réseau au lieu de la retenter pour chaque pilote', async () => {
        const fetchWeather = vi.fn(async () => {
            throw new Error('Open-Meteo HTTP 429');
        });
        const cache = createSiteWeatherCache(fetchWeather);
        for (let pilot = 0; pilot < 5; pilot++) {
            await expect(cache.get('annecy', site('annecy'))).rejects.toThrow('HTTP 429');
        }
        expect(fetchWeather).toHaveBeenCalledTimes(1);
    });

    it('mémorise aussi une réponse vide (coordonnées invalides)', async () => {
        const fetchWeather = vi.fn(async () => null);
        const cache = createSiteWeatherCache(fetchWeather);
        expect(await cache.get('x', site('x'))).toBeNull();
        expect(await cache.get('x', site('x'))).toBeNull();
        expect(fetchWeather).toHaveBeenCalledTimes(1);
    });

    it('ne survit pas à l’exécution : un nouveau cache redemande la météo (jamais de donnée périmée)', async () => {
        const fetchWeather = vi.fn(async () => ({ at: 'now' }));
        await createSiteWeatherCache(fetchWeather).get('annecy', site('annecy'));
        await createSiteWeatherCache(fetchWeather).get('annecy', site('annecy'));
        expect(fetchWeather).toHaveBeenCalledTimes(2);
    });
});

describe('la fonction planifiée utilise ce cache', () => {
    const source = readFileSync('functions/index.js', 'utf8');

    it('crée un cache par exécution, dans le gestionnaire (pas au niveau du module)', () => {
        const handler = source.slice(source.indexOf('checkFavoriteSitesWeather'));
        expect(handler).toContain('createSiteWeatherCache');
        expect(source.slice(0, source.indexOf('checkFavoriteSitesWeather'))).not.toContain('createSiteWeatherCache(');
    });

    it('lit la météo via le cache, jamais directement dans la boucle des pilotes', () => {
        expect(source).toContain('weatherCache.get(siteId, site)');
        expect(source).not.toMatch(/await fetchWeatherForSite\(site, shared\)/);
    });
});
