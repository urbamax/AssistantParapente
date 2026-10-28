import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import LogbookService from '../../js/services/logbook_service.js';
import IDBStorage from '../../js/services/idb_storage.js';
import StorageService from '../../js/services/storage.js';

// Spec 046 : les vols importés d'un export FFVL sont marqués et rassemblés par import, pour savoir d'où ils
// viennent et pouvoir annuler un import.

const manual = (id, datetime = '2026-09-01T10:00') => ({ id, type: 'vol', datetime, site: 'Annecy', duree: 20 });
const imported = (id, batchId, importedAt, extra = {}) => ({
    id,
    type: 'vol',
    datetime: '2026-10-27T00:00',
    dateOnly: true,
    site: 'Sanary',
    duree: 60,
    updatedAt: importedAt,
    import: { source: 'ffvl-xlsx', batchId, importedAt, key: `key-${id}` },
    ...extra,
});

const storedIds = () => (StorageService.get(StorageService.KEYS.LOGBOOK_DATA) || []).map((f) => f.id);

describe('LogbookService - imports (spec 046)', () => {
    beforeEach(() => {
        localStorage.clear();
        LogbookService.flights = [];
        LogbookService.equipment = [];
        window.FirebaseAuthEngine = {
            currentUser: { uid: 'user123' },
            syncLogbookData: vi.fn().mockResolvedValue(),
            syncEquipmentData: vi.fn().mockResolvedValue(),
            deleteLogbookEntry: vi.fn().mockResolvedValue(),
            triggerDebouncedSync: vi.fn(),
        };
    });

    afterEach(() => {
        window.FirebaseAuthEngine = undefined;
        vi.restoreAllMocks();
    });

    describe('addFlights with a date', () => {
        it('stamps every flight with the given time, so a flight not edited since keeps updatedAt = importedAt', () => {
            const result = LogbookService.addFlights([manual('x'), manual('y')], 4242);
            expect(result.data.map((f) => f.updatedAt)).toEqual([4242, 4242]);
        });

        it('keeps stamping with the current time when no date is given', () => {
            const before = Date.now();
            const [flight] = LogbookService.addFlights([manual('x')]).data;
            expect(flight.updatedAt).toBeGreaterThanOrEqual(before);
        });
    });

    describe('deleteFlights', () => {
        beforeEach(() => {
            LogbookService.flights = [manual('a'), manual('b'), manual('c')];
            LogbookService.saveFlights();
        });

        it('removes the flights with one save, and leaves the others', () => {
            const save = vi.spyOn(LogbookService, 'saveFlights');
            LogbookService.deleteFlights(['a', 'c']);
            expect(LogbookService.getFlights().map((f) => f.id)).toEqual(['b']);
            expect(storedIds()).toEqual(['b']);
            expect(save).toHaveBeenCalledTimes(1);
        });

        it('marks each flight as deleted (so a sync never brings it back) and deletes it in the cloud', () => {
            LogbookService.deleteFlights(['a', 'c']);
            expect(JSON.parse(localStorage.getItem('deleted_flights'))).toEqual(['a', 'c']);
            expect(window.FirebaseAuthEngine.deleteLogbookEntry.mock.calls.map((c) => c[0])).toEqual(['a', 'c']);
        });

        it('removes the stored GPS trace of each flight', () => {
            vi.spyOn(IDBStorage, 'isSupported').mockReturnValue(true);
            vi.spyOn(IDBStorage, 'saveFlights').mockResolvedValue();
            const deleteFlight = vi.spyOn(IDBStorage, 'deleteFlight').mockResolvedValue();
            LogbookService.deleteFlights(['a', 'b']);
            expect(deleteFlight.mock.calls.map((c) => c[0])).toEqual(['a', 'b']);
        });

        it('does nothing for an empty list or unknown ids', () => {
            const save = vi.spyOn(LogbookService, 'saveFlights');
            LogbookService.deleteFlights([]);
            LogbookService.deleteFlights(['nope']);
            expect(LogbookService.getFlights()).toHaveLength(3);
            expect(save).not.toHaveBeenCalled();
            expect(window.FirebaseAuthEngine.deleteLogbookEntry).not.toHaveBeenCalled();
        });

        it('is what deleteFlight does for one flight', () => {
            LogbookService.deleteFlight('b');
            expect(LogbookService.getFlights().map((f) => f.id)).toEqual(['a', 'c']);
            expect(JSON.parse(localStorage.getItem('deleted_flights'))).toEqual(['b']);
            expect(window.FirebaseAuthEngine.deleteLogbookEntry).toHaveBeenCalledWith('b');
        });
    });

    describe('importBatches', () => {
        it('is empty when no flight was imported', () => {
            LogbookService.flights = [manual('a')];
            expect(LogbookService.importBatches()).toEqual([]);
        });

        it('groups the imported flights by import, the newest import first', () => {
            LogbookService.flights = [
                manual('m'),
                imported('a', 'old', 1000),
                imported('b', 'new', 2000),
                imported('c', 'new', 2000),
            ];
            expect(LogbookService.importBatches()).toEqual([
                { batchId: 'new', source: 'ffvl-xlsx', importedAt: 2000, ids: ['b', 'c'], count: 2, editedCount: 0 },
                { batchId: 'old', source: 'ffvl-xlsx', importedAt: 1000, ids: ['a'], count: 1, editedCount: 0 },
            ]);
        });

        it('counts the flights edited since the import', () => {
            LogbookService.flights = [imported('a', 'b1', 1000), imported('b', 'b1', 1000, { updatedAt: 5000 })];
            expect(LogbookService.importBatches()[0]).toMatchObject({ count: 2, editedCount: 1 });
        });

        it('ignores a flight whose import mark is incomplete', () => {
            LogbookService.flights = [
                { ...manual('a'), import: {} },
                { ...manual('b'), import: null },
            ];
            expect(LogbookService.importBatches()).toEqual([]);
        });
    });

    describe('undoImport', () => {
        it('removes the flights of that import and only those', () => {
            LogbookService.flights = [manual('m'), imported('a', 'one', 1000), imported('b', 'two', 2000)];
            LogbookService.saveFlights();
            const removed = LogbookService.undoImport('one');
            expect(removed).toBe(1);
            expect(
                LogbookService.getFlights()
                    .map((f) => f.id)
                    .sort(),
            ).toEqual(['b', 'm']);
            expect(window.FirebaseAuthEngine.deleteLogbookEntry).toHaveBeenCalledWith('a');
            expect(LogbookService.importBatches().map((b) => b.batchId)).toEqual(['two']);
        });

        it('removes a flight of the import even if the pilot edited it since', () => {
            LogbookService.flights = [imported('a', 'one', 1000, { updatedAt: 9000, voile: 'Ma voile' })];
            expect(LogbookService.undoImport('one')).toBe(1);
            expect(LogbookService.getFlights()).toEqual([]);
        });

        it('removes nothing for an unknown import', () => {
            LogbookService.flights = [manual('m'), imported('a', 'one', 1000)];
            expect(LogbookService.undoImport('nope')).toBe(0);
            expect(LogbookService.getFlights()).toHaveLength(2);
        });
    });

    describe('updateFlight on a flight with a date and no time', () => {
        beforeEach(() => {
            LogbookService.flights = [imported('a', 'one', 1000)];
        });

        it('keeps it a date-only flight while its time is not changed', () => {
            LogbookService.updateFlight('a', { datetime: '2026-10-27T00:00', voile: 'Ma voile' });
            expect(LogbookService.getFlightById('a')).toMatchObject({ dateOnly: true, voile: 'Ma voile' });
        });

        it('keeps the import mark through an edit, and marks the flight edited', () => {
            LogbookService.updateFlight('a', { voile: 'Ma voile' });
            const flight = LogbookService.getFlightById('a');
            expect(flight.import).toEqual({ source: 'ffvl-xlsx', batchId: 'one', importedAt: 1000, key: 'key-a' });
            expect(LogbookService.importBatches()[0].editedCount).toBe(1);
        });

        it('is no longer a date-only flight once the pilot gives it a time', () => {
            LogbookService.updateFlight('a', { datetime: '2026-10-27T14:30' });
            expect(LogbookService.getFlightById('a').dateOnly).toBe(false);
        });

        it('does not add the field to a flight that never had it', () => {
            LogbookService.flights = [manual('m')];
            LogbookService.updateFlight('m', { datetime: '2026-09-01T11:00' });
            expect(LogbookService.getFlightById('m')).not.toHaveProperty('dateOnly');
        });
    });
});
