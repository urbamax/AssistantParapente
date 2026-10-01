import { describe, it, expect, beforeEach, vi } from 'vitest';
import LogbookService from '../../js/services/logbook_service.js';
import LogbookView from '../../js/views/logbook.js';

describe('LogbookView.refreshSessionWeather', () => {
    const flight = { id: '42', type: 'vol', site: 'Annecy', datetime: '2026-09-20T15:38', duree: 17 };

    beforeEach(() => {
        localStorage.clear();
        LogbookService.flights = [flight];
        document.body.innerHTML = `
            <div id="logbook-history-list">
                <div class="logbook-card">
                    <div id="trace-container-42" style="display:block">3D MAP</div>
                    <div data-session-weather="42"><button>Récupérer la météo</button></div>
                </div>
            </div>`;
    });

    it('fills the weather block without touching the open GPS trace', () => {
        const traceNode = document.getElementById('trace-container-42');
        flight.meteo = { temperature: 19, ventVitesse: 15, ventRafales: 20, ventDirection: 290, weatherCode: 1 };

        LogbookView.refreshSessionWeather('42');

        expect(document.getElementById('trace-container-42')).toBe(traceNode);
        expect(traceNode.style.display).toBe('block');
        expect(document.querySelector('[data-session-weather="42"]').textContent).toContain('Décollage');
    });

    it('does nothing when the card is not on screen (another tab is active)', () => {
        document.body.innerHTML = '<div id="logbook-history-list"></div>';
        expect(() => LogbookView.refreshSessionWeather('42')).not.toThrow();
    });
});

describe('LogbookView.renderSessionWeatherHtml labels', () => {
    const meteo = { temperature: 28, ventVitesse: 18, ventRafales: 47, ventDirection: 185, weatherCode: 2 };

    it('labels a flight with take-off and landing', () => {
        const html = LogbookView.renderSessionWeatherHtml({ id: '1', type: 'vol', meteo, meteoAtterro: meteo });
        expect(html).toContain('Décollage');
        expect(html).toContain('Atterrissage');
    });

    it('labels a ground handling session with start and end, never take-off or landing', () => {
        const html = LogbookView.renderSessionWeatherHtml({ id: '2', type: 'gonflage', meteo, meteoAtterro: meteo });
        expect(html).toContain('Début :');
        expect(html).toContain('Fin :');
        expect(html).not.toContain('Décollage');
        expect(html).not.toContain('Atterrissage');
    });
});

describe('LogbookView combined weather row', () => {
    const meteo = { temperature: 20, ventVitesse: 10, ventRafales: 15, ventDirection: 200, weatherCode: 1 };

    it('labels a single row « Décollage et atterrissage » only when both were identical', () => {
        const html = LogbookView.renderSessionWeatherHtml({
            id: '1',
            type: 'vol',
            duree: 30,
            meteo,
            meteoAtterroSame: true,
        });
        expect(html).toContain('Décollage et atterrissage');
        const ground = LogbookView.renderSessionWeatherHtml({
            id: '2',
            type: 'gonflage',
            duree: 30,
            meteo,
            meteoAtterroSame: true,
        });
        expect(ground).toContain('Début et fin');
    });

    it('never claims the landing weather when it is unknown (failed fetch, older session)', () => {
        const html = LogbookView.renderSessionWeatherHtml({
            id: '3',
            type: 'vol',
            duree: 30,
            meteo,
            meteoAtterro: null,
        });
        expect(html).toContain('Décollage :');
        expect(html).not.toContain('atterrissage');
    });

    it('stores the flag when the take-off and landing weather are identical', async () => {
        const flight = { id: '9', type: 'vol', site: 'X', datetime: '2026-09-20T15:00', duree: 60 };
        LogbookService.flights = [flight];
        document.body.innerHTML = '<div data-session-weather="9"></div>';
        vi.spyOn(LogbookService, 'saveFlights').mockImplementation(() => {});
        vi.spyOn(LogbookService, 'fetchSessionWeather').mockResolvedValue({ success: true, data: { ...meteo } });
        await LogbookView.fetchWeatherForSession(45, 5, flight.datetime, '9', 60, null);
        expect(flight.meteoAtterroSame).toBe(true);
        expect(flight.meteoAtterro).toBeNull();

        LogbookService.fetchSessionWeather
            .mockResolvedValueOnce({ success: true, data: { ...meteo } })
            .mockResolvedValueOnce({ success: false, data: null, error: 'réseau' });
        await LogbookView.fetchWeatherForSession(45, 5, flight.datetime, '9', 60, null);
        expect(flight.meteoAtterroSame).toBe(false);
        vi.restoreAllMocks();
    });
});
