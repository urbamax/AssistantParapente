import { test, expect } from '@playwright/test';
import { grantBetaRole } from '../helpers/e2e_beta_role.js';
import { clickWhenVisible } from '../helpers/e2e_stable_wait.js';

// Spec 019 : ouvrir un menu déroulant ne change aucun réglage ; seul le choix d'une option compte.
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

test('Spec 019 : ouvrir le menu des niveaux garde le niveau, même après rechargement', async ({ page }) => {
    await page.goto('/?mode=QCM');
    const level = page.locator('#global-level-select');
    await level.selectOption('BI');
    await expect(level).toHaveValue('BI');

    await level.click(); // ouvre le menu…
    await page.keyboard.press('Escape'); // … et le referme sans rien choisir
    expect(await page.evaluate(() => localStorage.getItem('userLevel'))).toBe('BI');

    await page.reload();
    await expect(page.locator('#global-level-select')).toHaveValue('BI');
});

test('Spec 019 : ouvrir le menu de tri des sites garde le tri ; choisir « A-Z » l’applique', async ({ page }) => {
    await grantBetaRole(page); // le menu de tri est dans les réglages du calcul météo
    await page.goto('/?mode=SITES');
    await clickWhenVisible(page.locator('[data-action="toggleAdvancedSettings"]'));
    const sort = page.locator('#select-sort-mode');
    await expect(sort).toBeVisible();
    const sortMode = () =>
        page.evaluate(async () => (await import('/js/services/sites_service.js')).default.state.sortMode);
    const before = await sortMode();

    await sort.click();
    await page.keyboard.press('Escape');
    expect(await sortMode()).toBe(before);

    await sort.selectOption('AZ');
    expect(await sortMode()).toBe('AZ');
});
