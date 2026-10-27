/**
 * CORE - Local backup UI
 * Buttons « Exporter » / « Importer » (Espace Synchro and privacy options). Everything runs on the
 * device: the account and Firebase consent are not needed. When a signed-in user restores a file,
 * the restored data is then pushed through the usual cloud sync (the only cloud call, and only
 * for someone already connected).
 */
import { exportBackup, applyBackup, applyBackupTraces, readBackupFile } from '../services/backup_service.js';
import { t } from '../utils/i18n.js';

/** Time to read the confirmation message before the page reloads with the restored data. */
const RELOAD_DELAY_MS = 1200;

/**
 * Shows a message in every backup status line (one per screen that offers the buttons).
 * @param {string} message
 * @param {'success'|'error'|'info'} type
 */
function showBackupStatus(message, type) {
    document.querySelectorAll('.backup-status').forEach((/** @type {HTMLElement} */ el) => {
        el.className = `backup-status auth-alert ${type}`;
        el.textContent = message;
        el.style.display = 'block';
    });
}

export async function exportBackupAction() {
    try {
        const email = window.FirebaseAuthEngine?.currentUser?.email;
        showBackupStatus(t('backup.downloaded', { filename: await exportBackup(email || undefined) }), 'success');
    } catch (error) {
        console.error('[Backup] Export failed:', error);
        showBackupStatus(t('backup.exportFailed'), 'error');
    }
}

/**
 * Validates, asks for confirmation, restores, then reloads the page so that every view and service
 * starts again from the restored data (a stale in-memory copy could otherwise overwrite it).
 * @param {Blob|null|undefined} file
 * @param {{ confirm?: (message: string) => boolean, reload?: () => void }} [deps]
 */
export async function importBackupAction(
    file,
    { confirm = (m) => window.confirm(m), reload = () => location.reload() } = {},
) {
    if (!file) {
        showBackupStatus(t('backup.noFile'), 'error');
        return;
    }

    let parsed;
    try {
        parsed = await readBackupFile(file);
    } catch (error) {
        console.error('[Backup] Could not read the file:', error);
        showBackupStatus(t('backup.notJson'), 'error');
        return;
    }
    if (!parsed.ok) {
        showBackupStatus(t(`backup.${parsed.error}`), 'error');
        return;
    }

    const question = parsed.exportedAt
        ? t('backup.confirmImport', { date: new Date(parsed.exportedAt).toLocaleString() })
        : t('backup.confirmImportUnknownDate');
    if (!confirm(question)) return;

    showBackupStatus(t('backup.restoring'), 'info');
    let result;
    try {
        result = applyBackup(parsed.backup);
    } catch (error) {
        console.error('[Backup] Restore failed:', error);
        showBackupStatus(t('backup.restoreFailed'), 'error');
        return;
    }

    let message = t('backup.restored');
    if (result.skipped.length) message += t('backup.statsSkipped');

    try {
        const traces = await applyBackupTraces(parsed.backup);
        if (traces.restored) message += t('backup.tracesRestored', { count: traces.restored });
        if (traces.failed) message += t('backup.tracesFailed', { count: traces.failed });
    } catch (error) {
        console.warn('[Backup] GPS traces not restored:', error);
    }

    // Signed-in only: the restored data goes up with the normal merge sync.
    const cloud = window.FirebaseAuthEngine;
    if (cloud?.currentUser && cloud.enabled) {
        try {
            await cloud.syncDataWithCloud(true);
        } catch (error) {
            console.warn('[Backup] Cloud sync after restore failed:', error);
            message += t('backup.syncFailed');
        }
    }

    showBackupStatus(message, 'success');
    setTimeout(reload, RELOAD_DELAY_MS);
}
