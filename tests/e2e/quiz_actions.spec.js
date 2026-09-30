import { test, expect } from '@playwright/test';

// Spec 018 : les commandes du QCM et les menus « Autre… » du matériel agissent sans
// avertissement « Unregistered action ».
test.use({ serviceWorkers: 'block' });

let warnings;

test.beforeEach(async ({ page }) => {
    warnings = [];
    page.on('console', (msg) => {
        if (msg.text().startsWith('Unregistered action triggered')) warnings.push(msg.text());
    });
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

test('Spec 018 : trier les thèmes des statistiques du QCM ne produit pas d’avertissement', async ({ page }) => {
    // Les statistiques ne s'affichent qu'avec le consentement « statistiques ».
    await page.addInitScript(() => {
        const consent = JSON.parse(localStorage.getItem('parapente_gdpr_consent'));
        localStorage.setItem('parapente_gdpr_consent', JSON.stringify({ ...consent, stats: true }));
    });
    await page.goto('/?mode=STATS');
    const byRate = page.locator('[data-action="QuizsetThemeSort"][data-args="[\'rate\']"]');
    await byRate.click();
    await expect(byRate).toBeVisible(); // la liste est redessinée avec le nouveau tri
    await page.locator('[data-action="QuizsetThemeSort"][data-args="[\'alpha\']"]').click();

    expect(warnings).toEqual([]);
});

test('Spec 018 : « Autre… » dans la marque du matériel affiche le champ libre, sans avertissement', async ({
    page,
}) => {
    await page.goto('/?mode=LOGBOOK');
    await page.locator('[data-action="LogbookswitchTab"][data-tab="equip"]').click();

    const other = page.locator('#eq-marque-autre');
    await expect(other).toBeHidden();
    await page.locator('#eq-marque').selectOption('Autre');
    await expect(other).toBeVisible();

    expect(warnings).toEqual([]);
});
