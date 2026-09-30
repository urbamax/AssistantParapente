import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import LogbookService from '../../js/services/logbook_service.js';
import SitesService from '../../js/services/sites_service.js';
import Map3DComponent from '../../js/components/map_3d.js';
import LogbookView from '../../js/views/logbook.js';

// Spec 014 : les textes du carnet passent dans le catalogue sans rien changer à l'affichage. Ces
// instantanés ont été enregistrés AVANT le déplacement des textes ; ils doivent rester identiques.
const INDEX = readFileSync('index.html', 'utf8');
// Seul l'écran du carnet est repris (un <template> ne charge ni styles ni scripts).
const LOGBOOK_SCREEN = (() => {
    const tpl = document.createElement('template');
    tpl.innerHTML = INDEX.slice(INDEX.indexOf('<div id="logbook-screen"'));
    return tpl.content.getElementById('logbook-screen').outerHTML;
})();

const METEO = { temperature: 21, ventVitesse: 14, ventRafales: 22, ventDirection: 250, weatherCode: 2 };
const FLIGHT = {
    id: 'f1',
    type: 'vol',
    datetime: '2026-09-20T14:30',
    site: 'Mont Lambert',
    voile: 'OZONE | RUSH 6 | BLEU | M',
    sellette: 'SUPAIR | ACCESS',
    duree: 75,
    commentaire: 'Belle journée',
    typeVol: 'Thermique',
    techDecollage: 'Face voile',
    altitudeMax: 1250,
    gain: 800,
    distanceKm: 12.4,
    maxClimbRate: 3.2,
    maxSpeedKmh: 48,
    avgSpeedKmh: 31,
    meteo: METEO,
    meteoAtterro: METEO,
    baliseId: '67',
    rawIgc: 'IGC',
    traceGps: [{ lat: 50.7, lon: 1.65 }],
};
const GROUND = {
    id: 'g1',
    type: 'gonflage',
    datetime: '2026-09-18T18:00',
    lieu: 'Pente école',
    voile: 'OZONE | RUSH 6 | BLEU | M',
    duree: 45,
    typeExercice: ['Face voile', 'Vent fort'],
};
const NO_WEATHER = {
    id: 'n1',
    type: 'vol',
    datetime: '2026-09-10T11:00',
    site: 'Zzz inconnu',
    duree: 20,
    typeVol: 'Plouf',
};
const EQUIPMENT = [
    {
        id: 'e1',
        nom: 'OZONE | RUSH 6 | BLEU | M',
        type: 'voile',
        dateAchat: '2020-03-01',
        derniereRevision: '2023-01-10',
        periodicite: 24,
        periodiciteHeures: 1,
        ventMin: 0,
        ventMax: 25,
        statut: 'actif',
    },
    {
        id: 'e2',
        nom: 'SUPAIR | ACCESS',
        type: 'sellette',
        derniereRevision: '2024-10-15',
        periodicite: 24,
        periodiciteHeures: 3,
        statut: 'actif',
    },
    { id: 'e3', nom: 'Radio', type: 'accessoire', statut: 'archive' },
];

const dialogs = [];

