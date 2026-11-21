import { test, expect } from '@playwright/test';

/**
 * Spec 053 : le mode d'emploi s'ouvre depuis l'application et décrit les fonctions récentes
 * (fiche ICE dans Sécurité ; installation, retours et Discord dans Général).
 */
test.describe('E2E - Mode d’emploi à jour', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem(
                'parapente_gdpr_consent',
                JSON.stringify({ stats: true, firebase: false, gps: false, version: 2026, date: '2026-11-20' }),
            );
        });
    });

    test('Sécurité décrit la fiche ICE et Général l’installation, les retours et Discord', async ({ page }) => {
        const pageErrors = [];
        page.on('pageerror', (err) => pageErrors.push(err.message));

        await page.goto('/?mode=WELCOME');
        await page.locator('.nav-menu-btn[data-target="MANUAL"]').click();

        const modal = page.locator('#manual-modal');
        await expect(modal).toBeVisible();

        await modal.locator('#manual-tab-safety').click();
        const safety = modal.locator('#manual-section-safety');
        await expect(safety).toBeVisible();
        await expect(safety).toContainText('quatre rubriques');
        await expect(safety).toContainText('Fiche ICE');
        await expect(safety).toContainText('Sauvegarde en ligne (facultative)');

        await modal.locator('#manual-tab-dashboard').click();
        const general = modal.locator('#manual-section-dashboard');
        await expect(general).toBeVisible();
        await expect(general).toContainText("Installer l'application");
        await expect(general).toContainText('Signaler un problème / Suggestion');
        await expect(general).toContainText('Discord');

        expect(pageErrors).toEqual([]);
    });
});
