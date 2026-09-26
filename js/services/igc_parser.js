/**
 * IGCParser Service
 * Module autonome pour analyser et extraire les données d'un fichier de trace GPS au format IGC.
 */
const IGCParser = {
    /**
     * Parse le contenu texte d'un fichier IGC et retourne un objet standardisé.
     * @param {string} igcText Le contenu texte complet du fichier .igc
     * @returns {Object} Objet contenant la trace, la date, la durée, le gain et l'altitude max.
     */
    parse: function (igcText) {
        const lines = igcText.split(/\r?\n/);
        const trace = [];
        let baseDate = new Date();

        // 1. Essayer de trouver la date de la trace (HFDTE)
        for (const line of lines) {
            if (line.startsWith('HFDTE') || line.startsWith('HFDTEDATE:')) {
                // Format: HFDTEDATE:DDMMYY ou HFDTE DDMMYY
                const dateMatch = line.match(/(\d{2})(\d{2})(\d{2})/);
                if (dateMatch) {
                    const day = parseInt(dateMatch[1], 10);
                    const month = parseInt(dateMatch[2], 10) - 1; // 0-indexed
                    let year = parseInt(dateMatch[3], 10);
                    // Hypothèse pour l'année : 80-99 -> 1980-1999, 00-79 -> 2000-2079
                    year += year < 80 ? 2000 : 1900;
                    baseDate = new Date(Date.UTC(year, month, day));
                }
                break;
            }
        }

        let firstPointTime = null;
        let maxAltitude = -Infinity;

        // 2. Extraire les enregistrements B
        for (const line of lines) {
            const l = line.trim();
            if (l.startsWith('B')) {
                // Format B: B HHMMSS DDMMmmmN DDDMMmmmE A PPPPP GGGGG
                if (l.length < 35) continue; // Ligne invalide

                const timeStr = l.substring(1, 7);
                const latStr = l.substring(7, 15);
                const lonStr = l.substring(15, 24);
                // const validFix = l.substring(24, 25);
                const altBaroStr = l.substring(25, 30);
                const altGnssStr = l.substring(30, 35);

                const lat = this._parseCoordinate(latStr, true);
                const lon = this._parseCoordinate(lonStr, false);

                let alt = parseInt(altGnssStr, 10);
                if (isNaN(alt) || alt === 0) alt = parseInt(altBaroStr, 10);

                if (lat !== null && lon !== null) {
                    const hours = parseInt(timeStr.substring(0, 2), 10);
                    const mins = parseInt(timeStr.substring(2, 4), 10);
                    const secs = parseInt(timeStr.substring(4, 6), 10);

                    // Calcul du timestamp absolu (les heures IGC sont toujours en UTC)
                    const pointDate = new Date(baseDate.getTime());
                    pointDate.setUTCHours(hours, mins, secs);

                    if (!firstPointTime) {
                        firstPointTime = pointDate;
                    }

                    if (alt > maxAltitude) maxAltitude = alt;

                    // Heure affichée à l'utilisateur : convertie dans son fuseau local
                    const localTime = `${String(pointDate.getHours()).padStart(2, '0')}:${String(pointDate.getMinutes()).padStart(2, '0')}:${String(pointDate.getSeconds()).padStart(2, '0')}`;

                    trace.push({
                        lat: lat,
                        lon: lon,
                        alt: alt,
                        time: localTime,
                        timestamp: pointDate.getTime(),
                    });
                }
            }
        }

        let dateStr = '';
        if (firstPointTime) {
            // Conversion en heure locale de l'utilisateur (les champs datetime-local attendent une heure locale)
            const yyyy = firstPointTime.getFullYear();
            const mm = String(firstPointTime.getMonth() + 1).padStart(2, '0');
            const dd = String(firstPointTime.getDate()).padStart(2, '0');
            const hh = String(firstPointTime.getHours()).padStart(2, '0');
            const mnm = String(firstPointTime.getMinutes()).padStart(2, '0');
            dateStr = `${yyyy}-${mm}-${dd}T${hh}:${mnm}`;
        }

        const duration = this.calculateDurationMinutes(trace);

        const startAltitude = trace.length > 0 ? trace[0].alt : 0;
        const gain = maxAltitude !== -Infinity ? Math.max(0, Math.round(maxAltitude - startAltitude)) : 0;

        const { distanceKm, maxClimbRate, maxSpeedKmh, avgSpeedKmh } = this._computeFlightStats(trace, duration);

        console.log('Points IGC extraits avec succès :', trace.length);

        return {
            points: trace,
            takeoffIndex: this.detectTakeoffIndex(trace),
            dateStr: dateStr,
            duration: duration,
            maxAltitude: maxAltitude !== -Infinity ? Math.round(maxAltitude) : 0,
            gain: gain,
            distanceKm: distanceKm,
            maxClimbRate: maxClimbRate,
            maxSpeedKmh: maxSpeedKmh,
            avgSpeedKmh: avgSpeedKmh,
        };
    },

    /**
     * Distance en km entre deux points GPS (formule de Haversine). Dupliquée depuis
     * js/utils/geo_utils.js car ce fichier est chargé en script classique (pas en module ES)
     * et ne peut donc pas faire d'import.
     */
    _distanceKm: function (lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((lat1 * Math.PI) / 180) *
                Math.cos((lat2 * Math.PI) / 180) *
                Math.sin(dLon / 2) *
                Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    },

    /**
     * Calcule distance parcourue, vario max et vitesses à partir de la trace déjà parsée.
     * Le vario/vitesse instantanés sont lissés sur une fenêtre de quelques points (WINDOW)
     * pour absorber le bruit GPS/baro typique d'un enregistrement à 1-5s ; sans ce lissage,
     * deux points bruités consécutifs peuvent donner un pic de vario ou de vitesse irréaliste.
     */
    _computeFlightStats: function (trace, durationMinutes) {
        const WINDOW = 3;
        const MAX_PLAUSIBLE_SPEED_KMH = 200; // au-delà, quasi certainement un glitch GPS

        let distanceKm = 0;
        for (let i = 1; i < trace.length; i++) {
            distanceKm += this._distanceKm(trace[i - 1].lat, trace[i - 1].lon, trace[i].lat, trace[i].lon);
        }

        let maxClimbRate = 0;
        let maxSpeedKmh = 0;
        for (let i = WINDOW; i < trace.length; i++) {
            const prev = trace[i - WINDOW];
            const curr = trace[i];
            const dtSec = (curr.timestamp - prev.timestamp) / 1000;
            if (dtSec <= 0) continue;

            const climb = (curr.alt - prev.alt) / dtSec;
            if (climb > maxClimbRate) maxClimbRate = climb;

            const segKm = this._distanceKm(prev.lat, prev.lon, curr.lat, curr.lon);
            const speedKmh = segKm / (dtSec / 3600);
            if (speedKmh > maxSpeedKmh && speedKmh < MAX_PLAUSIBLE_SPEED_KMH) maxSpeedKmh = speedKmh;
        }

        const avgSpeedKmh = durationMinutes > 0 ? distanceKm / (durationMinutes / 60) : 0;

        return {
            distanceKm: Math.round(distanceKm * 10) / 10,
            maxClimbRate: Math.round(maxClimbRate * 10) / 10,
            maxSpeedKmh: Math.round(maxSpeedKmh * 10) / 10,
            avgSpeedKmh: Math.round(avgSpeedKmh * 10) / 10,
        };
    },

    /**
     * Repère le vrai décollage dans la trace. Beaucoup de pilotes allument leur vario au
     * parking ou avant la montée à pied : le premier point de la trace peut alors se trouver à
     * plusieurs kilomètres du décollage. Un pilote en vol se déplace vite (> 15 km/h, hors de
     * portée de la marche) ou monte/descend franchement (> 1,5 m/s) ; on retient le premier
     * point à partir duquel l'une de ces deux conditions tient pendant au moins une minute
     * (fenêtres de 20 s, pour absorber le bruit GPS et la course d'envol).
     *
     * Limite connue : un vario allumé en voiture sera vu « en vol » dès le départ de la
     * voiture. Le point retourné reste alors au départ de la trace, comme avant.
     *
     * @param {Array<{lat:number, lon:number, alt:number, timestamp:number}>} trace
     * @returns {number} Index du décollage (0 si rien de concluant)
     */
    detectTakeoffIndex: function (trace) {
        const WINDOW_MS = 20000;
        const SUSTAIN_MS = 60000;
        const MIN_SPEED_KMH = 15;
        const MIN_VERTICAL_MS = 1.5;
        if (!trace || trace.length < 2) return 0;

        // j avance avec i : premier point au moins WINDOW_MS après trace[i]
        const airborneFrom = [];
        let j = 0;
        for (let i = 0; i < trace.length; i++) {
            if (j <= i) j = i + 1;
            while (j < trace.length && trace[j].timestamp - trace[i].timestamp < WINDOW_MS) j++;
            if (j >= trace.length) {
                airborneFrom.push(false);
                continue;
            }
            const dtSec = (trace[j].timestamp - trace[i].timestamp) / 1000;
            const speedKmh = this._distanceKm(trace[i].lat, trace[i].lon, trace[j].lat, trace[j].lon) / (dtSec / 3600);
            const verticalMs = Math.abs(trace[j].alt - trace[i].alt) / dtSec;
            airborneFrom.push(speedKmh > MIN_SPEED_KMH || verticalMs > MIN_VERTICAL_MS);
        }

        for (let i = 0; i < trace.length; i++) {
            if (!airborneFrom[i]) continue;
            let k = i;
            while (k < trace.length && airborneFrom[k] && trace[k].timestamp - trace[i].timestamp < SUSTAIN_MS) k++;
            if (k < trace.length && trace[k].timestamp - trace[i].timestamp >= SUSTAIN_MS) return i;
            i = k; // la série s'est interrompue avant une minute : on repart après
        }
        return 0;
    },

    /**
     * Convertit une chaîne de coordonnées IGC en degrés décimaux.
     */
    _parseCoordinate: function (coordStr, isLat) {
        try {
            const degLen = isLat ? 2 : 3;
            const deg = parseInt(coordStr.substring(0, degLen), 10);
            const minStr = coordStr.substring(degLen, degLen + 5);
            const min = parseInt(minStr, 10) / 1000;
            const dir = coordStr.substring(degLen + 5, degLen + 6);

            let decimal = deg + min / 60;

            if (dir === 'S' || dir === 'W') {
                decimal = decimal * -1;
            }

            return decimal;
        } catch {
            return null;
        }
    },

    /**
     * Calcule la durée totale en minutes à partir du tableau de trace.
     */
    calculateDurationMinutes: function (trace) {
        if (!trace || trace.length < 2) return 0;
        const first = trace[0];
        const last = trace[trace.length - 1];

        const diffMs = last.timestamp - first.timestamp;
        let diffMinutes = Math.round(diffMs / 60000);

        if (diffMinutes < 0) {
            diffMinutes += 24 * 60;
        }

        return diffMinutes;
    },
};

export default IGCParser;
