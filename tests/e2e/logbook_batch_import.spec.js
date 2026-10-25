import { test, expect } from '@playwright/test';
import { buildFlight, CORRUPTED_IGC } from '../helpers/igc_fixture.js';

// Spec 039 : plusieurs vols importés d'un coup dans un tableau modifiable.
const igc = (name, flight) => ({ name, mimeType: 'application/octet-stream', buffer: Buffer.from(flight.igc) });
const sdf = (name, flight) => ({ name, mimeType: 'application/octet-stream', buffer: Buffer.from(flight.sdf) });

// Trois vols du même décollage le même jour, de formes différentes, et un quatrième sans fichier de capteurs
const flights = () => [
    buildFlight({ start: '07:30:00', heading: 90, speed: 8, sink: 1, gPeak: 2.1 }),
    buildFlight({ start: '09:00:00', heading: 200, speed: 9, sink: 1.3, gPeak: 3.2 }),
    buildFlight({ start: '12:30:00', heading: 300, speed: 7, sink: 0.8, gPeak: 1.7 }),
];

test.describe('E2E - Logbook batch import', () => {
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
        await page.goto('/');
        await page.locator('.nav-menu-btn[data-target="LOGBOOK"]').first().click();
        await page.locator('[data-action="openLogbookSection"][data-args="\'history\'"]').click();
        await expect(page.locator('#logbook-screen')).toHaveClass(/active/);
    });

    const chooseFiles = async (page, files) => {
        await page.locator('#logbook-add-btn').click();
        await expect(page.locator('#logbook-session-modal')).toBeVisible();
        await page.setInputFiles('#global-igc-input', files);
    };

    const row = (page, n) => page.locator(`#logbook-batch-table tbody tr[data-row="r${n}"]`);

    test('a day of flights is checked in one table and imported at once, each with its own sensor file', async ({
        page,
    }) => {
        const [a, b, c] = flights();
        await chooseFiles(page, [
            igc('vol-3.igc', c),
            igc('vol-1.igc', a),
            igc('vol-2.igc', b),
            // Les noms sont échangés : seul le contenu décide du rattachement
            sdf('vol-3.sdf', a),
            sdf('vol-1.sdf', c),
            sdf('vol-2.sdf', b),
            sdf('orphelin.sdf', buildFlight({ start: '16:00:00', heading: 150, speed: 11, sink: 2 })),
            { name: 'junk.igc', mimeType: 'application/octet-stream', buffer: Buffer.from(CORRUPTED_IGC) },
        ]);

        await expect(page.locator('#logbook-batch-modal')).toBeVisible();
        await expect(page.locator('#logbook-batch-table tbody tr')).toHaveCount(4);
        // Rangés par date de vol : le premier est le plus tôt, quel que soit l'ordre de sélection
        await expect(row(page, 0)).toContainText('vol-1.igc');
        await expect(row(page, 1)).toContainText('vol-2.igc');
        await expect(row(page, 2)).toContainText('vol-3.igc');
        await expect(row(page, 3)).toContainText('junk.igc');
        await expect(row(page, 3).locator('[data-batch-field="included"]')).toBeDisabled();
        await expect(page.locator('#logbook-batch-sensors')).toContainText('orphelin.sdf');
        for (const [n, name] of [
            [0, 'vol-3.sdf'],
            [1, 'vol-2.sdf'],
            [2, 'vol-1.sdf'],
        ]) {
            await expect(row(page, n)).toContainText(`Capteurs : ${name}`);
        }

        // Sans matériel enregistré, la voile se saisit via « Autre » ; « Appliquer à toutes » la recopie
        await row(page, 0).locator('select[data-batch-field="voile"]').selectOption('Autre');
        await row(page, 0).locator('[data-batch-field="voileOther"]').fill('Voile test');
        await page.locator('[data-batch-apply="voile"]').click();
        for (const n of [0, 1, 2]) await row(page, n).locator('[data-batch-field="site"]').fill(`Site ${n}`);
        // Un pilote sur le deuxième vol, au clavier
        await row(page, 1).locator('[data-batch-field="pilot-new"]').fill('Julie');
        await row(page, 1).locator('[data-batch-field="pilot-new"]').press('Enter');
        await expect(row(page, 1).locator('[data-batch-pilot="Julie"]')).toBeVisible();

        await expect(page.locator('#logbook-batch-summary')).toContainText('3 vols prêts, 0 à vérifier, 1 ignorés');
        await expect(page.locator('#logbook-batch-import')).toHaveText('Importer 3 vols');
        await page.locator('#logbook-batch-import').click();

        await expect(page.locator('#logbook-batch-modal')).toBeHidden();
        await expect(page.locator('#logbook-session-modal')).toBeHidden();
        await expect(page.locator('.logbook-card')).toHaveCount(3);
        await expect(page.locator('[data-action="showTrace"]')).toHaveCount(3);

        const saved = await page.evaluate(async () => {
            const { default: LogbookService } = await import('/js/services/logbook_service.js');
            return LogbookService.getFlights().map((f) => ({
                site: f.site,
                voile: f.voile,
                pilotes: f.pilotes,
                gMax: f.sensorStats?.gMax ?? null,
                hasTrace: Boolean(f.rawIgc),
            }));
        });
        // Du plus récent au plus ancien : chaque vol a les capteurs de son propre fichier
        expect(saved.map((f) => f.gMax)).toEqual([1.7, 3.2, 2.1]);
        expect(saved.every((f) => f.voile === 'Voile test' && f.hasTrace)).toBe(true);
        expect(saved.find((f) => f.site === 'Site 1').pilotes).toEqual(['Julie']);

        // Les mêmes fichiers une deuxième fois : tous sont déjà au carnet, décochés
        await chooseFiles(page, [igc('vol-1.igc', a), igc('vol-2.igc', b), igc('vol-3.igc', c)]);
        await expect(page.locator('#logbook-batch-table tbody tr')).toHaveCount(3);
        for (const n of [0, 1, 2]) {
            await expect(row(page, n).locator('.batch-status')).toHaveText('Déjà dans le carnet');
            await expect(row(page, n).locator('[data-batch-field="included"]')).not.toBeChecked();
        }
        await page.locator('#logbook-batch-cancel').click();
        await expect(page.locator('#logbook-batch-modal')).toBeHidden();
        await expect(page.locator('.logbook-card')).toHaveCount(3);
    });

    test('a missing wing blocks the import and marks the cell; unticking the row lets the others through', async ({
        page,
    }) => {
        const [a, b] = flights();
        await chooseFiles(page, [igc('a.igc', a), igc('b.igc', b)]);
        await expect(page.locator('#logbook-batch-table tbody tr')).toHaveCount(2);
        await row(page, 0).locator('select[data-batch-field="voile"]').selectOption('Autre');
        await row(page, 0).locator('[data-batch-field="voileOther"]').fill('Voile test');
        await row(page, 0).locator('[data-batch-field="site"]').fill('Site A');
        await row(page, 1).locator('[data-batch-field="site"]').fill('Site B');
        await page.locator('#logbook-batch-import').click();
        await expect(page.locator('#logbook-batch-modal')).toBeVisible();
        await expect(row(page, 1).locator('select[data-batch-field="voile"]')).toHaveAttribute('aria-invalid', 'true');
        await expect(page.locator('#logbook-batch-live')).toContainText('Corrige les lignes marquées');
        await row(page, 1).locator('[data-batch-field="included"]').uncheck();
        await page.locator('#logbook-batch-import').click();
        await expect(page.locator('#logbook-batch-modal')).toBeHidden();
        await expect(page.locator('.logbook-card')).toHaveCount(1);
    });

    test('the table stays usable on a phone', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 800 });
        const [a, b] = flights();
        await chooseFiles(page, [igc('a.igc', a), igc('b.igc', b)]);
        await expect(page.locator('#logbook-batch-table tbody tr')).toHaveCount(2);
        await expect(row(page, 0).locator('select[data-batch-field="voile"]')).toBeVisible();
        await expect(row(page, 0).locator('[data-batch-field="site"]')).toBeVisible();
        await expect(page.locator('#logbook-batch-import')).toBeVisible();
        await expect(page.locator('#logbook-batch-cancel')).toBeVisible();
    });
});
