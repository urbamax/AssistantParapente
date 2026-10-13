import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import LogbookService from '../../js/services/logbook_service.js';
import StorageService from '../../js/services/storage.js';
import IGCParser from '../../js/services/igc_parser.js';
import IDBStorage from '../../js/services/idb_storage.js';

describe('LogbookService - Core Functions', () => {
    beforeEach(() => {
        localStorage.clear();
        LogbookService.flights = [];
        LogbookService.equipment = [];

        // Mock window.FirebaseAuthEngine
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

    it('addFlight adds syncPending flag, saves to storage, and syncs cloud', () => {
        const flight = { datetime: '2026-08-21T10:00:00Z', site: 'Test Site' };

        const added = LogbookService.addFlight(flight);

        expect(added.id).toBeDefined();
        expect(added.updatedAt).toBeDefined();
        expect(added.syncPending).toBe(true);

        const storageFlights = StorageService.get(StorageService.KEYS.LOGBOOK_DATA);
        expect(storageFlights).toHaveLength(1);
        expect(storageFlights[0].site).toBe('Test Site');

        expect(window.FirebaseAuthEngine.syncLogbookData).toHaveBeenCalledWith(LogbookService.flights);
        expect(window.FirebaseAuthEngine.triggerDebouncedSync).toHaveBeenCalled();
    });

    it('deleteFlight removes from flights and adds tombstone', () => {
        vi.useFakeTimers();
        const f1 = LogbookService.addFlight({ datetime: '2026-08-21T10:00:00Z', site: 'F1' });
        vi.advanceTimersByTime(100);
        const f2 = LogbookService.addFlight({ datetime: '2026-08-21T11:00:00Z', site: 'F2' });
        vi.useRealTimers();

        expect(LogbookService.flights).toHaveLength(2);

        LogbookService.deleteFlight(f1.id);

        expect(LogbookService.flights).toHaveLength(1);
        expect(LogbookService.flights[0].id).toBe(f2.id);

        const tombstones = JSON.parse(localStorage.getItem('deleted_flights') || '[]');
        expect(tombstones).toContain(f1.id);
        expect(tombstones).not.toContain(f2.id);

        expect(window.FirebaseAuthEngine.deleteLogbookEntry).toHaveBeenCalledWith(f1.id);
    });

    it('parseIGC correctly delegates to IGCParser', () => {
        const parse = vi.spyOn(IGCParser, 'parse').mockReturnValue({
            points: [{ lat: 45, lon: 6 }],
            duration: 60,
            dateStr: '2026-08-21',
            maxAltitude: 1000,
            gain: 500,
        });

        const res = LogbookService.parseIGC('fake-raw-text');
        expect(res.success).toBe(true);
        expect(res.data.duration).toBe(60);
        expect(res.data.gain).toBe(500);
        expect(parse).toHaveBeenCalledWith('fake-raw-text');

        parse.mockRestore();
    });

    it('parseIGC applies altOffset to copies of the points and leaves the parsed data untouched', () => {
        const parsedPoints = [
            { lat: 45, lon: 6, alt: 1000 },
            { lat: 45, lon: 6, alt: 1500 },
            { lat: 45, lon: 6, alt: -7 },
        ];
        const parse = vi
            .spyOn(IGCParser, 'parse')
            .mockReturnValue({ points: parsedPoints, duration: 60, maxAltitude: 1500, gain: 500 });

        const res = LogbookService.parseIGC('fake-raw-text', 9);
        expect(res.data.points.map((p) => p.alt)).toEqual([1009, 1509, 2]);
        expect(res.data.maxAltitude).toBe(1509);
        expect(res.data.takeoffAlt).toBe(1009);
        expect(res.data.landingAlt).toBe(2);
        expect(res.data.gain).toBe(500);
        // Les points d'origine ne sont pas mutés : la donnée brute reste brute
        expect(parsedPoints.map((p) => p.alt)).toEqual([1000, 1500, -7]);

        const raw = LogbookService.parseIGC('fake-raw-text');
        expect(raw.data.points.map((p) => p.alt)).toEqual([1000, 1500, -7]);
        expect(raw.data.landingAlt).toBe(-7);

        parse.mockRestore();
    });

    it('parseIGC reports failure when the file has no GPS points', () => {
        const res = LogbookService.parseIGC('fake-raw-text');
        expect(res.success).toBe(false);
        expect(res.error).toBe('Aucun point GPS valide dans le fichier.');
    });

    it('loadData() normalizes flights/equipment missing typeVol/typeExercice/nom/type, so a legacy or corrupted record can no longer crash a render (regression test for the .toLowerCase()/.toUpperCase() crashes on undefined)', () => {
        StorageService.set(StorageService.KEYS.LOGBOOK_DATA, [
            { id: 'corrupt-1', type: 'vol', site: 'Site Test', datetime: '2026-01-01T10:00' },
        ]);
        StorageService.set(StorageService.KEYS.EQUIPMENT_DATA, [{ id: 'eq-1' }]);

        LogbookService.loadData();

        expect(LogbookService.flights[0].typeVol).toBe('');
        expect(LogbookService.flights[0].typeExercice).toBe('');
        expect(LogbookService.equipment[0].nom).toBe('');
        expect(LogbookService.equipment[0].type).toBe('');
    });

    it('addFlight() and addEquipment() normalize missing fields too, not only loadData()', () => {
        const flight = LogbookService.addFlight({ datetime: '2026-08-21T10:00:00Z', site: 'Test Site' });
        expect(flight.typeVol).toBe('');
        expect(flight.typeExercice).toBe('');

        const equip = LogbookService.addEquipment({});
        expect(equip.nom).toBe('');
        expect(equip.type).toBe('');
    });
});

describe('LogbookService - IndexedDB hydration (initIndexedDB / whenReady)', () => {
    let fakeDB;
    let mockIndexedDB;

    beforeEach(() => {
        localStorage.clear();
        LogbookService.flights = [];
        LogbookService.equipment = [];

        const flightsStore = new Map();
        // traces/keyval aren't used by these tests, but objectStoreNames.contains() must report
        // them as present too, otherwise onupgradeneeded tries to createObjectStore() on this
        // fake db (which doesn't implement it) for each one it thinks is missing.
        const stores = { flights: flightsStore, traces: new Map(), keyval: new Map() };

        fakeDB = {
            objectStoreNames: { contains: (name) => name in stores },
            transaction: vi.fn((_storeNames, _mode) => {
                const tx = {
                    objectStore: (name) => {
                        const storeMap = stores[name];
                        return {
                            getAll: () => {
                                const req = { result: Array.from(storeMap.values()) };
                                setTimeout(() => req.onsuccess && req.onsuccess({ target: req }), 0);
                                return req;
                            },
                            put: (item) => {
                                storeMap.set(item.id, item);
                                const req = { result: item.id };
                                setTimeout(() => req.onsuccess && req.onsuccess({ target: req }), 0);
                                return req;
                            },
                        };
                    },
                    oncomplete: null,
                    onerror: null,
                };
                setTimeout(() => tx.oncomplete && tx.oncomplete(), 0);
                return tx;
            }),
        };

        mockIndexedDB = {
            open: vi.fn(() => {
                const req = { result: fakeDB, onsuccess: null, onerror: null, onupgradeneeded: null };
                setTimeout(() => {
                    if (req.onupgradeneeded) req.onupgradeneeded({ target: { result: fakeDB } });
                    if (req.onsuccess) req.onsuccess({ target: { result: fakeDB } });
                }, 0);
                return req;
            }),
        };

        vi.stubGlobal('indexedDB', mockIndexedDB);
        // Force IDBStorage (a shared singleton) to reopen against this test's fresh mock DB,
        // instead of reusing a cached connection left over from a previous test.
        IDBStorage._db = null;
        IDBStorage._openPromise = null;
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('preserves a flight written by a cloud merge instead of overwriting it with a stale IndexedDB snapshot (regression test for the data-loss bug)', async () => {
        // Seed IndexedDB with an "old" flight carrying a rawIgc trace.
        await IDBStorage.saveFlights([
            { id: 'old-flight', site: 'Ancien Site', datetime: '2020-01-01T10:00', rawIgc: 'RAW_IGC_OLD' },
        ]);

        // Simulate firebase_service.js's syncDataWithCloud(): it writes the merged logbook
        // straight to LocalStorage (never to IndexedDB), then calls loadData() to refresh the UI.
        StorageService.set(StorageService.KEYS.LOGBOOK_DATA, [
            { id: 'old-flight', site: 'Ancien Site', datetime: '2020-01-01T10:00' },
            { id: 'new-flight-from-other-device', site: 'Site Distant', datetime: '2026-09-27T10:00' },
        ]);

        LogbookService.loadData();
        await LogbookService.whenReady();

        expect(LogbookService.flights.map((f) => f.id).sort()).toEqual(
            ['new-flight-from-other-device', 'old-flight'].sort(),
        );
        // rawIgc only ever lives in IndexedDB (see saveFlights()) : it must be hydrated back
        // onto the matching flight rather than lost along with the rest of the stale snapshot.
        expect(LogbookService.getFlightById('old-flight').rawIgc).toBe('RAW_IGC_OLD');
    });

    it('seeds IndexedDB from LocalStorage the first time it is used on a device', async () => {
        StorageService.set(StorageService.KEYS.LOGBOOK_DATA, [{ id: 'f1', site: 'A', datetime: '2026-01-01T10:00' }]);

        LogbookService.loadData();
        await LogbookService.whenReady();

        const idbFlights = await IDBStorage.getAllFlights();
        expect(idbFlights.map((f) => f.id)).toEqual(['f1']);
    });
});

describe('LogbookService - fetchSessionWeather rate limiting', () => {
    const hourly = {
        temperature_2m: Array(24).fill(15),
        wind_speed_10m: Array(24).fill(10),
        wind_gusts_10m: Array(24).fill(15),
        wind_direction_10m: Array(24).fill(180),
        weather_code: Array(24).fill(1),
    };

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('retries once after a 429 and returns the data when the retry succeeds', async () => {
        vi.useFakeTimers();
        global.fetch = vi
            .fn()
            .mockResolvedValueOnce({ ok: false, status: 429 })
            .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ hourly }) });

        const pending = LogbookService.fetchSessionWeather(45.9, 6.1, '2026-09-20T15:38');
        await vi.advanceTimersByTimeAsync(2000);
        const res = await pending;

        expect(global.fetch).toHaveBeenCalledTimes(2);
        expect(res.success).toBe(true);
        expect(res.data.ventVitesse).toBe(10);
    });

    it('gives a readable message when the limit persists after the retry', async () => {
        vi.useFakeTimers();
        global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 429 });

        const pending = LogbookService.fetchSessionWeather(45.9, 6.1, '2026-09-20T15:38');
        await vi.advanceTimersByTimeAsync(2000);
        const res = await pending;

        expect(global.fetch).toHaveBeenCalledTimes(2);
        expect(res.success).toBe(false);
        expect(res.error).toContain('saturé');
        expect(res.error).not.toContain('429');
    });
});

