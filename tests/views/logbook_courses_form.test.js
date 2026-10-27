import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import LogbookService from '../../js/services/logbook_service.js';
import SitesService from '../../js/services/sites_service.js';
import LogbookView from '../../js/views/logbook.js';

// Session d'école : plusieurs moniteurs, et stage retrouvé d'après les sessions déjà saisies (spec 038).
const INDEX = readFileSync('index.html', 'utf8');
const LOGBOOK_SCREEN = ['logbook-screen', 'logbook-session-modal']
    .map((id) => {
        const tpl = document.createElement('template');
        tpl.innerHTML = INDEX.slice(INDEX.search(new RegExp(`<(div|dialog)\\s[^>]*id="${id}"`)));
        return tpl.content.getElementById(id).outerHTML;
    })
    .join('');

const $ = (id) => /** @type {HTMLInputElement} */ (document.getElementById(id));
const change = (id, value) => {
    $(id).value = value;
    $(id).dispatchEvent(new Event('change', { bubbles: true }));
};
const toggle = (id, checked) => {
    $(id).checked = checked;
    $(id).dispatchEvent(new Event('change', { bubbles: true }));
};
const addInstructor = (name) => {
    $('lb-moniteur-new').value = name;
    LogbookView.addChecklistItem('moniteur');
};
const summary = () => $('lb-learned-summary').textContent;
const history = () => document.getElementById('logbook-history-list')?.innerHTML ?? '';
const lastFlight = () => LogbookService.getFlights()[0];

let n = 0;
// Une session d'un stage ; les valeurs par défaut sont celles d'un stage complet
const course = (extra = {}) => ({
    id: `s${n++}`,
    type: 'vol',
    datetime: '2026-09-20T10:00',
    site: 'Plaine',
    duree: 10,
    typeVol: 'Plouf',
    techDecollage: 'Face voile',
    voile: 'Voile école',
    sellette: 'Sellette',
    ecole: 'ÉCOLE TEST',
    moniteur: ['Gilbert', 'Marie'],
    accompagnateur: ['Sophie'],
    pilotes: ['Julie', 'Marc'],
    stageName: 'Stage été',
    stageSpecialty: 'SIV',
    ...extra,
});

function setup(flights) {
    LogbookService.flights = flights;
    LogbookService.equipment = ['Voile école', 'Sellette'].map((nom, i) => ({
        id: `e${i}`,
        nom,
        type: nom.startsWith('Voile') ? 'voile' : 'sellette',
        statut: 'actif',
    }));
    LogbookView.currentFormType = 'vol';
    document.body.innerHTML = `${LOGBOOK_SCREEN}<input type="file" id="global-igc-input">`;
    LogbookView.setupEventListeners();
    LogbookView.populateEquipmentDropdowns?.();
    LogbookView.resetForm();
}

// Le pilote ouvre le formulaire d'une nouvelle session à l'heure et au lieu donnés
const openAt = (datetime, site) => {
    change('lb-datetime', datetime);
    change('lb-site', site);
};

// Le pilote choisit une école qui n'a aucune session : plus aucune habitude ne la complète
const pickOtherSchool = () => {
    toggle('lb-ecole-check', true);
    change('lb-ecole', 'AUTRE ÉCOLE');
};

const fillRequired = () => {
    $('lb-site').value = 'Plaine';
    $('lb-voile').value = 'Voile école';
    $('lb-duree').value = '5';
};

