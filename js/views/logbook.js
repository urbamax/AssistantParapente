/**
 * VIEW/CONTROLLER - LogbookView
 * Wrapped from logbook_engine.js
 */
import LogbookService from '../services/logbook_service.js';
import Map3DComponent from '../components/map_3d.js';
import StorageService from '../services/storage.js'; // Retained just for custom select lists
import SitesService from '../services/sites_service.js';
import { EXTENDED_WIND_DIRECTIONS } from '../data/weather_config.js';
import {
    DEFAULT_EQUIPMENT_BRANDS,
    DEFAULT_EQUIPMENT_SIZES,
    DEFAULT_EQUIPMENT_COLORS,
} from '../data/equipment_config.js';
import { escapeHTML } from '../core/security.js';
import { formatDuration, formatDateOnly, formatDateTime, addMinutesToDatetimeLocal } from '../utils/date_utils.js';
import { capitalizeFirstLetter } from '../utils/text_utils.js';
import { toSorted } from '../utils/array_utils.js';
import { getSpotairWidgetId } from '../data/spotair_widgets.js';
import { parseCoordinates, formatCoordinates } from '../utils/geo_utils.js';
import { t } from '../utils/i18n.js';

import BaseView from '../core/base_view.js';

// Textes du carnet (spec 014), tous dans js/i18n/fr.js (section logbook). tt() : texte pour du HTML,
// paramètres échappés ; th() : un paramètre est un fragment HTML construit ici (nombres en gras) ;
// tl() : texte brut (innerText, champs, boîtes de dialogue).
const fillParams = (text, params, format) =>
    text.replace(/\{(\w+)\}/g, (match, name) =>
        Object.prototype.hasOwnProperty.call(params, name) ? format(params[name]) : match,
    );
const tt = (key, params = {}) =>
    fillParams(escapeHTML(t(`logbook.${key}`)), params, (value) => escapeHTML(String(value)));
const th = (key, htmlParams) => fillParams(escapeHTML(t(`logbook.${key}`)), htmlParams, String);
const tl = (key, params) => t(`logbook.${key}`, params);

class LogbookViewClass extends BaseView {
    constructor() {
        super();
        this.currentTab = 'history';
        this.currentFormType = 'vol';
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
                } else if (target.id === 'lb-ecole-check') {
                    LogbookView.setSchoolField(target.checked);
                } else if (target.id === 'lb-voile' || target.id === 'lb-sellette') {
                    LogbookView.setSelectOrAutre(target.id, target.id + '-autre', target.value);
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
                }
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

    // Petit badge rouge sur l'onglet nav "Carnet" comptant le matériel dont la révision
    // (date ou heures de vol) est due ou approche — réutilise LogbookService.computeEquipmentWear(),
    // qui calcule déjà ces alertes pour l'affichage par carte dans l'onglet Matériel.
    updateEquipmentAlertBadge() {
        const badge = document.getElementById('logbook-nav-badge');
        if (!badge) return;
        const wear = LogbookService.computeEquipmentWear();
        const alertCount = Object.values(wear).filter((s) => s.alerts.dateAlert || s.alerts.hoursAlert).length;
        if (alertCount > 0) {
            badge.textContent = String(alertCount);
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }

    normalizeString(str) {
        if (!str) return '';
        return str
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '');
    }

    // Découpe en mots significatifs (≥3 chars) après nettoyage des accents/ponctuation
    normalizeWords(str) {
        if (!str) return [];
        return str
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter((w) => w.length >= 3);
    }

    // Recherche le meilleur site par correspondance de mots-clés
    findSiteByName(siteName) {
        if (!siteName) return null;
        const inputWords = this.normalizeWords(siteName);
        if (inputWords.length === 0) return null;

        let bestMatch = null;
        let bestScore = 0;
        SitesService.getSites().forEach((s) => {
            const siteWords = this.normalizeWords(s.nom || s.name || '');
            const score = inputWords.filter((w) => siteWords.some((sw) => sw.includes(w) || w.includes(sw))).length;
            if (score > bestScore) {
                bestScore = score;
                bestMatch = s;
            }
        });
        return bestScore >= 1 ? bestMatch : null;
    }

    // Extrait lat/lon depuis un site, compatible ancien (lat/lon) et nouveau (latitude/longitude) format
    getSiteCoords(site) {
        if (!site) return { lat: null, lon: null };
        return {
            lat: site.latitude ?? site.lat ?? null,
            lon: site.longitude ?? site.lon ?? null,
        };
    }

    // Distance en km entre deux points (formule de Haversine)
    haversineDistanceKm(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const toRad = (deg) => (deg * Math.PI) / 180;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    // Site officiel le plus proche d'un point GPS (ex: décollage détecté depuis une trace
    // IGC), dans un rayon raisonnable. Retourne null si aucun site officiel n'est assez proche.
    // Types de sites d'où l'on décolle. Un site uniquement ATTERRO, KITE, GONFLAGE, INTERDIT…
    // ne doit jamais être proposé comme lieu d'un vol importé.
    static TAKEOFF_SITE_TYPES = ['NATUREL', 'TREUIL', 'SOARING', 'THERMIQUE', 'DUNE', 'PENTE-ÉCOLE', 'MARCHE ET VOL'];

    isTakeoffSite(site) {
        if (!site || site.affiche === false) return false;
        const types = Array.isArray(site.type) ? site.type : [site.type];
        return types.some((t) => LogbookViewClass.TAKEOFF_SITE_TYPES.includes(t));
    }

    findNearestSite(lat, lon, maxDistanceKm = 2) {
        if (lat === null || lon === null) return null;

        let nearest = null;
        let nearestDist = Infinity;
        SitesService.getSites().forEach((site) => {
            if (!this.isTakeoffSite(site)) return;
            const coords = this.getSiteCoords(site);
            if (coords.lat === null || coords.lon === null) return;
            const dist = this.haversineDistanceKm(lat, lon, coords.lat, coords.lon);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearest = site;
            }
        });
        return nearest && nearestDist <= maxDistanceKm ? nearest : null;
    }

