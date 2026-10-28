/**
 * VIEW - Logbook FFVL import
 * Base class of LogbookView (see logbook.js): the import of the Excel export of the FFVL Intranet logbook
 * (spec 046). The pilot picks the .xlsx file, checks one row per flight in a dialog (nothing is added
 * before), then every ticked row is added at once; the flights of an import can be cancelled together from
 * the history. The rules (reading the file, statuses, already-imported flights, the stored flight) are in
 * js/services/ffvl_logbook_import.js; this file only draws the dialog and reacts to the pilot.
 */
import LogbookService from '../services/logbook_service.js';
import SitesService from '../services/sites_service.js';
import {
    readFfvlExport,
    prepareRows,
    refreshRow,
    setValue,
    buildFlight,
    FfvlImportError,
} from '../services/ffvl_logbook_import.js';
import { formatDateOnly } from '../utils/date_utils.js';
import { escapeHTML } from '../core/security.js';
import { tt, tl } from './logbook_strings.js';
import { LogbookBatchImportBase } from './logbook_batch_import.js';

export class LogbookFfvlImportBase extends LogbookBatchImportBase {
    /** État du tableau ouvert (null : fermé). */
    ffvl = null;

    // --- Choix du fichier ------------------------------------------------------------------

    triggerFfvlImport() {
        const input = document.getElementById('ffvl-import-input');
        if (input) input.click();
    }

    /** Fichier choisi : `target` est le champ de fichier (commande « change » de index.html). */
    async handleFfvlFile(_value, _event, target) {
        const file = target && target.files && target.files[0];
        if (!file) return;
        // Permet de choisir une seconde fois le même fichier (après avoir annulé l'import, par exemple)
        target.value = '';
        await this.openFfvlImport(file);
    }

    /** @param {File} file */
    async openFfvlImport(file) {
        let entries;
        try {
            ({ entries } = await readFfvlExport(file));
        } catch (error) {
            const code = error instanceof FfvlImportError ? error.code : 'unreadable';
            alert(tl(`ffvl.errors.${code}`, { name: file.name }));
            return;
        }
        if (entries.length === 0) {
            alert(tl('ffvl.errors.empty', { name: file.name }));
            return;
        }
        await SitesService.ensureSitesLoaded().catch(() => null);
        const sessions = LogbookService.getFlights();
        const env = { sessions, knownSites: this._ffvlKnownSites() };
        this.ffvl = {
            rows: prepareRows(entries, env),
            env,
            dirty: false,
            importing: false,
            showErrors: false,
        };
        this._renderFfvlShell();
        this.renderFfvl();
        this._showFfvlModal();
    }

    /** Sites déjà utilisés dans le carnet, puis ceux de la base des sites. */
    _ffvlKnownSites() {
        const used = LogbookService.getFlights().map((s) => (typeof s.site === 'string' ? s.site.trim() : ''));
        const known = SitesService.getSites().map((site) => site.nom || site.name);
        return [...new Set([...used, ...known].filter(Boolean))];
    }

    _showFfvlModal() {
        const modal = /** @type {HTMLDialogElement & {_ffvlBound?: boolean}|null} */ (
            document.getElementById('logbook-ffvl-modal')
        );
        if (!modal) return;
        if (!modal._ffvlBound) {
            modal._ffvlBound = true;
            modal.addEventListener('cancel', (e) => {
                e.preventDefault();
                this.closeFfvlImport();
            });
            modal.addEventListener('change', (e) => this._onFfvlChange(e));
            modal.addEventListener('input', (e) => this._onFfvlInput(e));
        }
        modal.style.display = 'flex';
        if (typeof modal.showModal === 'function' && !modal.open) modal.showModal();
        void modal.offsetWidth; // fait jouer le fondu d'ouverture
        modal.classList.add('active');
    }

    _hideFfvlModal() {
        const modal = /** @type {HTMLDialogElement|null} */ (document.getElementById('logbook-ffvl-modal'));
        if (!modal) return;
        modal.classList.remove('active');
        if (typeof modal.close === 'function' && modal.open) modal.close();
        modal.style.display = 'none';
    }

    /**
     * Ferme le tableau sans rien ajouter ; demande confirmation si des corrections seraient perdues.
     * @returns {Promise<boolean>} faux si le pilote a refusé de fermer
     */
    async closeFfvlImport() {
        if (this.ffvl && this.ffvl.dirty && !confirm(tl('ffvl.confirmClose'))) return false;
        this.ffvl = null;
        this._hideFfvlModal();
        const table = document.getElementById('logbook-ffvl-table');
        if (table) table.innerHTML = '';
        return true;
    }

    // --- Dessin ----------------------------------------------------------------------------

