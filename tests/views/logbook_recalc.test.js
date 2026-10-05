import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import LogbookService from '../../js/services/logbook_service.js';
import SitesService from '../../js/services/sites_service.js';
import LogbookView from '../../js/views/logbook.js';

// Modifier un vol : le bouton « Recalculer depuis la trace IGC » refait les calculs à partir de
// la trace enregistrée, sans toucher à ce qui ne vient pas de la trace.
const INDEX = readFileSync('index.html', 'utf8');
const LOGBOOK_SCREEN = ['logbook-screen', 'logbook-session-modal']
    .map((id) => {
        const tpl = document.createElement('template');
        tpl.innerHTML = INDEX.slice(INDEX.search(new RegExp(`<(div|dialog)\\s[^>]*id="${id}"`)));
        return tpl.content.getElementById(id).outerHTML;
    })
    .join('');

/** Trace IGC : 10 min de vol vers le nord (30 km/h, de 600 m à 300 m), un point toutes les 2 s. */
function buildIgc() {
    const records = [];
    let lat = 50.3;
    for (let s = 0; s <= 600; s += 2) {
        const h = 10 + Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const time = [h, m, s % 60].map((n) => String(n).padStart(2, '0')).join('');
        const deg = Math.floor(lat);
        const min = String(Math.round((lat - deg) * 60000)).padStart(5, '0');
        const alt = String(Math.round(600 - s / 2)).padStart(5, '0');
        records.push(`B${time}${deg}${min}N00230000EA${alt}${alt}`);
        lat += ((30 / 3.6) * 2) / 111320;
    }
    return ['HFDTE031026', ...records].join('\n');
}

const FLIGHT = {
    id: 'f1',
    type: 'vol',
    datetime: '2026-07-01T12:00',
    site: 'FERME TEST | TREUIL',
    voile: 'Ma voile',
    duree: 3, // ancien calcul, faux
    typeVol: 'Plouf',
    techDecollage: 'Face voile',
    altitudeMax: 999,
    gain: 0,
    commentaire: 'Travail des 8 en approche.',
    ecole: 'ÉCOLE TEST',
    lat: 50.1,
    lon: 2.1,
    altOffset: 5,
    rawIgc: buildIgc(),
};

const $ = (id) => /** @type {HTMLInputElement} */ (document.getElementById(id));
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
    localStorage.clear();
    Element.prototype.scrollIntoView = () => {};
    vi.spyOn(SitesService, 'getSites').mockReturnValue([]);
    vi.spyOn(SitesService, 'ensureSitesLoaded').mockResolvedValue(undefined);
    vi.spyOn(LogbookService, 'saveFlights').mockImplementation(() => {});
    vi.spyOn(LogbookView, 'fetchWeatherForSession').mockResolvedValue(undefined);
    LogbookService.flights = [structuredClone(FLIGHT)];
    LogbookService.equipment = [];
    LogbookView.currentFormType = 'vol';
    document.body.innerHTML = `${LOGBOOK_SCREEN}<input type="file" id="global-igc-input">`;
    LogbookView.setupEventListeners();
    LogbookView.renderForm();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('logbook: recalculate a flight from its stored IGC trace', () => {
    it('offers the button only when editing a flight that has a trace', async () => {
        expect($('lb-igc-recalc').style.display).toBe('none');
        LogbookView.editEntry('f1');
        await flush();
        expect($('lb-igc-recalc').style.display).toBe('block');

        LogbookService.flights = [{ ...structuredClone(FLIGHT), rawIgc: undefined }];
        vi.spyOn(LogbookService, 'getFlightTrace').mockResolvedValue(null);
        LogbookView.resetForm();
        LogbookView.editEntry('f1');
        await flush();
        expect($('lb-igc-recalc').style.display).toBe('none');
    });

    it('updates the trace-derived fields and keeps everything else', async () => {
        const plaine = { nom: 'PLAINE', latitude: 50.3, longitude: 2.5, type: ['TREUIL'], affiche: true };
        SitesService.getSites.mockReturnValue([plaine]);
        LogbookView.editEntry('f1');
        await flush();
        const wing = /** @type {HTMLSelectElement} */ (document.getElementById('lb-voile'));
        wing.innerHTML = '<option value="Ma voile">Ma voile</option>';
        wing.value = 'Ma voile';

        await LogbookView.recalculateFromTrace();
        expect($('lb-duree').value).toBe('10');
        expect($('lb-altMax').value).toBe('605'); // 600 m + correction de 5 m conservée
        expect($('lb-gain').value).toBe('0');

        LogbookView.submitForm();
        const saved = LogbookService.getFlightById('f1');
        expect(saved).toMatchObject({
            duree: 10,
            altitudeMax: 605,
            site: 'PLAINE', // site connu le plus proche du décollage
            voile: FLIGHT.voile,
            typeVol: FLIGHT.typeVol,
            techDecollage: FLIGHT.techDecollage,
            commentaire: FLIGHT.commentaire,
            ecole: FLIGHT.ecole,
            altOffset: 5,
            rawIgc: FLIGHT.rawIgc,
        });
        expect(saved.distanceKm).toBeGreaterThan(4);
        expect(saved.lat).toBeCloseTo(50.3, 4); // position du décollage
        expect(saved.lon).toBeCloseTo(2.5, 4);
    });

    it('offers every known site near the takeoff, and keeps the one already chosen', async () => {
        const site = (nom, lat) => ({ nom, latitude: lat, longitude: 2.5, type: ['NATUREL'], affiche: true });
        // Le site choisi est le plus éloigné (~220 m), l'autre est à ~110 m.
        LogbookService.flights[0].site = 'PLAINE TREUIL';
        SitesService.getSites.mockReturnValue([site('PLAINE PENTE', 50.301), site('PLAINE TREUIL', 50.302)]);
        LogbookView.editEntry('f1');
        await flush();
        await LogbookView.recalculateFromTrace();

        expect($('lb-site').value).toBe('PLAINE TREUIL');
        const choices = /** @type {HTMLElement} */ (document.getElementById('lb-site-choices'));
        expect(choices.hidden).toBe(false);
        const buttons = Array.from(choices.querySelectorAll('button'));
        expect(buttons.map((b) => b.textContent)).toEqual(['PLAINE PENTE', 'PLAINE TREUIL']);
        expect(buttons[1].getAttribute('aria-pressed')).toBe('true');

        LogbookView.pickSiteChoice('0');
        expect($('lb-site').value).toBe('PLAINE PENTE');
        expect(choices.querySelectorAll('button')[0].getAttribute('aria-pressed')).toBe('true');
    });

    it('keeps the typed site name when no known site is near the takeoff', async () => {
        LogbookView.editEntry('f1');
        await flush();
        await LogbookView.recalculateFromTrace();
        expect($('lb-site').value).toBe(FLIGHT.site);
    });
});
