import { test, expect } from '@playwright/test';
import { aromeTailResponse, nearestHourIso, metaJson } from '../fixtures/forecasts.js';

/** Rayon enregistré de 200 km : AUTEUIL (~160 km de Boulogne-sur-Mer) reste dans la liste. */
async function useRadius200(page) {
    await page.addInitScript(() => {
        const key = 'parapente_user_prefs';
        const prefs = JSON.parse(localStorage.getItem(key) || '{}');
        localStorage.setItem(key, JSON.stringify({ ...prefs, radiusLimit: 200 }));
    });
}

/**
 * Intercepte TOUS les appels Open-Meteo (quel que soit le modèle) et renvoie, pour chaque site
 * demandé, une prévision dont les `complete` premières heures sont renseignées et les suivantes
 * vides (fin d'horizon AROME, spec 001 research R1).
 */
async function mockOpenMeteo(page, { complete, empty }) {
    await page.route('https://api.open-meteo.com/**', async (route) => {
        const url = new URL(route.request().url());
        // Heure de calcul du modèle (spec 002) : run de 06 h UTC aujourd'hui.
        if (url.pathname.endsWith('/static/meta.json')) {
            const run = new Date();
            run.setUTCHours(6, 0, 0, 0);
            return route.fulfill({ json: metaJson({ runAtS: Math.floor(run.getTime() / 1000) }) });
        }
        const count = (url.searchParams.get('latitude') || '').split(',').length;
        const one = aromeTailResponse(nearestHourIso(), { complete, empty });
        await route.fulfill({ json: count > 1 ? Array.from({ length: count }, () => one) : one });
    });
}

