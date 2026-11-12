import { test, expect } from '@playwright/test';
import { formatSpeechText } from '../../js/services/voice_service.js';

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
            get speaking() {
                return current !== null;
            },
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
                this.started = 0;
                w.__recognizers.push(this);
            }
            start() {
                this.active = true;
                this.started += 1;
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
    await expect(async () => {
        await page.locator('[data-action="startQcmSession"]').click();
        await expect(page.locator('#qcm-choices .qcm-option').first()).toBeVisible({ timeout: 500 });
    }).toPass({ timeout: 10000 });
}

test('Spec 016 : « Lecture auto » lit la question et ses réponses avec leur lettre', async ({ page }) => {
    await startTraining(page);
    const letters = page.locator('#qcm-choices .qcm-option-letter');
    await expect(letters.first()).toHaveText('A');

    await page.locator('[data-action="quiz-voice-auto"]').click();
    const question = (await page.locator('.quiz-question-text').textContent()).trim();
    const firstAnswer = (await page.locator('#qcm-choices .qcm-option').first().textContent())
        .trim()
        .replace(/^A\s*/, '');
    await expect
        .poll(() => page.evaluate(() => /** @type {any} */ (window).__spoken.join(' ').replace(/\s+/g, ' ').trim()))
        .toContain(formatSpeechText(`Réponse A : ${firstAnswer}`).replace(/\s+/g, ' ').trim());
    const spoken = await page.evaluate(() =>
        /** @type {any} */ (window).__spoken.join(' ').replace(/\s+/g, ' ').trim(),
    );
    expect(spoken.startsWith(formatSpeechText(question).replace(/\s+/g, ' ').trim())).toBe(true);
});

test('Spec 016 : la lecture auto lit chaque nouvelle question et reste activée', async ({ page }) => {
    await startTraining(page);
    await page.locator('[data-action="quiz-voice-auto"]').click();
    await expect(page.locator('[data-action="quiz-voice-auto"]')).toHaveAttribute('aria-pressed', 'true');

    const spokenBeforeValidate = await page.evaluate(() => /** @type {any} */ (window).__spoken.length);
    await page.locator('#qcm-choices .qcm-option').first().click();
    await page.locator('[data-action="validate-question"]').click();
    await expect
        .poll(() =>
            page.evaluate(
                (from) => /** @type {any} */ (window).__spoken.slice(from).join(' ').trim(),
                spokenBeforeValidate,
            ),
        )
        .toMatch(/(Bonne réponse|Mauvaise réponse|Réponse incomplète)\./);

    const spokenBeforeNext = await page.evaluate(() => /** @type {any} */ (window).__spoken.length);
    await page.locator('[data-action="next-question"]').click();
    const question = (await page.locator('.quiz-question-text').textContent()).trim();
    await expect
        .poll(() =>
            page.evaluate(
                (from) => /** @type {any} */ (window).__spoken.slice(from).join(' ').replace(/\s+/g, ' ').trim(),
                spokenBeforeNext,
            ),
        )
        .toContain(formatSpeechText(question).replace(/\s+/g, ' ').trim());

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

    // Spec 022 : juste après la confirmation vocale, une phrase incomprise est prise pour un écho et
    // ignorée ; une fois ce court délai passé, elle est signalée.
    await expect
        .poll(
            async () => {
                await page.evaluate(() => /** @type {any} */ (window).__hear('pas sûr'));
                return page.locator('#qcm-voice-status').textContent();
            },
            { timeout: 5000, intervals: [300] },
        )
        .toBe('Pas compris : pas sûr');
    await expect(page.locator('#qcm-choices .qcm-option.selected')).toHaveCount(2);

    await expect.poll(() => page.evaluate(() => /** @type {any} */ (window).__hear('valider'))).toBe(true);
    await expect(page.locator('[data-action="next-question"]')).toBeVisible();

    await page.locator('[data-action="quiz-voice-revoke"]').click();
    await expect(mic).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#qcm-voice-status')).toContainText('Accord retiré');
});

