import { test, expect } from '@playwright/test';
import { ffvlExport } from '../helpers/xlsx_fixture.js';

// Spec 046 : l'export Excel du carnet FFVL est importé, ses vols sont repérés dans l'historique, un second import
// du même fichier n'ajoute rien, et un import peut être annulé.
const xlsx = (flights, name = 'Carnet_vols.xlsx') => ({
    name,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(ffvlExport(flights)),
});

const EXPORT = [
    ['2026-10-27', 'SANARY', 100, '60 minutes', 'Analyse personnelle', 'Jean Dupont'],
    ['2026-10-28', 'ANNECY', 250, '30 minutes', '', 'Jean Dupont'],
];

test.describe('E2E - Logbook FFVL import', () => {
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
        await page.route('https://nominatim.openstreetmap.org/**', (route) => route.abort());
        page.on('dialog', (dialog) => dialog.accept());
        await page.goto('/');
        await page.locator('.nav-menu-btn[data-target="LOGBOOK"]').first().click();
        await page.locator('[data-action="openLogbookSection"][data-args="\'history\'"]').click();
        await expect(page.locator('#logbook-screen')).toHaveClass(/active/);
    });

    const row = (page, n) => page.locator(`#logbook-ffvl-table tbody tr[data-row="r${n}"]`);

    test('imports an export, marks its flights, refuses a second import of it, and cancels the import', async ({
        page,
    }) => {
        await page.setInputFiles('#ffvl-import-input', xlsx(EXPORT));

        await expect(page.locator('#logbook-ffvl-modal')).toBeVisible();
        await expect(page.locator('#logbook-ffvl-table tbody tr')).toHaveCount(2);
        await expect(row(page, 0)).toContainText('27/10/2026');
        await expect(row(page, 0).locator('[data-ffvl-field="site"]')).toHaveValue('Sanary');
        await expect(row(page, 0).locator('.batch-status')).toHaveText('Prêt');
        await expect(page.locator('#logbook-ffvl-import')).toHaveText('Importer 2 vols');
        await page.locator('#logbook-ffvl-import').click();

        await expect(page.locator('#logbook-ffvl-modal')).toBeHidden();
        await expect(page.locator('.logbook-card')).toHaveCount(2);
        await expect(page.locator('.session-import-badge')).toHaveCount(2);
        await expect(page.locator('.logbook-card .session-date').first()).toHaveText('28/10/2026');
        await expect(page.locator('.logbook-import-text')).toContainText('2 vols');

        // Le même export une deuxième fois : tout est déjà importé, rien à ajouter
        await page.setInputFiles('#ffvl-import-input', xlsx(EXPORT));
        await expect(page.locator('#logbook-ffvl-table tbody tr')).toHaveCount(2);
        for (const n of [0, 1]) {
            await expect(row(page, n).locator('.batch-status')).toHaveText('Déjà importé');
            await expect(row(page, n).locator('[data-ffvl-field="included"]')).not.toBeChecked();
        }
        await expect(page.locator('#logbook-ffvl-import')).toBeDisabled();
        await page.locator('#logbook-ffvl-cancel').click();
        await expect(page.locator('#logbook-ffvl-modal')).toBeHidden();
        await expect(page.locator('.logbook-card')).toHaveCount(2);

        // L'import est annulé : le carnet est vide, comme avant
        await page.locator('[data-action="undoFfvlImport"]').click();
        await expect(page.locator('.logbook-card')).toHaveCount(0);
        await expect(page.locator('.logbook-imports')).toHaveCount(0);

        // Et le même export s'importe de nouveau comme la première fois
        await page.setInputFiles('#ffvl-import-input', xlsx(EXPORT));
        await expect(row(page, 0).locator('.batch-status')).toHaveText('Prêt');
        await page.locator('#logbook-ffvl-import').click();
        await expect(page.locator('.logbook-card')).toHaveCount(2);
    });

    test('keeps the flights entered by hand when an import is cancelled, and survives a reload', async ({ page }) => {
        await page.evaluate(async () => {
            const { default: LogbookService } = await import('/js/services/logbook_service.js');
            LogbookService.addFlight({
                type: 'vol',
                datetime: '2026-09-01T10:15',
                site: 'Annecy',
                duree: 20,
                voile: 'Ma voile',
                typeVol: 'Thermique',
            });
        });
        await page.setInputFiles('#ffvl-import-input', xlsx(EXPORT));
        await page.locator('#logbook-ffvl-import').click();
        await expect(page.locator('.logbook-card')).toHaveCount(3);

        await page.reload();
        await page.locator('.nav-menu-btn[data-target="LOGBOOK"]').first().click();
        await page.locator('[data-action="openLogbookSection"][data-args="\'history\'"]').click();
        await expect(page.locator('.session-import-badge')).toHaveCount(2);

        await page.locator('[data-action="undoFfvlImport"]').click();
        await expect(page.locator('.logbook-card')).toHaveCount(1);
        await expect(page.locator('.logbook-card')).toContainText('Ma voile');
        await expect(page.locator('.session-import-badge')).toHaveCount(0);
    });

    test('says so for a file that is not an FFVL logbook', async ({ page }) => {
        const messages = [];
        page.removeAllListeners('dialog');
        page.on('dialog', (dialog) => {
            messages.push(dialog.message());
            dialog.accept();
        });
        await page.setInputFiles('#ffvl-import-input', {
            name: 'carnet.xlsx',
            mimeType: 'application/octet-stream',
            buffer: Buffer.from('Date;Site'),
        });
        await expect.poll(() => messages.length).toBe(1);
        expect(messages[0]).toContain('carnet.xlsx');
        await expect(page.locator('#logbook-ffvl-modal')).toBeHidden();
    });
});
