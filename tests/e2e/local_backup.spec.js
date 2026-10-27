import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Sauvegarde locale : export / import d'un fichier sans compte et sans consentement Firebase.

const CONSENT_REFUSED = {
    stats: true,
    firebase: false,
    gps: false,
    version: 2026,
    date: '2026-10-01T00:00:00.000Z',
};

const FLIGHT = { id: 'vol-1', datetime: '2026-09-01T10:00:00Z', site: 'Annecy', updatedAt: 1000 };

test.describe('Sauvegarde locale sans compte', () => {
    test.beforeEach(async ({ page }) => {
        // Une seule fois : l'import recharge la page, les données restaurées ne doivent pas être effacées.
        await page.addInitScript(
            ({ consent, flight }) => {
                if (sessionStorage.getItem('seeded')) return;
                sessionStorage.setItem('seeded', '1');
                localStorage.clear();
                localStorage.setItem('parapente_gdpr_consent', JSON.stringify(consent));
                localStorage.setItem('tp_logbook_data', JSON.stringify([flight]));
                localStorage.setItem(
                    'parapente_qcm_stats',
                    JSON.stringify({ q1: { correct: 3, total: 4, streak: 2, lastSeen: 99, recent: [1, 0, 1, 1] } }),
                );
            },
            { consent: CONSENT_REFUSED, flight: FLIGHT },
        );
    });

    const openSyncSpace = async (page) => {
        await page.goto('/?mode=SITES');
        await page.locator('[data-action="FirebaseAuthopenAuthModal"]:visible').first().click();
        await expect(page.locator('#auth-modal-overlay')).toBeVisible();
    };

    test('exports and re-imports every key with the Firebase consent refused, without any cloud request', async ({
        page,
    }) => {
        const cloudRequests = [];
        page.on('request', (req) => {
            if (/googleapis\.com|firebaseio\.com|gstatic\.com\/firebasejs/.test(req.url()))
                cloudRequests.push(req.url());
        });
        page.on('dialog', (dialog) => dialog.accept());
        await openSyncSpace(page);

        // Backup block visible although the sync part asks for consent
        const block = page.locator('#auth-backup-block');
        await expect(page.locator('#auth-gdpr-required-desc')).toBeVisible();
        await expect(block).toBeVisible();

        const [download] = await Promise.all([
            page.waitForEvent('download'),
            block.locator('[data-action="exportBackup"]').click(),
        ]);
        expect(download.suggestedFilename()).toMatch(/^parapente_backup_\d{4}-\d{2}-\d{2}\.json$/);
        const exported = JSON.parse(readFileSync(await download.path(), 'utf8'));
        expect(exported._meta.appName).toBe('AssistantParapente');
        expect(exported.tp_logbook_data).toEqual([FLIGHT]);
        expect(exported.parapente_qcm_stats.q1.recent).toEqual([1, 0, 1, 1]);
        await expect(block.locator('.backup-status')).toContainText('parapente_backup_');

        // Wipe the data as a browser cleanup would, then restore from the file
        await page.evaluate(() => {
            localStorage.removeItem('tp_logbook_data');
            localStorage.removeItem('parapente_qcm_stats');
        });
        const reloaded = page.waitForEvent('load');
        await page.locator('#backup-import-input').setInputFiles(await download.path());
        await expect(block.locator('.backup-status')).toContainText('restaurées');
        await reloaded;

        const restored = await page.evaluate(() => ({
            logbook: JSON.parse(localStorage.getItem('tp_logbook_data')),
            stats: JSON.parse(localStorage.getItem('parapente_qcm_stats')),
            consent: JSON.parse(localStorage.getItem('parapente_gdpr_consent')),
        }));
        expect(restored.logbook).toEqual([FLIGHT]);
        expect(restored.stats.q1.recent).toEqual([1, 0, 1, 1]);
        expect(restored.consent.firebase).toBe(false);
        expect(cloudRequests).toEqual([]);
    });

    test('rejects a file that is not a backup and keeps the local data', async ({ page }) => {
        let asked = false;
        page.on('dialog', (dialog) => {
            asked = true;
            dialog.dismiss();
        });
        await openSyncSpace(page);

        await page.locator('#backup-import-input').setInputFiles({
            name: 'notes.json',
            mimeType: 'application/json',
            buffer: Buffer.from(JSON.stringify({ hello: 'world' })),
        });

        await expect(page.locator('#auth-backup-block .backup-status')).toContainText('pas une sauvegarde');
        expect(asked).toBe(false);
        const logbook = await page.evaluate(() => JSON.parse(localStorage.getItem('tp_logbook_data')));
        expect(logbook).toEqual([FLIGHT]);
    });

    test('does not overwrite anything when the user cancels the confirmation', async ({ page }) => {
        page.on('dialog', (dialog) => dialog.dismiss());
        await openSyncSpace(page);

        await page.locator('#backup-import-input').setInputFiles({
            name: 'backup.json',
            mimeType: 'application/json',
            buffer: Buffer.from(
                JSON.stringify({
                    _meta: { appName: 'AssistantParapente', exportedAt: '2026-10-01T10:00:00.000Z' },
                    tp_logbook_data: [{ id: 'other', datetime: '2026-01-01T10:00:00Z', site: 'Autre' }],
                }),
            ),
        });

        await page.waitForTimeout(300);
        const logbook = await page.evaluate(() => JSON.parse(localStorage.getItem('tp_logbook_data')));
        expect(logbook).toEqual([FLIGHT]);
    });

    test('is also reachable from the privacy options', async ({ page }) => {
        await page.goto('/?mode=SITES');
        await page.evaluate(() => document.getElementById('gdpr-settings-modal')?.showModal());
        await page.evaluate(() => {
            const modal = document.getElementById('gdpr-settings-modal');
            modal.style.display = 'flex';
            modal.classList.add('active');
        });
        const card = page.locator('#gdpr-settings-modal [data-action="exportBackup"]');
        await expect(card).toBeVisible();
        const [download] = await Promise.all([page.waitForEvent('download'), card.click()]);
        expect(download.suggestedFilename()).toMatch(/^parapente_backup_/);
    });
});