test('Mode vocal : acronymes épelés, découpage des phrases et réponse oui/non enchaînée sur plusieurs questions', async ({
    page,
}) => {
    await startTraining(page);

    // Vérifie dans le navigateur que la synthèse normalise les acronymes (CEN, FL, FFVL) sans casser NOTAM et découpe les longues phrases.
    await page.evaluate(async () => {
        const { default: VoiceService } = await import('/js/services/voice_service.js');
        VoiceService.speak(
            'Selon le CEN et la FFVL, le plafond FL 115 correspond à 1013 hPa ou 500 m/sol, et il faut impérativement consulter les NOTAM ainsi que les cartes AZBA avant le décollage en montagne.',
        );
    });
    await expect
        .poll(() =>
            page.evaluate(() => {
                const w = /** @type {any} */ (window);
                return w.speechSynthesis.speaking ? '' : w.__spoken.join(' ');
            }),
        )
        .toContain('montagne.');
    const spokenSample = await page.evaluate(() => /** @type {any} */ (window).__spoken);
    const normalizedSample = spokenSample.join(' ');
    expect(spokenSample.length).toBeGreaterThan(1);
    expect(normalizedSample).toContain('C.E.N.');
    expect(normalizedSample).toContain('F.F.V.L.');
    expect(normalizedSample).toContain('F.L. 115');
    expect(normalizedSample).toContain('hectopascals');
    expect(normalizedSample).toContain('mètres sol');
    expect(normalizedSample).toContain('notam');
    expect(normalizedSample).toContain('azba');

    // Réinitialise l'écoute vocale en mode mains libres complet (Lecture auto + Enchaîner + Micro).
    await page.locator('[data-action="quiz-voice-auto"]').click();
    await page.locator('[data-action="quiz-voice-chain"]').click();
    await page.locator('[data-action="quiz-voice-mic"]').click();
    await page.locator('[data-action="quiz-voice-consent"]').click();

    const waitReadyAndSay = async (text) => {
        await expect
            .poll(() =>
                page.evaluate((phrase) => {
                    const w = /** @type {any} */ (window);
                    if (w.speechSynthesis.speaking) return false;
                    return w.__hear(phrase);
                }, text),
            )
            .toBe(true);
    };

    const optionCount = await page.locator('#qcm-choices .qcm-option').count();
    await expect(page.locator('#qcm-choices .qcm-option').first()).toHaveClass(/voice-current/);
    await expect(page.locator('#qcm-voice-status')).toContainText('Réponse A :');

    await waitReadyAndSay('oui');
    await expect(page.locator('#qcm-choices .qcm-option').first()).toHaveClass(/selected/);

    for (let i = 1; i < optionCount; i++) {
        await expect(page.locator('#qcm-choices .qcm-option').nth(i)).toHaveClass(/voice-current/);
        await waitReadyAndSay('non');
    }

    await expect(page.locator('#qcm-voice-status')).toContainText('Confirmer ?');
    const q1Text = (await page.locator('.quiz-question-text').textContent()).trim();
    await waitReadyAndSay('oui');

    // Le mode enchaîné passe automatiquement à la question 2 et maintient l'écoute active.
    await expect(page.locator('.quiz-question-text')).not.toHaveText(q1Text, { timeout: 6000 });
    await expect(page.locator('#qcm-choices .qcm-option').first()).toHaveClass(/voice-current/, { timeout: 6000 });
    await waitReadyAndSay('oui');
    await expect(page.locator('#qcm-choices .qcm-option').first()).toHaveClass(/selected/);

    const stats = await page.evaluate(() => {
        const recs = /** @type {any[]} */ (/** @type {any} */ (window).__recognizers);
        return {
            count: recs.length,
            starts: recs.reduce((sum, r) => sum + (r.started || 0), 0),
        };
    });
    expect(stats.count).toBe(1);
    expect(stats.starts).toBeGreaterThan(2);
});
