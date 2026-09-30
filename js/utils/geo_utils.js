/**
 * UTILS - Geo Utilities
 * Pure functions for geographic calculations, distance, and angle normalization.
 */

/**
 * Calcule la distance en kilomètres entre deux points GPS en utilisant la formule de Haversine.
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} Distance en kilomètres
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
    if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) return Infinity;
    const R = 6371; // Rayon de la Terre en km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance en km
}

/**
 * Normalise un angle (cap) pour le ramener entre 0 et 360 degrés.
 * @param {number} deg - L'angle en degrés
 * @returns {number} L'angle normalisé (0-360)
 */
export function normalizeDegree(deg) {
    if (typeof deg !== 'number' || isNaN(deg)) return 0;
    return ((deg % 360) + 360) % 360;
}

/**
 * Calcule la différence angulaire absolue la plus courte entre deux caps (en degrés).
 * @param {number} angle1 - Premier angle (0-360)
 * @param {number} angle2 - Deuxième angle (0-360)
 * @returns {number} La différence angulaire entre 0 et 180 degrés.
 */
export function getAngularDifference(angle1, angle2) {
    const diff = Math.abs(angle1 - angle2) % 360;
    return diff > 180 ? 360 - diff : diff;
}

/**
 * Convertit un cap en degrés (0-360) en direction cardinale courte.
 * @param {number} deg - Cap en degrés
 * @returns {string} Direction cardinale ("N", "NE", "E", "SE", "S", "SO", "O", "NO")
 */
export function degreesToCardinal(deg) {
    const normalizedDeg = normalizeDegree(deg);
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
    const index = Math.round(normalizedDeg / 45) % 8;
    return directions[index];
}

/**
 * Découpe une coordonnée décimale en degrés / minutes décimales, arrondie à `decimals`
 * chiffres sur les minutes. La retenue (59.9999' → 60.000') est reportée sur les degrés.
 * @param {number} value - Coordonnée en degrés décimaux (signée)
 * @param {number} decimals - Chiffres après la virgule des minutes
 * @returns {{deg: number, min: number}} Valeurs absolues (le signe est porté par l'hémisphère)
 */
function splitDegreesMinutes(value, decimals) {
    const abs = Math.abs(value);
    let deg = Math.floor(abs);
    let min = Number(((abs - deg) * 60).toFixed(decimals));
    if (min >= 60) {
        deg += 1;
        min = 0;
    }
    return { deg, min };
}

function hemisphere(value, axis) {
    if (axis === 'lat') return value < 0 ? 'S' : 'N';
    return value < 0 ? 'W' : 'E';
}

/**
 * Formate une position en degrés + minutes décimales (format aéronautique, celui qu'attend
 * un équipage d'hélicoptère) : "45°54.123' N 006°52.456' E".
 * @param {number} lat
 * @param {number} lon
 * @returns {string}
 */
export function formatDegreesMinutes(lat, lon) {
    const fmt = (value, axis) => {
        const { deg, min } = splitDegreesMinutes(value, 3);
        const degStr = String(deg).padStart(axis === 'lat' ? 2 : 3, '0');
        const minStr = min.toFixed(3).padStart(6, '0');
        return `${degStr}°${minStr}' ${hemisphere(value, axis)}`;
    };
    return `${fmt(lat, 'lat')} ${fmt(lon, 'lon')}`;
}

/**
 * Formate une position en degrés, minutes, secondes : `45°54'07.4" N 6°52'27.4" E`.
 * @param {number} lat
 * @param {number} lon
 * @returns {string}
 */
export function formatDegreesMinutesSeconds(lat, lon) {
    const fmt = (value, axis) => {
        const abs = Math.abs(value);
        let deg = Math.floor(abs);
        const totalSec = Number(((abs - deg) * 3600).toFixed(1));
        let min = Math.floor(totalSec / 60);
        let sec = Number((totalSec - min * 60).toFixed(1));
        if (sec >= 60) {
            min += 1;
            sec = 0;
        }
        if (min >= 60) {
            deg += 1;
            min = 0;
        }
        const secStr = sec.toFixed(1).padStart(4, '0');
        return `${deg}°${String(min).padStart(2, '0')}'${secStr}" ${hemisphere(value, axis)}`;
    };
    return `${fmt(lat, 'lat')} ${fmt(lon, 'lon')}`;
}

/**
 * Formate une position en degrés décimaux (5 décimales ≈ 1 m), format accepté par les
 * applis de cartographie et par le 112 : "45.90206, 6.87428".
 * @param {number} lat
 * @param {number} lon
 * @returns {string}
 */
export function formatDecimalDegrees(lat, lon) {
    return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

/**
 * Lit des coordonnées GPS collées par l'utilisateur (spec 011) : décimales (« 50.68123, 1.59234 »,
 * « 45,9; 6,12 »), degrés-minutes-secondes comme Google Maps (« 50°40'52.4"N 1°35'32.4"E »,
 * O/W pour l'ouest) ou lien Google Maps contenant « @lat,lon ».
 * @param {string|null|undefined} text
 * @returns {{lat: number, lon: number}|null} null si illisible ou hors limites
 */
export function parseCoordinates(text) {
    if (typeof text !== 'string') return null;
    const s = text.trim();
    if (!s) return null;
    const num = (/** @type {string} */ v) => Number(v.replace(',', '.'));

    const link = s.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (link) return checkedCoordinates(num(link[1]), num(link[2]));

    const dms = [
        ...s.matchAll(
            /(\d+(?:[.,]\d+)?)\s*°\s*(?:(\d+(?:[.,]\d+)?)\s*['′]\s*)?(?:(\d+(?:[.,]\d+)?)\s*(?:"|″|''))?\s*([NSEWO])/gi,
        ),
    ];
    if (dms.length === 2) {
        let lat = null;
        let lon = null;
        for (const m of dms) {
            const value = num(m[1]) + (m[2] ? num(m[2]) : 0) / 60 + (m[3] ? num(m[3]) : 0) / 3600;
            const hemisphere = m[4].toUpperCase();
            if (hemisphere === 'N' || hemisphere === 'S') lat = hemisphere === 'S' ? -value : value;
            else lon = hemisphere === 'E' ? value : -value;
        }
        return lat === null || lon === null ? null : checkedCoordinates(lat, lon);
    }

    const decimal =
        s.match(/^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)$/) ||
        s.match(/^(-?\d+(?:,\d+)?)\s*;\s*(-?\d+(?:,\d+)?)$/);
    return decimal ? checkedCoordinates(num(decimal[1]), num(decimal[2])) : null;
}

/**
 * @param {number} lat
 * @param {number} lon
 * @returns {{lat: number, lon: number}|null}
 */
function checkedCoordinates(lat, lon) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    const round = (/** @type {number} */ v) => Math.round(v * 1e6) / 1e6;
    return { lat: round(lat), lon: round(lon) };
}

/**
 * Écrit des coordonnées sous la forme « lat, lon » à 5 décimales (≈ 1 m), relisible par parseCoordinates.
 * @param {number} lat
 * @param {number} lon
 * @returns {string}
 */
export function formatCoordinates(lat, lon) {
    return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}
