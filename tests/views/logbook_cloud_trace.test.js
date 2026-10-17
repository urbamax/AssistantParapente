import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import LogbookService from '../../js/services/logbook_service.js';
import SitesService from '../../js/services/sites_service.js';
import LogbookView from '../../js/views/logbook.js';
import Map3DComponent from '../../js/components/map_3d.js';
import { saveTextFile } from '../../js/utils/download.js';
import { FR } from '../../js/i18n/fr.js';

vi.mock('../../js/utils/download.js', () => ({ saveTextFile: vi.fn() }));
vi.mock('../../js/utils/print.js', () => ({ printHtml: vi.fn() }));

// Spec 037 : un vol importé sur un autre appareil n'a pas de trace ici, mais son vol annonce `traceCloud` :
// les boutons apparaissent, la trace est téléchargée à la demande, et l'écran dit ce qui se passe.

const INDEX = readFileSync('index.html', 'utf8');
const LOGBOOK_SCREEN = ['logbook-screen', 'logbook-session-modal']
    .map((id) => {
        const tpl = document.createElement('template');
        tpl.innerHTML = INDEX.slice(INDEX.search(new RegExp(`<(div|dialog)\\s[^>]*id="${id}"`)));
        return tpl.content.getElementById(id).outerHTML;
    })
    .join('');

const IGC = readFileSync('tests/fixtures/syride-winch-flight.igc', 'utf8');
const cloudOnly = {
    id: 'c1',
    type: 'vol',
    datetime: '2026-09-14T10:00',
    site: 'Plaine Joux',
    duree: 30,
    traceCloud: { at: 1, parts: 1, bytes: IGC.length, encoding: 'gzip-base64' },
};
const noTrace = { id: 'n1', type: 'vol', datetime: '2026-09-15T10:00', site: 'Dune', duree: 20 };

function setup(flights) {
    LogbookService.flights = flights;
    LogbookService.equipment = [];
    document.body.innerHTML = `${LOGBOOK_SCREEN}<input type="file" id="global-igc-input">`;
    LogbookView.setupEventListeners();
    LogbookView.renderHistory();
}
const container = (id) => document.getElementById(`trace-container-${id}`);

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.stubGlobal('alert', vi.fn());
    vi.spyOn(SitesService, 'getSites').mockReturnValue([]);
    vi.spyOn(SitesService, 'ensureSitesLoaded').mockResolvedValue(undefined);
    vi.spyOn(LogbookView, 'fetchWeatherForSession').mockResolvedValue(undefined);
    vi.spyOn(LogbookService, 'getLocalFlightTrace').mockResolvedValue(null);
    vi.spyOn(Map3DComponent, 'showTrace').mockResolvedValue(undefined);
    vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('boutons de trace pour un vol dont la trace est dans le compte (FR-1)', () => {
    it('« Voir la trace » et « Télécharger l’IGC » apparaissent sans trace locale', () => {
        setup([cloudOnly]);
        expect(document.querySelectorAll('[data-action="showTrace"]')).toHaveLength(1);
        expect(document.querySelectorAll('[data-action="downloadTrace"]')).toHaveLength(1);
    });

    it('un vol qui n’a de trace nulle part n’en propose pas', () => {
        setup([noTrace]);
        expect(document.querySelectorAll('[data-action="showTrace"]')).toHaveLength(0);
        expect(document.querySelectorAll('[data-action="downloadTrace"]')).toHaveLength(0);
    });
});

describe('Voir la trace d’un vol dont la trace est dans le compte', () => {
    it('annonce le chargement pendant le téléchargement, puis affiche la trace', async () => {
        setup([cloudOnly]);
        let finish;
        vi.spyOn(LogbookService, 'getFlightTrace').mockImplementation(
            () => new Promise((resolve) => (finish = () => resolve(IGC))),
        );

        const shown = LogbookView.showTrace('c1');
        await vi.waitFor(() => expect(container('c1').textContent).toContain(FR.logbook.cloudTrace.loading));
        expect(container('c1').style.display).toBe('block');

        finish();
        await shown;
        expect(Map3DComponent.showTrace).toHaveBeenCalledTimes(1);
        const [, points] = Map3DComponent.showTrace.mock.calls[0];
        expect(points.length).toBeGreaterThan(10);
    });

    it('dit que la trace est dans le compte mais n’a pas pu être récupérée (et non « introuvable »)', async () => {
        setup([cloudOnly]);
        vi.spyOn(LogbookService, 'getFlightTrace').mockResolvedValue(null);

        await LogbookView.showTrace('c1');

        expect(container('c1').textContent).toBe(FR.logbook.cloudTrace.unavailable);
        expect(container('c1').textContent).not.toContain('introuvable');
        expect(Map3DComponent.showTrace).not.toHaveBeenCalled();
    });

    it('un second clic referme le message, un troisième réessaie', async () => {
        setup([cloudOnly]);
        const getTrace = vi.spyOn(LogbookService, 'getFlightTrace').mockResolvedValueOnce(null).mockResolvedValue(IGC);

        await LogbookView.showTrace('c1');
        expect(container('c1').style.display).toBe('block');
        await LogbookView.showTrace('c1');
        expect(container('c1').style.display).toBe('none');
        await LogbookView.showTrace('c1');

        expect(getTrace).toHaveBeenCalledTimes(2);
        expect(Map3DComponent.showTrace).toHaveBeenCalledTimes(1);
    });

    it('n’affiche aucun message de chargement quand la trace est déjà sur l’appareil', async () => {
        setup([{ ...cloudOnly, rawIgc: IGC }]);
        const getTrace = vi.spyOn(LogbookService, 'getFlightTrace');
        await LogbookView.showTrace('c1');
        expect(getTrace).not.toHaveBeenCalled();
        expect(container('c1').textContent).not.toContain(FR.logbook.cloudTrace.loading);
        expect(Map3DComponent.showTrace).toHaveBeenCalledTimes(1);
    });
});

describe('Télécharger l’IGC d’un vol dont la trace est dans le compte', () => {
    it('enregistre le fichier téléchargé depuis le compte', async () => {
        setup([cloudOnly]);
        vi.spyOn(LogbookService, 'getFlightTrace').mockResolvedValue(IGC);
        await LogbookView.downloadTrace('c1');
        expect(saveTextFile).toHaveBeenCalledWith('2026-09-14_plaine-joux.igc', IGC, expect.any(String));
        expect(alert).not.toHaveBeenCalled();
    });

    it('explique que la trace n’a pas pu être récupérée (hors ligne ?) au lieu de la dire introuvable', async () => {
        setup([cloudOnly]);
        vi.spyOn(LogbookService, 'getFlightTrace').mockResolvedValue(null);
        await LogbookView.downloadTrace('c1');
        expect(saveTextFile).not.toHaveBeenCalled();
        expect(alert).toHaveBeenCalledWith(FR.logbook.cloudTrace.unavailable);
    });

    it('garde « introuvable » pour un vol qui n’a de trace nulle part', async () => {
        setup([noTrace]);
        await LogbookView.downloadTrace('n1');
        expect(alert).toHaveBeenCalledWith(FR.logbook.export.noTrace);
    });
});

describe('import d’une trace', () => {
    it('le texte d’échec n’annonce pas une trace « introuvable » pour un problème de réseau', () => {
        expect(FR.logbook.cloudTrace.unavailable).toMatch(/compte/);
        expect(FR.logbook.cloudTrace.unavailable).toMatch(/connexion/);
    });
});
