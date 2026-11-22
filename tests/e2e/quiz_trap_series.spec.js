import { test, expect } from '@playwright/test';

// Spec 063 : série « Questions à piège ». Les vraies phrases de spec 061 sont servies : chaque question
// de la série doit afficher l'encart « À lire de près » après la réponse.
test.use({ serviceWorkers: 'block' });

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem(
            'parapente_gdpr_consent',
            JSON.stringify({
                stats: true,
                firebase: false,
                gps: false,
                version: 2026,
                date: new Date().toISOString(),
            }),
        );
        if (!localStorage.getItem('userLevel')) localStorage.setItem('userLevel', JSON.stringify('BI'));
    });
    await page.route('https://api.open-meteo.com/**', (route) => route.fulfill({ json: [] }));
});

test('with the option on, every question of the training series has a trap box', async ({ page }) => {
    await page.goto('/?mode=QCM');
    await page.locator('#mode-training').click();
    const option = page.locator('#qcm-traps-only');
    await expect(option).toBeVisible();
    await expect(option).toBeEnabled();
    await option.check();
    await page.locator('#qcm-start-btn').click();
    await expect(page.locator('#qcm-mode-label')).toContainText('QUESTIONS À PIÈGE');

    for (let i = 0; i < 5; i++) {
        await expect(page.locator('#qcm-choices .qcm-option').first()).toBeVisible();
        await expect(page.locator('.quiz-read-closely')).toHaveCount(0);
        await page.locator('#qcm-choices .qcm-option').first().click();
        await page.locator('[data-action="validate-question"]').click();
        await expect(page.locator('.quiz-read-closely')).toBeVisible();
        await page.locator('[data-action="next-question"]').click();
    }
});

test('the option is hidden in exam mode and disabled without trap data', async ({ page }) => {
    await page.route('**/js/data/qcm_question_traps.json', (route) => route.fulfill({ status: 404, body: '' }));
    await page.goto('/?mode=QCM');
    await page.locator('#mode-exam').click();
    await expect(page.locator('#qcm-traps-only')).toBeHidden();
    await page.locator('#mode-training').click();
    await expect(page.locator('#qcm-traps-only')).toBeDisabled();
});
