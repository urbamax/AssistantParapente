/**
 * VIEW - Logbook choice lists
 * Base class of LogbookView (see logbook.js): the school and pilots blocks of the session form
 * and their add-and-remove checklists (companions, pilots, exercises). Kept in its own file so
 * logbook.js stays smaller; behaviour is unchanged.
 */
import LogbookService from '../services/logbook_service.js';
import { BREVET_CODES } from '../services/brevet_service.js';
import { escapeHTML } from '../core/security.js';
import { tt } from './logbook_strings.js';
import { LogbookSitesBase } from './logbook_sites.js';

export class LogbookChecklistsBase extends LogbookSitesBase {
    // À fournir par LogbookView (met à jour le pré-remplissage appris quand une liste change).
    onChecklistEdited(_name) {
        throw new Error('LogbookView must implement onChecklistEdited()');
    }

    static STAGE_SPECIALTIES = ['Initiation', 'Perfectionnement', 'Progression', 'SIV', 'Cross', 'Autre'];

    static FLIGHT_EXERCISES = [
        'Virages',
        'Tangage/Roulis',
        'Oreilles',
        'Accélérateur',
        'Approche en 8',
        'Approche en U',
        "Précision d'atterrissage",
    ];

    static GROUND_EXERCISES = [
        'Face voile',
        'Dos voile',
        'Tangage/Roulis',
        'Affalage',
        'Vent fort',
        'Prégonflage / Démêlage',
    ];

    // En vol, les exercices travaillés ne sont demandés que pour une session en école (au sol,
    // ils font déjà partie du formulaire).
    renderSchoolBlock(type = 'gonflage') {
        const exercises =
            type === 'vol'
                ? `
                        <label style="display:block; margin-top: 10px;">${tt('form.exercises')}</label>
                        ${this.renderChecklist('typeExercice', LogbookChecklistsBase.FLIGHT_EXERCISES, this.getUsedValues('typeExercice', 'vol'), tt('form.addExercisePlaceholder'))}`
                : '';
        return `
                <div class="form-group">
                    <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                        <input type="checkbox" id="lb-ecole-check" aria-controls="lb-ecole-group"> ${tt('form.schoolSession')}
                    </label>
                    <div id="lb-ecole-group" hidden style="margin-top: 6px;">
                        <label for="lb-ecole">${tt('form.schoolName')} <span class="required">*</span></label>
                        <input type="text" id="lb-ecole" list="ecoles-list" placeholder="${tt('form.schoolPlaceholder')}" autocomplete="off" style="width: 100%;">
                        <datalist id="ecoles-list"></datalist>
                        <label style="display:block; margin-top: 10px;">${tt('form.instructor')}</label>
                        ${this.renderChecklist('moniteur', [], this.getUsedValues('moniteur'), tt('form.instructorPlaceholder'))}

                        <label for="lb-brevet-prepare" style="display:block; margin-top: 10px;">${tt('form.brevetPrepare')}</label>
                        <select id="lb-brevet-prepare" style="width: 100%;">
                            <option value="">${tt('form.brevetNone')}</option>
                            ${BREVET_CODES.map((code) => `<option value="${code}">${tt(`form.brevetOptions.${code}`)}</option>`).join('')}
                        </select>

                        <label style="display:flex; align-items:center; gap:6px; cursor:pointer; margin-top: 10px;">
                            <input type="checkbox" id="lb-stage-check" aria-controls="lb-stage-group"> ${tt('form.isCourse')}
                        </label>
                        <div id="lb-stage-group" hidden style="margin-top: 6px;">
                            <label for="lb-stage-nom" style="display:block;">${tt('form.courseName')}</label>
                            <input type="text" id="lb-stage-nom" list="stages-list" placeholder="${tt('form.courseNamePlaceholder')}" autocomplete="off" style="width: 100%;">
                            <datalist id="stages-list"></datalist>
                            <label for="lb-stage-specialite" style="display:block; margin-top: 10px;">${tt('form.specialty')}</label>
                            <select id="lb-stage-specialite" style="width: 100%;">
                                <option value="">${tt('form.specialtySelect')}</option>
                                ${LogbookChecklistsBase.STAGE_SPECIALTIES.map((name) => `<option value="${name}">${tt(`form.specialties.${name}`)}</option>`).join('')}
                            </select>
                        </div>

                        <label style="display:block; margin-top: 10px;">${tt('form.companion')}</label>
                        ${this.renderChecklist('accompagnateur', [], this.getUsedValues('accompagnateur'), tt('form.companionPlaceholder'))}${exercises}
                    </div>
                </div>`;
    }

    // Pilotes avec qui on a volé / gonflé, pour toute session (école ou pas).
    renderPilotsBlock() {
        return `
                <div class="form-group">
                    <label>${tt('form.pilots')}</label>
                    ${this.renderChecklist('pilotes', [], this.getUsedValues('pilotes'), tt('form.addPilotPlaceholder'))}
                </div>`;
    }