describe('LogbookService.findLastCoordsForPlace', () => {
    beforeEach(() => {
        LogbookService.flights = [
            { id: 'a', type: 'gonflage', lieu: 'Equihen', datetime: '2026-09-29T15:00', lat: 50.68, lon: 1.59 },
            { id: 'b', type: 'vol', site: 'EQUIHEN ', datetime: '2026-09-01T15:00', lat: 50.1, lon: 1.1 },
            { id: 'c', type: 'vol', site: 'Escalles', datetime: '2026-09-20T15:00' },
        ];
    });

    it('returns the coordinates of the latest session with the same name, ignoring case and spaces', () => {
        expect(LogbookService.findLastCoordsForPlace(' equihen')).toEqual({ lat: 50.68, lon: 1.59 });
    });

    it('returns null when no session of that place has coordinates', () => {
        expect(LogbookService.findLastCoordsForPlace('Escalles')).toBeNull();
        expect(LogbookService.findLastCoordsForPlace('Inconnu')).toBeNull();
        expect(LogbookService.findLastCoordsForPlace('')).toBeNull();
    });

    describe('computeEquipmentWear: rescue openings', () => {
        const rescue = (extra = {}) => ({ id: 's1', nom: 'Secours', type: 'secours', ...extra });
        const flight = (id, datetime, extra = {}) => ({
            id,
            datetime,
            sellette: 'Sellette',
            duree: 30,
            ...extra,
        });
        const opened = (id, datetime) => flight(id, datetime, { rescueDeployed: true, rescueId: 'Secours' });
        const wear = () => LogbookService.computeEquipmentWear().secours;

        it('does not count flight time for a rescue, only openings', () => {
            LogbookService.equipment = [rescue()];
            LogbookService.flights = [flight('f1', '2026-09-01T10:00'), opened('f2', '2026-09-02T10:00')];
            expect(wear()).toMatchObject({ openings: 1, totalSessions: 0, totalTime: 0 });
        });

        it('is in default after an opening until it is repacked', () => {
            LogbookService.equipment = [rescue({ derniereRevision: '2026-08-01' })];
            LogbookService.flights = [opened('f1', '2026-09-02T10:00')];
            expect(wear().alerts.openedAlert).toBe('red');
        });

        it('is back to normal once repacked on or after the opening day', () => {
            LogbookService.equipment = [rescue({ derniereRevision: '2026-09-02' })];
            LogbookService.flights = [opened('f1', '2026-09-02T10:00')];
            expect(wear()).toMatchObject({ openings: 1 });
            expect(wear().alerts.openedAlert).toBe(false);
        });

        it('is in default again at a new opening after a repacking', () => {
            LogbookService.equipment = [rescue({ derniereRevision: '2026-09-02' })];
            LogbookService.flights = [opened('f1', '2026-09-02T10:00'), opened('f2', '2026-10-01T10:00')];
            expect(wear()).toMatchObject({ openings: 2 });
            expect(wear().alerts.openedAlert).toBe('red');
        });

        it('never opened means no default', () => {
            LogbookService.equipment = [rescue()];
            LogbookService.flights = [flight('f1', '2026-09-01T10:00')];
            expect(wear()).toMatchObject({ openings: 0 });
            expect(wear().alerts.openedAlert).toBe(false);
        });
    });
});

