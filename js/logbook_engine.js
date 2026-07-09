const LogbookEngine = {
    engine: null,
    data: [], // Array of sessions (vol or gonflage)
    equipData: [], // Array of equipment
    currentTab: 'history',
    currentFormType: 'vol',

    init: function(mainEngine) {
        this.engine = mainEngine;
        this.loadData();
        this.initEquipment();
        console.log("LogbookEngine initialized.");
    },

    normalizeString: function(str) {
        if (!str) return '';
        return str.toLowerCase()
                  .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Enlève les accents
                  .replace(/[^a-z0-9]/g, ''); // Enlève tout ce qui n'est pas alphanumérique
    },

    show: function() {
        this.loadData();
        this.switchTab(this.currentTab);
    },

    loadData: function() {
        const saved = localStorage.getItem('tp_logbook_data');
        if (saved) {
            try {
                this.data = JSON.parse(saved);
            } catch (e) {
                console.error("Error parsing logbook data", e);
                this.data = [];
            }
        } else {
            this.data = [];
        }
        // Ensure data is sorted by datetime descending
        this.data.sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
    },

    saveData: function() {
        localStorage.setItem('tp_logbook_data', JSON.stringify(this.data));
        
        // Trigger Cloud Sync if user is logged in
        if (window.FirebaseAuthEngine && window.FirebaseAuthEngine.currentUser) {
            window.FirebaseAuthEngine.syncLogbookData(this.data);
        }
    },

    initEquipment: function() {
        this.loadEquipmentData();

        const equipForm = document.getElementById('equip-form');
        if (equipForm) {
            equipForm.onsubmit = (e) => {
                e.preventDefault();
                
                const idEdit = document.getElementById('eq-id-edit').value;
                const periodicite = parseInt(document.getElementById('eq-periodicite').value, 10);
                const periodiciteHeures = parseInt(document.getElementById('eq-periodicite-heures').value, 10);
                const dateAchat = document.getElementById('eq-achat').value;
                const derniereRevision = document.getElementById('eq-derniere-revision').value;
                
                const equipDataObj = {
                    nom: document.getElementById('eq-nom').value,
                    type: document.getElementById('eq-type').value,
                    dateAchat: dateAchat,
                    derniereRevision: derniereRevision,
                    periodicite: periodicite,
                    periodiciteHeures: periodiciteHeures,
                    statut: 'actif'
                };

                let currentEquip = JSON.parse(localStorage.getItem('tp_equipment_data')) || [];
                let savedEquip = null;

                if (idEdit) {
                    // Mode Édition
                    const index = currentEquip.findIndex(eq => eq.id === idEdit);
                    if (index !== -1) {
                        equipDataObj.id = idEdit;
                        // Conserver le statut précédent
                        equipDataObj.statut = currentEquip[index].statut;
                        currentEquip[index] = equipDataObj;
                        savedEquip = equipDataObj;
                    }
                } else {
                    // Mode Création
                    equipDataObj.id = Date.now().toString();
                    currentEquip.push(equipDataObj);
                    savedEquip = equipDataObj;
                }

                localStorage.setItem('tp_equipment_data', JSON.stringify(currentEquip));
                
                // Mettre à jour l'instance
                if (typeof LogbookEngine !== 'undefined') {
                    LogbookEngine.equipData = currentEquip;
                } else {
                    this.equipData = currentEquip;
                }

                // Réinitialisation du formulaire
                if (typeof LogbookEngine !== 'undefined') {
                    LogbookEngine.resetEquipmentForm();
                }

                // Rafraîchissement dynamique de l'interface
                if (typeof LogbookEngine !== 'undefined') {
                    if (LogbookEngine.renderEquipment) LogbookEngine.renderEquipment();
                    if (LogbookEngine.populateDropdowns) LogbookEngine.populateDropdowns();
                }

                // Synchronisation Firebase en arrière-plan (si disponible)
                if (window.FirebaseAuthEngine && window.FirebaseAuthEngine.currentUser) {
                    if (typeof window.FirebaseAuthEngine.syncEquipmentEntry === 'function' && savedEquip) {
                        window.FirebaseAuthEngine.syncEquipmentEntry(savedEquip);
                    } else if (typeof window.FirebaseAuthEngine.syncEquipmentData === 'function') {
                        window.FirebaseAuthEngine.syncEquipmentData(currentEquip);
                    }
                }
            };
        }
    },

    loadEquipmentData: function() {
        const saved = localStorage.getItem('tp_equipment_data');
        if (saved) {
            try {
                this.equipData = JSON.parse(saved);
            } catch (e) {
                console.error("Error parsing equipment data", e);
                this.equipData = [];
            }
        } else {
            this.equipData = [];
        }
    },

    saveEquipmentData: function() {
        localStorage.setItem('tp_equipment_data', JSON.stringify(this.equipData));
        if (window.FirebaseAuthEngine && window.FirebaseAuthEngine.currentUser) {
            if (typeof window.FirebaseAuthEngine.syncEquipmentData === 'function') {
                window.FirebaseAuthEngine.syncEquipmentData(this.equipData);
            }
        }
    },

    switchTab: function(tabName) {
        this.currentTab = tabName;
        
        // Update Buttons
        document.querySelectorAll('.logbook-tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const activeBtn = document.querySelector(`.logbook-tab-btn[onclick*="'${tabName}'"]`);
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
    },

    setFormType: function(type) {
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
    },

    getCurrentDateTimeLocal: function() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    },

    renderForm: function() {
        const container = document.getElementById('form-fields-container');
        if (!container) return;

        let html = '';
        const defaultDateTime = this.getCurrentDateTimeLocal();

        if (this.currentFormType === 'vol') {
            html = `
                <div class="form-group igc-upload-container" style="border: 2px dashed var(--border-light, #ccc); border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 15px; cursor: pointer; background: var(--bg-card, #f9f9f9);" onclick="document.getElementById('igc-upload').click()">
                    <i class="ri-upload-cloud-line" style="font-size: 2rem; color: var(--accent-blue, #007bc4);"></i>
                    <div style="font-weight: bold; margin-top: 10px;">Importer une trace GPS (.igc)</div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary, #666); margin-top: 5px;" id="igc-upload-filename">Cliquez ou glissez-déposez le fichier</div>
                    <input type="file" id="igc-upload" accept=".igc" style="display:none;" onchange="LogbookEngine.handleIgcUpload(event)" />
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
                        <select id="lb-voile" required onchange="document.getElementById('lb-voile-autre').style.display = (this.value === 'Autre') ? 'block' : 'none';">
                            <option value="">-- Sélectionner --</option>
                        </select>
                        <input type="text" id="lb-voile-autre" placeholder="Spécifiez le modèle..." style="display:none; margin-top: 5px; width: 100%;">
                    </div>
                    <div class="form-group">
                        <label>Sellette</label>
                        <select id="lb-sellette" onchange="document.getElementById('lb-sellette-autre').style.display = (this.value === 'Autre') ? 'block' : 'none';">
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
                            try {
                                const stored = localStorage.getItem('customDecollageTechniques');
                                if (stored) {
                                    const parsed = JSON.parse(stored);
                                    if (Array.isArray(parsed)) return parsed.map(t => `<option value="${t}">${t}</option>`).join('');
                                }
                            } catch(e) {}
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

        // Ajout explicite de l'événement change pour forcer la compatibilité Mobile (iOS/Android)
        const igcUploadInput = document.getElementById('igc-upload');
        if (igcUploadInput) {
            igcUploadInput.addEventListener('change', (event) => {
                this.handleIgcUpload(event);
            });
        }
    },

    populateDropdowns: function() {
        // Populate Sites
        const datalist = document.getElementById('sites-list');
        if (datalist && typeof SITES_DATA !== 'undefined') {
            // 1. Filtrage (uniquement les sites affichables), formatage en MAJUSCULES et dédoublonnage strict
            const processedSites = [...new Set(
                SITES_DATA
                    .filter(site => site.affiche !== false && site.nom)
                    .map(site => site.nom.trim().toUpperCase())
            )];

            // 2. Tri alphabétique tenant compte des accents
            processedSites.sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));

            // 3. Injection propre dans le DOM
            datalist.innerHTML = processedSites.map(siteName => `<option value="${siteName}"></option>`).join('');
        }

        // Populate Equipment
        const voilesSelect = document.getElementById('lb-voile');
        const sellettesSelect = document.getElementById('lb-sellette');
        
        let voilesHtml = '<option value="">-- Saisie libre (ou choisir) --</option>';
        let sellettesHtml = '<option value="">-- Saisie libre (ou choisir) --</option>';

        this.equipData.filter(e => e.statut !== 'archive').forEach(equip => {
            if (equip.type === 'voile') {
                voilesHtml += `<option value="${equip.nom}">${equip.nom}</option>`;
            } else if (equip.type === 'sellette') {
                sellettesHtml += `<option value="${equip.nom}">${equip.nom}</option>`;
            }
        });

        if (voilesSelect) {
            voilesSelect.innerHTML = voilesHtml;
            // Add a way to allow free text input inside select using a trick, or we stick to select.
            // The prompt says "Remplacer les champs texte Voile et Sellette par des éléments <select>".
            // We can keep it strictly select, but add an "Autre" option that opens a prompt, or just stick to select.
            voilesSelect.innerHTML += '<option value="Autre">Autre...</option>';
        }
        if (sellettesSelect) {
            sellettesSelect.innerHTML = sellettesHtml;
            sellettesSelect.innerHTML += '<option value="Autre">Autre...</option>';
        }
    },

    fillLastEquipment: function() {
        // Automatically fill voile and sellette with the last used ones
        if (this.data.length > 0) {
            const lastSession = this.data[0];
            const voileInput = document.getElementById('lb-voile');
            const selletteInput = document.getElementById('lb-sellette');
            if (voileInput && lastSession.voile) voileInput.value = lastSession.voile;
            if (selletteInput && lastSession.sellette) selletteInput.value = lastSession.sellette;
        }
    },

    currentTraceData: null,

    handleIgcUpload: function(event) {
        const file = event.target.files[0];
        if (!file) return;

        const filenameLabel = document.getElementById('igc-upload-filename');
        if (filenameLabel) filenameLabel.textContent = file.name;

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            if (typeof IGCParser !== 'undefined') {
                const parsed = IGCParser.parse(text);
                if (parsed && parsed.points && parsed.points.length > 0) {
                    this.currentTraceData = parsed.points;
                    
                    const durationInput = document.getElementById('lb-duree');
                    if (durationInput && parsed.duration > 0) {
                        durationInput.value = parsed.duration;
                    }
                    const datetimeInput = document.getElementById('lb-datetime');
                    if (datetimeInput && parsed.dateStr) {
                        datetimeInput.value = parsed.dateStr;
                    }

                    const altMaxInput = document.getElementById('lb-altMax');
                    if (altMaxInput && parsed.maxAltitude > -1000) {
                        altMaxInput.value = parsed.maxAltitude;
                    }
                    const gainInput = document.getElementById('lb-gain');
                    if (gainInput && typeof parsed.gain === 'number' && !isNaN(parsed.gain)) {
                        gainInput.value = parsed.gain;
                    }

                    const siteInput = document.getElementById('lb-site');
                    if (siteInput && !siteInput.value.trim()) {
                        siteInput.value = "Recherche du lieu...";
                        fetch(`${AppConfig.API.NOMINATIM_BASE}/reverse?format=json&lat=${parsed.points[0].lat}&lon=${parsed.points[0].lon}`)
                            .then(res => res.json())
                            .then(data => {
                                const city = data.address.village || data.address.town || data.address.city || data.address.municipality || "Lieu inconnu";
                                siteInput.value = `${city} (Import GPS)`;
                            })
                            .catch(err => {
                                console.error("[Geocoding] Erreur:", err);
                                siteInput.value = "Décollage importé (GPS)";
                            });
                    }
                    console.log("[IGC] Trace parsée :", parsed.points.length, "points, durée :", parsed.duration, "min");
                } else {
                    alert("Fichier IGC invalide ou aucune donnée GPS trouvée.");
                    this.currentTraceData = null;
                }
            } else {
                console.error("IGCParser non trouvé !");
            }
        };
        reader.readAsText(file);
    },

    submitForm: function() {
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
                        rawTech = rawTech.charAt(0).toUpperCase() + rawTech.slice(1).toLowerCase();
                        techDecollage = rawTech;
                        
                        let customTechs = [];
                        try {
                            const stored = localStorage.getItem('customDecollageTechniques');
                            if (stored) customTechs = JSON.parse(stored);
                        } catch(e) {}
                        
                        if (Array.isArray(customTechs) && !customTechs.includes(techDecollage) && techDecollage !== 'Face voile' && techDecollage !== 'Dos voile') {
                            customTechs.push(techDecollage);
                            localStorage.setItem('customDecollageTechniques', JSON.stringify(customTechs));
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
                session.traceGps = this.currentTraceData;
                if (this.currentTraceData.length > 0) {
                    session.lat = this.currentTraceData[0].lat;
                    session.lon = this.currentTraceData[0].lon;
                }
                this.currentTraceData = null; // reset
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
            const index = this.data.findIndex(s => s.id === editId);
            if (index !== -1) {
                if (this.data[index].meteo) session.meteo = this.data[index].meteo;
                if (!this.currentTraceData && this.data[index].traceGps) {
                    session.traceGps = this.data[index].traceGps;
                }
                if (!session.lat && this.data[index].lat) session.lat = this.data[index].lat;
                if (!session.lon && this.data[index].lon) session.lon = this.data[index].lon;
                this.data[index] = session;
            }
        } else {
            this.data.push(session);
        }

        this.data.sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
        
        this.saveData();
        
        // Show success, reset and go to history
        alert(editId ? "Session modifiée avec succès !" : "Session enregistrée avec succès !");
        this.resetForm();
        this.switchTab('history');

        // Extract coordinates and fetch weather asynchronously
        let lat = null, lon = null;
        if (session.lat && session.lon) {
            lat = session.lat;
            lon = session.lon;
            console.log("[Météo Logbook] Utilisation des coordonnées IGC en dur :", lat, lon);
        } else {
            const siteName = session.site || session.lieu || "";
            if (siteName && typeof SITES_DATA !== 'undefined') {
                const sessionSiteStr = this.normalizeString(siteName);
                console.log("[Météo Logbook] Saisie normalisée :", sessionSiteStr);
                
                const foundSite = SITES_DATA.find(s => {
                    const dataSiteStr = this.normalizeString(s.nom || "");
                    return dataSiteStr === sessionSiteStr || dataSiteStr.includes(sessionSiteStr) || sessionSiteStr.includes(dataSiteStr);
                });
                
                if (foundSite) {
                    console.log("[Météo Logbook] Site trouvé :", foundSite.nom);
                    if (foundSite.lat && foundSite.lon) {
                        lat = foundSite.lat;
                        lon = foundSite.lon;
                    } else {
                        console.warn("[Météo Logbook] Le site n'a pas de coordonnées valides :", foundSite);
                    }
                } else {
                    console.error("[Météo Logbook] Aucun match pour :", sessionSiteStr);
                }
            }
        }

        if (!lat || !lon) {
            const sessionDate = new Date(session.datetime).toDateString();
            const todayDate = new Date().toDateString();
            // Fallback to geolocation if it's today's session
            if (sessionDate === todayDate && navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        this.fetchWeatherForSession(position.coords.latitude, position.coords.longitude, session.datetime, session.id);
                    },
                    (error) => {
                        console.warn("Geolocation failed or denied, skipping weather fetch:", error);
                    }
                );
                return;
            }
        }

        if (lat && lon) {
            this.fetchWeatherForSession(lat, lon, session.datetime, session.id);
        }
    },

    resetForm: function() {
        const form = document.getElementById('logbook-add-form');
        if (form) form.reset();
        const idEditField = document.getElementById('lb-id-edit');
        if (idEditField) idEditField.value = '';
        const submitBtn = document.getElementById('lb-submit-btn');
        if (submitBtn) submitBtn.innerText = "Enregistrer";
        const cancelBtn = document.getElementById('lb-cancel-btn');
        if (cancelBtn) cancelBtn.style.display = "none";
        this.currentTraceData = null;
        const filenameLabel = document.getElementById('igc-upload-filename');
        if (filenameLabel) filenameLabel.textContent = "Cliquez ou glissez-déposez le fichier";
        this.renderForm();
    },

    editEntry: function(id) {
        const session = this.data.find(s => s.id === id);
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
    },

    deleteEntry: function(id) {
        if (confirm("Voulez-vous vraiment supprimer cette session ?")) {
            this.data = this.data.filter(s => s.id !== id);
            this.saveData();
            
            // Sync deletion to cloud if implemented
            if (window.FirebaseAuthEngine && window.FirebaseAuthEngine.currentUser) {
                window.FirebaseAuthEngine.deleteLogbookEntry(id);
            }
            
            this.renderHistory();
        }
    },

    formatDuration: function(minutes) {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        if (h === 0) return `${m}min`;
        return `${h}h ${m.toString().padStart(2, '0')}min`;
    },

    formatDate: function(dateStr) {
        const d = new Date(dateStr);
        return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + 
               ' à ' + 
               d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute:'2-digit' });
    },

    formatDateOnly: function(dateStr) {
        const d = new Date(dateStr);
        return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    },

    renderHistory: function() {
        const container = document.getElementById('logbook-history-list');
        if (!container) return;

        if (this.data.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="ri-history-line"></i>
                    <p>Votre carnet est vide.</p>
                    <button class="action-btn-primary" onclick="LogbookEngine.switchTab('add')">Ajouter une session</button>
                </div>
            `;
            return;
        }

        let html = '';
        this.data.forEach(session => {
            const isVol = session.type === 'vol';
            const icon = isVol ? 'ri-windy-line' : 'ri-footprint-line';
            const typeColor = isVol ? 'var(--accent-blue)' : '#f59e0b';
            const location = isVol ? session.site : session.lieu;
            const subtitle = isVol ? session.typeVol : (Array.isArray(session.typeExercice) ? session.typeExercice.join(', ') : session.typeExercice);
            
            let extraInfo = '';
            if (isVol) {
                const badgeStyle = "background: var(--bg-card-hover, rgba(0,0,0,0.05)); padding: 4px 8px; border-radius: 6px; border: 1px solid var(--border-light, rgba(0,0,0,0.05)); font-weight: 500; display: inline-flex; align-items: center; gap: 4px;";
                let decoInfo = session.techDecollage ? `<span style="${badgeStyle}" title="Décollage"><i class="ri-takeaway-line"></i> Décollage : ${session.techDecollage}</span>` : '';
                let altInfo = session.altitudeMax ? `<span style="${badgeStyle}" title="Alt Max">⛰️ Alt Max : ${session.altitudeMax}m</span>` : '';
                let gainInfo = (session.gain !== undefined && session.gain !== null && session.gain !== '') ? `<span style="${badgeStyle}" title="Gain">📈 Gain : ${session.gain}m</span>` : '';
                
                if (decoInfo || altInfo || gainInfo) {
                    extraInfo = `<div class="session-extra-info" style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; font-size: 0.82rem; color: var(--text-secondary);">
                        ${decoInfo}
                        ${altInfo}
                        ${gainInfo}
                    </div>`;
                }
            }

            let meteoHtml = '';
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
                    <button id="refresh-weather-btn-${session.id}" class="action-btn-text" onclick="LogbookEngine.forceWeatherRefresh('${session.id}')" style="color: var(--text-muted); cursor: pointer; border: none; background: rgba(0,0,0,0.03); border-radius: var(--radius-sm); padding: 6px 12px; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s;">
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
                        <div class="session-date">${this.formatDate(session.datetime)}</div>
                        <div style="display: flex; gap: 8px;">
                            <button class="edit-btn" onclick="LogbookEngine.editEntry('${session.id}')" title="Modifier" style="background: none; border: none; color: var(--text-secondary); cursor: pointer; padding: 4px; border-radius: 4px; transition: all 0.2s;">
                                <i class="ri-edit-line"></i>
                            </button>
                            <button class="delete-btn" onclick="LogbookEngine.deleteEntry('${session.id}')" title="Supprimer" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 4px; border-radius: 4px; transition: all 0.2s;">
                                <i class="ri-delete-bin-line"></i>
                            </button>
                        </div>
                    </div>
                    <div class="logbook-card-body">
                        <div class="session-location">${location}</div>
                        <div class="session-details">
                            <span class="detail-item"><i class="ri-time-line"></i> ${this.formatDuration(session.duree)}</span>
                            <span class="detail-item"><i class="${subtitle.toLowerCase().includes('thermique') ? 'ri-fire-line' : subtitle.toLowerCase().includes('cross') ? 'ri-route-line' : subtitle.toLowerCase().includes('plouf') ? 'ri-arrow-left-down-line' : subtitle.toLowerCase().includes('restit') || subtitle.toLowerCase().includes('soaring') ? 'ri-sun-cloud-line' : subtitle.toLowerCase().includes('gonflage') ? 'ri-footprint-line' : 'ri-price-tag-3-line'}"></i> ${subtitle}</span>
                        </div>
                        ${extraInfo}
                        <div class="session-equip">
                            ${session.voile ? `<div><strong>Voile :</strong> ${session.voile}</div>` : ''}
                            ${session.sellette ? `<div><strong>Sellette :</strong> ${session.sellette}</div>` : ''}
                        </div>
                        ${session.commentaire ? `<div class="session-comment">"${session.commentaire}"</div>` : ''}
                        ${session.traceGps && session.traceGps.length > 0 ? `<button class="btn-view-trace action-btn-secondary" style="margin-top: 10px; width: 100%; border: 1px solid var(--accent-blue); color: var(--accent-blue); padding: 8px; border-radius: 6px; cursor: pointer; background: transparent; transition: all 0.2s;" onclick="LogbookEngine.showTrace('${session.id}')"><i class="ri-route-line"></i> Voir la trace 🗺️</button><div id="trace-container-${session.id}" style="display:none; margin-top: 10px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border-light);"></div>` : ''}
                        ${meteoHtml}
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    },

    showTrace: function(sessionId) {
        const container = document.getElementById(`trace-container-${sessionId}`);
        if (!container) return;

        if (container.style.display === 'block') {
            container.style.display = 'none';
            if (typeof Map3DComponent !== 'undefined') {
                Map3DComponent.clearPlayback();
            }
            return;
        }

        const session = this.data.find(s => s.id === sessionId);
        if (!session || !session.traceGps || session.traceGps.length === 0) return;

        if (typeof Map3DComponent !== 'undefined') {
            Map3DComponent.showTrace(sessionId, session.traceGps, container);
        } else {
            console.error("Map3DComponent n'est pas chargé.");
        }
    },

    renderStats: function() {
        const container = document.getElementById('logbook-stats-container');
        if (!container) return;

        if (this.data.length === 0) {
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
        
        let equipStats = {}; // { voileName: { vols: 0, timeVols: 0, gonflages: 0, timeGonflages: 0 } }
        let sitesStats = {}; // { siteName: count }
        let volTypes = {};   // { typeName: count }
        let exoTypes = {};   // { typeName: count }
        let decoTypes = {};  // { typeName: count }
        
        let maxAltitudeReached = 0;
        let totalGain = 0;

        this.data.forEach(s => {
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
                        <div class="kpi-label">${this.formatDuration(totalTimeVols)} cumulé</div>
                    </div>
                </div>
                <!-- KPI: Gonflages -->
                <div class="kpi-card">
                    <div class="kpi-icon" style="background: #f59e0b; color: white;"><i class="ri-footprint-line"></i></div>
                    <div class="kpi-info">
                        <div class="kpi-value">${totalGonflages} sessions</div>
                        <div class="kpi-label">${this.formatDuration(totalTimeGonflages)} gonflage</div>
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
                        <div class="equip-name"><i class="ri-parachute-line"></i> ${voile}</div>
                        <div class="equip-details">
                            <span style="color: var(--accent-blue)">Vols: ${st.vols} (${this.formatDuration(st.timeVols)})</span>
                            <span style="color: #f59e0b">Gonflage: ${st.gonflages} (${this.formatDuration(st.timeGonflages)})</span>
                        </div>
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
            let totalDeco = Object.values(decoTypes).reduce((a,b) => a+b, 0);
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
    },

    calculateNextRevision: function(equip) {
        if (!equip.periodicite || equip.periodicite <= 0) return null;
        
        // Date de référence: dernière révision, ou date d'achat, ou rien
        let refDateStr = equip.derniereRevision || equip.dateAchat;
        if (!refDateStr) return null;

        const refDate = new Date(refDateStr);
        if (isNaN(refDate.getTime())) return null;

        // Ajouter la périodicité (en mois)
        const nextRevDate = new Date(refDate);
        nextRevDate.setMonth(nextRevDate.getMonth() + parseInt(equip.periodicite, 10));
        return nextRevDate;
    },

    renderEquipment: function() {
        const container = document.getElementById('logbook-equip-container');
        if (!container) return;

        // Sort: actifs first, then by date added
        const sortedEquip = [...this.equipData].sort((a, b) => {
            if (a.statut === 'actif' && b.statut !== 'actif') return -1;
            if (a.statut !== 'actif' && b.statut === 'actif') return 1;
            return 0; // maintain original insertion order if same status
        });

        // Compute stats cross referencing logbook data
        const equipStats = {};
        this.equipData.forEach(e => {
            equipStats[e.nom.toLowerCase()] = { totalSessions: 0, totalTime: 0 };
        });

        this.data.forEach(s => {
            const voileName = (s.voile || "").toLowerCase();
            const selletteName = (s.sellette || "").toLowerCase();
            
            if (equipStats[voileName]) {
                equipStats[voileName].totalSessions++;
                equipStats[voileName].totalTime += s.duree;
            }
            if (equipStats[selletteName]) {
                equipStats[selletteName].totalSessions++;
                equipStats[selletteName].totalTime += s.duree;
            }
        });

        const today = new Date('2026-07-06T00:00:00'); // Date de référence selon specs

        let html = `<h3 class="stats-section-title">Mon Inventaire</h3>`;

        if (sortedEquip.length === 0) {
            html += `<div class="empty-state"><p>Aucun équipement enregistré.</p></div>`;
        } else {
            html += `<div class="equip-list">`;
            sortedEquip.forEach(equip => {
                const stats = equipStats[equip.nom.toLowerCase()];
                
                let alertHtml = '';
                let statusClass = 'status-ok';
                let revisionDateStr = '';
                
                // Calcul par Temps
                const nextRevDate = this.calculateNextRevision(equip) || (equip.dateControle ? new Date(equip.dateControle) : null);
                
                let diffDays = Infinity;
                if (nextRevDate) {
                    revisionDateStr = this.formatDateOnly(nextRevDate.toISOString().split('T')[0]);
                    diffDays = Math.ceil((nextRevDate - today) / (1000 * 60 * 60 * 24));
                }

                // Calcul par Heures
                let hoursExceeded = false;
                let hoursWarning = false;
                let hoursRemaining = null;
                const equipHours = stats ? (stats.totalTime / 60) : 0;
                
                if (equip.periodiciteHeures && equip.periodiciteHeures > 0) {
                    hoursRemaining = equip.periodiciteHeures - equipHours;
                    if (hoursRemaining <= 0) {
                        hoursExceeded = true;
                    } else if (hoursRemaining <= 15) { // 15 heures avant révision
                        hoursWarning = true;
                    }
                }
                
                // Logique des alertes combinées (OU)
                if (diffDays < 0 || hoursExceeded) {
                    statusClass = 'status-danger';
                    let reason = [];
                    if (diffDays < 0) reason.push(`Date dépassée (${revisionDateStr})`);
                    if (hoursExceeded) reason.push(`Heures dépassées (${Math.round(equipHours)}h / ${equip.periodiciteHeures}h)`);
                    
                    alertHtml = `<div class="equip-alert text-danger" style="color:#ef4444; font-weight:bold; margin-bottom:8px;"><i class="ri-tools-line"></i> ⚠️ ATTENTION : Révision requise - ${reason.join(' ET ')}</div>`;
                } else if (diffDays <= 30 || hoursWarning) {
                    statusClass = 'status-warning';
                    let reason = [];
                    if (diffDays <= 30 && diffDays !== Infinity) reason.push(`Dans ${diffDays} jours`);
                    if (hoursWarning) reason.push(`Dans ${Math.round(hoursRemaining)}h`);
                    
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
                    <div class="equip-card ${statusClass}" style="${cardStyle} border:1px solid #eee; padding:15px; border-radius:8px; margin-bottom:15px; background:var(--bg-card);">
                        ${alertHtml}
                        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                            <div class="equip-name" style="font-size:1.1rem; font-weight:600;">
                                ${equip.nom}
                                <span class="session-badge" style="margin-left: 8px; font-size:0.75rem; padding:2px 6px; border-radius:4px; ${typeBadgeColors[equip.type] || ''}">${equip.type.toUpperCase()}</span>
                                ${isArchive ? '<span class="session-badge" style="margin-left: 4px; background: #333; color: white; font-size:0.75rem; padding:2px 6px; border-radius:4px;">ARCHIVÉ</span>' : ''}
                            </div>
                            <div class="equip-actions" style="display:flex; gap:8px;">
                                <button class="action-btn" onclick="LogbookEngine.editEquipment('${equip.id}')" title="Modifier" style="background:none; border:none; cursor:pointer; font-size:1.2rem; color:var(--accent-blue);">
                                    ✏️
                                </button>
                                <button class="action-btn" onclick="LogbookEngine.toggleEquipmentStatus('${equip.id}')" title="${isArchive ? 'Désarchiver' : 'Archiver'}" style="background:none; border:none; cursor:pointer; font-size:1.2rem; color:#6b7280;">
                                    <i class="${isArchive ? 'ri-arrow-go-back-line' : 'ri-archive-line'}"></i>
                                </button>
                                <button class="action-btn" onclick="LogbookEngine.deleteEquipment('${equip.id}')" title="Supprimer définitivement" style="background:none; border:none; cursor:pointer; font-size:1.2rem; color:#ef4444;">
                                    🗑️
                                </button>
                            </div>
                        </div>
                        <div class="session-details" style="margin-top: 12px; font-size: 0.85rem; display:flex; gap:15px;">
                            <span class="detail-item"><i class="ri-windy-line"></i> ${stats ? stats.totalSessions : 0} sessions</span>
                            <span class="detail-item"><i class="ri-time-line"></i> ${stats ? this.formatDuration(stats.totalTime) : '0h 00m'}</span>
                        </div>
                        <div class="session-details" style="margin-top: 6px; font-size: 0.8rem; opacity: 0.8; display:flex; gap:15px; flex-wrap:wrap;">
                            ${equip.dateAchat ? `<span class="detail-item"><strong>Achat:</strong> ${this.formatDateOnly(equip.dateAchat)}</span>` : ''}
                            ${equip.derniereRevision ? `<span class="detail-item"><strong>Dernière révision:</strong> ${this.formatDateOnly(equip.derniereRevision)}</span>` : ''}
                            ${nextRevDate ? `<span class="detail-item"><strong>Prochaine révision:</strong> ${revisionDateStr}</span>` : ''}
                            ${hoursRemaining !== null ? `<span class="detail-item"><strong>Heures avant révision:</strong> ${hoursRemaining <= 0 ? `<span style="color:#ef4444; font-weight:bold;">Dépassé de ${Math.abs(Math.round(hoursRemaining * 10) / 10)}h</span>` : `${Math.round(hoursRemaining * 10) / 10}h`} (sur ${equip.periodiciteHeures}h)</span>` : ''}
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
        }

        container.innerHTML = html;
    },

    editEquipment: function(id) {
        const equip = this.equipData.find(e => e.id === id);
        if (!equip) return;

        document.getElementById('eq-id-edit').value = equip.id;
        document.getElementById('eq-nom').value = equip.nom || '';
        document.getElementById('eq-type').value = equip.type || 'voile';
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
    },

    deleteEquipment: function(id) {
        if (confirm("Voulez-vous vraiment supprimer définitivement cet équipement ?")) {
            // Remove from local array
            this.equipData = this.equipData.filter(e => e.id !== id);
            this.saveEquipmentData();
            
            // Re-render
            this.renderEquipment();
            
            // Delete from Cloud
            if (window.FirebaseAuthEngine && window.FirebaseAuthEngine.currentUser && typeof window.FirebaseAuthEngine.deleteEquipmentEntry === 'function') {
                window.FirebaseAuthEngine.deleteEquipmentEntry(id);
            }
        }
    },

    resetEquipmentForm: function() {
        const form = document.getElementById('equip-form');
        if (form) form.reset();
        
        const idEditField = document.getElementById('eq-id-edit');
        if (idEditField) idEditField.value = '';
        
        const submitBtn = document.getElementById('eq-submit-btn');
        if (submitBtn) submitBtn.innerText = "Enregistrer l'équipement";
        
        const cancelBtn = document.getElementById('eq-cancel-btn');
        if (cancelBtn) cancelBtn.style.display = "none";
        
        const formTitle = document.getElementById('eq-form-title');
        if (formTitle) formTitle.innerText = "Ajouter un Équipement";
    },

    toggleEquipmentStatus: function(id) {
        const equip = this.equipData.find(e => e.id === id);
        if (equip) {
            equip.statut = equip.statut === 'actif' ? 'archive' : 'actif';
            this.saveEquipmentData();
            this.renderEquipment();
        }
    },

    getWeatherEmoji: function(code) {
        if (code === 0) return '☀️';
        if (code === 1 || code === 2) return '🌤️';
        if (code === 3) return '☁️';
        if (code >= 45 && code <= 48) return '🌫️';
        if (code >= 51 && code <= 67) return '🌧️';
        if (code >= 71 && code <= 77) return '❄️';
        if (code >= 80 && code <= 82) return '🌦️';
        if (code >= 95) return '⛈️';
        return '☀️';
    },

    getWindDirectionString: function(deg) {
        if (deg === null || deg === undefined) return '';
        const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
        const val = Math.floor((deg / 22.5) + 0.5);
        return dirs[(val % 16)];
    },

    forceWeatherRefresh: function(sessionId) {
        const session = this.data.find(s => s.id === sessionId);
        if (!session) return;
        
        // 1. Immediately show loading state in the UI to remove any error banner
        const container = document.getElementById('weather-container-' + sessionId);
        if (container) {
            container.innerHTML = '<div style="color: var(--accent-blue); font-size: 0.85rem; padding: 8px 12px; background: rgba(14,165,233,0.08); border-radius: var(--radius-sm); display: inline-flex; align-items: center; gap: 6px;"><i class="ri-loader-4-line ri-spin"></i> <strong>Récupération AROME en cours...</strong></div>';
        }
        
        let lat = null, lon = null;
        
        if (session.lat && session.lon) {
            lat = session.lat;
            lon = session.lon;
            console.log("[Météo Logbook] Utilisation des coordonnées IGC en dur (Refresh) :", lat, lon);
        } else {
            const siteName = session.site || session.lieu || "";
            if (siteName && typeof SITES_DATA !== 'undefined') {
                const sessionSiteStr = this.normalizeString(siteName);
                console.log("[Météo Logbook] Saisie normalisée (Refresh) :", sessionSiteStr);
                
                const foundSite = SITES_DATA.find(s => {
                    const dataSiteStr = this.normalizeString(s.nom || "");
                    return dataSiteStr === sessionSiteStr || dataSiteStr.includes(sessionSiteStr) || sessionSiteStr.includes(dataSiteStr);
                });
                
                if (foundSite) {
                    console.log("[Météo Logbook] Site trouvé au rafraîchissement :", foundSite.nom);
                    if (foundSite.lat && foundSite.lon) {
                        lat = foundSite.lat;
                        lon = foundSite.lon;
                    } else {
                        console.warn("[Météo Logbook] Le site n'a pas de coordonnées valides :", foundSite);
                    }
                } else {
                    console.error("[Météo Logbook] Aucun match pour :", sessionSiteStr);
                }
            }
        }
        
        if (lat && lon) {
            this.fetchWeatherForSession(lat, lon, session.datetime, session.id);
        } else {
            if (container) {
                const searchedString = this.normalizeString(siteName || "VIDE");
                const availableNamesSample = typeof SITES_DATA !== 'undefined' ? SITES_DATA.slice(0, 3).map(s => this.normalizeString(s.nom)).join(' | ') : 'SITES_DATA NOT FOUND';
                container.innerHTML = `<div style="color: #ef4444; font-size: 0.85rem; padding: 8px 12px; background: rgba(239,68,68,0.08); border-radius: var(--radius-sm); line-height: 1.4;"><i class="ri-error-warning-line"></i> <strong>Erreur Météo :</strong> Saisie [${searchedString}] non trouvée dans SITES_DATA.<br><span style="font-size: 0.75rem; opacity: 0.8; word-break: break-all;">Échantillon base : [${availableNamesSample}]</span></div>`;
            }
        }
    },

    // --- WEATHER MODULE (Open-Meteo) ---
    fetchWeatherForSession: async function(lat, lon, datetimeStr, sessionId) {
        try {
            const dateObj = new Date(datetimeStr);
            const dateStrQuery = datetimeStr.split('T')[0];
            const hour = dateObj.getHours(); // 0-23
            
            // L'API Open-Meteo "forecast" avec start_date et end_date permet de récupérer
            // les données passées récentes. On utilise models=meteofrance_seamless qui encapsule AROME/ARPEGE.
            const parsedLat = parseFloat(lat);
            const parsedLon = parseFloat(lon);
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${parsedLat}&longitude=${parsedLon}&hourly=temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code&wind_speed_unit=kmh&timezone=auto&start_date=${dateStrQuery}&end_date=${dateStrQuery}&models=meteofrance_seamless`;
            
            console.log(`Fetching weather for session ${sessionId}...`);
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Open-Meteo API error: ${response.status}`);
            }
            
            const result = await response.json();
            if (result && result.hourly && result.hourly.temperature_2m) {
                const temp = result.hourly.temperature_2m[hour];
                const windSpeed = result.hourly.wind_speed_10m[hour];
                const windGusts = result.hourly.wind_gusts_10m[hour];
                const windDir = result.hourly.wind_direction_10m[hour];
                const weatherCode = result.hourly.weather_code[hour];
                
                if (temp !== undefined && temp !== null && windSpeed !== undefined && windSpeed !== null) {
                    const sessionIndex = this.data.findIndex(s => s.id === sessionId);
                    if (sessionIndex !== -1) {
                        this.data[sessionIndex].meteo = {
                            temperature: Math.round(temp),
                            ventVitesse: Math.round(windSpeed),
                            ventRafales: windGusts !== undefined && windGusts !== null ? Math.round(windGusts) : null,
                            ventDirection: windDir !== undefined && windDir !== null ? Math.round(windDir) : null,
                            weatherCode: weatherCode !== undefined && weatherCode !== null ? weatherCode : null,
                            source: "auto"
                        };
                        this.saveData(); // This persists to localStorage and triggers Firestore Sync
                        
                        // IMPORTANT: Force complete UI rerender to visually inject the block
                        this.renderHistory();
                        console.log(`Weather data fetched successfully for session ${sessionId}.`);
                    }
                } else {
                    throw new Error("Données hors couverture (trop ancien)");
                }
            } else {
                throw new Error("Format JSON inattendu de l'API");
            }
        } catch (error) {
            console.error("Error fetching weather for session:", error);
            const container = document.getElementById('weather-container-' + sessionId);
            if (container) {
                container.innerHTML = `<div style="color: #f59e0b; font-size: 0.85rem; padding: 8px 12px; background: rgba(245,158,11,0.08); border-radius: var(--radius-sm);"><i class="ri-alert-line"></i> Météo indisponible : ${error.message}</div>`;
            }
        }
    }
};

window.LogbookEngine = LogbookEngine;
