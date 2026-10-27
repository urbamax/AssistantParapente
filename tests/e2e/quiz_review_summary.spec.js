import { test, expect } from '@playwright/test';

// Spec 035 : le mode Révision indique combien de questions sont à réviser.
test.use({ serviceWorkers: 'block' });

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem(
            'parapente_gdpr_consent',
            JSON.stringify({
                stats: false,
                firebase: false,
                gps: false,
                version: 2026,
                date: new Date().toISOString(),
            }),
        );
    });
    await page.route('https://api.open-meteo.com/**', (route) => route.fulfill({ json: [] }));
});

test('the Révision mode shows the number of questions to review, and only in that mode', async ({ page }) => {
    await page.goto('/?mode=QCM');
    const summary = page.locator('#revision-summary');
    await expect(summary).toBeHidden();

    await page.locator('#mode-revision').click();
    await expect(summary).toBeVisible();
    // Aucun historique : toutes les questions du niveau sont nouvelles, aucune n'est à réviser.
    await expect(summary).toHaveText(/^À réviser : 0 · Nouvelles : [1-9]\d*$/);
    await expect(page.locator('#mode-description')).toContainText('répétition espacée');

    await page.locator('#mode-training').click();
    await expect(summary).toBeHidden();
});

test('choosing Révision before the questions have loaded still shows the summary once they do', async ({ page }) => {
    // Les questions se chargent en arrière-plan : on retarde le CSV pour choisir le mode avant la fin.
    let releaseCsv;
    const csvGate = new Promise((resolve) => (releaseCsv = resolve));
    await page.route('**/js/data/qcm_ffvl.csv', async (route) => {
        await csvGate;
        await route.continue();
    });
    await page.goto('/?mode=QCM');
    await page.locator('#mode-revision').click();
    await expect(page.locator('#revision-summary')).toBeHidden();

    releaseCsv();
    await expect(page.locator('#revision-summary')).toBeVisible();
    await expect(page.locator('#revision-summary')).toHaveText(/^À réviser : 0 · Nouvelles : [1-9]\d*$/);
});

test('a question answered long ago shows up as to review', async ({ page }) => {
    await page.goto('/?mode=QCM');
    await page.evaluate(async () => {
        const { default: QuizService } = await import('/js/services/quiz_service.js');
        const { default: StorageService } = await import('/js/services/storage.js');
        // Les questions se chargent en arrière-plan au démarrage de l'application.
        for (let i = 0; i < 100 && !QuizService.state.isLoaded; i++) await new Promise((r) => setTimeout(r, 100));
        const [first] = QuizService.getLevelQuestions('BI');
        const longAgo = Date.now() - 400 * 24 * 60 * 60 * 1000;
        StorageService.set(StorageService.KEYS.QCM_STATS, {
            themes: {},
            questions: { [first.code]: { total: 3, correct: 3, streak: 3, lastSeen: longAgo } },
        });
    });
    await page.locator('#mode-revision').click();
    await expect(page.locator('#revision-summary')).toHaveText(/^À réviser : 1 · Nouvelles : \d+$/);
});
