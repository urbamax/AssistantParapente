// Traces IGC synthétiques à 1 point/s pour tester l'analyse sans fichier réel.
const M_PER_DEG_LAT = 111320;
export const START = Date.UTC(2026, 6, 14, 11, 0, 0);

/**
 * Trace synthétique à 1 point/s. Phases :
 *  - { seconds, glide: { speedKmh, verticalMs, headingDeg } } : ligne droite
 *  - { seconds, circle: { speedKmh, radiusM, verticalMs, direction } } : spirale (+1 droite, -1 gauche)
 */
export function buildFlight(phases, origin = { lat: 45.9, lon: 6.87, alt: 1500 }) {
    const trace = [];
    let { lat, lon, alt } = origin;
    let t = START;
    let heading = 0;
    const mPerDegLon = M_PER_DEG_LAT * Math.cos((origin.lat * Math.PI) / 180);
    const push = () => trace.push({ lat, lon, alt: Math.round(alt), timestamp: t });
    push();
    for (const phase of phases) {
        for (let s = 0; s < phase.seconds; s++) {
            if (phase.glide) {
                heading = phase.glide.headingDeg ?? heading;
                const v = phase.glide.speedKmh / 3.6;
                lat += (v * Math.cos((heading * Math.PI) / 180)) / M_PER_DEG_LAT;
                lon += (v * Math.sin((heading * Math.PI) / 180)) / mPerDegLon;
                alt += phase.glide.verticalMs;
            } else {
                const { speedKmh, radiusM, verticalMs, direction } = phase.circle;
                const v = speedKmh / 3.6;
                heading = (heading + (direction * ((v / radiusM) * 180)) / Math.PI + 360) % 360;
                lat += (v * Math.cos((heading * Math.PI) / 180)) / M_PER_DEG_LAT;
                lon += (v * Math.sin((heading * Math.PI) / 180)) / mPerDegLon;
                alt += verticalMs;
            }
            t += 1000;
            push();
        }
    }
    return trace;
}

export const thermal = (seconds, verticalMs, direction = -1) => ({
    seconds,
    circle: { speedKmh: 32, radiusM: 35, verticalMs, direction },
});
export const glide = (seconds, headingDeg = 0) => ({ seconds, glide: { speedKmh: 36, verticalMs: -1.2, headingDeg } });

/** Écrit une trace synthétique au format IGC (enregistrements B, altitude GPS) que le parseur relit. */
export function toIgc(trace) {
    const pad = (n, size) => String(n).padStart(size, '0');
    const angle = (value, degDigits) => {
        const abs = Math.abs(value);
        const thousandths = Math.round(abs * 60 * 1000);
        return `${pad(Math.floor(thousandths / 60000), degDigits)}${pad(Math.floor((thousandths % 60000) / 1000), 2)}${pad(thousandths % 1000, 3)}`;
    };
    const date = new Date(trace[0].timestamp);
    const header = `HFDTE${pad(date.getUTCDate(), 2)}${pad(date.getUTCMonth() + 1, 2)}${pad(date.getUTCFullYear() % 100, 2)}`;
    const records = trace.map((p) => {
        const d = new Date(p.timestamp);
        const time = `${pad(d.getUTCHours(), 2)}${pad(d.getUTCMinutes(), 2)}${pad(d.getUTCSeconds(), 2)}`;
        const alt = pad(Math.round(p.alt), 5);
        return `B${time}${angle(p.lat, 2)}${p.lat >= 0 ? 'N' : 'S'}${angle(p.lon, 3)}${p.lon >= 0 ? 'E' : 'W'}A${alt}${alt}`;
    });
    return [header, ...records, ''].join('\n');
}
