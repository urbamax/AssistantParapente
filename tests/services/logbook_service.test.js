import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import LogbookService from '../../js/services/logbook_service.js';
import StorageService from '../../js/services/storage.js';

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

    it('parseIGC correctly delegates to window.IGCParser', () => {
        window.IGCParser = {
            parse: vi.fn().mockReturnValue({
                points: [{ lat: 45, lon: 6 }],
                duration: 60,
                dateStr: '2026-08-21',
                maxAltitude: 1000,
                gain: 500,
            }),
        };

        const res = LogbookService.parseIGC('fake-raw-text');
        expect(res.success).toBe(true);
        expect(res.data.duration).toBe(60);
        expect(res.data.gain).toBe(500);
        expect(window.IGCParser.parse).toHaveBeenCalledWith('fake-raw-text');

        window.IGCParser = undefined;
    });

    it('parseIGC handles missing parser gracefully', () => {
        const res = LogbookService.parseIGC('fake-raw-text');
        expect(res.success).toBe(false);
        expect(res.error).toBe('IGCParser library is not loaded.');
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
