/**
 * Sites d'où l'on décolle : types retenus et recherche d'un décollage connu près d'un point GPS.
 * Fonctions pures, sans état : le catalogue est passé par l'appelant.
 */
import { calculateDistance } from '../utils/geo_utils.js';

// Un site uniquement ATTERRO, KITE, GONFLAGE, INTERDIT… n'est jamais un lieu de décollage.
export const TAKEOFF_SITE_TYPES = ['NATUREL', 'TREUIL', 'SOARING', 'THERMIQUE', 'DUNE', 'PENTE-ÉCOLE', 'MARCHE ET VOL'];

export function isTakeoffSite(site) {
    if (!site || site.affiche === false) return false;
    const types = Array.isArray(site.type) ? site.type : [site.type];
    return types.some((t) => TAKEOFF_SITE_TYPES.includes(t));
}

/**
 * Vrai si le point est à moins de `maxKm` d'un site de décollage connu.
 * @param {Array} sites catalogue (SitesService.getSites())
 */
export function isNearKnownTakeoff(sites, lat, lon, maxKm) {
    if (!Array.isArray(sites)) return false;
    return sites.some((site) => {
        if (!isTakeoffSite(site)) return false;
        const sLat = site.latitude ?? site.lat;
        const sLon = site.longitude ?? site.lon;
        return sLat != null && sLon != null && calculateDistance(lat, lon, sLat, sLon) <= maxKm;
    });
}