// Équipement à surveiller : date, heures de vol, ou secours ouvert et pas encore replié.
describe('LogbookService.countEquipmentAlerts', () => {
    const wear = (...alerts) => Object.fromEntries(alerts.map((a, i) => [`e${i}`, { alerts: a }]));

    it('counts the equipment with a date, hours or opened-rescue alert', () => {
        expect(LogbookService.countEquipmentAlerts(wear({ dateAlert: 'orange' }))).toBe(1);
        expect(LogbookService.countEquipmentAlerts(wear({ hoursAlert: 'red' }))).toBe(1);
        expect(LogbookService.countEquipmentAlerts(wear({ openedAlert: 'red' }))).toBe(1);
    });

    it('counts each piece of equipment once, whatever the number of alerts', () => {
        const both = { dateAlert: 'red', hoursAlert: 'orange', openedAlert: 'red' };
        expect(LogbookService.countEquipmentAlerts(wear(both, {}, { dateAlert: 'orange' }))).toBe(2);
    });

    it('is zero when nothing needs attention', () => {
        expect(LogbookService.countEquipmentAlerts({})).toBe(0);
        expect(LogbookService.countEquipmentAlerts(wear({}, { dateAlert: false, hoursAlert: false }))).toBe(0);
    });

    it('computes the wear itself by default: a rescue opened and not repacked counts', () => {
        LogbookService.equipment = [{ id: 's1', nom: 'Secours', type: 'secours' }];
        LogbookService.flights = [
            { id: 'f1', type: 'vol', datetime: '2026-09-01T10:00', rescueDeployed: true, rescueId: 'Secours' },
        ];
        expect(LogbookService.countEquipmentAlerts()).toBe(1);
    });
});
