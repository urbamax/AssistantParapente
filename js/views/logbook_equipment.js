/**
 * VIEW - Logbook equipment (Matériel tab)
 * Base class of LogbookView (see logbook.js): inventory, add/edit form, wear alerts and the nav
 * badge. Kept in their own file so logbook.js stays about sessions; behaviour is unchanged.
 */
import LogbookService from '../services/logbook_service.js';
import StorageService from '../services/storage.js';
import {
    DEFAULT_EQUIPMENT_BRANDS,
    DEFAULT_EQUIPMENT_SIZES,
    DEFAULT_EQUIPMENT_COLORS,
} from '../data/equipment_config.js';
import { escapeHTML } from '../core/security.js';
import { formatDuration, formatDateOnly } from '../utils/date_utils.js';
import { toSorted } from '../utils/array_utils.js';
import { t } from '../utils/i18n.js';
import BaseView from '../core/base_view.js';
import { tt, tl } from './logbook_strings.js';

export class LogbookEquipmentBase extends BaseView {
    // Partagé avec le formulaire de session (voile, sellette, techniques de décollage).
    setSelectOrAutre(selectId, autreId, value) {
        const selectEl = /** @type {HTMLSelectElement} */ (document.getElementById(selectId));
        const autreEl = /** @type {HTMLInputElement} */ (document.getElementById(autreId));
        if (!selectEl) return;
        if (!value) {
            selectEl.value = '';
            if (autreEl) {
                autreEl.style.display = 'none';
                autreEl.value = '';
            }
            return;
        }

        // Sélection directe du sentinel "Autre" dans le menu déroulant : toujours révéler le
        // champ libre, même si "Autre" est lui-même une valeur d'option du select (sinon ce
        // branchement matcherait à tort la branche "option connue" juste en dessous et cacherait
        // le champ que l'utilisateur vient justement de demander à faire apparaître).
        if (value === 'Autre') {
            selectEl.value = 'Autre';
            if (autreEl) autreEl.style.display = 'block';
            return;
        }

        const options = Array.from(selectEl.options).map((o) => o.value);
        if (options.includes(value)) {
            selectEl.value = value;
            if (autreEl) {
                autreEl.style.display = 'none';
                autreEl.value = '';
            }
        } else {
            selectEl.value = 'Autre';
            if (autreEl) {
                autreEl.style.display = 'block';
                autreEl.value = value;
            }
        }
    }

