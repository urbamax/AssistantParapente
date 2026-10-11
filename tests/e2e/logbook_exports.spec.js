import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Spec 033 : télécharger l'IGC d'un vol et exporter le carnet en PDF.
const IGC = readFileSync('tests/fixtures/syride-winch-flight.igc', 'utf8');

test.describe('E2E - Logbook exports', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            window.localStorage.setItem(
                'parapente_gdpr_consent',
                JSON.stringify({
                    stats: true,
                    firebase: true,
                    gps: false,
                    version: 2026,
                    date: new Date().toISOString(),
                }),
            );
        });
        await page.route('https://server.arcgisonline.com/**', (route) => route.abort());
        await page.route('https://api.open-meteo.com/**', (route) => route.abort());
        await page.goto('/');
    });

    const openHistory = async (page) => {
        await page.locator('.nav-menu-btn[data-target="LOGBOOK"]').first().click();
        await page.locator('[data-action="openLogbookSection"][data-args="\'history\'"]').click();
        await expect(page.locator('#logbook-screen')).toHaveClass(/active/);
    };

    test('a flight card downloads its original IGC file', async ({ page }) => {
        await openHistory(page);
        await page.evaluate(async (rawIgc) => {
            const { default: LogbookService } = await import('/js/services/logbook_service.js');
            const { default: LogbookView } = await import('/js/views/logbook.js');
            LogbookService.addFlight({
                type: 'vol',
                datetime: '2026-09-14T10:00',
                site: 'Plaine Joux',
                voile: 'Voile',
                duree: 30,
                rawIgc,
            });
            LogbookView.renderHistory();
        }, IGC);

        const downloadPromise = page.waitForEvent('download');
        await page.locator('[data-action="downloadTrace"]').first().click();
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toBe('2026-09-14_plaine-joux.igc');
        const path = await download.path();
        expect(readFileSync(path, 'utf8')).toBe(IGC);
    });

    test('the PDF export refuses an empty logbook with a message', async ({ page }) => {
        await openHistory(page);
        const dialogs = [];
        page.on('dialog', (dialog) => {
            dialogs.push(dialog.message());
            dialog.dismiss();
        });
        await page.locator('#logbook-export-pdf-btn').click();
        await expect.poll(() => dialogs.length).toBe(1);
        expect(dialogs[0]).toContain('rien à exporter');
    });

    test('the PDF export prints a report of the logbook', async ({ page }) => {
        // La boîte d'impression n'est pas pilotable : on relève ce que le navigateur allait imprimer.
        await page.addInitScript(() => {
            window.__printed = [];
            // Le script d'initialisation s'exécute aussi dans l'iframe d'impression.
            window.print = () => {
                window.top.__printed.push(document.body.innerText);
            };
        });
        await page.reload();
        await openHistory(page);
        await page.evaluate(async () => {
            const { default: LogbookService } = await import('/js/services/logbook_service.js');
            LogbookService.addFlight({
                type: 'vol',
                datetime: '2026-09-14T10:00',
                site: 'Plaine Joux',
                voile: 'Voile A',
                duree: 90,
            });
            LogbookService.addFlight({
                type: 'gonflage',
                datetime: '2026-09-12T10:00',
                lieu: 'Parking',
                voile: 'Voile A',
                duree: 20,
            });
        });
        await page.locator('#logbook-export-pdf-btn').click();
        await expect.poll(() => page.evaluate(() => window.__printed.length)).toBe(1);
        const report = await page.evaluate(() => window.__printed[0]);
        expect(report).toContain('Carnet de vol');
        expect(report).toContain('Plaine Joux');
        expect(report).toContain('Parking');
        expect(report).toContain('2 sessions');
    });
});
