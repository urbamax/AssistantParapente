import { test, expect } from '@playwright/test';
import { aromeTailResponse, nearestHourIso, metaJson } from '../fixtures/forecasts.js';
import { grantBetaRole } from '../helpers/e2e_beta_role.js';
import { clickWhenVisible } from '../helpers/e2e_stable_wait.js';

/**
 * Ferme la bannière RGPD si aucun consentement n'est enregistré. La bannière apparaît avec un léger
 * retard : on attend qu'elle soit réellement active plutôt que de tester sa visibilité à l'instant T
 * (source d'instabilité), et on ne la cherche pas du tout si le consentement existe déjà.
 */
async function acceptGdprIfAsked(page) {
    const hasConsent = await page.evaluate(() => !!localStorage.getItem('parapente_gdpr_consent'));
    if (hasConsent) return;
    const banner = page.locator('#gdpr-banner.active');
    await banner.waitFor({ state: 'visible', timeout: 5000 });
    await clickWhenVisible(page.locator('[data-action="acceptAll"]'));
    await expect(page.locator('#gdpr-banner')).not.toHaveClass(/active/);
}

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
    await acceptGdprIfAsked(page);
    await clickWhenVisible(page.locator('.nav-menu-btn[data-target="SITES"]'));
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
    test.beforeEach(async ({ page }) => grantBetaRole(page));

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
            await clickWhenVisible(page.locator('[data-action="acceptAll"]'));
            await expect(gdprBanner).not.toHaveClass(/active/);
        }

        // Navigate to SITES tab
        await clickWhenVisible(page.locator('.nav-menu-btn[data-target="SITES"]'));

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
        await clickWhenVisible(page.locator('.nav-menu-btn[data-target="SITES"]'));

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
        await clickWhenVisible(page.locator('[data-action="SitesvalidateAddress"]'));
        await expect(notice).toBeHidden();
    });

    test('Spec 002 US1 : chaque verdict indique le modèle, l’heure de récupération et le run', async ({ page }) => {
        await mockOpenMeteo(page, { complete: 6, empty: 0 });
        const card = await openSitesAndSearch(page, 'AUTEUIL');
        const context = card.locator('.forecast-context');
        await expect(context).toHaveCount(1);
        await expect(context).toContainText('AROME (Météo-France) · récupérée à');
        await expect(context).toContainText('run AROME');

        await clickWhenVisible(page.locator('[data-action="toggleAdvancedSettings"]'));
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

    test('Spec 003 : les détails des sites s’affichent en entier, liens sûrs et caractères réparés', async ({
        page,
    }) => {
        // Favoris : toujours affichés, quel que soit le rayon autour de Boulogne-sur-Mer.
        await page.addInitScript(() => {
            localStorage.setItem(
                'parapente_user_prefs',
                JSON.stringify({ favoriteSites: ['mathay-13452', 'notre-dame-de-la-mer-1098'], radiusLimit: 10 }),
            );
        });
        await mockOpenMeteo(page, { complete: 2, empty: 0 });
        await page.goto('/?bypassGdpr=true');
        const gdprBanner = page.locator('#gdpr-banner');
        if (await gdprBanner.isVisible()) await page.locator('[data-action="refuseAll"]').first().click();
        await clickWhenVisible(page.locator('.nav-menu-btn[data-target="SITES"]'));

        const openDetails = async (name) => {
            const card = page.locator('#sites-list-container .site-card', { hasText: name }).first();
            await expect(card).toBeVisible();
            if (await card.evaluate((el) => el.classList.contains('minimized'))) {
                await card.locator('[data-action="toggleMinimize"]').click();
            }
            const open = page.locator('#sites-list-container .site-card:not(.minimized)', { hasText: name }).first();
            await open.locator('details.site-details-toggle summary').click();
            return open;
        };

        // MATHAY (site de décollage) : SORGIA — Les Prés Gelés est un atterrissage seul, masqué par défaut.
        const mathay = await openDetails('MATHAY');
        await expect(mathay).toContainText('<<corniches calcaires du Doubs>>');

        const ndm = await openDetails('Les Grandes Bruy');
        const charter = ndm.locator('a[href*="thermiquefrancilien.org"]').first();
        await expect(charter).toHaveAttribute('target', '_blank');
        await expect(charter).toHaveAttribute('rel', 'noopener noreferrer');
        await expect(ndm).toContainText('l’objectif exclusif');
    });

    // Spec 004 : la carte reste cadrée sur le rayon autour de Boulogne-sur-Mer, et le rayon ne
    // bouge pas tout seul (boucle redimensionnement → rayon → recadrage qui finissait à 200 km).
    async function openSitesWithoutPosition(page, prefs) {
        if (prefs) {
            await page.addInitScript((p) => localStorage.setItem('parapente_user_prefs', JSON.stringify(p)), prefs);
        }
        await mockOpenMeteo(page, { complete: 2, empty: 0 });
        await page.goto('/?bypassGdpr=true');
        const gdprBanner = page.locator('#gdpr-banner');
        if (await gdprBanner.isVisible()) await page.locator('[data-action="refuseAll"]').first().click();
        await clickWhenVisible(page.locator('.nav-menu-btn[data-target="SITES"]'));
        await expect(page.locator('#sites-map-canvas')).toBeVisible();
    }
    const mapState = (page) =>
        page.evaluate(async () => {
            const V = (await import('/js/views/sites.js')).default;
            const c = V.state.map.getCenter();
            const b = V.state.map.getBounds();
            const boulogne = L.latLng(50.7264, 1.6147);
            return {
                centerKm: c.distanceTo(boulogne) / 1000,
                north45: b.contains([50.7264 + 45 / 111, 1.6147]),
                south45: b.contains([50.7264 - 45 / 111, 1.6147]),
                sorgia: b.contains([46.1382, 5.856]),
            };
        });

    test('Spec 004 : sans interaction, le rayon reste à 50 km et la carte sur Boulogne-sur-Mer', async ({ page }) => {
        await openSitesWithoutPosition(page, null);
        await page.waitForTimeout(5000);
        await expect(page.locator('#radius-val-label')).toHaveText('50 km');
        await page.setViewportSize({ width: 900, height: 700 });
        await page.waitForTimeout(3000);
        await expect(page.locator('#radius-val-label')).toHaveText('50 km');
        const state = await mapState(page);
        expect(state.centerKm).toBeLessThan(5);
    });

    test('Spec 004 : un favori lointain ne fait pas dézoomer la carte', async ({ page }) => {
        await openSitesWithoutPosition(page, { favoriteSites: ['sorgia-601'] });
        await page.waitForTimeout(3000);
        const state = await mapState(page);
        expect(state.centerKm).toBeLessThan(5);
        expect(state.north45).toBe(true);
        expect(state.south45).toBe(true);
        expect(state.sorgia).toBe(false);
        await expect(page.locator('#radius-val-label')).toHaveText('50 km');
    });

    test('Spec 007 : la dernière prévision reste disponible quand Open-Meteo est injoignable', async ({ page }) => {
        await mockOpenMeteo(page, { complete: 6, empty: 0 });
        const card = await openSitesAndSearch(page, 'AUTEUIL');
        const firstContext = await card.locator('.forecast-context').textContent();
        // Attendre l'enregistrement sur l'appareil (IndexedDB réel du navigateur).
        await expect
            .poll(() =>
                page.evaluate(async () => {
                    const { default: IDB } = await import('/js/services/idb_storage.js');
                    return (await IDB.getValuesByPrefix('forecast:')).length;
                }),
            )
            .toBeGreaterThan(0);

        // Rechargement sans accès à Open-Meteo.
        await page.unroute('https://api.open-meteo.com/**');
        await page.route('https://api.open-meteo.com/**', (route) => route.abort('internetdisconnected'));
        const restored = await openSitesAndSearch(page, 'AUTEUIL');

        await expect(page.locator('#offline-forecast-notice')).toBeVisible();
        await expect(page.locator('#offline-forecast-notice')).toContainText('prévision enregistrée sur l’appareil');
        await expect(restored.locator('.site-weather-row')).toBeVisible();
        const match = /récupérée [^·]*/.exec(firstContext)[0].trim();
        await expect(restored.locator('.forecast-context')).toContainText(match);
    });

    test('Spec 016 : les commandes des sites agissent une seule fois, sans avertissement « Unregistered action »', async ({
        page,
    }) => {
        const warnings = [];
        page.on('console', (msg) => {
            if (msg.text().startsWith('Unregistered action triggered')) warnings.push(msg.text());
        });
        await mockOpenMeteo(page, { complete: 6, empty: 0 });
        await openSitesAndSearch(page, 'AUTEUIL');

        // Une action de l'écran exécutée deux fois s'annulerait : le menu ne s'ouvrirait jamais.
        const mapsButton = page.locator('[data-action="toggleDropdown"][data-args="\'map-settings\'"]');
        const mapsMenu = page.locator('#menu-map-settings');
        await mapsButton.click();
        await expect(mapsMenu).toHaveClass(/\bshow\b/);
        await mapsButton.click();
        await expect(mapsMenu).not.toHaveClass(/\bshow\b/);

        const favorites = page.locator('#btn-filter-favorites');
        const wasActive = await favorites.evaluate((el) => el.classList.contains('active'));
        await favorites.click();
        await expect(favorites).toHaveClass(wasActive ? /^(?!.*\bactive\b)/ : /\bactive\b/);
        await favorites.click();

        await clickWhenVisible(page.locator('[data-action="toggleAdvancedSettings"]'));
        const sortMode = page.locator('select[data-action="changeSortMode"]');
        await sortMode.selectOption('AZ');
        await expect(sortMode).toHaveValue('AZ');

        expect(warnings).toEqual([]);
    });
});

