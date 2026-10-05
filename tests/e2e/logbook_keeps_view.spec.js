import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Redessiner le carnet (synchro, modification d'une session) ne doit ni refermer ce que le pilote
// a ouvert (statistiques détaillées, trace) ni le renvoyer ailleurs dans la liste.
const igc = readFileSync('tests/fixtures/syride-winch-flight.igc', 'utf8');

test.beforeEach(async ({ page }) => {
    await page.addInitScript((igc) => {
        localStorage.setItem(
            'parapente_gdpr_consent',
            JSON.stringify({ stats: true, firebase: false, gps: false, version: 2026, date: new Date().toISOString() }),
        );
        if (sessionStorage.getItem('seeded')) return;
        const stats = { takeoffAlt: 166, landingAlt: 160, minAlt: 158, maxAltAboveTakeoff: 259, cumulativeClimb: 300 };
        const flights = Array.from({ length: 8 }, (_, i) => ({
            id: 'f' + i,
            type: 'vol',
            datetime: `2026-09-${String(10 + i).padStart(2, '0')}T12:00`,
            site: 'SITE ' + i,
            voile: 'V',
            duree: 10,
            typeVol: 'Plouf',
            rawIgc: igc,
            igcStats: stats,
        }));
        localStorage.setItem('tp_logbook_data', JSON.stringify(flights));
        sessionStorage.setItem('seeded', '1');
    }, igc);
    await page.route('https://**', (route) => route.abort());
    await page.goto('/');
    await page.locator('.nav-menu-btn[data-target="LOGBOOK"]').first().click();
    await page.locator('[data-action="openLogbookSection"][data-args="\'history\'"]').click();
    await expect(page.locator('.logbook-card').nth(5)).toBeVisible();
});

const card = (page, i) => page.locator(`.logbook-card[data-session-id="f${i}"]`);
const scrollTop = (page) => page.evaluate(() => document.getElementById('logbook-screen').scrollTop);
const rerender = (page) =>
    page.evaluate(async () => {
        const { default: LogbookView } = await import('/js/views/logbook.js');
        LogbookView.switchTab('history');
    });

test('a re-render keeps open details, open traces and the position in the list', async ({ page }) => {
    await card(page, 4).locator('details.flight-analysis summary').click();
    await card(page, 4).locator('[data-action="showTrace"]').click();
    await expect(page.locator('#trace-container-f4')).toBeVisible();
    await card(page, 4).scrollIntoViewIfNeeded();
    const before = await scrollTop(page);
    expect(before).toBeGreaterThan(0);

    await rerender(page);

    await expect(card(page, 4).locator('details.flight-analysis')).toHaveAttribute('open', '');
    await expect(page.locator('#trace-container-f4')).toBeVisible();
    await expect.poll(() => scrollTop(page)).toBe(before);
});

test('saving an edited session keeps the position in the list', async ({ page }) => {
    await card(page, 5).scrollIntoViewIfNeeded();
    const before = await scrollTop(page);
    expect(before).toBeGreaterThan(0);

    // Clic envoyé directement : avant un clic normal, Playwright fait défiler la page s'il juge le
    // bouton masqué (barre de navigation fixe), ce qu'un pilote ne provoque pas. Sous WebKit Linux,
    // ce défilement de l'outil (572 → 106) faisait échouer le test sans défaut de l'application.
    await card(page, 5).locator('[data-action="editEntry"]').dispatchEvent('click');
    await expect(page.locator('#logbook-session-modal')).toBeVisible();
    await page.evaluate(() =>
        document
            .getElementById('logbook-add-form')
            .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
    );
    await expect(page.locator('#logbook-session-modal')).toBeHidden();
    await expect.poll(() => scrollTop(page)).toBe(before);
});
