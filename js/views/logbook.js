/**
 * VIEW/CONTROLLER - LogbookView
 * Wrapped from logbook_engine.js
 */
import GlobalState from '../core/app_state.js';
import AppEvents from '../core/events.js';
import AppRouter from '../core/router.js';
import LogbookService from '../services/logbook_service.js';
import StorageService from '../services/storage.js'; // Retained just for custom select lists
import { EXTENDED_WIND_DIRECTIONS } from '../data/weather_config.js';
import { 
    DEFAULT_EQUIPMENT_BRANDS,
    DEFAULT_EQUIPMENT_SIZES,
    DEFAULT_EQUIPMENT_COLORS
} from '../data/equipment_config.js';
import { escapeHTML } from '../core/security.js';
import { formatDuration, formatDateOnly, formatDateTime } from '../utils/date_utils.js';
import { capitalizeFirstLetter } from '../utils/text_utils.js';

import BaseView from '../core/base_view.js';

class LogbookViewClass extends BaseView {
    constructor() {
        super();
        this.engine = null;
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
            container.addEventListener('change', (e) => {
                const target = e.target;
                if (target.id === 'lb-voile' || target.id === 'lb-sellette') {
                    LogbookView.setSelectOrAutre(target.id, target.id + '-autre', target.value);
                } else if (target.id === 'eq-marque' || target.id === 'eq-modele' || target.id === 'eq-taille' || target.id === 'eq-couleur') {
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
                if (e.target.id === 'logbook-add-form') {
                    e.preventDefault();
                    LogbookView.submitForm();
                } else if (e.target.id === 'equip-form') {
                    e.preventDefault();
                    // Equipment form doesn't have an explicit submit function globally, it is handled in renderEquipment
                }
            });
        }
    }

    init(mainEngine) {
        this.engine = mainEngine;
        this.initEquipment();
        this.setupEventListeners();
        this.updateEquipmentAlertBadge();
        console.log("LogbookView initialized.");
    }

