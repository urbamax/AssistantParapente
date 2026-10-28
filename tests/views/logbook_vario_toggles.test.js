import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import LogbookService from '../../js/services/logbook_service.js';
import SitesService from '../../js/services/sites_service.js';
import LogbookView from '../../js/views/logbook.js';
import { addMinutesToDatetimeLocal } from '../../js/utils/date_utils.js';
import { buildIgc, GROUND, FLIGHT_10MIN } from '../helpers/synthetic_igc.js';

// Cases « vario allumé / éteint pendant le vol » : la durée réelle donne l'heure de décollage,
// et une heure ou durée saisie à la main n'est jamais écrasée par la trace.
const INDEX = readFileSync('index.html', 'utf8');
const LOGBOOK_SCREEN = ['logbook-screen', 'logbook-session-modal']
    .map((id) => {
        const tpl = document.createElement('template');
        tpl.innerHTML = INDEX.slice(INDEX.search(new RegExp(`<(div|dialog)\\s[^>]*id="${id}"`)));
        return tpl.content.getElementById(id).outerHTML;
    })
    .join('');

const $ = (id) => /** @type {HTMLInputElement} */ (document.getElementById(id));
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Charge une trace dans le formulaire, comme un import de fichier. */
function loadTrace(phases) {
    const parsed = LogbookService.parseIGC(buildIgc(phases)).data;
    LogbookView._fillFormFromIgc(parsed);
    return parsed;
}

/** Saisie du pilote dans un champ, avec l'événement `change` que le formulaire écoute. */
function type(id, value) {
    $(id).value = value;
    $(id).dispatchEvent(new Event('change', { bubbles: true }));
}

function tick(id, checked) {
    $(id).checked = checked;
    $(id).dispatchEvent(new Event('change', { bubbles: true }));
}

