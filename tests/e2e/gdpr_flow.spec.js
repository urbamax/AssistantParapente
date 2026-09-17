import { test, expect } from '@playwright/test';

test.describe('E2E - GDPR Consent Flow', () => {
    test.beforeEach(async ({ page }) => {
        // Nettoyage complet
        await page.addInitScript(() => {
            window.localStorage.clear();
        });
    });

    test("L'utilisateur voit la bannière GDPR, peut paramétrer et refuser", async ({ page }) => {
        page.on('console', (msg) => console.log('BROWSER:', msg.text()));
        page.on('pageerror', (err) => console.log('PAGE_ERROR:', err.message));

        await page.goto('/');

        // 1. La bannière doit être visible
        const banner = page.locator('#gdpr-banner');
        await expect(banner).toBeVisible();

        // 2. Cliquer sur Paramétrer
        await banner.locator('.gdpr-btn-settings').first().click();

        // 3. La modale de paramètres doit s'afficher
        const modal = page.locator('#gdpr-settings-modal');
        await expect(modal).toBeVisible();

        // 4. Décocher toutes les options (Stats et Firebase)
        // Par défaut, l'application pourrait les avoir cochées, ou elles pourraient être décochées.
        // On force un refus global via le bouton "Tout Refuser" de la modale (qui a .gdpr-btn-settings ou data-action="refuseAll")
        const refuseAllBtn = modal.locator('[data-action="refuseAll"]');
        await refuseAllBtn.click();

        // 5. La modale et la bannière doivent disparaître
        await page.waitForTimeout(1000); // Wait for transition
        const classList = await modal.evaluate((node) => node.className);
        console.log('MODAL CLASS:', classList);

        await expect(modal).not.toHaveClass(/active/);
        await expect(banner).not.toHaveClass(/active/);

        // 6. Vérifier que les préférences sont sauvegardées en local et respectent le refus
        const prefs = await page.evaluate(() => JSON.parse(localStorage.getItem('parapente_gdpr_consent')));
        expect(prefs).toBeDefined();
        expect(prefs.stats).toBe(false);
        expect(prefs.firebase).toBe(false);
    });
});
