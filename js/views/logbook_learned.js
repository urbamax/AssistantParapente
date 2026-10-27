/**
 * VIEW - Logbook learned defaults
 * Base class of LogbookView (see logbook.js): the pre-filling of the session form from the
 * pilot's habits (PilotHabits), its explanation line, the winch operator list and the rescue
 * linked to the harness. Kept in its own file so logbook.js stays smaller; behaviour is
 * unchanged.
 */
import LogbookService from '../services/logbook_service.js';
import PilotHabits from '../services/pilot_habits.js';
import BrevetService, { resolveSuggestedBrevet } from '../services/brevet_service.js';
import { instructorsOf, isCourseSession, latestOfCourse, preferPlace } from '../services/logbook_courses.js';
import { findNearbySession } from '../services/logbook_defaults.js';
import { escapeHTML } from '../core/security.js';
import { tl } from './logbook_strings.js';
import { LogbookChecklistsBase } from './logbook_checklists.js';

export class LogbookLearnedBase extends LogbookChecklistsBase {
    // id du champ → nom du champ appris
    static LEARNED_FIELD_IDS = {
        'lb-typeVol': 'typeVol',
        'lb-tech-decollage': 'techDecollage',
        'lb-voile': 'voile',
        'lb-sellette': 'sellette',
        'lb-ecole-check': 'ecole',
        'lb-ecole': 'ecole',
        'lb-stage-check': 'stage',
        'lb-stage-nom': 'stage',
        'lb-stage-specialite': 'specialite',
        'lb-brevet-prepare': 'brevetPrepare',
        'lb-treuilleur': 'treuilleur',
        'lb-site': 'site',
        'lb-lieu': 'lieu',
    };

    // Valeur de l'option « Dos voile » (identifiant, pas un texte affiché)
    static WINCH_TAKEOFF_TECHNIQUE = 'Dos voile';

    touchedFields = new Set();

    learnedFields = new Map(); // champ → raison affichée

