/**
 * VIEW/CONTROLLER - LogbookView
 * Wrapped from logbook_engine.js
 */
import LogbookService from '../services/logbook_service.js';
import SdfParser from '../services/sdf_parser.js';
import PilotHabits from '../services/pilot_habits.js';
import StorageService from '../services/storage.js'; // Retained just for custom select lists
import SitesService from '../services/sites_service.js';
import { escapeHTML } from '../core/security.js';
import { capitalizeFirstLetter } from '../utils/text_utils.js';
import { toSorted } from '../utils/array_utils.js';
import { getSpotairWidgetId } from '../data/spotair_widgets.js';
import { parseCoordinates, formatCoordinates } from '../utils/geo_utils.js';

import { classifyFlight } from '../services/flight_classifier.js';
import GlobalState from '../core/app_state.js';
import { tt, th, tl } from './logbook_strings.js';
import { LogbookChecklistsBase } from './logbook_checklists.js';

class LogbookViewClass extends LogbookChecklistsBase {
    constructor() {
        super();
        this.currentTab = StorageService.get('LAST_LOGBOOK_TAB') || 'history';
    } // Ends constructor

    setupEventListeners() {
        const container = document.body;
        if (container && !container.dataset.logbookListenerBound) {
            container.dataset.logbookListenerBound = 'true';
            // Note: [data-action] clicks are already handled globally by AppEvents (see main.js),
            // which maps each action name to LogbookView[action]. A second listener here would
            // fire every Logbook button handler twice per click (e.g. showTrace toggling open then
            // immediately closed again).

            // Note: input change events
            // Lieu et coordonnées GPS du formulaire d'ajout (spec 011)
            container.addEventListener('input', (e) => {
                const target = /** @type {HTMLInputElement} */ (e.target);
                if (target.id === 'lb-coords') LogbookView.onCoordsTyped();
                else if (target.id === 'lb-site' || target.id === 'lb-lieu') LogbookView.onPlaceChanged();
            });

            container.addEventListener('change', (e) => {
                const target = /** @type {HTMLInputElement} */ (e.target);
                if (target.id === 'lb-coords' && target.value.trim() && !parseCoordinates(target.value)) {
                    LogbookView.showCoordsError();
                }
                // Champ choisi par le pilote : l'app ne le pré-remplit plus, et réévalue les
                // autres (un autre site ou type de vol change les habitudes à appliquer).
                const learnedField = LogbookViewClass.LEARNED_FIELD_IDS[target.id];
                if (learnedField) LogbookView.onLearnedFieldChanged(learnedField);
                // Autre heure : les pilotes d'une session proche ne sont peut-être plus les mêmes
                if (target.id === 'lb-datetime') LogbookView.applyLearnedDefaults();
                // Treuilleur affiché seulement pour un vol au treuil (y compris en modification)
                if (target.id === 'lb-typeVol') LogbookView.updateWinchOperatorField();

                if (target.id === 'lb-coords') {
                    // traité plus haut
                } else if (target.id === 'lb-ecole-check') {
                    LogbookView.setSchoolField(target.checked);
                } else if (target.id === 'lb-stage-check') {
                    const group = document.getElementById('lb-stage-group');
                    if (group) group.hidden = !target.checked;
                } else if (target.id === 'lb-rescue-check') {
                    const group = document.getElementById('lb-rescue-group');
                    if (group) group.hidden = !target.checked;
                    if (target.checked) LogbookView.updateLinkedRescue();
                } else if (target.id === 'lb-voile' || target.id === 'lb-sellette') {
                    LogbookView.setSelectOrAutre(target.id, target.id + '-autre', target.value);
                    if (target.id === 'lb-sellette') {
                        LogbookView.updateLinkedRescue();
                    }
                } else if (
                    target.id === 'eq-marque' ||
                    target.id === 'eq-modele' ||
                    target.id === 'eq-taille' ||
                    target.id === 'eq-couleur'
                ) {
                    LogbookView.setSelectOrAutre(target.id, target.id + '-autre', target.value);
                } else if (target.id === 'eq-type') {
                    const windLimitsDiv = document.getElementById('eq-wind-limits');
                    if (windLimitsDiv) {
                        windLimitsDiv.style.display = target.value === 'voile' ? 'flex' : 'none';
                    }
                    const linkedRescueDiv = document.getElementById('eq-linked-rescue-group');
                    if (linkedRescueDiv) {
                        linkedRescueDiv.style.display = target.value === 'sellette' ? 'block' : 'none';
                    }
                    LogbookView.updateEquipmentLabels(target.value);
                }
            });

            // Croix d'une étiquette (exercice, pilote) : retire la valeur
            container.addEventListener('click', (e) => {
                const button = /** @type {HTMLElement} */ (e.target).closest('[data-checklist-remove]');
                if (button) LogbookView.removeChecklistItem(button);
            });

            // Valeur choisie dans la liste déroulante d'un champ « Ajouter » : ajoutée tout de suite
            container.addEventListener('input', (e) => {
                const target = /** @type {HTMLInputElement} */ (e.target);
                const name = target.dataset && target.dataset.checklist;
                if (!name) return;
                const picked = !(e instanceof InputEvent) || e.inputType === 'insertReplacementText';
                if (picked && LogbookView.getChecklistOptions(name).includes(target.value)) {
                    LogbookView.addChecklistItem(name);
                }
            });

            // Entrée dans « Ajouter un exercice / un pilote » : ajoute à la liste au lieu
            // d'envoyer le formulaire.
            container.addEventListener('keydown', (e) => {
                const target = /** @type {HTMLInputElement} */ (e.target);
                if (e.key !== 'Enter' || !target.dataset || !target.dataset.checklist) return;
                e.preventDefault();
                LogbookView.addChecklistItem(target.dataset.checklist);
            });

            // Logbook form submit
            container.addEventListener('submit', (e) => {
                if (/** @type {HTMLElement} */ (e.target).id === 'logbook-add-form') {
                    e.preventDefault();
                    LogbookView.submitForm();
                } else if (/** @type {HTMLElement} */ (e.target).id === 'equip-form') {
                    e.preventDefault();
                    // Equipment form doesn't have an explicit submit function globally, it is handled in renderEquipment
                }
            });
        }
    }

