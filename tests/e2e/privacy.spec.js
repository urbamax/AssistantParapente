import { test, expect } from '@playwright/test';

// Spec 009 : à l'ouverture, aucune requête vers les serveurs tiers qui recevaient l'adresse IP du
// visiteur avant tout consentement (polices, icônes, bibliothèque de carte, logos).
const THIRD_PARTY =
    /fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net|unpkg\.com|wordpress\.com|federation\.ffvl\.fr/;

test.use({ serviceWorkers: 'block' });

test('Spec 009 : l’accueil et la page des sites ne contactent aucun serveur tiers au démarrage', async ({ page }) => {
    const contacted = [];
    page.on('request', (request) => {
        if (THIRD_PARTY.test(request.url())) contacted.push(request.url());
    });
    await page.route('https://api.open-meteo.com/**', (route) => route.fulfill({ json: [] }));

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.goto('/?mode=SITES');
    await expect(page.locator('#sites-map-canvas')).toBeVisible();
    // Le pied de page (avec les logos) est injecté dans les écrans qui en ont un.
    await expect(page.locator('.app-footer img.ffvl-logo').first()).toBeAttached();
    await page.waitForLoadState('networkidle');

    expect(contacted).toEqual([]);
    // Les ressources hébergées sont bien chargées : police, icônes, carte, logos.
    expect(await page.evaluate(() => typeof L !== 'undefined')).toBe(true);
    expect(await page.evaluate(() => document.fonts.check('16px Inter'))).toBe(true);
    const logoLoaded = await page.evaluate(() => {
        const img = document.querySelector('.app-footer img.ffvl-logo');
        return !!img && img.complete && img.naturalWidth > 0;
    });
    expect(logoLoaded).toBe(true);
});

// Spec 013 : le service worker non plus ne contacte aucun serveur Google avant consentement (il
// chargeait le SDK Firebase depuis www.gstatic.com à son installation, pour chaque visiteur).
test.describe('Spec 013 - page et service worker, sans consentement', () => {
    test.use({ serviceWorkers: 'allow' });
    const GOOGLE = /(^|\.)(gstatic\.com|googleapis\.com|google\.com)$/;

    test('aucune requête vers Google, service worker compris', async ({ page, context, browserName }) => {
        // Les requêtes du service worker ne sont remontées par Playwright que sous Chromium.
        test.skip(browserName !== 'chromium', 'Requêtes du service worker visibles sous Chromium uniquement');
        const contacted = [];
        context.on('request', (request) => {
            if (GOOGLE.test(new URL(request.url()).hostname)) {
                contacted.push(`${request.serviceWorker() ? '[service worker] ' : ''}${request.url()}`);
            }
        });
        await context.route('https://api.open-meteo.com/**', (route) => route.fulfill({ json: [] }));
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
        // Prédicat synchrone : waitForFunction n'attend pas une promesse (une fonction async rendait
        // la main aussitôt, avant que le service worker contrôle la page).
        await page.waitForFunction(() => navigator.serviceWorker.controller?.state === 'activated');
        await page.goto('/?mode=SITES');
        await expect(page.locator('#sites-map-canvas')).toBeVisible();
        await page.waitForLoadState('networkidle');

        expect(contacted).toEqual([]);
        // Le SDK est bien chargé dans le service worker, depuis l'application (alertes en arrière-plan).
        const [worker] = context.serviceWorkers();
        expect(await worker.evaluate(() => typeof globalThis.firebase?.messaging)).toBe('function');
    });
});