    _renderFfvlShell() {
        this._setText('logbook-ffvl-title', tl('ffvl.title'));
        this._setText('logbook-ffvl-intro', tl('ffvl.intro'));
        this._setText('logbook-ffvl-school-label', tl('ffvl.schoolLabel'));
        this._setText('logbook-ffvl-school-hint', tl('ffvl.schoolHint'));
        this._setText('logbook-ffvl-live', '');
        this._setText('logbook-ffvl-cancel', tl('ffvl.buttons.cancel'));
        const close = document.getElementById('logbook-ffvl-close');
        if (close) close.setAttribute('aria-label', tl('ffvl.buttons.close'));
        const school = /** @type {HTMLInputElement|null} */ (document.getElementById('logbook-ffvl-school'));
        if (school) school.value = '';
        const schools = document.getElementById('logbook-ffvl-schools');
        if (schools) {
            const names = new Set(
                LogbookService.getFlights()
                    .map((s) => (typeof s.ecole === 'string' ? s.ecole.trim() : ''))
                    .filter(Boolean),
            );
            schools.innerHTML = [...names].map((n) => `<option value="${escapeHTML(n)}"></option>`).join('');
        }
    }

    renderFfvl() {
        const ffvl = this.ffvl;
        const container = document.getElementById('logbook-ffvl-table');
        if (!ffvl || !container) return;
        const col = (key) => tt(`ffvl.columns.${key}`);
        const head = ['include', 'date', 'site', 'duration', 'height', 'instructor', 'analysis', 'status'].map(col);
        container.innerHTML = `
            <table class="batch-table" aria-label="${tt('ffvl.tableLabel')}">
                <thead><tr>${head.map((h) => `<th scope="col">${h}</th>`).join('')}</tr></thead>
                <tbody>${ffvl.rows.map((row) => this._ffvlRowHtml(row)).join('')}</tbody>
            </table>
            <datalist id="ffvl-sites-list">${ffvl.env.knownSites
                .map((name) => `<option value="${escapeHTML(name)}"></option>`)
                .join('')}</datalist>`;
        const note = ffvl.rows.every((r) => r.status === 'imported' || r.status === 'invalid')
            ? ffvl.rows.some((r) => r.status === 'imported')
                ? tl('ffvl.allImported')
                : ''
            : '';
        this._setText('logbook-ffvl-note', note);
        ffvl.rows.forEach((row) => this._syncFfvlRow(row));
        this._syncFfvlSummary();
    }

    _ffvlRowHtml(row) {
        const v = row.values;
        const label = (key) => escapeHTML(`${tl(`ffvl.columns.${key}`)} – ${formatDateOnly(v.date) || row.line}`);
        const cell = (key, html) => `<td data-label="${tt(`ffvl.columns.${key}`)}">${html}</td>`;
        const editable = row.status !== 'invalid';
        return `<tr data-row="${row.id}" class="batch-row batch-${row.status}">
            <td data-label="${tt('ffvl.columns.include')}"><input type="checkbox" data-ffvl-field="included" aria-label="${label('include')}"${row.included ? ' checked' : ''}${editable ? '' : ' disabled'}></td>
            ${cell('date', escapeHTML(formatDateOnly(v.date)))}
            ${cell('site', editable ? `<input type="text" list="ffvl-sites-list" autocomplete="off" data-ffvl-field="site" aria-label="${label('site')}" placeholder="${tt('ffvl.siteToFill')}" value="${escapeHTML(v.site)}">` : escapeHTML(v.site))}
            ${cell('duration', escapeHTML(v.duree ? String(v.duree) : ''))}
            ${cell('height', escapeHTML(v.denivele === null || v.denivele === undefined ? '' : String(v.denivele)))}
            ${cell('instructor', escapeHTML(v.formateur))}
            ${cell('analysis', escapeHTML(v.analyse))}
            <td class="batch-file" data-label="${tt('ffvl.columns.status')}">
                <span class="batch-status"></span>
                <div class="batch-reason"></div>
            </td>
        </tr>`;
    }

    _ffvlRowEl(row) {
        return document.querySelector(`#logbook-ffvl-table tr[data-row="${row.id}"]`);
    }

    /** Met à jour l'état d'une ligne sans la redessiner (le champ en cours de saisie garde le focus). */
    _syncFfvlRow(row) {
        const tr = this._ffvlRowEl(row);
        const ffvl = this.ffvl;
        if (!tr || !ffvl) return;
        tr.className = `batch-row batch-${row.status}`;
        const set = (selector, text) => {
            const el = tr.querySelector(selector);
            if (el) el.textContent = text;
        };
        set('.batch-status', tl(`ffvl.status.${row.status}`));
        set('.batch-reason', row.reason);
        const included = /** @type {HTMLInputElement|null} */ (tr.querySelector('[data-ffvl-field="included"]'));
        if (included) included.checked = row.included;
        const site = /** @type {HTMLInputElement|null} */ (tr.querySelector('[data-ffvl-field="site"]'));
        if (site) {
            const invalid = row.issues.includes('site') && (ffvl.showErrors || row.edited.has('site'));
            if (invalid) site.setAttribute('aria-invalid', 'true');
            else site.removeAttribute('aria-invalid');
        }
        this._syncFfvlSummary();
    }

