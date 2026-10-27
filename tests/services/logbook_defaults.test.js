import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import LogbookService from '../../js/services/logbook_service.js';
import SitesService from '../../js/services/sites_service.js';
import BrevetService from '../../js/services/brevet_service.js';
import LogbookView from '../../js/views/logbook.js';
import { suggestDefaults, findNearbySession } from '../../js/services/logbook_defaults.js';

// Les valeurs de départ d'un vol sont calculées sans formulaire (import de plusieurs vols) ; elles
// doivent rester celles que le formulaire propose pour le même site et la même heure (parité).
const INDEX = readFileSync('index.html', 'utf8');
const LOGBOOK_SCREEN = ['logbook-screen', 'logbook-session-modal']
    .map((id) => {
        const tpl = document.createElement('template');
        tpl.innerHTML = INDEX.slice(INDEX.search(new RegExp(`<(div|dialog)\\s[^>]*id="${id}"`)));
        return tpl.content.getElementById(id).outerHTML;
    })
    .join('');

const OPTIONS = { voile: ['Voile côte', 'Voile école'], sellette: ['Sellette'] };

let n = 0;
const vol = (site, extra = {}) => ({
    id: `v${n++}`,
    type: 'vol',
    datetime: `2026-09-${String(28 - n).padStart(2, '0')}T12:00`,
    site,
    duree: 10,
    typeVol: 'Soaring',
    techDecollage: 'Face voile',
    voile: 'Voile côte',
    sellette: 'Sellette',
    ecole: '',
    ...extra,
});
const school = (site, extra = {}) =>
    vol(site, {
        typeVol: 'Treuil',
        techDecollage: 'Dos voile',
        voile: 'Voile école',
        ecole: 'ÉCOLE TEST',
        moniteur: ['Gilbert', 'Marie'],
        accompagnateur: ['Sophie'],
        pilotes: ['Julie', 'Marc'],
        ...extra,
    });
const course = (site, extra = {}) => school(site, { stageName: 'Stage été', stageSpecialty: 'SIV', ...extra });

beforeEach(() => {
    n = 0;
});