    init() {
        this.initEquipment();
        this.setupEventListeners();
        this.updateEquipmentAlertBadge();
        console.log('LogbookView initialized.');
    }

    show() {
        this.switchTab(this.currentTab);
    }

    switchTab(tabName) {
        // L'ajout et la modification d'une session se font dans une fenêtre, plus dans un onglet.
        if (tabName === 'add') {
            this.openSessionModal();
            return;
        }
        this.currentTab = tabName;
        StorageService.set('LAST_LOGBOOK_TAB', tabName);

        // Sous-partie affichée, signalée dans le sous-menu « Carnet » de la barre de navigation
        if (GlobalState.get('mode') === 'LOGBOOK') {
            document.querySelectorAll('[data-logbook-tab]').forEach((btn) => {
                btn.setAttribute('aria-current', String(btn.getAttribute('data-logbook-tab') === tabName));
            });
        }

        // Update Content
        document.querySelectorAll('.logbook-tab-content').forEach((content) => {
            content.classList.remove('active');
        });
        const activeContent = document.getElementById(`logbook-tab-${tabName}`);
        if (activeContent) activeContent.classList.add('active');

        // Trigger Render
        if (tabName === 'history') {
            this.renderHistory();
        } else if (tabName === 'stats') {
            this.renderStats();
        } else if (tabName === 'equip') {
            this.renderEquipment();
        }
        this.updateEquipmentAlertBadge();
    }

    // --- FENÊTRE D'AJOUT / MODIFICATION D'UNE SESSION ---

    openSessionModal() {
        const modal = /** @type {HTMLDialogElement & { _cancelBound?: boolean }} */ (
            document.getElementById('logbook-session-modal')
        );
        if (!modal) return;
        this.renderForm();
        this.setSessionModalTitle(false);
        if (!modal._cancelBound) {
            modal._cancelBound = true;
            // Échap : même effet que « Annuler ». Un clic à côté de la fenêtre ne la ferme pas,
            // pour ne pas perdre une saisie en cours.
            modal.addEventListener('cancel', (e) => {
                e.preventDefault();
                this.closeSessionModal();
            });
        }
        // Position du carnet derrière la fenêtre : WebKit (Linux) la fait parfois sauter à
        // l'ouverture, sans appel JavaScript ; elle est rétablie aussitôt et à la fermeture.
        const screen = document.getElementById('logbook-screen');
        this._scrollBehindModal = screen ? screen.scrollTop : null;
        modal.style.display = 'flex';
        if (typeof modal.showModal === 'function' && !modal.open) modal.showModal();
        this._restoreScrollBehindModal();
        void modal.offsetWidth; // fait jouer le fondu d'ouverture
        modal.classList.add('active');
        const body = modal.querySelector('.gdpr-modal-body');
        if (body) body.scrollTop = 0;
    }

    closeSessionModal() {
        const modal = /** @type {HTMLDialogElement} */ (document.getElementById('logbook-session-modal'));
        this.releaseCoordsMap();
        this.resetForm();
        if (!modal) return;
        modal.classList.remove('active');
        // La fermeture rend le focus à l'élément qui l'avait avant l'ouverture et peut faire défiler
        // la page jusqu'à lui : le carnet reprend la position qu'il avait à l'ouverture.
        if (typeof modal.close === 'function' && modal.open) modal.close();
        this._restoreScrollBehindModal();
        this._scrollBehindModal = null;
        modal.style.display = 'none';
    }

    _restoreScrollBehindModal() {
        const screen = document.getElementById('logbook-screen');
        const top = this._scrollBehindModal;
        if (screen && typeof top === 'number' && screen.scrollTop !== top) screen.scrollTop = top;
    }

