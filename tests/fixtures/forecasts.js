/**
 * Jeux de données partagés pour les tests du calcul météo (spec 001, tâche T004).
 *
 * REFERENCE_CASES : sorties de evaluateSpotForecast AVANT la spec 001, enregistrées telles
 * quelles (générées une fois avec la fonction d'origine). Elles garantissent que, quand
 * toutes les données sont présentes et l'orientation connue, les verdicts ne changent pas
 * (FR-013, SC-004). Ne jamais les « mettre à jour » pour faire passer un test.
 */

export const DEFAULT_PREFS = Object.freeze({ vMin: 5, vMax: 25, deltaRafaleMax: 15 });

export const SITE_SOUTH = Object.freeze({ orientations_vent: ['S'] });
export const SITE_NO_ORIENTATION = Object.freeze({ nom: 'Site sans orientation' });
export const SITE_UNRECOGNISED_ORIENTATION = Object.freeze({ orientations_vent: ['Sud-Ouest'] });

export const REFERENCE_SITES = Object.freeze({
    SITE_SOUTH: { orientations_vent: ['S'] },
    SITE_EAST_SE_IDEAL90: { orientations_vent: ['E', 'SE'], orientation_ideale_deg: 90 },
    SITE_STRING_SW: { orientations_vent: 'S, SO', orientation_ideale_deg: 202 },
    SITE_LEGACY_ORIENTATION: { orientation: 'NO,N' },
});

// Heure complète, de jour, dans les limites par défaut, vent de sud.
export const COMPLETE_HOUR = Object.freeze({
    time: '2026-09-29T14:00',
    isDaytime: true,
    precipitation: 0,
    windSpeed: 15,
    windGust: 20,
    windDirDeg: 180,
    windCard: 'S',
    cape: 100,
});

export function completeHourWith(overrides = {}) {
    return { ...COMPLETE_HOUR, ...overrides };
}

/**
 * Réponse Open-Meteo (format d'un site) dont les dernières heures sont vides, comme la fin de
 * l'horizon AROME observée le 2026-09-29 (research R1) : vent, rafales, direction, pluie et
 * CAPE à null. Les heures sont relatives à `startIso` pour rester « futures » dans les tests.
 */
