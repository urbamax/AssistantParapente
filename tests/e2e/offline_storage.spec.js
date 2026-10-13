import { test, expect } from '@playwright/test';
import { statSync } from 'node:fs';

// Spec 008 : cours déjà ouverts et zones de carte déjà affichées disponibles hors ligne, grâce au
// service worker (ici activé, contrairement à sites_flow.spec.js).
const OPENED_PDF = 'courses/561c47ad1db0.pdf';
const NEVER_OPENED_PDF =
    'courses/dd005fe06258.pdf';
const OPENED_PDF_SIZE = statSync(OPENED_PDF).size;

async function loadWithServiceWorker(page) {
    await page.addInitScript(() => {
        localStorage.setItem(
            'parapente_gdpr_consent',
            JSON.stringify({
                stats: false,
                firebase: false,
                gps: false,
                version: 2026,
                date: new Date().toISOString(),
            }),
        );
    });
    await page.goto('/');
    // Le service worker contrôle la page (clients.claim à l'activation).
    // Prédicat synchrone : waitForFunction n'attend pas une promesse (une fonction async rendait
    // la main aussitôt, avant que le service worker contrôle la page).
    await page.waitForFunction(() => navigator.serviceWorker.controller?.state === 'activated');
}

/** Requête faite depuis la page (donc via le service worker) : statut, taille, type. */
const fetchFromPage = (page, url, headers = {}) =>
    page.evaluate(
        async ({ url, headers }) => {
            try {
                const res = await fetch(url, { headers });
                const body = await res.arrayBuffer();
                return { status: res.status, size: body.byteLength, type: res.headers.get('content-type') || '' };
            } catch {
                return { status: 'network-error' };
            }
        },
        { url, headers },
    );

test.describe('Spec 008 - stockage hors ligne', () => {
    // Limite de l'outil : en WebKit, le mode hors ligne simulé de Playwright coupe les requêtes avant
    // le service worker (la copie en cache n'est jamais consultée). Le comportement hors ligne est
    // donc vérifié sur Chromium ; le remplissage des caches l'est sur les deux navigateurs.
    const offlineCheckable = (browserName) => browserName !== 'webkit';

    test('un cours ouvert une fois reste lisible hors ligne ; jamais la page d’accueil à sa place', async ({
        page,
        context,
        browserName,
    }) => {
        await loadWithServiceWorker(page);
        const url = `/${encodeURI(OPENED_PDF)}`;
        // Ouverture du cours avec réseau : demandé depuis la page, donc via le service worker, comme le
        // lecteur de PDF (les navigateurs sans affichage téléchargent le PDF au lieu de l'ouvrir).
        const online = await fetchFromPage(page, url);
        expect(online.status).toBe(200);
        // L'écriture en cache se termine après la réponse : on attend la copie complète, pas seulement
        // la présence d'une entrée, avant de couper le réseau.
        await expect
            .poll(() =>
                page.evaluate(async (u) => {
                    const cached = await (await caches.open('parapente-courses-v2')).match(new URL(u, location.href));
                    return cached ? (await cached.arrayBuffer()).byteLength : 0;
                }, url),
            )
            .toBe(OPENED_PDF_SIZE);

        if (!offlineCheckable(browserName)) return;
        await context.setOffline(true);
        const full = await fetchFromPage(page, url);
        expect(full.status).toBe(200);
        expect(full.size).toBe(OPENED_PDF_SIZE);
        // Demande partielle du lecteur : le document entier (200) ou le bon morceau (206) selon le
        // navigateur, jamais une erreur.
        const ranged = await fetchFromPage(page, url, { Range: 'bytes=0-99' });
        expect([200, 206]).toContain(ranged.status);
        expect(ranged.size).toBe(ranged.status === 206 ? 100 : OPENED_PDF_SIZE);

        const never = await fetchFromPage(page, `/${encodeURI(NEVER_OPENED_PDF)}`);
        if (never.status !== 'network-error') expect(never.type).not.toContain('text/html');
        await context.setOffline(false);
    });

    test('les zones de carte affichées restent disponibles hors ligne', async ({ page, context, browserName }) => {
        const esriReachable = await page.request
            .get('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/9/170/256')
            .then((r) => r.ok())
            .catch(() => false);
        test.skip(!esriReachable, 'Serveur de fonds de carte Esri injoignable');

        await loadWithServiceWorker(page);
        await page.goto('/?mode=SITES');
        await expect(page.locator('#sites-map-canvas')).toBeVisible();
        await expect
            .poll(() => page.evaluate(async () => (await (await caches.open('parapente-tiles-v1')).keys()).length), {
                timeout: 20000,
            })
            .toBeGreaterThan(0);
        const tileUrl = await page.evaluate(
            async () => (await (await caches.open('parapente-tiles-v1')).keys())[0].url,
        );

        if (!offlineCheckable(browserName)) return;
        await context.setOffline(true);
        // Chargée comme une image, comme le fait la carte (la politique de sécurité de la page
        // interdit les appels directs à ce serveur, mais autorise ses images).
        const tile = await page.evaluate(
            (u) =>
                new Promise((resolve) => {
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.onload = () => resolve('loaded');
                    img.onerror = () => resolve('error');
                    img.src = u;
                }),
            tileUrl,
        );
        expect(tile).toBe('loaded');
        await context.setOffline(false);
    });
});
