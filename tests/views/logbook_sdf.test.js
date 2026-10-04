import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import LogbookService from '../../js/services/logbook_service.js';
import SitesService from '../../js/services/sites_service.js';
import LogbookView from '../../js/views/logbook.js';

// Import du .sdf Syride à côté du .igc : facteur de charge et température du vario.
const INDEX = readFileSync('index.html', 'utf8');
const LOGBOOK_SCREEN = ['logbook-screen', 'logbook-session-modal']
    .map((id) => {
        const tpl = document.createElement('template');
        tpl.innerHTML = INDEX.slice(INDEX.search(new RegExp(`<(div|dialog)\\s[^>]*id="${id}"`)));
        return tpl.content.getElementById(id).outerHTML;
    })
    .join('');

const IGC = readFileSync('tests/fixtures/syride-2026-10-03.igc', 'utf8');
const SDF = readFileSync('tests/fixtures/syride-2026-10-03.sdf');
const igcFile = () => new File([IGC], 'flight.igc', { type: 'text/plain' });
// jsdom n'implémente pas toujours Blob.arrayBuffer : on fournit un objet équivalent
const sdfFile = (bytes = SDF) => ({ name: 'flight.SDF', arrayBuffer: async () => new Uint8Array(bytes).buffer });
const $ = (id) => /** @type {HTMLInputElement} */ (document.getElementById(id));

function fillRequired() {
    $('lb-site').value = 'ANTIN';
    const wing = /** @type {HTMLSelectElement} */ (document.getElementById('lb-voile'));
    wing.innerHTML = '<option value="Ma voile">Ma voile</option>';
    wing.value = 'Ma voile';
}

beforeEach(() => {
    localStorage.clear();
    Element.prototype.scrollIntoView = () => {};
    vi.spyOn(SitesService, 'getSites').mockReturnValue([]);
    vi.spyOn(SitesService, 'ensureSitesLoaded').mockResolvedValue(undefined);
    vi.spyOn(LogbookService, 'saveFlights').mockImplementation(() => {});
    vi.spyOn(LogbookService, 'reverseGeocode').mockResolvedValue({ success: true, data: { city: null } });
    vi.spyOn(LogbookView, 'fetchWeatherForSession').mockResolvedValue(undefined);
    vi.stubGlobal('alert', vi.fn());
    LogbookService.flights = [];
    LogbookView.currentFormType = 'vol';
    document.body.innerHTML = `${LOGBOOK_SCREEN}<input type="file" id="global-igc-input">`;
    LogbookView.setupEventListeners();
    LogbookView.resetForm();
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('logbook: Syride .sdf with the .igc', () => {
    it('reads the load factor and temperature of the flight and saves them', async () => {
        await LogbookView._processFiles([sdfFile(), igcFile()]); // ordre quelconque
        expect($('igc-upload-filename').textContent).toContain('1.3 g max, 27 °C au déco');
        fillRequired();
        LogbookView.submitForm();

        const saved = LogbookService.getFlights()[0];
        expect(saved.sensorStats).toEqual({
            gMax: 1.3,
            gMin: 0.9,
            tempTakeoff: 27,
            tempMin: 22,
            tempMax: 27,
            source: 'sdf',
        });
        expect(saved.igcStats.estimatedMaxG).toBeGreaterThanOrEqual(1);

        const html = LogbookView.renderFlightAnalysis(saved);
        expect(html).toContain('Facteur de charge max</span><strong>1.3 g');
        expect(html).toContain('27 °C au déco (22 à 27 °C)');
        expect(html).not.toContain('(estimé)');
    });

    it('can be added later to a flight that already has its trace', async () => {
        LogbookService.flights = [
            {
                id: 'f1',
                type: 'vol',
                datetime: '2026-10-03T12:06',
                site: 'ANTIN',
                voile: 'Ma voile',
                duree: 4,
                rawIgc: IGC,
            },
        ];
        LogbookView.resetForm();
        LogbookView.editEntry('f1');
        await LogbookView._processFiles([sdfFile()]);
        fillRequired();
        LogbookView.submitForm();
        expect(LogbookService.getFlightById('f1').sensorStats.gMax).toBe(1.3);
        expect(LogbookService.getFlightById('f1').rawIgc).toBe(IGC);
    });

    it('refuses a .sdf that is not from this flight, or not a .sdf at all', async () => {
        const shifted = new Uint8Array(SDF);
        const view = new DataView(shifted.buffer);
        for (let o = 8; o < shifted.length; o += 21) view.setInt32(o, view.getInt32(o) + 100000); // +1 km au nord
        await LogbookView._processFiles([igcFile(), sdfFile(shifted)]);
        expect(alert).toHaveBeenCalledWith(expect.stringContaining('ne correspond pas'));

        await LogbookView._processFiles([sdfFile(new Uint8Array(30))]);
        expect(alert).toHaveBeenCalledWith(expect.stringContaining("n'est pas un fichier .sdf"));
        expect(LogbookView.currentSensorStats).toBeNull();
    });

    it('shows the estimated load factor when there is no sensor file', () => {
        const html = LogbookView.renderFlightAnalysis({ igcStats: { estimatedMaxG: 1.4 } });
        expect(html).toContain('Facteur de charge max (estimé)</span><strong>≈ 1.4 g');
    });
});