    show() {
        this.switchTab(this.currentTab);
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

    switchTab(tabName) {
        this.currentTab = tabName;

        // Update Buttons
        document.querySelectorAll('.logbook-tab-btn').forEach((btn) => {
            btn.classList.remove('active');
        });
        const activeBtn = Array.from(document.querySelectorAll('.logbook-tab-btn')).find(
            (btn) =>
                (btn.getAttribute('data-args') || '').includes(tabName) || btn.getAttribute('data-tab') === tabName,
        );
        if (activeBtn) activeBtn.classList.add('active');

        // Update Content
        document.querySelectorAll('.logbook-tab-content').forEach((content) => {
            content.classList.remove('active');
        });
        const activeContent = document.getElementById(`logbook-tab-${tabName}`);
        if (activeContent) activeContent.classList.add('active');

        // Trigger Render
        if (tabName === 'history') {
            this.renderHistory();
        } else if (tabName === 'add') {
            this.renderForm();
        } else if (tabName === 'stats') {
            this.renderStats();
        } else if (tabName === 'equip') {
            this.renderEquipment();
        }
        this.updateEquipmentAlertBadge();
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

        const coordsText = /** @type {HTMLInputElement} */ (document.getElementById('lb-coords'))?.value || '';
        const coordsPanelOpen = document.getElementById('lb-coords-panel')?.hidden === false;

        const submitText = document.getElementById('lb-submit-btn')?.innerText || tl('form.save');
        const cancelBtnVisible = document.getElementById('lb-cancel-btn')?.style.display || 'none';

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

        if (coordsText) {
            const el = /** @type {HTMLInputElement} */ (document.getElementById('lb-coords'));
            if (el) el.value = coordsText;
        }
        this.updateCoordsStatus();
        if (coordsPanelOpen) this.toggleCoordsPicker();

        // Restaurer l'état des boutons de soumission / annulation (pour l'édition)
        const submitBtn = document.getElementById('lb-submit-btn');
        if (submitBtn) submitBtn.innerText = submitText;
        const cancelBtn = document.getElementById('lb-cancel-btn');
        if (cancelBtn) cancelBtn.style.display = cancelBtnVisible;
    }

    // --- SESSION EN ÉCOLE ---

    renderSchoolBlock() {
        return `
                <div class="form-group">
                    <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                        <input type="checkbox" id="lb-ecole-check" aria-controls="lb-ecole-group"> ${tt('form.schoolSession')}
                    </label>
                    <div id="lb-ecole-group" hidden style="margin-top: 6px;">
                        <label for="lb-ecole">${tt('form.schoolName')} <span class="required">*</span></label>
                        <input type="text" id="lb-ecole" list="ecoles-list" placeholder="${tt('form.schoolPlaceholder')}" autocomplete="off" style="width: 100%;">
                        <datalist id="ecoles-list"></datalist>
                    </div>
                </div>`;
    }

    // Le nom de l'école n'est demandé (et obligatoire) que si la case est cochée.
    setSchoolField(checked, name = '') {
        const check = /** @type {HTMLInputElement} */ (document.getElementById('lb-ecole-check'));
        const group = document.getElementById('lb-ecole-group');
        const input = /** @type {HTMLInputElement} */ (document.getElementById('lb-ecole'));
        if (!check || !group || !input) return;
        check.checked = checked;
        group.hidden = !checked;
        input.required = checked;
        if (name) input.value = name;
        if (checked && !name) input.focus();
    }

    // --- COORDONNÉES GPS D'UN LIEU SAISI À LA MAIN (spec 011) ---

    renderCoordsBlock() {
        return `
                    <div class="lb-coords-block" style="margin-top: 6px;">
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 0.82rem;">
                            <button type="button" data-action="toggleCoordsPicker" aria-expanded="false" aria-controls="lb-coords-panel" style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border: 1px solid var(--border-light, #ccc); border-radius: var(--radius-sm); background: none; color: var(--accent-blue); cursor: pointer; font-size: 0.82rem;">
                                <i class="ri-map-pin-line" aria-hidden="true"></i> <span id="lb-coords-toggle-label">${escapeHTML(t('logbook.coords.open'))}</span>
                            </button>
                            <span id="lb-coords-status" style="color: var(--text-muted);"></span>
                        </div>
                        <div id="lb-coords-panel" hidden style="margin-top: 8px;">
                            <label for="lb-coords">${escapeHTML(t('logbook.coords.label'))}</label>
                            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                                <input type="text" id="lb-coords" autocomplete="off" spellcheck="false" placeholder="${escapeHTML(t('logbook.coords.placeholder'))}" aria-describedby="lb-coords-hint lb-coords-error" style="flex: 1 1 14rem; min-width: 0;">
                                <button type="button" data-action="clearCoords" style="padding: 4px 10px; border: 1px solid var(--border-light, #ccc); border-radius: var(--radius-sm); background: none; color: var(--text-secondary); cursor: pointer; font-size: 0.82rem; white-space: nowrap;">${escapeHTML(t('logbook.coords.clear'))}</button>
                            </div>
                            <small id="lb-coords-hint" style="display: block; margin-top: 4px; color: var(--text-muted);">${escapeHTML(t('logbook.coords.hint'))}</small>
                            <div id="lb-coords-error" role="alert" hidden style="margin-top: 4px; color: #ef4444; font-size: 0.82rem;">${escapeHTML(t('logbook.coords.invalid'))}</div>
                            <div id="lb-coords-map" aria-label="${escapeHTML(t('logbook.coords.mapLabel'))}" style="height: 280px; margin-top: 8px; border-radius: 8px; border: 1px solid var(--border-light, #ccc);"></div>
                        </div>
                    </div>`;
    }

    getPlaceName() {
        const el = /** @type {HTMLInputElement} */ (
            document.getElementById(this.currentFormType === 'vol' ? 'lb-site' : 'lb-lieu')
        );
        return el ? el.value.trim() : '';
    }

    // Site de la base rapproché du lieu saisi (recherche approximative par mots), s'il y en a un.
    getKnownSiteCoords() {
        const name = this.getPlaceName();
        if (!name) return null;
        const site = this.findSiteByName(name);
        const coords = this.getSiteCoords(site);
        return Number.isFinite(Number(coords.lat)) && Number.isFinite(Number(coords.lon)) && coords.lat && coords.lon
            ? { name: site.nom || site.name || '', lat: Number(coords.lat), lon: Number(coords.lon) }
            : null;
    }

    updateCoordsStatus() {
        const status = document.getElementById('lb-coords-status');
        const input = /** @type {HTMLInputElement} */ (document.getElementById('lb-coords'));
        if (!status || !input) return;
        const coords = parseCoordinates(input.value);
        let text = '';
        if (coords) {
            const formatted = formatCoordinates(coords.lat, coords.lon);
            text =
                this.coordsAutoFilled === input.value
                    ? t('logbook.coords.statusFromHistory', { coords: formatted })
                    : t('logbook.coords.statusChosen', { coords: formatted });
        } else if (!input.value.trim() && this.getPlaceName()) {
            const known = this.getKnownSiteCoords();
            text = known
                ? t('logbook.coords.statusKnownSite', { name: known.name })
                : t('logbook.coords.statusMissing');
        }
        status.textContent = text;
    }

    // Lieu modifié : un lieu déjà utilisé reprend les coordonnées de sa dernière session. Elles passent
    // avant la base des sites, dont la recherche par mots peut rapprocher « Equihen terrain » d'un autre site.
    onPlaceChanged() {
        const input = /** @type {HTMLInputElement} */ (document.getElementById('lb-coords'));
        if (!input) return;
        if (this.coordsAutoFilled && input.value === this.coordsAutoFilled) {
            input.value = '';
            this.coordsAutoFilled = null;
        }
        if (!input.value.trim()) {
            const previous = LogbookService.findLastCoordsForPlace(this.getPlaceName());
            if (previous) {
                input.value = formatCoordinates(previous.lat, previous.lon);
                this.coordsAutoFilled = input.value;
            }
        }
        this.updateCoordsStatus();
        this.placeCoordsPin(true);
    }

    onCoordsTyped() {
        this.coordsAutoFilled = null;
        const input = /** @type {HTMLInputElement} */ (document.getElementById('lb-coords'));
        if (input && (!input.value.trim() || parseCoordinates(input.value))) this.hideCoordsError();
        this.updateCoordsStatus();
        this.placeCoordsPin(true);
    }

    showCoordsError() {
        const panel = document.getElementById('lb-coords-panel');
        if (panel && panel.hidden) this.toggleCoordsPicker();
        const error = document.getElementById('lb-coords-error');
        if (error) error.hidden = false;
        document.getElementById('lb-coords')?.focus();
    }

    hideCoordsError() {
        const error = document.getElementById('lb-coords-error');
        if (error) error.hidden = true;
    }

    toggleCoordsPicker() {
        const panel = document.getElementById('lb-coords-panel');
        const button = document.querySelector('[data-action="toggleCoordsPicker"]');
        const label = document.getElementById('lb-coords-toggle-label');
        if (!panel) return;
        panel.hidden = !panel.hidden;
        if (button) button.setAttribute('aria-expanded', String(!panel.hidden));
        if (label) label.textContent = t(panel.hidden ? 'logbook.coords.open' : 'logbook.coords.close');
        if (!panel.hidden) this.ensureCoordsMap();
    }

    clearCoords() {
        const input = /** @type {HTMLInputElement} */ (document.getElementById('lb-coords'));
        if (input) input.value = '';
        this.coordsAutoFilled = null;
        this.hideCoordsError();
        if (this.coordsMarker) {
            this.coordsMarker.remove();
            this.coordsMarker = null;
        }
        this.updateCoordsStatus();
    }

    // Carte créée seulement à l'ouverture : aucun fond de carte n'est demandé avant (spec 009).
    ensureCoordsMap() {
        const mapEl = document.getElementById('lb-coords-map');
        if (!mapEl) return;
        if (this.coordsMap) {
            this.coordsMap.invalidateSize();
            return;
        }
        if (typeof L === 'undefined') {
            mapEl.textContent = t('logbook.coords.mapUnavailable');
            return;
        }
        const esri = (service, maxNativeZoom) =>
            L.tileLayer(`https://server.arcgisonline.com/ArcGIS/rest/services/${service}/MapServer/tile/{z}/{y}/{x}`, {
                attribution: 'Tiles &copy; Esri',
                // CORS : réponses lisibles, donc gardées pour le hors-ligne par le service worker (spec 008).
                crossOrigin: true,
                maxZoom: 19,
                maxNativeZoom,
            });
        const satellite = esri('World_Imagery', 18);
        const topo = esri('World_Topo_Map', 16);

        this.coordsMap = L.map(mapEl, { layers: [satellite] });
        L.control
            .layers({ [t('logbook.coords.layerSatellite')]: satellite, [t('logbook.coords.layerTopo')]: topo })
            .addTo(this.coordsMap);
        this.coordsMap.on('click', (e) => this.setPickedCoords(e.latlng.lat, e.latlng.lng));

        const input = /** @type {HTMLInputElement} */ (document.getElementById('lb-coords'));
        const chosen = parseCoordinates(input ? input.value : '');
        const known = this.getKnownSiteCoords();
        if (chosen) this.coordsMap.setView([chosen.lat, chosen.lon], 16);
        else if (known) this.coordsMap.setView([known.lat, known.lon], 14);
        else this.coordsMap.setView([46.6, 2.4], 5);
        this.placeCoordsPin(false);
    }

    setPickedCoords(lat, lon) {
        const input = /** @type {HTMLInputElement} */ (document.getElementById('lb-coords'));
        if (!input) return;
        input.value = formatCoordinates(lat, lon);
        this.coordsAutoFilled = null;
        this.hideCoordsError();
        this.updateCoordsStatus();
        this.placeCoordsPin(false);
    }

    // Place (ou retire) le repère selon le champ texte ; recentre la carte si demandé.
    placeCoordsPin(recenter) {
        if (!this.coordsMap) return;
        const input = /** @type {HTMLInputElement} */ (document.getElementById('lb-coords'));
        const coords = parseCoordinates(input ? input.value : '');
        if (!coords) {
            if (this.coordsMarker && input && !input.value.trim()) {
                this.coordsMarker.remove();
                this.coordsMarker = null;
            }
            return;
        }
        const latLng = [coords.lat, coords.lon];
        if (!this.coordsMarker) {
            this.coordsMarker = L.marker(latLng, {
                draggable: true,
                icon: L.divIcon({
                    className: 'lb-coords-pin',
                    html: '<i class="ri-map-pin-fill" aria-hidden="true" style="font-size: 32px; line-height: 1; color: #ef4444; text-shadow: 0 1px 3px rgba(0,0,0,0.5);"></i>',
                    iconSize: [32, 32],
                    iconAnchor: [16, 32],
                }),
            }).addTo(this.coordsMap);
            this.coordsMarker.on('dragend', () => {
                const pos = this.coordsMarker.getLatLng();
                this.setPickedCoords(pos.lat, pos.lng);
            });
        } else {
            this.coordsMarker.setLatLng(latLng);
        }
        if (recenter) this.coordsMap.setView(latLng, Math.max(this.coordsMap.getZoom(), 14));
    }

    releaseCoordsMap() {
        if (this.coordsMap) this.coordsMap.remove();
        this.coordsMap = null;
        this.coordsMarker = null;
        this.coordsAutoFilled = null;
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
                ${this.renderSchoolBlock()}
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
                        <div id="lb-typeExercice-group" style="display:flex; flex-direction:column; gap:6px; margin-top:8px;">
                            <label><input type="checkbox" name="lb-typeExercice" value="Face voile"> ${tt('form.exerciseTypes.Face voile')}</label>
                            <label><input type="checkbox" name="lb-typeExercice" value="Dos voile"> ${tt('form.exerciseTypes.Dos voile')}</label>
                            <label><input type="checkbox" name="lb-typeExercice" value="Tangage/Roulis"> ${tt('form.exerciseTypes.Tangage/Roulis')}</label>
                            <label><input type="checkbox" name="lb-typeExercice" value="Affalage"> ${tt('form.exerciseTypes.Affalage')}</label>
                            <label><input type="checkbox" name="lb-typeExercice" value="Vent fort"> ${tt('form.exerciseTypes.Vent fort')}</label>
                            <label><input type="checkbox" name="lb-typeExercice" value="Prégonflage / Démêlage"> ${tt('form.exerciseTypes.Prégonflage / Démêlage')}</label>
                        </div>
                    </div>
                </div>
                ${this.renderSchoolBlock()}
                <div class="form-group">
                    <label>${tt('form.comment')}</label>
                    <textarea id="lb-commentaire" rows="3" placeholder="${tt('form.commentPlaceholderGround')}"></textarea>
                </div>
            `;
        }

        this.releaseCoordsMap();
        container.innerHTML = html;
        this.populateDropdowns();
        this.fillLastEquipment();
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
                    const file = e.dataTransfer.files[0];
                    if (!file) return;
                    this._processIgcFile(file);
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

            // 3. Dédoublonnage et tri alphabétique immuable (ES2023)
            const processedSites = toSorted(Array.from(new Set(allSites)), (a, b) =>
                a.localeCompare(b, 'fr', { sensitivity: 'base' }),
            );

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

        let voilesHtml = `<option value="">${tt('form.select')}</option>`;
        let sellettesHtml = `<option value="">${tt('form.select')}</option>`;

        LogbookService.getEquipment()
            .filter((e) => e.statut !== 'archive')
            .forEach((equip) => {
                if (equip.type === 'voile') {
                    voilesHtml += `<option value="${escapeHTML(equip.nom)}">${escapeHTML(equip.nom)}</option>`;
                } else if (equip.type === 'sellette') {
                    sellettesHtml += `<option value="${escapeHTML(equip.nom)}">${escapeHTML(equip.nom)}</option>`;
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
    }

    fillLastEquipment() {
        // Automatically fill voile and sellette with the last used ones
        if (LogbookService.getFlights().length > 0) {
            const lastSession = LogbookService.getFlights()[0];
            const voileInput = /** @type {HTMLSelectElement} */ (document.getElementById('lb-voile'));
            const selletteInput = /** @type {HTMLSelectElement} */ (document.getElementById('lb-sellette'));
            if (voileInput && lastSession.voile) voileInput.value = lastSession.voile;
            if (selletteInput && lastSession.sellette) selletteInput.value = lastSession.sellette;
        }
    }

    currentTraceData = null;
    currentRawIgc = null;
    currentIgcStats = null;
    // null = correction d'altitude non touchée dans ce formulaire (on ne réécrit pas altOffset)
    currentIgcAltOffset = null;

    handleIgcUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        this._processIgcFile(file);

        // Permettre de re-sélectionner le même fichier si besoin
        if (event.target && event.target.type === 'file') {
            event.target.value = '';
        }
    }

    // Partagé par la sélection de fichier (handleIgcUpload) et le drag-and-drop sur la
    // zone d'import, pour que les deux voies remplissent le formulaire à l'identique
    // (site géolocalisé inclus) au lieu de dupliquer la logique.
    _processIgcFile(file) {
        const filenameLabel = document.getElementById('igc-upload-filename');
        if (filenameLabel) filenameLabel.textContent = tl('igc.fileLoaded', { name: file.name });

        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target.result;
            this.currentRawIgc = text;

            const flightStats = LogbookService.parseIGC(text);
            if (flightStats.success) {
                const parsed = flightStats.data;
                this.currentTraceData = parsed.points;
                this.currentIgcStats = {
                    distanceKm: parsed.distanceKm,
                    maxClimbRate: parsed.maxClimbRate,
                    maxSpeedKmh: parsed.maxSpeedKmh,
                    avgSpeedKmh: parsed.avgSpeedKmh,
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
                    altMaxInput.value = parsed.maxAltitude;
                }
                const gainInput = /** @type {HTMLInputElement} */ (document.getElementById('lb-gain'));
                if (gainInput && parsed.gain !== null) {
                    gainInput.value = parsed.gain;
                }

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
                    const nearestSite = this.findNearestSite(takeoff.lat, takeoff.lon);
                    if (nearestSite) {
                        siteInput.value = nearestSite.nom || nearestSite.name;
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
                console.log('[IGC] Trace parsée :', parsed.points.length, 'points, durée :', parsed.duration, 'min');
            } else {
                alert(tl('igc.parseError', { error: flightStats.error }));
                this.currentTraceData = null;
                this.currentRawIgc = null;
                this.currentIgcStats = null;
            }
        };
        reader.readAsText(file);
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

        this.resetForm();
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
        const cancelBtn = document.getElementById('lb-cancel-btn');
        if (cancelBtn) cancelBtn.style.display = 'none';
        this.currentTraceData = null;
        this.currentIgcStats = null;
        this.currentIgcAltOffset = null;
        const filenameLabel = document.getElementById('igc-upload-filename');
        if (filenameLabel) filenameLabel.textContent = tl('form.igcHint');
        this.renderForm();
    }

    editEntry(id) {
        const session = LogbookService.getFlightById(id);
        if (!session) return;

        this.currentFormType = session.type;

        // Change la vue en premier pour générer les champs HTML
        this.switchTab('add');

        // Populate common fields
        /** @type {HTMLInputElement} */ (document.getElementById('lb-id-edit')).value = session.id;
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

        /** @type {HTMLInputElement} */ (document.getElementById('lb-duree')).value = session.duree;
        /** @type {HTMLTextAreaElement} */ (document.getElementById('lb-commentaire')).value =
            session.commentaire || '';
        if (session.ecole) this.setSchoolField(true, session.ecole);

        // Populate specific fields
        if (session.type === 'vol') {
            /** @type {HTMLInputElement} */ (document.getElementById('lb-site')).value = session.site || '';
            /** @type {HTMLSelectElement} */ (document.getElementById('lb-typeVol')).value = session.typeVol || 'Plouf';

            setSelectOrAutre('lb-tech-decollage', 'lb-tech-decollage-autre', session.techDecollage);

            if (session.altitudeMax)
                /** @type {HTMLInputElement} */ (document.getElementById('lb-altMax')).value = session.altitudeMax;
            if (session.gain) /** @type {HTMLInputElement} */ (document.getElementById('lb-gain')).value = session.gain;

            // Vol déjà enregistré : on peut corriger (ou annuler) l'altitude d'une trace ajoutée avant
            if (session.rawIgc) {
                const raw = LogbookService.parseIGC(session.rawIgc);
                if (raw.success) this._setupAltitudeCheck(raw.data, session.altOffset || 0);
            }

            if (session.traceGps && session.traceGps.length > 0) {
                const filenameLabel = document.getElementById('igc-upload-filename');
                if (filenameLabel) filenameLabel.textContent = tl('igc.existingTrace');
            }
        } else {
            /** @type {HTMLInputElement} */ (document.getElementById('lb-lieu')).value = session.lieu || '';
            if (session.typeExercice) {
                const checkboxes = /** @type {NodeListOf<HTMLInputElement>} */ (
                    document.querySelectorAll('input[name="lb-typeExercice"]')
                );
                const typesArray = Array.isArray(session.typeExercice) ? session.typeExercice : [session.typeExercice];
                checkboxes.forEach((cb) => {
                    cb.checked = typesArray.includes(cb.value);
                });
            }
        }

        const coordsInput = /** @type {HTMLInputElement} */ (document.getElementById('lb-coords'));
        if (coordsInput && Number.isFinite(session.lat) && Number.isFinite(session.lon)) {
            coordsInput.value = formatCoordinates(session.lat, session.lon);
        }
        this.updateCoordsStatus();

        // Update UI buttons
        const submitBtn = document.getElementById('lb-submit-btn');
        if (submitBtn) submitBtn.innerText = tl('form.update');
        const cancelBtn = document.getElementById('lb-cancel-btn');
        if (cancelBtn) cancelBtn.style.display = 'inline-block';

        const formEl = document.getElementById('logbook-add-form');
        if (formEl) formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    deleteEntry(id) {
        if (confirm(tl('history.deleteConfirm'))) {
            LogbookService.deleteFlight(id);
            this.renderHistory();
        }
    }

    // Bloc météo d'une carte de l'historique (données AROME + graphe de balise).
    renderSessionWeatherHtml(session) {
        if (session.meteo) {
            // Une séance de gonflage n'a ni décollage ni atterrissage : on parle de début et de fin.
            const isVol = session.type === 'vol';

            let startLabel = isVol ? 'weather.rowTakeoff' : 'weather.rowStart';
            if (session.meteoAtterroSame) {
                startLabel = isVol ? 'weather.rowTakeoffLanding' : 'weather.rowStartEnd';
            }

            const decollageRow = this.renderWeatherPointRow(session.meteo, t(startLabel));
            const atterroRow = session.meteoAtterro
                ? this.renderWeatherPointRow(session.meteoAtterro, t(isVol ? 'weather.rowLanding' : 'weather.rowEnd'))
                : '';
            const baliseHtml = this.renderBaliseHistoBlock(session);

            return `
            <div class="logbook-card-weather" style="margin-top: 10px; padding: 10px; background: rgba(14,165,233,0.06); border-radius: var(--radius-sm); border: 1px solid rgba(14,165,233,0.15); font-size: 0.85rem; color: var(--text-secondary);">
                ${decollageRow}
                ${atterroRow}
                <button data-action="forceWeatherRefresh" data-args="${session.id}" title="${tt('weather.refreshTitle')}" style="margin-top: 6px; color: var(--text-muted); cursor: pointer; border: none; background: none; padding: 2px 4px; font-size: 0.78rem; display: inline-flex; align-items: center; gap: 4px;">
                    <i class="ri-refresh-line"></i> ${tt('weather.refresh')}
                </button>
            </div>
            ${baliseHtml}`;
        } else {
            return `
            <div id="weather-container-${session.id}" class="logbook-card-weather-empty" style="margin-top: 10px; font-size: 0.85rem;">
                <button id="refresh-weather-btn-${session.id}" class="action-btn-text" data-action="forceWeatherRefresh" data-args="${session.id}" style="color: var(--text-muted); cursor: pointer; border: none; background: rgba(0,0,0,0.03); border-radius: var(--radius-sm); padding: 6px 12px; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s;">
                    <i class="ri-refresh-line"></i> ${tt('weather.fetch')}
                </button>
            </div>`;
        }
    }

    // Met à jour le seul bloc météo d'une carte, sans reconstruire la liste : reconstruire
    // l'historique ferme la trace GPS ouverte et détruit sa carte 3D (position, lecture).
    refreshSessionWeather(sessionId) {
        const session = LogbookService.getFlightById(sessionId);
        const slot = [
            .../** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('[data-session-weather]')),
        ].find((el) => el.dataset.sessionWeather === String(sessionId));
        if (session && slot) slot.innerHTML = this.renderSessionWeatherHtml(session);
    }

    renderHistory() {
        const container = document.getElementById('logbook-history-list');
        if (!container) return;

        if (LogbookService.getFlights().length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="ri-history-line"></i>
                    <p>${tt('history.empty')}</p>
                    <button class="action-btn-primary" data-action="switchTab" data-args="'add'">${tt('history.addSession')}</button>
                </div>
            `;
            return;
        }

        let html = '';
        LogbookService.getFlights().forEach((session) => {
            try {
                const isVol = session.type === 'vol';
                const icon = isVol ? 'ri-windy-line' : 'ri-footprint-line';
                const typeColor = isVol ? 'var(--accent-blue)' : '#f59e0b';
                const location = isVol ? session.site : session.lieu;
                // Repli sur '' : un enregistrement corrompu/partiel (import JSON manuel, ancien
                // format, fusion cloud incomplète) sans typeVol/typeExercice ferait planter tout le
                // carnet ici (.toLowerCase() sur undefined un peu plus bas), au lieu de sauter
                // juste cette carte.
                const subtitle =
                    (isVol
                        ? session.typeVol
                        : Array.isArray(session.typeExercice)
                          ? session.typeExercice.join(', ')
                          : session.typeExercice) || '';

                let extraInfo = '';
                if (isVol) {
                    const badgeStyle =
                        'background: var(--bg-card-hover, rgba(0,0,0,0.05)); padding: 4px 8px; border-radius: 6px; border: 1px solid var(--border-light, rgba(0,0,0,0.05)); font-weight: 500; display: inline-flex; align-items: center; gap: 4px;';
                    const decoInfo = session.techDecollage
                        ? `<span style="${badgeStyle}" title="${tt('history.takeoffTitle')}"><i class="ri-takeaway-line"></i> ${tt('history.takeoff', { technique: session.techDecollage })}</span>`
                        : '';
                    const altInfo = session.altitudeMax
                        ? `<span style="${badgeStyle}" title="${tt('history.altMaxTitle')}">${tt('history.altMax', { value: session.altitudeMax })}</span>`
                        : '';
                    const gainInfo =
                        session.gain !== undefined && session.gain !== null && session.gain !== ''
                            ? `<span style="${badgeStyle}" title="${tt('history.gainTitle')}">${tt('history.gain', { value: session.gain })}</span>`
                            : '';
                    const distanceInfo = session.distanceKm
                        ? `<span style="${badgeStyle}" title="${tt('history.distanceTitle')}">${tt('history.distance', { value: session.distanceKm })}</span>`
                        : '';
                    const climbInfo = session.maxClimbRate
                        ? `<span style="${badgeStyle}" title="${tt('history.climbTitle')}">${tt('history.climb', { value: session.maxClimbRate })}</span>`
                        : '';
                    const speedInfo = session.maxSpeedKmh
                        ? `<span style="${badgeStyle}" title="${tt('history.speedTitle')}">${tt('history.speed', { max: session.maxSpeedKmh, avg: session.avgSpeedKmh })}</span>`
                        : '';

                    if (decoInfo || altInfo || gainInfo || distanceInfo || climbInfo || speedInfo) {
                        extraInfo = `<div class="session-extra-info" style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; font-size: 0.82rem; color: var(--text-secondary);">
                        ${decoInfo}
                        ${altInfo}
                        ${gainInfo}
                        ${distanceInfo}
                        ${climbInfo}
                        ${speedInfo}
                    </div>`;
                    }
                }

                const meteoHtml = this.renderSessionWeatherHtml(session);

                html += `
                <div class="logbook-card">
                    <div class="logbook-card-header">
                        <div class="session-badge" style="background-color: ${typeColor}22; color: ${typeColor};">
                            <i class="${icon}"></i> ${tt(isVol ? 'history.badgeFlight' : 'history.badgeGround')}
                        </div>
                        <div class="session-date">${formatDateTime(session.datetime)}</div>
                        <div style="display: flex; gap: 8px;">
                            <button class="edit-btn" data-action="editEntry" data-args="${session.id}" title="${tt('history.edit')}" style="background: none; border: none; color: var(--text-secondary); cursor: pointer; padding: 4px; border-radius: 4px; transition: all 0.2s;">
                                <i class="ri-edit-line"></i>
                            </button>
                            <button class="delete-btn" data-action="deleteEntry" data-args="${session.id}" title="${tt('history.delete')}" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 4px; border-radius: 4px; transition: all 0.2s;">
                                <i class="ri-delete-bin-line"></i>
                            </button>
                        </div>
                    </div>
                    <div class="logbook-card-body">
                        <div class="session-location">${escapeHTML(location)}</div>
                        <div class="session-details">
                            <span class="detail-item"><i class="ri-time-line"></i> ${formatDuration(session.duree)}</span>
                            <span class="detail-item"><i class="${subtitle.toLowerCase().includes('thermique') ? 'ri-fire-line' : subtitle.toLowerCase().includes('cross') ? 'ri-route-line' : subtitle.toLowerCase().includes('plouf') ? 'ri-arrow-left-down-line' : subtitle.toLowerCase().includes('restit') || subtitle.toLowerCase().includes('soaring') ? 'ri-sun-cloud-line' : subtitle.toLowerCase().includes('gonflage') ? 'ri-footprint-line' : 'ri-price-tag-3-line'}"></i> ${escapeHTML(subtitle)}</span>
                        </div>
                        ${extraInfo}
                        <div class="session-equip">
                            ${session.voile ? `<div><strong>${tt('history.wing')}</strong> ${escapeHTML(session.voile)}</div>` : ''}
                            ${session.sellette ? `<div><strong>${tt('history.harness')}</strong> ${escapeHTML(session.sellette)}</div>` : ''}
                            ${session.ecole ? `<div><strong>${tt('history.school')}</strong> ${escapeHTML(session.ecole)}</div>` : ''}
                        </div>
                        ${session.commentaire ? `<div class="session-comment">"${escapeHTML(session.commentaire)}"</div>` : ''}
                        ${session.rawIgc || (session.traceGps && session.traceGps.length > 0) ? `<button class="btn-view-trace action-btn-secondary" style="margin-top: 10px; width: 100%; border: 1px solid var(--accent-blue); color: var(--accent-blue); padding: 8px; border-radius: 6px; cursor: pointer; background: transparent; transition: all 0.2s;" data-action="showTrace" data-args="${session.id}"><i class="ri-route-line"></i> ${tt('history.showTrace')}</button><div id="trace-container-${session.id}" style="display:none; margin-top: 10px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border-light);"></div>` : ''}
                        <div data-session-weather="${session.id}">${meteoHtml}</div>
                    </div>
                </div>
            `;
            } catch (err) {
                // Un enregistrement corrompu/partiel ne doit plus faire disparaître tout le
                // carnet (cf. bugs .toLowerCase() sur un champ manquant) : on saute cette carte
                // et on continue le rendu des autres vols.
                console.warn('[LogbookView] Vol illisible ignoré lors du rendu :', session?.id, err);
            }
        });

        container.innerHTML = html;
    }