    /** Valeurs distinctes d'un champ liste (`typeExercice`, `pilotes`) dans le carnet, triées. */
    getUsedValues(field, type = null) {
        const seen = new Map();
        LogbookService.getFlights().forEach((session) => {
            if (type && session.type !== type) return;
            const values = Array.isArray(session[field]) ? session[field] : [session[field]];
            values.forEach((value) => {
                const v = typeof value === 'string' ? value.trim() : '';
                if (v && !seen.has(v.toLowerCase())) seen.set(v.toLowerCase(), v);
            });
        });
        return [...seen.values()].sort((a, b) => a.localeCompare(b, 'fr'));
    }

    /** Libellé d'une valeur : traduit pour les exercices par défaut, tel quel sinon. */
    _checklistLabel(name, value) {
        const isDefault =
            name === 'typeExercice' &&
            (LogbookChecklistsBase.FLIGHT_EXERCISES.includes(value) ||
                LogbookChecklistsBase.GROUND_EXERCISES.includes(value));
        return isDefault ? tt(`form.exerciseTypes.${value}`) : escapeHTML(value);
    }

    // Valeur choisie : une étiquette avec sa croix ; la case cochée cachée porte la valeur lue à
    // l'enregistrement (getChecklistValues).
    _renderChecklistItem(name, value) {
        return `<span class="lb-chip"><input type="checkbox" name="lb-${name}" value="${escapeHTML(value)}" checked hidden>${this._checklistLabel(name, value)}<button type="button" class="lb-chip-remove" data-checklist-remove="${name}" aria-label="${tt('form.remove')}"><i class="ri-close-line"></i></button></span>`;
    }

    // Liste extensible (exercices, pilotes) : les valeurs choisies en étiquettes, et un champ avec
    // liste déroulante des valeurs connues (par défaut + déjà utilisées dans le carnet) pour en
    // ajouter une, ou en saisir une nouvelle.
    renderChecklist(name, defaults, used, placeholder) {
        const lower = defaults.map((v) => v.toLowerCase());
        const items = [...defaults, ...used.filter((v) => !lower.includes(v.toLowerCase()))];
        return `
                        <div id="lb-${name}-group" class="lb-chips"></div>
                        <datalist id="lb-${name}-options">${items.map((v) => `<option value="${escapeHTML(v)}"></option>`).join('')}</datalist>
                        <div style="display:flex; gap:6px; margin-top:8px;">
                            <input type="text" id="lb-${name}-new" list="lb-${name}-options" data-checklist="${name}" placeholder="${placeholder}" autocomplete="off" style="flex:1; min-width:0;">
                            <button type="button" class="action-btn-secondary" data-action="addChecklistItem" data-args="'${name}'" style="padding: 4px 10px; border-radius: 6px; cursor: pointer;"><i class="ri-add-line"></i> ${tt('form.add')}</button>
                        </div>`;
    }

    /** Valeurs connues d'une liste (celles de sa liste déroulante). */
    getChecklistOptions(name) {
        return Array.from(document.querySelectorAll(`#lb-${name}-options option`)).map(
            (o) => /** @type {HTMLOptionElement} */ (o).value,
        );
    }

    /** Valeurs choisies d'une liste du formulaire. */
    getChecklistValues(name) {
        return Array.from(
            /** @type {NodeListOf<HTMLInputElement>} */ (document.querySelectorAll(`input[name="lb-${name}"]:checked`)),
        ).map((cb) => cb.value);
    }

    /** Remplace les valeurs choisies (pré-remplissage, session modifiée). */
    setChecklistValues(name, values) {
        const group = document.getElementById(`lb-${name}-group`);
        if (!group) return;
        const wanted = (Array.isArray(values) ? values : [values]).filter((v) => typeof v === 'string' && v.trim());
        group.innerHTML = [...new Set(wanted)].map((v) => this._renderChecklistItem(name, v)).join('');
    }

    /** Bouton « Ajouter », Entrée ou choix dans la liste déroulante : ajoute la valeur saisie. */
    addChecklistItem(name) {
        const input = /** @type {HTMLInputElement} */ (document.getElementById(`lb-${name}-new`));
        const group = document.getElementById(`lb-${name}-group`);
        if (!input || !group) return;
        const typed = input.value.trim();
        if (!typed) return;
        // Une valeur connue garde son écriture d'origine (« oreilles » → « Oreilles »)
        const known = this.getChecklistOptions(name).find((v) => v.toLowerCase() === typed.toLowerCase());
        const value = known || typed;
        if (!this.getChecklistValues(name).some((v) => v.toLowerCase() === value.toLowerCase())) {
            group.insertAdjacentHTML('beforeend', this._renderChecklistItem(name, value));
        }
        if (!known) {
            const list = document.getElementById(`lb-${name}-options`);
            if (list) list.insertAdjacentHTML('beforeend', `<option value="${escapeHTML(value)}"></option>`);
        }
        input.value = '';
        input.focus();
        this.onChecklistEdited(name);
    }

    removeChecklistItem(button) {
        const chip = button.closest('.lb-chip');
        const name = button.getAttribute('data-checklist-remove');
        if (chip) chip.remove();
        if (name) this.onChecklistEdited(name);
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
}
