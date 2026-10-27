import { test, expect } from '@playwright/test';

// Spec 036 : la politique de sécurité (sans script inline) ne bloque rien d'utile.
// Le navigateur applique réellement la balise <meta> : on relève les violations qu'il signale.
test.use({ serviceWorkers: 'block' });

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
        window.__cspViolations = [];
        document.addEventListener('securitypolicyviolation', (e) => {
            window.__cspViolations.push(`${e.violatedDirective} ${e.blockedURI}`);
        });
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
    await page.route('https://server.arcgisonline.com/**', (route) => route.abort());
});

const violations = (page) => page.evaluate(() => window.__cspViolations);

test('the main screens start without any CSP violation', async ({ page }) => {
    for (const mode of ['QCM', 'SITES', 'LOGBOOK', 'SAFETY']) {
        await page.goto(`/?mode=${mode}`);
        await expect(
            page.locator('.mode-screen.active, #logbook-screen.active, #sites-screen.active').first(),
        ).toBeVisible();
        expect(await violations(page), `screen ${mode}`).toEqual([]);
    }
});

test('the saved theme is applied before the app starts (theme_boot.js runs)', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('themeMode', 'light'));
    await page.goto('/?mode=QCM');
    // La classe est posée par le script du <head>, avant le démarrage des modules de l'application.
    await expect(page.locator('html')).toHaveClass(/light-mode/);
    expect(await violations(page)).toEqual([]);
});

test('an inline script is blocked and reported', async ({ page }) => {
    await page.goto('/?mode=QCM');
    await page.evaluate(() => {
        const s = document.createElement('script');
        s.textContent = 'window.__injected = true';
        document.head.appendChild(s);
    });
    expect(await page.evaluate(() => window.__injected)).toBeUndefined();
    // Le navigateur signale la violation dans une tâche différée : sur WebKit en CI elle peut arriver
    // plusieurs millisecondes après le retour de page.evaluate, donc on attend l'événement au lieu de le lire tout de suite.
    await expect
        .poll(async () => (await violations(page)).join('\n'), { message: 'a script-src violation is reported' })
        .toContain('script-src');
});