    // Petit badge rouge sur l'onglet nav "Carnet" comptant le matériel dont la révision
    // (date ou heures de vol) est due ou approche — réutilise LogbookService.computeEquipmentWear(),
    // qui calcule déjà ces alertes pour l'affichage par carte dans l'onglet Matériel.
    updateEquipmentAlertBadge() {
        const badge = document.getElementById('logbook-nav-badge');
        if (!badge) return;
        const wear = LogbookService.computeEquipmentWear();
        const alertCount = Object.values(wear).filter(
            (s) => s.alerts.dateAlert || s.alerts.hoursAlert || s.alerts.openedAlert,
        ).length;
        if (alertCount > 0) {
            badge.textContent = String(alertCount);
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }

    initEquipment() {
        // Populate dropdowns initially
        this.populateEquipmentDropdowns();

        const eqTypeSelect = /** @type {HTMLSelectElement} */ (document.getElementById('eq-type'));
        const windLimitsDiv = document.getElementById('eq-wind-limits');

        if (eqTypeSelect && windLimitsDiv) {
            eqTypeSelect.addEventListener('change', function (e) {
                windLimitsDiv.style.display =
                    /** @type {HTMLInputElement} */ (e.target).value === 'voile' ? 'flex' : 'none';
            });
            // Initiale state
            windLimitsDiv.style.display = eqTypeSelect.value === 'voile' ? 'flex' : 'none';
        }

        // Setup event listeners for the dropdowns
        const setupAutreListener = (selectId, autreId) => {
            const selectEl = /** @type {HTMLSelectElement} */ (document.getElementById(selectId));
            const autreEl = /** @type {HTMLInputElement} */ (document.getElementById(autreId));
            if (selectEl && autreEl) {
                selectEl.addEventListener('change', () => {
                    autreEl.style.display = selectEl.value === 'Autre' ? 'block' : 'none';
                    if (selectEl.value !== 'Autre') {
                        autreEl.value = '';
                    }
                    this.updateEquipmentNomPreview();
                });
                autreEl.addEventListener('input', () => {
                    this.updateEquipmentNomPreview();
                });
            }
        };

        setupAutreListener('eq-marque', 'eq-marque-autre');
        setupAutreListener('eq-modele', 'eq-modele-autre');
        setupAutreListener('eq-taille', 'eq-taille-autre');
        setupAutreListener('eq-couleur', 'eq-couleur-autre');

        const equipForm = document.getElementById('equip-form');
        if (equipForm) {
            equipForm.onsubmit = (e) => {
                e.preventDefault();

                const idEdit = /** @type {HTMLInputElement} */ (document.getElementById('eq-id-edit')).value;
                const periodicite = parseInt(
                    /** @type {HTMLSelectElement} */ (document.getElementById('eq-periodicite')).value,
                    10,
                );
                const periodiciteHeures = parseInt(
                    /** @type {HTMLSelectElement} */ (document.getElementById('eq-periodicite-heures')).value,
                    10,
                );
                const dateAchat = /** @type {HTMLInputElement} */ (document.getElementById('eq-achat')).value;
                const derniereRevision = /** @type {HTMLInputElement} */ (
                    document.getElementById('eq-derniere-revision')
                ).value;

                const type = /** @type {HTMLSelectElement} */ (document.getElementById('eq-type')).value;

                // Extraire Marque, Modele, Taille, Couleur avec la logique "Autre"
                const getValOrAutre = (selectId, autreId, localStorageKey, defaultList) => {
                    const selectEl = /** @type {HTMLSelectElement} */ (document.getElementById(selectId));
                    if (!selectEl) return '';
                    let value = selectEl.value;
                    if (value === 'Autre') {
                        const inputEl = /** @type {HTMLInputElement} */ (document.getElementById(autreId));
                        const rawVal = inputEl ? inputEl.value.trim() : '';
                        if (rawVal) {
                            value = rawVal;
                            // Enregistrer via StorageService
                            let customVals = StorageService.get(localStorageKey) || [];
                            if (!Array.isArray(customVals)) customVals = [];
                            if (!customVals.includes(value) && !defaultList.includes(value)) {
                                customVals.push(value);
                                StorageService.set(localStorageKey, customVals);
                            }
                        } else {
                            value = '';
                        }
                    }
                    return value;
                };

                const marque = getValOrAutre('eq-marque', 'eq-marque-autre', 'customEquipMarques', [
                    'Advance',
                    'BGD',
                    'Gin',
                    'Niviuk',
                    'Ozone',
                    'Phi',
                    'Nova',
                    'Supair',
                    'Skywalk',
                    'Triple Seven',
                    'AirDesign',
                    'Flow',
                ]);
                const modele = getValOrAutre('eq-modele', 'eq-modele-autre', 'customEquipModeles', []);
                const taille = getValOrAutre('eq-taille', 'eq-taille-autre', 'customEquipTailles', [
                    'XS',
                    'S',
                    'M',
                    'ML',
                    'L',
                    'XL',
                ]);
                const couleur = getValOrAutre('eq-couleur', 'eq-couleur-autre', 'customEquipCouleurs', [
                    'Rouge',
                    'Bleu',
                    'Vert',
                    'Jaune',
                    'Orange',
                    'Blanc',
                    'Noir',
                    'Gris',
                    'Violet',
                    'Rose',
                ]);

                const equipDataObj = {
                    nom:
                        /** @type {HTMLInputElement} */ (document.getElementById('eq-nom')).value.trim() ||
                        `${marque} ${modele}`.trim(),
                    marque: marque,
                    modele: modele,
                    taille: taille,
                    couleur: couleur,
                    type: type,
                    dateAchat: dateAchat,
                    derniereRevision: derniereRevision,
                    periodicite: periodicite,
                    periodiciteHeures: periodiciteHeures,
                    statut: 'actif',
                };

                if (type === 'voile') {
                    equipDataObj.ventMin =
                        parseInt(/** @type {HTMLInputElement} */ (document.getElementById('eq-vent-min')).value, 10) ||
                        0;
                    equipDataObj.ventMax =
                        parseInt(/** @type {HTMLInputElement} */ (document.getElementById('eq-vent-max')).value, 10) ||
                        25;
                } else if (type === 'sellette') {
                    const linkedRescueSelect = /** @type {HTMLSelectElement} */ (
                        document.getElementById('eq-linked-rescue')
                    );
                    if (linkedRescueSelect) equipDataObj.linkedRescueId = linkedRescueSelect.value || null;
                }

                if (idEdit) {
                    LogbookService.updateEquipment(idEdit, equipDataObj);
                } else {
                    LogbookService.addEquipment(equipDataObj);
                }

                // Réinitialisation du formulaire
                this.resetEquipmentForm();

                // Rafraîchissement dynamique de l'interface
                this.renderEquipment();
                this.populateEquipmentDropdowns();
            };
        }
    }

    loadEquipmentData() {
        LogbookService.getEquipment(); // Initialized via Service
    }

    saveEquipmentData() {
        LogbookService.saveEquipment();
    }

    populateEquipmentDropdowns() {
        const getUniqueValues = (field) => {
            const vals = new Set();
            if (Array.isArray(LogbookService.getEquipment())) {
                LogbookService.getEquipment().forEach((e) => {
                    if (e[field]) vals.add(e[field].trim());
                });
            }
            return Array.from(vals);
        };

        const populateSelect = (selectId, defaultList, storedKey, uniqueValues) => {
            const selectEl = document.getElementById(selectId);
            if (!selectEl) return;

            let customVals = StorageService.get(storedKey) || [];
            if (!Array.isArray(customVals)) customVals = [];

            const allValsSet = new Set([...defaultList, ...customVals, ...uniqueValues]);
            const sortedVals = toSorted(Array.from(allValsSet).filter(Boolean), (a, b) =>
                a.localeCompare(b, 'fr', { sensitivity: 'base' }),
            );

            // Save back to storage
            const newCustomVals = sortedVals.filter((v) => !defaultList.includes(v));
            StorageService.set(storedKey, newCustomVals);

            let html = `<option value="">${tt('form.chooseOrType')}</option>`;
            sortedVals.forEach((val) => {
                html += `<option value="${escapeHTML(val)}">${escapeHTML(val)}</option>`;
            });
            html += `<option value="Autre">${tt('form.other')}</option>`;
            selectEl.innerHTML = html;
        };

        populateSelect('eq-marque', DEFAULT_EQUIPMENT_BRANDS, 'customEquipMarques', getUniqueValues('marque'));
        populateSelect('eq-modele', [], 'customEquipModeles', getUniqueValues('modele'));
        populateSelect('eq-taille', DEFAULT_EQUIPMENT_SIZES, 'customEquipTailles', getUniqueValues('taille'));
        populateSelect('eq-couleur', DEFAULT_EQUIPMENT_COLORS, 'customEquipCouleurs', getUniqueValues('couleur'));

        const eqLinkedRescue = document.getElementById('eq-linked-rescue');
        if (eqLinkedRescue) {
            let rescueHtml = `<option value="">${tt('form.noneOrNotApplicable')}</option>`;
            LogbookService.getEquipment()
                .filter((e) => e.type === 'secours' && e.statut !== 'archive')
                .forEach((equip) => {
                    rescueHtml += `<option value="${escapeHTML(equip.id)}">${escapeHTML(equip.nom)}</option>`;
                });
            eqLinkedRescue.innerHTML = rescueHtml;
        }
    }

    updateEquipmentNomPreview() {
        const marqueEl = document.getElementById('eq-marque');
        const modeleEl = document.getElementById('eq-modele');
        const tailleEl = document.getElementById('eq-taille');
        const couleurEl = document.getElementById('eq-couleur');
        const nomEl = /** @type {HTMLInputElement} */ (document.getElementById('eq-nom'));

        if (!nomEl) return;

        const getVal = (selectEl, autreId) => {
            if (!selectEl) return '';
            if (selectEl.value === 'Autre') {
                const autreEl = /** @type {HTMLInputElement} */ (document.getElementById(autreId));
                return autreEl ? autreEl.value.trim() : '';
            }
            return selectEl.value;
        };

        const marque = getVal(marqueEl, 'eq-marque-autre');
        const modele = getVal(modeleEl, 'eq-modele-autre');
        const taille = getVal(tailleEl, 'eq-taille-autre');
        const couleur = getVal(couleurEl, 'eq-couleur-autre');

        let generatedNom = '';
        if (marque) generatedNom += marque;
        if (modele) generatedNom += (generatedNom ? ' | ' : '') + modele;
        if (couleur) generatedNom += (generatedNom ? ' | ' : '') + couleur;
        if (taille) generatedNom += (generatedNom ? ' | ' : '') + taille;

        nomEl.value = generatedNom.toUpperCase();
    }

    renderEquipment() {
        const container = document.getElementById('logbook-equip-container');
        if (!container) return;

        // Sort immutably (ES2023): actifs first, then by date added
        const sortedEquip = toSorted(LogbookService.getEquipment(), (a, b) => {
            if (a.statut === 'actif' && b.statut !== 'actif') return -1;
            if (a.statut !== 'actif' && b.statut === 'actif') return 1;
            return 0; // maintain original insertion order if same status
        });

        const equipStats = LogbookService.computeEquipmentWear();

        let html = `<h3 class="stats-section-title">${tt('equipment.inventory')}</h3>`;

        if (sortedEquip.length === 0) {
            html += `<div class="empty-state"><p>${tt('equipment.empty')}</p></div>`;
        } else {
            html += `<div class="equip-list">`;
            sortedEquip.forEach((equip) => {
                try {
                    const stats = equipStats[(equip.nom || '').toLowerCase()];

                    let alertHtml = '';
                    let statusClass = 'status-ok';

                    // Logique des alertes combinées
                    if (stats?.alerts.openedAlert) {
                        statusClass = 'status-danger';
                        alertHtml = `<div class="equip-alert text-danger" style="color:#ef4444; font-weight:bold; margin-bottom:8px;"><i class="ri-umbrella-line"></i> ${tt('equipment.rescueOpened', { date: formatDateOnly(stats.lastOpening) })}</div>`;
                    } else if (stats && (stats.alerts.dateAlert === 'red' || stats.alerts.hoursAlert === 'red')) {
                        statusClass = 'status-danger';
                        const reason = [];
                        if (stats.alerts.dateAlert === 'red')
                            reason.push(tl('equipment.dateOverdue', { date: formatDateOnly(stats.revisionDateStr) }));
                        if (stats.alerts.hoursAlert === 'red')
                            reason.push(
                                tl('equipment.hoursOverdue', {
                                    used: Math.round(stats.totalTime / 60),
                                    period: equip.periodiciteHeures,
                                }),
                            );

                        alertHtml = `<div class="equip-alert text-danger" style="color:#ef4444; font-weight:bold; margin-bottom:8px;"><i class="ri-tools-line"></i> ${tt('equipment.revisionRequired', { reasons: reason.join(tl('equipment.and')) })}</div>`;
                    } else if (stats && (stats.alerts.dateAlert === 'orange' || stats.alerts.hoursAlert === 'orange')) {
                        statusClass = 'status-warning';
                        const reason = [];
                        if (stats.alerts.dateAlert === 'orange')
                            reason.push(tl('equipment.inDays', { days: stats.diffDays }));
                        if (stats.alerts.hoursAlert === 'orange')
                            reason.push(tl('equipment.inHours', { hours: Math.round(stats.hoursRemaining) }));

                        alertHtml = `<div class="equip-alert text-warning" style="color:#f59e0b; font-weight:bold; margin-bottom:8px;"><i class="ri-tools-line"></i> ${tt('equipment.revisionSoon', { reasons: reason.join(tl('equipment.or')) })}</div>`;
                    }

                    const typeBadgeColors = {
                        voile: 'background: rgba(14, 165, 233, 0.1); color: var(--accent-blue);',
                        sellette: 'background: rgba(245, 158, 11, 0.1); color: #f59e0b;',
                        secours: 'background: rgba(239, 68, 68, 0.1); color: #ef4444;',
                        accessoire: 'background: rgba(156, 163, 175, 0.1); color: #9ca3af;',
                    };

                    const isArchive = equip.statut === 'archive';
                    const cardStyle = isArchive ? 'opacity: 0.6; filter: grayscale(0.8);' : '';

                    html += `
                    <div class="equip-card ${statusClass}" style="${cardStyle} border:1px solid #eee; padding:15px; border-radius:8px; margin-bottom:15px; background:var(--bg-card); display:flex; flex-direction:column; justify-content:space-between; min-height:160px;">
                        ${alertHtml}
                        <div>
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                                <div class="equip-name" style="font-size:1.1rem; font-weight:600;">
                                    ${escapeHTML(equip.nom)}
                                    <span class="session-badge" style="margin-left: 8px; font-size:0.75rem; padding:2px 6px; border-radius:4px; ${typeBadgeColors[equip.type] || ''}">${(equip.type || '').toUpperCase()}</span>
                                    ${isArchive ? `<span class="session-badge" style="margin-left: 4px; background: #333; color: white; font-size:0.75rem; padding:2px 6px; border-radius:4px;">${tt('equipment.archived')}</span>` : ''}
                                </div>
                            </div>
                            ${
                                equip.type === 'secours'
                                    ? `
                            <div class="session-details" style="font-size: 0.85rem; display:flex; gap:15px; margin-bottom: 6px;">
                                <span class="detail-item"><i class="ri-umbrella-line"></i> ${tt('equipment.openings', { count: stats ? stats.openings : 0 })}</span>
                            </div>
                            `
                                    : `
                            <div class="session-details" style="font-size: 0.85rem; display:flex; gap:15px; margin-bottom: 6px;">
                                <span class="detail-item"><i class="ri-windy-line"></i> ${tt('equipment.sessions', { count: stats ? stats.totalSessions : 0 })}</span>
                                <span class="detail-item"><i class="ri-time-line"></i> ${stats ? formatDuration(stats.totalTime) : '0h 00m'}</span>
                            </div>
                            `
                            }
                            <div class="equipment-secondary-details" style="font-size: 0.8rem; opacity: 0.8; display:flex; gap:15px; flex-wrap:wrap; margin-bottom: 12px;">
                                ${equip.dateAchat ? `<span class="detail-item"><strong>${tt('equipment.purchase')}</strong> ${formatDateOnly(equip.dateAchat)}</span>` : ''}
                                ${equip.derniereRevision ? `<span class="detail-item"><strong>${tt(equip.type === 'secours' ? 'equipment.lastRepacking' : 'equipment.lastRevision')}</strong> ${formatDateOnly(equip.derniereRevision)}</span>` : ''}
                                ${stats && stats.nextRevisionDate ? `<span class="detail-item"><strong>${tt(equip.type === 'secours' ? 'equipment.nextRepacking' : 'equipment.nextRevision')}</strong> ${formatDateOnly(stats.revisionDateStr)}</span>` : ''}
                                ${equip.type !== 'secours' && stats && stats.hoursRemaining !== null ? `<span class="detail-item"><strong>${tt('equipment.hoursBeforeRevision')}</strong> ${stats.hoursRemaining <= 0 ? `<span style="color:#ef4444; font-weight:bold;">${tt('equipment.overdueBy', { hours: Math.abs(Math.round(stats.hoursRemaining * 10) / 10) })}</span>` : tt('equipment.hours', { hours: Math.round(stats.hoursRemaining * 10) / 10 })} ${tt('equipment.ofPeriod', { period: equip.periodiciteHeures })}</span>` : ''}
                                ${equip.type === 'voile' && equip.ventMin !== undefined ? `<span class="detail-item"><strong>${tt('equipment.windRange')}</strong> ${tt('equipment.windRangeValue', { min: equip.ventMin, max: equip.ventMax })}</span>` : ''}
                            </div>
                        </div>
                        <div style="display:flex; justify-content:flex-end; gap:12px; border-top:1px solid rgba(0,0,0,0.05); padding-top:8px; margin-top: auto;">
                            <button class="action-btn" data-action="editEquipment" data-args="'${equip.id}'" title="${tt('equipment.edit')}" style="background:none; border:none; cursor:pointer; font-size:1rem; color:var(--accent-blue);">
                                ✏️
                            </button>
                            <button class="action-btn" data-action="toggleEquipmentStatus" data-args="'${equip.id}'" title="${tt(isArchive ? 'equipment.unarchive' : 'equipment.archive')}" style="background:none; border:none; cursor:pointer; font-size:1rem; color:#6b7280;">
                                <i class="${isArchive ? 'ri-arrow-go-back-line' : 'ri-archive-line'}"></i>
                            </button>
                            <button class="action-btn" data-action="deleteEquipment" data-args="'${equip.id}'" title="${tt('equipment.deleteForever')}" style="background:none; border:none; cursor:pointer; font-size:1rem; color:#ef4444;">
                                🗑️
                            </button>
                        </div>
                    </div>
                `;
                } catch (err) {
                    // Même logique que renderHistory() : un équipement corrompu ne doit pas
                    // faire disparaître tout l'inventaire.
                    console.warn('[LogbookView] Équipement illisible ignoré lors du rendu :', equip?.id, err);
                }
            });
            html += `</div>`;
        }

        container.innerHTML = html;
    }

    editEquipment(id) {
        const equip = LogbookService.getEquipmentById(id);
        if (!equip) return;

        /** @type {HTMLInputElement} */ (document.getElementById('eq-id-edit')).value = equip.id;
        /** @type {HTMLInputElement} */ (document.getElementById('eq-nom')).value = equip.nom || '';

        // Populate and set dropdowns for brand, model, size, color
        this.populateEquipmentDropdowns();
        this.setSelectOrAutre('eq-marque', 'eq-marque-autre', equip.marque || '');
        this.setSelectOrAutre('eq-modele', 'eq-modele-autre', equip.modele || '');
        this.setSelectOrAutre('eq-taille', 'eq-taille-autre', equip.taille || '');
        this.setSelectOrAutre('eq-couleur', 'eq-couleur-autre', equip.couleur || '');

        const typeSelect = /** @type {HTMLSelectElement} */ (document.getElementById('eq-type'));
        typeSelect.value = equip.type || 'voile';

        const windLimitsDiv = document.getElementById('eq-wind-limits');
        if (windLimitsDiv) {
            windLimitsDiv.style.display = typeSelect.value === 'voile' ? 'flex' : 'none';
        }

        const linkedRescueDiv = document.getElementById('eq-linked-rescue-group');
        if (linkedRescueDiv) {
            linkedRescueDiv.style.display = typeSelect.value === 'sellette' ? 'block' : 'none';
        }
        this.updateEquipmentLabels(typeSelect.value);

        const linkedRescueSelect = /** @type {HTMLSelectElement} */ (document.getElementById('eq-linked-rescue'));
        if (linkedRescueSelect) {
            linkedRescueSelect.value = equip.linkedRescueId || '';
        }

        const minField = /** @type {HTMLInputElement} */ (document.getElementById('eq-vent-min'));
        if (minField) minField.value = equip.ventMin !== undefined ? equip.ventMin : 0;

        const maxField = /** @type {HTMLInputElement} */ (document.getElementById('eq-vent-max'));
        if (maxField) maxField.value = equip.ventMax !== undefined ? equip.ventMax : 25;

        /** @type {HTMLInputElement} */ (document.getElementById('eq-achat')).value = equip.dateAchat || '';
        /** @type {HTMLInputElement} */ (document.getElementById('eq-derniere-revision')).value =
            equip.derniereRevision || '';

        const periodiciteSelect = /** @type {HTMLSelectElement} */ (document.getElementById('eq-periodicite'));
        if (equip.periodicite !== undefined) {
            periodiciteSelect.value = equip.periodicite;
        } else {
            periodiciteSelect.value = '24'; // Default
        }

        const periodiciteHeuresSelect = /** @type {HTMLSelectElement} */ (
            document.getElementById('eq-periodicite-heures')
        );
        if (periodiciteHeuresSelect) {
            if (equip.periodiciteHeures !== undefined) {
                periodiciteHeuresSelect.value = equip.periodiciteHeures;
            } else {
                periodiciteHeuresSelect.value = '0'; // Default non applicable
            }
        }

        document.getElementById('eq-submit-btn').innerText = tl('equipment.submitEdit');
        document.getElementById('eq-cancel-btn').style.display = 'inline-block';
        document.getElementById('eq-form-title').innerText = tl('equipment.titleEdit');

        // Scroll vers le formulaire
        document.getElementById('equip-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    deleteEquipment(id) {
        if (confirm(tl('equipment.deleteConfirm'))) {
            LogbookService.deleteEquipment(id);
            this.renderEquipment();
            this.populateEquipmentDropdowns();
        }
    }

    updateEquipmentLabels(type) {
        const revLabel = /** @type {HTMLElement|null} */ (document.querySelector('label[for="eq-derniere-revision"]'));
        if (revLabel) {
            revLabel.innerText = t(
                type === 'secours' ? 'html.logbookScreen.dernierPliage' : 'html.logbookScreen.derniereRevision',
            );
        }
    }

    resetEquipmentForm() {
        const form = /** @type {HTMLFormElement} */ (document.getElementById('equip-form'));
        if (form) form.reset();

        // Hide all "Autre" text inputs
        ['eq-marque-autre', 'eq-modele-autre', 'eq-taille-autre', 'eq-couleur-autre'].forEach((id) => {
            const el = /** @type {HTMLInputElement} */ (document.getElementById(id));
            if (el) {
                el.style.display = 'none';
                el.value = '';
            }
        });

        const windLimitsDiv = document.getElementById('eq-wind-limits');
        if (windLimitsDiv) windLimitsDiv.style.display = 'flex'; // Default type is 'voile'
        this.updateEquipmentLabels('voile');

        const idEditField = /** @type {HTMLInputElement} */ (document.getElementById('eq-id-edit'));
        if (idEditField) idEditField.value = '';

        const submitBtn = document.getElementById('eq-submit-btn');
        if (submitBtn) submitBtn.innerText = tl('equipment.submitAdd');

        const cancelBtn = document.getElementById('eq-cancel-btn');
        if (cancelBtn) cancelBtn.style.display = 'none';

        const formTitle = document.getElementById('eq-form-title');
        if (formTitle) formTitle.innerText = tl('equipment.titleAdd');

        // Refresh dropdown lists
        this.populateEquipmentDropdowns();
    }

    toggleEquipmentStatus(id) {
        LogbookService.toggleEquipmentStatus(id);
        this.renderEquipment();
    }
}