    // Liste modifiée par le pilote : elle n'est plus pré-remplie (pilotes d'une session proche).
    onChecklistEdited(name) {
        if (!this.touchedFields.has(name)) {
            this.touchedFields.add(name);
            this.learnedFields.delete(name);
            this.renderLearnedSummary();
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
                prior: winch ? { value: LogbookLearnedBase.WINCH_TAKEOFF_TECHNIQUE, weight: 2, reason: 'winch' } : null,
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
        // Stage : celui dont le pilote a saisi le nom, ou celui d'une session proche ; il apporte
        // l'école, la spécialité, les moniteurs, les accompagnateurs et les pilotes
        const fromCourse = editing ? new Set() : this.applyCourseDefaults(sessions, place, can);
        if (can('ecole') && !fromCourse.has('ecole')) {
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
        // Moniteurs : ceux de la dernière session de cette école sur ce site, sinon de cette école
        const school = /** @type {HTMLInputElement} */ (document.getElementById('lb-ecole-check'))?.checked
            ? value('lb-ecole').trim().toLowerCase()
            : '';
        if (document.getElementById('lb-brevet-prepare') && can('brevetPrepare') && !fromCourse.has('brevetPrepare')) {
            const datetime = value('lb-datetime');
            const withBrevet = school
                ? sessions.filter(
                      (s) =>
                          typeof s.ecole === 'string' &&
                          s.ecole.trim().toLowerCase() === school &&
                          typeof s.brevetPrepare === 'string' &&
                          s.brevetPrepare.trim(),
                  )
                : [];
            const brevetRef = preferPlace(withBrevet, place);
            if (brevetRef) {
                const rawBrevet = brevetRef.brevetPrepare.trim();
                const resolved = resolveSuggestedBrevet(rawBrevet, undefined, datetime);
                if (resolved) {
                    const here = place.trim() && PilotHabits.placeOf(brevetRef) === place.trim().toLowerCase();
                    setSelect('lb-brevet-prepare', 'brevetPrepare', {
                        value: resolved,
                        reason: resolved !== rawBrevet ? 'brevetNext' : here ? 'instructorPlace' : 'instructorLatest',
                    });
                }
            } else if (school && BrevetService.hasAnyBrevetData()) {
                const target = BrevetService.getTargetSchoolBrevet(undefined, datetime);
                if (target) {
                    setSelect('lb-brevet-prepare', 'brevetPrepare', {
                        value: target,
                        reason: 'brevetInProgress',
                    });
                }
            } else if (this.learnedFields.has('brevetPrepare')) {
                const select = /** @type {HTMLSelectElement|null} */ (document.getElementById('lb-brevet-prepare'));
                if (select) select.value = '';
                this.learnedFields.delete('brevetPrepare');
            }
        }
        if (document.getElementById('lb-moniteur-group') && can('moniteur') && !fromCourse.has('moniteur')) {
            const withInstructor = school
                ? sessions.filter(
                      (s) =>
                          typeof s.ecole === 'string' &&
                          s.ecole.trim().toLowerCase() === school &&
                          instructorsOf(s).length > 0,
                  )
                : [];
            const reference = preferPlace(withInstructor, place);
            if (reference) {
                this.setChecklistValues('moniteur', instructorsOf(reference));
                const here = place.trim() && PilotHabits.placeOf(reference) === place.trim().toLowerCase();
                this.learnedFields.set('moniteur', here ? 'instructorPlace' : 'instructorLatest');
            } else if (this.learnedFields.has('moniteur')) {
                this.setChecklistValues('moniteur', []);
                this.learnedFields.delete('moniteur');
            }
        }
        // Accompagnateurs : ceux d'une session de moins de 3 h ici, sinon les derniers de cette école ici
        if (
            document.getElementById('lb-accompagnateur-group') &&
            can('accompagnateur') &&
            !fromCourse.has('accompagnateur')
        ) {
            const withCompanion = school
                ? sessions.filter(
                      (s) =>
                          LogbookLearnedBase.companionsOf(s).length > 0 &&
                          typeof s.ecole === 'string' &&
                          s.ecole.trim().toLowerCase() === school,
                  )
                : [];
            const close = this.findNearbySession(withCompanion, place, value('lb-datetime'), 'accompagnateur');
            const placeKey = (place || '').trim().toLowerCase();
            const last = !close && placeKey ? withCompanion.find((s) => PilotHabits.placeOf(s) === placeKey) : null;
            if (close || last) {
                this.setChecklistValues('accompagnateur', LogbookLearnedBase.companionsOf(close || last));
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
        if (can('pilotes') && !fromCourse.has('pilotes')) {
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
     * Pré-remplissage par le stage (spec 038). La session de référence est :
     *  - si le pilote a choisi le stage (case cochée ou nom saisi) : la dernière session du stage
     *    dont il a saisi le nom ;
     *  - sinon : la session la plus proche, au même endroit et à moins de 3 h, si elle fait partie
     *    d'un stage (la case, le nom et la spécialité sont alors proposés).
     * Seuls les champs que le pilote n'a pas touchés sont remplis ; une liste vide dans la session de
     * référence ne vide rien. Retourne les champs remplis, que les autres règles laissent alors.
     */
    applyCourseDefaults(sessions, place, can) {
        const filled = new Set();
        const check = /** @type {HTMLInputElement|null} */ (document.getElementById('lb-stage-check'));
        const nameInput = /** @type {HTMLInputElement|null} */ (document.getElementById('lb-stage-nom'));
        const specialtySelect = /** @type {HTMLSelectElement|null} */ (document.getElementById('lb-stage-specialite'));
        const group = document.getElementById('lb-stage-group');
        if (!check || !nameInput || !specialtySelect || !group) return filled;

        const chosen = this.touchedFields.has('stage');
        let reference;
        if (chosen) {
            reference = check.checked ? latestOfCourse(sessions, nameInput.value) : null;
        } else {
            const datetime = /** @type {HTMLInputElement} */ (document.getElementById('lb-datetime'))?.value || '';
            const nearest = this.findNearbySession(sessions, place, datetime, 'datetime');
            reference = nearest && isCourseSession(nearest) ? nearest : null;
            if (reference) {
                check.checked = true;
                group.hidden = false;
                nameInput.value = typeof reference.stageName === 'string' ? reference.stageName.trim() : '';
                this.learnedFields.set('stage', 'nearbySession');
            } else if (this.learnedFields.has('stage')) {
                // Proposé pour une autre heure ou un autre site : le stage et ce qu'il avait rempli sont retirés
                check.checked = false;
                group.hidden = true;
                nameInput.value = '';
                this.learnedFields.delete('stage');
                this.clearCourseFields(can);
            }
        }
        if (!reference) return filled;

        const fill = (field, apply) => {
            if (!can(field)) return;
            apply();
            this.learnedFields.set(field, 'course');
            filled.add(field);
        };
        const school = typeof reference.ecole === 'string' ? reference.ecole.trim() : '';
        if (school) fill('ecole', () => this.setSchoolField(true, school));
        const specialty = typeof reference.stageSpecialty === 'string' ? reference.stageSpecialty : '';
        if (specialty && Array.from(specialtySelect.options).some((o) => o.value === specialty)) {
            fill('specialite', () => (specialtySelect.value = specialty));
        }
        const brevetSelect = /** @type {HTMLSelectElement|null} */ (document.getElementById('lb-brevet-prepare'));
        const courseBrevet = typeof reference.brevetPrepare === 'string' ? reference.brevetPrepare.trim() : '';
        if (brevetSelect && courseBrevet && can('brevetPrepare')) {
            const datetime = /** @type {HTMLInputElement} */ (document.getElementById('lb-datetime'))?.value || '';
            const resolved = resolveSuggestedBrevet(courseBrevet, undefined, datetime);
            if (resolved && Array.from(brevetSelect.options).some((o) => o.value === resolved)) {
                brevetSelect.value = resolved;
                this.learnedFields.set('brevetPrepare', resolved !== courseBrevet ? 'brevetNext' : 'course');
                filled.add('brevetPrepare');
            }
        }
        const lists = {
            moniteur: instructorsOf(reference),
            accompagnateur: LogbookLearnedBase.companionsOf(reference),
            pilotes: Array.isArray(reference.pilotes) ? reference.pilotes : [],
        };
        for (const [field, names] of Object.entries(lists)) {
            if (names.length) fill(field, () => this.setChecklistValues(field, names));
        }
        return filled;
    }

    /** Retire ce que le stage avait rempli (le pilote n'y a pas touché). */
    clearCourseFields(can) {
        for (const [field, reason] of [...this.learnedFields.entries()]) {
            if (reason !== 'course' || !can(field)) continue;
            if (field === 'ecole') this.setSchoolField(false);
            else if (field === 'specialite') {
                const select = /** @type {HTMLSelectElement|null} */ (document.getElementById('lb-stage-specialite'));
                if (select) select.value = '';
            } else if (field === 'brevetPrepare') {
                const select = /** @type {HTMLSelectElement|null} */ (document.getElementById('lb-brevet-prepare'));
                if (select) select.value = '';
            } else this.setChecklistValues(field, []);
            this.learnedFields.delete(field);
        }
    }

    /**
     * Session la plus proche dans le temps, au même endroit, à moins de 3 h de `datetime`, et qui
     * a des pilotes : un vol de la même série (treuil, plusieurs ploufs dans la journée…).
     */
    findNearbySession(sessions, place, datetime, field = 'pilotes') {
        return findNearbySession(sessions, place, datetime, field);
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
}
