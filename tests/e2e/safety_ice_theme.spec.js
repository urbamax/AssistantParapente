import { test, expect } from '@playwright/test';

/**
 * Parcours E2E : changement de thème (clair/sombre), écran Sécurité (urgence, check-lists, ICE)
 * et ouverture directe d'une fiche d'urgence ICE via URL/hash sans connexion.
 */
test.describe('E2E - Sécurité, Fiche ICE & Thème', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem(
                'parapente_gdpr_consent',
                JSON.stringify({ stats: true, firebase: false, gps: false, version: 2026, date: '2026-11-20' }),
            );
        });
    });

    test('le bouton de thème bascule entre auto, clair et sombre en synchronisant <html> et <body>', async ({
        page,
    }) => {
        const pageErrors = [];
        page.on('pageerror', (err) => pageErrors.push(err.message));

        await page.goto('/?mode=WELCOME');
        const toggleBtn = page.locator('#theme-toggle');
        await expect(toggleBtn).toBeVisible();

        // Par défaut auto -> 1er clic passe en light -> 2e clic passe en dark
        await toggleBtn.click();
        await expect(page.locator('html')).toHaveClass(/light-mode/);
        await expect(page.locator('body')).toHaveClass(/light-mode/);

        await toggleBtn.click();
        await expect(page.locator('html')).toHaveClass(/dark-theme/);
        await expect(page.locator('body')).toHaveClass(/dark-theme/);

        expect(pageErrors).toEqual([]);
    });

    test('l’écran Sécurité affiche le 112, les check-lists et l’éditeur d’étiquette casque ICE', async ({ page }) => {
        const pageErrors = [];
        page.on('pageerror', (err) => pageErrors.push(err.message));

        await page.goto('/?mode=SAFETY');
        await expect(page.locator('#safety-screen.active')).toBeVisible();
        await expect(page.locator('#safety-screen')).toContainText('112');
        await expect(page.locator('#safety-screen')).toContainText('143,9875');

        // Ouvrir le sous-menu Sécurité -> Prévol (check-list)
        await page.locator('[aria-controls="safety-sub-bar"]').first().click();
        const prevolTab = page.locator('#safety-sub-bar [data-safety-tab="prevol"]');
        await expect(prevolTab).toBeVisible();
        await prevolTab.click();
        await expect(page.locator('#safety-panel-prevol')).toBeVisible();

        // Ouvrir le sous-menu Sécurité -> Fiche ICE
        await page.locator('[aria-controls="safety-sub-bar"]').first().click();
        const iceTab = page.locator('#safety-sub-bar [data-safety-tab="ice"]');
        await expect(iceTab).toBeVisible();
        await iceTab.click();
        await expect(page.locator('#ice-helmet-sticker')).toBeVisible();
        await expect(page.locator('#ice-prenom')).toBeVisible();

        expect(pageErrors).toEqual([]);
    });

    test('une URL ICE avec payload hash affiche la fiche secours sans connexion', async ({ page }) => {
        const pageErrors = [];
        page.on('pageerror', (err) => pageErrors.push(err.message));

        // Payload v1 lisible hors-ligne par un secouriste
        const hash = '#v=1&p=Thomas&n=Dupont&bg=O%2B&al=Penicilline&c1=Sophie%7C0612345678%7CConjointe';
        await page.goto(`/?mode=ICE${hash}`);

        await expect(page.locator('#ice-screen.active')).toBeVisible();
        const root = page.locator('#ice-root');
        await expect(root).toContainText('URGENCE PILOTE');
        await expect(root).toContainText('Thomas Dupont');
        await expect(root).toContainText('O+');
        await expect(root).toContainText('Penicilline');
        await expect(root).toContainText('Sophie');
        await expect(root.locator('a[href="tel:112"]')).toBeVisible();

        expect(pageErrors).toEqual([]);
    });
});
