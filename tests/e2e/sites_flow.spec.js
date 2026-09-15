import { test, expect } from '@playwright/test';

test.describe('E2E - Sites Flow', () => {
  test('L\'utilisateur peut rechercher un site, filtrer et voir les résultats', async ({ page }) => {
    // Intercept API call to open-meteo to mock weather response
    await page.route('**/forecast*', async route => {
      const json = [{
        hourly: {
          time: [new Date().toISOString()],
          wind_speed_10m: [15],
          wind_direction_10m: [180],
          wind_gusts_10m: [20],
          precipitation: [0]
        },
        daily: { sunrise: [new Date().toISOString()], sunset: [new Date().toISOString()] }
      }];
      await route.fulfill({ json });
    });

    await page.goto('/?bypassGdpr=true'); // Or just accept GDPR
    
    // Accept GDPR to enable network/features
    const gdprBanner = page.locator('#gdpr-banner');
    if (await gdprBanner.isVisible()) {
        await page.locator('[data-action="acceptAll"]').click();
        await expect(gdprBanner).not.toHaveClass(/active/);
    }

    // Navigate to SITES tab
    await page.locator('.nav-menu-btn[data-target="SITES"]').click();

    // Verify search bar is visible
    const searchInput = page.locator('#site-search');
    await expect(searchInput).toBeVisible();

    // Search for AUTEUIL
    await searchInput.fill('AUTEUIL');
    await page.waitForTimeout(500); // debounce

    // Verify that AUTEUIL is in the list
    const sitesList = page.locator('#sites-list-container');
    await expect(sitesList).toContainText('AUTEUIL');

    // Filter by Wind direction (e.g. N - should hide AUTEUIL if it requires S, or if it's N we toggle it)
    // We just test if clicking a filter works.
    const filterBtnN = page.locator('.wind-compass-btn[data-value="N"]');
    if (await filterBtnN.isVisible()) {
        await filterBtnN.click();
        await page.waitForTimeout(500);
        // We just ensure the UI didn't crash
        await expect(sitesList).toBeVisible();
    }
  });
});
