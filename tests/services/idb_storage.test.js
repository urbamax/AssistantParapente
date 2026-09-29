import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { IDBStorageService } from '../../js/services/idb_storage.js';

describe('IDBStorageService', () => {
    describe('Fallback when IndexedDB is not supported', () => {
        beforeEach(() => {
            // Dans happy-dom, window.indexedDB est undefined
            vi.stubGlobal('indexedDB', undefined);
        });

        afterEach(() => {
            vi.unstubAllGlobals();
        });

        it('reports isSupported as false when window.indexedDB is undefined', () => {
            const service = new IDBStorageService();
            expect(service.isSupported()).toBe(false);
        });

        it('gracefully returns null/empty arrays without throwing', async () => {
            const service = new IDBStorageService();
            expect(await service.open()).toBeNull();
            expect(await service.getAllFlights()).toEqual([]);
            expect(await service.getFlight('vol-1')).toBeNull();
            expect(await service.saveFlight({ id: 'vol-1' })).toBe(false);
            expect(await service.saveFlights([{ id: 'vol-1' }])).toBe(false);
            expect(await service.deleteFlight('vol-1')).toBe(false);
            expect(await service.getTrace('vol-1')).toBeNull();
            expect(await service.saveTrace('vol-1', 'raw-igc-data')).toBe(false);
            expect(await service.deleteTrace('vol-1')).toBe(false);
            const migration = await service.migrateFromLocalStorage([{ id: 'vol-1' }]);
            expect(migration).toEqual({ migrated: 0, tracesMigrated: 0 });
            // Spec 007 : paires clé-valeur (prévisions enregistrées pour le hors-ligne).
            expect(await service.setValues([{ key: 'forecast:1', value: { a: 1 } }])).toBe(false);
            expect(await service.getValuesByPrefix('forecast:')).toEqual([]);
            expect(await service.deleteValues(['forecast:1'])).toBe(false);
        });
    });

    describe('Operations with Mocked IndexedDB', () => {
        let fakeDB;
        let mockIndexedDB;
        let service;

        beforeEach(() => {
            const flightsStore = new Map();
            const tracesStore = new Map();
            const keyvalStore = new Map();

            const stores = {
                flights: flightsStore,
                traces: tracesStore,
                keyval: keyvalStore,
            };

            fakeDB = {
                objectStoreNames: {
                    contains: (name) => name in stores,
                },
                transaction: vi.fn((_storeNames, _mode) => {
                    const tx = {
                        objectStore: (name) => {
                            const storeMap = stores[name];
                            return {
                                get: (id) => {
                                    const req = { result: storeMap.get(id) || null };
                                    setTimeout(() => req.onsuccess && req.onsuccess({ target: req }), 0);
                                    return req;
                                },
                                getAll: () => {
                                    const req = { result: Array.from(storeMap.values()) };
                                    setTimeout(() => req.onsuccess && req.onsuccess({ target: req }), 0);
                                    return req;
                                },
                                put: (item) => {
                                    const key = item.id || item.key;
                                    storeMap.set(key, item);
                                    const req = { result: key };
                                    setTimeout(() => req.onsuccess && req.onsuccess({ target: req }), 0);
                                    return req;
                                },
                                delete: (id) => {
                                    storeMap.delete(id);
                                    const req = { result: undefined };
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
                    const req = {
                        result: fakeDB,
                        onsuccess: null,
                        onerror: null,
                        onupgradeneeded: null,
                    };
                    setTimeout(() => {
                        if (req.onupgradeneeded) {
                            req.onupgradeneeded({ target: { result: fakeDB } });
                        }
                        if (req.onsuccess) {
                            req.onsuccess({ target: { result: fakeDB } });
                        }
                    }, 0);
                    return req;
                }),
            };

            vi.stubGlobal('indexedDB', mockIndexedDB);
            service = new IDBStorageService();
        });

        afterEach(() => {
            vi.unstubAllGlobals();
        });

        it('isSupported returns true when window.indexedDB is present', () => {
            expect(service.isSupported()).toBe(true);
        });

        it('saves and retrieves flights correctly', async () => {
            const flight = { id: 'flight-101', site: 'Planfait', datetime: '2026-09-25T14:00' };
            const saved = await service.saveFlight(flight);
            expect(saved).toBe(true);

            const retrieved = await service.getFlight('flight-101');
            expect(retrieved).toEqual(flight);

            const all = await service.getAllFlights();
            expect(all).toHaveLength(1);
            expect(all[0].id).toBe('flight-101');
        });

        it('saves and retrieves traces correctly', async () => {
            const rawTrace = 'B1200004500000N00600000EA0100001000';
            const saved = await service.saveTrace('flight-101', rawTrace);
            expect(saved).toBe(true);

            const retrieved = await service.getTrace('flight-101');
            expect(retrieved).toBe(rawTrace);

            await service.deleteTrace('flight-101');
            const afterDelete = await service.getTrace('flight-101');
            expect(afterDelete).toBeNull();
        });

        it('deletes flight and its trace simultaneously', async () => {
            await service.saveFlight({ id: 'flight-to-del', site: 'Doussard' });
            await service.saveTrace('flight-to-del', 'fake-igc');

            await service.deleteFlight('flight-to-del');

            expect(await service.getFlight('flight-to-del')).toBeNull();
            expect(await service.getTrace('flight-to-del')).toBeNull();
        });

        it('migrates flights and extracts rawIgc to traces store', async () => {
            const localStorageFlights = [
                { id: 'f-1', site: 'Site 1', rawIgc: 'IGC_DATA_1' },
                { id: 'f-2', site: 'Site 2' }, // sans trace
            ];

            const result = await service.migrateFromLocalStorage(localStorageFlights);
            expect(result.migrated).toBe(2);
            expect(result.tracesMigrated).toBe(1);

            const trace = await service.getTrace('f-1');
            expect(trace).toBe('IGC_DATA_1');

            const trace2 = await service.getTrace('f-2');
            expect(trace2).toBeNull();

            const all = await service.getAllFlights();
            expect(all).toHaveLength(2);
        });
    });
});
