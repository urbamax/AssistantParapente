import { test, expect } from '@playwright/test';

// Spec 042 : suivi des brevets FFVL (BI, BP, BPC, TREUIL), rattachement par lot des sessions école
// et avancement automatique du niveau théorique QCM une fois la théorie officielle validée.
test.describe('E2E - Brevets & Progression FFVL', () => {
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
        await page.route('https://server.arcgisonline.com/**', (route) => route.abort());
        await page.route('https://api.open-meteo.com/**', (route) => route.abort());
        await page.goto('/');
    });

    const openGroundForm = async (page, place) => {
        await page.locator('#logbook-add-btn').click();
        await expect(page.locator('#logbook-session-modal')).toBeVisible();
        await page.locator('#btn-type-gonflage').first().click();
        await page.fill('#lb-lieu', place);
        await page.fill('#lb-duree', '45');
        await page.selectOption('#lb-voile', 'Autre');
        await page.fill('#lb-voile-autre', 'Voile école');
    };

    const submit = (page) =>
        page.evaluate(() =>
            document
                .getElementById('logbook-add-form')
                .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
        );

    test('tags school sessions, batch-assigns unassigned school sessions, validates BI and advances QCM theory to BP', async ({
        page,
    }) => {
        await page.locator('.nav-menu-btn[data-target="LOGBOOK"]').first().click();
        await page.locator('[data-action="openLogbookSection"][data-args="\'history\'"]').click();

        // 1. Session école avec brevet BI renseigné
        await openGroundForm(page, 'Pente BI');
        await page.check('#lb-ecole-check');
        await page.fill('#lb-ecole', 'École Horizon');
        await page.selectOption('#lb-brevet-prepare', 'BI');
        await submit(page);
        await expect(page.locator('.logbook-card').first()).toContainText('BI — Brevet Initial');

        // 2. Session école sans brevet renseigné (on vide la proposition apprise)
        await openGroundForm(page, 'Pente Sans Brevet');
        await page.check('#lb-ecole-check');
        await page.fill('#lb-ecole', 'École Horizon');
        await page.selectOption('#lb-brevet-prepare', '');
        await submit(page);

        // 3. Carnet > Statistiques : rattachement par lot + validation du BI (théorie + pratique)
        await page.locator('.nav-menu-btn[data-target="LOGBOOK"]').first().click();
        await page.locator('[data-action="openLogbookSection"][data-args="\'stats\'"]').click();
        const brevetsBox = page.locator('[data-brevets-stats]');
        await expect(brevetsBox).toBeVisible();

        const batchBtn = brevetsBox.locator('[data-action="openBrevetBatchModal"]');
        await expect(batchBtn).toBeVisible();
        await batchBtn.click();
        await expect(page.locator('#lb-brevet-batch-modal')).toBeVisible();
        await page.selectOption('#lb-brevet-batch-target', 'BI');
        await page.locator('[data-action="applyBrevetBatchAssign"]').click();

        const biCard = brevetsBox.locator('[data-brevet-card="BI"]');
        await expect(biCard).toContainText('2 sessions école');

        await biCard.locator('[data-action="openBrevetModal"]').click();
        await expect(page.locator('#lb-brevet-modal')).toBeVisible();
        await page.check('#lb-brevet-theory-passed');
        await page.fill('#lb-brevet-theory-date', '2026-04-10');
        await page.fill('#lb-brevet-theory-score', '56');
        await page.fill('#lb-brevet-theory-total', '60');
        await page.check('#lb-brevet-obtained');
        await page.fill('#lb-brevet-obtained-date', '2026-04-18');
        await page.fill('#lb-brevet-school', 'École Horizon');
        await page.locator('[data-action="saveBrevetModal"]').click();

        await expect(biCard).toContainText('Brevet validé');
        await expect(biCard).toContainText('56/60');

        // 4. QCM : le niveau théorique actif avance automatiquement sur BP, et revenir sur BI affiche le badge officiel + mode REVISION
        await page.locator('.nav-menu-btn[data-target="QCM"]').first().click();
        await page.locator('[data-action="openTheorySection"][data-args="\'qcm\'"]').click();
        await expect(page.locator('#qcm-setup-screen .level-tab[data-level="BP"]')).toHaveClass(/active/);

        await page.locator('#qcm-setup-screen .level-tab[data-level="BI"]').click();
        await expect(page.locator('#qcm-brevet-status-banner')).toContainText('Examen théorique BI validé');
        await expect(page.locator('#qcm-setup-screen .mode-card[data-mode="REVISION"]')).toHaveClass(/selected/);
    });
});