    setSessionModalTitle(isEdit) {
        const title = document.getElementById('logbook-session-modal-title');
        if (title) title.textContent = tl(isEdit ? 'modal.titleEdit' : 'modal.titleAdd');
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

    // --- SESSION EN ÉCOLE ---

    // --- LISTES À COCHER EXTENSIBLES (exercices, pilotes) ---
    // La liste proposée = valeurs par défaut + toutes celles déjà enregistrées dans le carnet :
    // une valeur ajoutée à la main sur une session est donc reproposée sur les suivantes.

    // Liste modifiée par le pilote : elle n'est plus pré-remplie (pilotes d'une session proche).
    onChecklistEdited(name) {
        if (!this.touchedFields.has(name)) {
            this.touchedFields.add(name);
            this.learnedFields.delete(name);
            this.renderLearnedSummary();
        }
    }

    // --- COORDONNÉES GPS D'UN LIEU SAISI À LA MAIN (spec 011) ---

    getCurrentDateTimeLocal() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    triggerIgcUpload() {
        const fileInput = document.getElementById('global-igc-input');
        if (fileInput) fileInput.click();
    }

    renderForm() {
        const container = document.getElementById('form-fields-container');
        if (!container) return;

        let html;
        const defaultDateTime = this.getCurrentDateTimeLocal();

        if (this.currentFormType === 'vol') {
            html = `
                <div role="button" tabindex="0" class="form-group igc-upload-container" data-action="triggerIgcUpload" style="border: 2px dashed var(--border-light, #ccc); border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 15px; cursor: pointer; background: var(--bg-card, #f9f9f9);">
                    <i class="ri-upload-cloud-line" style="font-size: 2rem; color: var(--accent-blue, #007bc4);"></i>
                    <div style="font-weight: bold; margin-top: 10px;">${tt('form.igcTitle')}</div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary, #666); margin-top: 5px;" id="igc-upload-filename">${tt('form.igcHint')}</div>
                </div>
                <button type="button" id="lb-igc-recalc" data-action="recalculateFromTrace" style="display:none; width: 100%; margin: -5px 0 15px; padding: 8px; border-radius: 6px; border: 1px solid var(--accent-blue, #007bc4); color: var(--accent-blue, #007bc4); background: transparent; cursor: pointer;"><i class="ri-refresh-line"></i> ${tt('igc.recalculate')}</button>
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
                        ${this.renderChecklist('typeExercice', LogbookViewClass.GROUND_EXERCISES, this.getUsedValues('typeExercice', 'gonflage'), tt('form.addExercisePlaceholder'))}
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
                uploadContainer.style.borderColor = 'var(--accent-blue)';
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

    updateLinkedRescue() {
        const rescueCheck = /** @type {HTMLInputElement|null} */ (document.getElementById('lb-rescue-check'));
        if (!rescueCheck || !rescueCheck.checked) return;

        const selletteSelect = /** @type {HTMLSelectElement|null} */ (document.getElementById('lb-sellette'));
        if (!selletteSelect) return;

        const selletteName = selletteSelect.value;
        if (!selletteName) return;

        const equipments = LogbookService.getEquipment();
        const sellette = equipments.find((e) => e.type === 'sellette' && e.nom === selletteName);
        if (sellette && sellette.linkedRescueId) {
            const linkedRescue = equipments.find((e) => e.id === sellette.linkedRescueId);
            if (linkedRescue) {
                const rescueSelect = /** @type {HTMLSelectElement|null} */ (document.getElementById('lb-rescue'));
                if (rescueSelect) {
                    rescueSelect.value = linkedRescue.nom;
                }
            }
        }
    }

    // --- PRÉ-REMPLISSAGE APPRIS DU PILOTE (PilotHabits) ---
    // Pour une nouvelle session, l'app propose ce que le pilote fait d'habitude dans la même
    // situation : type de vol et technique du site, matériel utilisé là (sinon le dernier),
    // école récente, lieu de gonflage habituel. Un champ que le pilote modifie n'est plus
    // jamais remplacé ; une session existante n'est jamais modifiée.

    // id du champ → nom du champ appris
    static LEARNED_FIELD_IDS = {
        'lb-typeVol': 'typeVol',
        'lb-tech-decollage': 'techDecollage',
        'lb-voile': 'voile',
        'lb-sellette': 'sellette',
        'lb-ecole-check': 'ecole',
        'lb-ecole': 'ecole',
        'lb-moniteur': 'moniteur',
        'lb-treuilleur': 'treuilleur',
        'lb-site': 'site',
        'lb-lieu': 'lieu',
    };

    // Valeur de l'option « Dos voile » (identifiant, pas un texte affiché)
    static WINCH_TAKEOFF_TECHNIQUE = 'Dos voile';

    touchedFields = new Set();
    learnedFields = new Map(); // champ → raison affichée

    onLearnedFieldChanged(field) {
        this.touchedFields.add(field);
        this.learnedFields.delete(field);
        this.applyLearnedDefaults();
    }

    /**
     * Pré-remplit les champs que le pilote n'a pas touchés. `force` : champs à recalculer même
     * en modification d'une session (ex. technique enregistrée avec un type de vol par défaut).
     */
    applyLearnedDefaults({ force = [] } = {}) {
        const editing = Boolean(/** @type {HTMLInputElement} */ (document.getElementById('lb-id-edit'))?.value);
        if (editing && !force.length) return;
        const can = (field) => force.includes(field) || (!editing && !this.touchedFields.has(field));
        const sessions = LogbookService.getFlights();
        const isVol = this.currentFormType === 'vol';
        const sessionType = isVol ? 'vol' : 'gonflage';
        const value = (id) => /** @type {HTMLInputElement} */ (document.getElementById(id))?.value || '';
        const setSelect = (id, field, suggestion) => {
            const select = /** @type {HTMLSelectElement} */ (document.getElementById(id));
            if (!select || !suggestion || !Array.from(select.options).some((o) => o.value === suggestion.value)) return;
            select.value = suggestion.value;
            const other = document.getElementById(`${id}-autre`);
            if (other) other.style.display = 'none';
            this.learnedFields.set(field, suggestion.reason);
        };

        // Lieu de gonflage habituel (seulement s'il est vide)
        if (!isVol && can('lieu') && !value('lb-lieu').trim()) {
            const lieu = PilotHabits.suggest(sessions, 'lieu', { sessionType, minScore: 1.5 });
            const input = /** @type {HTMLInputElement} */ (document.getElementById('lb-lieu'));
            if (lieu && input) {
                input.value = lieu.value;
                this.learnedFields.set('lieu', 'habit');
                this.onPlaceChanged(); // coordonnées connues de ce lieu
            }
        }
        const place = isVol ? value('lb-site') : value('lb-lieu');

        if (isVol && can('typeVol')) {
            setSelect(
                'lb-typeVol',
                'typeVol',
                PilotHabits.suggest(sessions, 'typeVol', {
                    sessionType,
                    context: { place },
                    mismatch: { place: 0.1 },
                    minScore: 1,
                }),
            );
        }
        if (isVol && can('techDecollage')) {
            const winch = value('lb-typeVol') === 'Treuil';
            const technique = PilotHabits.suggest(sessions, 'techDecollage', {
                sessionType,
                context: { place, launch: winch ? 'treuil' : 'libre' },
                // Règle générale, vite remplacée par les vols du pilote au treuil
                prior: winch ? { value: LogbookViewClass.WINCH_TAKEOFF_TECHNIQUE, weight: 2, reason: 'winch' } : null,
            });
            if (technique && technique.reason === 'launch') technique.reason = winch ? 'launchWinch' : 'habit';
            setSelect('lb-tech-decollage', 'techDecollage', technique);
        }
        for (const field of ['voile', 'sellette']) {
            if (!can(field)) continue;
            const gear = PilotHabits.latest(sessions, field, { place });
            if (gear)
                setSelect(`lb-${field}`, field, {
                    value: gear.value,
                    reason: gear.reason === 'place' ? 'gearPlace' : 'gearLatest',
                });
        }
        if (can('ecole')) {
            const ecole = PilotHabits.suggest(sessions, 'ecole', {
                sessionType,
                context: { place },
                mismatch: { place: 0.1 }, // on vole en école sur certains sites, pas partout
                includeEmpty: true,
                minScore: 1,
            });
            if (ecole && ecole.value) {
                this.setSchoolField(true, ecole.value);
                this.learnedFields.set('ecole', ecole.reason);
            } else if (ecole && this.learnedFields.has('ecole')) {
                // Proposée pour un autre site : on la retire
                this.setSchoolField(false);
                this.learnedFields.delete('ecole');
            }
        }
        // Moniteur : le dernier de cette école sur ce site, sinon le dernier de cette école
        const instructorInput = /** @type {HTMLInputElement} */ (document.getElementById('lb-moniteur'));
        const school = /** @type {HTMLInputElement} */ (document.getElementById('lb-ecole-check'))?.checked
            ? value('lb-ecole').trim().toLowerCase()
            : '';
        if (instructorInput && can('moniteur')) {
            const instructor = school
                ? PilotHabits.latest(
                      sessions.filter((s) => typeof s.ecole === 'string' && s.ecole.trim().toLowerCase() === school),
                      'moniteur',
                      { place },
                  )
                : null;
            if (instructor) {
                instructorInput.value = instructor.value;
                this.learnedFields.set(
                    'moniteur',
                    instructor.reason === 'place' ? 'instructorPlace' : 'instructorLatest',
                );
            } else if (this.learnedFields.has('moniteur')) {
                instructorInput.value = '';
                this.learnedFields.delete('moniteur');
            }
        }
        // Accompagnateurs : ceux d'une session de moins de 3 h ici, sinon les derniers de cette école ici
        if (document.getElementById('lb-accompagnateur-group') && can('accompagnateur')) {
            const withCompanion = school
                ? sessions.filter(
                      (s) =>
                          LogbookViewClass.companionsOf(s).length > 0 &&
                          typeof s.ecole === 'string' &&
                          s.ecole.trim().toLowerCase() === school,
                  )
                : [];
            const close = this.findNearbySession(withCompanion, place, value('lb-datetime'), 'accompagnateur');
            const placeKey = (place || '').trim().toLowerCase();
            const last = !close && placeKey ? withCompanion.find((s) => PilotHabits.placeOf(s) === placeKey) : null;
            if (close || last) {
                this.setChecklistValues('accompagnateur', LogbookViewClass.companionsOf(close || last));
                this.learnedFields.set('accompagnateur', close ? 'nearbySession' : 'instructorPlace');
            } else if (this.learnedFields.has('accompagnateur')) {
                this.setChecklistValues('accompagnateur', []);
                this.learnedFields.delete('accompagnateur');
            }
        }
        // Treuilleur : pas de pré-remplissage (souvent plusieurs le même jour), mais ceux de la
        // journée sur ce site en tête de la liste déroulante
        this.updateWinchOperatorField();
        if (isVol) this.refreshWinchOperatorList(sessions, place, value('lb-datetime'));

        // Pilotes : ceux d'une session au même endroit à moins de 3 h (plusieurs vols d'affilée)
        if (can('pilotes')) {
            const nearby = this.findNearbySession(sessions, place, value('lb-datetime'));
            if (nearby) {
                this.setChecklistValues('pilotes', nearby.pilotes);
                this.learnedFields.set('pilotes', 'nearbySession');
            } else if (this.learnedFields.has('pilotes')) {
                this.setChecklistValues('pilotes', []);
                this.learnedFields.delete('pilotes');
            }
        }
        this.renderLearnedSummary();
    }

    /**
     * Session la plus proche dans le temps, au même endroit, à moins de 3 h de `datetime`, et qui
     * a des pilotes : un vol de la même série (treuil, plusieurs ploufs dans la journée…).
     */
    findNearbySession(sessions, place, datetime, field = 'pilotes') {
        const key = (place || '').trim().toLowerCase();
        const t = new Date(datetime).getTime();
        if (!key || !Number.isFinite(t)) return null;
        let best = null;
        let bestGap = 3 * 3600 * 1000;
        for (const s of sessions) {
            const v = s[field];
            if (!v || (Array.isArray(v) && !v.length) || PilotHabits.placeOf(s) !== key) continue;
            const gap = Math.abs(new Date(s.datetime).getTime() - t);
            if (gap <= bestGap) {
                best = s;
                bestGap = gap;
            }
        }
        return best;
    }

    /** Treuilleurs proposés : ceux du même jour sur ce site d'abord, puis les plus fréquents. */
    refreshWinchOperatorList(sessions, place, datetime) {
        const list = document.getElementById('treuilleurs-list');
        if (!list) return;
        const key = (place || '').trim().toLowerCase();
        const day = typeof datetime === 'string' ? datetime.slice(0, 10) : '';
        const operatorOf = (session) => (typeof session.treuilleur === 'string' ? session.treuilleur.trim() : '');
        const sameDay =
            key && day
                ? PilotHabits.rankByUse(
                      sessions.filter(
                          (s) => PilotHabits.placeOf(s) === key && String(s.datetime || '').slice(0, 10) === day,
                      ),
                      operatorOf,
                  )
                : [];
        const others = PilotHabits.rankByUse(sessions, operatorOf).filter((name) => !sameDay.includes(name));
        list.innerHTML = [...sameDay, ...others].map((name) => `<option value="${escapeHTML(name)}">`).join('');
    }

    // Le treuilleur n'est demandé que pour un vol au treuil
    updateWinchOperatorField() {
        const group = document.getElementById('lb-treuilleur-group');
        const typeVol = /** @type {HTMLSelectElement} */ (document.getElementById('lb-typeVol'));
        if (group) group.hidden = !typeVol || typeVol.value !== 'Treuil';
    }

    renderLearnedSummary() {
        const box = document.getElementById('lb-learned-summary');
        if (!box) return;
        const items = [...this.learnedFields.entries()].map(
            ([field, reason]) => `${tl(`form.learned.fields.${field}`)} (${tl(`form.learned.reasons.${reason}`)})`,
        );
        box.hidden = items.length === 0;
        box.textContent = items.length ? tl('form.learned.summary', { items: items.join(', ') }) : '';
    }

    currentTraceData = null;
    currentRawIgc = null;
    currentIgcStats = null;
    // null = correction d'altitude non touchée dans ce formulaire (on ne réécrit pas altOffset)
    currentIgcAltOffset = null;

    // Capteurs du vario (facteur de charge, température) lus dans le .sdf Syride
    currentSensorStats = null;
    // Trace du formulaire en cours (import ou vol modifié), pour caler le .sdf dessus
    currentTraceInfo = null;

    handleIgcUpload(event) {
        const files = event.target.files;
        if (!files || !files.length) return;

        this._processFiles(files);

        // Permettre de re-sélectionner le même fichier si besoin
        if (event.target && event.target.type === 'file') {
            event.target.value = '';
        }
    }

    // Partagé par la sélection de fichier (handleIgcUpload) et le drag-and-drop sur la
    // zone d'import, pour que les deux voies remplissent le formulaire à l'identique
    // (site géolocalisé inclus) au lieu de dupliquer la logique.
    // Un ou plusieurs fichiers choisis ou déposés : la trace .igc d'abord, puis le .sdf Syride
    // (même vol) qui s'y cale pour le facteur de charge et la température.
    async _processFiles(fileList) {
        const files = Array.from(fileList || []);
        const isSdf = (f) => /\.sdf$/i.test(f.name);
        const trace = files.find((f) => !isSdf(f));
        const sdf = files.find(isSdf);
        if (trace) await this._processIgcFile(trace);
        if (sdf) await this._processSdfFile(sdf);
    }

    async _processSdfFile(file) {
        const filenameLabel = document.getElementById('igc-upload-filename');
        const records = SdfParser.parse(await file.arrayBuffer());
        if (!records) {
            alert(tl('igc.sdfInvalid', { name: file.name }));
            return;
        }
        // Trace de référence : celle qu'on vient d'importer, sinon celle du vol modifié
        let info = this.currentTraceInfo;
        const editId = /** @type {HTMLInputElement} */ (document.getElementById('lb-id-edit'))?.value;
        if (!info && editId) {
            const raw = await LogbookService.getFlightTrace(editId);
            const parsed = raw ? LogbookService.parseIGC(raw) : null;
            if (parsed && parsed.success) info = parsed.data;
        }
        // Sans trace, impossible de vérifier que le .sdf est celui de ce vol : on le refuse
        if (!info) {
            alert(tl('igc.sdfNoTrace'));
            return;
        }
        const offset = SdfParser.alignToTrace(records, info.points);
        if (!SdfParser.matchesTrace(records, info.points, offset)) {
            alert(tl('igc.sdfMismatch'));
            return;
        }
        // Un enregistrement par seconde, à partir du premier point de la trace
        const t0 = info.points[0].timestamp;
        const at = (i) => offset + Math.round((info.points[i].timestamp - t0) / 1000);
        const from = at(info.takeoffIndex || 0);
        const to = at(info.landingIndex ?? info.points.length - 1);
        this.currentSensorStats = { ...SdfParser.summarize(records, from, to), source: 'sdf' };
        // Facteur de charge au largage du treuil (± 5 s autour du point le plus haut)
        const winch = info.analysis && info.analysis.winch;
        if (winch) {
            const release = at((info.takeoffIndex || 0) + winch.releaseIndex);
            const around = SdfParser.summarize(records, release - 5, release + 5);
            if (around) this.currentSensorStats.gRelease = around.gMax;
        }
        if (filenameLabel) {
            filenameLabel.textContent = tl('igc.sdfLoaded', { name: file.name, gMax: this.currentSensorStats.gMax });
        }
    }

    _processIgcFile(file) {
        const filenameLabel = document.getElementById('igc-upload-filename');
        if (filenameLabel) filenameLabel.textContent = tl('igc.fileLoaded', { name: file.name });

        let done;
        const finished = new Promise((resolve) => (done = resolve));
        const reader = new FileReader();
        reader.onerror = () => done();
        reader.onload = async (e) => {
            const text = e.target.result;
            this.currentRawIgc = text;

            const flightStats = LogbookService.parseIGC(text);
            if (flightStats.success) {
                const parsed = flightStats.data;
                this.currentTraceData = parsed.points;
                this._fillFormFromIgc(parsed);

                const siteInput = /** @type {HTMLInputElement} */ (document.getElementById('lb-site'));
                // Le vrai décollage (pas forcément le 1er point : vario allumé au parking,
                // montée à pied…), voir IGCParser.detectTakeoffIndex.
                const takeoff = parsed.points[parsed.takeoffIndex] || parsed.points[0];
                if (siteInput && !siteInput.value.trim()) {
                    // La liste des sites se charge en arrière-plan au démarrage : un import
                    // fait juste après l'ouverture de l'app ne doit pas la trouver vide.
                    await SitesService.ensureSitesLoaded().catch(() => null);
                }
                // Re-vérifié après l'attente : le pilote a pu saisir le lieu entre-temps.
                if (siteInput && !siteInput.value.trim()) {
                    // 1. Un site officiel connu tout près du décollage détecté : on l'utilise
                    // directement, c'est plus fiable et plus utile qu'un nom de ville/lieu-dit.
                    const nearbySites = this.findNearbySites(takeoff.lat, takeoff.lon);
                    if (nearbySites.length > 0) {
                        siteInput.value = nearbySites[0].nom || nearbySites[0].name;
                        this.showSiteChoices(nearbySites);
                    } else {
                        // 2. Sinon, reverse-geocoding vers la ville/lieu-dit le plus proche.
                        siteInput.value = tl('igc.searchingPlace');
                        LogbookService.reverseGeocode(takeoff.lat, takeoff.lon).then((res) => {
                            if (res.success && res.data.city) {
                                siteInput.value = tl('igc.placeFound', { city: res.data.city });
                            } else {
                                if (!res.success) console.error('[Geocoding] Erreur:', res.error);
                                siteInput.value = tl(res.success ? 'igc.placeUnknown' : 'igc.takeoffImported');
                            }
                        });
                    }
                }
                this._setupAltitudeCheck(parsed);
                this.applyLearnedDefaults(); // le site vient peut-être d'être trouvé
                this.currentTraceInfo = parsed;
                // Nouvelle trace : un .sdf d'un autre vol ne s'applique plus
                this.currentSensorStats = null;
                console.log('[IGC] Trace parsée :', parsed.points.length, 'points, durée :', parsed.duration, 'min');
            } else {
                alert(tl('igc.parseError', { error: flightStats.error }));
                this.currentTraceData = null;
                this.currentRawIgc = null;
                this.currentIgcStats = null;
                this.currentTraceInfo = null;
            }
            done();
        };
        reader.readAsText(file);
        return finished;
    }

    // Champs du formulaire déduits de la trace : date du décollage, durée, altitude max
    // (corrigée de `altOffset`), gain et statistiques du vol.
    _fillFormFromIgc(parsed, altOffset = 0) {
        this.currentIgcStats = {
            distanceKm: parsed.distanceKm,
            maxClimbRate: parsed.maxClimbRate,
            maxSpeedKmh: parsed.maxSpeedKmh,
            avgSpeedKmh: parsed.avgSpeedKmh,
            igcStats: parsed.analysis || null,
            ...(parsed.instrument ? { instrument: parsed.instrument } : {}),
        };

        const durationInput = /** @type {HTMLInputElement} */ (document.getElementById('lb-duree'));
        if (durationInput && parsed.duration > 0) {
            durationInput.value = parsed.duration;
        }
        const datetimeInput = /** @type {HTMLInputElement} */ (document.getElementById('lb-datetime'));
        if (datetimeInput && parsed.dateStr) {
            datetimeInput.value = parsed.dateStr;
        }

        const altMaxInput = /** @type {HTMLInputElement} */ (document.getElementById('lb-altMax'));
        if (altMaxInput && parsed.maxAltitude !== null) {
            altMaxInput.value = parsed.maxAltitude + altOffset;
        }
        const gainInput = /** @type {HTMLInputElement} */ (document.getElementById('lb-gain'));
        if (gainInput && parsed.gain !== null) {
            gainInput.value = parsed.gain;
        }

        // Type de vol lu dans la trace (spec 034). Un départ au treuil est un fait : il vaut aussi
        // pour un vol existant dont le type est resté « Plouf » (valeur par défaut). Les autres
        // types ne sont qu'une suggestion, réservée à une nouvelle session dont le pilote n'a pas
        // choisi le type : on ne remplace jamais un choix, ni le type d'un vol enregistré.
        const typeVolInput = /** @type {HTMLSelectElement} */ (document.getElementById('lb-typeVol'));
        const editing = Boolean(/** @type {HTMLInputElement} */ (document.getElementById('lb-id-edit'))?.value);
        const typeVolFree = editing ? typeVolInput?.value === 'Plouf' : !this.touchedFields.has('typeVol');
        const suggestion = classifyFlight(parsed.analysis, parsed.duration);
        if (typeVolInput && suggestion && typeVolFree && (!editing || suggestion.type === 'Treuil')) {
            typeVolInput.value = suggestion.type;
            this.touchedFields.add('typeVol');
            this.learnedFields.set('typeVol', suggestion.reason);
            // Pour un vol existant, la technique enregistrée avec le type par défaut l'était sans
            // doute aussi par défaut : on la réévalue.
            this.applyLearnedDefaults({ force: editing ? ['techDecollage'] : [] });
        }
    }

    // Édition d'un vol : refait les calculs à partir de la trace IGC déjà enregistrée (après
    // une amélioration du parseur, par exemple), sans avoir à ré-importer le fichier. Seul ce
    // qui vient de la trace est recalculé (date, durée, altitudes, stats, site et position du
    // décollage) ; le matériel, le type de vol, l'école, le commentaire et la correction
    // d'altitude sont gardés.
    async recalculateFromTrace() {
        const idField = /** @type {HTMLInputElement} */ (document.getElementById('lb-id-edit'));
        const id = idField ? idField.value : '';
        if (!id) return;
        const raw = await LogbookService.getFlightTrace(id);
        if (!raw) {
            alert(tl('igc.noStoredTrace'));
            return;
        }
        const result = LogbookService.parseIGC(raw);
        if (!result.success) {
            alert(tl('igc.parseError', { error: result.error }));
            return;
        }
        const session = LogbookService.getFlightById(id);
        const offset = this.currentIgcAltOffset ?? (session?.altOffset || 0);
        const parsed = result.data;
        this._fillFormFromIgc(parsed, offset);
        this._setupAltitudeCheck(parsed, offset);

        // Le site vient lui aussi de la trace : position du décollage détecté, et site connu le
        // plus proche. Sans site connu à moins de 500 m, le nom saisi est gardé plutôt que
        // remplacé par un nom de commune.
        const takeoff = parsed.points[parsed.takeoffIndex] || parsed.points[0];
        const coordsInput = /** @type {HTMLInputElement} */ (document.getElementById('lb-coords'));
        if (coordsInput) {
            coordsInput.value = formatCoordinates(takeoff.lat, takeoff.lon);
            this.updateCoordsStatus();
        }
        await SitesService.ensureSitesLoaded().catch(() => null);
        const nearbySites = this.findNearbySites(takeoff.lat, takeoff.lon);
        const siteInput = /** @type {HTMLInputElement} */ (document.getElementById('lb-site'));
        if (siteInput && nearbySites.length > 0) {
            // Le site déjà choisi reste s'il fait partie des candidats ; sinon, le plus proche.
            const names = nearbySites.map((site) => site.nom || site.name);
            if (!names.includes(siteInput.value)) siteInput.value = names[0];
        }
        this.showSiteChoices(nearbySites);

        const filenameLabel = document.getElementById('igc-upload-filename');
        if (filenameLabel) filenameLabel.textContent = tl('igc.recalculated');
    }

    // La correction d'altitude est toujours proposée (optionnelle). Une altitude d'atterrissage
    // négative trahit un vario mal calé : on le signale alors explicitement. Champ vide = on
    // garde les altitudes du vario. `parsed` = trace brute (sans offset) ; existingOffset = la
    // correction déjà enregistrée sur un vol qu'on rouvre en édition.
    _setupAltitudeCheck(parsed, existingOffset = 0) {
        this.currentIgcAltOffset = existingOffset;
        const box = document.getElementById('igc-alt-check');
        const info = document.getElementById('igc-alt-info');
        const input = /** @type {HTMLInputElement} */ (document.getElementById('lb-real-alt'));
        if (!box || !info || !input) return;

        const landing = Math.round(parsed.landingAlt);
        const takeoff = Math.round(parsed.takeoffAlt);
        const suspicious = landing < 0;

        box.style.display = 'block';
        box.style.borderColor = suspicious ? 'var(--accent-orange, #e67e22)' : 'var(--border-light, #ccc)';
        const altitudes = th('igc.altitudes', {
            takeoff: `<strong>${takeoff} m</strong>`,
            landing: `<strong>${landing} m</strong>`,
        });
        info.innerHTML = suspicious
            ? `⚠️ <strong>${tt('igc.suspiciousTitle')}</strong> ${th('igc.suspicious', { altitudes })}`
            : th('igc.normal', { altitudes });
        // Le point de référence (atterro ou décollage) dont l'utilisateur connaît l'altitude réelle
        const radios = /** @type {NodeListOf<HTMLInputElement>} */ (box.querySelectorAll('input[name="lb-alt-ref"]'));
        const refAlt = () =>
            /** @type {HTMLInputElement} */ (box.querySelector('input[name="lb-alt-ref"]:checked')).value === 'takeoff'
                ? takeoff
                : landing;
        radios.forEach((r) => (r.checked = r.value === 'landing'));
        input.value = String(existingOffset ? landing + existingOffset : '');

        input.oninput = () => {
            const real = parseInt(input.value, 10);
            this.currentIgcAltOffset = Number.isNaN(real) ? 0 : real - refAlt();
            const altMaxInput = /** @type {HTMLInputElement} */ (document.getElementById('lb-altMax'));
            if (altMaxInput && parsed.maxAltitude !== null) {
                altMaxInput.value = parsed.maxAltitude + this.currentIgcAltOffset;
            }
        };
        // Changer de référence garde la correction en cours : on réaffiche juste l'altitude
        // corrigée du nouveau point.
        radios.forEach((r) => {
            r.onchange = () => {
                input.value = this.currentIgcAltOffset ? refAlt() + this.currentIgcAltOffset : '';
            };
        });
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
                this.currentRawIgc = null; // reset
            }
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
        this.setChecklistValues('accompagnateur', LogbookViewClass.companionsOf(session));
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

            // Vol déjà enregistré avec sa trace (en mémoire ou dans IndexedDB) : on peut corriger
            // (ou annuler) la correction d'altitude, et tout recalculer depuis la trace.
            LogbookService.getFlightTrace(session.id).then((rawIgc) => {
                const idField = /** @type {HTMLInputElement} */ (document.getElementById('lb-id-edit'));
                if (!rawIgc || !idField || idField.value !== session.id) return; // formulaire refermé entre-temps
                const raw = LogbookService.parseIGC(rawIgc);
                if (!raw.success) return;
                this._setupAltitudeCheck(raw.data, session.altOffset || 0);
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

    async mount(params) {
        await super.mount(params);
        console.log('Mounting LogbookView with params', params);
        try {
            await SitesService.ensureSitesLoaded();
            await LogbookService.whenReady();
            if (this.init) {
                this.init();
            }
            if (this.show) {
                this.show();
            }
        } catch (e) {
            console.error('Erreur de montage de LogbookView', e);
            super.renderErrorState(e.message || tl('history.mountError'), 'logbook-screen');
        }
    }

    async unmount() {
        await super.unmount();
        console.log('Unmounting LogbookView');
        this.closeSessionModal();
        // Le Carnet n'utilise aucune librairie de Chart externe (graphiques générés en HTML pur).
        // Les écouteurs d'événements sont attachés à des éléments du DOM
        // recréés par innerHTML, et sont donc automatiquement garbage collected.
    }
}

const LogbookView = new LogbookViewClass();
export default LogbookView;
