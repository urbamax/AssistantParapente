import { test, expect } from '@playwright/test';
import { buildFlight, thermal, glide, toIgc } from '../helpers/synthetic_flight.js';

// Spec 034 : importer une trace pré-remplit le type de vol, et la ligne sous le formulaire dit pourquoi.
test.beforeEach(async ({ page }) => {
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
});

const igc = (phases) => ({
    name: 'vol.igc',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from(toIgc(buildFlight(phases))),
});

test('a trace with a thermal fills the flight type and explains it', async ({ page }) => {
    await page.setInputFiles('#global-igc-input', igc([glide(120), thermal(180, 2), glide(120)]));
    await expect(page.locator('#lb-typeVol')).toHaveValue('Thermique');
    await expect(page.locator('#lb-learned-summary')).toContainText('thermiques repérés dans la trace');
});

test('a type chosen by the pilot is not replaced by the trace', async ({ page }) => {
    await page.selectOption('#lb-typeVol', 'Restit');
    await page.setInputFiles('#global-igc-input', igc([glide(120), thermal(180, 2), glide(120)]));
    await expect(page.locator('#lb-duree')).not.toHaveValue('');
    await expect(page.locator('#lb-typeVol')).toHaveValue('Restit');
});
