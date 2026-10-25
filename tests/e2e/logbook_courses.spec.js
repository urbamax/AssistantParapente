import { test, expect } from '@playwright/test';

// Spec 038 : un stage saisi une fois se retrouve en choisissant son nom, plusieurs moniteurs sont
// possibles, et les stages apparaissent dans les statistiques.
test.describe('E2E - Logbook school courses', () => {
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
        await page.locator('.nav-menu-btn[data-target="LOGBOOK"]').first().click();
        await page.locator('[data-action="openLogbookSection"][data-args="\'history\'"]').click();
        await expect(page.locator('#logbook-screen')).toHaveClass(/active/);
    });

    const openGroundForm = async (page, place) => {
        await page.locator('#logbook-add-btn').click();
        await expect(page.locator('#logbook-session-modal')).toBeVisible();
        await page.locator('#btn-type-gonflage').first().click();
        await page.fill('#lb-lieu', place);
        await page.fill('#lb-duree', '45');
        // La voile est obligatoire : sans matériel configuré, on la saisit via « Autre ».
        await page.selectOption('#lb-voile', 'Autre');
        await page.fill('#lb-voile-autre', 'Voile école');
    };

    const submit = (page) =>
        page.evaluate(() =>
            document
                .getElementById('logbook-add-form')
                .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
        );

    const chips = (page, name) => page.locator(`#lb-${name}-group .lb-chip`);

    test('a course is found again by its name, has two instructors and shows in the statistics', async ({ page }) => {
        // 1. Première session du stage : école, deux moniteurs (au clavier), stage, pilote
        await openGroundForm(page, 'Pente stage');
        await page.check('#lb-ecole-check');
        await page.fill('#lb-ecole', 'École du Test');
        await page.fill('#lb-moniteur-new', 'Gilbert');
        await page.press('#lb-moniteur-new', 'Enter');
        await page.fill('#lb-moniteur-new', 'Marie');
        await page.press('#lb-moniteur-new', 'Enter');
        await expect(chips(page, 'moniteur')).toHaveCount(2);
        await page.check('#lb-stage-check');
        await page.fill('#lb-stage-nom', 'Stage été');
        await page.selectOption('#lb-stage-specialite', 'SIV');
        await page.fill('#lb-pilotes-new', 'Julie');
        await page.press('#lb-pilotes-new', 'Enter');
        await submit(page);
        await expect(page.locator('.logbook-card').filter({ hasText: 'PENTE STAGE' }).first()).toBeVisible();
        await expect(page.locator('.logbook-card').first()).toContainText('Gilbert, Marie');

        // 2. Deuxième session, ailleurs : le nom du stage ramène spécialité, moniteurs et pilotes
        await openGroundForm(page, 'Autre pente');
        await page.check('#lb-ecole-check');
        await page.check('#lb-stage-check');
        await page.fill('#lb-stage-nom', 'stage ÉTÉ');
        await page.press('#lb-stage-nom', 'Tab');
        await expect(page.locator('#lb-stage-specialite')).toHaveValue('SIV');
        await expect(chips(page, 'moniteur')).toHaveCount(2);
        await expect(chips(page, 'pilotes')).toHaveCount(1);
        await expect(page.locator('#lb-learned-summary')).toContainText('comme ton stage');
        await submit(page);
        await expect(page.locator('.logbook-card').filter({ hasText: 'AUTRE PENTE' }).first()).toBeVisible();

        // 3. Statistiques : le stage apparaît, un clic filtre l'historique
        await page.locator('.nav-menu-btn[data-target="LOGBOOK"]').first().click();
        await page.locator('[data-action="openLogbookSection"][data-args="\'stats\'"]').click();
        const tile = page.locator('[data-stage-stats] [data-stat-type="stage"]');
        await expect(tile).toHaveCount(1);
        await expect(tile).toContainText('Stage été');
        await expect(tile).toContainText('École du Test');
        await expect(tile).toContainText('Gonflage: 2');
        await tile.click();
        await expect(page.locator('.logbook-filter-banner')).toContainText('Stage été');
        await expect(page.locator('.logbook-filter-banner')).toContainText('2 / 2');
    });
});
