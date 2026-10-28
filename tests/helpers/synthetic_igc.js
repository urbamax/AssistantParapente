// Fichier IGC synthétique (un point toutes les 2 s) : phases { seconds, speedKmh, verticalMs,
// turnDegPerS }, déplacement vers le nord sauf virage (turnDegPerS > 0 : à droite, < 0 : à gauche).
// Une phase immobile (speedKmh 0) figure le parking ou l'attente.
export const GROUND = { seconds: 180, speedKmh: 0, verticalMs: 0 };
export const FLIGHT_10MIN = { seconds: 600, speedKmh: 30, verticalMs: -0.5 };

export function buildIgc(phases) {
    const records = [];
    let lat = 45.9;
    let lon = 6 + 52 / 60;
    let heading = 0; // radians, 0 = nord
    let alt = 1500;
    let t = 0;
    for (const { seconds, speedKmh = 0, verticalMs = 0, turnDegPerS = 0 } of phases) {
        for (let s = 0; s < seconds; s += 2) {
            const h = 10 + Math.floor(t / 3600);
            const m = Math.floor((t % 3600) / 60);
            const time = [h, m, t % 60].map((n) => String(n).padStart(2, '0')).join('');
            const deg = Math.floor(lat);
            const min = String(Math.round((lat - deg) * 60000)).padStart(5, '0');
            const lonDeg = Math.floor(lon);
            const lonMin = String(Math.round((lon - lonDeg) * 60000)).padStart(5, '0');
            const a = String(Math.round(alt)).padStart(5, '0');
            records.push(`B${time}${deg}${min}N${String(lonDeg).padStart(3, '0')}${lonMin}EA${a}${a}`);
            const stepM = (speedKmh / 3.6) * 2;
            lat += (stepM * Math.cos(heading)) / 111320;
            lon += (stepM * Math.sin(heading)) / (111320 * Math.cos((lat * Math.PI) / 180));
            heading += (turnDegPerS * 2 * Math.PI) / 180;
            alt += verticalMs * 2;
            t += 2;
        }
    }
    return ['HFDTE031026', ...records].join('\n');
}
