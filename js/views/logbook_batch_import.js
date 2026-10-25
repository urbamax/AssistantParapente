/**
 * VIEW - Logbook batch import
 * Base class of LogbookView (see logbook.js): the editable table that opens when two or more flight
 * files are selected or dropped (spec 039). One row per file, started from the trace and the pilot's
 * habits, corrected in place, then every included row is added at once. The rules (reading files,
 * rows, duplicates, sensor pairing, validation, the stored flight) are in
 * js/services/igc_batch_import.js; this file only draws the table and reacts to the pilot.
 */
import LogbookService from '../services/logbook_service.js';
import SitesService from '../services/sites_service.js';
import { courseNames } from '../services/logbook_courses.js';
import {
    loadEntries,
    prepareBatch,
    refreshRow,
    setValue,
    applyCourse,
    applyToOthers,
    resolvePlaces,
    buildFlight,
} from '../services/igc_batch_import.js';
import { escapeHTML } from '../core/security.js';
import { tt, tl } from './logbook_strings.js';
import { LogbookLearnedBase } from './logbook_learned.js';

const FLIGHT_TYPES = ['Plouf', 'Thermique', 'Soaring', 'Restit', 'Cross', 'Treuil'];
const MANDATORY_INPUTS = { datetime: 'datetime', site: 'site', voile: 'voile', duree: 'duree' };

export class LogbookBatchImportBase extends LogbookLearnedBase {
    /** État du tableau ouvert (null : fermé). */
    batch = null;

    /** À fournir par LogbookView : ferme la fenêtre d'ajout d'une session (les fichiers y ont été choisis). */
    closeSessionModal() {
        throw new Error('LogbookView must implement closeSessionModal()');
    }

    // --- Ouverture -------------------------------------------------------------------------

    /**
     * Ouvre le tableau pour ces fichiers : lecture avec progression, lignes, puis recherche des lieux.
     * @param {File[]} files
     */
    async openBatchImport(files) {
        const modal = document.getElementById('logbook-batch-modal');
        if (!modal) return;
        const batch = {
            rows: [],
            sensors: [],
            env: null,
            loading: true,
            dirty: false,
            importing: false,
            showErrors: false,
            placesDone: Promise.resolve(),
        };
        this.batch = batch;
        this._renderBatchShell();
        this._showBatchModal(modal);

        const entries = await loadEntries(files, (done, total) => {
            this._setText('logbook-batch-progress', tl('batch.reading', { done, total }));
        });
        await SitesService.ensureSitesLoaded().catch(() => null);
        if (this.batch !== batch) return; // fermé pendant la lecture

        batch.env = {
            sessions: LogbookService.getFlights(),
            options: this._batchEquipment(),
            nearbySites: (lat, lon) => this.findNearbySites(lat, lon).map((site) => site.nom || site.name),
        };
        const { rows, sensors } = prepareBatch(entries, batch.env);
        batch.rows = rows;
        batch.sensors = sensors;
        batch.loading = false;
        this._setText('logbook-batch-progress', '');
        this.renderBatch();

        batch.placesDone = resolvePlaces(
            rows,
            async (lat, lon) => {
                const res = await LogbookService.reverseGeocode(lat, lon);
                const city = res && res.success && res.data ? res.data.city : null;
                return city ? { success: true, data: { city: tl('igc.placeFound', { city }) } } : { success: false };
            },
            (row) => {
                if (this.batch === batch) this._syncBatchRow(row);
            },
            { online: typeof navigator === 'undefined' || navigator.onLine !== false },
        );
        await batch.placesDone;
    }

    _showBatchModal(modal) {
        if (!modal._batchBound) {
            modal._batchBound = true;
            modal.addEventListener('cancel', (e) => {
                e.preventDefault();
                this.closeBatchImport();
            });
            modal.addEventListener('change', (e) => this._onBatchChange(e));
            modal.addEventListener('input', (e) => this._onBatchInput(e));
            modal.addEventListener('keydown', (e) => this._onBatchKeydown(e));
            modal.addEventListener('click', (e) => this._onBatchClick(e));
        }
        modal.style.display = 'flex';
        if (typeof modal.showModal === 'function' && !modal.open) modal.showModal();
        void modal.offsetWidth; // fait jouer le fondu d'ouverture
        modal.classList.add('active');
    }

