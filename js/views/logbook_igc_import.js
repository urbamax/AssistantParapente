/**
 * VIEW - Logbook IGC import
 * Base class of LogbookView (see logbook.js): the IGC / SDF import of the session form (reading
 * the files, filling the form from the trace, recalculating from the stored trace, altitude
 * check) and the imported-trace state. Kept in its own file so logbook.js stays smaller;
 * behaviour is unchanged.
 */
import LogbookService from '../services/logbook_service.js';
import SdfParser from '../services/sdf_parser.js';
import SitesService from '../services/sites_service.js';
import { formatCoordinates } from '../utils/geo_utils.js';
import { classifyFlight } from '../services/flight_classifier.js';
import { addMinutesToDatetimeLocal } from '../utils/date_utils.js';
import { tt, th, tl } from './logbook_strings.js';
import { LogbookFfvlImportBase } from './logbook_ffvl_import.js';

export class LogbookIgcImportBase extends LogbookFfvlImportBase {
    currentTraceData = null;

    currentRawIgc = null;

    currentIgcStats = null;

    // null = correction d'altitude non touchée dans ce formulaire (on ne réécrit pas altOffset)
    currentIgcAltOffset = null;

    // Capteurs du vario (facteur de charge, température) lus dans le .sdf Syride
    currentSensorStats = null;

    // Trace du formulaire en cours (import ou vol modifié), pour caler le .sdf dessus
    currentTraceInfo = null;

    // Heure et durée saisies par le pilote (trace commençant en vol) : jamais écrasées par un recalcul
    manualTimeFields = new Set();

    // Heure d'atterrissage de la trace (datetime-local) quand elle commence déjà en vol
    igcLandingStr = null;

    triggerIgcUpload() {
        const fileInput = document.getElementById('global-igc-input');
        if (fileInput) fileInput.click();
    }

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
        // Deux fichiers de vol ou plus : un tableau d'une ligne par vol, au lieu du formulaire d'un seul vol
        if (files.filter((f) => !isSdf(f)).length >= 2) {
            await this.openBatchImport(files);
            return;
        }
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

            // Les sites servent déjà au parsing (une trace qui démarre sur un décollage connu n'est
            // pas un vario allumé en vol) : ils doivent être chargés avant.
            await SitesService.ensureSitesLoaded().catch(() => null);
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

    setTakeoffFromDuration() {
        const datetimeInput = /** @type {HTMLInputElement} */ (document.getElementById('lb-datetime'));
        const dureeInput = /** @type {HTMLInputElement} */ (document.getElementById('lb-duree'));
        const minutes = parseInt(dureeInput?.value, 10);
        const box = /** @type {HTMLInputElement} */ (document.getElementById('lb-vario-in-flight'));
        const offBox = /** @type {HTMLInputElement} */ (document.getElementById('lb-vario-off-in-flight'));
        // Éteint aussi en vol : l'atterrissage de la trace n'est pas le vrai, rien à déduire
        if (!box?.checked || offBox?.checked || !this.igcLandingStr || !datetimeInput || !(minutes > 0)) return;
        if (this.manualTimeFields.has('lb-datetime')) return;
        const start = addMinutesToDatetimeLocal(this.igcLandingStr, -minutes);
        if (start) datetimeInput.value = start;
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
        if (durationInput && parsed.duration > 0 && !this.manualTimeFields.has('lb-duree')) {
            durationInput.value = parsed.duration;
        }
        const datetimeInput = /** @type {HTMLInputElement} */ (document.getElementById('lb-datetime'));
        if (datetimeInput && parsed.dateStr && !this.manualTimeFields.has('lb-datetime')) {
            datetimeInput.value = parsed.dateStr;
        }
        this.igcLandingStr = addMinutesToDatetimeLocal(parsed.dateStr, parsed.duration);
        const varioBox = /** @type {HTMLInputElement} */ (document.getElementById('lb-vario-in-flight'));
        const varioOffBox = /** @type {HTMLInputElement} */ (document.getElementById('lb-vario-off-in-flight'));
        if (varioOffBox && parsed.endsAirborne && !this.manualTimeFields.has('lb-vario-off-in-flight'))
            varioOffBox.checked = true;
        if (varioBox && parsed.startsAirborne && !this.manualTimeFields.has('lb-vario-in-flight'))
            varioBox.checked = true;
        const filenameNote = document.getElementById('igc-upload-filename');
        if (filenameNote && parsed.startsAirborne && parsed.endsAirborne)
            filenameNote.textContent = tl('igc.startsAndEndsAirborne');
        else if (filenameNote && parsed.startsAirborne) filenameNote.textContent = tl('igc.startsAirborne');
        else if (filenameNote && parsed.endsAirborne) filenameNote.textContent = tl('igc.endsAirborne');

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
        this._suggestLandingApproach(parsed.landingApproach);
    }

    // Prise de terrain lue dans la trace : une suggestion, jamais à la place d'un choix du pilote.
    // Une trace qui n'en donne pas efface celle d'une trace importée juste avant.
    _suggestLandingApproach(detected) {
        const select = /** @type {HTMLSelectElement|null} */ (document.getElementById('lb-prise-terrain'));
        if (!select || this.touchedFields.has('priseTerrain')) return;
        const suggested = this.learnedFields.has('priseTerrain');
        if (!suggested && select.value) return;
        const other = document.getElementById('lb-prise-terrain-autre');
        if (other) other.style.display = 'none';
        if (detected && Array.from(select.options).some((o) => o.value === detected.pattern)) {
            select.value = detected.pattern;
            this.learnedFields.set('priseTerrain', 'traceApproach');
        } else if (suggested) {
            select.value = '';
            this.learnedFields.delete('priseTerrain');
        }
        this.renderLearnedSummary();
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
}
