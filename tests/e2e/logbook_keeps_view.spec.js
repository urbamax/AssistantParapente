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
    // L'arrivée sur le carnet est animée (View Transition du routeur, puis fondu glissant de
    // l'écran) : tant qu'elle joue, Playwright ne peut pas viser un bouton et fait défiler la liste
    // pour réessayer, ce qui fausse la position mesurée. On attend qu'elle soit finie.
    await page.evaluate(async () => {
        const { default: AppRouter } = await import('/js/core/router.js');
        await AppRouter._activeTransition?.finished.catch(() => {});
        await Promise.all(
            document
                .getAnimations()
                .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
                .map((a) => a.finished.catch(() => {})),
        );
    });
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
    // Bouton « Modifier » au milieu de la liste, cliqué à la souris là où il est affiché. Le clic de
    // Playwright, lui, fait d'abord défiler la liste quand le bouton lui paraît masqué (menu
    // utilisateur fixe, en haut) ou en mouvement : la position mesurée ici ne serait plus celle du
    // carnet à l'ouverture de la fenêtre.
    const edit = card(page, 5).locator('[data-action="editEntry"]');
    await edit.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    const before = await scrollTop(page);
    expect(before).toBeGreaterThan(0);

    const box = await edit.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.locator('#logbook-session-modal')).toBeVisible();
    await page.evaluate(() =>
        document
            .getElementById('logbook-add-form')
            .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
    );
    await expect(page.locator('#logbook-session-modal')).toBeHidden();
    await expect.poll(() => scrollTop(page)).toBe(before);
});
