import { test, expect } from '@playwright/test';

// « Tout recalculer » à côté d'« Ajouter une session » : demande confirmation avant de toucher aux vols.
test('the Tout recalculer button sits next to Ajouter une session and asks first', async ({ page }) => {
    await page.addInitScript(() => {
        window.localStorage.setItem(
            'parapente_gdpr_consent',
            JSON.stringify({ stats: true, firebase: true, gps: false, version: 2026, date: new Date().toISOString() }),
        );
    });
    await page.route('https://server.arcgisonline.com/**', (route) => route.abort());
    await page.route('https://api.open-meteo.com/**', (route) => route.abort());
    await page.goto('/');
    await page.locator('.nav-menu-btn[data-target="LOGBOOK"]').first().click();
    await page.locator('[data-action="openLogbookSection"][data-args="\'history\'"]').click();
    await expect(page.locator('#logbook-screen')).toHaveClass(/active/);

    const add = page.locator('#logbook-add-btn');
    const recompute = page.locator('#logbook-recompute-btn');
    await expect(recompute).toBeVisible();
    await expect(recompute).toHaveText(/Tout recalculer/);
    // Sur la même ligne que « Ajouter une session » (mesuré une fois l'animation d'apparition finie)
    await expect
        .poll(async () => {
            const [a, r] = [await add.boundingBox(), await recompute.boundingBox()];
            return Math.abs(a.y - r.y) < 5 && r.x > a.x;
        })
        .toBe(true);

    const dialogs = [];
    page.on('dialog', (dialog) => {
        dialogs.push(dialog.message());
        dialog.dismiss();
    });
    await recompute.click();
    await expect.poll(() => dialogs.length).toBe(1);
    expect(dialogs[0]).toContain('Recalculer tous les vols depuis leur trace IGC');
});
