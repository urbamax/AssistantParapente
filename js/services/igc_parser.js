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
                    year += (year < 80) ? 2000 : 1900;
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

                    if (!firstPointTime) {
                        firstPointTime = { h: hours, m: mins };
                    }

                    // Calcul du timestamp absolu
                    const pointDate = new Date(baseDate.getTime());
                    pointDate.setUTCHours(hours, mins, secs);

                    if (alt > maxAltitude) maxAltitude = alt;

                    trace.push({
                        lat: lat,
                        lon: lon,
                        alt: alt,
                        time: `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`,
                        timestamp: pointDate.getTime()
                    });
                }
            }
        }

        let dateStr = "";
        if (firstPointTime) {
            const yyyy = baseDate.getFullYear();
            const mm = String(baseDate.getMonth() + 1).padStart(2, '0');
            const dd = String(baseDate.getDate()).padStart(2, '0');
            const hh = String(firstPointTime.h).padStart(2, '0');
            const mnm = String(firstPointTime.m).padStart(2, '0');
            dateStr = `${yyyy}-${mm}-${dd}T${hh}:${mnm}`;
        }

        const duration = this.calculateDurationMinutes(trace);

        let startAltitude = trace.length > 0 ? trace[0].alt : 0;
        let gain = maxAltitude !== -Infinity ? Math.max(0, Math.round(maxAltitude - startAltitude)) : 0;

        console.log("Points IGC extraits avec succès :", trace.length);

        return {
            points: trace,
            dateStr: dateStr,
            duration: duration,
            maxAltitude: maxAltitude !== -Infinity ? Math.round(maxAltitude) : 0,
            gain: gain
        };
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

            let decimal = deg + (min / 60);

            if (dir === 'S' || dir === 'W') {
                decimal = decimal * -1;
            }

            return decimal;
        } catch (e) {
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
    }
};

window.IGCParser = IGCParser;
