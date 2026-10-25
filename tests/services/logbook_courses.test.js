import { describe, it, expect } from 'vitest';
import {
    instructorsOf,
    courseKey,
    isCourseSession,
    courseNames,
    latestOfCourse,
    preferPlace,
    courseStats,
} from '../../js/services/logbook_courses.js';

// Carnet du plus récent au plus ancien, comme LogbookService.getFlights()
const school = (type, extra = {}) => ({ type, ecole: 'ÉCOLE TEST', duree: 10, ...extra });
const flight = (extra = {}) => school('vol', { site: 'Plaine', ...extra });
const ground = (extra = {}) => school('gonflage', { lieu: 'Plaine', ...extra });

describe('instructorsOf', () => {
    it('reads a list, a former single text, and nothing', () => {
        expect(instructorsOf({ moniteur: ['Gilbert', 'Marie'] })).toEqual(['Gilbert', 'Marie']);
        expect(instructorsOf({ moniteur: 'Gilbert' })).toEqual(['Gilbert']);
        expect(instructorsOf({ moniteur: '' })).toEqual([]);
        expect(instructorsOf({})).toEqual([]);
        expect(instructorsOf(null)).toEqual([]);
    });

    it('trims, drops blanks and non-texts, and keeps the first spelling of a duplicate', () => {
        expect(instructorsOf({ moniteur: [' Gilbert ', '', 'gilbert', 3, 'Marie', null] })).toEqual([
            'Gilbert',
            'Marie',
        ]);
    });
});

describe('courseKey and isCourseSession', () => {
    it('compares course names without case or surrounding spaces', () => {
        expect(courseKey({ stageName: '  Stage Été ' })).toBe('stage été');
        expect(courseKey({ stageName: 'stage été' })).toBe('stage été');
        expect(courseKey({ stageSpecialty: 'SIV' })).toBe('');
        expect(courseKey({})).toBe('');
    });

    it('needs a school and a course name or a specialty', () => {
        expect(isCourseSession(flight({ stageName: 'Stage' }))).toBe(true);
        expect(isCourseSession(flight({ stageSpecialty: 'SIV' }))).toBe(true);
        expect(isCourseSession(flight())).toBe(false);
        expect(isCourseSession(flight({ stageName: '  ', stageSpecialty: '' }))).toBe(false);
        expect(isCourseSession({ type: 'vol', stageName: 'Stage' })).toBe(false);
        expect(isCourseSession(null)).toBe(false);
    });
});

describe('courseNames', () => {
    it('lists each course once, most used first, with the spelling of the most recent session', () => {
        const sessions = [
            flight({ stageName: 'stage été' }),
            flight({ stageName: 'Perf' }),
            flight({ stageName: 'Stage Été' }),
            flight({ stageName: 'Stage été ' }),
            flight({ stageName: 'Perf' }),
            flight({ stageName: 'Stage été' }),
            flight(),
        ];
        expect(courseNames(sessions)).toEqual(['stage été', 'Perf']);
    });

    it('ignores sessions without a course name or without a school', () => {
        expect(courseNames([flight({ stageSpecialty: 'SIV' }), { type: 'vol', stageName: 'Orphelin' }])).toEqual([]);
        expect(courseNames([])).toEqual([]);
    });
});

describe('latestOfCourse', () => {
    const sessions = [
        flight({ id: 'a', stageName: 'Perf' }),
        flight({ id: 'b', stageName: 'stage été' }),
        flight({ id: 'c', stageName: 'Stage été' }),
    ];

    it('returns the most recent session of the course, whatever the case', () => {
        expect(latestOfCourse(sessions, ' STAGE ÉTÉ ')?.id).toBe('b');
        expect(latestOfCourse(sessions, 'Perf')?.id).toBe('a');
    });

    it('returns null for an unknown or empty name', () => {
        expect(latestOfCourse(sessions, 'Inconnu')).toBeNull();
        expect(latestOfCourse(sessions, '   ')).toBeNull();
        expect(latestOfCourse([], 'Perf')).toBeNull();
    });
});

describe('preferPlace', () => {
    const sessions = [flight({ id: 'a', site: 'Col' }), flight({ id: 'b', site: 'Plaine' })];

    it('prefers the most recent session at the place, otherwise the most recent one', () => {
        expect(preferPlace(sessions, 'plaine')?.id).toBe('b');
        expect(preferPlace(sessions, 'Ailleurs')?.id).toBe('a');
        expect(preferPlace(sessions, '')?.id).toBe('a');
        expect(preferPlace([], 'Plaine')).toBeNull();
    });
});

describe('courseStats', () => {
    const sessions = [
        flight({ id: '1', stageName: 'stage été', stageSpecialty: 'SIV', ecole: 'École B', duree: 20 }),
        ground({ id: '2', stageName: 'Perf', stageSpecialty: 'Cross', duree: 30 }),
        flight({ id: '3', stageName: 'Stage Été', stageSpecialty: 'Initiation', ecole: 'École A', duree: 15 }),
        ground({ id: '4', stageName: 'Stage été ', duree: 45 }),
        flight({ id: '5', stageSpecialty: 'SIV', duree: 12 }),
        flight({ id: '6' }),
        { id: '7', type: 'vol', stageName: 'Sans école', duree: 9 },
    ];
    const stats = courseStats(sessions);

    it('groups the sessions of a course regardless of case and spaces', () => {
        const summer = stats.find((c) => c.key === 'stage été');
        expect(summer).toMatchObject({
            flights: 2,
            flightMinutes: 35,
            groundSessions: 1,
            groundMinutes: 45,
            sessions: 3,
        });
    });

    it('takes name, school and specialty from the most recent session of the course', () => {
        expect(stats.find((c) => c.key === 'stage été')).toMatchObject({
            name: 'stage été',
            school: 'École B',
            specialty: 'SIV',
        });
    });

    it('puts sessions with a specialty but no name in one unnamed course', () => {
        expect(stats.find((c) => c.key === '')).toMatchObject({
            name: '',
            flights: 1,
            flightMinutes: 12,
            groundSessions: 0,
            sessions: 1,
        });
    });

    it('leaves out sessions that are not part of a course', () => {
        expect(stats.reduce((sum, c) => sum + c.sessions, 0)).toBe(sessions.filter(isCourseSession).length);
        expect(stats.map((c) => c.key)).toEqual(['stage été', 'perf', '']);
    });

    it('orders by number of sessions, then by most recent', () => {
        const tied = courseStats([
            flight({ stageName: 'Récent' }),
            flight({ stageName: 'Ancien' }),
            flight({ stageName: 'Ancien' }),
            flight({ stageName: 'Récent' }),
            flight({ stageName: 'Seul' }),
        ]);
        expect(tied.map((c) => c.name)).toEqual(['Récent', 'Ancien', 'Seul']);
    });

    it('is empty without any course session', () => {
        expect(courseStats([flight(), ground()])).toEqual([]);
        expect(courseStats([])).toEqual([]);
    });
});
