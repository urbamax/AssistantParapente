/**
 * Lien entre un vol du carnet et un site de la base (js/data/sites_data.json).
 *
 * Un vol garde le nom de son site en texte (`site`, ou `lieu` sur les anciens vols) : c'est ce que
 * lisent les statistiques, l'historique et les exports. Quand ce nom est celui d'un site de la base,
 * le vol retient aussi l'identifiant du site (`siteId`, stable même quand la FFVL renomme le terrain).
 * Si le site change de nom, le vol prend le nouveau nom.
 *
 * Un vol encore sans identifiant est relié par son nom : nom actuel d'abord, puis anciens noms
 * (`anciens_noms`, tenus par scripts/import_ffvl_sites.py). Un nom porté par plusieurs sites n'est
 * relié que si la position du vol désigne l'un d'eux sans ambiguïté. Un nom libre (lieu hors base)
 * reste tel quel.
 *
 * Fonctions pures, sans état : le catalogue est passé par l'appelant.
 */
import { calculateDistance } from '../utils/geo_utils.js';

// Au-delà, la position du vol ne départage pas deux sites du même nom.
const NEAREST_SITE_MAX_KM = 5;

/**
 * Clé de comparaison d'un nom de site : sans casse, sans accents, ponctuation et espaces réduits.
 * @param {unknown} name
 * @returns {string}
 */
export function siteNameKey(name) {
    return String(name ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, ' ')
        .trim();
}

/** Nom tel qu'il s'affiche, à la casse et aux espaces près (accents et ponctuation comptent). */
function displayKey(name) {
    return String(name ?? '')
        .split(/\s+/)
        .filter(Boolean)
        .join(' ')
        .toUpperCase();
}

/** Nom affiché d'un vol (champ `site`, ou `lieu` sur les anciens enregistrements). */
function flightSiteName(flight) {
    return typeof flight.site === 'string' && flight.site.trim() ? flight.site : flight.lieu || '';
}

/**
 * Index du catalogue, à construire une fois par catalogue.
 * @param {Array<any>} sites
 */
export function buildSiteIndex(sites) {
    /** @type {Map<string, any>} */
    const byId = new Map();
    /** @type {Map<string, any[]>} */
    const byName = new Map();
    /** @type {Map<string, any[]>} */
    const byFormerName = new Map();
    const add = (map, key, site) => {
        if (!key) return;
        const list = map.get(key);
        if (!list) map.set(key, [site]);
        else if (!list.includes(site)) list.push(site);
    };
    for (const site of Array.isArray(sites) ? sites : []) {
        if (!site || site.id === undefined || site.id === null || !site.nom) continue;
        byId.set(String(site.id), site);
        add(byName, siteNameKey(site.nom), site);
        for (const former of Array.isArray(site.anciens_noms) ? site.anciens_noms : []) {
            add(byFormerName, siteNameKey(former), site);
        }
    }
    return { byId, byName, byFormerName };
}

/** Parmi plusieurs sites du même nom, celui que la position du vol désigne, ou null. */
function pickByPosition(candidates, flight) {
    if (candidates.length === 1) return candidates[0];
    if (!Number.isFinite(flight.lat) || !Number.isFinite(flight.lon)) return null;
    let best = null;
    let bestKm = Infinity;
    let tie = false;
    for (const site of candidates) {
        const km = calculateDistance(flight.lat, flight.lon, site.latitude ?? site.lat, site.longitude ?? site.lon);
        if (km < bestKm) {
            best = site;
            bestKm = km;
            tie = false;
        } else if (km === bestKm) {
            tie = true;
        }
    }
    return best && !tie && bestKm <= NEAREST_SITE_MAX_KM ? best : null;
}

/**
 * Site de la base auquel un vol se rattache, ou null.
 * @param {any} flight
 * @param {ReturnType<typeof buildSiteIndex>} index
 */
export function findFlightSite(flight, index) {
    if (!flight || typeof flight !== 'object') return null;
    if (flight.siteId !== undefined && flight.siteId !== null && flight.siteId !== '') {
        return index.byId.get(String(flight.siteId)) || null;
    }
    const key = siteNameKey(flightSiteName(flight));
    if (!key) return null;
    const current = index.byName.get(key);
    if (current) return pickByPosition(current, flight);
    const former = index.byFormerName.get(key);
    return former ? pickByPosition(former, flight) : null;
}

/**
 * Nom à donner au vol : le nom actuel du site, en capitales si le vol l'avait écrit en capitales
 * (c'est la forme que propose la saisie du carnet).
 */
function renamedSiteName(previous, siteName) {
    const name = String(siteName).trim();
    return previous && previous === previous.toUpperCase() ? name.toUpperCase() : name;
}

/**
 * Relie les vols à leur site et leur donne le nom actuel du site. Modifie les vols en place.
 * `updatedAt` ne bouge pas : chaque appareil refait le même calcul, et un vol importé puis
 * seulement renommé ainsi n'est pas compté comme modifié depuis son import.
 * @param {Array<any>} flights
 * @param {Array<any>} sites
 * @returns {number} nombre de vols modifiés
 */
export function linkFlightsToSites(flights, sites) {
    if (!Array.isArray(flights) || !Array.isArray(sites) || sites.length === 0) return 0;
    const index = buildSiteIndex(sites);
    let changed = 0;
    for (const flight of flights) {
        const site = findFlightSite(flight, index);
        if (!site) continue;
        let modified = false;
        const id = String(site.id);
        if (flight.siteId !== id) {
            flight.siteId = id;
            modified = true;
        }
        const previous = flightSiteName(flight);
        if (displayKey(previous) !== displayKey(site.nom)) {
            const name = renamedSiteName(previous, site.nom);
            if (typeof flight.site === 'string' && flight.site.trim()) flight.site = name;
            else if (flight.lieu) flight.lieu = name;
            else flight.site = name;
            modified = true;
        }
        if (modified) changed++;
    }
    return changed;
}