    async showTrace(sessionId) {
        const container = document.getElementById(`trace-container-${sessionId}`);
        if (!container) return;

        if (container.style.display === 'block') {
            container.style.display = 'none';
            Map3DComponent.clearPlayback();
            return;
        }

        const session = LogbookService.getFlightById(sessionId);
        if (!session) return;

        let rawIgc = session.rawIgc;
        if (!rawIgc && (!session.traceGps || session.traceGps.length === 0)) {
            rawIgc = await LogbookService.getFlightTrace(sessionId);
        }
        if (!rawIgc && (!session.traceGps || session.traceGps.length === 0)) return;

        let points = session.traceGps;
        if (rawIgc) {
            const result = LogbookService.parseIGC(rawIgc, session.altOffset || 0);
            if (result.success && result.data.points) {
                points = result.data.points;
            } else {
                console.error('Erreur de parsing IGC à la volée :', result.error);
                return;
            }
        }

        container.style.display = 'block';

        try {
            await Map3DComponent.showTrace(sessionId, points, container);
        } catch (error) {
            console.error('Map3DComponent Error: Erreur lors du dessin de la trace.', error);
            container.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-secondary);">${tt('history.trace3dError', { error: error.message })}</div>`;
        }
    }

    renderStats() {
        const container = document.getElementById('logbook-stats-container');
        if (!container) return;

        if (LogbookService.getFlights().length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>${tt('stats.empty')}</p>
                </div>
            `;
            return;
        }

        // Calculations
        let totalVols = 0;
        let totalTimeVols = 0;
        let totalGonflages = 0;
        let totalTimeGonflages = 0;

        const equipStats = {}; // { voileName: { vols: 0, timeVols: 0, gonflages: 0, timeGonflages: 0 } }
        const sitesStats = {}; // { siteName: count }
        const volTypes = {}; // { typeName: count }
        const exoTypes = {}; // { typeName: count }
        const decoTypes = {}; // { typeName: count }
        const schoolStats = {}; // { schoolName: { vols: 0, timeVols: 0, gonflages: 0, timeGonflages: 0 } }

        let maxAltitudeReached = 0;
        let totalGain = 0;

        LogbookService.getFlights().forEach((s) => {
            if (s.type === 'vol') {
                totalVols++;
                totalTimeVols += s.duree;

                // Location
                sitesStats[s.site] = (sitesStats[s.site] || 0) + 1;
                // Type
                volTypes[s.typeVol] = (volTypes[s.typeVol] || 0) + 1;
                // Deco
                if (s.techDecollage) {
                    decoTypes[s.techDecollage] = (decoTypes[s.techDecollage] || 0) + 1;
                }
                // Stats globales
                if (s.altitudeMax && s.altitudeMax > maxAltitudeReached) {
                    maxAltitudeReached = s.altitudeMax;
                }
                if (s.gain && s.gain > 0) {
                    totalGain += s.gain;
                }
            } else {
                totalGonflages++;
                totalTimeGonflages += s.duree;

                // Location
                sitesStats[s.lieu] = (sitesStats[s.lieu] || 0) + 1;
                // Type
                if (s.typeExercice) {
                    if (Array.isArray(s.typeExercice)) {
                        s.typeExercice.forEach((exo) => {
                            exoTypes[exo] = (exoTypes[exo] || 0) + 1;
                        });
                    } else {
                        exoTypes[s.typeExercice] = (exoTypes[s.typeExercice] || 0) + 1;
                    }
                }
            }

            // Sessions encadrées par une école
            const school = typeof s.ecole === 'string' ? s.ecole.trim() : '';
            if (school) {
                if (!schoolStats[school]) {
                    schoolStats[school] = { vols: 0, timeVols: 0, gonflages: 0, timeGonflages: 0 };
                }
                if (s.type === 'vol') {
                    schoolStats[school].vols++;
                    schoolStats[school].timeVols += s.duree;
                } else {
                    schoolStats[school].gonflages++;
                    schoolStats[school].timeGonflages += s.duree;
                }
            }

            // Equipment (Grouping by Voile)
            const equipKey = s.voile;
            if (equipKey) {
                if (!equipStats[equipKey]) {
                    equipStats[equipKey] = { vols: 0, timeVols: 0, gonflages: 0, timeGonflages: 0 };
                }
                if (s.type === 'vol') {
                    equipStats[equipKey].vols++;
                    equipStats[equipKey].timeVols += s.duree;
                } else {
                    equipStats[equipKey].gonflages++;
                    equipStats[equipKey].timeGonflages += s.duree;
                }
            }
        });

        // Top Sites (ES2023 toSorted)
        const topSites = toSorted(Object.entries(sitesStats), (a, b) => b[1] - a[1]).slice(0, 5);

        // Building HTML
        let html = `
            <div class="stats-grid">
                <!-- KPI: Vols -->
                <div class="kpi-card">
                    <div class="kpi-icon" style="background: var(--accent-blue); color: white;"><i class="ri-windy-line"></i></div>
                    <div class="kpi-info">
                        <div class="kpi-value">${tt('stats.flights', { count: totalVols })}</div>
                        <div class="kpi-label">${tt('stats.flightTime', { duration: formatDuration(totalTimeVols) })}</div>
                    </div>
                </div>
                <!-- KPI: Gonflages -->
                <div class="kpi-card">
                    <div class="kpi-icon" style="background: #f59e0b; color: white;"><i class="ri-footprint-line"></i></div>
                    <div class="kpi-info">
                        <div class="kpi-value">${tt('stats.groundSessions', { count: totalGonflages })}</div>
                        <div class="kpi-label">${tt('stats.groundTime', { duration: formatDuration(totalTimeGonflages) })}</div>
                    </div>
                </div>
                <!-- KPI: Alt Max -->
                <div class="kpi-card">
                    <div class="kpi-icon" style="background: #8b5cf6; color: white;"><i class="ri-mist-line"></i></div>
                    <div class="kpi-info">
                        <div class="kpi-value">${maxAltitudeReached} m</div>
                        <div class="kpi-label">${tt('stats.maxAltitude')}</div>
                    </div>
                </div>
                <!-- KPI: Gain -->
                <div class="kpi-card">
                    <div class="kpi-icon" style="background: #10b981; color: white;"><i class="ri-arrow-up-line"></i></div>
                    <div class="kpi-info">
                        <div class="kpi-value">${totalGain} m</div>
                        <div class="kpi-label">${tt('stats.totalGain')}</div>
                    </div>
                </div>
            </div>
        `;

        // Equipment Stats
        if (Object.keys(equipStats).length > 0) {
            html += `<h3 class="stats-section-title">${tt('stats.wings')}</h3><div class="equip-list">`;
            for (const [voile, st] of Object.entries(equipStats)) {
                html += `
                    <div class="equip-card">
                        <div class="equip-name">${escapeHTML(voile)}</div>
                        <div class="equip-details">
                            <span style="color: var(--accent-blue)">${tt('stats.wingFlights', { count: st.vols, duration: formatDuration(st.timeVols) })}</span>
                            <span style="color: #f59e0b">${tt('stats.wingGround', { count: st.gonflages, duration: formatDuration(st.timeGonflages) })}</span>
                        </div>
                        ${(() => {
                            const equipObj = LogbookService.getEquipment().find(
                                (e) => (e.nom || '').toLowerCase() === voile.toLowerCase(),
                            );
                            if (equipObj && equipObj.periodiciteHeures > 0) {
                                const totalHours = (st.timeVols + st.timeGonflages) / 60;
                                const hoursRemaining = equipObj.periodiciteHeures - totalHours;
                                const hoursText =
                                    hoursRemaining <= 0
                                        ? `<span style="color:#ef4444; font-weight:bold;">${tt('equipment.overdueBy', { hours: Math.abs(Math.round(hoursRemaining * 10) / 10) })}</span>`
                                        : tt('stats.hoursLeft', { hours: Math.round(hoursRemaining * 10) / 10 });
                                return `<div style="font-size: 0.8rem; margin-top: 6px; color: var(--text-secondary);"><strong>${tt('stats.beforeRevision')}</strong> ${hoursText} ${tt('equipment.ofPeriod', { period: equipObj.periodiciteHeures })}</div>`;
                            }
                            return '';
                        })()}
                    </div>
                `;
            }
            html += `</div>`;
        }

        // Top Sites Bar Chart
        if (topSites.length > 0) {
            html += `<h3 class="stats-section-title">${tt('stats.topPlaces')}</h3><div class="chart-container">`;
            const maxVal = topSites[0][1];
            topSites.forEach(([site, count]) => {
                const percent = (count / maxVal) * 100;
                html += `
                    <div class="bar-row">
                        <div class="bar-label">${escapeHTML(site)}</div>
                        <div class="bar-track">
                            <div class="bar-fill" style="width: ${percent}%; background: var(--accent-green)"></div>
                        </div>
                        <div class="bar-value">${count}</div>
                    </div>
                `;
            });
            html += `</div>`;
        }

        // Sessions en école, de la plus fréquentée à la moins fréquentée
        const schools = toSorted(
            Object.entries(schoolStats),
            (a, b) => b[1].vols + b[1].gonflages - (a[1].vols + a[1].gonflages),
        );
        if (schools.length > 0) {
            const schoolSessions = schools.reduce((sum, [, st]) => sum + st.vols + st.gonflages, 0);
            html += `<h3 class="stats-section-title">${tt('stats.schools')}</h3>
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0 0 8px;">${tt('stats.schoolShare', { count: schoolSessions, total: totalVols + totalGonflages })}</p>
                <div class="equip-list">`;
            for (const [school, st] of schools) {
                html += `
                    <div class="equip-card">
                        <div class="equip-name">${escapeHTML(school)}</div>
                        <div class="equip-details">
                            <span style="color: var(--accent-blue)">${tt('stats.wingFlights', { count: st.vols, duration: formatDuration(st.timeVols) })}</span>
                            <span style="color: #f59e0b">${tt('stats.wingGround', { count: st.gonflages, duration: formatDuration(st.timeGonflages) })}</span>
                        </div>
                    </div>
                `;
            }
            html += `</div>`;
        }

        // Types de Vol
        if (Object.keys(volTypes).length > 0) {
            html += `<h3 class="stats-section-title">${tt('stats.flightTypes')}</h3><div class="chart-container">`;
            for (const [type, count] of Object.entries(volTypes)) {
                const percent = (count / totalVols) * 100;
                html += `
                    <div class="bar-row">
                        <div class="bar-label">${escapeHTML(type)}</div>
                        <div class="bar-track">
                            <div class="bar-fill" style="width: ${percent}%; background: var(--accent-blue)"></div>
                        </div>
                        <div class="bar-value">${count} (${Math.round(percent)}%)</div>
                    </div>
                `;
            }
            html += `</div>`;
        }

        // Techniques de déco
        if (Object.keys(decoTypes).length > 0) {
            html += `<h3 class="stats-section-title">${tt('stats.takeoffTechniques')}</h3><div class="chart-container">`;
            const totalDeco = Object.values(decoTypes).reduce((a, b) => a + b, 0);
            for (const [type, count] of Object.entries(decoTypes)) {
                const percent = (count / totalDeco) * 100;
                html += `
                    <div class="bar-row">
                        <div class="bar-label" title="${escapeHTML(type)}" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHTML(type)}</div>
                        <div class="bar-track">
                            <div class="bar-fill" style="width: ${percent}%; background: #8b5cf6"></div>
                        </div>
                        <div class="bar-value">${count} (${Math.round(percent)}%)</div>
                    </div>
                `;
            }
            html += `</div>`;
        }

        // Types Exercice
        if (Object.keys(exoTypes).length > 0) {
            html += `<h3 class="stats-section-title">${tt('stats.groundExercises')}</h3><div class="chart-container">`;
            for (const [type, count] of Object.entries(exoTypes)) {
                const percent = (count / totalGonflages) * 100;
                html += `
                    <div class="bar-row">
                        <div class="bar-label">${escapeHTML(type)}</div>
                        <div class="bar-track">
                            <div class="bar-fill" style="width: ${percent}%; background: #f59e0b"></div>
                        </div>
                        <div class="bar-value">${count} (${Math.round(percent)}%)</div>
                    </div>
                `;
            }
            html += `</div>`;
        }

        container.innerHTML = html;
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
                    if (stats && (stats.alerts.dateAlert === 'red' || stats.alerts.hoursAlert === 'red')) {
                        statusClass = 'status-danger';
                        const reason = [];
                        if (stats.alerts.dateAlert === 'red')
                            reason.push(tl('equipment.dateOverdue', { date: stats.revisionDateStr }));
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
                            <div class="session-details" style="font-size: 0.85rem; display:flex; gap:15px; margin-bottom: 6px;">
                                <span class="detail-item"><i class="ri-windy-line"></i> ${tt('equipment.sessions', { count: stats ? stats.totalSessions : 0 })}</span>
                                <span class="detail-item"><i class="ri-time-line"></i> ${stats ? formatDuration(stats.totalTime) : '0h 00m'}</span>
                            </div>
                            <div class="equipment-secondary-details" style="font-size: 0.8rem; opacity: 0.8; display:flex; gap:15px; flex-wrap:wrap; margin-bottom: 12px;">
                                ${equip.dateAchat ? `<span class="detail-item"><strong>${tt('equipment.purchase')}</strong> ${formatDateOnly(equip.dateAchat)}</span>` : ''}
                                ${equip.derniereRevision ? `<span class="detail-item"><strong>${tt('equipment.lastRevision')}</strong> ${formatDateOnly(equip.derniereRevision)}</span>` : ''}
                                ${stats && stats.nextRevisionDate ? `<span class="detail-item"><strong>${tt('equipment.nextRevision')}</strong> ${stats.revisionDateStr}</span>` : ''}
                                ${stats && stats.hoursRemaining !== null ? `<span class="detail-item"><strong>${tt('equipment.hoursBeforeRevision')}</strong> ${stats.hoursRemaining <= 0 ? `<span style="color:#ef4444; font-weight:bold;">${tt('equipment.overdueBy', { hours: Math.abs(Math.round(stats.hoursRemaining * 10) / 10) })}</span>` : tt('equipment.hours', { hours: Math.round(stats.hoursRemaining * 10) / 10 })} ${tt('equipment.ofPeriod', { period: equip.periodiciteHeures })}</span>` : ''}
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

    getWeatherEmoji(code) {
        if (code === 0) return '☀️';
        if (code === 1 || code === 2) return '🌤️';
        if (code === 3) return '☁️';
        if (code >= 45 && code <= 48) return '🌫️';
        if (code >= 51 && code <= 67) return '🌧️';
        if (code >= 71 && code <= 77) return '❄️';
        if (code >= 80 && code <= 82) return '🌦️';
        if (code >= 95) return '⛈️';
        return '☀️';
    }

    getWindDirectionString(deg) {
        if (deg === null || deg === undefined) return '';
        const dirs = EXTENDED_WIND_DIRECTIONS;
        const val = Math.floor(deg / 22.5 + 0.5);
        return dirs[val % 16];
    }

    // Une ligne "Décollage"/"Atterrissage" (ou "Début"/"Fin" pour un gonflage) du bloc météo (modèle Open-Meteo/AROME,
    // valeur estimée au point GPS du site à l'heure donnée).
    renderWeatherPointRow(m, label) {
        if (!m) return '';
        const weatherIcon =
            m.weatherCode !== null && m.weatherCode !== undefined ? this.getWeatherEmoji(m.weatherCode) : '🌤️';
        const dirStr =
            m.ventDirection !== null && m.ventDirection !== undefined
                ? this.getWindDirectionString(m.ventDirection)
                : '';

        return `
        <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 4px 0;">
            <span style="font-weight: 600; min-width: 90px;">${escapeHTML(label)} :</span>
            <span title="${tt('weather.temperatureTitle')}"><strong>${weatherIcon} ${tt('weather.temperature', { value: m.temperature })}</strong></span>
            <span style="color: rgba(0,0,0,0.2);">|</span>
            <span title="${tt('weather.windTitle')}"><i class="ri-windy-line" style="color: var(--accent-blue);"></i> <strong>${tt('weather.wind')}</strong> ${tt('weather.windSpeed', { value: m.ventVitesse })} ${m.ventRafales ? tt('weather.gusts', { value: m.ventRafales }) : ''}</span>
            ${
                m.ventDirection !== null && m.ventDirection !== undefined
                    ? `
            <span style="color: rgba(0,0,0,0.2);">|</span>
            <span title="${tt('weather.directionTitle')}"><i class="ri-arrow-up-fill" style="color: #10b981; font-size: 1.05em; display:inline-block; transform: rotate(${m.ventDirection}deg);"></i> <strong>${tt('weather.direction')}</strong> ${dirStr} (${m.ventDirection}°)</span>
            `
                    : ''
            }
        </div>`;
    }

    // Graphe réel de la balise météo FFVL associée au site, pour le jour du vol.
    // Contrairement au bloc ci-dessus (modèle AROME estimé au point GPS), c'est la
    // mesure effective de la balise la plus proche -- balisemeteo.com n'expose pas
    // de valeur numérique historique en API, seulement ce graphe image par jour, donc
    // on l'affiche tel quel avec un lien pour lire la valeur précise à l'heure du vol.
    renderBaliseHistoBlock(session) {
        if (!session.baliseId) return '';
        const dateStr = (session.datetime || '').split('T')[0];
        if (!dateStr) return '';

        const histoPageUrl = `https://balisemeteo.com/balise_histo.php?idBalise=${encodeURIComponent(session.baliseId)}&date=${encodeURIComponent(dateStr)}`;
        const graphUrl = `https://balisemeteo.com/graphs/histo_vent.php?idBalise=${encodeURIComponent(session.baliseId)}&interval=1&marks=false&date=${encodeURIComponent(dateStr)}`;

        return `
        <details class="logbook-card-balise" style="margin-top: 8px; padding: 10px; background: var(--bg-card-hover, rgba(0,0,0,0.03)); border-radius: var(--radius-sm); border: 1px solid var(--border-light, rgba(0,0,0,0.06)); font-size: 0.82rem; color: var(--text-secondary);">
            <summary style="cursor: pointer; display: flex; align-items: center; gap: 6px; list-style: revert;">
                <i class="ri-broadcast-line" style="color: var(--accent-blue);"></i> <strong>${tt('weather.beacon', { date: dateStr.split('-').reverse().join('/') })}</strong>
            </summary>
            <div style="margin-top: 8px;">
                <a href="${histoPageUrl}" target="_blank" rel="noopener noreferrer">
                    <img src="${graphUrl}" alt="${tt('weather.beaconAlt')}" loading="lazy" style="width: 100%; max-width: 500px; height: auto; border-radius: 4px; display: block;">
                </a>
                <a href="${histoPageUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; margin-top: 6px; color: var(--accent-blue); text-decoration: none; font-size: 0.78rem;">
                    ${tt('weather.beaconHistory')} <i class="ri-external-link-line"></i>
                </a>
            </div>
        </details>`;
    }

    forceWeatherRefresh(sessionId) {
        const session = LogbookService.getFlights().find((s) => s.id === sessionId);
        if (!session) return;

        // 1. Immediately show loading state in the UI to remove any error banner
        const container = document.getElementById('weather-container-' + sessionId);
        if (container) {
            container.innerHTML = `<div style="color: var(--accent-blue); font-size: 0.85rem; padding: 8px 12px; background: rgba(14,165,233,0.08); border-radius: var(--radius-sm); display: inline-flex; align-items: center; gap: 6px;"><i class="ri-loader-4-line ri-spin"></i> <strong>${tt('weather.loading')}</strong></div>`;
        }

        let lat = null,
            lon = null;
        let baliseId = null;
        const siteName = session.site || session.lieu || '';

        if (session.lat && session.lon) {
            lat = session.lat;
            lon = session.lon;
            console.log('[Météo Logbook] Utilisation des coordonnées IGC en dur (Refresh) :', lat, lon);
        } else {
            if (siteName) {
                console.log('[Météo Logbook] Saisie (Refresh) :', siteName);

                const foundSite = this.findSiteByName(siteName);
                if (foundSite) {
                    console.log('[Météo Logbook] Site trouvé au rafraîchissement :', foundSite.nom);
                    const coords = this.getSiteCoords(foundSite);
                    if (coords.lat && coords.lon) {
                        lat = coords.lat;
                        lon = coords.lon;
                    } else {
                        console.warn("[Météo Logbook] Le site n'a pas de coordonnées valides :", foundSite);
                    }
                    baliseId = getSpotairWidgetId(foundSite);
                } else {
                    console.error('[Météo Logbook] Aucun match pour :', siteName);
                }
            }
        }

        if (lat && lon) {
            this.fetchWeatherForSession(lat, lon, session.datetime, session.id, session.duree, baliseId);
        } else {
            if (container) {
                const searchedString = this.normalizeString(siteName || tl('weather.emptyInput'));
                const sites = SitesService.getSites();
                const availableNamesSample =
                    sites.length > 0
                        ? sites
                              .slice(0, 3)
                              .map((s) => this.normalizeString(s.nom))
                              .join(' | ')
                        : tl('weather.emptyBase');
                container.innerHTML = `<div style="color: #ef4444; font-size: 0.85rem; padding: 8px 12px; background: rgba(239,68,68,0.08); border-radius: var(--radius-sm); line-height: 1.4;"><i class="ri-error-warning-line"></i> <strong>${tt('weather.errorTitle')}</strong> ${tt('weather.notFound', { input: searchedString })}<br><span style="font-size: 0.75rem; opacity: 0.8; word-break: break-all;">${tt('weather.sample', { sample: availableNamesSample })}</span></div>`;
            }
        }
    }

    // --- WEATHER MODULE (Open-Meteo pour les chiffres + balise FFVL réelle pour la vérif visuelle) ---
    async fetchWeatherForSession(lat, lon, datetimeStr, sessionId, dureeMin, baliseId) {
        console.log(`Fetching weather for session ${sessionId}...`);
        const landingDatetimeStr = addMinutesToDatetimeLocal(datetimeStr, dureeMin);

        const [decollageResult, atterroResult] = await Promise.all([
            LogbookService.fetchSessionWeather(lat, lon, datetimeStr),
            landingDatetimeStr && landingDatetimeStr !== datetimeStr
                ? LogbookService.fetchSessionWeather(lat, lon, landingDatetimeStr)
                : Promise.resolve({ success: false, data: null, error: null }),
        ]);

        if (decollageResult.success) {
            const sessionIndex = LogbookService.getFlights().findIndex((s) => s.id === sessionId);
            if (sessionIndex !== -1) {
                const target = LogbookService.getFlights()[sessionIndex];
                target.meteo = decollageResult.data;
                target.meteoAtterro = atterroResult.success ? atterroResult.data : null;

                // Météo rigoureusement identique au décollage et à l'atterrissage : une seule ligne,
                // « Décollage et atterrissage ». L'indicateur est explicite : une météo d'atterrissage
                // absente (échec, séance ancienne) ne doit jamais être présentée comme identique.
                target.meteoAtterroSame =
                    !!target.meteoAtterro && JSON.stringify(target.meteo) === JSON.stringify(target.meteoAtterro);
                if (target.meteoAtterroSame) target.meteoAtterro = null;

                target.baliseId = baliseId || null;
                LogbookService.saveFlights(); // Persiste en localStorage et déclenche la synchro Firestore

                this.refreshSessionWeather(sessionId);
                console.log(`Weather data fetched successfully for session ${sessionId}.`);
            }
        } else {
            console.error('Error fetching weather for session:', decollageResult.error);
            const container = document.getElementById('weather-container-' + sessionId);
            if (container) {
                container.innerHTML = `<div style="color: #f59e0b; font-size: 0.85rem; padding: 8px 12px; background: rgba(245,158,11,0.08); border-radius: var(--radius-sm);"><i class="ri-alert-line"></i> ${tt('weather.unavailable', { error: decollageResult.error })}</div>`;
            }
        }
    } // Ends fetchWeather method

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
        this.releaseCoordsMap();
        // Le Carnet n'utilise aucune librairie de Chart externe (graphiques générés en HTML pur).
        // Les écouteurs d'événements sont attachés à des éléments du DOM
        // recréés par innerHTML, et sont donc automatiquement garbage collected.
    }
}

const LogbookView = new LogbookViewClass();
export default LogbookView;