describe('suggestDefaults', () => {
    const habits = () => [school('PLAINE'), school('PLAINE'), ...Array.from({ length: 10 }, () => vol('DUNE'))];

    it('proposes the habits of the site, with the reason', () => {
        const { values, reasons } = suggestDefaults(habits(), {
            place: 'Plaine',
            datetime: '2026-10-03T12:00',
            options: OPTIONS,
        });
        expect(values).toMatchObject({
            typeVol: 'Treuil',
            techDecollage: 'Dos voile',
            voile: 'Voile école',
            sellette: 'Sellette',
            ecole: 'ÉCOLE TEST',
            moniteur: ['Gilbert', 'Marie'],
        });
        expect(reasons).toMatchObject({ voile: 'gearPlace', ecole: 'place', moniteur: 'instructorPlace' });
    });

    it('proposes the habits of another site, and no school there', () => {
        const { values } = suggestDefaults(habits(), { place: 'Dune', datetime: '2026-10-03T12:00', options: OPTIONS });
        expect(values).toMatchObject({ typeVol: 'Soaring', techDecollage: 'Face voile', voile: 'Voile côte' });
        expect(values.ecole).toBeUndefined();
        expect(values.moniteur).toBeUndefined();
    });

    it('does not propose gear that is not in the equipment list', () => {
        const { values } = suggestDefaults(habits(), {
            place: 'Plaine',
            datetime: '2026-10-03T12:00',
            options: { voile: ['Autre voile'], sellette: [] },
        });
        expect(values.voile).toBeUndefined();
        expect(values.sellette).toBeUndefined();
    });

    it('leaves alone the fields it is told to skip, and takes the given flight type for the technique', () => {
        const { values } = suggestDefaults(habits(), {
            place: 'Plaine',
            datetime: '2026-10-03T12:00',
            options: OPTIONS,
            skip: new Set(['typeVol']),
            typeVol: 'Thermique',
        });
        expect(values.typeVol).toBeUndefined();
        expect(values.techDecollage).toBe('Face voile'); // pas de treuil : l'habitude du lieu pour un vol libre
    });

    it('suggests back-facing at the winch for a pilot who always launches forward elsewhere', () => {
        const { values, reasons } = suggestDefaults(
            Array.from({ length: 10 }, () => vol('DUNE')),
            {
                place: 'Dune',
                datetime: '2026-10-03T12:00',
                options: OPTIONS,
                skip: new Set(['typeVol']),
                typeVol: 'Treuil',
            },
        );
        expect(values.techDecollage).toBe('Dos voile');
        expect(reasons.techDecollage).toBe('winch');
    });

    it('takes the pilots of a session less than 3 hours away at the same site', () => {
        const earlier = vol('PLAINE', { datetime: '2026-10-03T12:06', pilotes: ['Gilbert', 'Julie'] });
        const otherDay = vol('PLAINE', { datetime: '2026-09-20T12:00', pilotes: ['Marc'] });
        const near = suggestDefaults([earlier, otherDay], {
            place: 'Plaine',
            datetime: '2026-10-03T13:57',
            options: OPTIONS,
        });
        expect(near.values.pilotes).toEqual(['Gilbert', 'Julie']);
        expect(near.reasons.pilotes).toBe('nearbySession');
        const far = suggestDefaults([earlier, otherDay], {
            place: 'Plaine',
            datetime: '2026-10-03T17:30',
            options: OPTIONS,
        });
        expect(far.values.pilotes).toBeUndefined();
        const elsewhere = suggestDefaults([earlier, otherDay], {
            place: 'Dune',
            datetime: '2026-10-03T13:57',
            options: OPTIONS,
        });
        expect(elsewhere.values.pilotes).toBeUndefined();
    });

    it('starts in the course of a course session close in time and place (spec 038)', () => {
        const earlier = course('PLAINE', { id: 'earlier', datetime: '2026-10-03T12:06' });
        const { values, reasons, stage } = suggestDefaults([earlier], {
            place: 'Plaine',
            datetime: '2026-10-03T13:57',
            options: OPTIONS,
        });
        expect(stage).toBe(true);
        expect(values).toMatchObject({
            ecole: 'ÉCOLE TEST',
            stageName: 'Stage été',
            stageSpecialty: 'SIV',
            moniteur: ['Gilbert', 'Marie'],
            accompagnateur: ['Sophie'],
            pilotes: ['Julie', 'Marc'],
        });
        expect(reasons).toMatchObject({ stage: 'nearbySession', pilotes: 'course', moniteur: 'course' });
    });

    it('does not start in a course when the nearest session is not part of one', () => {
        const plain = vol('PLAINE', { datetime: '2026-10-03T12:40' });
        const earlier = course('PLAINE', { datetime: '2026-10-03T11:00' });
        const { stage, values } = suggestDefaults([plain, earlier], {
            place: 'Plaine',
            datetime: '2026-10-03T13:00',
            options: OPTIONS,
        });
        expect(stage).toBe(false);
        expect(values.stageName).toBeUndefined();
    });

    it('uses the course whose name is given, from its latest session', () => {
        const sessions = [
            course('PLAINE', { stageName: 'Perf', stageSpecialty: 'Cross', moniteur: ['Zoé'], pilotes: ['Max'] }),
            course('PLAINE', { datetime: '2026-08-01T10:00' }),
        ];
        const { values, reasons } = suggestDefaults(sessions, {
            place: 'Ailleurs',
            datetime: '2026-10-03T13:00',
            options: OPTIONS,
            stageName: 'STAGE ÉTÉ',
        });
        expect(values).toMatchObject({ stageName: 'Stage été', stageSpecialty: 'SIV', moniteur: ['Gilbert', 'Marie'] });
        expect(reasons.moniteur).toBe('course');
    });

    it('says nothing for an empty logbook', () => {
        const { values, stage } = suggestDefaults([], {
            place: 'Plaine',
            datetime: '2026-10-03T13:00',
            options: OPTIONS,
        });
        expect(Object.values(values).every((v) => v === undefined)).toBe(true);
        expect(stage).toBe(false);
    });

    it('learns brevetPrepare from school or course sessions and advances BI -> BP after BI validation date (spec 042)', () => {
        const sessions = [
            school('PLAINE', { datetime: '2026-10-20T10:00', brevetPrepare: 'BI' }),
            school('PLAINE', { datetime: '2026-10-19T10:00', brevetPrepare: 'BI' }),
        ];

        // Before BI is validated: suggests BI from school habit
        const before = suggestDefaults(sessions, {
            place: 'Plaine',
            datetime: '2026-10-25T10:00',
            options: OPTIONS,
        });
        expect(before.values.brevetPrepare).toBe('BI');
        expect(before.reasons.brevetPrepare).toBe('instructorPlace');

        // Validate BI on 2026-10-26
        BrevetService.saveBrevet('BI', {
            theory: { passed: true, date: '2026-10-15' },
            practical: { validated: true, date: '2026-10-26' },
        });

        // Session on 2026-10-26 (same day as validation) still suggests BI
        const sameDay = suggestDefaults(sessions, {
            place: 'Plaine',
            datetime: '2026-10-26T16:00',
            options: OPTIONS,
        });
        expect(sameDay.values.brevetPrepare).toBe('BI');

        // Session on 2026-10-27 (after BI validation) automatically advances to BP!
        const nextDay = suggestDefaults(sessions, {
            place: 'Plaine',
            datetime: '2026-10-27T10:00',
            options: OPTIONS,
        });
        expect(nextDay.values.brevetPrepare).toBe('BP');
        expect(nextDay.reasons.brevetPrepare).toBe('brevetNext');
        localStorage.clear();
    });
});

