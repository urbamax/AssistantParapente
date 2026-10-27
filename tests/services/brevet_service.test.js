import { beforeEach, describe, expect, it } from 'vitest';
import StorageService from '../../js/services/storage.js';
import GlobalState from '../../js/core/app_state.js';
import LogbookService from '../../js/services/logbook_service.js';
import BrevetService, {
    BREVET_CODES,
    PROGRESSION_CHAIN,
    computeTheoryPercentage,
    normalizeBrevetEntry,
    getPracticalPilotLevel,
    isTheoryValidated,
    getTargetTheoryLevel,
    getTargetSchoolBrevet,
    resolveSuggestedBrevet,
    brevetSummary,
    unassignedSchoolSessionsFor,
    mergeBrevets,
} from '../../js/services/brevet_service.js';

describe('BrevetService — domain & persistence', () => {
    beforeEach(() => {
        localStorage.clear();
        GlobalState.init();
    });

    it('exposes the 4 FFVL certification codes and the 3-step progression chain', () => {
        expect(BREVET_CODES).toEqual(['BI', 'BP', 'BPC', 'TREUIL']);
        expect(PROGRESSION_CHAIN).toEqual(['BI', 'BP', 'BPC']);
    });

    it('auto-computes theory percentage from score/total and falls back to direct percentage', () => {
        expect(computeTheoryPercentage(28, 30, null)).toBe(93);
        expect(computeTheoryPercentage(27, 30, null)).toBe(90);
        expect(computeTheoryPercentage(35, 30, null)).toBe(100);
        expect(computeTheoryPercentage(null, null, 88)).toBe(88);
        expect(computeTheoryPercentage('', '', '')).toBeNull();
    });

    it('normalizes partial or empty brevet entries safely', () => {
        const empty = normalizeBrevetEntry(null);
        expect(empty.theory.passed).toBe(false);
        expect(empty.theory.score).toBeNull();
        expect(empty.theory.total).toBeNull();
        expect(empty.theory.percentage).toBeNull();
        expect(empty.practical.validated).toBe(false);

        const filled = normalizeBrevetEntry({
            theory: {
                passed: true,
                date: '2026-10-15',
                score: '28',
                total: '30',
                school: ' Cumulus ',
                examiner: ' Jean ',
            },
            practical: {
                validated: true,
                date: '2026-10-26',
                school: ' Cumulus ',
                instructor: ' Jean ',
                notes: ' Autonomie OK ',
            },
        });
        expect(filled.theory.passed).toBe(true);
        expect(filled.theory.score).toBe(28);
        expect(filled.theory.total).toBe(30);
        expect(filled.theory.percentage).toBe(93);
        expect(filled.theory.school).toBe('Cumulus');
        expect(filled.practical.validated).toBe(true);
        expect(filled.practical.instructor).toBe('Jean');
        expect(filled.practical.notes).toBe('Autonomie OK');
    });

    it('persists brevets in USER_PREFS and advances GlobalState level to next theory target', () => {
        GlobalState.set('level', 'BI');
        expect(GlobalState.get('level')).toBe('BI');
        expect(BrevetService.hasAnyBrevetData()).toBe(false);

        BrevetService.saveBrevet('BI', {
            theory: { passed: true, date: '2026-10-15', score: 28, total: 30, school: 'Cumulus' },
            practical: { validated: true, date: '2026-10-26', school: 'Cumulus', instructor: 'Jean' },
        });

        expect(BrevetService.hasAnyBrevetData()).toBe(true);
        const bi = BrevetService.getBrevet('BI');
        expect(bi.theory.passed).toBe(true);
        expect(bi.theory.percentage).toBe(93);
        expect(bi.practical.validated).toBe(true);

        // Once BI theory is passed, target theory level in QCM advances to BP
        expect(GlobalState.get('level')).toBe('BP');
        // Meanwhile, practical flight level for Sites is BI
        expect(BrevetService.getPracticalPilotLevel()).toBe('BI');
    });

    it('dissociates practical flight level from target theory level across BI -> BP -> BPC', () => {
        const initial = BrevetService.getBrevets();
        expect(getPracticalPilotLevel(initial)).toBeNull();
        expect(getTargetTheoryLevel(initial)).toBe('BI');

        // Pilot passes BI theory only (not yet practical BI)
        BrevetService.saveBrevet('BI', {
            theory: { passed: true, date: '2026-10-10', score: 27, total: 30 },
            practical: { validated: false },
        });
        expect(BrevetService.getPracticalPilotLevel()).toBeNull();
        expect(BrevetService.getTargetTheoryLevel()).toBe('BP');
        expect(isTheoryValidated('BI', BrevetService.getBrevets())).toBe(true);
        expect(isTheoryValidated('BP', BrevetService.getBrevets())).toBe(false);

        // Pilot validates BI practical -> flies as BI, works on BP theory
        BrevetService.saveBrevet('BI', {
            theory: { passed: true, date: '2026-10-10', score: 27, total: 30 },
            practical: { validated: true, date: '2026-10-26' },
        });
        expect(BrevetService.getPracticalPilotLevel()).toBe('BI');
        expect(BrevetService.getTargetTheoryLevel()).toBe('BP');

        // Pilot passes BP theory (still flying as BI practically)
        BrevetService.saveBrevet('BP', {
            theory: { passed: true, date: '2026-11-15', percentage: 90 },
            practical: { validated: false },
        });
        expect(BrevetService.getPracticalPilotLevel()).toBe('BI');
        expect(BrevetService.getTargetTheoryLevel()).toBe('BPC');

        // Validating TREUIL does not alter the BI -> BP -> BPC progression chain
        BrevetService.saveBrevet('TREUIL', {
            theory: { passed: true, date: '2026-11-20' },
            practical: { validated: true, date: '2026-11-20' },
        });
        expect(BrevetService.getPracticalPilotLevel()).toBe('BI');
        expect(BrevetService.getTargetTheoryLevel()).toBe('BPC');
    });

    it('resolves suggested school brevet based on validation date', () => {
        BrevetService.saveBrevet('BI', {
            theory: { passed: true, date: '2026-10-15' },
            practical: { validated: true, date: '2026-10-26' },
        });
        const brevets = BrevetService.getBrevets();

        // Session on or before BI validation date -> still BI
        expect(getTargetSchoolBrevet(brevets, '2026-10-20')).toBe('BI');
        expect(getTargetSchoolBrevet(brevets, '2026-10-26T14:00')).toBe('BI');
        expect(resolveSuggestedBrevet('BI', brevets, '2026-10-26')).toBe('BI');

        // Session strictly after BI validation date -> advances to BP!
        expect(getTargetSchoolBrevet(brevets, '2026-10-27')).toBe('BP');
        expect(resolveSuggestedBrevet('BI', brevets, '2026-10-27T09:30')).toBe('BP');

        // Independent TREUIL habit stays TREUIL if TREUIL is not validated before session date
        expect(resolveSuggestedBrevet('TREUIL', brevets, '2026-10-27')).toBe('TREUIL');
    });

    it('aggregates school sessions per brevet and batch-assigns unassigned school sessions', () => {
        StorageService.set(StorageService.KEYS.LOGBOOK_DATA, [
            {
                id: 's1',
                type: 'vol',
                date: '2026-10-20T10:00',
                duree: 25,
                ecole: 'Cumulus',
                moniteur: 'Jean',
                exercices: ['PTU', 'Oreilles'],
                brevetPrepare: 'BI',
            },
            {
                id: 's2',
                type: 'gonflage',
                date: '2026-10-21T14:00',
                duree: 90,
                ecole: 'Cumulus',
                moniteur: 'Jean',
                exercices: ['Gonflage face voile'],
                brevetPrepare: '',
            },
            {
                id: 's3',
                type: 'vol',
                date: '2026-10-22T11:00',
                duree: 35,
                ecole: '',
                moniteur: '',
            },
        ]);
        LogbookService.loadData();

        const initialFlights = LogbookService.getFlights();
        const unassigned = unassignedSchoolSessionsFor('BI', initialFlights, BrevetService.getBrevets());
        expect(unassigned.map((s) => s.id)).toEqual(['s2']);

        const updatedCount = BrevetService.batchAssignBrevet('BI', ['s2', 's3']);
        expect(updatedCount).toBe(1); // s3 is not a school session so it is ignored

        const summary = brevetSummary('BI', LogbookService.getFlights(), BrevetService.getBrevets());
        expect(summary.flights).toBe(1);
        expect(summary.flightMinutes).toBe(25);
        expect(summary.groundSessions).toBe(1);
        expect(summary.groundMinutes).toBe(90);
        expect(summary.schools).toEqual(['Cumulus']);
        expect(summary.instructors).toEqual(['Jean']);
        expect(summary.exercises).toEqual(['Gonflage face voile', 'Oreilles', 'PTU']);
    });

    it('merges local and cloud brevets losslessly by updatedAt per code', () => {
        const local = {
            BI: {
                theory: { passed: true, date: '2026-10-15', score: 28, total: 30, percentage: 93 },
                practical: { validated: true, date: '2026-10-26', school: 'Cumulus' },
                updatedAt: '2026-10-26T18:00:00.000Z',
            },
            BP: {
                theory: { passed: false },
                practical: { validated: false },
                updatedAt: '2026-10-01T10:00:00.000Z',
            },
        };
        const cloud = {
            BI: {
                theory: { passed: true, date: '2026-10-15', score: 28, total: 30, percentage: 93 },
                practical: { validated: false },
                updatedAt: '2026-10-15T12:00:00.000Z',
            },
            BP: {
                theory: { passed: true, date: '2026-10-27', score: 29, total: 30, percentage: 97 },
                practical: { validated: false },
                updatedAt: '2026-10-27T09:00:00.000Z',
            },
        };

        const merged = mergeBrevets(local, cloud);
        expect(merged.BI.practical.validated).toBe(true);
        expect(merged.BP.theory.passed).toBe(true);
        expect(merged.BP.theory.percentage).toBe(97);
    });
});