beforeEach(() => {
    n = 0;
    localStorage.clear();
    Element.prototype.scrollIntoView = () => {};
    vi.spyOn(SitesService, 'getSites').mockReturnValue([]);
    vi.spyOn(SitesService, 'ensureSitesLoaded').mockResolvedValue(undefined);
    vi.spyOn(LogbookService, 'saveFlights').mockImplementation(() => {});
    vi.spyOn(LogbookView, 'fetchWeatherForSession').mockResolvedValue(undefined);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('logbook: several instructors on a school session', () => {
    it('are saved as a list, shown as tags when editing, and listed on the card', () => {
        setup([]);
        fillRequired();
        toggle('lb-ecole-check', true);
        $('lb-ecole').value = 'ÉCOLE TEST';
        addInstructor('Gilbert');
        addInstructor('Marie');
        LogbookView.submitForm();

        expect(lastFlight().moniteur).toEqual(['Gilbert', 'Marie']);
        LogbookView.renderHistory();
        expect(history()).toContain('Moniteurs :</strong> Gilbert, Marie');

        LogbookView.editEntry(lastFlight().id);
        expect(LogbookView.getChecklistValues('moniteur')).toEqual(['Gilbert', 'Marie']);
        expect(document.querySelectorAll('#lb-moniteur-group .lb-chip')).toHaveLength(2);
    });

    it('can be removed one by one', () => {
        setup([]);
        fillRequired();
        toggle('lb-ecole-check', true);
        $('lb-ecole').value = 'ÉCOLE TEST';
        addInstructor('Gilbert');
        addInstructor('Marie');
        /** @type {HTMLElement} */ (document.querySelector('#lb-moniteur-group .lb-chip-remove')).click();
        LogbookView.submitForm();
        expect(lastFlight().moniteur).toEqual(['Marie']);
    });

    it('adds a name typed but not added when saving', () => {
        setup([]);
        fillRequired();
        toggle('lb-ecole-check', true);
        $('lb-ecole').value = 'ÉCOLE TEST';
        addInstructor('Gilbert');
        $('lb-moniteur-new').value = 'Marie';
        LogbookView.submitForm();
        expect(lastFlight().moniteur).toEqual(['Gilbert', 'Marie']);
    });

    it('are not kept without a school', () => {
        setup([]);
        fillRequired();
        addInstructor('Gilbert');
        LogbookView.submitForm();
        expect(lastFlight().moniteur).toEqual([]);
    });

    it('suggests the recorded instructors, the most used first', () => {
        setup([
            course({ moniteur: ['Marie'] }),
            course({ moniteur: ['Gilbert', 'Marie'] }),
            course({ moniteur: 'Gilbert' }),
            course({ moniteur: ['Gilbert'] }),
        ]);
        const options = Array.from(document.querySelectorAll('#lb-moniteur-options option')).map(
            (o) => /** @type {HTMLOptionElement} */ (o).value,
        );
        expect(options).toEqual(['Gilbert', 'Marie']);
    });

    it('keeps the instructors when the form switches between flight and ground', () => {
        setup([]);
        toggle('lb-ecole-check', true);
        $('lb-ecole').value = 'ÉCOLE TEST';
        addInstructor('Gilbert');
        addInstructor('Marie');
        LogbookView.setFormType('gonflage');
        expect(LogbookView.getChecklistValues('moniteur')).toEqual(['Gilbert', 'Marie']);
    });

    it('reads the single instructor of an older session and keeps it when saving', () => {
        const old = course({ id: 'old', moniteur: 'Gilbert', stageName: '', stageSpecialty: '' });
        setup([old]);
        LogbookView.renderHistory();
        expect(history()).toContain('Moniteurs :</strong> Gilbert');

        LogbookView.editEntry('old');
        expect(LogbookView.getChecklistValues('moniteur')).toEqual(['Gilbert']);
        expect(document.querySelectorAll('#lb-moniteur-group .lb-chip')).toHaveLength(1);
        LogbookView.submitForm();
        expect(LogbookService.getFlightById('old').moniteur).toEqual(['Gilbert']);
    });

    it('are proposed again with the school, all of them', () => {
        setup([course({ stageName: '', stageSpecialty: '' })]);
        change('lb-site', 'Plaine');
        expect($('lb-ecole').value).toBe('ÉCOLE TEST');
        expect(LogbookView.getChecklistValues('moniteur')).toEqual(['Gilbert', 'Marie']);
        expect(summary()).toContain('moniteurs (le dernier de cette école ici)');
    });

    it('stop being proposed once the pilot edits the list', () => {
        setup([course({ stageName: '', stageSpecialty: '' })]);
        change('lb-site', 'Plaine');
        /** @type {HTMLElement} */ (document.querySelector('#lb-moniteur-group .lb-chip-remove')).click();
        change('lb-site', 'Dune');
        change('lb-site', 'Plaine');
        expect(LogbookView.getChecklistValues('moniteur')).toEqual(['Marie']);
    });
});

describe('logbook: a known course brings back its details', () => {
    it('suggests the course names, the most used first, one per name whatever the case', () => {
        setup([
            course({ stageName: 'stage été' }),
            course({ stageName: 'Perf' }),
            course({ stageName: 'Stage Été' }),
            course({ stageName: 'Stage été' }),
            course({ stageName: '', stageSpecialty: 'SIV' }),
        ]);
        const options = Array.from(document.querySelectorAll('#stages-list option')).map(
            (o) => /** @type {HTMLOptionElement} */ (o).value,
        );
        expect(options).toEqual(['stage été', 'Perf']);
    });

    it('fills school, specialty, instructors, companions and pilots from the latest session of the course', () => {
        setup([
            course({ stageName: 'stage été', moniteur: ['Gilbert'], pilotes: ['Julie'], accompagnateur: [] }),
            course({
                stageName: 'Stage été',
                stageSpecialty: 'Initiation',
                ecole: 'ÉCOLE ANCIENNE',
                moniteur: ['Autre'],
                pilotes: ['Vieux'],
                accompagnateur: ['Paul'],
                datetime: '2026-08-01T10:00',
            }),
            course({ stageName: 'Perf', ecole: 'ÉCOLE PERF', moniteur: ['Zoé'], pilotes: ['Max'] }),
        ]);
        toggle('lb-ecole-check', true);
        toggle('lb-stage-check', true);
        change('lb-stage-nom', 'STAGE ÉTÉ');

        expect($('lb-ecole-check').checked).toBe(true);
        expect($('lb-ecole').value).toBe('ÉCOLE TEST');
        expect($('lb-stage-specialite').value).toBe('SIV');
        expect(LogbookView.getChecklistValues('moniteur')).toEqual(['Gilbert']);
        expect(LogbookView.getChecklistValues('accompagnateur')).toEqual([]);
        expect(LogbookView.getChecklistValues('pilotes')).toEqual(['Julie']);
        expect(summary()).toContain('moniteurs (comme ton stage)');
        expect(summary()).toContain('pilotes (comme ton stage)');
    });

    it('ticks the school box when a known course is picked while it is unticked', () => {
        setup([course()]);
        toggle('lb-stage-check', true); // la case stage n'est visible qu'avec l'école, mais l'état se lit
        change('lb-stage-nom', 'Stage été');
        expect($('lb-ecole-check').checked).toBe(true);
        expect($('lb-ecole').value).toBe('ÉCOLE TEST');
    });

    it('leaves alone what the pilot already filled or changed', () => {
        setup([course()]);
        pickOtherSchool();
        change('lb-stage-specialite', 'Cross');
        $('lb-pilotes-new').value = 'Moi';
        LogbookView.addChecklistItem('pilotes');
        toggle('lb-stage-check', true);
        change('lb-stage-nom', 'Stage été');

        expect($('lb-ecole').value).toBe('AUTRE ÉCOLE');
        expect($('lb-stage-specialite').value).toBe('Cross');
        expect(LogbookView.getChecklistValues('pilotes')).toEqual(['Moi']);
        // Le reste vient du stage
        expect(LogbookView.getChecklistValues('moniteur')).toEqual(['Gilbert', 'Marie']);
        expect(LogbookView.getChecklistValues('accompagnateur')).toEqual(['Sophie']);
    });

    it('pre-fills nothing for a name that is not a known course', () => {
        setup([course()]);
        pickOtherSchool();
        toggle('lb-stage-check', true);
        change('lb-stage-nom', 'Stage inconnu');
        expect($('lb-stage-specialite').value).toBe('');
        expect(LogbookView.getChecklistValues('moniteur')).toEqual([]);
        expect(LogbookView.getChecklistValues('pilotes')).toEqual([]);
        expect($('lb-stage-nom').value).toBe('Stage inconnu');
    });

    it('adds no companion when the latest session of the course had none', () => {
        setup([course({ accompagnateur: [] })]);
        pickOtherSchool();
        toggle('lb-stage-check', true);
        change('lb-stage-nom', 'Stage été');
        expect(LogbookView.getChecklistValues('accompagnateur')).toEqual([]);
        expect(LogbookView.getChecklistValues('moniteur')).toEqual(['Gilbert', 'Marie']);
    });

    it('never fills the fields of a session being edited', () => {
        const old = course({ id: 'old', moniteur: [], pilotes: [], accompagnateur: [], stageSpecialty: '' });
        setup([course(), old]);
        LogbookView.editEntry('old');
        expect($('lb-stage-nom').value).toBe('Stage été');
        change('lb-stage-nom', 'Stage été');
        expect(LogbookView.getChecklistValues('moniteur')).toEqual([]);
        expect(LogbookView.getChecklistValues('pilotes')).toEqual([]);
        expect($('lb-stage-specialite').value).toBe('');
        expect($('lb-learned-summary').hidden).toBe(true);
    });

    it('saves the course with the pre-filled values', () => {
        setup([course()]);
        pickOtherSchool();
        toggle('lb-stage-check', true);
        change('lb-stage-nom', 'Stage été');
        change('lb-ecole', 'ÉCOLE TEST');
        fillRequired();
        LogbookView.submitForm();
        expect(lastFlight()).toMatchObject({
            ecole: 'ÉCOLE TEST',
            stageName: 'Stage été',
            moniteur: ['Gilbert', 'Marie'],
            pilotes: ['Julie', 'Marc'],
        });
    });
});

describe('logbook: a session close to a course session starts in that course', () => {
    const earlier = () => course({ id: 'earlier', datetime: '2026-10-03T12:06' });

    it('ticks the course with its name and specialty, and brings back its details', () => {
        setup([earlier()]);
        openAt('2026-10-03T13:57', 'Plaine');
        expect($('lb-ecole-check').checked).toBe(true);
        expect($('lb-stage-check').checked).toBe(true);
        expect(/** @type {HTMLElement} */ (document.getElementById('lb-stage-group')).hidden).toBe(false);
        expect($('lb-stage-nom').value).toBe('Stage été');
        expect($('lb-stage-specialite').value).toBe('SIV');
        expect(LogbookView.getChecklistValues('moniteur')).toEqual(['Gilbert', 'Marie']);
        expect(LogbookView.getChecklistValues('pilotes')).toEqual(['Julie', 'Marc']);
        expect(summary()).toContain('stage (comme ta session de moins de 3 h ici)');
    });

    it('also works for a course session with a specialty but no name', () => {
        setup([course({ id: 'earlier', datetime: '2026-10-03T12:06', stageName: '' })]);
        openAt('2026-10-03T13:57', 'Plaine');
        expect($('lb-stage-check').checked).toBe(true);
        expect($('lb-stage-nom').value).toBe('');
        expect($('lb-stage-specialite').value).toBe('SIV');
    });

    it('stays unticked more than 3 hours later, or at another place', () => {
        setup([earlier()]);
        openAt('2026-10-03T17:30', 'Plaine');
        expect($('lb-stage-check').checked).toBe(false);
        openAt('2026-10-03T13:57', 'Dune');
        expect($('lb-stage-check').checked).toBe(false);
    });

    it('stays unticked when the nearest session at that place is not part of a course', () => {
        setup([
            course({ id: 'plain', datetime: '2026-10-03T12:40', stageName: '', stageSpecialty: '', ecole: '' }),
            earlier(),
        ]);
        openAt('2026-10-03T13:00', 'Plaine');
        expect($('lb-stage-check').checked).toBe(false);
    });

    it('removes the course it proposed when the place no longer matches', () => {
        setup([earlier()]);
        openAt('2026-10-03T13:57', 'Plaine');
        expect($('lb-stage-check').checked).toBe(true);
        change('lb-site', 'Dune');
        expect($('lb-stage-check').checked).toBe(false);
        expect($('lb-stage-nom').value).toBe('');
    });

    it('keeps the pilot choice when the course box is unticked, whatever the date', () => {
        setup([earlier()]);
        openAt('2026-10-03T13:57', 'Plaine');
        toggle('lb-stage-check', false);
        change('lb-datetime', '2026-10-03T14:10');
        expect($('lb-stage-check').checked).toBe(false);
    });

    it('keeps the name the pilot typed when the date changes', () => {
        setup([earlier(), course({ stageName: 'Perf', datetime: '2026-08-01T10:00', stageSpecialty: 'Cross' })]);
        openAt('2026-10-03T13:57', 'Plaine');
        change('lb-stage-nom', 'Perf');
        change('lb-datetime', '2026-10-03T14:10');
        expect($('lb-stage-nom').value).toBe('Perf');
        expect($('lb-stage-specialite').value).toBe('Cross'); // celle du stage choisi, pas du stage proche
    });

    it('does nothing for a session being edited', () => {
        const old = course({ id: 'old', datetime: '2026-10-03T13:57', stageName: '', stageSpecialty: '', ecole: '' });
        setup([old, earlier()]);
        LogbookView.editEntry('old');
        expect($('lb-stage-check').checked).toBe(false);
        expect($('lb-learned-summary').hidden).toBe(true);
    });
});

describe('logbook: course specialty "Autre"', () => {
    it('shows a text field, saves what is typed and shows it again when editing', () => {
        setup([]);
        fillRequired();
        toggle('lb-ecole-check', true);
        $('lb-ecole').value = 'ÉCOLE TEST';
        toggle('lb-stage-check', true);
        expect($('lb-stage-specialite-autre').style.display).toBe('none');

        change('lb-stage-specialite', 'Autre'); // le champ s'affiche via l'action toggleOtherField (main.js)
        $('lb-stage-specialite-autre').value = 'Acro';
        LogbookView.submitForm();
        expect(lastFlight().stageSpecialty).toBe('Acro');

        LogbookView.editEntry(lastFlight().id);
        expect($('lb-stage-specialite').value).toBe('Autre');
        expect($('lb-stage-specialite-autre').value).toBe('Acro');
        expect($('lb-stage-specialite-autre').style.display).toBe('block');
    });

    it('is proposed again for the next session of the same course', () => {
        setup([course({ stageSpecialty: 'Acro' })]);
        toggle('lb-stage-check', true);
        change('lb-stage-nom', 'Stage été');
        expect($('lb-stage-specialite').value).toBe('Autre');
        expect($('lb-stage-specialite-autre').value).toBe('Acro');
    });
});
