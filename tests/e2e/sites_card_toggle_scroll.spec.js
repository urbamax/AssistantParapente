import { test, expect } from '@playwright/test';
import { disableBackdropBlur } from '../helpers/e2e_no_backdrop_blur.js';

// Spec 045 : le « + » / « − » d'une fiche de site re-rend la liste ; l'écran ne doit pas bouger.
// Sur WebKit (Safari), vider la liste avant de la remplir faisait remonter l'écran d'environ 200 px.
test.describe("Sites - le + et le − d'une fiche gardent la position de lecture", () => {
    test.beforeEach(async ({ page }) => {
        await disableBackdropBlur(page);
        await page.addInitScript(() => {
            window.localStorage.setItem(
                'parapente_gdpr_consent',
                JSON.stringify({
                    stats: true,
                    firebase: true,
                    gps: false,
                    version: 2026,
                    date: new Date().toISOString(),
                }),
            );
        });
        await page.route('https://server.arcgisonline.com/**', (route) => route.abort());
        await page.route('https://api.open-meteo.com/**', (route) => route.abort());
    });

    test('toggling a card twice leaves the scroll position unchanged', async ({ page }) => {
        await page.goto('/?mode=SITES');
        await expect(page.locator('.site-card').nth(4)).toBeVisible();

        const scrollTop = () => page.evaluate(() => document.getElementById('sites-screen').scrollTop);
        const toggle = () => page.locator('.minimize-toggle-btn').nth(4);
        await page.evaluate(() => {
            document.getElementById('sites-screen').scrollTop = 1200;
        });

        // Playwright fait défiler jusqu'au bouton avant de cliquer : on mesure juste après ce défilement.
        for (let click = 0; click < 2; click++) {
            await toggle().scrollIntoViewIfNeeded();
            const before = await scrollTop();
            expect(before).toBeGreaterThan(0);
            const iconBefore = await toggle().locator('i').getAttribute('class');
            await toggle().click();
            await expect(toggle().locator('i')).not.toHaveClass(iconBefore);
            expect(await scrollTop()).toBe(before);
        }
    });
});