    _hideBatchModal() {
        const modal = /** @type {HTMLDialogElement|null} */ (document.getElementById('logbook-batch-modal'));
        if (!modal) return;
        modal.classList.remove('active');
        if (typeof modal.close === 'function' && modal.open) modal.close();
        modal.style.display = 'none';
    }

    /**
     * Ferme le tableau sans rien ajouter ; demande confirmation si des corrections seraient perdues.
     * @returns {Promise<boolean>} faux si le pilote a refusé de fermer
     */
    async closeBatchImport() {
        const batch = this.batch;
        if (batch && batch.dirty && !confirm(tl('batch.confirmClose'))) return false;
        this.batch = null;
        this._hideBatchModal();
        const table = document.getElementById('logbook-batch-table');
        if (table) table.innerHTML = '';
        return true;
    }

    // --- Dessin ----------------------------------------------------------------------------

    // Le texte n'est réécrit que s'il change : remplacer le contenu d'un bouton pendant qu'on clique
    // dessus (le champ en cours de saisie perd le focus et met le résumé à jour) annule le clic sous WebKit.
    _setText(id, value) {
        const el = document.getElementById(id);
        if (el && el.textContent !== value) el.textContent = value;
    }

    _renderBatchShell() {
        this._setText('logbook-batch-title', tl('batch.title'));
        this._setText('logbook-batch-intro', tl('batch.intro'));
        this._setText('logbook-batch-progress', '');
        this._setText('logbook-batch-summary', '');
        this._setText('logbook-batch-live', '');
        this._setText('logbook-batch-cancel', tl('batch.buttons.cancel'));
        this._setText('logbook-batch-import', tl('batch.buttons.importMany', { count: 0 }));
        const close = document.getElementById('logbook-batch-close');
        if (close) close.setAttribute('aria-label', tl('batch.buttons.close'));
        const sensors = document.getElementById('logbook-batch-sensors');
        if (sensors) sensors.innerHTML = '';
        const table = document.getElementById('logbook-batch-table');
        if (table) table.innerHTML = '';
        const button = /** @type {HTMLButtonElement|null} */ (document.getElementById('logbook-batch-import'));
        if (button) button.disabled = true;
    }

    /** Matériel proposé dans les listes : les voiles et sellettes non archivées. */
    _batchEquipment() {
        const names = (type) =>
            LogbookService.getEquipment()
                .filter((e) => e.type === type && e.statut !== 'archive' && e.nom)
                .map((e) => e.nom);
        return { voile: names('voile'), sellette: names('sellette') };
    }

    renderBatch() {
        const batch = this.batch;
        const container = document.getElementById('logbook-batch-table');
        if (!batch || !container) return;
        const col = (key) => tt(`batch.columns.${key}`);
        const apply = (column, label) =>
            `<button type="button" class="batch-apply action-btn-secondary" data-batch-apply="${column}" title="${tt('batch.applyToAllTitle', { column: label })}" aria-label="${tt('batch.applyToAllTitle', { column: label })}">${tt('batch.applyToAll')}</button>`;
        const head = [
            col('include'),
            col('file'),
            col('datetime'),
            col('site'),
            col('duration'),
            `${col('wing')} ${apply('voile', tl('batch.columns.wing'))}`,
            `${col('harness')} ${apply('sellette', tl('batch.columns.harness'))}`,
            `${col('type')} ${apply('typeVol', tl('batch.columns.type'))}`,
            `${col('course')} ${apply('course', tl('batch.columns.course'))}`,
            `${col('pilots')} ${apply('pilotes', tl('batch.columns.pilots'))}`,
            col('remove'),
        ];
        const sessions = batch.env.sessions;
        const datalist = (id, values) =>
            `<datalist id="${id}">${values.map((v) => `<option value="${escapeHTML(v)}"></option>`).join('')}</datalist>`;
        const used = (field) => [
            ...new Set(
                sessions
                    .flatMap((s) => (Array.isArray(s[field]) ? s[field] : [s[field]]))
                    .filter((v) => typeof v === 'string' && v.trim()),
            ),
        ];
        const sites = SitesService.getSites()
            .map((site) => site.nom || site.name)
            .filter(Boolean);
        container.innerHTML = `
            <table class="batch-table" aria-label="${tt('batch.tableLabel')}">
                <thead><tr>${head.map((h) => `<th scope="col">${h}</th>`).join('')}</tr></thead>
                <tbody>${batch.rows.map((row) => this._batchRowHtml(row)).join('')}</tbody>
            </table>
            ${datalist('batch-sites-list', [...new Set([...used('site'), ...sites])])}
            ${datalist('batch-stages-list', courseNames(sessions))}
            ${datalist('batch-schools-list', used('ecole'))}
            ${datalist('batch-pilots-list', used('pilotes'))}`;
        this._setSelectValues(container);
        this._renderBatchSensors();
        this._syncBatchSummary();
    }

