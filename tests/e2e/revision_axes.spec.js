import { test, expect } from '@playwright/test';

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
        localStorage.setItem('parapente_level', 'BI');
        localStorage.setItem(
            'parapente_qcm_stats',
            JSON.stringify({
                totalQuestions: 6,
                themes: {},
                questions: {
                    A80V: { total: 3, correct: 0, streak: 0, lastSeen: Date.now() },
                    A81V: { total: 3, correct: 1, streak: 0, lastSeen: Date.now() },
                },
            }),
        );
    });
    await page.route('https://api.open-meteo.com/**', (route) => route.fulfill({ json: [] }));
});

test('Spec 043 : parcours complet Axes de révision (cours PDF #page=N, points clés sans QCM, atelier ciblé)', async ({
    page,
}) => {
    const warnings = [];
    page.on('console', (msg) => {
        if (msg.text().startsWith('Unregistered action triggered')) warnings.push(msg.text());
    });

    await page.goto('/?mode=STATS');
    const shortcutBtn = page.locator('[data-action="QuizshowRevisionAxes"]');
    await expect(shortcutBtn).toBeVisible();
    await shortcutBtn.click();

    const axesScreen = page.locator('#revision-axes-screen');
    await expect(axesScreen).toHaveClass(/active/);

    // Le chapitre Brises & aérologie apparaît en priorité 1 (BLOCKER)
    const firstCard = page.locator('.revision-axis-card').first();
    await expect(firstCard).toHaveAttribute('data-axis-id', 'meteo-brises-aerologie');
    await expect(firstCard).toHaveAttribute('data-axis-status', 'BLOCKER');

    // Étape 1 : présence de liens PDF vérifiés avec #page=
    const pageLinks = firstCard.locator('a[href*="#page="]');
    expect(await pageLinks.count()).toBeGreaterThan(0);

    // Étape 2 : déplier les points clés à retenir
    const toggleTakeawaysBtn = firstCard.locator('[data-action="QuiztoggleAxisTakeaways"]');
    await toggleTakeawaysBtn.click();
    await expect(firstCard.locator('.revision-axis-takeaways-list')).toBeVisible();

    // Filtrage par statut BLOCKER
    await page.locator('[data-action="QuizsetAxesFilter"][data-args="BLOCKER"]').click();
    await expect(page.locator('.revision-axis-card')).toHaveCount(1);

    // Étape 3 : lancer l'atelier ciblé
    await firstCard.locator('[data-action="QuizstartAxisWorkshop"]').click();
    await expect(page.locator('#qcm-screen')).toHaveClass(/active/);
    await expect(page.locator('#qcm-mode-label')).toContainText('ATELIER CIBLÉ');

    expect(warnings).toEqual([]);
});
