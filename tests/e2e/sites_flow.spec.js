import { test, expect } from '@playwright/test';
import { aromeTailResponse } from '../fixtures/forecasts.js';

/**
 * Intercepte TOUS les appels Open-Meteo (quel que soit le modèle) et renvoie, pour chaque site
 * demandé, une prévision dont les `complete` premières heures sont renseignées et les suivantes
 * vides (fin d'horizon AROME, spec 001 research R1).
 */
async function mockOpenMeteo(page, { complete, empty }) {
    await page.route('https://api.open-meteo.com/**', async (route) => {
        const url = new URL(route.request().url());
        const count = (url.searchParams.get('latitude') || '').split(',').length;
        const start = new Date();
        start.setMinutes(0, 0, 0);
        const one = aromeTailResponse(start.toISOString(), { complete, empty });
        await route.fulfill({ json: count > 1 ? Array.from({ length: count }, () => one) : one });
    });
}

async function openSitesAndSearch(page, name) {
    await page.goto('/?bypassGdpr=true');
    const gdprBanner = page.locator('#gdpr-banner');
    if (await gdprBanner.isVisible()) {
        await page.locator('[data-action="acceptAll"]').click();
        await expect(gdprBanner).not.toHaveClass(/active/);
    }
    await page.locator('.nav-menu-btn[data-target="SITES"]').click();
    const searchInput = page.locator('#site-search');
    await expect(searchInput).toBeVisible();
    await searchInput.fill(name);
    await page.waitForTimeout(500); // debounce
    const card = page.locator('.site-card', { hasText: name }).first();
    await expect(card).toBeVisible();
    // Les sites non favoris sont réduits par défaut : on déplie la carte pour voir sa météo.
    if (await card.evaluate((el) => el.classList.contains('minimized'))) {
        await card.locator('[data-action="toggleMinimize"]').click();
    }
    const expanded = page.locator('.site-card:not(.minimized)', { hasText: name }).first();
    await expect(expanded.locator('.ranking-timeline')).toBeVisible();
    return expanded;
}

test.describe('E2E - Sites Flow', () => {
    // Le service worker fait lui-même les appels Open-Meteo, que page.route() ne voit pas :
    // on le bloque pour que les prévisions simulées soient réellement utilisées.
    test.use({ serviceWorkers: 'block' });

    test("L'utilisateur peut rechercher un site, filtrer et voir les résultats", async ({ page }) => {
        // Intercept API call to open-meteo to mock weather response
        await page.route('**/forecast*', async (route) => {
            const json = [
                {
                    hourly: {
                        time: [new Date().toISOString()],
                        wind_speed_10m: [15],
                        wind_direction_10m: [180],
                        wind_gusts_10m: [20],
                        precipitation: [0],
                    },
                    daily: { sunrise: [new Date().toISOString()], sunset: [new Date().toISOString()] },
                },
            ];
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

    test('Spec 001 US1 : une heure sans données affiche « Prévision incomplète », jamais un verdict', async ({
        page,
    }) => {
        await mockOpenMeteo(page, { complete: 2, empty: 4 });
        const card = await openSitesAndSearch(page, 'AUTEUIL');

        // Heure 0 : complète, verdict normal.
        await expect(card.locator('.site-weather-row')).not.toContainText('Prévision incomplète');

        // Heure 3 : vide (fin d'horizon).
        const emptyDot = card.locator('.timeline-hour-dot').nth(3);
        await expect(emptyDot).toHaveClass(/timeline-hour-dot--incomplete/);
        await expect(emptyDot).toHaveAttribute('title', /Prévision incomplète/);
        await emptyDot.click();

        const refreshedCard = page.locator('.site-card:not(.minimized)', { hasText: 'AUTEUIL' }).first();
        const weatherRow = refreshedCard.locator('.site-weather-row');
        await expect(weatherRow).toContainText('Prévision incomplète');
        await expect(weatherRow).toContainText('Indisponible : vent moyen, rafales');
        await expect(weatherRow).not.toContainText('Vent hors limites');
        await expect(weatherRow).not.toContainText('null');
        await expect(page.locator('.marker-core--incomplete').first()).toBeAttached();
    });

    test('Spec 001 US1 : sans aucune heure complète, la carte indique « Aucune prévision fiable »', async ({
        page,
    }) => {
        await mockOpenMeteo(page, { complete: 0, empty: 6 });
        const card = await openSitesAndSearch(page, 'AUTEUIL');
        await expect(card).toContainText('Aucune prévision fiable pour ce site');
        await expect(card).not.toContainText('Aucun créneau favorable');
    });

    test("Spec 001 US2 : un site sans orientation connue n'a ni score ni « Excellent »", async ({ page }) => {
        await mockOpenMeteo(page, { complete: 6, empty: 0 });
        // Sert la base de sites réelle, en retirant l'orientation d'AUTEUIL.
        await page.route('**/js/data/sites_data.json*', async (route) => {
            const response = await route.fetch();
            const sites = await response.json();
            for (const site of sites) {
                if (site.nom === 'AUTEUIL') {
                    delete site.orientations_vent;
                    delete site.orientation;
                }
            }
            await route.fulfill({ response, json: sites });
        });
        const card = await openSitesAndSearch(page, 'AUTEUIL');
        const weatherRow = card.locator('.site-weather-row');
        await expect(weatherRow).toContainText('Orientation du décollage inconnue : à vérifier');
        await expect(weatherRow).not.toContainText('/100');
        await expect(weatherRow).not.toContainText(/Excellent|Bon \(|Passable/);
    });
});
