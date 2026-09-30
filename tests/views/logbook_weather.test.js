import { describe, it, expect, beforeEach } from 'vitest';
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