function setScreen() {
    document.body.innerHTML = `${LOGBOOK_SCREEN}<input type="file" id="global-igc-input">`;
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-30T10:00:00'));
    localStorage.clear();
    dialogs.length = 0;
    window.alert = (m) => dialogs.push(`alert: ${m}`);
    window.confirm = (m) => (dialogs.push(`confirm: ${m}`), false);
    Element.prototype.scrollIntoView = () => {};
    vi.spyOn(SitesService, 'getSites').mockReturnValue([{ nom: 'Mont Lambert', latitude: 50.7, longitude: 1.65 }]);
    vi.spyOn(SitesService, 'ensureSitesLoaded').mockResolvedValue(undefined);
    LogbookService.flights = [FLIGHT, GROUND, NO_WEATHER].map((s) => structuredClone(s));
    LogbookService.equipment = EQUIPMENT.map((e) => structuredClone(e));
    LogbookView.currentFormType = 'vol';
    setScreen();
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

const html = (id) => document.getElementById(id).innerHTML;
const text = (id) => document.getElementById(id).innerText || document.getElementById(id).textContent;

describe('logbook renders (spec 014: identical before and after moving the texts)', () => {
    it('history', () => {
        LogbookView.renderHistory();
        expect(html('logbook-history-list')).toMatchSnapshot();
    });

    it('history, empty', () => {
        LogbookService.flights = [];
        LogbookView.renderHistory();
        expect(html('logbook-history-list')).toMatchSnapshot();
    });

    it('statistics', () => {
        LogbookView.renderStats();
        expect(html('logbook-stats-container')).toMatchSnapshot();
    });

    it('statistics, empty', () => {
        LogbookService.flights = [];
        LogbookView.renderStats();
        expect(html('logbook-stats-container')).toMatchSnapshot();
    });

    it('equipment', () => {
        LogbookView.renderEquipment();
        expect(html('logbook-equip-container')).toMatchSnapshot();
    });

    it('equipment, empty', () => {
        LogbookService.equipment = [];
        LogbookView.renderEquipment();
        expect(html('logbook-equip-container')).toMatchSnapshot();
    });

    it('flight form and ground handling form', () => {
        LogbookView.renderForm();
        const flight = html('form-fields-container');
        LogbookView.setFormType('gonflage');
        expect({ flight, ground: html('form-fields-container') }).toMatchSnapshot();
    });

    it('edit and reset a session', () => {
        LogbookView.editEntry('f1');
        const editing = { submit: text('lb-submit-btn'), file: text('igc-upload-filename') };
        LogbookView.resetForm();
        expect({
            editing,
            reset: { submit: text('lb-submit-btn'), file: text('igc-upload-filename') },
        }).toMatchSnapshot();
    });

    it('equipment form: edit, reset and dropdowns', () => {
        LogbookView.editEquipment('e1');
        const editing = { submit: text('eq-submit-btn'), title: text('eq-form-title') };
        LogbookView.resetEquipmentForm();
        expect({
            editing,
            reset: { submit: text('eq-submit-btn'), title: text('eq-form-title') },
            marque: html('eq-marque'),
        }).toMatchSnapshot();
    });

    it('IGC altitude check, normal and suspicious', () => {
        LogbookView.renderForm();
        LogbookView._setupAltitudeCheck({ landingAlt: 12, takeoffAlt: 180, maxAltitude: 900 });
        const normal = html('igc-alt-check');
        LogbookView._setupAltitudeCheck({ landingAlt: -40, takeoffAlt: 130, maxAltitude: 900 });
        expect({ normal, suspicious: html('igc-alt-check') }).toMatchSnapshot();
    });

    it('weather blocks and weather errors', async () => {
        const ground = LogbookView.renderSessionWeatherHtml(LogbookService.getFlightById('g1'));
        LogbookView.renderHistory();
        const empty = html('weather-container-n1');
        LogbookView.forceWeatherRefresh('n1');
        const notFound = html('weather-container-n1');
        LogbookView.renderHistory();
        vi.spyOn(LogbookService, 'fetchSessionWeather').mockResolvedValue({
            success: false,
            data: null,
            error: 'réseau',
        });
        await LogbookView.fetchWeatherForSession(50, 1, '2026-09-10T11:00', 'n1', 20, null);
        expect({ ground, empty, notFound, failed: html('weather-container-n1') }).toMatchSnapshot();
    });

    it('3D trace error', async () => {
        LogbookService.flights = [{ ...structuredClone(NO_WEATHER), traceGps: [{ lat: 50, lon: 1 }] }];
        LogbookView.renderHistory();
        vi.spyOn(Map3DComponent, 'showTrace').mockRejectedValue(new Error('WebGL absent'));
        await LogbookView.showTrace('n1');
        expect(html('trace-container-n1')).toMatchSnapshot();
    });

    it('confirmations', () => {
        LogbookView.deleteEntry('f1');
        LogbookView.deleteEquipment('e1');
        expect(dialogs).toMatchSnapshot();
    });

    it('IGC import messages', async () => {
        LogbookView.renderForm();
        const parsed = {
            points: [{ lat: 10, lon: 10 }],
            takeoffIndex: 0,
            duration: 30,
            dateStr: '2026-09-20T14:30',
            maxAltitude: 900,
            gain: 300,
            landingAlt: 10,
            takeoffAlt: 200,
        };
        const parse = vi.spyOn(LogbookService, 'parseIGC').mockReturnValue({ success: true, data: parsed });
        let resolveGeo;
        vi.spyOn(LogbookService, 'reverseGeocode').mockReturnValue(new Promise((r) => (resolveGeo = r)));
        const read = async () => {
            LogbookView._processIgcFile(new File(['IGC'], 'vol.igc'));
            await vi.waitFor(() => expect(parse).toHaveBeenCalled());
            await new Promise((r) => setTimeout(r, 0));
        };
        const site = () => /** @type {HTMLInputElement} */ (document.getElementById('lb-site')).value;

        await read();
        const searching = { file: text('igc-upload-filename'), site: site() };
        resolveGeo({ success: true, data: { city: 'Wimereux' } });
        await new Promise((r) => setTimeout(r, 0));
        const found = site();

        LogbookView.renderForm();
        parse.mockClear();
        vi.spyOn(LogbookService, 'reverseGeocode').mockResolvedValue({ success: true, data: {} });
        await read();
        await new Promise((r) => setTimeout(r, 0));
        const unknown = site();

        LogbookView.renderForm();
        parse.mockClear();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(LogbookService, 'reverseGeocode').mockResolvedValue({ success: false, error: 'hors ligne' });
        await read();
        await new Promise((r) => setTimeout(r, 0));
        const failed = site();

        parse.mockReturnValue({ success: false, error: 'fichier vide' });
        parse.mockClear();
        await read();
        expect({ searching, found, unknown, failed, dialogs }).toMatchSnapshot();
    });
});