    /** Pose la valeur de chaque liste après son dessin (certains navigateurs ignorent `selected` ici). */
    _setSelectValues(root) {
        root.querySelectorAll('select[data-batch-value]').forEach((el) => {
            const select = /** @type {HTMLSelectElement} */ (el);
            select.value = select.dataset.batchValue;
        });
    }

    _renderBatchSensors() {
        const el = document.getElementById('logbook-batch-sensors');
        if (!el) return;
        const unpaired = this.batch ? this.batch.sensors : [];
        el.innerHTML = unpaired.length
            ? `<strong>${tt('batch.sensor.heading')}</strong><ul>${unpaired
                  .map((s) => `<li>${tt(`batch.sensor.${s.status}`, { name: s.name })}</li>`)
                  .join('')}</ul>`
            : '';
    }

    _batchRowNote(row) {
        if (row.reason) return row.reason;
        const air = row.warnings;
        if (air.includes('startsAirborne') && air.includes('endsAirborne'))
            return tl('batch.reasons.startsAndEndsAirborne');
        if (air.includes('startsAirborne')) return tl('batch.reasons.startsAirborne');
        if (air.includes('endsAirborne')) return tl('batch.reasons.endsAirborne');
        return '';
    }

    _batchRowHtml(row) {
        const file = escapeHTML(row.fileName);
        const label = (key) => escapeHTML(`${tl(`batch.columns.${key}`)} – ${row.fileName}`);
        const disabled = !row.trace ? ' disabled' : '';
        const first = `
            <td data-label="${tt('batch.columns.include')}"><input type="checkbox" data-batch-field="included" aria-label="${label('include')}"${row.included ? ' checked' : ''}${disabled}></td>
            <td class="batch-file" data-label="${tt('batch.columns.file')}">
                <div class="batch-name">${file}</div>
                <span class="batch-status">${tt(`batch.status.${row.status}`)}</span>
                <div class="batch-reason">${escapeHTML(this._batchRowNote(row))}</div>
                <div class="batch-sensor">${row.sensor ? tt('batch.sensor.attached', { name: row.sensor.name }) : ''}</div>
            </td>`;
        if (!row.trace) {
            return `<tr data-row="${row.id}" class="batch-row batch-${row.status}">${first}${'<td></td>'.repeat(9)}</tr>`;
        }
        const v = row.values;
        const field = (name, extra = '') => `data-batch-field="${name}" ${extra}`;
        const select = (name, options, value, blank) => {
            const inList = !value || options.includes(value);
            const shown = inList ? value : 'Autre';
            return `<select ${field(name)} data-batch-value="${escapeHTML(shown)}" aria-label="${label(name === 'voile' ? 'wing' : 'harness')}">
                <option value="">${escapeHTML(blank)}</option>
                ${options.map((o) => `<option value="${escapeHTML(o)}"${o === shown ? ' selected' : ''}>${escapeHTML(o)}</option>`).join('')}
                <option value="Autre"${shown === 'Autre' ? ' selected' : ''}>${tt('batch.wingOther')}</option>
            </select>
            <input type="text" class="batch-other" ${field(`${name}Other`)} placeholder="${tt('batch.wingOtherPlaceholder')}" aria-label="${label(name === 'voile' ? 'wing' : 'harness')}" value="${inList ? '' : escapeHTML(value)}"${inList ? ' hidden' : ''}>`;
        };
        const equipment = this._batchEquipment();
        const pilots = (v.pilotes || [])
            .map(
                (name) =>
                    `<span class="lb-chip" data-batch-pilot="${escapeHTML(name)}">${escapeHTML(name)}<button type="button" class="lb-chip-remove" data-batch-pilot-remove="${escapeHTML(name)}" aria-label="${tt('batch.remove', { name })}"><i class="ri-close-line"></i></button></span>`,
            )
            .join('');
        const siteHint = row.searching ? tl('batch.siteSearching') : tl('batch.siteToFill');
        return `<tr data-row="${row.id}" class="batch-row batch-${row.status}">${first}
            <td data-label="${tt('batch.columns.datetime')}"><input type="datetime-local" ${field('datetime')} aria-label="${label('datetime')}" value="${escapeHTML(v.datetime)}"></td>
            <td data-label="${tt('batch.columns.site')}"><input type="text" list="batch-sites-list" autocomplete="off" ${field('site')} aria-label="${label('site')}" placeholder="${escapeHTML(siteHint)}" value="${escapeHTML(v.site)}"></td>
            <td data-label="${tt('batch.columns.duration')}"><input type="number" min="1" ${field('duree')} aria-label="${label('duration')}" value="${escapeHTML(String(v.duree))}"></td>
            <td data-label="${tt('batch.columns.wing')}">${select('voile', equipment.voile, v.voile, tl('batch.wingSelect'))}</td>
            <td data-label="${tt('batch.columns.harness')}">${select('sellette', equipment.sellette, v.sellette, tl('batch.wingSelect'))}</td>
            <td data-label="${tt('batch.columns.type')}"><select ${field('typeVol')} data-batch-value="${escapeHTML(v.typeVol)}" aria-label="${label('type')}">${FLIGHT_TYPES.map(
                (type) =>
                    `<option value="${type}"${type === v.typeVol ? ' selected' : ''}>${tt(`form.flightTypes.${type}`)}</option>`,
            ).join('')}</select></td>
            <td data-label="${tt('batch.columns.course')}">
                <input type="text" list="batch-stages-list" autocomplete="off" ${field('stageName')} aria-label="${label('course')}" placeholder="${tt('batch.coursePlaceholder')}" value="${escapeHTML(v.stageName)}">
                <input type="text" class="batch-other" list="batch-schools-list" autocomplete="off" ${field('ecole')} aria-label="${escapeHTML(tl('form.schoolName'))} – ${file}" placeholder="${escapeHTML(tl('form.schoolName'))}" value="${escapeHTML(v.ecole)}">
            </td>
            <td data-label="${tt('batch.columns.pilots')}">
                <div class="lb-chips">${pilots}</div>
                <input type="text" list="batch-pilots-list" autocomplete="off" ${field('pilot-new')} aria-label="${label('pilots')}" placeholder="${tt('batch.pilotPlaceholder')}">
            </td>
            <td data-label="${tt('batch.columns.remove')}"><button type="button" class="action-btn-secondary" data-batch-remove aria-label="${escapeHTML(tl('batch.columns.remove'))} ${file}"><i class="ri-delete-bin-line"></i></button></td>
        </tr>`;
    }

