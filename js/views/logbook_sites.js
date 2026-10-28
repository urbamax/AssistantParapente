/**
 * VIEW - Logbook site lookup
 * Base class of LogbookView (see logbook.js): finding and matching known sites (names,
 * coordinates, nearest take-off, choice list) for the session form. Kept in its own file so
 * logbook.js stays smaller; behaviour is unchanged.
 */
import SitesService from '../services/sites_service.js';
import { escapeHTML } from '../core/security.js';
import { tt } from './logbook_strings.js';
import { LogbookCoordsBase } from './logbook_coords.js';
import { TAKEOFF_SITE_TYPES, isTakeoffSite } from '../services/launch_sites.js';

export class LogbookSitesBase extends LogbookCoordsBase {
    // Site officiel le plus proche d'un point GPS (ex: décollage détecté depuis une trace
    // IGC), dans un rayon raisonnable. Retourne null si aucun site officiel n'est assez proche.
    // Types de sites d'où l'on décolle. Un site uniquement ATTERRO, KITE, GONFLAGE, INTERDIT…
    // ne doit jamais être proposé comme lieu d'un vol importé.
    static TAKEOFF_SITE_TYPES = TAKEOFF_SITE_TYPES;

    // Plusieurs sites connus près du décollage d'une trace (deux décos voisins, treuil et
    // pente…) : le plus proche est pré-rempli, les autres sont proposés en boutons.
    _siteChoices = [];

    normalizeString(str) {
        if (!str) return '';
        return str
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '');
    }

    // Découpe en mots significatifs (≥3 chars) après nettoyage des accents/ponctuation
    normalizeWords(str) {
        if (!str) return [];
        return str
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter((w) => w.length >= 3);
    }

    // Recherche le meilleur site par correspondance de mots-clés
    findSiteByName(siteName) {
        if (!siteName) return null;
        const inputWords = this.normalizeWords(siteName);
        if (inputWords.length === 0) return null;

        let bestMatch = null;
        let bestScore = 0;
        SitesService.getSites().forEach((s) => {
            const siteWords = this.normalizeWords(s.nom || s.name || '');
            const score = inputWords.filter((w) => siteWords.some((sw) => sw.includes(w) || w.includes(sw))).length;
            if (score > bestScore) {
                bestScore = score;
                bestMatch = s;
            }
        });
        return bestScore >= 1 ? bestMatch : null;
    }

    // Extrait lat/lon depuis un site, compatible ancien (lat/lon) et nouveau (latitude/longitude) format
    getSiteCoords(site) {
        if (!site) return { lat: null, lon: null };
        return {
            lat: site.latitude ?? site.lat ?? null,
            lon: site.longitude ?? site.lon ?? null,
        };
    }

    // Distance en km entre deux points (formule de Haversine)
    haversineDistanceKm(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const toRad = (deg) => (deg * Math.PI) / 180;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    isTakeoffSite(site) {
        return isTakeoffSite(site);
    }

    // Rayon de 500 m : au-delà, le site connu le plus proche est souvent un autre décollage
    // que celui d'où l'on est parti.
    /** Sites de décollage connus dans le rayon, du plus proche au plus éloigné. */
    findNearbySites(lat, lon, maxDistanceKm = 0.5) {
        if (lat === null || lon === null) return [];
        const nearby = [];
        SitesService.getSites().forEach((site) => {
            if (!this.isTakeoffSite(site)) return;
            const coords = this.getSiteCoords(site);
            if (coords.lat === null || coords.lon === null) return;
            const dist = this.haversineDistanceKm(lat, lon, coords.lat, coords.lon);
            if (dist <= maxDistanceKm) nearby.push({ site, dist });
        });
        return nearby.sort((a, b) => a.dist - b.dist).map((n) => n.site);
    }

    findNearestSite(lat, lon, maxDistanceKm = 0.5) {
        return this.findNearbySites(lat, lon, maxDistanceKm)[0] || null;
    }

    showSiteChoices(sites) {
        const box = document.getElementById('lb-site-choices');
        if (!box) return;
        this._siteChoices = sites.length > 1 ? sites : [];
        box.hidden = this._siteChoices.length === 0;
        const current = /** @type {HTMLInputElement} */ (document.getElementById('lb-site'))?.value || '';
        box.innerHTML = this._siteChoices.length
            ? `<span>${tt('form.siteChoices')}</span> ` +
              this._siteChoices
                  .map((site, i) => {
                      const name = site.nom || site.name;
                      const active = name === current;
                      return `<button type="button" data-action="pickSiteChoice" data-args="${i}" aria-pressed="${active}" style="margin: 4px 4px 0 0; padding: 2px 8px; border-radius: 12px; cursor: pointer; border: 1px solid var(--accent-orange, #007bc4); background: ${active ? 'var(--accent-orange, #007bc4)' : 'transparent'}; color: ${active ? '#fff' : 'var(--accent-orange, #007bc4)'};">${escapeHTML(name)}</button>`;
                  })
                  .join('')
            : '';
    }

    pickSiteChoice(index) {
        const site = this._siteChoices[parseInt(index, 10)];
        const input = /** @type {HTMLInputElement} */ (document.getElementById('lb-site'));
        if (!site || !input) return;
        input.value = site.nom || site.name;
        this.showSiteChoices(this._siteChoices);
    }
}
