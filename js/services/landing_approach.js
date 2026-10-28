/**
 * SERVICE - Landing approach detector
 * Suggère la prise de terrain d'un vol (« Directe », « En U », « En S », « En huit », les valeurs
 * du champ du carnet) d'après la forme de la trace sur la dernière descente. Fonction pure : le
 * pilote garde toujours le dernier mot, et la détection s'abstient (null) dès que la forme est
 * ambiguë plutôt que de deviner.
 *
 * Principe : on suit le cap (la route au sol, 3 s de recul) depuis le dernier passage à 100 m au-dessus
 * du point de posé jusqu'à 10 m (avant l'arrondi), puis on compte les « virages » : des changements de
 * cap d'un seul sens d'au moins 70°, séparés par un renversement d'au moins 70°. Un virage plus
 * court (un simple ajustement) ne compte pas.
 *  - aucun virage                       → Directe
 *  - un seul virage de 130° à 330°      → En U (étape de base puis finale du même côté)
 *  - deux virages ou plus, de sens alternés → En S, ou En huit si deux d'entre eux font 250° ou plus
 * Limites : « En S » et « En huit » ne se distinguent que par l'amplitude des virages, et la
 * route au sol est faussée par le vent (un 360° dans un fort vent garde un cap qui tourne, mais ses
 * boucles sont déformées). Ne se prononce pas sur un vol qui n'a pas passé 100 m au-dessus du posé
 * ni sur une trace dont le vario a été éteint en vol.
 */

/** Seuils (heuristiques) de la détection, regroupés ici pour être réglés au même endroit. */
export const APPROACH = Object.freeze({
    /** Hauteur au-dessus du posé à partir de laquelle on lit la prise de terrain (m). */
    startHeightM: 100,
    /** Hauteur sous laquelle on s'arrête : l'arrondi et la course d'arrêt ne sont pas la prise de terrain (m). */
    endHeightM: 10,
    /** Recul sur lequel le cap est mesuré : lisse le bruit GPS (s). */
    headingBaselineS: 3,
    /** En dessous, la route au sol n'indique plus un cap (vent debout, arrêt) (km/h). */
    minGroundSpeedKmh: 8,
    /** Durée minimale et maximale de la descente lue (s) : plus long, le pilote soarait ou thermiquait bas. */
    minWindowS: 25,
    maxWindowS: 150,
    /** Amplitude minimale d'un virage, et du renversement qui le sépare du suivant (°). */
    minTurnDeg: 70,
    /** Amplitude à partir de laquelle un virage isolé est une étape de base + finale (« En U ») (°). */
    uMinDeg: 130,
    /** Au-delà, c'est une spirale ou un 360° complet, pas une prise de terrain (°). */
    spiralMinDeg: 330,
    /** Amplitude d'une boucle d'un huit (°). */
    loopMinDeg: 250,
    /** Au-delà, la trace ne ressemble plus à une prise de terrain. */
    maxTurns: 5,
});

/** Distance en mètres entre deux points proches (projection plane). */
function distanceM(a, b) {
    const toRad = Math.PI / 180;
    const dy = (b.lat - a.lat) * 111320;
    const dx = (b.lon - a.lon) * 111320 * Math.cos(a.lat * toRad);
    return Math.hypot(dx, dy);
}

/** Cap en degrés (nord = 0, est = 90) de a vers b. */
function headingDeg(a, b) {
    const toRad = Math.PI / 180;
    return (Math.atan2((b.lon - a.lon) * Math.cos(a.lat * toRad), b.lat - a.lat) * 180) / Math.PI;
}

/** Cap « déroulé » (sans saut de 360°) le long de points[from..to] ; les points trop lents sont ignorés. */
function unwrappedHeadings(points, from, to) {
    const baselineMs = APPROACH.headingBaselineS * 1000;
    const headings = [];
    let j = from;
    for (let k = from; k <= to; k++) {
        if (j <= k) j = k + 1;
        while (j <= to && points[j].timestamp - points[k].timestamp < baselineMs) j++;
        if (j > to) break;
        const seconds = (points[j].timestamp - points[k].timestamp) / 1000;
        if ((distanceM(points[k], points[j]) / seconds) * 3.6 < APPROACH.minGroundSpeedKmh) continue;
        const raw = headingDeg(points[k], points[j]);
        if (headings.length === 0) {
            headings.push(raw);
            continue;
        }
        let delta = raw - (headings[headings.length - 1] % 360);
        while (delta > 180) delta -= 360;
        while (delta < -180) delta += 360;
        headings.push(headings[headings.length - 1] + delta);
    }
    return headings;
}

/**
 * Virages d'une série de caps déroulés : zigzag qui ne retient un extremum qu'après un renversement
 * d'au moins `minTurnDeg`. Retourne les amplitudes signées (+ = à droite), de sens alternés.
 */
export function turnSwings(headings, minTurnDeg = APPROACH.minTurnDeg) {
    const swings = [];
    if (headings.length === 0) return swings;
    let pivot = headings[0];
    let extreme = pivot;
    let direction = 0;
    for (const value of headings) {
        if (direction === 0) {
            if (Math.abs(value - pivot) >= minTurnDeg) {
                direction = Math.sign(value - pivot);
                extreme = value;
            }
        } else if ((value - extreme) * direction > 0) {
            extreme = value;
        } else if ((extreme - value) * direction >= minTurnDeg) {
            swings.push(extreme - pivot);
            pivot = extreme;
            direction = -direction;
            extreme = value;
        }
    }
    if (direction !== 0) swings.push(extreme - pivot);
    return swings;
}

/**
 * @param {Array<{lat:number, lon:number, alt:number, timestamp:number}>} flight le vol, du
 *   décollage au posé (le dernier point est le posé)
 * @param {{endsAirborne?: boolean}} [options] endsAirborne : la trace s'arrête en l'air, le posé est inconnu
 * @returns {{pattern: 'Directe'|'En U'|'En S'|'En huit', turns: number[]}|null} la prise de terrain
 *   suggérée et les virages lus (°, + = à droite), ou null quand la trace ne permet pas de conclure
 */
export function detectLandingApproach(flight, { endsAirborne = false } = {}) {
    if (!flight || flight.length < 10 || endsAirborne) return null;
    const landingAlt = flight[flight.length - 1].alt;
    const height = (p) => p.alt - landingAlt;

    let start = flight.length - 1;
    while (start > 0 && height(flight[start]) < APPROACH.startHeightM) start--;
    if (height(flight[start]) < APPROACH.startHeightM) return null;
    let end = flight.length - 1;
    while (end > start && height(flight[end]) < APPROACH.endHeightM) end--;

    const windowS = (flight[end].timestamp - flight[start].timestamp) / 1000;
    if (windowS < APPROACH.minWindowS || windowS > APPROACH.maxWindowS) return null;

    const headings = unwrappedHeadings(flight, start, end);
    // Trop peu de caps mesurables (vent debout, arrêt) pour lire une forme
    if (headings.length < (end - start + 1) / 2) return null;

    const turns = turnSwings(headings).map(Math.round);
    const sizes = turns.map(Math.abs);
    if (turns.length === 0) return { pattern: 'Directe', turns };
    if (turns.length > APPROACH.maxTurns || sizes.some((s) => s >= APPROACH.spiralMinDeg)) return null;
    if (turns.length === 1) return sizes[0] >= APPROACH.uMinDeg ? { pattern: 'En U', turns } : null;
    const loops = sizes.filter((s) => s >= APPROACH.loopMinDeg).length;
    return { pattern: loops >= 2 ? 'En huit' : 'En S', turns };
}