    // --- Mise à jour sur place -------------------------------------------------------------

    _batchRowEl(row) {
        return document.querySelector(`#logbook-batch-table tr[data-row="${row.id}"]`);
    }

    /** Met à jour l'état d'une ligne sans la redessiner (le champ en cours de saisie garde le focus). */
    _syncBatchRow(row) {
        const tr = this._batchRowEl(row);
        const batch = this.batch;
        if (!tr || !batch) return;
        tr.className = `batch-row batch-${row.status}`;
        const set = (selector, text) => {
            const el = tr.querySelector(selector);
            if (el) el.textContent = text;
        };
        set('.batch-status', tl(`batch.status.${row.status}`));
        set('.batch-reason', this._batchRowNote(row));
        const included = /** @type {HTMLInputElement|null} */ (tr.querySelector('[data-batch-field="included"]'));
        if (included) included.checked = row.included;
        for (const [fieldName, issue] of Object.entries(MANDATORY_INPUTS)) {
            const invalid = row.issues.includes(issue) && (batch.showErrors || row.edited.has(fieldName));
            const inputs = tr.querySelectorAll(
                `[data-batch-field="${fieldName}"], [data-batch-field="${fieldName}Other"]`,
            );
            inputs.forEach((el) =>
                invalid ? el.setAttribute('aria-invalid', 'true') : el.removeAttribute('aria-invalid'),
            );
        }
        const site = /** @type {HTMLInputElement|null} */ (tr.querySelector('[data-batch-field="site"]'));
        if (site) {
            if (document.activeElement !== site) site.value = row.values.site;
            site.placeholder = row.searching ? tl('batch.siteSearching') : tl('batch.siteToFill');
        }
        this._syncBatchSummary();
    }

