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
