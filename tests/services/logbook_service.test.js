import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import LogbookService from '../../js/services/logbook_service.js';
import StorageService from '../../js/services/storage.js';
import IGCParser from '../../js/services/igc_parser.js';

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
        expect(res.error).toBe('No valid GPS data found in file.');
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