    /** Redessine une seule ligne (quand plusieurs de ses cases changent : stage choisi, pilote ajouté…). */
    _redrawBatchRow(row) {
        const tr = this._batchRowEl(row);
        if (!tr) return;
        const template = document.createElement('template');
        template.innerHTML = `<table><tbody>${this._batchRowHtml(row)}</tbody></table>`;
        const fresh = /** @type {HTMLElement} */ (template.content.querySelector('tr'));
        tr.replaceWith(fresh);
        this._setSelectValues(fresh);
        this._syncBatchRow(row);
    }

    _syncBatchSummary() {
        const batch = this.batch;
        if (!batch) return;
        const included = batch.rows.filter((r) => r.included);
        const ready = included.filter((r) => r.status === 'ready').length;
        const fix = included.filter((r) => r.issues.length > 0).length;
        const skipped = batch.rows.length - included.length;
        this._setText('logbook-batch-summary', tl('batch.summary', { ready, fix, skipped }));
        const count = included.length;
        const button = /** @type {HTMLButtonElement|null} */ (document.getElementById('logbook-batch-import'));
        if (button) {
            this._setText(
                'logbook-batch-import',
                count === 1 ? tl('batch.buttons.importOne') : tl('batch.buttons.importMany', { count }),
            );
            const disabled = count === 0 || batch.loading || batch.importing;
            if (button.disabled !== disabled) button.disabled = disabled;
        }
    }

    // --- Corrections -----------------------------------------------------------------------

    _batchRowOf(target) {
        const tr = target.closest('tr[data-row]');
        return tr && this.batch ? this.batch.rows.find((r) => r.id === tr.dataset.row) : null;
    }

    _onBatchChange(event) {
        const target = /** @type {HTMLInputElement} */ (event.target);
        const name = target.dataset && target.dataset.batchField;
        const row = name ? this._batchRowOf(target) : null;
        if (!row || !this.batch) return;
        this.batch.dirty = true;
        if (name === 'included') {
            row.included = target.checked;
            this._syncBatchRow(row);
        } else if (name === 'voile' || name === 'sellette') {
            const other = /** @type {HTMLInputElement} */ (target.closest('td').querySelector('.batch-other'));
            if (target.value === 'Autre') {
                other.hidden = false;
                other.focus();
                setValue(row, name, other.value.trim());
            } else {
                other.hidden = true;
                setValue(row, name, target.value);
            }
            this._syncBatchRow(row);
        } else if (name === 'stageName') {
            applyCourse(row, target.value.trim(), this.batch.env.sessions);
            this._redrawBatchRow(row);
        } else if (name === 'ecole' || name === 'typeVol') {
            setValue(row, name, target.value.trim());
            this._syncBatchRow(row);
        } else if (name === 'pilot-new') {
            this._addBatchPilot(row, target);
        } else if (name !== 'voileOther' && name !== 'sellette' + 'Other') {
            this._onBatchInput(event);
        }
    }

    _onBatchInput(event) {
        const target = /** @type {HTMLInputElement} */ (event.target);
        const name = target.dataset && target.dataset.batchField;
        const row = name ? this._batchRowOf(target) : null;
        if (!row || !this.batch) return;
        if (name === 'datetime' || name === 'site' || name === 'duree') {
            this.batch.dirty = true;
            setValue(row, name, name === 'duree' ? target.value : target.value);
            this._syncBatchRow(row);
        } else if (name === 'voileOther' || name === 'sellette' + 'Other') {
            this.batch.dirty = true;
            setValue(row, name.replace('Other', ''), target.value.trim());
            this._syncBatchRow(row);
        } else if (name === 'pilot-new') {
            // Valeur choisie dans la liste déroulante : ajoutée tout de suite
            const picked = !(event instanceof InputEvent) || event.inputType === 'insertReplacementText';
            if (picked && target.value.trim()) this._addBatchPilot(row, target);
        }
    }

