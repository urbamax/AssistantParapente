/**
 * VIEW/CONTROLLER - LogbookView, formulaire de saisie d'une session
 * Base class of LogbookView (see logbook.js): form layout per flight type, drop-downs, submit,
 * reset and edit.
 */
import LogbookService from '../services/logbook_service.js';
import PilotHabits from '../services/pilot_habits.js';
import StorageService from '../services/storage.js'; // Retained just for custom select lists
import SitesService from '../services/sites_service.js';
import { escapeHTML } from '../core/security.js';
import { addMinutesToDatetimeLocal } from '../utils/date_utils.js';
import { capitalizeFirstLetter } from '../utils/text_utils.js';
import { toSorted } from '../utils/array_utils.js';
import { getSpotairWidgetId } from '../data/spotair_widgets.js';
import { parseCoordinates, formatCoordinates } from '../utils/geo_utils.js';

import { tt, tl } from './logbook_strings.js';

import { LogbookIgcImportBase } from './logbook_igc_import.js';

export class LogbookFormBase extends LogbookIgcImportBase {
    /** À fournir par LogbookView : ferme la fenêtre de saisie. */
    closeSessionModal() {
        throw new Error('LogbookView must implement closeSessionModal()');
    }

    /** À fournir par LogbookView : titre de la fenêtre (création ou modification). */
    setSessionModalTitle(_isEdit) {
        throw new Error('LogbookView must implement setSessionModalTitle()');
    }

    /** Les listes et aides statiques sont déclarées sur LogbookView (logbook.js). */
    statics() {
        return /** @type {any} */ (this.constructor);
    }

    setFormType(type) {
        if (this.currentFormType === type) return;

        // 1. Sauvegarder les valeurs des champs communs
        const editId = /** @type {HTMLInputElement} */ (document.getElementById('lb-id-edit'))?.value || '';
        const datetime = /** @type {HTMLInputElement} */ (document.getElementById('lb-datetime'))?.value || '';
        const location =
            this.currentFormType === 'vol'
                ? /** @type {HTMLInputElement} */ (document.getElementById('lb-site'))?.value
                : /** @type {HTMLInputElement} */ (document.getElementById('lb-lieu'))?.value;

        const voile = /** @type {HTMLSelectElement} */ (document.getElementById('lb-voile'))?.value || '';
        const voileAutre = /** @type {HTMLInputElement} */ (document.getElementById('lb-voile-autre'))?.value || '';
        const voileAutreVisible = document.getElementById('lb-voile-autre')?.style.display === 'block';

        const sellette = /** @type {HTMLSelectElement} */ (document.getElementById('lb-sellette'))?.value || '';
        const selletteAutre =
            /** @type {HTMLInputElement} */ (document.getElementById('lb-sellette-autre'))?.value || '';
        const selletteAutreVisible = document.getElementById('lb-sellette-autre')?.style.display === 'block';

        const duree = /** @type {HTMLInputElement} */ (document.getElementById('lb-duree'))?.value || '';
        const commentaire = /** @type {HTMLTextAreaElement} */ (document.getElementById('lb-commentaire'))?.value || '';
        const ecoleChecked = /** @type {HTMLInputElement} */ (document.getElementById('lb-ecole-check'))?.checked;
        const ecole = /** @type {HTMLInputElement} */ (document.getElementById('lb-ecole'))?.value || '';
        const moniteur = /** @type {HTMLInputElement} */ (document.getElementById('lb-moniteur'))?.value || '';
        const accompagnateurs = this.getChecklistValues('accompagnateur');
        const pilotes = this.getChecklistValues('pilotes');

        const coordsText = /** @type {HTMLInputElement} */ (document.getElementById('lb-coords'))?.value || '';
        const coordsPanelOpen = document.getElementById('lb-coords-panel')?.hidden === false;

        const submitText = document.getElementById('lb-submit-btn')?.innerText || tl('form.save');

        this.currentFormType = type;

        document.getElementById('btn-type-vol').classList.toggle('active', type === 'vol');
        document.getElementById('btn-type-gonflage').classList.toggle('active', type === 'gonflage');

        this.renderForm();

        // 2. Réinjecter les valeurs dans le nouveau formulaire
        if (editId) {
            const el = /** @type {HTMLInputElement} */ (document.getElementById('lb-id-edit'));
            if (el) el.value = editId;
        }
        if (datetime) {
            const el = /** @type {HTMLInputElement} */ (document.getElementById('lb-datetime'));
            if (el) el.value = datetime;
        }
        if (location) {
            const el = /** @type {HTMLInputElement} */ (
                type === 'vol' ? document.getElementById('lb-site') : document.getElementById('lb-lieu')
            );
            if (el) el.value = location;
        }
        if (voile) {
            const el = /** @type {HTMLSelectElement} */ (document.getElementById('lb-voile'));
            if (el) {
                el.value = voile;
                if (voile === 'Autre') {
                    const elAutre = /** @type {HTMLInputElement} */ (document.getElementById('lb-voile-autre'));
                    if (elAutre) {
                        elAutre.style.display = voileAutreVisible ? 'block' : 'none';
                        elAutre.value = voileAutre;
                    }
                }
            }
        }
        if (sellette) {
            const el = /** @type {HTMLSelectElement} */ (document.getElementById('lb-sellette'));
            if (el) {
                el.value = sellette;
                if (sellette === 'Autre') {
                    const elAutre = /** @type {HTMLInputElement} */ (document.getElementById('lb-sellette-autre'));
                    if (elAutre) {
                        elAutre.style.display = selletteAutreVisible ? 'block' : 'none';
                        elAutre.value = selletteAutre;
                    }
                }
            }
        }
        if (duree) {
            const el = /** @type {HTMLInputElement} */ (document.getElementById('lb-duree'));
            if (el) el.value = duree;
        }
        if (commentaire) {
            const el = /** @type {HTMLTextAreaElement} */ (document.getElementById('lb-commentaire'));
            if (el) el.value = commentaire;
        }
        if (ecoleChecked) this.setSchoolField(true, ecole);
        const instructorField = /** @type {HTMLInputElement} */ (document.getElementById('lb-moniteur'));
        if (instructorField && moniteur) instructorField.value = moniteur;
        this.setChecklistValues('accompagnateur', accompagnateurs);
        this.setChecklistValues('pilotes', pilotes);

        if (coordsText) {
            const el = /** @type {HTMLInputElement} */ (document.getElementById('lb-coords'));
            if (el) el.value = coordsText;
        }
        this.updateCoordsStatus();
        if (coordsPanelOpen) this.toggleCoordsPicker();

        // Restaurer l'état des boutons de soumission / annulation (pour l'édition)
        const submitBtn = document.getElementById('lb-submit-btn');
        if (submitBtn) submitBtn.innerText = submitText;
    }