    _syncFfvlSummary() {
        const ffvl = this.ffvl;
        if (!ffvl) return;
        const included = ffvl.rows.filter((r) => r.included);
        const ready = included.filter((r) => r.issues.length === 0).length;
        const fix = included.length - ready;
        this._setText(
            'logbook-ffvl-summary',
            tl('ffvl.summary', { ready, fix, skipped: ffvl.rows.length - included.length }),
        );
        const button = /** @type {HTMLButtonElement|null} */ (document.getElementById('logbook-ffvl-import'));
        if (button) {
            this._setText(
                'logbook-ffvl-import',
                included.length === 1
                    ? tl('ffvl.buttons.importOne')
                    : tl('ffvl.buttons.importMany', { count: included.length }),
            );
            const disabled = included.length === 0 || ffvl.importing;
            if (button.disabled !== disabled) button.disabled = disabled;
        }
    }

    // --- Corrections -----------------------------------------------------------------------

    _ffvlRowOf(target) {
        const tr = target.closest('tr[data-row]');
        return tr && this.ffvl ? this.ffvl.rows.find((r) => r.id === tr.dataset.row) : null;
    }

    _onFfvlChange(event) {
        const target = /** @type {HTMLInputElement} */ (event.target);
        if (target.id === 'logbook-ffvl-school') {
            if (this.ffvl) this.ffvl.dirty = true;
            return;
        }
        const row = target.dataset && target.dataset.ffvlField === 'included' ? this._ffvlRowOf(target) : null;
        if (!row || !this.ffvl) return;
        this.ffvl.dirty = true;
        row.included = target.checked;
        refreshRow(row);
        this._syncFfvlRow(row);
    }

    _onFfvlInput(event) {
        const target = /** @type {HTMLInputElement} */ (event.target);
        const row = target.dataset && target.dataset.ffvlField === 'site' ? this._ffvlRowOf(target) : null;
        if (!row || !this.ffvl) return;
        this.ffvl.dirty = true;
        setValue(row, 'site', target.value);
        this._syncFfvlRow(row);
    }

    // --- Import ----------------------------------------------------------------------------

    /** Ajoute d'un coup toutes les lignes cochées, après avoir vérifié qu'il ne manque rien. */
    importFfvl() {
        const ffvl = this.ffvl;
        if (!ffvl || ffvl.importing) return;
        const chosen = ffvl.rows.filter((r) => r.included);
        if (chosen.length === 0) return;
        chosen.forEach(refreshRow);
        const incomplete = chosen.filter((r) => r.issues.length > 0);
        if (incomplete.length > 0) {
            ffvl.showErrors = true;
            incomplete.forEach((row) => this._syncFfvlRow(row));
            this._setText(
                'logbook-ffvl-live',
                `${tl('ffvl.blocked')} ${tl('ffvl.toFix', { count: incomplete.length })}`,
            );
            const first = this._ffvlRowEl(incomplete[0])?.querySelector('[aria-invalid="true"]');
            if (first) /** @type {HTMLElement} */ (first).focus();
            return;
        }
        ffvl.importing = true;
        this._syncFfvlSummary();
        const importedAt = Date.now();
        const batchId = `ffvl-${importedAt.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        const school = /** @type {HTMLInputElement|null} */ (document.getElementById('logbook-ffvl-school'));
        const options = { batchId, importedAt, school: school ? school.value : '' };
        const result = LogbookService.addFlights(
            chosen.map((row) => buildFlight(row, options)),
            importedAt,
        );
        if (!result.success) {
            ffvl.importing = false;
            this._syncFfvlSummary();
            alert(tl('ffvl.failed', { error: result.error }));
            return;
        }
        this.ffvl = null;
        this._hideFfvlModal();
        this.switchTab('history');
        alert(result.data.length === 1 ? tl('ffvl.done.one') : tl('ffvl.done.many', { count: result.data.length }));
    }

    // --- Annulation d'un import ------------------------------------------------------------

    /**
     * Retire du carnet les vols d'un import, après confirmation (qui dit combien de vols, dont combien
     * ont été modifiés depuis). Les vols saisis à la main et ceux d'un autre import ne sont pas touchés.
     * @param {string} batchId
     */
    undoFfvlImport(batchId) {
        const batch = LogbookService.importBatches().find((b) => b.batchId === batchId);
        if (!batch) return;
        const lines = [
            batch.count === 1 ? tl('ffvl.imports.confirmOne') : tl('ffvl.imports.confirmMany', { count: batch.count }),
            batch.editedCount > 0
                ? tl('ffvl.imports.confirmEdited', {
                      edited:
                          batch.editedCount === 1
                              ? tl('ffvl.imports.editedOne')
                              : tl('ffvl.imports.editedMany', { count: batch.editedCount }),
                  })
                : tl('ffvl.imports.confirmUntouched'),
        ];
        if (!confirm(lines.join('\n\n'))) return;
        const removed = LogbookService.undoImport(batchId);
        this.renderHistory();
        this.updateEquipmentAlertBadge();
        alert(removed === 1 ? tl('ffvl.imports.undoneOne') : tl('ffvl.imports.undoneMany', { count: removed }));
    }
}
