/**
 * VIEW/CONTROLLER - LogbookView
 * Wrapped from logbook_engine.js
 */
import LogbookService from '../services/logbook_service.js';
import StorageService from '../services/storage.js'; // Retained just for custom select lists
import SitesService from '../services/sites_service.js';
import { parseCoordinates } from '../utils/geo_utils.js';

import GlobalState from '../core/app_state.js';
import { tl } from './logbook_strings.js';
import { LogbookFormBase } from './logbook_form.js';

class LogbookViewClass extends LogbookFormBase {
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
                // Heure ou durée corrigée à la main : « Recalculer depuis la trace » la garde
                if (target.id === 'lb-datetime' || target.id === 'lb-duree')
                    LogbookView.manualTimeFields.add(target.id);
                // Trace commencée en vol : la durée réelle donne le décollage (atterrissage - durée)
                if (target.id === 'lb-duree') LogbookView.setTakeoffFromDuration();
                if (target.id === 'lb-vario-in-flight' || target.id === 'lb-vario-off-in-flight') {
                    LogbookView.manualTimeFields.add(target.id);
                    LogbookView.setTakeoffFromDuration();
                }
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

            // Stage choisi dans la liste déroulante : ses détails sont repris tout de suite, sans
            // attendre que le champ perde le focus
            container.addEventListener('input', (e) => {
                const target = /** @type {HTMLInputElement} */ (e.target);
                if (target.id !== 'lb-stage-nom') return;
                const picked = !(e instanceof InputEvent) || e.inputType === 'insertReplacementText';
                if (picked) LogbookView.onLearnedFieldChanged('stage');
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

    // --- SESSION EN ÉCOLE ---

    // --- LISTES À COCHER EXTENSIBLES (exercices, pilotes) ---
    // La liste proposée = valeurs par défaut + toutes celles déjà enregistrées dans le carnet :
    // une valeur ajoutée à la main sur une session est donc reproposée sur les suivantes.

    // --- COORDONNÉES GPS D'UN LIEU SAISI À LA MAIN (spec 011) ---

    // --- PRÉ-REMPLISSAGE APPRIS DU PILOTE (PilotHabits) ---
    // Pour une nouvelle session, l'app propose ce que le pilote fait d'habitude dans la même
    // situation : type de vol et technique du site, matériel utilisé là (sinon le dernier),
    // école récente, lieu de gonflage habituel. Un champ que le pilote modifie n'est plus
    // jamais remplacé ; une session existante n'est jamais modifiée.

    async mount(params) {
        await super.mount(params);
        this.expandedSessionIds.clear();
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
