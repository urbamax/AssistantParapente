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

// Points de chaque proposition, lus dans le fichier officiel, pour répondre exprès juste ou faux.
function parseCsvLine(line) {
    const out = [];
    let cur = '';
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (quoted) {
            if (ch === '"' && line[i + 1] === '"') ((cur += '"'), i++);
            else if (ch === '"') quoted = false;
            else cur += ch;
        } else if (ch === '"') quoted = true;
        else if (ch === ',') (out.push(cur), (cur = ''));
        else cur += ch;
    }
    out.push(cur);
    return out;
}
const POINTS = new Map(
    readFileSync('js/data/qcm_ffvl.csv', 'utf8')
        .split('\n')
        .map((l) => parseCsvLine(l.replace(/\r$/, '')))
        .filter((f) => /^[A-Z]\d+[A-Z]+$/.test(f[0]))
        .map((f) => {
            const pts = new Map();
            for (let i = 2; i + 1 < f.length; i += 2) if (f[i]) pts.set(f[i].trim(), Number(f[i + 1]));
            return [f[0], pts];
        }),
);

/** Coche les bonnes propositions (correct) ou une seule mauvaise, puis valide. */
async function answer(page, correct) {
    const code = (await page.locator('#qcm-screen .quiz-meta .bank-item-code').textContent()).trim();
    const pts = POINTS.get(code);
    const texts = await page.locator('#qcm-choices .qcm-option').evaluateAll((els) =>
        els.map((el) => {
            const clone = el.cloneNode(true);
            clone.querySelector('.qcm-option-letter')?.remove();
            return clone.textContent.trim();
        }),
    );
    const scored = texts.map((t, i) => [i, pts.get(t)]);
    const by = (keep) => scored.filter(([, p]) => keep(p)).map(([i]) => i);
    // Faux : une proposition négative, sinon nulle, sinon une seule des bonnes (réponse incomplète).
    const picks = correct
        ? by((p) => p > 0)
        : [...by((p) => p < 0), ...by((p) => p === 0), ...by((p) => p > 0)].slice(0, 1);
    for (const i of picks) await page.locator('#qcm-choices .qcm-option').nth(i).click();
    await page.locator('[data-action="validate-question"]').click();
}

async function answerFirstChoice(page) {
    await page.locator('#qcm-choices .qcm-option').first().click();
    await page.locator('[data-action="validate-question"]').click();
}

test('training: the box appears only after a wrong answer', async ({ page }) => {
    await setup(page, ALL);
    await page.goto('/?mode=QCM');
    await page.locator('#mode-training').click();
    await page.locator('#qcm-start-btn').click();
    await expect(page.locator('#qcm-choices .qcm-option').first()).toBeVisible();

    await expect(box(page)).toHaveCount(0);
    await expect(page.locator('#qcm-screen')).not.toContainText(SENTENCE);

    await answer(page, true);
    await expect(page.locator('[data-action="next-question"]')).toBeVisible();
    await expect(box(page)).toHaveCount(0);

    await page.locator('[data-action="next-question"]').click();
    await expect(page.locator('#qcm-choices .qcm-option').first()).toBeVisible();
    await answer(page, false);
    await expect(box(page)).toBeVisible();
    await expect(box(page)).toContainText('À lire de près');
    await expect(box(page)).toContainText(SENTENCE);
});

test('training: no box for a question without traps', async ({ page }) => {
    await setup(page, {});
    await page.goto('/?mode=QCM');
    await page.locator('#mode-training').click();
    await page.locator('#qcm-start-btn').click();
    await expect(page.locator('#qcm-choices .qcm-option').first()).toBeVisible();
    await answer(page, false);
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
