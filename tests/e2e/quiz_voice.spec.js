import { test, expect } from '@playwright/test';

// Spec 016 : mode vocal du QCM. Les API vocales du navigateur sont remplacées par des doublures :
// la lecture est enregistrée dans window.__spoken, et window.__hear(texte) simule une phrase entendue.
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

        /** @type {any} */
        const w = window;
        w.__spoken = [];
        class Utterance {
            constructor(text) {
                this.text = text;
            }
        }
        let current = null;
        const synth = {
            speak(u) {
                current = u;
                w.__spoken.push(u.text);
                // Fin de lecture simulée juste après.
                setTimeout(() => {
                    if (current === u) {
                        current = null;
                        if (u.onend) u.onend();
                    }
                }, 20);
            },
            cancel() {
                current = null;
            },
        };
        Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: synth });
        w.SpeechSynthesisUtterance = Utterance;

        w.__recognizers = [];
        class Recognition {
            constructor() {
                this.active = false;
                w.__recognizers.push(this);
            }
            start() {
                this.active = true;
            }
            abort() {
                this.active = false;
            }
            stop() {
                this.active = false;
            }
        }
        w.SpeechRecognition = Recognition;
        w.__hear = (text) => {
            const rec = w.__recognizers.findLast((r) => r.active);
            if (!rec) return false;
            rec.onresult({ results: [[{ transcript: text }]] });
            rec.active = false;
            rec.onend();
            return true;
        };
    });
});

async function startTraining(page) {
    await page.goto('/?mode=QCM');
    await page.locator('[data-action="startQcmSession"]').click();
    await expect(page.locator('#qcm-choices .qcm-option').first()).toBeVisible();
}

test('Spec 016 : « Lire » lit la question et ses réponses avec leur lettre', async ({ page }) => {
    await startTraining(page);
    const letters = page.locator('#qcm-choices .qcm-option-letter');
    await expect(letters.first()).toHaveText('A');

    await page.locator('[data-action="quiz-voice-read"]').click();
    const question = (await page.locator('.quiz-question-text').textContent()).trim();
    const firstAnswer = (await page.locator('#qcm-choices .qcm-option').first().textContent())
        .trim()
        .replace(/^A\s*/, '');
    const spoken = await page.evaluate(() => /** @type {any} */ (window).__spoken);
    expect(spoken[0].startsWith(question)).toBe(true);
    expect(spoken[0]).toContain(`Réponse A : ${firstAnswer}`);
});

test('Spec 016 : la lecture auto lit chaque nouvelle question et reste activée', async ({ page }) => {
    await startTraining(page);
    await page.locator('[data-action="quiz-voice-auto"]').click();
    await expect(page.locator('[data-action="quiz-voice-auto"]')).toHaveAttribute('aria-pressed', 'true');

    await page.locator('#qcm-choices .qcm-option').first().click();
    await page.locator('[data-action="validate-question"]').click();
    await expect
        .poll(() => page.evaluate(() => /** @type {any} */ (window).__spoken.at(-1)))
        .toMatch(/^(Bonne|Mauvaise) réponse\./);

    await page.locator('[data-action="next-question"]').click();
    const question = (await page.locator('.quiz-question-text').textContent()).trim();
    await expect.poll(() => page.evaluate(() => /** @type {any} */ (window).__spoken.at(-1))).toContain(question);

    await page.reload();
    await page.locator('[data-action="startQcmSession"]').click();
    await expect(page.locator('[data-action="quiz-voice-auto"]')).toHaveAttribute('aria-pressed', 'true');
});

test('Spec 016 : répondre à la voix après avoir accepté l’avertissement', async ({ page }) => {
    await startTraining(page);
    const mic = page.locator('[data-action="quiz-voice-mic"]');
    await mic.click();
    await expect(page.locator('.qcm-voice-notice')).toContainText('Google pour Chrome et Edge, Apple pour Safari');
    expect(await page.evaluate(() => /** @type {any} */ (window).__recognizers.length)).toBe(0);

    await page.locator('[data-action="quiz-voice-consent"]').click();
    await expect(mic).toHaveAttribute('aria-pressed', 'true');

    await expect.poll(() => page.evaluate(() => /** @type {any} */ (window).__hear('B et A'))).toBe(true);
    await expect(page.locator('#qcm-voice-status')).toHaveText('Entendu : B et A');
    await expect(page.locator('#qcm-choices .qcm-option.selected')).toHaveCount(2);

    await expect.poll(() => page.evaluate(() => /** @type {any} */ (window).__hear('pas sûr'))).toBe(true);
    await expect(page.locator('#qcm-voice-status')).toHaveText('Pas compris : pas sûr');
    await expect(page.locator('#qcm-choices .qcm-option.selected')).toHaveCount(2);

    await expect.poll(() => page.evaluate(() => /** @type {any} */ (window).__hear('valider'))).toBe(true);
    await expect(page.locator('[data-action="next-question"]')).toBeVisible();

    await page.locator('[data-action="quiz-voice-revoke"]').click();
    await expect(mic).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#qcm-voice-status')).toContainText('Accord retiré');
});