    getCurrentDateTimeLocal() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    renderForm() {
        const container = document.getElementById('form-fields-container');
        if (!container) return;

        let html;
        const defaultDateTime = this.getCurrentDateTimeLocal();

        if (this.currentFormType === 'vol') {
            html = `
                <div role="button" tabindex="0" class="form-group igc-upload-container" data-action="triggerIgcUpload" style="border: 2px dashed var(--border-light, #ccc); border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 15px; cursor: pointer; background: var(--bg-card, #f9f9f9);">
                    <i class="ri-upload-cloud-line" style="font-size: 2rem; color: var(--accent-orange, #007bc4);"></i>
                    <div style="font-weight: bold; margin-top: 10px;">${tt('form.igcTitle')}</div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary, #666); margin-top: 5px;" id="igc-upload-filename" role="status" aria-live="polite">${tt('form.igcHint')}</div>
                </div>
                <button type="button" id="lb-igc-recalc" data-action="recalculateFromTrace" style="display:none; width: 100%; margin: -5px 0 15px; padding: 8px; border-radius: 6px; border: 1px solid var(--accent-orange, #007bc4); color: var(--accent-orange, #007bc4); background: transparent; cursor: pointer;"><i class="ri-refresh-line"></i> ${tt('igc.recalculate')}</button>
                <label class="form-group" style="display:flex; align-items:center; gap:8px; margin: -5px 0 15px; font-size: 0.9rem;"><input type="checkbox" id="lb-vario-in-flight"> ${tt('form.varioInFlight')}</label>
                <label class="form-group" style="display:flex; align-items:center; gap:8px; margin: -5px 0 15px; font-size: 0.9rem;"><input type="checkbox" id="lb-vario-off-in-flight"> ${tt('form.varioOffInFlight')}</label>
                <div class="form-group" id="igc-alt-check" style="display:none; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border-light, #ccc); margin-bottom: 15px;">
                    <div id="igc-alt-info" style="font-size: 0.85rem; margin-bottom: 8px;"></div>
                    <div style="display:flex; gap: 16px; margin-bottom: 6px; font-size: 0.9rem;">
                        <label style="display:flex; align-items:center; gap:4px;"><input type="radio" name="lb-alt-ref" value="landing" checked> ${tt('form.altKnowLanding')}</label>
                        <label style="display:flex; align-items:center; gap:4px;"><input type="radio" name="lb-alt-ref" value="takeoff"> ${tt('form.altKnowTakeoff')}</label>
                    </div>
                    <label for="lb-real-alt">${tt('form.realAltitude')} <small>${tt('form.optional')}</small></label>
                    <input type="number" id="lb-real-alt" style="width: 100%;" placeholder="${tt('form.realAltitudePlaceholder')}">
                </div>
                <div class="form-group">
                    <label>${tt('form.datetime')} <span class="required">*</span></label>
                    <input type="datetime-local" id="lb-datetime" required value="${defaultDateTime}">
                </div>
                <div class="form-group">
                    <label>${tt('form.site')} <span class="required">*</span></label>
                    <input type="text" id="lb-site" list="sites-list" placeholder="${tt('form.sitePlaceholder')}" required autocomplete="off">
                    <datalist id="sites-list"></datalist>
                    <div id="lb-site-choices" hidden style="font-size: 0.82rem; margin-top: 4px;"></div>
                    ${this.renderCoordsBlock()}
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>${tt('form.wing')} <span class="required">*</span></label>
                        <select id="lb-voile" required>
                            <option value="">${tt('form.select')}</option>
                        </select>
                        <input type="text" id="lb-voile-autre" list="voiles-autre-list" placeholder="${tt('form.modelPlaceholder')}" autocomplete="off" style="display:none; margin-top: 5px; width: 100%;">
                        <datalist id="voiles-autre-list"></datalist>
                    </div>
                    <div class="form-group">
                        <label>${tt('form.harness')}</label>
                        <select id="lb-sellette">
                            <option value="">${tt('form.select')}</option>
                        </select>
                        <input type="text" id="lb-sellette-autre" list="sellettes-autre-list" placeholder="${tt('form.modelPlaceholder')}" autocomplete="off" style="display:none; margin-top: 5px; width: 100%;">
                        <datalist id="sellettes-autre-list"></datalist>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>${tt('form.duration')} <span class="required">*</span></label>
                        <input type="number" id="lb-duree" min="1" placeholder="${tt('form.durationPlaceholderFlight')}" required>
                    </div>
                    <div class="form-group">
                        <label>${tt('form.flightType')}</label>
                        <select id="lb-typeVol">
                            <option value="Plouf">${tt('form.flightTypes.Plouf')}</option>
                            <option value="Thermique">${tt('form.flightTypes.Thermique')}</option>
                            <option value="Soaring">${tt('form.flightTypes.Soaring')}</option>
                            <option value="Restit">${tt('form.flightTypes.Restit')}</option>
                            <option value="Cross">${tt('form.flightTypes.Cross')}</option>
                            <option value="Treuil">${tt('form.flightTypes.Treuil')}</option>
                        </select>
                    </div>
                </div>

                </div>

                <div class="form-group" style="margin-bottom: 10px;">
                    <label style="display:flex; align-items:center; gap:6px; cursor:pointer; margin-bottom: 5px;">
                        <input type="checkbox" id="lb-rescue-check" aria-controls="lb-rescue-group"> ${tt('form.rescueDeployed')}
                    </label>
                    <div id="lb-rescue-group" hidden>
                        <label for="lb-rescue" style="display:block; margin-bottom: 5px;">${tt('form.rescueUsed')}</label>
                        <select id="lb-rescue" style="width:100%; padding:8px;">
                            <option value="">${tt('form.select')}</option>
                        </select>
                    </div>
                </div>

                <div class="form-group" style="margin-bottom: 10px;">
                    <label for="lb-tech-decollage" style="display:block; margin-bottom:5px;">${tt('form.takeoffTechnique')}</label>
                    <select id="lb-tech-decollage" style="width:100%; padding:8px;" required data-change-action="toggleOtherField" data-toggle-id="lb-tech-decollage-autre">
                        <option value="Face voile">${tt('form.takeoffTechniques.Face voile')}</option>
                        <option value="Dos voile">${tt('form.takeoffTechniques.Dos voile')}</option>
                        ${(() => {
                            const parsed = StorageService.get('customDecollageTechniques');
                            if (Array.isArray(parsed))
                                return parsed
                                    .map((t) => `<option value="${escapeHTML(t)}">${escapeHTML(t)}</option>`)
                                    .join('');
                            return '';
                        })()}
                        <option value="Autre">${tt('form.other')}</option>
                    </select>
                    <input type="text" id="lb-tech-decollage-autre" placeholder="${tt('form.techniquePlaceholder')}" style="display:none; margin-top: 5px; width: 100%;">
                </div>
                <div class="form-group" id="lb-treuilleur-group" hidden>
                    <label for="lb-treuilleur">${tt('form.winchOperator')}</label>
                    <input type="text" id="lb-treuilleur" list="treuilleurs-list" placeholder="${tt('form.winchOperatorPlaceholder')}" autocomplete="off" style="width: 100%;">
                    <datalist id="treuilleurs-list"></datalist>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>${tt('form.maxAltitude')}</label>
                        <input type="number" id="lb-altMax" placeholder="${tt('form.maxAltitudePlaceholder')}">
                    </div>
                    <div class="form-group">
                        <label>${tt('form.gain')}</label>
                        <input type="number" id="lb-gain" placeholder="${tt('form.gainPlaceholder')}">
                    </div>
                </div>
                ${this.renderSchoolBlock('vol')}
                ${this.renderPilotsBlock()}
                <div class="form-group">
                    <label>${tt('form.comment')}</label>
                    <textarea id="lb-commentaire" rows="3" placeholder="${tt('form.commentPlaceholderFlight')}"></textarea>
                </div>
            `;
        } else {
            // Gonflage form
            html = `
                <div class="form-group">
                    <label>${tt('form.datetime')} <span class="required">*</span></label>
                    <input type="datetime-local" id="lb-datetime" required value="${defaultDateTime}">
                </div>
                <div class="form-group">
                    <label>${tt('form.place')} <span class="required">*</span></label>
                    <input type="text" id="lb-lieu" list="sites-list" placeholder="${tt('form.placePlaceholder')}" required autocomplete="off">
                    <datalist id="sites-list"></datalist>
                    ${this.renderCoordsBlock()}
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>${tt('form.wing')} <span class="required">*</span></label>
                        <select id="lb-voile" required>
                            <option value="">${tt('form.select')}</option>
                        </select>
                        <input type="text" id="lb-voile-autre" list="voiles-autre-list" placeholder="${tt('form.modelPlaceholder')}" autocomplete="off" style="display:none; margin-top: 5px; width: 100%;">
                        <datalist id="voiles-autre-list"></datalist>
                    </div>
                    <div class="form-group">
                        <label>${tt('form.harness')}</label>
                        <select id="lb-sellette">
                            <option value="">${tt('form.select')}</option>
                        </select>
                        <input type="text" id="lb-sellette-autre" list="sellettes-autre-list" placeholder="${tt('form.modelPlaceholder')}" autocomplete="off" style="display:none; margin-top: 5px; width: 100%;">
                        <datalist id="sellettes-autre-list"></datalist>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>${tt('form.duration')} <span class="required">*</span></label>
                        <input type="number" id="lb-duree" min="1" placeholder="${tt('form.durationPlaceholderGround')}" required>
                    </div>
                    <div class="form-group">
                        <label>${tt('form.exercises')}</label>
                        ${this.renderChecklist('typeExercice', this.statics().GROUND_EXERCISES, this.getUsedValues('typeExercice', 'gonflage'), tt('form.addExercisePlaceholder'))}
                    </div>
                </div>
                ${this.renderSchoolBlock()}
                ${this.renderPilotsBlock()}
                <div class="form-group">
                    <label>${tt('form.comment')}</label>
                    <textarea id="lb-commentaire" rows="3" placeholder="${tt('form.commentPlaceholderGround')}"></textarea>
                </div>
            `;
        }

        this.releaseCoordsMap();
        // Ce que l'app a pré-rempli d'après les habitudes du pilote
        html += `<div id="lb-learned-summary" hidden style="margin-top: 4px; font-size: 0.8rem; color: var(--text-secondary);"></div>`;
        container.innerHTML = html;
        this.populateDropdowns();
        this.touchedFields = new Set();
        this.manualTimeFields = new Set();
        this.igcLandingStr = null;
        this.learnedFields = new Map();
        this.applyLearnedDefaults();
        this.updateCoordsStatus();

        const uploadContainer = /** @type {HTMLElement} */ (document.querySelector('.igc-upload-container'));
        if (uploadContainer) {
            uploadContainer.addEventListener('dragenter', (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
            uploadContainer.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                uploadContainer.style.borderColor = 'var(--accent-orange)';
                uploadContainer.style.background = 'rgba(0, 123, 196, 0.1)';
            });
            uploadContainer.addEventListener('dragleave', (e) => {
                e.preventDefault();
                e.stopPropagation();
                uploadContainer.style.borderColor = 'var(--border-light, #ccc)';
                uploadContainer.style.background = 'var(--bg-card, #f9f9f9)';
            });
            uploadContainer.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                uploadContainer.style.borderColor = 'var(--border-light, #ccc)';
                uploadContainer.style.background = 'var(--bg-card, #f9f9f9)';
                if (e.dataTransfer && e.dataTransfer.files.length > 0) {
                    this._processFiles(e.dataTransfer.files);
                }
            });
        }
    }

    populateDropdowns() {
        // Écoles déjà saisies dans le carnet
        const schoolList = document.getElementById('ecoles-list');
        if (schoolList) {
            const schools = toSorted(
                [
                    ...new Set(
                        LogbookService.getFlights()
                            .map((session) => (typeof session.ecole === 'string' ? session.ecole.trim() : ''))
                            .filter(Boolean),
                    ),
                ],
                (a, b) => a.localeCompare(b),
            );
            schoolList.innerHTML = schools.map((name) => `<option value="${escapeHTML(name)}">`).join('');
        }

        // Treuilleurs déjà saisis, les plus fréquents d'abord
        const winchList = document.getElementById('treuilleurs-list');
        if (winchList) {
            const operators = PilotHabits.rankByUse(LogbookService.getFlights(), (session) =>
                typeof session.treuilleur === 'string' ? session.treuilleur.trim() : '',
            );
            winchList.innerHTML = operators.map((name) => `<option value="${escapeHTML(name)}">`).join('');
        }

        // Moniteurs déjà saisis, les plus fréquents d'abord
        const instructorList = document.getElementById('moniteurs-list');
        if (instructorList) {
            const instructors = PilotHabits.rankByUse(LogbookService.getFlights(), (session) =>
                typeof session.moniteur === 'string' ? session.moniteur.trim() : '',
            );
            instructorList.innerHTML = instructors.map((name) => `<option value="${escapeHTML(name)}">`).join('');
        }

        // Populate Sites
        const datalist = document.getElementById('sites-list');
        if (datalist) {
            let allSites = [];

            // 1. Sites officiels (SitesService)
            const officialSites = SitesService.getSites()
                .filter((site) => site.affiche !== false && (site.nom || site.name))
                .map((site) => (site.nom || site.name).trim().toUpperCase());
            allSites = allSites.concat(officialSites);

            // 2. Sites personnalisés (Historique du carnet)
            const historySites = LogbookService.getFlights()
                .map((session) => session.site || session.lieu)
                .filter((site) => site && site.trim() !== '')
                .map((site) => site.trim().toUpperCase());
            allSites = allSites.concat(historySites);

            // 3. Les lieux où le pilote va le plus souvent d'abord (appris du carnet), puis les
            // autres par ordre alphabétique
            const usual = PilotHabits.rankByUse(LogbookService.getFlights(), (session) =>
                (session.site || session.lieu || '').trim().toUpperCase(),
            );
            const others = toSorted(
                Array.from(new Set(allSites)).filter((site) => !usual.includes(site)),
                (a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }),
            );
            const processedSites = [...usual, ...others];

            // 4. Injection dans le DOM
            datalist.innerHTML = processedSites
                .map((siteName) => `<option value="${escapeHTML(siteName)}"></option>`)
                .join('');
        }

        // Populate Equipment Datalists (Historique)
        const voilesList = document.getElementById('voiles-autre-list');
        if (voilesList) {
            const voiles = toSorted(
                [
                    ...new Set(
                        LogbookService.getFlights()
                            .map((s) => (typeof s.voile === 'string' ? s.voile.trim() : ''))
                            .filter(Boolean),
                    ),
                ],
                (a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }),
            );
            voilesList.innerHTML = voiles.map((name) => `<option value="${escapeHTML(name)}">`).join('');
        }

        const sellettesList = document.getElementById('sellettes-autre-list');
        if (sellettesList) {
            const sellettes = toSorted(
                [
                    ...new Set(
                        LogbookService.getFlights()
                            .map((s) => (typeof s.sellette === 'string' ? s.sellette.trim() : ''))
                            .filter(Boolean),
                    ),
                ],
                (a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }),
            );
            sellettesList.innerHTML = sellettes.map((name) => `<option value="${escapeHTML(name)}">`).join('');
        }

        // Populate Equipment
        const voilesSelect = document.getElementById('lb-voile');
        const sellettesSelect = document.getElementById('lb-sellette');
        const rescueSelect = document.getElementById('lb-rescue');

        let voilesHtml = `<option value="">${tt('form.select')}</option>`;
        let sellettesHtml = `<option value="">${tt('form.select')}</option>`;
        let rescueHtml = `<option value="">${tt('form.select')}</option>`;

        LogbookService.getEquipment()
            .filter((e) => e.statut !== 'archive')
            .forEach((equip) => {
                if (equip.type === 'voile') {
                    voilesHtml += `<option value="${escapeHTML(equip.nom)}">${escapeHTML(equip.nom)}</option>`;
                } else if (equip.type === 'sellette') {
                    sellettesHtml += `<option value="${escapeHTML(equip.nom)}">${escapeHTML(equip.nom)}</option>`;
                } else if (equip.type === 'secours') {
                    rescueHtml += `<option value="${escapeHTML(equip.nom)}">${escapeHTML(equip.nom)}</option>`;
                }
            });

        if (voilesSelect) {
            voilesSelect.innerHTML = voilesHtml;
            voilesSelect.innerHTML += `<option value="Autre">${tt('form.other')}</option>`;
        }
        if (sellettesSelect) {
            sellettesSelect.innerHTML = sellettesHtml;
            sellettesSelect.innerHTML += `<option value="Autre">${tt('form.other')}</option>`;
        }
        if (rescueSelect) {
            rescueSelect.innerHTML = rescueHtml;
            rescueSelect.innerHTML += `<option value="Autre">${tt('form.other')}</option>`;
        }
    }

    submitForm() {
        const form = /** @type {HTMLFormElement} */ (document.getElementById('logbook-add-form'));
        if (!form.checkValidity()) {
            // Find which required field is empty
            const requiredFields = Array.from(form.querySelectorAll('[required]'));
            const emptyField = requiredFields.find(
                (field) => !(/** @type {HTMLInputElement|HTMLSelectElement} */ (field).value.trim()),
            );

            if (emptyField) {
                if (emptyField.id === 'lb-voile') {
                    const voiles = LogbookService.getEquipment().filter((e) => e.type === 'voile');
                    if (voiles.length === 0) {
                        alert(tl('form.alertMissingWingConfig'));
                    } else {
                        alert(tl('form.alertMissingWing'));
                    }
                } else if (emptyField.id === 'lb-site' || emptyField.id === 'lb-lieu') {
                    alert(tl('form.alertMissingSite'));
                } else if (emptyField.id === 'lb-duree') {
                    alert(tl('form.alertMissingDuration'));
                } else if (emptyField.id === 'lb-datetime') {
                    alert(tl('form.alertMissingDateTime'));
                } else if (emptyField.id === 'lb-ecole') {
                    alert(tl('form.alertMissingSchool'));
                } else {
                    alert(tl('form.alertMissingRequired'));
                }
                /** @type {HTMLElement} */ (emptyField).focus();
            }
            return;
        }

        // Nom tapé dans « Ajouter » (accompagnateur, pilote, exercice) sans cliquer sur le bouton :
        // il est ajouté plutôt que perdu à l'enregistrement.
        document.querySelectorAll('input[data-checklist]').forEach((input) => {
            const field = /** @type {HTMLInputElement} */ (input);
            if (field.value.trim()) this.addChecklistItem(field.dataset.checklist);
        });

        // Coordonnées choisies sur la carte ou collées (spec 011) : illisibles, rien n'est enregistré.
        const coordsInput = /** @type {HTMLInputElement} */ (document.getElementById('lb-coords'));
        const coordsText = coordsInput ? coordsInput.value.trim() : '';
        const coords = parseCoordinates(coordsText);
        if (coordsText && !coords) {
            this.showCoordsError();
            return;
        }

        const datetime = /** @type {HTMLInputElement} */ (document.getElementById('lb-datetime')).value;
        let voile = /** @type {HTMLSelectElement} */ (document.getElementById('lb-voile')).value.trim();
        let sellette = document.getElementById('lb-sellette')
            ? /** @type {HTMLSelectElement} */ (document.getElementById('lb-sellette')).value.trim()
            : '';

        if (voile === 'Autre') {
            const voileAutreInput = /** @type {HTMLInputElement} */ (document.getElementById('lb-voile-autre'));
            voile = voileAutreInput ? voileAutreInput.value.trim() : '';
        }
        if (sellette === 'Autre') {
            const selletteAutreInput = /** @type {HTMLInputElement} */ (document.getElementById('lb-sellette-autre'));
            sellette = selletteAutreInput ? selletteAutreInput.value.trim() : '';
        }
        const duree = parseInt(/** @type {HTMLInputElement} */ (document.getElementById('lb-duree')).value, 10);
        const commentaire = /** @type {HTMLTextAreaElement} */ (document.getElementById('lb-commentaire')).value.trim();
        const ecoleCheck = /** @type {HTMLInputElement} */ (document.getElementById('lb-ecole-check'));
        const ecoleInput = /** @type {HTMLInputElement} */ (document.getElementById('lb-ecole'));
        // Vide hors école : en modification, la valeur vide efface l'école enregistrée.
        const ecole = ecoleCheck?.checked && ecoleInput ? ecoleInput.value.trim() : '';
        const moniteurInput = /** @type {HTMLInputElement} */ (document.getElementById('lb-moniteur'));
        const moniteur = ecole && moniteurInput ? moniteurInput.value.trim() : '';

        // Nouveaux champs de stage
        const stageCheck = /** @type {HTMLInputElement} */ (document.getElementById('lb-stage-check'));
        const stageNameInput = /** @type {HTMLInputElement} */ (document.getElementById('lb-stage-nom'));
        const stageSpecialtySelect = /** @type {HTMLSelectElement} */ (document.getElementById('lb-stage-specialite'));
        const isStage = ecoleCheck?.checked && stageCheck?.checked;
        const stageName = isStage && stageNameInput ? stageNameInput.value.trim() : '';
        const stageSpecialty = isStage && stageSpecialtySelect ? stageSpecialtySelect.value : '';

        const editId = document.getElementById('lb-id-edit')
            ? /** @type {HTMLInputElement} */ (document.getElementById('lb-id-edit')).value
            : '';

        const session = {
            id: editId
                ? editId
                : typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                  ? crypto.randomUUID()
                  : Date.now().toString(),
            type: this.currentFormType,
            datetime: datetime,
            voile: voile,
            sellette: sellette,
            duree: duree,
            commentaire: commentaire,
            ecole: ecole,
            moniteur: moniteur,
            stageName: stageName,
            stageSpecialty: stageSpecialty,
            accompagnateur: ecole ? this.getChecklistValues('accompagnateur') : [],
            pilotes: this.getChecklistValues('pilotes'),
        };

        // Une trace IGC importée remplace ces coordonnées plus bas ; vidées en modification, elles sont retirées.
        if (coords) {
            session.lat = coords.lat;
            session.lon = coords.lon;
        } else if (editId) {
            session.lat = null;
            session.lon = null;
        }

        if (this.currentFormType === 'vol') {
            session.site = /** @type {HTMLInputElement} */ (document.getElementById('lb-site')).value.trim();
            session.typeVol = /** @type {HTMLSelectElement} */ (document.getElementById('lb-typeVol')).value;
            const winchOperator = /** @type {HTMLInputElement} */ (document.getElementById('lb-treuilleur'));
            session.treuilleur = session.typeVol === 'Treuil' && winchOperator ? winchOperator.value.trim() : '';

            const rescueCheck = /** @type {HTMLInputElement} */ (document.getElementById('lb-rescue-check'));
            if (rescueCheck && rescueCheck.checked) {
                session.rescueDeployed = true;
                const rescueSelect = /** @type {HTMLSelectElement} */ (document.getElementById('lb-rescue'));
                const rescueValue = rescueSelect ? rescueSelect.value.trim() : '';
                session.rescueId = rescueValue;
            } else {
                session.rescueDeployed = false;
                session.rescueId = '';
            }

            const techDecoEl = /** @type {HTMLSelectElement} */ (document.getElementById('lb-tech-decollage'));
            if (techDecoEl) {
                let techDecollage = techDecoEl.value;
                if (techDecollage === 'Autre') {
                    const techAutreInput = /** @type {HTMLInputElement} */ (
                        document.getElementById('lb-tech-decollage-autre')
                    );
                    let rawTech = techAutreInput ? techAutreInput.value.trim() : '';
                    if (rawTech) {
                        rawTech = capitalizeFirstLetter(rawTech);
                        techDecollage = rawTech;

                        let customTechs = StorageService.get('customDecollageTechniques') || [];
                        if (!Array.isArray(customTechs)) customTechs = [];

                        if (
                            !customTechs.includes(techDecollage) &&
                            techDecollage !== 'Face voile' &&
                            techDecollage !== 'Dos voile'
                        ) {
                            customTechs.push(techDecollage);
                            StorageService.set('customDecollageTechniques', customTechs);
                        }
                    }
                }
                session.techDecollage = techDecollage;
            }
            session.typeExercice = ecole ? this.getChecklistValues('typeExercice') : [];

            const altMax = /** @type {HTMLInputElement} */ (document.getElementById('lb-altMax')).value;
            if (altMax) session.altitudeMax = parseInt(altMax, 10);

            const gain = /** @type {HTMLInputElement} */ (document.getElementById('lb-gain')).value;
            if (gain) session.gain = parseInt(gain, 10);

            if (this.currentTraceData) {
                if (this.currentTraceData.length > 0) {
                    session.lat = this.currentTraceData[0].lat;
                    session.lon = this.currentTraceData[0].lon;
                }
                this.currentTraceData = null; // reset
            }
            if (this.currentIgcStats) {
                Object.assign(session, this.currentIgcStats);
                this.currentIgcStats = null; // reset
            }
            if (this.currentSensorStats) {
                session.sensorStats = this.currentSensorStats;
                this.currentSensorStats = null;
            }
            this.currentTraceInfo = null;
            if (this.currentRawIgc) {
                session.rawIgc = this.currentRawIgc;
                // Date de la trace : la synchro la renvoie dans le compte si elle est plus récente que l'envoi (spec 037).
                session.traceUpdatedAt = Date.now();
                this.currentRawIgc = null; // reset
            }
            session.varioOffInFlight = Boolean(
                /** @type {HTMLInputElement} */ (document.getElementById('lb-vario-off-in-flight'))?.checked,
            );
            session.varioInFlight = Boolean(
                /** @type {HTMLInputElement} */ (document.getElementById('lb-vario-in-flight'))?.checked,
            );
            // Le brut IGC reste inchangé : la correction est ré-appliquée à chaque lecture de la trace
            if (this.currentIgcAltOffset !== null) {
                session.altOffset = this.currentIgcAltOffset;
                this.currentIgcAltOffset = null;
            }
        } else {
            session.lieu = /** @type {HTMLInputElement} */ (document.getElementById('lb-lieu')).value.trim();
            const checkboxes = /** @type {NodeListOf<HTMLInputElement>} */ (
                document.querySelectorAll('input[name="lb-typeExercice"]:checked')
            );
            if (checkboxes.length > 0) {
                session.typeExercice = Array.from(checkboxes).map((cb) => cb.value);
            } else {
                session.typeExercice = [];
            }
        }

        if (editId) {
            LogbookService.updateFlight(editId, session);
        } else {
            LogbookService.addFlight(session);
        }

        this.closeSessionModal();
        this.switchTab('history');

        // Extract coordinates and fetch weather asynchronously
        let lat = null,
            lon = null;
        let baliseId = null;
        if (session.lat && session.lon) {
            lat = session.lat;
            lon = session.lon;
        } else {
            const siteName = session.site || session.lieu || '';
            if (siteName) {
                const foundSite = this.findSiteByName(siteName);
                const coords = this.getSiteCoords(foundSite);
                if (coords.lat && coords.lon) {
                    lat = coords.lat;
                    lon = coords.lon;
                }
                baliseId = getSpotairWidgetId(foundSite);
            }
        }

        if (!lat || !lon) {
            const sessionDate = new Date(session.datetime).toDateString();
            const todayDate = new Date().toDateString();
            if (sessionDate === todayDate && navigator.geolocation) {
                navigator.geolocation.getCurrentPosition((position) => {
                    this.fetchWeatherForSession(
                        position.coords.latitude,
                        position.coords.longitude,
                        session.datetime,
                        session.id,
                        session.duree,
                        baliseId,
                    );
                });
                return;
            }
        }

        if (lat && lon) {
            this.fetchWeatherForSession(lat, lon, session.datetime, session.id, session.duree, baliseId);
        }
    }

    resetForm() {
        const form = /** @type {HTMLFormElement} */ (document.getElementById('logbook-add-form'));
        if (form) form.reset();
        const idEditField = /** @type {HTMLInputElement} */ (document.getElementById('lb-id-edit'));
        if (idEditField) idEditField.value = '';
        const submitBtn = document.getElementById('lb-submit-btn');
        if (submitBtn) submitBtn.innerText = tl('form.save');
        this.currentTraceData = null;
        this.currentIgcStats = null;
        this.currentIgcAltOffset = null;
        this.currentSensorStats = null;
        this.currentTraceInfo = null;
        const filenameLabel = document.getElementById('igc-upload-filename');
        if (filenameLabel) filenameLabel.textContent = tl('form.igcHint');
        this.renderForm();
    }

    editEntry(id) {
        const session = LogbookService.getFlightById(id);
        if (!session) return;

        this.currentFormType = session.type;

        // Ouvre la fenêtre en premier pour générer les champs HTML
        this.switchTab('add');

        // Populate common fields
        /** @type {HTMLInputElement} */ (document.getElementById('lb-id-edit')).value = session.id;
        // Session existante : ce qui a été pré-rempli à l'ouverture du formulaire ne doit pas
        // remplacer un champ que la session laisse vide (sinon il serait enregistré).
        this.learnedFields.clear();
        this.renderLearnedSummary();
        for (const id of ['lb-voile', 'lb-sellette']) {
            const select = /** @type {HTMLSelectElement} */ (document.getElementById(id));
            if (select) select.value = '';
        }
        const techSelect = /** @type {HTMLSelectElement} */ (document.getElementById('lb-tech-decollage'));
        if (techSelect) techSelect.selectedIndex = 0;
        this.setSchoolField(false);
        const instructorEdit = /** @type {HTMLInputElement} */ (document.getElementById('lb-moniteur'));
        if (instructorEdit) instructorEdit.value = session.moniteur || '';
        this.setChecklistValues('accompagnateur', this.statics().companionsOf(session));
        /** @type {HTMLInputElement} */ (document.getElementById('lb-datetime')).value = session.datetime;

        // Helper pour "Autre..."
        const setSelectOrAutre = (selectId, autreId, value) => {
            const selectEl = /** @type {HTMLSelectElement} */ (document.getElementById(selectId));
            const autreEl = /** @type {HTMLInputElement} */ (document.getElementById(autreId));
            if (!selectEl || !value) return;

            if (value === 'Autre') {
                selectEl.value = 'Autre';
                if (autreEl) autreEl.style.display = 'block';
                return;
            }

            // On regarde si la valeur existe dans les options
            const options = Array.from(selectEl.options).map((o) => o.value);
            if (options.includes(value)) {
                selectEl.value = value;
                if (autreEl) autreEl.style.display = 'none';
            } else {
                selectEl.value = 'Autre';
                if (autreEl) {
                    autreEl.style.display = 'block';
                    autreEl.value = value;
                }
            }
        };

        setSelectOrAutre('lb-voile', 'lb-voile-autre', session.voile);
        setSelectOrAutre('lb-sellette', 'lb-sellette-autre', session.sellette);

        if (session.rescueDeployed) {
            const rescueSelect = /** @type {HTMLSelectElement} */ (document.getElementById('lb-rescue'));
            if (rescueSelect && session.rescueId) {
                rescueSelect.value = session.rescueId;
            }
        }

        /** @type {HTMLInputElement} */ (document.getElementById('lb-duree')).value = session.duree;
        /** @type {HTMLTextAreaElement} */ (document.getElementById('lb-commentaire')).value =
            session.commentaire || '';
        if (session.ecole) this.setSchoolField(true, session.ecole);

        // Load Stage info
        if (session.stageName || session.stageSpecialty) {
            const stageCheck = /** @type {HTMLInputElement} */ (document.getElementById('lb-stage-check'));
            if (stageCheck) {
                stageCheck.checked = true;
                const group = document.getElementById('lb-stage-group');
                if (group) group.hidden = false;
            }
            const stageNameInput = /** @type {HTMLInputElement} */ (document.getElementById('lb-stage-nom'));
            if (stageNameInput && session.stageName) stageNameInput.value = session.stageName;
            const stageSpecialtySelect = /** @type {HTMLSelectElement} */ (
                document.getElementById('lb-stage-specialite')
            );
            if (stageSpecialtySelect && session.stageSpecialty) stageSpecialtySelect.value = session.stageSpecialty;
        }

        this.setChecklistValues('pilotes', session.pilotes || []);
        if (session.typeExercice) this.setChecklistValues('typeExercice', session.typeExercice);

        // Populate specific fields
        if (session.type === 'vol') {
            /** @type {HTMLInputElement} */ (document.getElementById('lb-site')).value = session.site || '';
            /** @type {HTMLSelectElement} */ (document.getElementById('lb-typeVol')).value = session.typeVol || 'Plouf';
            const winchOperatorEdit = /** @type {HTMLInputElement} */ (document.getElementById('lb-treuilleur'));
            if (winchOperatorEdit) winchOperatorEdit.value = session.treuilleur || '';
            this.updateWinchOperatorField();

            // Load Rescue info
            if (session.rescueDeployed) {
                const rescueCheck = /** @type {HTMLInputElement} */ (document.getElementById('lb-rescue-check'));
                if (rescueCheck) {
                    rescueCheck.checked = true;
                    const group = document.getElementById('lb-rescue-group');
                    if (group) group.hidden = false;
                }
                const rescueSelect = /** @type {HTMLSelectElement} */ (document.getElementById('lb-rescue'));
                if (rescueSelect && session.rescueId) rescueSelect.value = session.rescueId;
            }

            setSelectOrAutre('lb-tech-decollage', 'lb-tech-decollage-autre', session.techDecollage);

            if (session.altitudeMax)
                /** @type {HTMLInputElement} */ (document.getElementById('lb-altMax')).value = session.altitudeMax;
            if (session.gain) /** @type {HTMLInputElement} */ (document.getElementById('lb-gain')).value = session.gain;

            const varioBox = /** @type {HTMLInputElement} */ (document.getElementById('lb-vario-in-flight'));
            if (varioBox) varioBox.checked = Boolean(session.varioInFlight);
            const varioOffBox = /** @type {HTMLInputElement} */ (document.getElementById('lb-vario-off-in-flight'));
            if (varioOffBox) varioOffBox.checked = Boolean(session.varioOffInFlight);

            // Vol déjà enregistré avec sa trace (en mémoire ou dans IndexedDB) : on peut corriger
            // (ou annuler) la correction d'altitude, et tout recalculer depuis la trace.
            LogbookService.getFlightTrace(session.id).then((rawIgc) => {
                const idField = /** @type {HTMLInputElement} */ (document.getElementById('lb-id-edit'));
                if (!rawIgc || !idField || idField.value !== session.id) return; // formulaire refermé entre-temps
                const raw = LogbookService.parseIGC(rawIgc);
                if (!raw.success) return;
                this._setupAltitudeCheck(raw.data, session.altOffset || 0);
                this.igcLandingStr = addMinutesToDatetimeLocal(raw.data.dateStr, raw.data.duration);
                const recalcBtn = document.getElementById('lb-igc-recalc');
                if (recalcBtn) recalcBtn.style.display = 'block';
            });

            if (session.traceGps && session.traceGps.length > 0) {
                const filenameLabel = document.getElementById('igc-upload-filename');
                if (filenameLabel) filenameLabel.textContent = tl('igc.existingTrace');
            }
        } else {
            /** @type {HTMLInputElement} */ (document.getElementById('lb-lieu')).value = session.lieu || '';
        }

        const coordsInput = /** @type {HTMLInputElement} */ (document.getElementById('lb-coords'));
        if (coordsInput && Number.isFinite(session.lat) && Number.isFinite(session.lon)) {
            coordsInput.value = formatCoordinates(session.lat, session.lon);
        }
        this.updateCoordsStatus();

        // Update UI buttons
        const submitBtn = document.getElementById('lb-submit-btn');
        if (submitBtn) submitBtn.innerText = tl('form.update');
        this.setSessionModalTitle(true);
    }
}
