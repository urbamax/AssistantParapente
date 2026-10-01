import { test, expect } from '@playwright/test';

// Spec 011 : placer sur une carte un lieu saisi à la main dans le carnet.
test.describe('E2E - Logbook site coordinates picker', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            window.localStorage.setItem(
                'parapente_gdpr_consent',
                JSON.stringify({
                    stats: true,
                    firebase: true,
                    gps: false,
                    version: 2026,
                    date: new Date().toISOString(),
                }),
            );
        });
        // Aucun appel extérieur pendant le test : ni fond de carte, ni météo.
        await page.route('https://server.arcgisonline.com/**', (route) => route.abort());
        await page.route('https://api.open-meteo.com/**', (route) => route.abort());
        await page.goto('/');
        await page.locator('.nav-menu-btn[data-target="LOGBOOK"]').first().click();
        await page.locator('[data-action="openLogbookSection"][data-args="\'history\'"]').click();
        await expect(page.locator('#logbook-screen')).toHaveClass(/active/);
        await page.locator('#logbook-add-btn').click();
        await expect(page.locator('#logbook-session-modal')).toBeVisible();
        await page.locator('#btn-type-gonflage').first().click();
        await page.fill('#lb-lieu', 'Pente Test Carte');
        await page.fill('#lb-duree', '60');
    });

    const savedSession = (page) =>
        page.evaluate(async () => {
            const { default: LogbookService } = await import('/js/services/logbook_service.js');
            const s = LogbookService.getFlights().find((f) => f.lieu === 'Pente Test Carte');
            return s ? { lat: s.lat ?? null, lon: s.lon ?? null } : null;
        });

    const submit = (page) =>
        page.evaluate(() =>
            document
                .getElementById('logbook-add-form')
                .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
        );

    test('a click on the map sets the coordinates saved with the session', async ({ page }) => {
        await page.locator('[data-action="toggleCoordsPicker"]').first().click();
        const map = page.locator('#lb-coords-map');
        await expect(map).toBeVisible();
        await map.click({ position: { x: 120, y: 90 } });

        const text = await page.inputValue('#lb-coords');
        expect(text).toMatch(/^-?\d+\.\d{5}, -?\d+\.\d{5}$/);
        const [lat, lon] = text.split(',').map(Number);

        await submit(page);
        await expect(page.locator('.logbook-card').filter({ hasText: 'PENTE TEST CARTE' }).first()).toBeVisible();
        expect(await savedSession(page)).toEqual({ lat, lon });
    });

    test('coordinates pasted from Google Maps are saved', async ({ page }) => {
        await page.locator('[data-action="toggleCoordsPicker"]').first().click();
        await page.fill('#lb-coords', '50°40\'52.4"N 1°35\'32.4"E');
        await submit(page);
        const saved = await savedSession(page);
        expect(saved.lat).toBeCloseTo(50.68122, 4);
        expect(saved.lon).toBeCloseTo(1.59233, 4);
    });

    test('unreadable coordinates block the save with a message', async ({ page }) => {
        await page.locator('[data-action="toggleCoordsPicker"]').first().click();
        await page.fill('#lb-coords', 'pas des coordonnées');
        await submit(page);
        await expect(page.locator('#lb-coords-error')).toBeVisible();
        await expect(page.locator('#logbook-session-modal')).toBeVisible();
        expect(await savedSession(page)).toBeNull();
    });

    test('choosing a place already placed fills its coordinates, and another place clears them', async ({ page }) => {
        await page.locator('[data-action="toggleCoordsPicker"]').first().click();
        await page.fill('#lb-coords', '50.68122, 1.59233');
        await submit(page);
        await expect(page.locator('.logbook-card').filter({ hasText: 'PENTE TEST CARTE' }).first()).toBeVisible();

        await page.locator('#logbook-add-btn').click();
        await page.locator('#btn-type-gonflage').first().click();
        await page.fill('#lb-lieu', 'PENTE TEST CARTE');
        await expect(page.locator('#lb-coords')).toHaveValue('50.68122, 1.59233');
        await expect(page.locator('#lb-coords-status')).toContainText('dernière session');

        await page.fill('#lb-lieu', 'Zqxv Wkjy');
        await expect(page.locator('#lb-coords')).toHaveValue('');
        await expect(page.locator('#lb-coords-status')).toContainText('absent de la base');
    });
});
