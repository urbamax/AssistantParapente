import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test.describe('E2E - Modale de signalement et suggestion', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.clear();
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
            window.__copiedFeedback = '';
            try {
                Object.defineProperty(navigator, 'clipboard', {
                    configurable: true,
                    value: {
                        writeText: async (text) => {
                            window.__copiedFeedback = text;
                        },
                    },
                });
            } catch {
                // Fallback si le navigateur interdit la surcharge
            }
        });
    });

    test('ouvre la modale depuis le pied de page, sauvegarde le brouillon et gère le clavier', async ({ page }) => {
        await page.goto('/');

        const footerLink = page
            .locator('.app-footer [data-action="openFeedbackModal"]')
            .filter({ visible: true })
            .first();
        await footerLink.scrollIntoViewIfNeeded();
        await expect(footerLink).toBeVisible();
        await footerLink.focus();
        await page.keyboard.press('Enter');

        const modal = page.locator('#feedback-modal');
        await expect(modal).toBeVisible();

        await modal.locator('[data-feedback-category="suggestion"]').click();
        await modal.locator('#feedback-subject').fill('Idée de filtre');
        await modal.locator('#feedback-description').fill('Pouvoir filtrer les sites selon la saison.');
        await modal.locator('#feedback-contact').fill('@pilote_nord');

        // Fermer avec Echap puis rouvrir via clic
        await page.keyboard.press('Escape');
        await expect(modal).not.toBeVisible();

        await footerLink.click();
        await expect(modal).toBeVisible();
        await expect(modal.locator('#feedback-subject')).toHaveValue('Idée de filtre');
        await expect(modal.locator('#feedback-description')).toHaveValue('Pouvoir filtrer les sites selon la saison.');
        await expect(modal.locator('#feedback-contact')).toHaveValue('@pilote_nord');
        await expect(modal.locator('[data-feedback-category="suggestion"]')).toHaveAttribute('aria-pressed', 'true');
        await expect(modal.locator('#feedback-context-preview')).toContainText('Écran : WELCOME');
    });

    test('envoie via le relais auto-hébergé /api/feedback et efface le brouillon', async ({ page }) => {
        let submittedPayload = null;

        await page.route('**/api/feedback', async (route) => {
            submittedPayload = route.request().postDataJSON();
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ success: true }),
            });
        });

        await page.goto('/');
        const footerLink = page
            .locator('.app-footer [data-action="openFeedbackModal"]')
            .filter({ visible: true })
            .first();
        await footerLink.scrollIntoViewIfNeeded();
        await footerLink.click();

        const modal = page.locator('#feedback-modal');
        await expect(modal).toBeVisible();
        await modal.locator('[data-feedback-category="qcm_course"]').click();
        await modal.locator('#feedback-subject').fill('Erreur énoncé QCM');
        await modal.locator('#feedback-description').fill('La réponse C semble inversée avec la B dans ce thème.');
        await modal.locator('#feedback-contact').fill('pilote@example.com');
        await modal.locator('#feedback-submit-btn').click();

        await expect.poll(() => submittedPayload).not.toBeNull();
        expect(submittedPayload.category).toBe('qcm_course');
        expect(submittedPayload.contact).toBe('pilote@example.com');
        expect(submittedPayload.description).toContain('La réponse C semble inversée');
        expect(submittedPayload.message).toContain('La réponse C semble inversée');

        await expect(modal.locator('#feedback-status')).toHaveAttribute('data-status-type', 'success');
        await expect(modal.locator('#feedback-description')).toHaveValue('');
        const draftAfter = await page.evaluate(() => localStorage.getItem('parapente_feedback_draft'));
        expect(draftAfter).toBeNull();
    });

    test('propose le repli Copier et conserve le brouillon hors ligne ou sans clé', async ({ page, context }) => {
        await page.goto('/');
        const footerLink = page
            .locator('.app-footer [data-action="openFeedbackModal"]')
            .filter({ visible: true })
            .first();
        await footerLink.scrollIntoViewIfNeeded();
        await footerLink.click();

        const modal = page.locator('#feedback-modal');
        await expect(modal).toBeVisible();
        await modal.locator('#feedback-subject').fill('Souci hors ligne');
        await modal.locator('#feedback-description').fill('Description détaillée conservée même hors ligne.');

        await context.setOffline(true);
        await modal.locator('#feedback-submit-btn').click();

        await expect(modal.locator('#feedback-status')).toHaveAttribute('data-status-type', 'warning');
        await expect(modal.locator('#feedback-description')).toHaveValue(
            'Description détaillée conservée même hors ligne.',
        );

        await modal.locator('#feedback-copy-btn').click();
        const copied = await page.evaluate(() => window.__copiedFeedback);
        if (copied) {
            expect(copied).toContain('Souci hors ligne');
            expect(copied).toContain('Description détaillée conservée même hors ligne.');
        }

        const fbHref = await modal.locator('#feedback-facebook-link').getAttribute('href');
        expect(fbHref).toBe('https://www.facebook.com/maxime.urbaniak/');
    });
});
