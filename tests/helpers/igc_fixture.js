/**
 * Fabrique de petits vols de test : un texte IGC valide et le fichier .sdf Syride qui le suit,
 * à partir des mêmes points (un par seconde), pour construire des lots de plusieurs vols sans
 * gros fichiers. Deux vols de formes différentes (cap, vitesse, chute) ne se correspondent pas ;
 * deux vols de même forme à des heures différentes si (le .sdf ne dépend que de la forme).
 */

const EARTH_M_PER_DEG = 111320;

const pad = (n, len = 2) => String(n).padStart(len, '0');

function igcLat(lat) {
    const abs = Math.abs(lat);
    const deg = Math.floor(abs);
    const thousandths = Math.round((abs - deg) * 60 * 1000);
    return `${pad(deg)}${pad(thousandths, 5)}${lat >= 0 ? 'N' : 'S'}`;
}

function igcLon(lon) {
    const abs = Math.abs(lon);
    const deg = Math.floor(abs);
    const thousandths = Math.round((abs - deg) * 60 * 1000);
    return `${pad(deg, 3)}${pad(thousandths, 5)}${lon >= 0 ? 'E' : 'W'}`;
}

/** Valeur d'un champ numérique IGC de 5 chiffres (altitude), jamais négative. */
const igcAlt = (alt) => pad(Math.max(0, Math.round(alt)), 5);

/**
 * @param {Object} [options]
 * @param {string} [options.date] jour UTC du vol, AAAA-MM-JJ
 * @param {string} [options.start] heure UTC du décollage, HH:MM:SS
 * @param {number} [options.lat] latitude du décollage
 * @param {number} [options.lon] longitude du décollage
 * @param {number} [options.minutes] durée du vol en minutes
 * @param {number} [options.heading] cap en degrés (0 = nord)
 * @param {number} [options.speed] vitesse sol en m/s
 * @param {number} [options.sink] chute en m/s
 * @param {number} [options.alt0] altitude du décollage en m
 * @param {number} [options.gPeak] facteur de charge maximal du .sdf
 * @param {number} [options.groundMinutes] minutes au sol avant et après (0 : trace commençant en l'air)
 * @param {string} [options.instrument] nom de l'instrument dans l'en-tête
 */
export function buildFlight(options = {}) {
    const {
        date = '2026-09-20',
        start = '09:30:00',
        lat = 46.4,
        lon = 3.4,
        minutes = 12,
        heading = 90,
        speed = 8,
        sink = 1,
        alt0 = 1500,
        gPeak = 2,
        groundMinutes = 2,
        instrument = 'Fixture',
    } = options;
    const [year, month, day] = date.split('-').map(Number);
    const [hh, mm, ss] = start.split(':').map(Number);
    const takeoffMs = Date.UTC(year, month - 1, day, hh, mm, ss);
    const groundS = groundMinutes * 60;
    const flightS = minutes * 60;
    const rad = (heading * Math.PI) / 180;
    const cosLat = Math.cos((lat * Math.PI) / 180);

    const points = [];
    for (let t = -groundS; t <= flightS + groundS; t++) {
        const flying = Math.min(Math.max(t, 0), flightS);
        points.push({
            lat: lat + (Math.cos(rad) * speed * flying) / EARTH_M_PER_DEG,
            lon: lon + (Math.sin(rad) * speed * flying) / (EARTH_M_PER_DEG * cosLat),
            alt: alt0 - sink * flying,
            timestamp: takeoffMs + t * 1000,
        });
    }

    const lines = [
        'AXFX001',
        `HFDTE${pad(day)}${pad(month)}${pad(year % 100)}`,
        `HFFTYFRTYPE: ${instrument}, Test`,
        'HFPLTPILOTINCHARGE: Pilote Test',
    ];
    for (const p of points) {
        const d = new Date(p.timestamp);
        const time = `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
        lines.push(`B${time}${igcLat(p.lat)}${igcLon(p.lon)}A${igcAlt(p.alt)}${igcAlt(p.alt)}`);
    }

    return {
        igc: `${lines.join('\n')}\n`,
        sdf: buildSdf(points, { gPeak }),
        points,
        takeoffMs,
        landingMs: takeoffMs + flightS * 1000,
        lat,
        lon,
        minutes,
        gPeak,
    };
}

/** Un .sdf Syride (en-tête de 8 octets, 21 octets par seconde) qui suit exactement ces points. */
export function buildSdf(points, { gPeak = 2 } = {}) {
    const bytes = new Uint8Array(8 + points.length * 21);
    const view = new DataView(bytes.buffer);
    const peakAt = Math.floor(points.length / 2);
    points.forEach((p, i) => {
        const o = 8 + i * 21;
        view.setInt32(o, Math.round(p.lat * 1e7));
        view.setInt32(o + 4, Math.round(p.lon * 1e7));
        view.setInt16(o + 8, Math.round(p.alt));
        view.setInt16(o + 10, Math.round(p.alt) - 5);
        view.setUint8(o + 12, 30);
        view.setUint8(o + 13, 12);
        view.setInt8(o + 14, 21);
        view.setInt8(o + 15, -10);
        for (let k = 0; k < 5; k++) view.setUint8(o + 16 + k, i === peakAt && k === 2 ? Math.round(gPeak * 10) : 10);
    });
    return bytes;
}

/** Texte qui n'est pas une trace : aucun point GPS. */
export const CORRUPTED_IGC = 'ceci n’est pas une trace GPS\nHFDTE???\nB12\n';

/** Une trace d'une seconde seulement : lisible mais trop courte pour être un vol. */
export function tooShortIgc() {
    return buildFlight({ minutes: 0, groundMinutes: 0 }).igc;
}

/** Un fichier navigateur (`File`) portant ce texte ou ces octets. */
export const fileOf = (name, content) => new File([content], name);

/** Heure locale AAAA-MM-JJTHH:MM d'un instant, comme le champ « date et heure » du formulaire. */
export function localDateTime(ms) {
    const d = new Date(ms);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
