/**
 * VIEW - Logbook learned defaults
 * Base class of LogbookView (see logbook.js): the pre-filling of the session form from the
 * pilot's habits (PilotHabits), its explanation line, the winch operator list and the rescue
 * linked to the harness. Kept in its own file so logbook.js stays smaller; behaviour is
 * unchanged.
 */
import LogbookService from '../services/logbook_service.js';
import PilotHabits from '../services/pilot_habits.js';
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
        'lb-moniteur': 'moniteur',
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
}