beforeEach(() => {
    localStorage.clear();
    Element.prototype.scrollIntoView = () => {};
    vi.spyOn(SitesService, 'getSites').mockReturnValue([]);
    vi.spyOn(SitesService, 'ensureSitesLoaded').mockResolvedValue(undefined);
    vi.spyOn(LogbookService, 'saveFlights').mockImplementation(() => {});
    vi.spyOn(LogbookView, 'fetchWeatherForSession').mockResolvedValue(undefined);
    LogbookService.flights = [];
    LogbookService.equipment = [];
    LogbookView.currentFormType = 'vol';
    document.body.innerHTML = `${LOGBOOK_SCREEN}<input type="file" id="global-igc-input">`;
    LogbookView.setupEventListeners();
    LogbookView.renderForm();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('logbook form: vario switched on or off during the flight', () => {
    it('ticks "on in flight" only when the trace starts in the air', () => {
        loadTrace([GROUND, FLIGHT_10MIN, GROUND]);
        expect($('lb-vario-in-flight').checked).toBe(false);
        expect($('lb-vario-off-in-flight').checked).toBe(false);

        LogbookView.renderForm();
        loadTrace([FLIGHT_10MIN, GROUND]);
        expect($('lb-vario-in-flight').checked).toBe(true);
        expect($('lb-vario-off-in-flight').checked).toBe(false);
    });

    it('ticks "off in flight" only when the trace ends in the air', () => {
        loadTrace([GROUND, FLIGHT_10MIN]);
        expect($('lb-vario-in-flight').checked).toBe(false);
        expect($('lb-vario-off-in-flight').checked).toBe(true);
    });

    it('tells the pilot why in the import message', () => {
        loadTrace([FLIGHT_10MIN, GROUND]);
        expect(document.getElementById('igc-upload-filename').textContent).toMatch(/commence déjà en l'air/);
    });

    it('derives the takeoff time from the real duration (landing time minus duration)', () => {
        const parsed = loadTrace([FLIGHT_10MIN, GROUND]);
        type('lb-duree', '25');
        expect($('lb-datetime').value).toBe(addMinutesToDatetimeLocal(parsed.dateStr, parsed.duration - 25));
        expect($('lb-duree').value).toBe('25');
    });

    it('leaves the time alone when "on in flight" is not ticked', () => {
        const parsed = loadTrace([GROUND, FLIGHT_10MIN, GROUND]);
        type('lb-duree', '25');
        expect($('lb-datetime').value).toBe(parsed.dateStr);
    });

    it('derives the time as soon as the box is ticked after the duration was typed', () => {
        const parsed = loadTrace([GROUND, FLIGHT_10MIN, GROUND]);
        type('lb-duree', '25');
        tick('lb-vario-in-flight', true);
        expect($('lb-datetime').value).toBe(addMinutesToDatetimeLocal(parsed.dateStr, parsed.duration - 25));
    });

    it('derives nothing when the vario was also switched off in flight', () => {
        const parsed = loadTrace([FLIGHT_10MIN]);
        expect($('lb-vario-in-flight').checked).toBe(true);
        expect($('lb-vario-off-in-flight').checked).toBe(true);
        type('lb-duree', '25');
        expect($('lb-datetime').value).toBe(parsed.dateStr);
    });

    it('keeps a takeoff time typed by hand', () => {
        loadTrace([FLIGHT_10MIN, GROUND]);
        type('lb-datetime', '2026-10-03T10:30');
        type('lb-duree', '25');
        expect($('lb-datetime').value).toBe('2026-10-03T10:30');
    });

    it('does not overwrite a time or duration typed by hand when the trace is read again', () => {
        const parsed = loadTrace([GROUND, FLIGHT_10MIN]);
        type('lb-datetime', '2026-10-03T10:30');
        type('lb-duree', '42');
        LogbookView._fillFormFromIgc(parsed);
        expect($('lb-datetime').value).toBe('2026-10-03T10:30');
        expect($('lb-duree').value).toBe('42');
    });

    it('does not tick again a box the pilot unticked', () => {
        const parsed = loadTrace([FLIGHT_10MIN, GROUND]);
        tick('lb-vario-in-flight', false);
        LogbookView._fillFormFromIgc(parsed);
        expect($('lb-vario-in-flight').checked).toBe(false);
    });

    it('restores both boxes when editing a saved flight', async () => {
        LogbookService.flights = [
            {
                id: 'f1',
                type: 'vol',
                datetime: '2026-10-03T10:00',
                site: 'TEST',
                voile: 'Ma voile',
                duree: 20,
                varioInFlight: true,
                varioOffInFlight: false,
            },
        ];
        LogbookView.editEntry('f1');
        await flush();
        expect($('lb-vario-in-flight').checked).toBe(true);
        expect($('lb-vario-off-in-flight').checked).toBe(false);
    });

    it('resets the boxes for a new flight', () => {
        loadTrace([FLIGHT_10MIN]);
        LogbookView.renderForm();
        expect($('lb-vario-in-flight').checked).toBe(false);
        expect($('lb-vario-off-in-flight').checked).toBe(false);
    });
});

describe('LogbookService: vario switched on or off during the flight', () => {
    it('passes the airborne flags of the trace to the form', () => {
        const parsed = LogbookService.parseIGC(buildIgc([FLIGHT_10MIN])).data;
        expect(parsed.startsAirborne).toBe(true);
        expect(parsed.endsAirborne).toBe(true);
    });

    it('"recompute all" keeps the time and duration of flights flagged by the pilot', async () => {
        const base = {
            type: 'vol',
            datetime: '2026-10-03T09:00',
            duree: 99,
            rawIgc: buildIgc([GROUND, FLIGHT_10MIN, GROUND]),
        };
        LogbookService.flights = [
            { ...base, id: 'plain' },
            { ...base, id: 'on', varioInFlight: true },
            { ...base, id: 'off', varioOffInFlight: true },
        ];
        await LogbookService.recomputeAllTraceStats();
        const [plain, on, off] = LogbookService.flights;
        expect(plain.duree).not.toBe(99);
        expect(plain.datetime).not.toBe('2026-10-03T09:00');
        for (const flight of [on, off]) {
            expect(flight.datetime).toBe('2026-10-03T09:00');
            expect(flight.duree).toBe(99);
            expect(flight.distanceKm).toBeGreaterThan(0); // le reste est bien recalculé
        }
    });
});

describe('LogbookService: trace recorded from the take-off', () => {
    // Un vario qui enregistre dès le décollage (Syride) : 1er point déjà à vitesse de vol, mais
    // posé sur le décollage. Les points synthétiques partent de 45.9 N / 6°52' E.
    const launch = (overrides) => ({
        id: 'test-1',
        nom: 'DECO TEST',
        latitude: 45.9,
        longitude: 6 + 52 / 60,
        type: ['NATUREL'],
        affiche: true,
        ...overrides,
    });
    const startsAirborneWith = (sites) => {
        vi.spyOn(SitesService, 'getSites').mockReturnValue(sites);
        return LogbookService.parseIGC(buildIgc([FLIGHT_10MIN, GROUND])).data.startsAirborne;
    };

    it('is not a vario switched on in flight when the first point sits on a known take-off', () => {
        expect(startsAirborneWith([launch()])).toBe(false);
    });

    it('still flags a trace starting in the air away from any take-off', () => {
        expect(startsAirborneWith([launch({ latitude: 45.95 })])).toBe(true);
    });

    it('ignores sites that are not take-offs (landing field)', () => {
        expect(startsAirborneWith([launch({ type: ['ATTERRO'] })])).toBe(true);
    });
});
