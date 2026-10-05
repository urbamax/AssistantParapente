/**
 * SdfParser
 * Lecture des fichiers .sdf enregistrés par les varios Syride (SYS'Nav) à côté du .igc.
 * Format binaire (rétro-analysé, gros-boutiste) : un en-tête de 8 octets puis un
 * enregistrement de 21 octets par seconde, dans le même ordre que les points B de l'IGC :
 *
 *   0-3   latitude  (int32, 1e-7 degré)      12  vitesse sol (km/h)
 *   4-7   longitude (int32, 1e-7 degré)      13  satellites
 *   8-9   altitude GPS (int16, m)            14  température du boîtier (°C, signé)
 *   10-11 altitude baro relative (int16, m)  15  vario (signé, 0,1 m/s)
 *                                            16-20 facteur de charge, 5 mesures (0,1 g)
 *
 * L'IGC ne contient pas l'accéléromètre : c'est ce fichier qui l'apporte. La température est celle
 * du capteur dans le boîtier (soleil, chaleur du pilote, électronique) : pas celle de l'air.
 */
const SdfParser = {
    HEADER_BYTES: 8,
    RECORD_BYTES: 21,

    /**
     * @param {ArrayBuffer|Uint8Array} buffer
     * @returns {Array<{lat:number, lon:number, alt:number, baroAlt:number, speedKmh:number,
     *   satellites:number, temperature:number, vario:number, g:number[]}>|null} null si le
     *   fichier n'a pas la forme attendue
     */
    parse(buffer) {
        const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
        const body = bytes.length - this.HEADER_BYTES;
        if (body <= 0 || body % this.RECORD_BYTES !== 0) return null;
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const records = [];
        for (let o = this.HEADER_BYTES; o < bytes.length; o += this.RECORD_BYTES) {
            const lat = view.getInt32(o) / 1e7;
            const lon = view.getInt32(o + 4) / 1e7;
            if (Math.abs(lat) > 90 || Math.abs(lon) > 180 || (lat === 0 && lon === 0)) return null;
            const g = [];
            for (let k = 16; k < 21; k++) g.push(view.getUint8(o + k) / 10);
            records.push({
                lat,
                lon,
                alt: view.getInt16(o + 8),
                baroAlt: view.getInt16(o + 10),
                speedKmh: view.getUint8(o + 12),
                satellites: view.getUint8(o + 13),
                temperature: view.getInt8(o + 14),
                vario: view.getInt8(o + 15) / 10,
                g,
            });
        }
        return records;
    },

    /**
     * Index de l'enregistrement SDF correspondant au premier point de la trace IGC (les deux
     * fichiers démarrent normalement ensemble ; on cherche dans la première minute le point
     * le plus proche, à moins de 50 m). -1 si les deux fichiers ne concordent pas.
     */
    alignToTrace(records, trace) {
        if (!records || !records.length || !trace || !trace.length) return -1;
        const first = trace[0];
        let best = -1;
        let bestM = 50;
        for (let k = 0; k < Math.min(60, records.length); k++) {
            const dLat = (records[k].lat - first.lat) * 111320;
            const dLon = (records[k].lon - first.lon) * 111320 * Math.cos((first.lat * Math.PI) / 180);
            const m = Math.hypot(dLat, dLon);
            if (m < bestM) {
                bestM = m;
                best = k;
            }
        }
        return best;
    },

    /**
     * Vérifie que le .sdf est bien celui de cette trace, et pas celui d'un autre vol parti du
     * même décollage : sur toute la trace (un point toutes les 5 s), la position du .sdf à la
     * même seconde doit être à moins de 30 m et l'altitude GPS à moins de 15 m, pour au moins
     * 90 % des points comparés. La durée doit aussi correspondre (± 2 min).
     * @returns {boolean}
     */
    matchesTrace(records, trace, offset) {
        if (!records || !trace || trace.length < 2 || offset < 0) return false;
        const t0 = trace[0].timestamp;
        const traceSeconds = Math.round((trace[trace.length - 1].timestamp - t0) / 1000);
        if (Math.abs(records.length - offset - 1 - traceSeconds) > 120) return false;
        let compared = 0;
        let matching = 0;
        let lastT = -Infinity;
        for (const p of trace) {
            if (p.timestamp - lastT < 5000) continue;
            lastT = p.timestamp;
            const r = records[offset + Math.round((p.timestamp - t0) / 1000)];
            if (!r) continue;
            compared++;
            const dLat = (r.lat - p.lat) * 111320;
            const dLon = (r.lon - p.lon) * 111320 * Math.cos((p.lat * Math.PI) / 180);
            if (Math.hypot(dLat, dLon) <= 30 && Math.abs(r.alt - p.alt) <= 15) matching++;
        }
        return compared >= 2 && matching / compared >= 0.9;
    },

    /**
     * Résumé capteurs sur une plage d'enregistrements (le vol seul, en général).
     * @returns {{gMax:number, gMin:number, tempTakeoff:number, tempMin:number, tempMax:number}|null}
     */
    summarize(records, from = 0, to = records ? records.length - 1 : -1) {
        if (!records || !records.length) return null;
        const start = Math.max(0, from);
        const end = Math.min(records.length - 1, to);
        if (end < start) return null;
        let gMax = -Infinity;
        let gMin = Infinity;
        let tempMin = Infinity;
        let tempMax = -Infinity;
        for (let k = start; k <= end; k++) {
            const r = records[k];
            for (const g of r.g) {
                if (g > gMax) gMax = g;
                if (g < gMin) gMin = g;
            }
            if (r.temperature < tempMin) tempMin = r.temperature;
            if (r.temperature > tempMax) tempMax = r.temperature;
        }
        return {
            gMax: Math.round(gMax * 10) / 10,
            gMin: Math.round(gMin * 10) / 10,
            tempTakeoff: records[start].temperature,
            tempMin,
            tempMax,
        };
    },
};

export default SdfParser;