describe('findNearbySession', () => {
    it('finds the closest session at the same place within 3 hours, with the field set', () => {
        const a = vol('PLAINE', { datetime: '2026-10-03T10:30', pilotes: ['A'] });
        const b = vol('PLAINE', { datetime: '2026-10-03T12:30', pilotes: ['B'] });
        expect(findNearbySession([a, b], 'plaine', '2026-10-03T13:00')?.pilotes).toEqual(['B']);
        expect(findNearbySession([a, b], 'plaine', '2026-10-03T20:00')).toBeNull();
        expect(findNearbySession([a, b], '', '2026-10-03T13:00')).toBeNull();
    });
});

describe('parity with the session form', () => {
    const $ = (id) => /** @type {HTMLInputElement} */ (document.getElementById(id));
    const change = (id, value) => {
        $(id).value = value;
        $(id).dispatchEvent(new Event('change', { bubbles: true }));
    };

    beforeEach(() => {
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

    // À l'ouverture, le formulaire propose déjà des valeurs pour un lieu encore vide, et elles restent
    // si le lieu saisi ensuite n'en propose pas. Une ligne d'import a son lieu dès le départ : on
    // repart d'un formulaire sans rien de proposé.
    function blankForm() {
        LogbookView.learnedFields.clear();
        LogbookView.touchedFields.clear();
        $('lb-typeVol').value = 'Plouf';
        $('lb-tech-decollage').value = 'Face voile';
        $('lb-voile').value = '';
        $('lb-sellette').value = '';
        LogbookView.setSchoolField(false);
        $('lb-stage-check').checked = false;
        /** @type {HTMLElement} */ (document.getElementById('lb-stage-group')).hidden = true;
        $('lb-stage-nom').value = '';
        $('lb-stage-specialite').value = '';
        if ($('lb-brevet-prepare')) $('lb-brevet-prepare').value = '';
        for (const name of ['moniteur', 'accompagnateur', 'pilotes']) LogbookView.setChecklistValues(name, []);
    }

    function formProposal(sessions, place, datetime) {
        LogbookService.flights = sessions;
        LogbookService.equipment = ['Voile côte', 'Voile école', 'Sellette'].map((nom, i) => ({
            id: `e${i}`,
            nom,
            type: nom.startsWith('Voile') ? 'voile' : 'sellette',
            statut: 'actif',
        }));
        LogbookView.currentFormType = 'vol';
        document.body.innerHTML = `${LOGBOOK_SCREEN}<input type="file" id="global-igc-input">`;
        LogbookView.setupEventListeners();
        LogbookView.resetForm();
        blankForm();
        change('lb-site', place);
        change('lb-datetime', datetime);
        const ticked = $('lb-ecole-check').checked;
        const stageTicked = $('lb-stage-check').checked;
        return {
            typeVol: $('lb-typeVol').value,
            techDecollage: $('lb-tech-decollage').value,
            voile: $('lb-voile').value,
            sellette: $('lb-sellette').value,
            ecole: ticked ? $('lb-ecole').value : '',
            stageName: stageTicked ? $('lb-stage-nom').value : '',
            stageSpecialty: stageTicked ? $('lb-stage-specialite').value : '',
            brevetPrepare: ticked && $('lb-brevet-prepare') ? $('lb-brevet-prepare').value : '',
            moniteur: LogbookView.getChecklistValues('moniteur'),
            accompagnateur: LogbookView.getChecklistValues('accompagnateur'),
            pilotes: LogbookView.getChecklistValues('pilotes'),
        };
    }

    // Ce que la fonction propose, avec les valeurs par défaut du formulaire quand elle ne propose rien
    function functionProposal(sessions, place, datetime) {
        const { values } = suggestDefaults(sessions, { place, datetime, options: OPTIONS });
        return {
            typeVol: values.typeVol ?? 'Plouf',
            techDecollage: values.techDecollage ?? 'Face voile',
            voile: values.voile ?? '',
            sellette: values.sellette ?? '',
            ecole: values.ecole ?? '',
            stageName: values.stageName ?? '',
            stageSpecialty: values.stageSpecialty ?? '',
            brevetPrepare: values.brevetPrepare ?? '',
            moniteur: values.moniteur ?? [],
            accompagnateur: values.accompagnateur ?? [],
            pilotes: values.pilotes ?? [],
        };
    }

    const logbooks = {
        'an empty logbook': () => [],
        'habits at a winch site and a coastal site': () => [
            school('PLAINE'),
            school('PLAINE'),
            ...Array.from({ length: 10 }, () => vol('DUNE')),
        ],
        'a pilot who always launches forward': () => Array.from({ length: 10 }, () => vol('DUNE')),
        'pilots of a session close in time': () => [
            vol('PLAINE', { datetime: '2026-10-03T12:06', pilotes: ['Gilbert', 'Julie'] }),
            vol('PLAINE', { datetime: '2026-09-20T12:00', pilotes: ['Marc'] }),
        ],
        'a course session close in time': () => [
            course('PLAINE', { datetime: '2026-10-03T12:06' }),
            school('PLAINE', { datetime: '2026-09-01T10:00', moniteur: 'Gilbert', accompagnateur: [] }),
        ],
        'a school with several instructors and companions': () => [
            school('PLAINE', { datetime: '2026-09-20T10:00' }),
            school('COL', { datetime: '2026-09-19T10:00', moniteur: ['Paul'], accompagnateur: ['Eva'] }),
        ],
    };

    for (const [label, make] of Object.entries(logbooks)) {
        for (const place of ['Plaine', 'Dune', 'Ailleurs']) {
            it(`proposes what the form proposes: ${label}, at ${place}`, () => {
                const datetime = '2026-10-03T13:57';
                const sessions = make();
                expect(functionProposal(make(), place, datetime)).toEqual(formProposal(sessions, place, datetime));
            });
        }
    }
});