    // Petit badge rouge sur l'onglet nav "Carnet" comptant le matériel dont la révision
    // (date ou heures de vol) est due ou approche — réutilise LogbookService.computeEquipmentWear(),
    // qui calcule déjà ces alertes pour l'affichage par carte dans l'onglet Matériel.
    updateEquipmentAlertBadge() {
        const badge = document.getElementById('logbook-nav-badge');
        if (!badge) return;
        const wear = LogbookService.computeEquipmentWear();
        const alertCount = Object.values(wear).filter(s => s.alerts.dateAlert || s.alerts.hoursAlert).length;
        if (alertCount > 0) {
            badge.textContent = alertCount;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }

    normalizeString(str) {
        if (!str) return '';
        return str.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]/g, '');
    }

    // Découpe en mots significatifs (≥3 chars) après nettoyage des accents/ponctuation
    normalizeWords(str) {
        if (!str) return [];
        return str.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length >= 3);
    }

    // Recherche le meilleur site par correspondance de mots-clés
    findSiteByName(siteName) {
        if (!siteName || typeof SITES_DATA === 'undefined') return null;
        const inputWords = this.normalizeWords(siteName);
        if (inputWords.length === 0) return null;

        let bestMatch = null;
        let bestScore = 0;
        SITES_DATA.forEach(s => {
            const siteWords = this.normalizeWords(s.nom || s.name || '');
            const score = inputWords.filter(w => siteWords.some(sw => sw.includes(w) || w.includes(sw))).length;
            if (score > bestScore) { bestScore = score; bestMatch = s; }
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
        const toRad = (deg) => deg * Math.PI / 180;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    // Site officiel le plus proche d'un point GPS (ex: décollage détecté depuis une trace
    // IGC), dans un rayon raisonnable. Retourne null si aucun site officiel n'est assez proche.
    findNearestSite(lat, lon, maxDistanceKm = 2) {
        if (typeof SITES_DATA === 'undefined' || lat === null || lon === null) return null;

        let nearest = null;
        let nearestDist = Infinity;
        SITES_DATA.forEach(site => {
            const coords = this.getSiteCoords(site);
            if (coords.lat === null || coords.lon === null) return;
            const dist = this.haversineDistanceKm(lat, lon, coords.lat, coords.lon);
            if (dist < nearestDist) { nearestDist = dist; nearest = site; }
        });
        return (nearest && nearestDist <= maxDistanceKm) ? nearest : null;
    }



    show() {
        this.switchTab(this.currentTab);
    }

    initEquipment() {
        // Populate dropdowns initially
        this.populateEquipmentDropdowns();

        const eqTypeSelect = document.getElementById('eq-type');
        const windLimitsDiv = document.getElementById('eq-wind-limits');
        
        if (eqTypeSelect && windLimitsDiv) {
            eqTypeSelect.addEventListener('change', function(e) {
                windLimitsDiv.style.display = e.target.value === 'voile' ? 'flex' : 'none';
            });
            // Initiale state
            windLimitsDiv.style.display = eqTypeSelect.value === 'voile' ? 'flex' : 'none';
        }

        // Setup event listeners for the dropdowns
        const setupAutreListener = (selectId, autreId) => {
            const selectEl = document.getElementById(selectId);
            const autreEl = document.getElementById(autreId);
            if (selectEl && autreEl) {
                selectEl.addEventListener('change', () => {
                    autreEl.style.display = (selectEl.value === 'Autre') ? 'block' : 'none';
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

                const idEdit = document.getElementById('eq-id-edit').value;
                const periodicite = parseInt(document.getElementById('eq-periodicite').value, 10);
                const periodiciteHeures = parseInt(document.getElementById('eq-periodicite-heures').value, 10);
                const dateAchat = document.getElementById('eq-achat').value;
                const derniereRevision = document.getElementById('eq-derniere-revision').value;
                
                const type = document.getElementById('eq-type').value;

                // Extraire Marque, Modele, Taille, Couleur avec la logique "Autre"
                const getValOrAutre = (selectId, autreId, localStorageKey, defaultList) => {
                    const selectEl = document.getElementById(selectId);
                    if (!selectEl) return '';
                    let value = selectEl.value;
                    if (value === 'Autre') {
                        const inputEl = document.getElementById(autreId);
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

                const marque = getValOrAutre('eq-marque', 'eq-marque-autre', 'customEquipMarques', ['Advance', 'BGD', 'Gin', 'Niviuk', 'Ozone', 'Phi', 'Nova', 'Supair', 'Skywalk', 'Triple Seven', 'AirDesign', 'Flow']);
                const modele = getValOrAutre('eq-modele', 'eq-modele-autre', 'customEquipModeles', []);
                const taille = getValOrAutre('eq-taille', 'eq-taille-autre', 'customEquipTailles', ['XS', 'S', 'M', 'ML', 'L', 'XL']);
                const couleur = getValOrAutre('eq-couleur', 'eq-couleur-autre', 'customEquipCouleurs', ['Rouge', 'Bleu', 'Vert', 'Jaune', 'Orange', 'Blanc', 'Noir', 'Gris', 'Violet', 'Rose']);

                const equipDataObj = {
                    nom: document.getElementById('eq-nom').value.trim() || `${marque} ${modele}`.trim(),
                    marque: marque,
                    modele: modele,
                    taille: taille,
                    couleur: couleur,
                    type: type,
                    dateAchat: dateAchat,
                    derniereRevision: derniereRevision,
                    periodicite: periodicite,
                    periodiciteHeures: periodiciteHeures,
                    statut: 'actif'
                };
                
                if (type === 'voile') {
                    equipDataObj.ventMin = parseInt(document.getElementById('eq-vent-min').value, 10) || 0;
                    equipDataObj.ventMax = parseInt(document.getElementById('eq-vent-max').value, 10) || 25;
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
        const selectEl = document.getElementById(selectId);
        const autreEl = document.getElementById(autreId);
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

        const options = Array.from(selectEl.options).map(o => o.value);
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
                LogbookService.getEquipment().forEach(e => {
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
            const sortedVals = Array.from(allValsSet).filter(Boolean).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));

            // Save back to storage
            const newCustomVals = sortedVals.filter(v => !defaultList.includes(v));
            StorageService.set(storedKey, newCustomVals);

            let html = '<option value="">-- Choisir ou Saisie Libre --</option>';
            sortedVals.forEach(val => {
                html += `<option value="${val}">${val}</option>`;
            });
            html += '<option value="Autre">Autre...</option>';
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
        const nomEl = document.getElementById('eq-nom');

        if (!nomEl) return;

        const getVal = (selectEl, autreId) => {
            if (!selectEl) return '';
            if (selectEl.value === 'Autre') {
                const autreEl = document.getElementById(autreId);
                return autreEl ? autreEl.value.trim() : '';
            }
            return selectEl.value;
        };

        const marque = getVal(marqueEl, 'eq-marque-autre');
        const modele = getVal(modeleEl, 'eq-modele-autre');
        const taille = getVal(tailleEl, 'eq-taille-autre');
        const couleur = getVal(couleurEl, 'eq-couleur-autre');

        let generatedNom = "";
        if (marque) generatedNom += marque;
        if (modele) generatedNom += (generatedNom ? " | " : "") + modele;
        if (couleur) generatedNom += (generatedNom ? " | " : "") + couleur;
        if (taille) generatedNom += (generatedNom ? " | " : "") + taille;

        nomEl.value = generatedNom.toUpperCase();
    }

    switchTab(tabName) {
        this.currentTab = tabName;

        // Update Buttons
        document.querySelectorAll('.logbook-tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const activeBtn = Array.from(document.querySelectorAll('.logbook-tab-btn')).find(btn => 
            (btn.getAttribute('data-args') || '').includes(tabName) || btn.getAttribute('data-tab') === tabName
        );
        if (activeBtn) activeBtn.classList.add('active');

        // Update Content
        document.querySelectorAll('.logbook-tab-content').forEach(content => {
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
        const editId = document.getElementById('lb-id-edit')?.value || '';
        const datetime = document.getElementById('lb-datetime')?.value || '';
        const location = this.currentFormType === 'vol' ?
            document.getElementById('lb-site')?.value :
            document.getElementById('lb-lieu')?.value;

        const voile = document.getElementById('lb-voile')?.value || '';
        const voileAutre = document.getElementById('lb-voile-autre')?.value || '';
        const voileAutreVisible = document.getElementById('lb-voile-autre')?.style.display === 'block';

        const sellette = document.getElementById('lb-sellette')?.value || '';
        const selletteAutre = document.getElementById('lb-sellette-autre')?.value || '';
        const selletteAutreVisible = document.getElementById('lb-sellette-autre')?.style.display === 'block';

        const duree = document.getElementById('lb-duree')?.value || '';
        const commentaire = document.getElementById('lb-commentaire')?.value || '';

        const submitText = document.getElementById('lb-submit-btn')?.innerText || 'Enregistrer';
        const cancelBtnVisible = document.getElementById('lb-cancel-btn')?.style.display || 'none';

        this.currentFormType = type;

        document.getElementById('btn-type-vol').classList.toggle('active', type === 'vol');
        document.getElementById('btn-type-gonflage').classList.toggle('active', type === 'gonflage');

        this.renderForm();

        // 2. Réinjecter les valeurs dans le nouveau formulaire
        if (editId) {
            const el = document.getElementById('lb-id-edit');
            if (el) el.value = editId;
        }
        if (datetime) {
            const el = document.getElementById('lb-datetime');
            if (el) el.value = datetime;
        }
        if (location) {
            const el = type === 'vol' ? document.getElementById('lb-site') : document.getElementById('lb-lieu');
            if (el) el.value = location;
        }
        if (voile) {
            const el = document.getElementById('lb-voile');
            if (el) {
                el.value = voile;
                if (voile === 'Autre') {
                    const elAutre = document.getElementById('lb-voile-autre');
                    if (elAutre) {
                        elAutre.style.display = voileAutreVisible ? 'block' : 'none';
                        elAutre.value = voileAutre;
                    }
                }
            }
        }
        if (sellette) {
            const el = document.getElementById('lb-sellette');
            if (el) {
                el.value = sellette;
                if (sellette === 'Autre') {
                    const elAutre = document.getElementById('lb-sellette-autre');
                    if (elAutre) {
                        elAutre.style.display = selletteAutreVisible ? 'block' : 'none';
                        elAutre.value = selletteAutre;
                    }
                }
            }
        }
        if (duree) {
            const el = document.getElementById('lb-duree');
            if (el) el.value = duree;
        }
        if (commentaire) {
            const el = document.getElementById('lb-commentaire');
            if (el) el.value = commentaire;
        }

        // Restaurer l'état des boutons de soumission / annulation (pour l'édition)
        const submitBtn = document.getElementById('lb-submit-btn');
        if (submitBtn) submitBtn.innerText = submitText;
        const cancelBtn = document.getElementById('lb-cancel-btn');
        if (cancelBtn) cancelBtn.style.display = cancelBtnVisible;
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
                <div class="form-group igc-upload-container" data-action="triggerIgcUpload" style="border: 2px dashed var(--border-light, #ccc); border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 15px; cursor: pointer; background: var(--bg-card, #f9f9f9);">
                    <i class="ri-upload-cloud-line" style="font-size: 2rem; color: var(--accent-blue, #007bc4);"></i>
                    <div style="font-weight: bold; margin-top: 10px;">Importer une trace GPS (.igc)</div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary, #666); margin-top: 5px;" id="igc-upload-filename">Cliquez ou glissez-déposez le fichier</div>
                </div>
                <div class="form-group">
                    <label>Date & Heure <span class="required">*</span></label>
                    <input type="datetime-local" id="lb-datetime" required value="${defaultDateTime}">
                </div>
                <div class="form-group">
                    <label>Site de vol <span class="required">*</span></label>
                    <input type="text" id="lb-site" list="sites-list" placeholder="Ex: Planfait, Forclaz..." required autocomplete="off">
                    <datalist id="sites-list"></datalist>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Voile <span class="required">*</span></label>
                        <select id="lb-voile" required>
                            <option value="">-- Sélectionner --</option>
                        </select>
                        <input type="text" id="lb-voile-autre" placeholder="Spécifiez le modèle..." style="display:none; margin-top: 5px; width: 100%;">
                    </div>
                    <div class="form-group">
                        <label>Sellette</label>
                        <select id="lb-sellette">
                            <option value="">-- Sélectionner --</option>
                        </select>
                        <input type="text" id="lb-sellette-autre" placeholder="Spécifiez le modèle..." style="display:none; margin-top: 5px; width: 100%;">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Durée (minutes) <span class="required">*</span></label>
                        <input type="number" id="lb-duree" min="1" placeholder="Ex: 45" required>
                    </div>
                    <div class="form-group">
                        <label>Type de vol</label>
                        <select id="lb-typeVol">
                            <option value="Plouf">Plouf</option>
                            <option value="Thermique">Thermique</option>
                            <option value="Soaring">Soaring</option>
                            <option value="Restit">Restit</option>
                            <option value="Cross">Cross</option>
                        </select>
                    </div>
                </div>
                <div class="form-group" style="margin-bottom: 10px;">
                    <label for="lb-tech-decollage" style="display:block; margin-bottom:5px;">Technique de décollage :</label>
                    <select id="lb-tech-decollage" style="width:100%; padding:8px;" required onchange="document.getElementById('lb-tech-decollage-autre').style.display = (this.value === 'Autre') ? 'block' : 'none';">
                        <option value="Face voile">Face voile</option>
                        <option value="Dos voile">Dos voile</option>
                        ${(() => {
                    const parsed = StorageService.get('customDecollageTechniques');
                    if (Array.isArray(parsed)) return parsed.map(t => `<option value="${t}">${t}</option>`).join('');
                    return '';
                })()}
                        <option value="Autre">Autre...</option>
                    </select>
                    <input type="text" id="lb-tech-decollage-autre" placeholder="Spécifiez la technique..." style="display:none; margin-top: 5px; width: 100%;">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Altitude Max (m)</label>
                        <input type="number" id="lb-altMax" placeholder="Ex: 2100">
                    </div>
                    <div class="form-group">
                        <label>Gain (m)</label>
                        <input type="number" id="lb-gain" placeholder="Ex: 800">
                    </div>
                </div>
                <div class="form-group">
                    <label>Commentaire</label>
                    <textarea id="lb-commentaire" rows="3" placeholder="Sensations, conditions météo..."></textarea>
                </div>
            `;
        } else {
            // Gonflage form
            html = `
                <div class="form-group">
                    <label>Date & Heure <span class="required">*</span></label>
                    <input type="datetime-local" id="lb-datetime" required value="${defaultDateTime}">
                </div>
                <div class="form-group">
                    <label>Lieu <span class="required">*</span></label>
                    <input type="text" id="lb-lieu" list="sites-list" placeholder="Ex: Pente école, atterro..." required autocomplete="off">
                    <datalist id="sites-list"></datalist>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Voile <span class="required">*</span></label>
                        <select id="lb-voile" required>
                            <option value="">-- Sélectionner --</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Sellette</label>
                        <select id="lb-sellette">
                            <option value="">-- Sélectionner --</option>
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Durée (minutes) <span class="required">*</span></label>
                        <input type="number" id="lb-duree" min="1" placeholder="Ex: 60" required>
                    </div>
                    <div class="form-group">
                        <label>Exercices travaillés</label>
                        <div id="lb-typeExercice-group" style="display:flex; flex-direction:column; gap:6px; margin-top:8px;">
                            <label><input type="checkbox" name="lb-typeExercice" value="Face voile"> Face voile</label>
                            <label><input type="checkbox" name="lb-typeExercice" value="Dos voile"> Dos voile</label>
                            <label><input type="checkbox" name="lb-typeExercice" value="Tangage/Roulis"> Tangage/Roulis</label>
                            <label><input type="checkbox" name="lb-typeExercice" value="Affalage"> Affalage</label>
                            <label><input type="checkbox" name="lb-typeExercice" value="Vent fort"> Vent fort</label>
                            <label><input type="checkbox" name="lb-typeExercice" value="Prégonflage / Démêlage"> Prégonflage / Démêlage</label>
                        </div>
                    </div>
                </div>
                <div class="form-group">
                    <label>Commentaire</label>
                    <textarea id="lb-commentaire" rows="3" placeholder="Points à travailler..."></textarea>
                </div>
            `;
        }

        container.innerHTML = html;
        this.populateDropdowns();
        this.fillLastEquipment();

        const uploadContainer = document.querySelector('.igc-upload-container');
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
        // Populate Sites
        const datalist = document.getElementById('sites-list');
        if (datalist) {
            let allSites = [];

            // 1. Sites officiels (SITES_DATA)
            if (typeof SITES_DATA !== 'undefined') {
                const officialSites = SITES_DATA
                    .filter(site => site.affiche !== false && (site.nom || site.name))
                    .map(site => (site.nom || site.name).trim().toUpperCase());
                allSites = allSites.concat(officialSites);
            }

            // 2. Sites personnalisés (Historique du carnet)
            const historySites = LogbookService.getFlights()
                .map(session => session.site || session.lieu)
                .filter(site => site && site.trim() !== '')
                .map(site => site.trim().toUpperCase());
            allSites = allSites.concat(historySites);

            // 3. Dédoublonnage et tri alphabétique
            const processedSites = [...new Set(allSites)];
            processedSites.sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));

            // 4. Injection dans le DOM
            datalist.innerHTML = processedSites.map(siteName => `<option value="${escapeHTML(siteName)}"></option>`).join('');
        }

        // Populate Equipment
        const voilesSelect = document.getElementById('lb-voile');
        const sellettesSelect = document.getElementById('lb-sellette');

        let voilesHtml = '<option value="">-- Saisie libre (ou choisir) --</option>';
        let sellettesHtml = '<option value="">-- Saisie libre (ou choisir) --</option>';

        LogbookService.getEquipment().filter(e => e.statut !== 'archive').forEach(equip => {
            if (equip.type === 'voile') {
                voilesHtml += `<option value="${equip.nom}">${equip.nom}</option>`;
            } else if (equip.type === 'sellette') {
                sellettesHtml += `<option value="${equip.nom}">${equip.nom}</option>`;
            }
        });

        if (voilesSelect) {
            voilesSelect.innerHTML = voilesHtml;
            voilesSelect.innerHTML += '<option value="Autre">Autre...</option>';
        }
        if (sellettesSelect) {
            sellettesSelect.innerHTML = sellettesHtml;
            sellettesSelect.innerHTML += '<option value="Autre">Autre...</option>';
        }
    }

    fillLastEquipment() {
        // Automatically fill voile and sellette with the last used ones
        if (LogbookService.getFlights().length > 0) {
            const lastSession = LogbookService.getFlights()[0];
            const voileInput = document.getElementById('lb-voile');
            const selletteInput = document.getElementById('lb-sellette');
            if (voileInput && lastSession.voile) voileInput.value = lastSession.voile;
            if (selletteInput && lastSession.sellette) selletteInput.value = lastSession.sellette;
        }
    }

    currentTraceData = null;
    currentRawIgc = null;
    currentIgcStats = null;

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
        if (filenameLabel) filenameLabel.textContent = `Fichier chargé : ${file.name}`;

        const reader = new FileReader();
        reader.onload = (e) => {
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
                    avgSpeedKmh: parsed.avgSpeedKmh
                };

                const durationInput = document.getElementById('lb-duree');
                if (durationInput && parsed.duration > 0) {
                    durationInput.value = parsed.duration;
                }
                const datetimeInput = document.getElementById('lb-datetime');
                if (datetimeInput && parsed.dateStr) {
                    datetimeInput.value = parsed.dateStr;
                }

                const altMaxInput = document.getElementById('lb-altMax');
                if (altMaxInput && parsed.maxAltitude !== null) {
                    altMaxInput.value = parsed.maxAltitude;
                }
                const gainInput = document.getElementById('lb-gain');
                if (gainInput && parsed.gain !== null) {
                    gainInput.value = parsed.gain;
                }

                const siteInput = document.getElementById('lb-site');
                if (siteInput && !siteInput.value.trim()) {
                    // 1. Un site officiel connu tout près du décollage détecté : on l'utilise
                    // directement, c'est plus fiable et plus utile qu'un nom de ville/lieu-dit.
                    const nearestSite = this.findNearestSite(parsed.points[0].lat, parsed.points[0].lon);
                    if (nearestSite) {
                        siteInput.value = nearestSite.nom || nearestSite.name;
                    } else {
                        // 2. Sinon, reverse-geocoding vers la ville/lieu-dit le plus proche.
                        siteInput.value = "Recherche du lieu...";
                        LogbookService.reverseGeocode(parsed.points[0].lat, parsed.points[0].lon).then(res => {
                            if (res.success && res.data.city) {
                                siteInput.value = `${res.data.city} (Import GPS)`;
                            } else {
                                if (!res.success) console.error("[Geocoding] Erreur:", res.error);
                                siteInput.value = res.success ? "Lieu inconnu (Import GPS)" : "Décollage importé (GPS)";
                            }
                        });
                    }
                }
                console.log("[IGC] Trace parsée :", parsed.points.length, "points, durée :", parsed.duration, "min");
            } else {
                alert("Erreur lors du parsing IGC : " + flightStats.error);
                this.currentTraceData = null;
                this.currentRawIgc = null;
                this.currentIgcStats = null;
            }
        };
        reader.readAsText(file);
    }

    submitForm() {
        const datetime = document.getElementById('lb-datetime').value;
        let voile = document.getElementById('lb-voile').value.trim();
        let sellette = document.getElementById('lb-sellette') ? document.getElementById('lb-sellette').value.trim() : '';

        if (voile === 'Autre') {
            const voileAutreInput = document.getElementById('lb-voile-autre');
            voile = voileAutreInput ? voileAutreInput.value.trim() : "";
        }
        if (sellette === 'Autre') {
            const selletteAutreInput = document.getElementById('lb-sellette-autre');
            sellette = selletteAutreInput ? selletteAutreInput.value.trim() : "";
        }
        const duree = parseInt(document.getElementById('lb-duree').value, 10);
        const commentaire = document.getElementById('lb-commentaire').value.trim();

        const editId = document.getElementById('lb-id-edit') ? document.getElementById('lb-id-edit').value : '';

        const session = {
            id: editId ? editId : Date.now().toString(),
            type: this.currentFormType,
            datetime: datetime,
            voile: voile,
            sellette: sellette,
            duree: duree,
            commentaire: commentaire
        };

        if (this.currentFormType === 'vol') {
            session.site = document.getElementById('lb-site').value.trim();
            session.typeVol = document.getElementById('lb-typeVol').value;

            const techDecoEl = document.getElementById('lb-tech-decollage');
            if (techDecoEl) {
                let techDecollage = techDecoEl.value;
                if (techDecollage === 'Autre') {
                    const techAutreInput = document.getElementById('lb-tech-decollage-autre');
                    let rawTech = techAutreInput ? techAutreInput.value.trim() : "";
                    if (rawTech) {
                        rawTech = capitalizeFirstLetter(rawTech);
                        techDecollage = rawTech;

                        let customTechs = StorageService.get('customDecollageTechniques') || [];
                        if (!Array.isArray(customTechs)) customTechs = [];

                        if (!customTechs.includes(techDecollage) && techDecollage !== 'Face voile' && techDecollage !== 'Dos voile') {
                            customTechs.push(techDecollage);
                            StorageService.set('customDecollageTechniques', customTechs);
                        }
                    }
                }
                session.techDecollage = techDecollage;
            }

            const altMax = document.getElementById('lb-altMax').value;
            if (altMax) session.altitudeMax = parseInt(altMax, 10);

            const gain = document.getElementById('lb-gain').value;
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
            if (window.TEMPORARY_IGC_RAW) {
                session.rawIgc = window.TEMPORARY_IGC_RAW;
                window.TEMPORARY_IGC_RAW = null; // On vide la mémoire après utilisation
            } else if (this.currentRawIgc) {
                session.rawIgc = this.currentRawIgc;
                this.currentRawIgc = null; // reset
            }
        } else {
            session.lieu = document.getElementById('lb-lieu').value.trim();
            const checkboxes = document.querySelectorAll('input[name="lb-typeExercice"]:checked');
            if (checkboxes.length > 0) {
                session.typeExercice = Array.from(checkboxes).map(cb => cb.value);
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
        let lat = null, lon = null;
        if (session.lat && session.lon) {
            lat = session.lat;
            lon = session.lon;
        } else {
            const siteName = session.site || session.lieu || "";
            if (siteName && typeof SITES_DATA !== 'undefined') {
                const foundSite = this.findSiteByName(siteName);
                const coords = this.getSiteCoords(foundSite);
                if (coords.lat && coords.lon) {
                    lat = coords.lat;
                    lon = coords.lon;
                }
            }
        }

        if (!lat || !lon) {
            const sessionDate = new Date(session.datetime).toDateString();
            const todayDate = new Date().toDateString();
            if (sessionDate === todayDate && navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        this.fetchWeatherForSession(position.coords.latitude, position.coords.longitude, session.datetime, session.id);
                    }
                );
                return;
            }
        }

        if (lat && lon) {
            this.fetchWeatherForSession(lat, lon, session.datetime, session.id);
        }
    }

    resetForm() {
        const form = document.getElementById('logbook-add-form');
        if (form) form.reset();
        const idEditField = document.getElementById('lb-id-edit');
        if (idEditField) idEditField.value = '';
        const submitBtn = document.getElementById('lb-submit-btn');
        if (submitBtn) submitBtn.innerText = "Enregistrer";
        const cancelBtn = document.getElementById('lb-cancel-btn');
        if (cancelBtn) cancelBtn.style.display = "none";
        this.currentTraceData = null;
        this.currentIgcStats = null;
        const filenameLabel = document.getElementById('igc-upload-filename');
        if (filenameLabel) filenameLabel.textContent = "Cliquez ou glissez-déposez le fichier";
        this.renderForm();
    }

    editEntry(id) {
        const session = LogbookService.getFlightById(id);
        if (!session) return;

        this.currentFormType = session.type;

        // Change la vue en premier pour générer les champs HTML
        this.switchTab('add');

        // Populate common fields
        document.getElementById('lb-id-edit').value = session.id;
        document.getElementById('lb-datetime').value = session.datetime;

        // Helper pour "Autre..."
        const setSelectOrAutre = (selectId, autreId, value) => {
            const selectEl = document.getElementById(selectId);
            const autreEl = document.getElementById(autreId);
            if (!selectEl || !value) return;

            // On regarde si la valeur existe dans les options
            const options = Array.from(selectEl.options).map(o => o.value);
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

        document.getElementById('lb-duree').value = session.duree;
        document.getElementById('lb-commentaire').value = session.commentaire || '';

        // Populate specific fields
        if (session.type === 'vol') {
            document.getElementById('lb-site').value = session.site || '';
            document.getElementById('lb-typeVol').value = session.typeVol || 'Plouf';

            setSelectOrAutre('lb-tech-decollage', 'lb-tech-decollage-autre', session.techDecollage);

            if (session.altitudeMax) document.getElementById('lb-altMax').value = session.altitudeMax;
            if (session.gain) document.getElementById('lb-gain').value = session.gain;

            if (session.traceGps && session.traceGps.length > 0) {
                const filenameLabel = document.getElementById('igc-upload-filename');
                if (filenameLabel) filenameLabel.textContent = "Trace GPS (existante)";
            }
        } else {
            document.getElementById('lb-lieu').value = session.lieu || '';
            if (session.typeExercice) {
                const checkboxes = document.querySelectorAll('input[name="lb-typeExercice"]');
                const typesArray = Array.isArray(session.typeExercice) ? session.typeExercice : [session.typeExercice];
                checkboxes.forEach(cb => {
                    cb.checked = typesArray.includes(cb.value);
                });
            }
        }

        // Update UI buttons
        const submitBtn = document.getElementById('lb-submit-btn');
        if (submitBtn) submitBtn.innerText = "Modifier la session";
        const cancelBtn = document.getElementById('lb-cancel-btn');
        if (cancelBtn) cancelBtn.style.display = "inline-block";

        const formEl = document.getElementById('logbook-add-form');
        if (formEl) formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    deleteEntry(id) {
        if (confirm("Voulez-vous vraiment supprimer cette session ?")) {
            LogbookService.deleteFlight(id);
            this.renderHistory();
        }
    }

    renderHistory() {
        const container = document.getElementById('logbook-history-list');
        if (!container) return;

        if (LogbookService.getFlights().length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="ri-history-line"></i>
                    <p>Votre carnet est vide.</p>
                    <button class="action-btn-primary" data-action="switchTab" data-args="'add'">Ajouter une session</button>
                </div>
            `;
            return;
        }

        let html = '';
        LogbookService.getFlights().forEach(session => {
            const isVol = session.type === 'vol';
            const icon = isVol ? 'ri-windy-line' : 'ri-footprint-line';
            const typeColor = isVol ? 'var(--accent-blue)' : '#f59e0b';
            const location = isVol ? session.site : session.lieu;
            const subtitle = isVol ? session.typeVol : (Array.isArray(session.typeExercice) ? session.typeExercice.join(', ') : session.typeExercice);

            let extraInfo = '';
            if (isVol) {
                const badgeStyle = "background: var(--bg-card-hover, rgba(0,0,0,0.05)); padding: 4px 8px; border-radius: 6px; border: 1px solid var(--border-light, rgba(0,0,0,0.05)); font-weight: 500; display: inline-flex; align-items: center; gap: 4px;";
                const decoInfo = session.techDecollage ? `<span style="${badgeStyle}" title="Décollage"><i class="ri-takeaway-line"></i> Décollage : ${escapeHTML(session.techDecollage)}</span>` : '';
                const altInfo = session.altitudeMax ? `<span style="${badgeStyle}" title="Alt Max">⛰️ Alt Max : ${session.altitudeMax}m</span>` : '';
                const gainInfo = (session.gain !== undefined && session.gain !== null && session.gain !== '') ? `<span style="${badgeStyle}" title="Gain">📈 Gain : ${session.gain}m</span>` : '';
                const distanceInfo = session.distanceKm ? `<span style="${badgeStyle}" title="Distance parcourue">📏 Distance : ${session.distanceKm}km</span>` : '';
                const climbInfo = session.maxClimbRate ? `<span style="${badgeStyle}" title="Vario max">🔼 Vario max : +${session.maxClimbRate}m/s</span>` : '';
                const speedInfo = session.maxSpeedKmh ? `<span style="${badgeStyle}" title="Vitesse max / moyenne">💨 Vitesse : ${session.maxSpeedKmh}km/h max (${session.avgSpeedKmh}km/h moy.)</span>` : '';

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

            let meteoHtml;
            if (session.meteo) {
                const m = session.meteo;
                const weatherIcon = m.weatherCode !== null && m.weatherCode !== undefined ? this.getWeatherEmoji(m.weatherCode) : '🌤️';
                const dirStr = m.ventDirection !== null && m.ventDirection !== undefined ? this.getWindDirectionString(m.ventDirection) : '';

                meteoHtml = `
                <div class="logbook-card-weather" style="margin-top: 10px; padding: 10px; background: rgba(14,165,233,0.06); border-radius: var(--radius-sm); border: 1px solid rgba(14,165,233,0.15); display: flex; align-items: center; gap: 12px; font-size: 0.85rem; color: var(--text-secondary); flex-wrap: wrap;">
                    <span title="Température"><strong>${weatherIcon} ${m.temperature}°C</strong></span>
                    <span style="color: rgba(0,0,0,0.2);">|</span>
                    <span title="Vent"><i class="ri-windy-line" style="color: var(--accent-blue);"></i> <strong>Vent :</strong> ${m.ventVitesse} km/h ${m.ventRafales ? `(Rafales : ${m.ventRafales} km/h)` : ''}</span>
                    ${m.ventDirection !== null && m.ventDirection !== undefined ? `
                    <span style="color: rgba(0,0,0,0.2);">|</span>
                    <span title="Direction"><i class="ri-navigation-line" style="color: #10b981; display:inline-block; transform: rotate(${m.ventDirection}deg);"></i> <strong>Dir :</strong> ${dirStr} (${m.ventDirection}°)</span>
                    ` : ''}
                </div>`;
            } else {
                meteoHtml = `
                <div id="weather-container-${session.id}" class="logbook-card-weather-empty" style="margin-top: 10px; font-size: 0.85rem;">
                    <button id="refresh-weather-btn-${session.id}" class="action-btn-text" data-action="forceWeatherRefresh" data-args="${session.id}" style="color: var(--text-muted); cursor: pointer; border: none; background: rgba(0,0,0,0.03); border-radius: var(--radius-sm); padding: 6px 12px; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s;">
                        <i class="ri-refresh-line"></i> Récupérer la météo
                    </button>
                </div>`;
            }

            html += `
                <div class="logbook-card">
                    <div class="logbook-card-header">
                        <div class="session-badge" style="background-color: ${typeColor}22; color: ${typeColor};">
                            <i class="${icon}"></i> ${isVol ? 'VOL' : 'GONFLAGE'}
                        </div>
                        <div class="session-date">${formatDateTime(session.datetime)}</div>
                        <div style="display: flex; gap: 8px;">
                            <button class="edit-btn" data-action="editEntry" data-args="${session.id}" title="Modifier" style="background: none; border: none; color: var(--text-secondary); cursor: pointer; padding: 4px; border-radius: 4px; transition: all 0.2s;">
                                <i class="ri-edit-line"></i>
                            </button>
                            <button class="delete-btn" data-action="deleteEntry" data-args="${session.id}" title="Supprimer" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 4px; border-radius: 4px; transition: all 0.2s;">
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
                            ${session.voile ? `<div><strong>Voile :</strong> ${escapeHTML(session.voile)}</div>` : ''}
                            ${session.sellette ? `<div><strong>Sellette :</strong> ${escapeHTML(session.sellette)}</div>` : ''}
                        </div>
                        ${session.commentaire ? `<div class="session-comment">"${escapeHTML(session.commentaire)}"</div>` : ''}
                        ${session.rawIgc || (session.traceGps && session.traceGps.length > 0) ? `<button class="btn-view-trace action-btn-secondary" style="margin-top: 10px; width: 100%; border: 1px solid var(--accent-blue); color: var(--accent-blue); padding: 8px; border-radius: 6px; cursor: pointer; background: transparent; transition: all 0.2s;" data-action="showTrace" data-args="${session.id}"><i class="ri-route-line"></i> Voir la trace 🗺️</button><div id="trace-container-${session.id}" style="display:none; margin-top: 10px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border-light);"></div>` : ''}
                        ${meteoHtml}
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    showTrace(sessionId) {
        const container = document.getElementById(`trace-container-${sessionId}`);
        if (!container) return;

        if (container.style.display === 'block') {
            container.style.display = 'none';
            if (typeof Map3DComponent !== 'undefined') {
                Map3DComponent.clearPlayback();
            }
            return;
        }

        const session = LogbookService.getFlightById(sessionId);
        if (!session || (!session.rawIgc && (!session.traceGps || session.traceGps.length === 0))) return;

        let points = session.traceGps;
        if (session.rawIgc) {
            const result = LogbookService.parseIGC(session.rawIgc);
            if (result.success && result.data.points) {
                points = result.data.points;
            } else {
                console.error("Erreur de parsing IGC à la volée :", result.error);
                return;
            }
        }

        container.style.display = 'block';

        if (typeof Map3DComponent !== 'undefined') {
            try {
                Map3DComponent.showTrace(sessionId, points, container);
            } catch (error) {
                console.error("Map3DComponent Error: Erreur lors du dessin de la trace.", error);
                container.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-secondary);">Impossible d'afficher la carte 3D. (${error.message})</div>`;
            }
        } else {
            console.error("Map3DComponent n'est pas chargé.");
            container.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-secondary);">Le module de carte 3D est en cours de chargement ou indisponible.</div>`;
        }
    }

    renderStats() {
        const container = document.getElementById('logbook-stats-container');
        if (!container) return;

        if (LogbookService.getFlights().length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>Aucune donnée pour afficher des statistiques.</p>
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
        const volTypes = {};   // { typeName: count }
        const exoTypes = {};   // { typeName: count }
        const decoTypes = {};  // { typeName: count }

        let maxAltitudeReached = 0;
        let totalGain = 0;

        LogbookService.getFlights().forEach(s => {
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
                        s.typeExercice.forEach(exo => {
                            exoTypes[exo] = (exoTypes[exo] || 0) + 1;
                        });
                    } else {
                        exoTypes[s.typeExercice] = (exoTypes[s.typeExercice] || 0) + 1;
                    }
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

        // Top Sites
        const topSites = Object.entries(sitesStats)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        // Building HTML
        let html = `
            <div class="stats-grid">
                <!-- KPI: Vols -->
                <div class="kpi-card">
                    <div class="kpi-icon" style="background: var(--accent-blue); color: white;"><i class="ri-windy-line"></i></div>
                    <div class="kpi-info">
                        <div class="kpi-value">${totalVols} vols</div>
                        <div class="kpi-label">${formatDuration(totalTimeVols)} cumulé</div>
                    </div>
                </div>
                <!-- KPI: Gonflages -->
                <div class="kpi-card">
                    <div class="kpi-icon" style="background: #f59e0b; color: white;"><i class="ri-footprint-line"></i></div>
                    <div class="kpi-info">
                        <div class="kpi-value">${totalGonflages} sessions</div>
                        <div class="kpi-label">${formatDuration(totalTimeGonflages)} gonflage</div>
                    </div>
                </div>
                <!-- KPI: Alt Max -->
                <div class="kpi-card">
                    <div class="kpi-icon" style="background: #8b5cf6; color: white;"><i class="ri-mist-line"></i></div>
                    <div class="kpi-info">
                        <div class="kpi-value">${maxAltitudeReached} m</div>
                        <div class="kpi-label">Alt max atteinte</div>
                    </div>
                </div>
                <!-- KPI: Gain -->
                <div class="kpi-card">
                    <div class="kpi-icon" style="background: #10b981; color: white;"><i class="ri-arrow-up-line"></i></div>
                    <div class="kpi-info">
                        <div class="kpi-value">${totalGain} m</div>
                        <div class="kpi-label">Gain cumulé total</div>
                    </div>
                </div>
            </div>
        `;

        // Equipment Stats
        if (Object.keys(equipStats).length > 0) {
            html += `<h3 class="stats-section-title">Matériel (Voiles)</h3><div class="equip-list">`;
            for (const [voile, st] of Object.entries(equipStats)) {
                html += `
                    <div class="equip-card">
                        <div class="equip-name">${voile}</div>
                        <div class="equip-details">
                            <span style="color: var(--accent-blue)">Vols: ${st.vols} (${formatDuration(st.timeVols)})</span>
                            <span style="color: #f59e0b">Gonflage: ${st.gonflages} (${formatDuration(st.timeGonflages)})</span>
                        </div>
                        ${ (() => {
                            const equipObj = LogbookService.getEquipment().find(e => e.nom.toLowerCase() === voile.toLowerCase());
                            if (equipObj && equipObj.periodiciteHeures > 0) {
                                const totalHours = (st.timeVols + st.timeGonflages) / 60;
                                const hoursRemaining = equipObj.periodiciteHeures - totalHours;
                                const hoursText = hoursRemaining <= 0 
                                    ? `<span style="color:#ef4444; font-weight:bold;">Dépassé de ${Math.abs(Math.round(hoursRemaining * 10) / 10)}h</span>`
                                    : `${Math.round(hoursRemaining * 10) / 10}h restantes`;
                                return `<div style="font-size: 0.8rem; margin-top: 6px; color: var(--text-secondary);"><strong>Avant révision:</strong> ${hoursText} (sur ${equipObj.periodiciteHeures}h)</div>`;
                            }
                            return '';
                        })() }
                    </div>
                `;
            }
            html += `</div>`;
        }

        // Top Sites Bar Chart
        if (topSites.length > 0) {
            html += `<h3 class="stats-section-title">Top Lieux fréquentés</h3><div class="chart-container">`;
            const maxVal = topSites[0][1];
            topSites.forEach(([site, count]) => {
                const percent = (count / maxVal) * 100;
                html += `
                    <div class="bar-row">
                        <div class="bar-label">${site}</div>
                        <div class="bar-track">
                            <div class="bar-fill" style="width: ${percent}%; background: var(--accent-green)"></div>
                        </div>
                        <div class="bar-value">${count}</div>
                    </div>
                `;
            });
            html += `</div>`;
        }

        // Types de Vol
        if (Object.keys(volTypes).length > 0) {
            html += `<h3 class="stats-section-title">Types de vols</h3><div class="chart-container">`;
            for (const [type, count] of Object.entries(volTypes)) {
                const percent = (count / totalVols) * 100;
                html += `
                    <div class="bar-row">
                        <div class="bar-label">${type}</div>
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
            html += `<h3 class="stats-section-title">Techniques de décollage</h3><div class="chart-container">`;
            const totalDeco = Object.values(decoTypes).reduce((a, b) => a + b, 0);
            for (const [type, count] of Object.entries(decoTypes)) {
                const percent = (count / totalDeco) * 100;
                html += `
                    <div class="bar-row">
                        <div class="bar-label" title="${type}" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${type}</div>
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
            html += `<h3 class="stats-section-title">Exercices de gonflage</h3><div class="chart-container">`;
            for (const [type, count] of Object.entries(exoTypes)) {
                const percent = (count / totalGonflages) * 100;
                html += `
                    <div class="bar-row">
                        <div class="bar-label">${type}</div>
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

        // Sort: actifs first, then by date added
        const sortedEquip = [...LogbookService.getEquipment()].sort((a, b) => {
            if (a.statut === 'actif' && b.statut !== 'actif') return -1;
            if (a.statut !== 'actif' && b.statut === 'actif') return 1;
            return 0; // maintain original insertion order if same status
        });

        const equipStats = LogbookService.computeEquipmentWear();

        let html = `<h3 class="stats-section-title">Mon Inventaire</h3>`;

        if (sortedEquip.length === 0) {
            html += `<div class="empty-state"><p>Aucun équipement enregistré.</p></div>`;
        } else {
            html += `<div class="equip-list">`;
            sortedEquip.forEach(equip => {
                const stats = equipStats[(equip.nom || "").toLowerCase()];

                let alertHtml = '';
                let statusClass = 'status-ok';

                // Logique des alertes combinées
                if (stats && (stats.alerts.dateAlert === 'red' || stats.alerts.hoursAlert === 'red')) {
                    statusClass = 'status-danger';
                    const reason = [];
                    if (stats.alerts.dateAlert === 'red') reason.push(`Date dépassée (${stats.revisionDateStr})`);
                    if (stats.alerts.hoursAlert === 'red') reason.push(`Heures dépassées (${Math.round(stats.totalTime / 60)}h / ${equip.periodiciteHeures}h)`);

                    alertHtml = `<div class="equip-alert text-danger" style="color:#ef4444; font-weight:bold; margin-bottom:8px;"><i class="ri-tools-line"></i> ⚠️ ATTENTION : Révision requise - ${reason.join(' ET ')}</div>`;
                } else if (stats && (stats.alerts.dateAlert === 'orange' || stats.alerts.hoursAlert === 'orange')) {
                    statusClass = 'status-warning';
                    const reason = [];
                    if (stats.alerts.dateAlert === 'orange') reason.push(`Dans ${stats.diffDays} jours`);
                    if (stats.alerts.hoursAlert === 'orange') reason.push(`Dans ${Math.round(stats.hoursRemaining)}h`);

                    alertHtml = `<div class="equip-alert text-warning" style="color:#f59e0b; font-weight:bold; margin-bottom:8px;"><i class="ri-tools-line"></i> ⚠️ À réviser bientôt : ${reason.join(' OU ')}</div>`;
                }

                const typeBadgeColors = {
                    'voile': 'background: rgba(14, 165, 233, 0.1); color: var(--accent-blue);',
                    'sellette': 'background: rgba(245, 158, 11, 0.1); color: #f59e0b;',
                    'secours': 'background: rgba(239, 68, 68, 0.1); color: #ef4444;',
                    'accessoire': 'background: rgba(156, 163, 175, 0.1); color: #9ca3af;'
                };

                const equipIcon = equip.type === 'voile' ? 'ri-parachute-line' : equip.type === 'sellette' ? 'ri-shield-line' : equip.type === 'secours' ? 'ri-lifebuoy-line' : 'ri-settings-4-line';


                const isArchive = equip.statut === 'archive';
                const cardStyle = isArchive ? 'opacity: 0.6; filter: grayscale(0.8);' : '';

                html += `
                    <div class="equip-card ${statusClass}" style="${cardStyle} border:1px solid #eee; padding:15px; border-radius:8px; margin-bottom:15px; background:var(--bg-card); display:flex; flex-direction:column; justify-content:space-between; min-height:160px;">
                        ${alertHtml}
                        <div>
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                                <div class="equip-name" style="font-size:1.1rem; font-weight:600;">
                                    ${equip.nom}
                                    <span class="session-badge" style="margin-left: 8px; font-size:0.75rem; padding:2px 6px; border-radius:4px; ${typeBadgeColors[equip.type] || ''}">${equip.type.toUpperCase()}</span>
                                    ${isArchive ? '<span class="session-badge" style="margin-left: 4px; background: #333; color: white; font-size:0.75rem; padding:2px 6px; border-radius:4px;">ARCHIVÉ</span>' : ''}
                                </div>
                            </div>
                            <div class="session-details" style="font-size: 0.85rem; display:flex; gap:15px; margin-bottom: 6px;">
                                <span class="detail-item"><i class="ri-windy-line"></i> ${stats ? stats.totalSessions : 0} sessions</span>
                                <span class="detail-item"><i class="ri-time-line"></i> ${stats ? formatDuration(stats.totalTime) : '0h 00m'}</span>
                            </div>
                            <div class="equipment-secondary-details" style="font-size: 0.8rem; opacity: 0.8; display:flex; gap:15px; flex-wrap:wrap; margin-bottom: 12px;">
                                ${equip.dateAchat ? `<span class="detail-item"><strong>Achat:</strong> ${formatDateOnly(equip.dateAchat)}</span>` : ''}
                                ${equip.derniereRevision ? `<span class="detail-item"><strong>Dernière révision:</strong> ${formatDateOnly(equip.derniereRevision)}</span>` : ''}
                                ${stats && stats.nextRevisionDate ? `<span class="detail-item"><strong>Prochaine révision:</strong> ${stats.revisionDateStr}</span>` : ''}
                                ${stats && stats.hoursRemaining !== null ? `<span class="detail-item"><strong>Heures avant révision:</strong> ${stats.hoursRemaining <= 0 ? `<span style="color:#ef4444; font-weight:bold;">Dépassé de ${Math.abs(Math.round(stats.hoursRemaining * 10) / 10)}h</span>` : `${Math.round(stats.hoursRemaining * 10) / 10}h`} (sur ${equip.periodiciteHeures}h)</span>` : ''}
                                ${equip.type === 'voile' && equip.ventMin !== undefined ? `<span class="detail-item"><strong>Plage de Vent:</strong> ${equip.ventMin} - ${equip.ventMax} km/h</span>` : ''}
                            </div>
                        </div>
                        <div style="display:flex; justify-content:flex-end; gap:12px; border-top:1px solid rgba(0,0,0,0.05); padding-top:8px; margin-top: auto;">
                            <button class="action-btn" data-action="editEquipment" data-args="'${equip.id}'" title="Modifier" style="background:none; border:none; cursor:pointer; font-size:1rem; color:var(--accent-blue);">
                                ✏️
                            </button>
                            <button class="action-btn" data-action="toggleEquipmentStatus" data-args="'${equip.id}'" title="${isArchive ? 'Désarchiver' : 'Archiver'}" style="background:none; border:none; cursor:pointer; font-size:1rem; color:#6b7280;">
                                <i class="${isArchive ? 'ri-arrow-go-back-line' : 'ri-archive-line'}"></i>
                            </button>
                            <button class="action-btn" data-action="deleteEquipment" data-args="'${equip.id}'" title="Supprimer définitivement" style="background:none; border:none; cursor:pointer; font-size:1rem; color:#ef4444;">
                                🗑️
                            </button>
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
        }

        container.innerHTML = html;
    }

    editEquipment(id) {
        const equip = LogbookService.getEquipmentById(id);
        if (!equip) return;

        document.getElementById('eq-id-edit').value = equip.id;
        document.getElementById('eq-nom').value = equip.nom || '';

        // Populate and set dropdowns for brand, model, size, color
        this.populateEquipmentDropdowns();
        this.setSelectOrAutre('eq-marque', 'eq-marque-autre', equip.marque || '');
        this.setSelectOrAutre('eq-modele', 'eq-modele-autre', equip.modele || '');
        this.setSelectOrAutre('eq-taille', 'eq-taille-autre', equip.taille || '');
        this.setSelectOrAutre('eq-couleur', 'eq-couleur-autre', equip.couleur || '');
        
        const typeSelect = document.getElementById('eq-type');
        typeSelect.value = equip.type || 'voile';
        
        const windLimitsDiv = document.getElementById('eq-wind-limits');
        if (windLimitsDiv) {
            windLimitsDiv.style.display = typeSelect.value === 'voile' ? 'flex' : 'none';
        }

        const minField = document.getElementById('eq-vent-min');
        if (minField) minField.value = equip.ventMin !== undefined ? equip.ventMin : 0;
        
        const maxField = document.getElementById('eq-vent-max');
        if (maxField) maxField.value = equip.ventMax !== undefined ? equip.ventMax : 25;

        document.getElementById('eq-achat').value = equip.dateAchat || '';
        document.getElementById('eq-derniere-revision').value = equip.derniereRevision || '';

        const periodiciteSelect = document.getElementById('eq-periodicite');
        if (equip.periodicite !== undefined) {
            periodiciteSelect.value = equip.periodicite;
        } else {
            periodiciteSelect.value = "24"; // Default
        }

        const periodiciteHeuresSelect = document.getElementById('eq-periodicite-heures');
        if (periodiciteHeuresSelect) {
            if (equip.periodiciteHeures !== undefined) {
                periodiciteHeuresSelect.value = equip.periodiciteHeures;
            } else {
                periodiciteHeuresSelect.value = "0"; // Default non applicable
            }
        }

        document.getElementById('eq-submit-btn').innerText = "Modifier l'équipement";
        document.getElementById('eq-cancel-btn').style.display = "inline-block";
        document.getElementById('eq-form-title').innerText = "Modifier l'Équipement";

        // Scroll vers le formulaire
        document.getElementById('equip-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    deleteEquipment(id) {
        if (confirm("Voulez-vous vraiment supprimer cet équipement ?")) {
            LogbookService.deleteEquipment(id);
            this.renderEquipment();
            this.populateEquipmentDropdowns();
        }
    }

    resetEquipmentForm() {
        const form = document.getElementById('equip-form');
        if (form) form.reset();

        // Hide all "Autre" text inputs
        ['eq-marque-autre', 'eq-modele-autre', 'eq-taille-autre', 'eq-couleur-autre'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.style.display = 'none';
                el.value = '';
            }
        });
        
        const windLimitsDiv = document.getElementById('eq-wind-limits');
        if (windLimitsDiv) windLimitsDiv.style.display = 'flex'; // Default type is 'voile'

        const idEditField = document.getElementById('eq-id-edit');
        if (idEditField) idEditField.value = '';

        const submitBtn = document.getElementById('eq-submit-btn');
        if (submitBtn) submitBtn.innerText = "Enregistrer l'équipement";

        const cancelBtn = document.getElementById('eq-cancel-btn');
        if (cancelBtn) cancelBtn.style.display = "none";

        const formTitle = document.getElementById('eq-form-title');
        if (formTitle) formTitle.innerText = "Ajouter un Équipement";

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
        const val = Math.floor((deg / 22.5) + 0.5);
        return dirs[(val % 16)];
    }

    forceWeatherRefresh(sessionId) {
        const session = LogbookService.getFlights().find(s => s.id === sessionId);
        if (!session) return;

        // 1. Immediately show loading state in the UI to remove any error banner
        const container = document.getElementById('weather-container-' + sessionId);
        if (container) {
            container.innerHTML = '<div style="color: var(--accent-blue); font-size: 0.85rem; padding: 8px 12px; background: rgba(14,165,233,0.08); border-radius: var(--radius-sm); display: inline-flex; align-items: center; gap: 6px;"><i class="ri-loader-4-line ri-spin"></i> <strong>Récupération AROME en cours...</strong></div>';
        }

        let lat = null, lon = null;
        const siteName = session.site || session.lieu || "";

        if (session.lat && session.lon) {
            lat = session.lat;
            lon = session.lon;
            console.log("[Météo Logbook] Utilisation des coordonnées IGC en dur (Refresh) :", lat, lon);
        } else {
            if (siteName && typeof SITES_DATA !== 'undefined') {
                console.log("[Météo Logbook] Saisie (Refresh) :", siteName);

                const foundSite = this.findSiteByName(siteName);
                if (foundSite) {
                    console.log("[Météo Logbook] Site trouvé au rafraîchissement :", foundSite.nom);
                    const coords = this.getSiteCoords(foundSite);
                    if (coords.lat && coords.lon) {
                        lat = coords.lat;
                        lon = coords.lon;
                    } else {
                        console.warn("[Météo Logbook] Le site n'a pas de coordonnées valides :", foundSite);
                    }
                } else {
                    console.error("[Météo Logbook] Aucun match pour :", siteName);
                }
            }
        }

        if (lat && lon) {
            this.fetchWeatherForSession(lat, lon, session.datetime, session.id);
        } else {
            if (container) {
                const searchedString = this.normalizeString(siteName || "VIDE");
                const availableNamesSample = typeof SITES_DATA !== 'undefined' ? SITES_DATA.slice(0, 3).map(s => this.normalizeString(s.nom)).join(' | ') : 'SITES_DATA NOT FOUND';
                container.innerHTML = `<div style="color: #ef4444; font-size: 0.85rem; padding: 8px 12px; background: rgba(239,68,68,0.08); border-radius: var(--radius-sm); line-height: 1.4;"><i class="ri-error-warning-line"></i> <strong>Erreur Météo :</strong> Saisie [${escapeHTML(searchedString)}] non trouvée dans SITES_DATA.<br><span style="font-size: 0.75rem; opacity: 0.8; word-break: break-all;">Échantillon base : [${availableNamesSample}]</span></div>`;
            }
        }
    }

    // --- WEATHER MODULE (Open-Meteo) ---
    async fetchWeatherForSession(lat, lon, datetimeStr, sessionId) {
        console.log(`Fetching weather for session ${sessionId}...`);
        const result = await LogbookService.fetchSessionWeather(lat, lon, datetimeStr);

        if (result.success) {
            const sessionIndex = LogbookService.getFlights().findIndex(s => s.id === sessionId);
            if (sessionIndex !== -1) {
                LogbookService.getFlights()[sessionIndex].meteo = result.data;
                LogbookService.saveFlights(); // Persiste en localStorage et déclenche la synchro Firestore

                // IMPORTANT: Force complete UI rerender to visually inject the block
                this.renderHistory();
                console.log(`Weather data fetched successfully for session ${sessionId}.`);
            }
        } else {
            console.error("Error fetching weather for session:", result.error);
            const container = document.getElementById('weather-container-' + sessionId);
            if (container) {
                container.innerHTML = `<div style="color: #f59e0b; font-size: 0.85rem; padding: 8px 12px; background: rgba(245,158,11,0.08); border-radius: var(--radius-sm);"><i class="ri-alert-line"></i> Météo indisponible : ${escapeHTML(result.error)}</div>`;
            }
        }
    } // Ends fetchWeather method

    async mount(params) {
        await super.mount(params);
        console.log("Mounting LogbookView with params", params);
        try {
            if (this.init) {
                this.init(typeof Engine !== 'undefined' ? Engine : window.Engine);
            }
            if (this.show) {
                this.show();
            }
        } catch (e) {
            console.error("Erreur de montage de LogbookView", e);
            super.renderErrorState(e.message || "Erreur critique du carnet", "logbook-screen");
        }
    }

    async unmount() {
        await super.unmount();
        console.log("Unmounting LogbookView");
        // Le Carnet n'utilise aucune librairie de Chart externe (graphiques générés en HTML pur).
        // Les écouteurs d'événements sont attachés à des éléments du DOM 
        // recréés par innerHTML, et sont donc automatiquement garbage collected.
    }
}

const LogbookView = new LogbookViewClass();
window.LogbookView = LogbookView;
export default LogbookView;