async function openSitesAndSearch(page, name) {
    await useRadius200(page);
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

        await useRadius200(page);
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

    test('Spec 001 US3 : le rappel « la décision vous appartient » accompagne le verdict et la légende', async ({
        page,
    }) => {
        await mockOpenMeteo(page, { complete: 6, empty: 0 });
        const card = await openSitesAndSearch(page, 'AUTEUIL');
        const reminder = 'la décision vous appartient, vérifiez sur place';
        await expect(card.locator('.verdict-reminder')).toHaveCount(1);
        await expect(card.locator('.verdict-reminder')).toContainText(reminder);
    });

    test('Spec 002 US4 : sans position, recherche centrée sur Boulogne-sur-Mer dans un rayon de 50 km', async ({
        page,
    }) => {
        const requestedLocations = [];
        await page.route('https://api.open-meteo.com/**', async (route) => {
            const url = new URL(route.request().url());
            if (url.pathname.endsWith('meta.json')) return route.fulfill({ json: {} });
            const count = (url.searchParams.get('latitude') || '').split(',').length;
            requestedLocations.push(count);
            const one = aromeTailResponse(nearestHourIso(), { complete: 4, empty: 0 });
            await route.fulfill({ json: count > 1 ? Array.from({ length: count }, () => one) : one });
        });
        await page.route('**/nominatim.openstreetmap.org/**', (route) =>
            route.fulfill({ json: [{ lat: '45.8992', lon: '6.1294', display_name: 'Annecy, France' }] }),
        );

        await page.goto('/?bypassGdpr=true');
        const gdprBanner = page.locator('#gdpr-banner');
        if (await gdprBanner.isVisible()) await page.locator('[data-action="refuseAll"]').first().click();
        await page.locator('.nav-menu-btn[data-target="SITES"]').click();

        const notice = page.locator('#default-location-notice');
        await expect(notice).toBeVisible();
        await expect(notice).toContainText('Recherche centrée sur Boulogne-sur-Mer');
        await expect(page.locator('#radius-slider')).toHaveAttribute('max', '200');
        await expect(page.locator('#radius-slider')).toHaveValue('50');
        await expect(page.locator('#radius-val-label')).toHaveText('50 km');
        // La demande de météo porte exactement sur les sites retenus par l'application, tous à
        // 50 km au plus de Boulogne-sur-Mer (spec 002, FR-016) — jamais sur toute la base.
        const kept = await page.evaluate(async () => {
            const S = (await import('/js/services/sites_service.js')).default;
            const sites = S.getGeoFilteredSites(S.getSites());
            return { count: sites.length, maxKm: Math.max(...sites.map((x) => x.distance)) };
        });
        expect(kept.count).toBeGreaterThan(0);
        expect(kept.maxKm).toBeLessThanOrEqual(50);
        await expect.poll(() => requestedLocations[0]).toBe(kept.count);

        await page.locator('#address-input').fill('Annecy');
        await page.locator('[data-action="SitesvalidateAddress"]').click();
        await expect(notice).toBeHidden();
    });

    test('Spec 002 US1 : chaque verdict indique le modèle, l’heure de récupération et le run', async ({ page }) => {
        await mockOpenMeteo(page, { complete: 6, empty: 0 });
        const card = await openSitesAndSearch(page, 'AUTEUIL');
        const context = card.locator('.forecast-context');
        await expect(context).toHaveCount(1);
        await expect(context).toContainText('AROME (Météo-France) · récupérée à');
        await expect(context).toContainText('run AROME');

        await page.locator('[data-action="toggleAdvancedSettings"]').click();
        await page.locator('#weather-model-select').selectOption('best_match');
        const refreshed = page.locator('.site-card:not(.minimized)', { hasText: 'AUTEUIL' }).first();
        await expect(refreshed.locator('.forecast-context')).toContainText(
            'Sélection automatique (Open-Meteo, multi-modèles)',
        );
        await expect(refreshed.locator('.forecast-context')).not.toContainText('run');
    });

    test('Spec 002 US2 : une prévision de plus de 3 h est signalée, « Actualiser » la rafraîchit', async ({ page }) => {
        await page.clock.install();
        let refuse = false;
        await mockOpenMeteo(page, { complete: 6, empty: 0 });
        await page.route('https://api.open-meteo.com/v1/**', async (route) => {
            if (refuse)
                return route.fulfill({
                    status: 429,
                    json: { error: true, reason: 'Hourly API request limit exceeded' },
                });
            return route.fallback();
        });
        const card = await openSitesAndSearch(page, 'AUTEUIL');
        await expect(card.locator('.forecast-context')).not.toContainText('peut être dépassée');

        await page.clock.fastForward('03:05:00');
        const stale = page
            .locator('.site-card:not(.minimized)', { hasText: 'AUTEUIL' })
            .first()
            .locator('.forecast-context');
        await expect(stale).toContainText('peut être dépassée');
        await stale.locator('[data-action="SitesrefreshWeather"]').click();
        const fresh = page
            .locator('.site-card:not(.minimized)', { hasText: 'AUTEUIL' })
            .first()
            .locator('.forecast-context');
        await expect(fresh).not.toContainText('peut être dépassée');

        await page.clock.fastForward('03:05:00');
        refuse = true;
        const again = page
            .locator('.site-card:not(.minimized)', { hasText: 'AUTEUIL' })
            .first()
            .locator('.forecast-context');
        await expect(again).toContainText('peut être dépassée');
        await again.locator('[data-action="SitesrefreshWeather"]').click();
        await page.clock.runFor(20000); // nouvelles tentatives après refus (3 s puis 12 s)
        const failed = page
            .locator('.site-card:not(.minimized)', { hasText: 'AUTEUIL' })
            .first()
            .locator('.forecast-context');
        await expect(failed).toContainText('peut être dépassée');
        await expect(failed).toContainText('Actualisation impossible');
    });

    test('Spec 002 US3 : le désaccord du second modèle est affiché pour l’heure choisie', async ({ page }) => {
        await mockOpenMeteo(page, { complete: 6, empty: 0 });
        // AUTEUIL est orienté N : vent du nord pour que le modèle principal le juge volable, et
        // second modèle (GFS) identique sauf de la pluie à l'heure 2.
        const northWind = (rainAt) => async (route) => {
            const url = new URL(route.request().url());
            const count = (url.searchParams.get('latitude') || '').split(',').length;
            const one = aromeTailResponse(nearestHourIso(), { complete: 6, empty: 0 });
            one.hourly.wind_direction_10m = one.hourly.wind_direction_10m.map(() => 0);
            if (rainAt !== null) one.hourly.precipitation[rainAt] = 2;
            await route.fulfill({ json: count > 1 ? Array.from({ length: count }, () => one) : one });
        };
        await page.route('https://api.open-meteo.com/v1/meteofrance**', northWind(null));
        await page.route('https://api.open-meteo.com/v1/gfs**', northWind(2));
        const card = await openSitesAndSearch(page, 'AUTEUIL');
        const current = () => page.locator('.site-card:not(.minimized)', { hasText: 'AUTEUIL' }).first();

        await expect(current().locator('.model-agreement')).toContainText('d’accord');
        await expect(current().locator('.model-agreement')).not.toContainText('n’est pas');

        await card.locator('.timeline-hour-dot').nth(2).click();
        await expect(current().locator('.model-agreement')).toContainText('GFS (NOAA) n’est pas d’accord');

        await current().locator('.timeline-hour-dot').nth(0).click();
        await expect(current().locator('.model-agreement')).not.toContainText('n’est pas');
    });
});
