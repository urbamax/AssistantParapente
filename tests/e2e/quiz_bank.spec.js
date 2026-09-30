import { test, expect } from '@playwright/test';

// Spec 017 : le filtre de thème de la banque de questions filtre la liste sans avertissement.
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

test('Spec 017 : le filtre de thème de la banque filtre la liste, sans avertissement « Unregistered action »', async ({
    page,
}) => {
    const warnings = [];
    page.on('console', (msg) => {
        if (msg.text().startsWith('Unregistered action triggered')) warnings.push(msg.text());
    });
    await page.goto('/?mode=QCM_BANK');

    const items = page.locator('#bank-results .bank-item');
    const themes = page.locator('#bank-results .bank-item-theme');
    await expect(items.first()).toBeVisible();
    const total = await items.count();

    const filter = page.locator('#bank-theme-filter');
    await filter.selectOption('Météo');
    await expect.poll(() => items.count()).toBeLessThan(total);
    const shown = await themes.allTextContents();
    expect(shown.length).toBeGreaterThan(0);
    expect(new Set(shown.map((s) => s.trim()))).toEqual(new Set(['Météo']));

    await filter.selectOption('ALL');
    await expect.poll(() => items.count()).toBe(total);

    expect(warnings).toEqual([]);
});
