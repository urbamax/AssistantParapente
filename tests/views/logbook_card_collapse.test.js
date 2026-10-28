import { describe, it, expect, beforeEach, vi } from 'vitest';
import LogbookService from '../../js/services/logbook_service.js';
import LogbookView from '../../js/views/logbook.js';

const flight = (id, extra = {}) => ({
    id,
    type: 'vol',
    datetime: '2026-09-01T10:00',
    site: `Site ${id}`,
    typeVol: 'Thermique',
    duree: 30,
    ...extra,
});

const card = (id) => document.querySelector(`.logbook-card[data-session-id="${id}"]`);
const collapsed = (id) => card(id).classList.contains('is-collapsed');

function setup(flights) {
    LogbookService.flights = flights;
    LogbookService.equipment = [];
    document.body.innerHTML = '<div id="logbook-history-list"></div>';
    LogbookView.expandedSessionIds.clear();
    LogbookView.activeFilter = null;
    LogbookView.renderHistory();
}

beforeEach(() => {
    Element.prototype.scrollIntoView = () => {};
    vi.spyOn(LogbookService, 'saveFlights').mockImplementation(() => {});
});

describe('logbook history: foldable session cards', () => {
    it('starts with every card folded', () => {
        setup([flight('a'), flight('b')]);
        expect(collapsed('a')).toBe(true);
        expect(collapsed('b')).toBe(true);
        expect(card('a').querySelector('.logbook-card-toggle').getAttribute('aria-expanded')).toBe('false');
    });

    it('unfolds and folds a card on toggle', () => {
        setup([flight('a'), flight('b')]);
        LogbookView.toggleSessionCard('a');
        expect(collapsed('a')).toBe(false);
        expect(collapsed('b')).toBe(true);
        expect(card('a').querySelector('.logbook-card-toggle').getAttribute('aria-expanded')).toBe('true');
        LogbookView.toggleSessionCard('a');
        expect(collapsed('a')).toBe(true);
    });

    it('keeps an unfolded card unfolded when the list is redrawn', () => {
        setup([flight('a'), flight('b')]);
        LogbookView.toggleSessionCard('b');
        LogbookView.renderHistory();
        expect(collapsed('a')).toBe(true);
        expect(collapsed('b')).toBe(false);
    });

    it('folds everything again when the logbook is reopened', async () => {
        setup([flight('a')]);
        LogbookView.toggleSessionCard('a');
        LogbookView.expandedSessionIds.clear(); // what mount() does
        LogbookView.renderHistory();
        expect(collapsed('a')).toBe(true);
    });

    it('unfolds only the session being looked up', () => {
        vi.useFakeTimers();
        setup([flight('a'), flight('b')]);
        LogbookView.scrollToSession('b');
        vi.advanceTimersByTime(100);
        expect(collapsed('b')).toBe(false);
        expect(collapsed('a')).toBe(true);
        vi.useRealTimers();
    });
});

describe('logbook history: elevation drop', () => {
    it('shows takeoff altitude minus landing altitude when the flight has a trace analysis', () => {
        setup([flight('a', { igcStats: { takeoffAlt: 1850, landingAlt: 1200 } })]);
        expect(card('a').querySelector('.session-extra-info').textContent).toContain('Dénivelé : 650m');
    });

    it('shows nothing without trace altitudes', () => {
        setup([flight('a', { altitudeMax: 2000 })]);
        expect(card('a').textContent).not.toContain('Dénivelé :');
    });
});
