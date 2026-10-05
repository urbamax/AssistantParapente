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

        // 2. Extraire les enregistrements B
        // Altitude GPS si le fichier en contient, sinon celle du baromètre. Le choix vaut pour toute
        // la trace : une altitude GPS de 0 m est une vraie valeur (vol au bord de la mer), et passer
        // ce point-là sur le baromètre, souvent décalé de plus de 100 m faute de calage, créait des
        // sauts d'altitude et des varios de +40 m/s.
        const bLines = lines.map((line) => line.trim()).filter((l) => l.startsWith('B') && l.length >= 35);
        const hasGnssAltitude = bLines.some((l) => {
            const gnss = parseInt(l.substring(30, 35), 10);
            return !isNaN(gnss) && gnss !== 0;
        });
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

                const altGnss = parseInt(altGnssStr, 10);
                const altBaro = parseInt(altBaroStr, 10);
                const alt = hasGnssAltitude && !isNaN(altGnss) ? altGnss : isNaN(altBaro) ? altGnss : altBaro;

                if (lat !== null && lon !== null) {
                    const hours = parseInt(timeStr.substring(0, 2), 10);
                    const mins = parseInt(timeStr.substring(2, 4), 10);
                    const secs = parseInt(timeStr.substring(4, 6), 10);

                    // Calcul du timestamp absolu (les heures IGC sont toujours en UTC)
                    const pointDate = new Date(baseDate.getTime());
                    pointDate.setUTCHours(hours, mins, secs);

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

        // Les statistiques portent sur le vol seul, du décollage à l'atterrissage : ni la
        // montée à pied ou l'attente au déco, ni le retour vers la voiture. La trace complète
        // reste dans `points` (affichage 3D, export).
        const takeoffIndex = this.detectTakeoffIndex(trace);
        let landingIndex = this.detectLandingIndex(trace);
        if (landingIndex <= takeoffIndex) landingIndex = trace.length - 1;
        const flight = trace.slice(takeoffIndex, landingIndex + 1);

        let dateStr = '';
        if (flight.length > 0) {
            // Conversion en heure locale de l'utilisateur (les champs datetime-local attendent une heure locale)
            const takeoffTime = new Date(flight[0].timestamp);
            const yyyy = takeoffTime.getFullYear();
            const mm = String(takeoffTime.getMonth() + 1).padStart(2, '0');
            const dd = String(takeoffTime.getDate()).padStart(2, '0');
            const hh = String(takeoffTime.getHours()).padStart(2, '0');
            const mnm = String(takeoffTime.getMinutes()).padStart(2, '0');
            dateStr = `${yyyy}-${mm}-${dd}T${hh}:${mnm}`;
        }

        const duration = this.calculateDurationMinutes(flight);

        const maxAltitude = flight.reduce((max, p) => (p.alt > max ? p.alt : max), -Infinity);
        const startAltitude = flight.length > 0 ? flight[0].alt : 0;
        const gain = maxAltitude !== -Infinity ? Math.max(0, Math.round(maxAltitude - startAltitude)) : 0;

        const { distanceKm, maxClimbRate, maxSpeedKmh, avgSpeedKmh } = this._computeFlightStats(flight, duration);
        const analysis = this.analyzeFlight(flight);

        console.log('Points IGC extraits avec succès :', trace.length);

        return {
            points: trace,
            takeoffIndex: takeoffIndex,
            landingIndex: trace.length > 0 ? landingIndex : 0,
            dateStr: dateStr,
            duration: duration,
            maxAltitude: maxAltitude !== -Infinity ? Math.round(maxAltitude) : 0,
            gain: gain,
            distanceKm: distanceKm,
            maxClimbRate: maxClimbRate,
            maxSpeedKmh: maxSpeedKmh,
            avgSpeedKmh: avgSpeedKmh,
            analysis: analysis,
            instrument: this.parseInstrument(lines),
        };
    },

    /**
     * Instrument qui a enregistré la trace, lu dans l'en-tête de l'IGC (enregistrement A et
     * lignes H). Syride ne met pas son numéro de série dans l'enregistrement A mais dans le champ
     * « classe de compétition » (HFCCL) : on le prend là quand c'est un numéro.
     * @param {string[]} lines lignes du fichier IGC
     * @returns {{manufacturer?:string, brand?:string, model?:string, firmware?:string,
     *   hardware?:string, gps?:string, pressureSensor?:string, serial?:string}|null}
     */
    // Codes fabricant (enregistrement A) les plus courants en vol libre
    IGC_MANUFACTURERS: {
        XSR: 'Syride',
        FLY: 'Flymaster',
        XCT: 'XC Tracer',
        XCS: 'XCSoar',
        FLA: 'FLARM',
        LXN: 'LX Navigation',
        NKL: 'Naviter',
        XGD: 'Gpsdump',
        XSK: 'Skytraxx',
        XFH: 'Flytec',
        XBR: 'Bräuniger',
    },

    parseInstrument: function (lines) {
        const header = {};
        let aRecord = '';
        for (const raw of lines || []) {
            const line = raw.trim();
            if (line.startsWith('B')) break; // fin de l'en-tête
            if (line.startsWith('A') && !aRecord) aRecord = line.slice(1);
            const h = line.match(/^H[FOP]([A-Z]{3})(.*)$/);
            if (!h || header[h[1]] !== undefined) continue;
            // Format « HFRFWFIRMWAREVERSION: 3.42 » (avec libellé) ou ancien format « HFRFW3.42 »
            const rest = h[2];
            const value = rest.includes(':') ? rest.slice(rest.indexOf(':') + 1) : rest;
            header[h[1]] = value.trim();
        }
        const clean = (v) => (v && !/^(not set|unknown|-|0)$/i.test(v) ? v.replace(/\s*,\s*/g, ', ') : undefined);
        const manufacturer = aRecord.slice(0, 3) || undefined;
        const aSerial = aRecord.slice(3).replace(/[^A-Za-z0-9]/g, '');
        const cclSerial = /^\d{6,}$/.test(header.CCL || '') ? header.CCL : '';
        // « Syride, SYS'Nav » : marque puis modèle ; sinon marque d'après le code fabricant
        const type = clean(header.FTY) || '';
        const comma = type.indexOf(',');
        const brand = comma > 0 ? type.slice(0, comma).trim() : this.IGC_MANUFACTURERS[manufacturer];
        const model = comma > 0 ? type.slice(comma + 1).trim() : type;
        const instrument = {
            manufacturer,
            brand: brand || undefined,
            model: model || undefined,
            firmware: clean(header.RFW),
            hardware: clean(header.RHW),
            gps: clean(header.GPS),
            pressureSensor: clean(header.PRS),
            serial: aSerial || cclSerial || undefined,
        };
        Object.keys(instrument).forEach((k) => instrument[k] === undefined && delete instrument[k]);
        return Object.keys(instrument).length ? instrument : null;
    },

    /** Cap en degrés (0 = nord, sens horaire) de a vers b. */
    _bearing: function (a, b) {
        const toRad = Math.PI / 180;
        const dLon = (b.lon - a.lon) * toRad;
        const y = Math.sin(dLon) * Math.cos(b.lat * toRad);
        const x =
            Math.cos(a.lat * toRad) * Math.sin(b.lat * toRad) -
            Math.sin(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.cos(dLon);
        return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
    },

    /**
     * Analyse détaillée du vol (décollage → atterrissage) : thermiques, transitions, finesse,
     * distances de type « cross », altitudes et vario. Les altitudes sont celles du vario,
     * sans la correction éventuelle du pilote (à ajouter à l'affichage).
     *
     * Thermiques : un pilote qui enroule tourne d'au moins ~200° en 20 s (≥ 10°/s en moyenne,
     * un 360 prend 20 à 30 s). Les phases de spirale de moins de 20 s sont ignorées, les
     * transitions de moins de 15 s entre deux spirales sont rattachées au thermique. Un thermique
     * n'est compté que s'il fait monter.
     *
     * @param {Array<{lat:number, lon:number, alt:number, timestamp:number}>} flight
     * @returns {Object|null}
     */
    analyzeFlight: function (flight) {
        if (!flight || flight.length < 3) return null;
        const round1 = (x) => Math.round(x * 10) / 10;
        const dist = (a, b) => this._distanceKm(a.lat, a.lon, b.lat, b.lon);

        // Échantillons espacés d'au moins 2 s : assez fin pour suivre un 360, moins sensible au bruit
        const S = [];
        for (const p of flight) {
            if (S.length === 0 || p.timestamp - S[S.length - 1].timestamp >= 2000) S.push(p);
        }
        const n = S.length;
        if (n < 3) return null;
        const first = S[0];
        const last = flight[flight.length - 1];
        const durationS = (last.timestamp - first.timestamp) / 1000;

        // --- Altitudes et dénivelé cumulé (pas de 10 s pour ne pas cumuler le bruit) ---
        let minAlt = Infinity;
        let maxAlt = -Infinity;
        for (const p of flight) {
            if (p.alt < minAlt) minAlt = p.alt;
            if (p.alt > maxAlt) maxAlt = p.alt;
        }
        let cumulativeClimb = 0;
        let prev = flight[0];
        for (const p of flight) {
            if (p.timestamp - prev.timestamp < 10000 && p !== last) continue;
            if (p.alt > prev.alt) cumulativeClimb += p.alt - prev.alt;
            prev = p;
        }

        // --- Taux de chute max (fenêtre de ~5 s, comme le vario max) ---
        let maxSinkRate = 0;
        for (let i = 0, j = 0; i < flight.length; i++) {
            while (j < flight.length && flight[j].timestamp - flight[i].timestamp < 5000) j++;
            if (j >= flight.length) break;
            const v = (flight[j].alt - flight[i].alt) / ((flight[j].timestamp - flight[i].timestamp) / 1000);
            if (v < maxSinkRate) maxSinkRate = v;
        }

        // --- Virages : variation de cap entre segments successifs (signée, + = à droite) ---
        const headings = [];
        for (let k = 0; k < n - 1; k++) {
            headings.push(dist(S[k], S[k + 1]) * 1000 < 2 ? null : this._bearing(S[k], S[k + 1]));
        }
        const dh = new Array(n).fill(0); // variation de cap au point k
        for (let k = 1; k < n - 1; k++) {
            if (headings[k] === null || headings[k - 1] === null) continue;
            let d = headings[k] - headings[k - 1];
            if (d > 180) d -= 360;
            if (d < -180) d += 360;
            dh[k] = d;
        }
        // Facteur de charge estimé en virage : accélération centripète v·ω, lissée sur 3 points
        // (vitesse sol : sans le vent réel, c'est une estimation ; un capteur fait mieux).
        let estimatedMaxG = 1;
        for (let k = 2; k < n - 2; k++) {
            const dtS = (S[k + 2].timestamp - S[k - 2].timestamp) / 1000;
            if (dtS <= 0) continue;
            const omega = (((dh[k - 1] + dh[k] + dh[k + 1]) / 3) * Math.PI) / 180 / (dtS / 4);
            let pathM = 0;
            for (let m = k - 1; m <= k + 2; m++) pathM += dist(S[m - 1], S[m]) * 1000;
            const v = pathM / dtS;
            const gLoad = Math.sqrt(1 + ((v * omega) / 9.81) ** 2);
            if (gLoad > estimatedMaxG) estimatedMaxG = gLoad;
        }

        const prefix = [0];
        for (let k = 0; k < n; k++) prefix.push(prefix[k] + dh[k]);
        const circling = new Array(n).fill(false);
        for (let k = 0, lo = 0, hi = 0; k < n; k++) {
            while (S[k].timestamp - S[lo].timestamp > 10000) lo++;
            if (hi < k) hi = k;
            while (hi + 1 < n && S[hi + 1].timestamp - S[k].timestamp <= 10000) hi++;
            circling[k] = Math.abs(prefix[hi + 1] - prefix[lo]) >= 200;
        }

        // Phases (spirale / transition), en lissant les phases trop courtes
        let runs = [];
        for (let k = 0; k < n; k++) {
            const r = runs[runs.length - 1];
            if (r && r.circling === circling[k]) r.end = k;
            else runs.push({ circling: circling[k], start: k, end: k });
        }
        const runSeconds = (r) => (S[r.end].timestamp - S[r.start].timestamp) / 1000;
        const merged = [];
        for (const r of runs) {
            const prevRun = merged[merged.length - 1];
            const tooShort = r.circling ? runSeconds(r) < 20 : runSeconds(r) < 15 && prevRun && prevRun.circling;
            if (prevRun && (tooShort || prevRun.circling === r.circling)) prevRun.end = r.end;
            else merged.push({ ...r, circling: tooShort ? !r.circling : r.circling });
        }
        runs = merged;

        // --- Thermiques ---
        let thermalCount = 0;
        let thermalSeconds = 0;
        let thermalGainTotal = 0;
        let bestThermalClimb = 0;
        let maxThermalGain = 0;
        let turnsLeft = 0;
        let turnsRight = 0;
        for (const r of runs) {
            if (!r.circling) continue;
            const secs = runSeconds(r);
            const turned = prefix[r.end + 1] - prefix[r.start];
            const turns = Math.floor(Math.abs(turned) / 360);
            if (turned > 0) turnsRight += turns;
            else turnsLeft += turns;
            const gainM = S[r.end].alt - S[r.start].alt;
            if (secs < 20 || gainM <= 0) continue;
            thermalCount++;
            thermalSeconds += secs;
            thermalGainTotal += gainM;
            bestThermalClimb = Math.max(bestThermalClimb, gainM / secs);
            maxThermalGain = Math.max(maxThermalGain, gainM);
        }

        // --- Transitions et finesse ---
        // Phases en ligne droite d'au moins 30 s, découpées en tranches de ~30 s : seules les
        // tranches où l'on descend vraiment (≥ 0,5 m/s) comptent, sinon le vol de pente ou une
        // ascendance en ligne droite donneraient des finesses absurdes.
        let glideKm = 0;
        let glideLoss = 0;
        let glideSeconds = 0;
        let bestGlideRatio = 0;
        for (const r of runs) {
            if (r.circling || runSeconds(r) < 30) continue;
            let runKm = 0;
            let runLoss = 0;
            let runSecs = 0;
            let chunkStart = r.start;
            for (let k = r.start + 1; k <= r.end; k++) {
                const secs = (S[k].timestamp - S[chunkStart].timestamp) / 1000;
                if (secs < 30 && k < r.end) continue;
                const loss = S[chunkStart].alt - S[k].alt;
                if (secs > 0 && loss / secs >= 0.5) {
                    for (let m = chunkStart + 1; m <= k; m++) runKm += dist(S[m - 1], S[m]);
                    runLoss += loss;
                    runSecs += secs;
                }
                chunkStart = k;
            }
            glideKm += runKm;
            glideLoss += runLoss;
            glideSeconds += runSecs;
            if (runSecs >= 60 && runLoss >= 30) bestGlideRatio = Math.max(bestGlideRatio, (runKm * 1000) / runLoss);
        }

        // --- Distances ---
        const straightKm = dist(first, last);
        let maxFromTakeoffKm = 0;
        for (const p of S) maxFromTakeoffKm = Math.max(maxFromTakeoffKm, dist(first, p));
        // Distance libre (départ, 3 points de contournement, arrivée), comme les classements
        // de cross : programmation dynamique sur ~300 points.
        const step = Math.max(1, Math.ceil(n / 300));
        const P = S.filter((_, k) => k % step === 0);
        if (P[P.length - 1] !== S[n - 1]) P.push(S[n - 1]);
        let layer = new Array(P.length).fill(0);
        for (let leg = 0; leg < 4; leg++) {
            const next = new Array(P.length).fill(0);
            for (let j = 0; j < P.length; j++) {
                let best = 0;
                for (let i = 0; i <= j; i++) {
                    const v = layer[i] + dist(P[i], P[j]);
                    if (v > best) best = v;
                }
                next[j] = best;
            }
            layer = next;
        }
        const freeDistanceKm = Math.max(...layer);

        return {
            takeoffAlt: Math.round(first.alt),
            landingAlt: Math.round(last.alt),
            minAlt: Math.round(minAlt),
            maxAltAboveTakeoff: Math.round(maxAlt - first.alt),
            cumulativeClimb: Math.round(cumulativeClimb),
            maxSinkRate: round1(maxSinkRate),
            avgVario: durationS > 0 ? Math.round(((last.alt - first.alt) / durationS) * 100) / 100 : 0,
            thermalCount,
            thermalMinutes: Math.round(thermalSeconds / 60),
            thermalPercent: durationS > 0 ? Math.round((thermalSeconds / durationS) * 100) : 0,
            avgThermalClimb: thermalSeconds > 0 ? round1(thermalGainTotal / thermalSeconds) : 0,
            bestThermalClimb: round1(bestThermalClimb),
            maxThermalGain: Math.round(maxThermalGain),
            turnsLeft,
            turnsRight,
            glideRatio: glideLoss > 0 ? round1((glideKm * 1000) / glideLoss) : null,
            bestGlideRatio: bestGlideRatio > 0 ? round1(bestGlideRatio) : null,
            glideSpeedKmh: glideSeconds > 0 ? round1(glideKm / (glideSeconds / 3600)) : null,
            straightDistanceKm: round1(straightKm),
            maxFromTakeoffKm: round1(maxFromTakeoffKm),
            freeDistanceKm: round1(freeDistanceKm),
            estimatedMaxG: round1(estimatedMaxG),
            winch: this.detectWinchTow(flight),
        };
    },

    /**
     * Repère un départ au treuil : dans les 30 s qui suivent le décollage, une montée soutenue
     * (≥ 1,5 m/s en moyenne, au moins 30 s et 80 m) en ligne quasi droite (distance directe
     * ≥ 85 % du chemin parcouru), qui s'arrête net au largage. Un départ de pente commence par
     * descendre, un thermique s'enroule : ni l'un ni l'autre ne coche ces cases.
     *
     * @param {Array<{lat:number, lon:number, alt:number, timestamp:number}>} flight vol seul
     * @returns {{towSeconds:number, releaseAlt:number, releaseHeight:number, avgClimb:number,
     *   maxClimb:number, towDistanceKm:number, releaseIndex:number}|null}
     */
    detectWinchTow: function (flight) {
        if (!flight || flight.length < 10) return null;
        const t0 = flight[0].timestamp;
        // Vario sur les 10 s suivant chaque point
        const climbAhead = (i) => {
            let j = i;
            while (j < flight.length - 1 && flight[j].timestamp - flight[i].timestamp < 10000) j++;
            const dt = (flight[j].timestamp - flight[i].timestamp) / 1000;
            return dt > 0 ? (flight[j].alt - flight[i].alt) / dt : 0;
        };

        let start = -1;
        for (let i = 0; i < flight.length && flight[i].timestamp - t0 <= 30000; i++) {
            if (climbAhead(i) >= 1) {
                start = i;
                break;
            }
        }
        if (start < 0) return null;

        // Fin de la montée : le vario sur 10 s passe sous 0,3 m/s ; le largage est le point le
        // plus haut atteint jusqu'à 10 s après
        let end = start;
        while (end < flight.length - 1 && climbAhead(end) >= 0.3) end++;
        // (la voile continue de monter quelques secondes sur son élan après le largage)
        let release = start;
        for (let k = start; k < flight.length && flight[k].timestamp - flight[end].timestamp <= 10000; k++) {
            if (flight[k].alt > flight[release].alt) release = k;
        }

        const towSeconds = (flight[release].timestamp - flight[start].timestamp) / 1000;
        const gain = flight[release].alt - flight[start].alt;
        if (towSeconds < 30 || gain < 80 || gain / towSeconds < 1.5) return null;

        let pathKm = 0;
        for (let k = start + 1; k <= release; k++) {
            pathKm += this._distanceKm(flight[k - 1].lat, flight[k - 1].lon, flight[k].lat, flight[k].lon);
        }
        const straightKm = this._distanceKm(
            flight[start].lat,
            flight[start].lon,
            flight[release].lat,
            flight[release].lon,
        );
        if (pathKm <= 0 || straightKm / pathKm < 0.85) return null;

        let maxClimb = 0;
        for (let i = start, j = start; i <= release; i++) {
            while (j < release && flight[j].timestamp - flight[i].timestamp < 5000) j++;
            const dt = (flight[j].timestamp - flight[i].timestamp) / 1000;
            if (dt >= 3) maxClimb = Math.max(maxClimb, (flight[j].alt - flight[i].alt) / dt);
        }

        return {
            towSeconds: Math.round(towSeconds),
            releaseAlt: Math.round(flight[release].alt),
            releaseHeight: Math.round(flight[release].alt - flight[0].alt),
            avgClimb: Math.round((gain / towSeconds) * 10) / 10,
            maxClimb: Math.round(maxClimb * 10) / 10,
            towDistanceKm: Math.round(pathKm * 100) / 100,
            releaseIndex: release,
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
     * La vitesse est mesurée sur le chemin parcouru (points espacés d'au moins 5 s) et non sur
     * le seul écart entre les deux bouts de la fenêtre : en virage serré (8 d'approche,
     * enroulement de thermique) le pilote revient presque à son point de départ en 20 s et
     * serait sinon vu « au sol », ce qui coupait la fin du vol et faussait l'altitude
     * d'atterrissage.
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
            const speedKmh = this._pathKm(trace, i, j) / (dtSec / 3600);
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
     * Longueur en km du chemin de trace[from] à trace[to], en ne retenant que des points espacés
     * d'au moins 5 s : suit les virages sans cumuler le bruit GPS d'un pilote immobile.
     */
    _pathKm: function (trace, from, to) {
        const MIN_STEP_MS = 5000;
        let km = 0;
        let prev = trace[from];
        for (let k = from + 1; k <= to; k++) {
            if (k < to && trace[k].timestamp - prev.timestamp < MIN_STEP_MS) continue;
            km += this._distanceKm(prev.lat, prev.lon, trace[k].lat, trace[k].lon);
            prev = trace[k];
        }
        return km;
    },

    /**
     * Repère le vrai atterrissage : même critère que le décollage, appliqué en partant de la
     * fin de la trace. Coupe la marche vers la voiture quand le vario n'a pas été éteint
     * après le posé. Retourne le dernier index si rien de concluant.
     * @param {Array<{lat:number, lon:number, alt:number, timestamp:number}>} trace
     * @returns {number}
     */
    detectLandingIndex: function (trace) {
        if (!trace || trace.length < 2) return Math.max(0, (trace?.length || 0) - 1);
        // Trace inversée, horodatage retourné pour rester croissant.
        const reversed = [...trace].reverse().map((p) => ({ ...p, timestamp: -p.timestamp }));
        return trace.length - 1 - this.detectTakeoffIndex(reversed);
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
