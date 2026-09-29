// @vitest-environment node
// Code serveur (Cloud Function) : environnement Node, pas de DOM simulé.
import { describe, it, expect } from 'vitest';
import {
    buildHourlyForecast,
    buildNotification,
    nextState,
    shouldNotify,
    toScoringPrefs,
} from '../../functions/evaluate.mjs';
import { evaluateSpotForecast as serverEvaluate } from '../../functions/shared/weatherScoring.mjs';
import { evaluateSpotForecast as appEvaluate } from '../../js/weatherScoring.js';
import {
    DEFAULT_PREFS,
    SITE_SOUTH,
    SITE_NO_ORIENTATION,
    COMPLETE_HOUR,
    completeHourWith,
    REFERENCE_CASES,
    REFERENCE_SITES,
} from '../fixtures/forecasts.js';

// Réponse Open-Meteo au format du serveur (timeformat=unixtime, un seul site).
function payload({ now, values = {}, sunrise = now - 6 * 3600, sunset = now + 6 * 3600 }) {
    const time = [now - 3600, now, now + 3600];
    const col = (v) => [v, v, v];
    return {
        hourly: {
            time,
            wind_speed_10m: col('windSpeed' in values ? values.windSpeed : 15),
            wind_gusts_10m: col('windGust' in values ? values.windGust : 20),
            wind_direction_10m: col('windDir' in values ? values.windDir : 180),
            precipitation: col('precipitation' in values ? values.precipitation : 0),
            cape: col('cape' in values ? values.cape : 100),
        },
        daily: { sunrise: [sunrise], sunset: [sunset] },
    };
}
const NOW = 1_790_000_000; // secondes

describe('server: buildHourlyForecast (spec 001, US4)', () => {
    it('picks the hour closest to now and keeps every value', () => {
        const w = buildHourlyForecast(payload({ now: NOW }), NOW * 1000);
        expect(w).toMatchObject({
            windSpeed: 15,
            windGust: 20,
            windDirDeg: 180,
            windCard: 'S',
            precipitation: 0,
            cape: 100,
            isDaytime: true,
        });
    });

    it('keeps missing values as null, never 0', () => {
        const w = buildHourlyForecast(
            payload({
                now: NOW,
                values: { windSpeed: null, windGust: null, windDir: null, precipitation: null, cape: null },
            }),
            NOW * 1000,
        );
        expect(w).toMatchObject({
            windSpeed: null,
            windGust: null,
            windDirDeg: null,
            windCard: null,
            precipitation: null,
            cape: null,
        });
    });

    it('does not assume daylight when sunrise/sunset is missing', () => {
        const p = payload({ now: NOW });
        p.daily = {};
        expect(buildHourlyForecast(p, NOW * 1000).isDaytime).toBeNull();
    });

    it('applies the same 30-min margin as the app (legal flying time)', () => {
        const beforeStart = buildHourlyForecast(payload({ now: NOW, sunrise: NOW + 31 * 60 }), NOW * 1000);
        expect(beforeStart.isDaytime).toBe(false);
        const afterEnd = buildHourlyForecast(payload({ now: NOW, sunset: NOW + 29 * 60 }), NOW * 1000);
        expect(afterEnd.isDaytime).toBe(false);
    });
});

