import { test, expect } from '@playwright/test';

// Le QCM doit fonctionner hors ligne : ses fichiers de questions sont mis en cache par le service
// worker à l'installation, mais le quiz les demande avec « ?v=<heure> » pour contourner le cache
// HTTP. Le service worker doit donc les retrouver quelle que soit cette suite d'adresse.
async function loadWithServiceWorker(page) {
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
    });
    await page.goto('/');
    await page.waitForFunction(async () => {
        await navigator.serviceWorker.ready;
        return !!navigator.serviceWorker.controller;
    });
}

test.describe('QCM hors ligne', () => {
    test('les questions se chargent sans réseau', async ({ page, context, browserName }) => {
        // Comme dans offline_storage.spec.js : en WebKit, le hors-ligne simulé coupe les requêtes
        // avant le service worker.
        test.skip(browserName === 'webkit', 'hors-ligne simulé non vu par le service worker en WebKit');
        await loadWithServiceWorker(page);
        // Installation terminée : les fichiers de questions sont dans le cache
        await page.waitForFunction(async () => {
            const keys = await caches.keys();
            for (const key of keys) {
                const cache = await caches.open(key);
                if (await cache.match('./js/data/qcm_ffvl.csv')) return true;
            }
            return false;
        });

        await context.setOffline(true);
        const result = await page.evaluate(async () => {
            const { default: QuizService } = await import('/js/services/quiz_service.js');
            QuizService.questions = [];
            const res = await QuizService.loadOfficialData();
            return { success: res.success, count: res.data ? res.data.length : 0, error: res.error };
        });
        await context.setOffline(false);

        expect(result.error).toBeNull();
        expect(result.success).toBe(true);
        expect(result.count).toBeGreaterThan(100);
    });
});
