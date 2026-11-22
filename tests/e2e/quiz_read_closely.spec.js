import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Spec 061 : encart « À lire de près ». Le fichier des phrases est remplacé par une version de test :
// une phrase reconnaissable pour chaque question (ou aucune), pour ne pas dépendre du tirage.
const CODES = readFileSync('js/data/qcm_ffvl.csv', 'utf8')
    .split('\n')
    .map((l) => l.split(',')[0])
    .filter((c) => /^[A-Z]\d+[A-Z]+$/.test(c));
const SENTENCE = 'Phrase de test de l’encart.';
const ALL = Object.fromEntries(CODES.map((c) => [c, [SENTENCE]]));

test.use({ serviceWorkers: 'block' });

async function setup(page, traps) {
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
    await page.route('**/js/data/qcm_question_traps.json', (route) => route.fulfill({ json: traps }));
}

const box = (page) => page.locator('.quiz-read-closely');

async function answerFirstChoice(page) {
    await page.locator('#qcm-choices .qcm-option').first().click();
    await page.locator('[data-action="validate-question"]').click();
}

test('training: the box appears only after the answer', async ({ page }) => {
    await setup(page, ALL);
    await page.goto('/?mode=QCM');
    await page.locator('#mode-training').click();
    await page.locator('#qcm-start-btn').click();
    await expect(page.locator('#qcm-choices .qcm-option').first()).toBeVisible();

    await expect(box(page)).toHaveCount(0);
    await expect(page.locator('#qcm-screen')).not.toContainText(SENTENCE);

    await answerFirstChoice(page);
    await expect(box(page)).toBeVisible();
    await expect(box(page)).toContainText('À lire de près');
    await expect(box(page)).toContainText(SENTENCE);
});

test('training: no box for a question without traps', async ({ page }) => {
    await setup(page, {});
    await page.goto('/?mode=QCM');
    await page.locator('#mode-training').click();
    await page.locator('#qcm-start-btn').click();
    await answerFirstChoice(page);
    await expect(page.locator('[data-action="next-question"]')).toBeVisible();
    await expect(box(page)).toHaveCount(0);
});

test('mock exam: no box while it runs', async ({ page }) => {
    await setup(page, ALL);
    await page.goto('/?mode=QCM');
    await page.locator('#mode-exam').click();
    await page.locator('#qcm-start-btn').click();
    for (let i = 0; i < 3; i++) {
        await expect(page.locator('#qcm-choices .qcm-option').first()).toBeVisible();
        await expect(box(page)).toHaveCount(0);
        await answerFirstChoice(page);
    }
    await expect(box(page)).toHaveCount(0);
    await expect(page.locator('#qcm-screen')).not.toContainText(SENTENCE);
});
