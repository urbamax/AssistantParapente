import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { FirebaseAuthEngine } from '../../js/services/firebase_service.js';
import LogbookService from '../../js/services/logbook_service.js';
import IDBStorage from '../../js/services/idb_storage.js';
import SitesService from '../../js/services/sites_service.js';
import StorageService from '../../js/services/storage.js';
import { TRACE_UPLOADS_PER_SYNC } from '../../js/services/flight_trace_sync.js';
import { createFakeFirestore } from '../fixtures/fake_firestore.js';

// Spec 037 : les traces de vol suivent le pilote d'un appareil à l'autre. Deux « appareils » partagent le
// même faux Firestore ; chacun a sa propre mémoire de traces (IndexedDB simulé) et son stockage local.

const IGC = readFileSync('tests/fixtures/syride-winch-flight.igc', 'utf8');
const flight = (id, extra = {}) => ({
    id,
    type: 'vol',
    datetime: '2026-08-01T10:00:00Z',
    site: 'Annecy',
    updatedAt: 1000,
    ...extra,
});
const cloudFlight = (firestore, id) => firestore.docs.get(`users/u1/logbook/${id}`);
const partPaths = (firestore, id) =>
    [...firestore.docs.keys()].filter((p) => p.startsWith(`users/u1/igcTraces/${id}_`)).sort();
const localFlights = () => StorageService.get(StorageService.KEYS.LOGBOOK_DATA) || [];
const localFlight = (id) => localFlights().find((f) => f.id === id);

/** Un appareil : sa base locale de traces et ses vols. `traces` = traces déjà présentes sur l'appareil. */
function makeDevice({ flights = [], traces = {} } = {}) {
    const idb = new Map(Object.entries(traces));
    return {
        idb,
        activate() {
            localStorage.clear();
            LogbookService.equipment = [];
            LogbookService.flights = structuredClone(flights);
            // Comme LogbookService.saveFlights : la trace brute reste en mémoire, jamais dans le stockage local.
            StorageService.set(
                StorageService.KEYS.LOGBOOK_DATA,
                LogbookService.flights.map(({ rawIgc: _raw, ...rest }) => rest),
            );
            vi.spyOn(IDBStorage, 'isSupported').mockReturnValue(true);
            vi.spyOn(IDBStorage, 'getTrace').mockImplementation(async (id) => idb.get(id) ?? null);
            vi.spyOn(IDBStorage, 'saveTrace').mockImplementation(async (id, raw) => {
                idb.set(id, raw);
                return true;
            });
            vi.spyOn(IDBStorage, 'getAllFlights').mockResolvedValue([]);
            vi.spyOn(IDBStorage, 'saveFlights').mockResolvedValue(true);
            vi.spyOn(IDBStorage, 'deleteFlight').mockResolvedValue(true);
            vi.spyOn(IDBStorage, 'migrateFromLocalStorage').mockResolvedValue(true);
        },
    };
}

