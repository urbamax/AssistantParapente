import { test, expect } from '@playwright/test';

// Le champ « Treuilleur » n'apparaît que pour un vol au treuil : la règle `.form-group { display:
// flex }` l'emportait sur l'attribut hidden, il restait affiché pour un vol en soaring.
test('the winch operator field is shown only for a winch flight', async ({ page }) => {
    // Consentement déjà donné : sans lui, le bandeau RGPD recouvre le menu (WebKit).
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
    await page.locator('#logbook-add-btn').click();
    await expect(page.locator('#logbook-session-modal')).toBeVisible();

    const field = page.locator('#lb-treuilleur-group');
    await expect(field).toBeHidden();
    await page.selectOption('#lb-typeVol', 'Treuil');
    await expect(field).toBeVisible();
    await page.selectOption('#lb-typeVol', 'Soaring');
    await expect(field).toBeHidden();
});
