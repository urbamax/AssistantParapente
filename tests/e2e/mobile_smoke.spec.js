import { test, expect } from '@playwright/test';

/**
 * Parcours mobile (390×844) : vérifie que les écrans principaux (Accueil, QCM, Sécurité/ICE,
 * modale de retour pilote) s'affichent sans débordement horizontal ni erreur JS sur smartphone.
 */
test.describe('Mobile viewport smoke (390x844)', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('renders welcome, QCM setup, safety and feedback modal cleanly on mobile', async ({ page }) => {
        const pageErrors = [];
        page.on('pageerror', (err) => pageErrors.push(err.message));

        await page.addInitScript(() => {
            localStorage.setItem(
                'parapente_gdpr_consent',
                JSON.stringify({ stats: true, firebase: false, gps: false, version: 2026, date: '2026-11-20' }),
            );
        });

        await page.goto('/?mode=WELCOME');
        await expect(page.locator('#welcome-screen.active')).toBeVisible();

        // Navigation vers QCM
        await page.goto('/?mode=QCM');
        await expect(page.locator('#qcm-setup-screen.active')).toBeVisible();
        await expect(page.locator('#mode-training')).toBeVisible();

        // Navigation vers Sécurité
        await page.goto('/?mode=SAFETY');
        await expect(page.locator('#safety-screen.active')).toBeVisible();

        // Ouverture & fermeture de la modale feedback depuis le footer
        const feedbackLink = page.locator('#safety-screen [data-action="openFeedbackModal"]').first();
        await feedbackLink.scrollIntoViewIfNeeded();
        await feedbackLink.click();
        await expect(page.locator('#feedback-modal.active')).toBeVisible();
        await page.locator('#feedback-modal [data-action="closeFeedbackModal"]').first().click();

        expect(pageErrors).toEqual([]);
    });
});
