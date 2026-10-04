import { describe, it, expect } from 'vitest';
import PilotHabits from '../../js/services/pilot_habits.js';

// Carnet du plus récent au plus ancien, comme LogbookService.getFlights()
const vol = (site, techDecollage, extra = {}) => ({ type: 'vol', site, techDecollage, typeVol: 'Plouf', ...extra });
const treuil = (site, techDecollage) => vol(site, techDecollage, { typeVol: 'Treuil' });
const repeat = (n, make) => Array.from({ length: n }, make);
const WINCH_PRIOR = { value: 'Dos voile', weight: 2, reason: 'winch' };
const technique = (sessions, context, prior = null) =>
    PilotHabits.suggest(sessions, 'techDecollage', { sessionType: 'vol', context, prior });

describe('PilotHabits.suggest: takeoff technique', () => {
    const coastal = repeat(40, () => vol('Wissant', 'Face voile'));

    it('at the winch, starts from "back-facing" even for a pilot who always launches forward at the coast', () => {
        expect(technique(coastal, { place: 'Antin', launch: 'treuil' }, WINCH_PRIOR)).toEqual({
            value: 'Dos voile',
            reason: 'winch',
        });
    });

    it('learns from the pilot: after 2 winch flights forward-facing, suggests forward-facing at the winch', () => {
        const one = [treuil('Antin', 'Face voile'), ...coastal];
        expect(technique(one, { place: 'Antin', launch: 'treuil' }, WINCH_PRIOR).value).toBe('Dos voile');
        const two = [treuil('Antin', 'Face voile'), treuil('Antin', 'Face voile'), ...coastal];
        expect(technique(two, { place: 'Antin', launch: 'treuil' }, WINCH_PRIOR)).toEqual({
            value: 'Face voile',
            reason: 'place',
        });
    });

    it('follows the habit on a given site, then the general habit elsewhere', () => {
        const history = [...repeat(5, () => vol('Mont Lambert', 'Dos voile')), ...coastal];
        expect(technique(history, { place: 'Wissant', launch: 'libre' })).toEqual({
            value: 'Face voile',
            reason: 'place',
        });
        expect(technique(history, { place: 'Mont Lambert', launch: 'libre' })).toEqual({
            value: 'Dos voile',
            reason: 'place',
        });
        expect(technique(history, { place: 'Site inconnu', launch: 'libre' }).value).toBe('Face voile');
    });

    it('lets recent habits replace old ones', () => {
        const history = [
            ...repeat(15, () => vol('Wissant', 'Dos voile')),
            ...repeat(25, () => vol('Wissant', 'Face voile')),
        ];
        expect(technique(history, { place: 'Wissant', launch: 'libre' }).value).toBe('Dos voile');
    });

    it('suggests nothing without history nor rule', () => {
        expect(technique([], { place: 'Antin', launch: 'libre' })).toBeNull();
    });
});

describe('PilotHabits.suggest: other fields', () => {
    it('learns the flight type of a site (a winch field)', () => {
        const history = [
            treuil('Antin', 'Dos voile'),
            treuil('Antin', 'Dos voile'),
            ...repeat(10, () => vol('Wissant', 'Face voile', { typeVol: 'Soaring' })),
        ];
        const typeVol = (place) =>
            PilotHabits.suggest(history, 'typeVol', {
                sessionType: 'vol',
                context: { place },
                mismatch: { place: 0.1 },
                minScore: 1,
            });
        expect(typeVol('Antin')).toEqual({ value: 'Treuil', reason: 'place' });
        expect(typeVol('Wissant')).toEqual({ value: 'Soaring', reason: 'place' });
    });

    it('treats "no school" as an answer, and drops the school once the pilot flies alone', () => {
        const school = (ecole) => vol('Antin', 'Dos voile', { ecole });
        const ecole = (history) =>
            PilotHabits.suggest(history, 'ecole', {
                sessionType: 'vol',
                context: { place: 'Antin' },
                includeEmpty: true,
                minScore: 1,
            });
        expect(ecole(repeat(5, () => school('FIL D’ARIANE'))).value).toBe('FIL D’ARIANE');
        expect(ecole([...repeat(8, () => school('')), ...repeat(5, () => school('FIL D’ARIANE'))]).value).toBe('');
    });
});

describe('PilotHabits.latest and rankByUse', () => {
    const sessions = [
        { type: 'vol', site: 'Wissant', voile: 'Nouvelle voile' },
        { type: 'vol', site: 'Antin', voile: 'Mini-voile' },
        { type: 'vol', site: 'Wissant', voile: 'Ancienne voile' },
        { type: 'vol', site: 'Wissant', voile: 'Ancienne voile' },
    ];

    it('uses the gear last flown on this site, otherwise the last gear (a new wing takes over at once)', () => {
        expect(PilotHabits.latest(sessions, 'voile', { sessionType: 'vol', place: 'antin' })).toEqual({
            value: 'Mini-voile',
            reason: 'place',
        });
        expect(PilotHabits.latest(sessions, 'voile', { sessionType: 'vol', place: 'Ailleurs' })).toEqual({
            value: 'Nouvelle voile',
            reason: 'latest',
        });
    });

    it('ranks places by use', () => {
        expect(PilotHabits.rankByUse(sessions, (s) => s.site)).toEqual(['Wissant', 'Antin']);
    });
});