describe('server: notification rules (spec 001, US4, FR-011)', () => {
    const flyable = serverEvaluate(SITE_SOUTH, COMPLETE_HOUR, DEFAULT_PREFS);
    const unflyable = serverEvaluate(SITE_SOUTH, completeHourWith({ precipitation: 2 }), DEFAULT_PREFS);
    const incomplete = serverEvaluate(SITE_SOUTH, completeHourWith({ windGust: null }), DEFAULT_PREFS);
    const unknownOrientation = serverEvaluate(SITE_NO_ORIENTATION, COMPLETE_HOUR, DEFAULT_PREFS);

    it('notifies only on an unflyable → flyable transition with known orientation', () => {
        expect(shouldNotify(false, flyable)).toBe(true);
        expect(shouldNotify(true, flyable)).toBe(false);
        expect(shouldNotify(undefined, flyable)).toBe(false);
        expect(shouldNotify('unknown', flyable)).toBe(false);
    });

    it('never notifies from an incomplete forecast or an unknown orientation', () => {
        expect(shouldNotify(false, incomplete)).toBe(false);
        expect(shouldNotify(false, unknownOrientation)).toBe(false);
    });

    it('stores true / false, and never records an incomplete hour as flyable or unflyable', () => {
        expect(nextState(false, flyable)).toBe(true);
        expect(nextState(true, unflyable)).toBe(false);
        // Heure incomplète : on garde le dernier état connu.
        expect(nextState(false, incomplete)).toBe(false);
        expect(nextState(true, incomplete)).toBe(true);
        expect(nextState(undefined, incomplete)).toBe('unknown');
        expect(nextState(false, unknownOrientation)).toBe('unknown');
    });

    it('after an incomplete hour, notifies only if the last known state was unflyable', () => {
        const afterGap = nextState(false, incomplete);
        expect(shouldNotify(afterGap, flyable)).toBe(true);
        const afterGapFromFlyable = nextState(true, incomplete);
        expect(shouldNotify(afterGapFromFlyable, flyable)).toBe(false);
    });

    it('maps stored user preferences to the scoring preferences', () => {
        expect(toScoringPrefs({ limitWindMin: 3, limitWindMax: 22, limitGustDelta: 12 })).toEqual({
            vMin: 3,
            vMax: 22,
            deltaRafaleMax: 12,
            filterMode: 'manual',
        });
    });
});

describe('server and app reach the same outcome (spec 001, FR-012, SC-006)', () => {
    it.each(REFERENCE_CASES.map((c, i) => [i, c]))('reference case #%i', (_i, c) => {
        const weather = { ...c.weather, cape: 100 };
        const site = REFERENCE_SITES[c.siteName];
        expect(serverEvaluate(site, weather, c.prefs)).toEqual(appEvaluate(site, weather, c.prefs));
    });

    it('same outcome on incomplete and unknown-orientation inputs', () => {
        for (const [site, weather] of [
            [SITE_SOUTH, completeHourWith({ windSpeed: null, cape: null })],
            [SITE_NO_ORIENTATION, COMPLETE_HOUR],
            [SITE_SOUTH, completeHourWith({ cape: 3000 })],
        ]) {
            expect(serverEvaluate(site, weather, DEFAULT_PREFS)).toEqual(appEvaluate(site, weather, DEFAULT_PREFS));
        }
    });
});

describe('server: notification wording (spec 005, audit A3)', () => {
    const weather = { windSpeed: 15, windGust: 20, windCard: 'S' };
    const NOON_UTC_SUMMER = Date.UTC(2026, 6, 15, 12, 0); // 14 h à Paris (heure d'été)
    const REMINDER = 'Avis basé sur des prévisions : la décision vous appartient, vérifiez sur place.';

    it('announces favourable conditions without saying the site is flyable', () => {
        const n = buildNotification({ nom: 'Mont Test' }, weather, NOON_UTC_SUMMER);
        expect(n.title).toBe('Mont Test : conditions favorables annoncées');
        expect(`${n.title} ${n.body}`).not.toMatch(/volable/i);
    });

    it('gives the hour in Paris time, the wind, the source, and ends with the reminder', () => {
        const { body } = buildNotification({ nom: 'Mont Test' }, weather, NOON_UTC_SUMMER);
        expect(body.startsWith('Prévision à 14 h : vent S 15 km/h')).toBe(true);
        expect(body).not.toMatch(/h h|pour à/);
        expect(body).toContain('S 15 km/h (rafales 20)');
        expect(body).toContain('Sélection automatique (Open-Meteo, multi-modèles)');
        expect(body.endsWith(REMINDER)).toBe(true);
        expect(body.length).toBeLessThanOrEqual(240);
    });

    it('falls back to « Site favori » and « — » for missing values', () => {
        const n = buildNotification({}, { windSpeed: null, windGust: null, windCard: null }, NOON_UTC_SUMMER);
        expect(n.title).toBe('Site favori : conditions favorables annoncées');
        expect(n.body).toContain('— — km/h (rafales —)');
        expect(n.body).not.toContain('null');
    });

    it('buildHourlyForecast returns the time of the selected hour', () => {
        const w = buildHourlyForecast(payload({ now: NOW }), NOW * 1000);
        expect(w.timeMs).toBe(NOW * 1000);
    });
});
