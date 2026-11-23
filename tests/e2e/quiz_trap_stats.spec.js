import { test, expect } from '@playwright/test';

// Spec 064 : « Vos pièges » dans les statistiques. Un historique où l'élève a coché deux fois le choix
// « n'est jamais turbulente » de A92V (piège de type « mots absolus ») doit apparaître dans la section,
// et le bouton « S'entraîner » lance une série de questions de ce type.
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
        localStorage.setItem('userLevel', JSON.stringify('BI'));
        const day = Math.floor(Date.now() / 86400000);
        localStorage.setItem(
            'parapente_qcm_stats',
            JSON.stringify({
                themes: {},
                questions: {
                    A92V: { total: 2, correct: 0, streak: 0, answers: [(day - 1) * 1024 + 0b100, day * 1024 + 0b100] },
                },
            }),
        );
    });
    await page.route('https://api.open-meteo.com/**', (route) => route.fulfill({ json: [] }));
});

test('the statistics list the absolute-word traps and train on them', async ({ page }) => {
    await page.goto('/?mode=STATS');
    const row = page.locator('#stats-traps [data-trap-type="absolu"]');
    await expect(row).toBeVisible();
    await expect(row).toContainText('Mots absolus');
    await expect(row).toContainText('Tombé 2 fois sur 2');

    await row.locator('[data-action="QuizstartTrapTypeTraining"]').click();
    await expect(page.locator('#qcm-mode-label')).toHaveText('QUESTIONS À PIÈGE · MOTS ABSOLUS');
    await expect(page.locator('.quiz-read-closely')).toHaveCount(0);
    await page.locator('#qcm-choices .qcm-option').first().click();
    await page.locator('[data-action="validate-question"]').click();
    await expect(page.locator('.quiz-read-closely')).toBeVisible();
});
