import { test, expect } from '@playwright/test';

// Spec 010 (audit C7) : les éléments cliquables non natifs s'utilisent au clavier.
test.use({ serviceWorkers: 'block' });

test.beforeEach(async ({ page }) => {
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
    await page.route('https://api.open-meteo.com/**', (route) => route.fulfill({ json: [] }));
});

test('Spec 010 : un lien du pied de page s’ouvre avec Entrée', async ({ page }) => {
    await page.goto('/?mode=SITES');
    // Chaque écran a son pied de page : on prend celui de l'écran affiché.
    const legal = page.locator('.app-footer [data-args="gdpr-legal-modal"]').filter({ visible: true }).first();
    await legal.scrollIntoViewIfNeeded();
    await expect(legal).toHaveAttribute('role', 'button');
    await legal.focus();
    await expect(legal).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#gdpr-legal-modal')).toBeVisible();
});

test('Spec 010 : un filtre de type de site s’active avec Espace', async ({ page }) => {
    await page.goto('/?mode=SITES');
    const chip = page.locator('#sites-list-container [data-action="SitesfilterByType"]').first();
    await expect(chip).toBeVisible();
    const type = await chip.getAttribute('data-args');
    await chip.focus();
    await expect(chip).toBeFocused();
    const scrollBefore = await page.evaluate(() => window.scrollY);
    await page.keyboard.press(' ');
    const included = await page.evaluate(async () => {
        const S = (await import('/js/services/sites_service.js')).default;
        return S.state.filterTypeInclude;
    });
    expect(included).toContain(type);
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
});