test.describe('E2E - Sites sans le rôle « beta »', () => {
    test.use({ serviceWorkers: 'block' });

    test('la liste et la carte restent visibles, sans aucune météo calculée', async ({ page }) => {
        const openMeteoCalls = [];
        await page.route('https://api.open-meteo.com/**', (route) => {
            openMeteoCalls.push(route.request().url());
            return route.fulfill({ json: [] });
        });
        await useRadius200(page);
        await page.goto('/?bypassGdpr=true');
        await acceptGdprIfAsked(page);
        await clickWhenVisible(page.locator('.nav-menu-btn[data-target="SITES"]'));

        await expect(page.locator('#site-search')).toBeVisible();
        await expect(page.locator('#sites-map-view')).toBeVisible();
        await expect(page.locator('.site-card').first()).toBeVisible();

        await expect(page.locator('.forecast-sticky-container')).toBeHidden();
        await expect(page.locator('[data-action="toggleAdvancedSettings"]')).toBeHidden();
        await expect(page.locator('#btn-compare-favorites')).toBeHidden();
        await expect(page.locator('.site-weather-row')).toHaveCount(0);
        await expect(page.locator('.ranking-timeline')).toHaveCount(0);
        await expect(page.locator('.weather-loading')).toHaveCount(0);

        await page.waitForTimeout(800);
        expect(openMeteoCalls).toEqual([]);
    });
});
