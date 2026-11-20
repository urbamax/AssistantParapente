// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { runCheckFavoriteSitesWeather, DEAD_FCM_ERROR_CODES } from '../../functions/runner.mjs';

function makeFakeDb(users) {
    const updates = [];
    const statesWritten = new Map();

    const makeDocSnap = (data) => ({
        exists: data !== undefined,
        data: () => data,
    });

    const db = {
        collection: (name) => {
            if (name !== 'users') throw new Error(`Unexpected collection ${name}`);
            return {
                where: () => ({
                    get: async () => ({
                        size: users.length,
                        docs: users.map((u) => ({
                            id: u.id,
                            data: () => ({ fcmToken: u.fcmToken }),
                            ref: {
                                update: async (patch) => {
                                    updates.push({ uid: u.id, patch });
                                },
                            },
                        })),
                    }),
                }),
                doc: (uid) => {
                    const u = users.find((x) => x.id === uid);
                    return {
                        collection: (sub) => ({
                            doc: () => ({
                                get: async () => {
                                    if (sub === 'access') return makeDocSnap(u.access);
                                    if (sub === 'preferences') return makeDocSnap(u.prefs);
                                    if (sub === 'pushState') return makeDocSnap(u.pushState);
                                    return makeDocSnap(undefined);
                                },
                                set: async (val) => {
                                    statesWritten.set(uid, val);
                                },
                            }),
                        }),
                    };
                },
            };
        },
    };
    return { db, updates, statesWritten };
}

describe('runCheckFavoriteSitesWeather (Cloud Function orchestration)', () => {
    const sampleSite = {
        id: 'site-1',
        nom: 'Annecy',
        latitude: 45.8,
        longitude: 6.2,
        orientations: ['S'],
    };
    const sitesById = new Map([[sampleSite.id, sampleSite]]);

    const makeShared = ({ flyable = true, shouldNotify = true } = {}) => ({
        hasBetaRole: (access) => Array.isArray(access?.roles) && access.roles.includes('beta'),
        createSiteWeatherCache: (fetcher) => {
            const memo = new Map();
            return {
                requests: 0,
                async get(id, site) {
                    if (!memo.has(id)) {
                        this.requests++;
                        memo.set(id, await fetcher(site));
                    }
                    return memo.get(id);
                },
            };
        },
        forecastUrl: (lat, lon) => `https://api.open-meteo.com/v1/forecast?lat=${lat}&lon=${lon}`,
        buildHourlyForecast: () => ({ timeMs: 1700000000000, speed: 12, gust: 16, dir: 180 }),
        toScoringPrefs: (p) => p,
        evaluateSpotForecast: () => ({ flyable }),
        nextState: (_prev, outcome) => (outcome.flyable ? 'flyable' : 'unflyable'),
        shouldNotify: () => shouldNotify,
        buildNotification: (site) => ({ title: `${site.nom} favorable`, body: 'Test body' }),
    });

    it('skips non-beta users and sends a single deduplicated forecast push to beta users', async () => {
        const { db, statesWritten } = makeFakeDb([
            {
                id: 'u-nonbeta',
                fcmToken: 'tok-1',
                access: { roles: [] },
                prefs: { favoriteSites: ['site-1'] },
            },
            {
                id: 'u-beta-1',
                fcmToken: 'tok-2',
                access: { roles: ['beta'] },
                prefs: { favoriteSites: ['site-1'] },
                pushState: { 'site-1': 'unflyable' },
            },
            {
                id: 'u-beta-2',
                fcmToken: 'tok-3',
                access: { roles: ['beta'] },
                prefs: { favoriteSites: ['site-1'] },
                pushState: { 'site-1': 'unflyable' },
            },
        ]);
        const send = vi.fn().mockResolvedValue('msg-id');
        const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });

        const result = await runCheckFavoriteSitesWeather({
            db,
            messaging: { send },
            fieldValueDelete: () => '__DELETE__',
            sitesById,
            shared: makeShared(),
            fetchImpl,
        });

        // Open-Meteo called only ONCE despite 2 beta users watching the same site
        expect(fetchImpl).toHaveBeenCalledTimes(1);
        expect(result.weatherRequests).toBe(1);
        expect(send).toHaveBeenCalledTimes(2);
        expect(statesWritten.has('u-nonbeta')).toBe(false);
        expect(statesWritten.get('u-beta-1')).toEqual({ 'site-1': 'flyable' });
    });

    it('deletes dead FCM tokens when messaging.send rejects with a dead-token code', async () => {
        const { db, updates } = makeFakeDb([
            {
                id: 'u-dead',
                fcmToken: 'tok-dead',
                access: { roles: ['beta'] },
                prefs: { favoriteSites: ['site-1'] },
                pushState: { 'site-1': 'unflyable' },
            },
        ]);
        const err = Object.assign(new Error('Not registered'), {
            code: [...DEAD_FCM_ERROR_CODES][0],
        });
        const send = vi.fn().mockRejectedValue(err);
        const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });

        await runCheckFavoriteSitesWeather({
            db,
            messaging: { send },
            fieldValueDelete: () => '__DELETE__',
            sitesById,
            shared: makeShared(),
            fetchImpl,
        });

        expect(updates).toEqual([{ uid: 'u-dead', patch: { fcmToken: '__DELETE__' } }]);
    });

    it('preserves previousState when Open-Meteo fails for a site', async () => {
        const { db, statesWritten } = makeFakeDb([
            {
                id: 'u-err',
                fcmToken: 'tok-err',
                access: { roles: ['beta'] },
                prefs: { favoriteSites: ['site-1'] },
                pushState: { 'site-1': 'flyable' },
            },
        ]);
        const send = vi.fn();
        const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 503 });

        await runCheckFavoriteSitesWeather({
            db,
            messaging: { send },
            fieldValueDelete: () => '__DELETE__',
            sitesById,
            shared: makeShared(),
            fetchImpl,
        });

        expect(send).not.toHaveBeenCalled();
        expect(statesWritten.get('u-err')).toEqual({ 'site-1': 'flyable' });
    });
});
