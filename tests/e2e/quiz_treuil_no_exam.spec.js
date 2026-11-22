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
        // Sans niveau choisi, l'application démarre en « Tous les niveaux », qui n'a pas d'examen (spec 058).
        if (!localStorage.getItem('userLevel')) localStorage.setItem('userLevel', JSON.stringify('BI'));
    });
    await page.route('https://api.open-meteo.com/**', (route) => route.fulfill({ json: [] }));
});

test('le mode Examen est absent pour le niveau Treuil, la Qualification Treuil reste validable, et BI garde Examen', async ({
    page,
}) => {
    await page.goto('/?mode=QCM');
    const levelSelect = page.locator('#global-level-select');
    const examBtn = page.locator('#mode-exam');
    const trainingBtn = page.locator('#mode-training');

    await expect(examBtn).toBeVisible();
    await examBtn.click();
    await expect(examBtn).toHaveClass(/active/);

    // Basculer sur Treuil : le bouton Examen disparaît, le mode repasse en Entraînement, et le bandeau propose la Qualification
    await levelSelect.selectOption('TREUIL');
    await expect(examBtn).toBeHidden();
    await expect(trainingBtn).toHaveClass(/active/);
    const banner = page.locator('#qcm-setup-screen [data-quiz-brevet-banner]');
    await expect(banner).toContainText('Qualification Treuil');
    await expect(banner).toContainText('Valider ma qualification');

    // Lancer une session en Treuil démarre bien en mode Entraînement
    await page.locator('#qcm-start-btn').click();
    await expect(page.locator('#qcm-mode-label')).toContainText('ENTRAÎNEMENT');

    // Revenir sur le setup : valider la Qualification Treuil via la modale (sans examen théorique)
    await page.goto('/?mode=QCM');
    await expect(examBtn).toBeHidden();
    await banner.locator('[data-action="openBrevetModal"]').click();
    await expect(page.locator('#lb-brevet-modal')).toBeVisible();
    await expect(page.locator('#lb-brevet-theory-passed')).toHaveCount(0);
    await page.check('#lb-brevet-practical-validated');
    await page.locator('[data-action="saveBrevetModal"]').click();
    await expect(banner).toContainText('Qualification Treuil validée');
    await expect(page.locator('#mode-revision')).toHaveClass(/active/);

    // Rebasculer sur BI : le bouton Examen réapparaît
    await levelSelect.selectOption('BI');
    await expect(examBtn).toBeVisible();

    // « Tous les niveaux » : pas d'examen officiel tous niveaux confondus (spec 058)
    await examBtn.click();
    await levelSelect.selectOption('ALL');
    await expect(examBtn).toBeHidden();
    await expect(trainingBtn).toHaveClass(/active/);
});
