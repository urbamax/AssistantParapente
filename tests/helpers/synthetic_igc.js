// Fichier IGC synthétique (un point toutes les 2 s) : phases { seconds, speedKmh, verticalMs },
// déplacement vers le nord. Une phase immobile (speedKmh 0) figure le parking ou l'attente.
export const GROUND = { seconds: 180, speedKmh: 0, verticalMs: 0 };
export const FLIGHT_10MIN = { seconds: 600, speedKmh: 30, verticalMs: -0.5 };

export function buildIgc(phases) {
    const records = [];
    let lat = 45.9;
    let alt = 1500;
    let t = 0;
    for (const { seconds, speedKmh = 0, verticalMs = 0 } of phases) {
        for (let s = 0; s < seconds; s += 2) {
            const h = 10 + Math.floor(t / 3600);
            const m = Math.floor((t % 3600) / 60);
            const time = [h, m, t % 60].map((n) => String(n).padStart(2, '0')).join('');
            const deg = Math.floor(lat);
            const min = String(Math.round((lat - deg) * 60000)).padStart(5, '0');
            const a = String(Math.round(alt)).padStart(5, '0');
            records.push(`B${time}${deg}${min}N00652000EA${a}${a}`);
            lat += ((speedKmh / 3.6) * 2) / 111320;
            alt += verticalMs * 2;
            t += 2;
        }
    }
    return ['HFDTE031026', ...records].join('\n');
}