    _onBatchKeydown(event) {
        const target = /** @type {HTMLInputElement} */ (event.target);
        if (event.key !== 'Enter' || !target.dataset || target.dataset.batchField !== 'pilot-new') return;
        event.preventDefault();
        const row = this._batchRowOf(target);
        if (row) this._addBatchPilot(row, target);
    }

    _addBatchPilot(row, input) {
        const name = input.value.trim();
        if (!name || !this.batch) return;
        input.value = '';
        const pilots = row.values.pilotes || [];
        if (!pilots.some((p) => p.toLowerCase() === name.toLowerCase())) {
            this.batch.dirty = true;
            setValue(row, 'pilotes', [...pilots, name]);
        }
        this._redrawBatchRow(row);
        const again = this._batchRowEl(row)?.querySelector('[data-batch-field="pilot-new"]');
        if (again) /** @type {HTMLElement} */ (again).focus();
    }

    _onBatchClick(event) {
        const batch = this.batch;
        const target = /** @type {HTMLElement} */ (event.target);
        if (!batch || !target.closest) return;
        const pilot = /** @type {HTMLElement|null} */ (target.closest('[data-batch-pilot-remove]'));
        const remove = target.closest('[data-batch-remove]');
        const apply = /** @type {HTMLElement|null} */ (target.closest('[data-batch-apply]'));
        if (pilot) {
            const row = this._batchRowOf(pilot);
            if (!row) return;
            batch.dirty = true;
            setValue(
                row,
                'pilotes',
                (row.values.pilotes || []).filter((p) => p !== pilot.dataset.batchPilotRemove),
            );
            this._redrawBatchRow(row);
        } else if (remove) {
            const row = this._batchRowOf(remove);
            if (!row) return;
            batch.dirty = true;
            batch.rows = batch.rows.filter((r) => r !== row);
            this.renderBatch();
        } else if (apply) {
            // La première ligne cochée sert de modèle
            const source = batch.rows.find((r) => r.included && r.trace);
            if (!source) return;
            batch.dirty = true;
            applyToOthers(batch.rows, /** @type {any} */ (apply.dataset.batchApply), source.id);
            this.renderBatch();
        }
    }

    // --- Import ----------------------------------------------------------------------------

    /** Ajoute d'un coup toutes les lignes cochées, après avoir vérifié qu'il ne manque rien. */
    async importBatch() {
        const batch = this.batch;
        if (!batch || batch.importing || batch.loading) return;
        const chosen = batch.rows.filter((r) => r.included);
        if (chosen.length === 0) return;
        chosen.forEach(refreshRow);
        const incomplete = chosen.filter((r) => r.issues.length > 0);
        if (incomplete.length > 0) {
            batch.showErrors = true;
            incomplete.forEach((row) => this._syncBatchRow(row));
            this._setText(
                'logbook-batch-live',
                `${tl('batch.blocked')} ${tl('batch.toFix', { count: incomplete.length })}`,
            );
            const first = this._batchRowEl(incomplete[0])?.querySelector('[aria-invalid="true"]');
            if (first) /** @type {HTMLElement} */ (first).focus();
            return;
        }
        batch.importing = true;
        this._syncBatchSummary();
        const result = LogbookService.addFlights(chosen.map(buildFlight));
        if (!result.success) {
            batch.importing = false;
            this._syncBatchSummary();
            alert(tl('batch.failed', { error: result.error }));
            return;
        }
        this.batch = null;
        this._hideBatchModal();
        // Les fichiers ont été choisis depuis la fenêtre d'ajout d'une session : elle se referme aussi
        this.closeSessionModal();
        this.switchTab('history');
        alert(result.data.length === 1 ? tl('batch.done.one') : tl('batch.done.many', { count: result.data.length }));
        // La météo de chaque vol se récupère ensuite, un vol après l'autre, comme pour un vol ajouté seul
        for (const flight of result.data) {
            if (flight.lat && flight.lon) {
                await this.fetchWeatherForSession(
                    flight.lat,
                    flight.lon,
                    flight.datetime,
                    flight.id,
                    flight.duree,
                    null,
                );
            }
        }
    }
}