export function aromeTailResponse(startIso, { complete = 3, empty = 3 } = {}) {
    const start = new Date(startIso);
    const pad = (n) => String(n).padStart(2, '0');
    const time = [];
    for (let i = 0; i < complete + empty; i++) {
        const d = new Date(start.getTime() + i * 3600 * 1000);
        time.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`);
    }
    const values = (v) => [...Array(complete).fill(v), ...Array(empty).fill(null)];
    const day = time[0].substring(0, 10);
    return {
        hourly: {
            time,
            wind_speed_10m: values(15),
            wind_direction_10m: values(180),
            wind_gusts_10m: values(20),
            precipitation: values(0),
            cape: values(100),
        },
        daily: { time: [day], sunrise: [`${day}T00:00`], sunset: [`${day}T23:59`] },
    };
}

export const REFERENCE_CASES = Object.freeze([
    {
        siteName: 'SITE_SOUTH',
        prefs: {
            vMin: 5,
            vMax: 25,
            deltaRafaleMax: 15,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 15,
            windGust: 20,
            windDirDeg: 180,
            windCard: 'S',
        },
        expected: {
            flyable: true,
            score: 100,
            reason: 'Excellent (100/100)',
        },
    },
    {
        siteName: 'SITE_SOUTH',
        prefs: {
            vMin: 5,
            vMax: 25,
            deltaRafaleMax: 15,
        },
        weather: {
            isDaytime: false,
            precipitation: 0,
            windSpeed: 15,
            windGust: 20,
            windDirDeg: 180,
            windCard: 'S',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Nuit',
        },
    },
    {
        siteName: 'SITE_SOUTH',
        prefs: {
            vMin: 5,
            vMax: 25,
            deltaRafaleMax: 15,
        },
        weather: {
            isDaytime: true,
            precipitation: 0.4,
            windSpeed: 15,
            windGust: 20,
            windDirDeg: 180,
            windCard: 'S',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Pluie (0.4 mm)',
        },
    },
    {
        siteName: 'SITE_SOUTH',
        prefs: {
            vMin: 5,
            vMax: 25,
            deltaRafaleMax: 15,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 30,
            windGust: 35,
            windDirDeg: 180,
            windCard: 'S',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Vent hors limites',
        },
    },
    {
        siteName: 'SITE_SOUTH',
        prefs: {
            vMin: 5,
            vMax: 25,
            deltaRafaleMax: 15,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 3,
            windGust: 5,
            windDirDeg: 180,
            windCard: 'S',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Vent hors limites',
        },
    },
    {
        siteName: 'SITE_SOUTH',
        prefs: {
            vMin: 5,
            vMax: 25,
            deltaRafaleMax: 15,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 12,
            windGust: 30,
            windDirDeg: 180,
            windCard: 'S',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Rafales hors limites',
        },
    },
    {
        siteName: 'SITE_SOUTH',
        prefs: {
            vMin: 5,
            vMax: 25,
            deltaRafaleMax: 15,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 15,
            windGust: 20,
            windDirDeg: 0,
            windCard: 'N',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Mauvaise orientation',
        },
    },
    {
        siteName: 'SITE_SOUTH',
        prefs: {
            vMin: 5,
            vMax: 25,
            deltaRafaleMax: 15,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 15,
            windGust: 20,
            windDirDeg: 90,
            windCard: 'E',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Mauvaise orientation',
        },
    },
    {
        siteName: 'SITE_SOUTH',
        prefs: {
            vMin: 5,
            vMax: 25,
            deltaRafaleMax: 15,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 15,
            windGust: 20,
            windDirDeg: 135,
            windCard: 'SE',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Mauvaise orientation',
        },
    },
    {
        siteName: 'SITE_SOUTH',
        prefs: {
            vMin: 5,
            vMax: 25,
            deltaRafaleMax: 15,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 11,
            windGust: 14,
            windDirDeg: 210,
            windCard: 'SO',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Mauvaise orientation',
        },
    },
    {
        siteName: 'SITE_SOUTH',
        prefs: {
            vMin: 5,
            vMax: 25,
            deltaRafaleMax: 15,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 20,
            windGust: 22,
            windDirDeg: 315,
            windCard: 'NO',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Mauvaise orientation',
        },
    },
    {
        siteName: 'SITE_SOUTH',
        prefs: {
            vMin: 5,
            vMax: 25,
            deltaRafaleMax: 15,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 12.5,
            windGust: 12.5,
            windDirDeg: 90,
            windCard: 'E',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Mauvaise orientation',
        },
    },
    {
        siteName: 'SITE_SOUTH',
        prefs: {
            vMin: 0,
            vMax: 25,
            deltaRafaleMax: 10,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 15,
            windGust: 20,
            windDirDeg: 180,
            windCard: 'S',
        },
        expected: {
            flyable: true,
            score: 90,
            reason: 'Excellent (90/100)',
        },
    },
    {
        siteName: 'SITE_SOUTH',
        prefs: {
            vMin: 0,
            vMax: 25,
            deltaRafaleMax: 10,
        },
        weather: {
            isDaytime: false,
            precipitation: 0,
            windSpeed: 15,
            windGust: 20,
            windDirDeg: 180,
            windCard: 'S',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Nuit',
        },
    },
    {
        siteName: 'SITE_SOUTH',
        prefs: {
            vMin: 0,
            vMax: 25,
            deltaRafaleMax: 10,
        },
        weather: {
            isDaytime: true,
            precipitation: 0.4,
            windSpeed: 15,
            windGust: 20,
            windDirDeg: 180,
            windCard: 'S',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Pluie (0.4 mm)',
        },
    },
    {
        siteName: 'SITE_SOUTH',
        prefs: {
            vMin: 0,
            vMax: 25,
            deltaRafaleMax: 10,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 30,
            windGust: 35,
            windDirDeg: 180,
            windCard: 'S',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Vent hors limites',
        },
    },
    {
        siteName: 'SITE_SOUTH',
        prefs: {
            vMin: 0,
            vMax: 25,
            deltaRafaleMax: 10,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 3,
            windGust: 5,
            windDirDeg: 180,
            windCard: 'S',
        },
        expected: {
            flyable: true,
            score: 62,
            reason: 'Bon (62/100)',
        },
    },
    {
        siteName: 'SITE_SOUTH',
        prefs: {
            vMin: 0,
            vMax: 25,
            deltaRafaleMax: 10,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 12,
            windGust: 30,
            windDirDeg: 180,
            windCard: 'S',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Rafales hors limites',
        },
    },
    {
        siteName: 'SITE_SOUTH',
        prefs: {
            vMin: 0,
            vMax: 25,
            deltaRafaleMax: 10,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 15,
            windGust: 20,
            windDirDeg: 0,
            windCard: 'N',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Mauvaise orientation',
        },
    },
    {
        siteName: 'SITE_SOUTH',
        prefs: {
            vMin: 0,
            vMax: 25,
            deltaRafaleMax: 10,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 15,
            windGust: 20,
            windDirDeg: 90,
            windCard: 'E',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Mauvaise orientation',
        },
    },
    {
        siteName: 'SITE_SOUTH',
        prefs: {
            vMin: 0,
            vMax: 25,
            deltaRafaleMax: 10,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 15,
            windGust: 20,
            windDirDeg: 135,
            windCard: 'SE',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Mauvaise orientation',
        },
    },
    {
        siteName: 'SITE_SOUTH',
        prefs: {
            vMin: 0,
            vMax: 25,
            deltaRafaleMax: 10,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 11,
            windGust: 14,
            windDirDeg: 210,
            windCard: 'SO',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Mauvaise orientation',
        },
    },
    {
        siteName: 'SITE_SOUTH',
        prefs: {
            vMin: 0,
            vMax: 25,
            deltaRafaleMax: 10,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 20,
            windGust: 22,
            windDirDeg: 315,
            windCard: 'NO',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Mauvaise orientation',
        },
    },
    {
        siteName: 'SITE_SOUTH',
        prefs: {
            vMin: 0,
            vMax: 25,
            deltaRafaleMax: 10,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 12.5,
            windGust: 12.5,
            windDirDeg: 90,
            windCard: 'E',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Mauvaise orientation',
        },
    },
    {
        siteName: 'SITE_EAST_SE_IDEAL90',
        prefs: {
            vMin: 5,
            vMax: 25,
            deltaRafaleMax: 15,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 15,
            windGust: 20,
            windDirDeg: 180,
            windCard: 'S',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Mauvaise orientation',
        },
    },
    {
        siteName: 'SITE_EAST_SE_IDEAL90',
        prefs: {
            vMin: 5,
            vMax: 25,
            deltaRafaleMax: 15,
        },
        weather: {
            isDaytime: false,
            precipitation: 0,
            windSpeed: 15,
            windGust: 20,
            windDirDeg: 180,
            windCard: 'S',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Nuit',
        },
    },
    {
        siteName: 'SITE_EAST_SE_IDEAL90',
        prefs: {
            vMin: 5,
            vMax: 25,
            deltaRafaleMax: 15,
        },
        weather: {
            isDaytime: true,
            precipitation: 0.4,
            windSpeed: 15,
            windGust: 20,
            windDirDeg: 180,
            windCard: 'S',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Pluie (0.4 mm)',
        },
    },
    {
        siteName: 'SITE_EAST_SE_IDEAL90',
        prefs: {
            vMin: 5,
            vMax: 25,
            deltaRafaleMax: 15,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 30,
            windGust: 35,
            windDirDeg: 180,
            windCard: 'S',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Vent hors limites',
        },
    },
    {
        siteName: 'SITE_EAST_SE_IDEAL90',
        prefs: {
            vMin: 5,
            vMax: 25,
            deltaRafaleMax: 15,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 3,
            windGust: 5,
            windDirDeg: 180,
            windCard: 'S',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Vent hors limites',
        },
    },
    {
        siteName: 'SITE_EAST_SE_IDEAL90',
        prefs: {
            vMin: 5,
            vMax: 25,
            deltaRafaleMax: 15,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 12,
            windGust: 30,
            windDirDeg: 180,
            windCard: 'S',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Rafales hors limites',
        },
    },
    {
        siteName: 'SITE_EAST_SE_IDEAL90',
        prefs: {
            vMin: 5,
            vMax: 25,
            deltaRafaleMax: 15,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 15,
            windGust: 20,
            windDirDeg: 0,
            windCard: 'N',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Mauvaise orientation',
        },
    },
    {
        siteName: 'SITE_EAST_SE_IDEAL90',
        prefs: {
            vMin: 5,
            vMax: 25,
            deltaRafaleMax: 15,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 15,
            windGust: 20,
            windDirDeg: 90,
            windCard: 'E',
        },
        expected: {
            flyable: true,
            score: 100,
            reason: 'Excellent (100/100)',
        },
    },
    {
        siteName: 'SITE_EAST_SE_IDEAL90',
        prefs: {
            vMin: 5,
            vMax: 25,
            deltaRafaleMax: 15,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 15,
            windGust: 20,
            windDirDeg: 135,
            windCard: 'SE',
        },
        expected: {
            flyable: true,
            score: 50,
            reason: 'Bon (50/100)',
        },
    },
    {
        siteName: 'SITE_EAST_SE_IDEAL90',
        prefs: {
            vMin: 5,
            vMax: 25,
            deltaRafaleMax: 15,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 11,
            windGust: 14,
            windDirDeg: 210,
            windCard: 'SO',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Mauvaise orientation',
        },
    },
    {
        siteName: 'SITE_EAST_SE_IDEAL90',
        prefs: {
            vMin: 5,
            vMax: 25,
            deltaRafaleMax: 15,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 20,
            windGust: 22,
            windDirDeg: 315,
            windCard: 'NO',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Mauvaise orientation',
        },
    },
    {
        siteName: 'SITE_EAST_SE_IDEAL90',
        prefs: {
            vMin: 5,
            vMax: 25,
            deltaRafaleMax: 15,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 12.5,
            windGust: 12.5,
            windDirDeg: 90,
            windCard: 'E',
        },
        expected: {
            flyable: true,
            score: 88,
            reason: 'Excellent (88/100)',
        },
    },
    {
        siteName: 'SITE_EAST_SE_IDEAL90',
        prefs: {
            vMin: 0,
            vMax: 25,
            deltaRafaleMax: 10,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 15,
            windGust: 20,
            windDirDeg: 180,
            windCard: 'S',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Mauvaise orientation',
        },
    },
    {
        siteName: 'SITE_EAST_SE_IDEAL90',
        prefs: {
            vMin: 0,
            vMax: 25,
            deltaRafaleMax: 10,
        },
        weather: {
            isDaytime: false,
            precipitation: 0,
            windSpeed: 15,
            windGust: 20,
            windDirDeg: 180,
            windCard: 'S',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Nuit',
        },
    },
    {
        siteName: 'SITE_EAST_SE_IDEAL90',
        prefs: {
            vMin: 0,
            vMax: 25,
            deltaRafaleMax: 10,
        },
        weather: {
            isDaytime: true,
            precipitation: 0.4,
            windSpeed: 15,
            windGust: 20,
            windDirDeg: 180,
            windCard: 'S',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Pluie (0.4 mm)',
        },
    },
    {
        siteName: 'SITE_EAST_SE_IDEAL90',
        prefs: {
            vMin: 0,
            vMax: 25,
            deltaRafaleMax: 10,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 30,
            windGust: 35,
            windDirDeg: 180,
            windCard: 'S',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Vent hors limites',
        },
    },
    {
        siteName: 'SITE_EAST_SE_IDEAL90',
        prefs: {
            vMin: 0,
            vMax: 25,
            deltaRafaleMax: 10,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 3,
            windGust: 5,
            windDirDeg: 180,
            windCard: 'S',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Mauvaise orientation',
        },
    },
    {
        siteName: 'SITE_EAST_SE_IDEAL90',
        prefs: {
            vMin: 0,
            vMax: 25,
            deltaRafaleMax: 10,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 12,
            windGust: 30,
            windDirDeg: 180,
            windCard: 'S',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Rafales hors limites',
        },
    },
    {
        siteName: 'SITE_EAST_SE_IDEAL90',
        prefs: {
            vMin: 0,
            vMax: 25,
            deltaRafaleMax: 10,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 15,
            windGust: 20,
            windDirDeg: 0,
            windCard: 'N',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Mauvaise orientation',
        },
    },
    {
        siteName: 'SITE_EAST_SE_IDEAL90',
        prefs: {
            vMin: 0,
            vMax: 25,
            deltaRafaleMax: 10,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 15,
            windGust: 20,
            windDirDeg: 90,
            windCard: 'E',
        },
        expected: {
            flyable: true,
            score: 90,
            reason: 'Excellent (90/100)',
        },
    },
    {
        siteName: 'SITE_EAST_SE_IDEAL90',
        prefs: {
            vMin: 0,
            vMax: 25,
            deltaRafaleMax: 10,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 15,
            windGust: 20,
            windDirDeg: 135,
            windCard: 'SE',
        },
        expected: {
            flyable: true,
            score: 40,
            reason: 'Passable (40/100)',
        },
    },
    {
        siteName: 'SITE_EAST_SE_IDEAL90',
        prefs: {
            vMin: 0,
            vMax: 25,
            deltaRafaleMax: 10,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 11,
            windGust: 14,
            windDirDeg: 210,
            windCard: 'SO',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Mauvaise orientation',
        },
    },
    {
        siteName: 'SITE_EAST_SE_IDEAL90',
        prefs: {
            vMin: 0,
            vMax: 25,
            deltaRafaleMax: 10,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 20,
            windGust: 22,
            windDirDeg: 315,
            windCard: 'NO',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Mauvaise orientation',
        },
    },
    {
        siteName: 'SITE_EAST_SE_IDEAL90',
        prefs: {
            vMin: 0,
            vMax: 25,
            deltaRafaleMax: 10,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 12.5,
            windGust: 12.5,
            windDirDeg: 90,
            windCard: 'E',
        },
        expected: {
            flyable: true,
            score: 100,
            reason: 'Excellent (100/100)',
        },
    },
    {
        siteName: 'SITE_STRING_SW',
        prefs: {
            vMin: 5,
            vMax: 25,
            deltaRafaleMax: 15,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 15,
            windGust: 20,
            windDirDeg: 180,
            windCard: 'S',
        },
        expected: {
            flyable: true,
            score: 86,
            reason: 'Excellent (86/100)',
        },
    },
    {
        siteName: 'SITE_STRING_SW',
        prefs: {
            vMin: 5,
            vMax: 25,
            deltaRafaleMax: 15,
        },
        weather: {
            isDaytime: false,
            precipitation: 0,
            windSpeed: 15,
            windGust: 20,
            windDirDeg: 180,
            windCard: 'S',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Nuit',
        },
    },
    {
        siteName: 'SITE_STRING_SW',
        prefs: {
            vMin: 5,
            vMax: 25,
            deltaRafaleMax: 15,
        },
        weather: {
            isDaytime: true,
            precipitation: 0.4,
            windSpeed: 15,
            windGust: 20,
            windDirDeg: 180,
            windCard: 'S',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Pluie (0.4 mm)',
        },
    },
    {
        siteName: 'SITE_STRING_SW',
        prefs: {
            vMin: 5,
            vMax: 25,
            deltaRafaleMax: 15,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 30,
            windGust: 35,
            windDirDeg: 180,
            windCard: 'S',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Vent hors limites',
        },
    },
    {
        siteName: 'SITE_STRING_SW',
        prefs: {
            vMin: 5,
            vMax: 25,
            deltaRafaleMax: 15,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 3,
            windGust: 5,
            windDirDeg: 180,
            windCard: 'S',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Vent hors limites',
        },
    },
    {
        siteName: 'SITE_STRING_SW',
        prefs: {
            vMin: 5,
            vMax: 25,
            deltaRafaleMax: 15,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 12,
            windGust: 30,
            windDirDeg: 180,
            windCard: 'S',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Rafales hors limites',
        },
    },
    {
        siteName: 'SITE_STRING_SW',
        prefs: {
            vMin: 5,
            vMax: 25,
            deltaRafaleMax: 15,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 15,
            windGust: 20,
            windDirDeg: 0,
            windCard: 'N',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Mauvaise orientation',
        },
    },
    {
        siteName: 'SITE_STRING_SW',
        prefs: {
            vMin: 5,
            vMax: 25,
            deltaRafaleMax: 15,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 15,
            windGust: 20,
            windDirDeg: 90,
            windCard: 'E',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Mauvaise orientation',
        },
    },
    {
        siteName: 'SITE_STRING_SW',
        prefs: {
            vMin: 5,
            vMax: 25,
            deltaRafaleMax: 15,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 15,
            windGust: 20,
            windDirDeg: 135,
            windCard: 'SE',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Mauvaise orientation',
        },
    },
    {
        siteName: 'SITE_STRING_SW',
        prefs: {
            vMin: 5,
            vMax: 25,
            deltaRafaleMax: 15,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 11,
            windGust: 14,
            windDirDeg: 210,
            windCard: 'SO',
        },
        expected: {
            flyable: true,
            score: 80,
            reason: 'Excellent (80/100)',
        },
    },
    {
        siteName: 'SITE_STRING_SW',
        prefs: {
            vMin: 5,
            vMax: 25,
            deltaRafaleMax: 15,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 20,
            windGust: 22,
            windDirDeg: 315,
            windCard: 'NO',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Mauvaise orientation',
        },
    },
    {
        siteName: 'SITE_STRING_SW',
        prefs: {
            vMin: 5,
            vMax: 25,
            deltaRafaleMax: 15,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 12.5,
            windGust: 12.5,
            windDirDeg: 90,
            windCard: 'E',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Mauvaise orientation',
        },
    },
    {
        siteName: 'SITE_STRING_SW',
        prefs: {
            vMin: 0,
            vMax: 25,
            deltaRafaleMax: 10,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 15,
            windGust: 20,
            windDirDeg: 180,
            windCard: 'S',
        },
        expected: {
            flyable: true,
            score: 76,
            reason: 'Bon (76/100)',
        },
    },
    {
        siteName: 'SITE_STRING_SW',
        prefs: {
            vMin: 0,
            vMax: 25,
            deltaRafaleMax: 10,
        },
        weather: {
            isDaytime: false,
            precipitation: 0,
            windSpeed: 15,
            windGust: 20,
            windDirDeg: 180,
            windCard: 'S',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Nuit',
        },
    },
    {
        siteName: 'SITE_STRING_SW',
        prefs: {
            vMin: 0,
            vMax: 25,
            deltaRafaleMax: 10,
        },
        weather: {
            isDaytime: true,
            precipitation: 0.4,
            windSpeed: 15,
            windGust: 20,
            windDirDeg: 180,
            windCard: 'S',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Pluie (0.4 mm)',
        },
    },
    {
        siteName: 'SITE_STRING_SW',
        prefs: {
            vMin: 0,
            vMax: 25,
            deltaRafaleMax: 10,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 30,
            windGust: 35,
            windDirDeg: 180,
            windCard: 'S',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Vent hors limites',
        },
    },
    {
        siteName: 'SITE_STRING_SW',
        prefs: {
            vMin: 0,
            vMax: 25,
            deltaRafaleMax: 10,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 3,
            windGust: 5,
            windDirDeg: 180,
            windCard: 'S',
        },
        expected: {
            flyable: true,
            score: 48,
            reason: 'Passable (48/100)',
        },
    },
    {
        siteName: 'SITE_STRING_SW',
        prefs: {
            vMin: 0,
            vMax: 25,
            deltaRafaleMax: 10,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 12,
            windGust: 30,
            windDirDeg: 180,
            windCard: 'S',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Rafales hors limites',
        },
    },
    {
        siteName: 'SITE_STRING_SW',
        prefs: {
            vMin: 0,
            vMax: 25,
            deltaRafaleMax: 10,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 15,
            windGust: 20,
            windDirDeg: 0,
            windCard: 'N',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Mauvaise orientation',
        },
    },
    {
        siteName: 'SITE_STRING_SW',
        prefs: {
            vMin: 0,
            vMax: 25,
            deltaRafaleMax: 10,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 15,
            windGust: 20,
            windDirDeg: 90,
            windCard: 'E',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Mauvaise orientation',
        },
    },
    {
        siteName: 'SITE_STRING_SW',
        prefs: {
            vMin: 0,
            vMax: 25,
            deltaRafaleMax: 10,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 15,
            windGust: 20,
            windDirDeg: 135,
            windCard: 'SE',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Mauvaise orientation',
        },
    },
    {
        siteName: 'SITE_STRING_SW',
        prefs: {
            vMin: 0,
            vMax: 25,
            deltaRafaleMax: 10,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 11,
            windGust: 14,
            windDirDeg: 210,
            windCard: 'SO',
        },
        expected: {
            flyable: true,
            score: 94,
            reason: 'Excellent (94/100)',
        },
    },
    {
        siteName: 'SITE_STRING_SW',
        prefs: {
            vMin: 0,
            vMax: 25,
            deltaRafaleMax: 10,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 20,
            windGust: 22,
            windDirDeg: 315,
            windCard: 'NO',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Mauvaise orientation',
        },
    },
    {
        siteName: 'SITE_STRING_SW',
        prefs: {
            vMin: 0,
            vMax: 25,
            deltaRafaleMax: 10,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 12.5,
            windGust: 12.5,
            windDirDeg: 90,
            windCard: 'E',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Mauvaise orientation',
        },
    },
    {
        siteName: 'SITE_LEGACY_ORIENTATION',
        prefs: {
            vMin: 5,
            vMax: 25,
            deltaRafaleMax: 15,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 15,
            windGust: 20,
            windDirDeg: 180,
            windCard: 'S',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Mauvaise orientation',
        },
    },
    {
        siteName: 'SITE_LEGACY_ORIENTATION',
        prefs: {
            vMin: 5,
            vMax: 25,
            deltaRafaleMax: 15,
        },
        weather: {
            isDaytime: false,
            precipitation: 0,
            windSpeed: 15,
            windGust: 20,
            windDirDeg: 180,
            windCard: 'S',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Nuit',
        },
    },
    {
        siteName: 'SITE_LEGACY_ORIENTATION',
        prefs: {
            vMin: 5,
            vMax: 25,
            deltaRafaleMax: 15,
        },
        weather: {
            isDaytime: true,
            precipitation: 0.4,
            windSpeed: 15,
            windGust: 20,
            windDirDeg: 180,
            windCard: 'S',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Pluie (0.4 mm)',
        },
    },
    {
        siteName: 'SITE_LEGACY_ORIENTATION',
        prefs: {
            vMin: 5,
            vMax: 25,
            deltaRafaleMax: 15,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 30,
            windGust: 35,
            windDirDeg: 180,
            windCard: 'S',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Vent hors limites',
        },
    },
    {
        siteName: 'SITE_LEGACY_ORIENTATION',
        prefs: {
            vMin: 5,
            vMax: 25,
            deltaRafaleMax: 15,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 3,
            windGust: 5,
            windDirDeg: 180,
            windCard: 'S',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Vent hors limites',
        },
    },
    {
        siteName: 'SITE_LEGACY_ORIENTATION',
        prefs: {
            vMin: 5,
            vMax: 25,
            deltaRafaleMax: 15,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 12,
            windGust: 30,
            windDirDeg: 180,
            windCard: 'S',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Rafales hors limites',
        },
    },
    {
        siteName: 'SITE_LEGACY_ORIENTATION',
        prefs: {
            vMin: 5,
            vMax: 25,
            deltaRafaleMax: 15,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 15,
            windGust: 20,
            windDirDeg: 0,
            windCard: 'N',
        },
        expected: {
            flyable: true,
            score: 100,
            reason: 'Excellent (100/100)',
        },
    },
    {
        siteName: 'SITE_LEGACY_ORIENTATION',
        prefs: {
            vMin: 5,
            vMax: 25,
            deltaRafaleMax: 15,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 15,
            windGust: 20,
            windDirDeg: 90,
            windCard: 'E',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Mauvaise orientation',
        },
    },
    {
        siteName: 'SITE_LEGACY_ORIENTATION',
        prefs: {
            vMin: 5,
            vMax: 25,
            deltaRafaleMax: 15,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 15,
            windGust: 20,
            windDirDeg: 135,
            windCard: 'SE',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Mauvaise orientation',
        },
    },
    {
        siteName: 'SITE_LEGACY_ORIENTATION',
        prefs: {
            vMin: 5,
            vMax: 25,
            deltaRafaleMax: 15,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 11,
            windGust: 14,
            windDirDeg: 210,
            windCard: 'SO',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Mauvaise orientation',
        },
    },
    {
        siteName: 'SITE_LEGACY_ORIENTATION',
        prefs: {
            vMin: 5,
            vMax: 25,
            deltaRafaleMax: 15,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 20,
            windGust: 22,
            windDirDeg: 315,
            windCard: 'NO',
        },
        expected: {
            flyable: true,
            score: 75,
            reason: 'Bon (75/100)',
        },
    },
    {
        siteName: 'SITE_LEGACY_ORIENTATION',
        prefs: {
            vMin: 5,
            vMax: 25,
            deltaRafaleMax: 15,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 12.5,
            windGust: 12.5,
            windDirDeg: 90,
            windCard: 'E',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Mauvaise orientation',
        },
    },
    {
        siteName: 'SITE_LEGACY_ORIENTATION',
        prefs: {
            vMin: 0,
            vMax: 25,
            deltaRafaleMax: 10,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 15,
            windGust: 20,
            windDirDeg: 180,
            windCard: 'S',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Mauvaise orientation',
        },
    },
    {
        siteName: 'SITE_LEGACY_ORIENTATION',
        prefs: {
            vMin: 0,
            vMax: 25,
            deltaRafaleMax: 10,
        },
        weather: {
            isDaytime: false,
            precipitation: 0,
            windSpeed: 15,
            windGust: 20,
            windDirDeg: 180,
            windCard: 'S',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Nuit',
        },
    },
    {
        siteName: 'SITE_LEGACY_ORIENTATION',
        prefs: {
            vMin: 0,
            vMax: 25,
            deltaRafaleMax: 10,
        },
        weather: {
            isDaytime: true,
            precipitation: 0.4,
            windSpeed: 15,
            windGust: 20,
            windDirDeg: 180,
            windCard: 'S',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Pluie (0.4 mm)',
        },
    },
    {
        siteName: 'SITE_LEGACY_ORIENTATION',
        prefs: {
            vMin: 0,
            vMax: 25,
            deltaRafaleMax: 10,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 30,
            windGust: 35,
            windDirDeg: 180,
            windCard: 'S',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Vent hors limites',
        },
    },
    {
        siteName: 'SITE_LEGACY_ORIENTATION',
        prefs: {
            vMin: 0,
            vMax: 25,
            deltaRafaleMax: 10,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 3,
            windGust: 5,
            windDirDeg: 180,
            windCard: 'S',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Mauvaise orientation',
        },
    },
    {
        siteName: 'SITE_LEGACY_ORIENTATION',
        prefs: {
            vMin: 0,
            vMax: 25,
            deltaRafaleMax: 10,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 12,
            windGust: 30,
            windDirDeg: 180,
            windCard: 'S',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Rafales hors limites',
        },
    },
    {
        siteName: 'SITE_LEGACY_ORIENTATION',
        prefs: {
            vMin: 0,
            vMax: 25,
            deltaRafaleMax: 10,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 15,
            windGust: 20,
            windDirDeg: 0,
            windCard: 'N',
        },
        expected: {
            flyable: true,
            score: 90,
            reason: 'Excellent (90/100)',
        },
    },
    {
        siteName: 'SITE_LEGACY_ORIENTATION',
        prefs: {
            vMin: 0,
            vMax: 25,
            deltaRafaleMax: 10,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 15,
            windGust: 20,
            windDirDeg: 90,
            windCard: 'E',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Mauvaise orientation',
        },
    },
    {
        siteName: 'SITE_LEGACY_ORIENTATION',
        prefs: {
            vMin: 0,
            vMax: 25,
            deltaRafaleMax: 10,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 15,
            windGust: 20,
            windDirDeg: 135,
            windCard: 'SE',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Mauvaise orientation',
        },
    },
    {
        siteName: 'SITE_LEGACY_ORIENTATION',
        prefs: {
            vMin: 0,
            vMax: 25,
            deltaRafaleMax: 10,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 11,
            windGust: 14,
            windDirDeg: 210,
            windCard: 'SO',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Mauvaise orientation',
        },
    },
    {
        siteName: 'SITE_LEGACY_ORIENTATION',
        prefs: {
            vMin: 0,
            vMax: 25,
            deltaRafaleMax: 10,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 20,
            windGust: 22,
            windDirDeg: 315,
            windCard: 'NO',
        },
        expected: {
            flyable: true,
            score: 70,
            reason: 'Bon (70/100)',
        },
    },
    {
        siteName: 'SITE_LEGACY_ORIENTATION',
        prefs: {
            vMin: 0,
            vMax: 25,
            deltaRafaleMax: 10,
        },
        weather: {
            isDaytime: true,
            precipitation: 0,
            windSpeed: 12.5,
            windGust: 12.5,
            windDirDeg: 90,
            windCard: 'E',
        },
        expected: {
            flyable: false,
            score: 0,
            reason: 'Mauvaise orientation',
        },
    },
]);