describe('Synchro des traces de vol (spec 037)', () => {
    const defaultLoadFirestore = FirebaseAuthEngine._loadFirestore;
    let firestore;

    const connect = () => {
        FirebaseAuthEngine._loadFirestore = async () => firestore.module;
        FirebaseAuthEngine.currentUser = { uid: 'u1' };
        FirebaseAuthEngine.enabled = true;
        FirebaseAuthEngine._noTraceKeys = new Set();
        window.FirebaseAuthEngine = FirebaseAuthEngine;
    };
    const sync = () => FirebaseAuthEngine.syncDataWithCloud(true);

    beforeEach(() => {
        firestore = createFakeFirestore();
        vi.spyOn(FirebaseAuthEngine, 'syncLogbookData').mockResolvedValue({ success: false });
        vi.spyOn(FirebaseAuthEngine, 'syncEquipmentData').mockResolvedValue({ success: false });
        vi.spyOn(FirebaseAuthEngine, 'triggerDebouncedSync').mockImplementation(() => {});
        vi.spyOn(FirebaseAuthEngine, 'updateModalUI').mockImplementation(() => {});
        vi.spyOn(SitesService, 'loadUserPreferences').mockImplementation(() => {});
        vi.spyOn(SitesService, 'renderList').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
        FirebaseAuthEngine._loadFirestore = defaultLoadFirestore;
        FirebaseAuthEngine.currentUser = null;
        FirebaseAuthEngine.enabled = false;
        window.FirebaseAuthEngine = undefined;
    });

    it('FR-1 / FR-3 : le vol importé sur l’appareil A annonce sa trace une fois tous les morceaux écrits', async () => {
        makeDevice({ flights: [flight('vol-1')], traces: { 'vol-1': IGC } }).activate();
        connect();

        const result = await sync();

        expect(result.success).toBe(true);
        expect(partPaths(firestore, 'vol-1')).toEqual(['users/u1/igcTraces/vol-1_0']);
        const { traceCloud } = cloudFlight(firestore, 'vol-1');
        expect(traceCloud).toMatchObject({ parts: 1, bytes: Buffer.byteLength(IGC), encoding: 'gzip-base64' });
        expect(localFlight('vol-1').traceCloud).toEqual(traceCloud);
    });

    it('la trace brute ne voyage jamais dans le document du vol, ni en local sur la copie enregistrée', async () => {
        makeDevice({ flights: [flight('vol-1', { rawIgc: IGC })], traces: { 'vol-1': IGC } }).activate();
        connect();
        await sync();
        expect('rawIgc' in cloudFlight(firestore, 'vol-1')).toBe(false);
        expect('rawIgc' in localFlight('vol-1')).toBe(false);
    });

    it('FR-1 / FR-2 / FR-7 : l’appareil B voit le vol sans rien télécharger, puis relit une trace identique à la demande', async () => {
        makeDevice({ flights: [flight('vol-1')], traces: { 'vol-1': IGC } }).activate();
        connect();
        await sync();

        const deviceB = makeDevice({ flights: [], traces: {} });
        deviceB.activate();
        const getDoc = vi.spyOn(firestore.module, 'getDoc');
        await sync();

        expect(localFlight('vol-1')).toMatchObject({ id: 'vol-1', traceCloud: { parts: 1 } });
        expect(deviceB.idb.has('vol-1')).toBe(false);
        expect(getDoc.mock.calls.some(([ref]) => ref.path.startsWith('users/u1/igcTraces'))).toBe(false);

        LogbookService.loadData();
        expect(await LogbookService.getFlightTrace('vol-1')).toBe(IGC);
        expect(deviceB.idb.get('vol-1')).toBe(IGC); // gardée sur l'appareil

        getDoc.mockClear();
        expect(await LogbookService.getFlightTrace('vol-1')).toBe(IGC);
        expect(getDoc).not.toHaveBeenCalled(); // la deuxième fois, plus aucun accès au cloud
    });

    it('hors ligne, une trace qui n’est que dans le cloud rend null au lieu de planter', async () => {
        makeDevice({ flights: [flight('vol-1')], traces: { 'vol-1': IGC } }).activate();
        connect();
        await sync();
        makeDevice({ flights: [], traces: {} }).activate();
        await sync();
        LogbookService.loadData();

        firestore.module.getDoc = vi.fn(async () => {
            throw new Error('Failed to get document because the client is offline.');
        });
        expect(await LogbookService.getFlightTrace('vol-1')).toBeNull();
    });

    it('FR-4 : un envoi qui échoue ne bloque pas la synchro du vol, et réussit à la synchro suivante', async () => {
        makeDevice({ flights: [flight('vol-1')], traces: { 'vol-1': IGC } }).activate();
        connect();
        const original = firestore.module.setDoc;
        let refuse = true;
        firestore.module.setDoc = vi.fn(async (ref, data) => {
            if (refuse && ref.path.includes('/igcTraces/')) throw new Error('Missing or insufficient permissions');
            return original(ref, data);
        });

        const first = await sync();
        expect(first.success).toBe(true);
        expect(cloudFlight(firestore, 'vol-1')).toMatchObject({ id: 'vol-1', site: 'Annecy' });
        expect('traceCloud' in cloudFlight(firestore, 'vol-1')).toBe(false); // FR-3 : jamais à moitié annoncée
        expect(localFlight('vol-1').traceCloud).toBeUndefined();

        refuse = false;
        await sync();
        expect(cloudFlight(firestore, 'vol-1').traceCloud).toMatchObject({ parts: 1 });
    });

    it('n’envoie que quelques traces par synchro, l’arriéré suit aux synchros suivantes', async () => {
        const ids = ['a', 'b', 'c', 'd', 'e'];
        makeDevice({
            flights: ids.map((id) => flight(id)),
            traces: Object.fromEntries(ids.map((id) => [id, IGC])),
        }).activate();
        connect();

        const uploaded = () => ids.filter((id) => cloudFlight(firestore, id)?.traceCloud).length;
        await sync();
        expect(uploaded()).toBe(TRACE_UPLOADS_PER_SYNC);
        await sync();
        expect(uploaded()).toBe(Math.min(2 * TRACE_UPLOADS_PER_SYNC, ids.length));
        await sync();
        await sync();
        expect(uploaded()).toBe(ids.length);
    });

    it('ne réenvoie pas une trace déjà dans le cloud', async () => {
        makeDevice({ flights: [flight('vol-1')], traces: { 'vol-1': IGC } }).activate();
        connect();
        await sync();
        firestore.module.setDoc.mockClear();
        await sync();
        expect(firestore.module.setDoc.mock.calls.some(([ref]) => ref.path.includes('/igcTraces/'))).toBe(false);
    });

    it('renvoie une trace remplacée (traceUpdatedAt plus récent) avec la nouvelle empreinte', async () => {
        makeDevice({ flights: [flight('vol-1')], traces: { 'vol-1': IGC } }).activate();
        connect();
        await sync();
        const before = cloudFlight(firestore, 'vol-1').traceCloud;

        // Le pilote remplace la trace du vol sur cet appareil : le vol garde son traceCloud et gagne un traceUpdatedAt.
        const newer = IGC.concat('\nLPLT trace remplacée\n');
        const replaced = { ...localFlight('vol-1'), traceUpdatedAt: before.at + 5000 };
        makeDevice({ flights: [replaced], traces: { 'vol-1': newer } }).activate();
        await sync();

        const after = cloudFlight(firestore, 'vol-1').traceCloud;
        expect(after.digest).not.toBe(before.digest);
        expect(after.bytes).toBe(Buffer.byteLength(newer));
    });

    it('un vol sans aucune trace ne coûte aucun envoi et n’est pas revérifié à chaque synchro', async () => {
        makeDevice({ flights: [flight('vol-1')], traces: {} }).activate();
        connect();
        await sync();
        expect(partPaths(firestore, 'vol-1')).toEqual([]);
        expect('traceCloud' in cloudFlight(firestore, 'vol-1')).toBe(false);

        IDBStorage.getTrace.mockClear();
        await sync();
        await sync();
        expect(IDBStorage.getTrace).not.toHaveBeenCalled();
    });

    it('FR-5 : supprimer un vol efface aussi ses morceaux dans le cloud (suppression immédiate)', async () => {
        makeDevice({ flights: [flight('vol-1'), flight('vol-2')], traces: { 'vol-1': IGC, 'vol-2': IGC } }).activate();
        connect();
        await sync();
        await sync();
        expect(partPaths(firestore, 'vol-1')).toHaveLength(1);

        await FirebaseAuthEngine.deleteLogbookEntry('vol-1');

        expect(partPaths(firestore, 'vol-1')).toEqual([]);
        expect(cloudFlight(firestore, 'vol-1').deleted).toBe(true);
        expect(partPaths(firestore, 'vol-2')).toHaveLength(1); // les autres vols ne sont pas touchés
    });

    it('FR-5 : la suppression faite hors ligne est terminée à la synchro suivante, morceaux compris', async () => {
        makeDevice({ flights: [flight('vol-1')], traces: { 'vol-1': IGC } }).activate();
        connect();
        await sync();
        expect(partPaths(firestore, 'vol-1')).toHaveLength(1);

        vi.spyOn(FirebaseAuthEngine, 'deleteLogbookEntry').mockResolvedValue({ success: false });
        LogbookService.deleteFlight('vol-1');
        await sync();

        expect(partPaths(firestore, 'vol-1')).toEqual([]);
        expect(cloudFlight(firestore, 'vol-1').deleted).toBe(true);
    });

    describe('traces déjà stockées dans l’ancien document du vol (avant la spec)', () => {
        const legacy = () => flight('vol-old', { rawIgc: IGC, updatedAt: 3000 });

        it('sont récupérées sur l’appareil, retirées du document, et envoyées comme les autres', async () => {
            firestore = createFakeFirestore({ 'users/u1/logbook/vol-old': legacy() });
            const device = makeDevice({ flights: [], traces: {} });
            device.activate();
            connect();

            await sync();

            expect(device.idb.get('vol-old')).toBe(IGC);
            expect('rawIgc' in cloudFlight(firestore, 'vol-old')).toBe(false);
            expect(cloudFlight(firestore, 'vol-old').traceCloud).toMatchObject({ parts: 1 });
            expect(partPaths(firestore, 'vol-old')).toHaveLength(1);
            expect('rawIgc' in localFlight('vol-old')).toBe(false); // jamais dans le stockage local (5 Mo)
        });

        it('sont envoyées même si l’appareil ne peut pas garder de trace (IndexedDB absent)', async () => {
            firestore = createFakeFirestore({ 'users/u1/logbook/vol-old': legacy() });
            const device = makeDevice({ flights: [], traces: {} });
            device.activate();
            IDBStorage.isSupported.mockReturnValue(false);
            connect();
            await sync();
            expect(cloudFlight(firestore, 'vol-old').traceCloud).toMatchObject({ parts: 1 });
            expect('rawIgc' in cloudFlight(firestore, 'vol-old')).toBe(false);
        });
    });

    describe('aucun autre chemin ne remet la trace dans le document du vol', () => {
        it('syncLogbookData (synchro incrémentale après chaque modification)', async () => {
            makeDevice({ flights: [], traces: {} }).activate();
            connect();
            FirebaseAuthEngine.syncLogbookData.mockRestore();
            await FirebaseAuthEngine.syncLogbookData([flight('vol-1', { rawIgc: IGC })]);
            expect(cloudFlight(firestore, 'vol-1')).toBeDefined();
            expect('rawIgc' in cloudFlight(firestore, 'vol-1')).toBe(false);
        });

        it('syncLogbookEntry (un seul vol)', async () => {
            makeDevice({ flights: [], traces: {} }).activate();
            connect();
            await FirebaseAuthEngine.syncLogbookEntry(flight('vol-1', { rawIgc: IGC }));
            expect(cloudFlight(firestore, 'vol-1')).toBeDefined();
            expect('rawIgc' in cloudFlight(firestore, 'vol-1')).toBe(false);
        });
    });

    it('l’empreinte d’affichage du carnet change quand une trace arrive du cloud (le bouton apparaît)', () => {
        LogbookService.flights = [flight('vol-1')];
        LogbookService.equipment = [];
        const before = LogbookService.dataSignature();
        LogbookService.flights = [flight('vol-1', { traceCloud: { at: 1, parts: 1 } })];
        expect(LogbookService.dataSignature()).not.toBe(before);
        expect(LogbookService.dataSignature()).toContain('"hasTrace":true');
    });
});
