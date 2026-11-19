import { describe, expect, it } from 'vitest';
import { buildSiteIndex, findFlightSite, linkFlightsToSites, siteNameKey } from '../../js/services/flight_site_link.js';

const SITES = [
    {
        id: 'planfait-1001',
        nom: 'PLANFAIT — Déco Sud',
        anciens_noms: ['PLANFAIT DECO SUD', 'Planfait'],
        latitude: 45.86,
        longitude: 6.2,
    },
    { id: 'semnoz-1', nom: 'SEMNOZ', latitude: 45.8, longitude: 6.1 },
    { id: 'semnoz-2', nom: 'SEMNOZ', latitude: 45.9, longitude: 6.5 },
    { id: 'lumbin-7', nom: 'Lumbin atterro', latitude: 45.3, longitude: 5.9 },
];

describe('siteNameKey', () => {
    it('ignore la casse, les accents, la ponctuation et les espaces', () => {
        expect(siteNameKey('  Planfait — déco  sud ')).toBe('PLANFAIT DECO SUD');
        expect(siteNameKey(null)).toBe('');
    });
});

describe('findFlightSite', () => {
    const index = buildSiteIndex(SITES);

    it('retrouve le site par son identifiant, même si le vol porte un autre nom', () => {
        expect(findFlightSite({ site: 'Ailleurs', siteId: 'lumbin-7' }, index)?.id).toBe('lumbin-7');
    });

    it('retrouve le site par son nom actuel, puis par un ancien nom', () => {
        expect(findFlightSite({ site: 'LUMBIN ATTERRO' }, index)?.id).toBe('lumbin-7');
        expect(findFlightSite({ site: 'PLANFAIT' }, index)?.id).toBe('planfait-1001');
    });

    it('ne relie un nom porté par plusieurs sites que si la position du vol les départage', () => {
        expect(findFlightSite({ site: 'SEMNOZ' }, index)).toBeNull();
        expect(findFlightSite({ site: 'SEMNOZ', lat: 45.801, lon: 6.101 }, index)?.id).toBe('semnoz-1');
        expect(findFlightSite({ site: 'SEMNOZ', lat: 47, lon: 3 }, index)).toBeNull();
    });

    it('laisse un lieu hors base sans site', () => {
        expect(findFlightSite({ site: 'Prairie du voisin' }, index)).toBeNull();
        expect(findFlightSite({ site: '' }, index)).toBeNull();
    });

    it('ne rattache pas à un autre site un vol dont le site a disparu de la base', () => {
        expect(findFlightSite({ site: 'SEMNOZ', siteId: 'supprime-9' }, index)).toBeNull();
    });
});

describe('linkFlightsToSites', () => {
    it('donne au vol le nom actuel de son site, en capitales comme la saisie du carnet', () => {
        const flight = { id: 'a', site: 'PLANFAIT DECO SUD', updatedAt: 5 };
        expect(linkFlightsToSites([flight], SITES)).toBe(1);
        expect(flight).toEqual({ id: 'a', site: 'PLANFAIT — DÉCO SUD', siteId: 'planfait-1001', updatedAt: 5 });
    });

    it('garde la casse du pilote quand il ne tapait pas en capitales', () => {
        const flight = { site: 'Planfait' };
        linkFlightsToSites([flight], SITES);
        expect(flight.site).toBe('PLANFAIT — Déco Sud');
    });

    it('suit un renommage ultérieur du site grâce à son identifiant', () => {
        const flight = { site: 'LUMBIN ATTERRO' };
        linkFlightsToSites([flight], SITES);
        const renamed = SITES.map((s) => (s.id === 'lumbin-7' ? { ...s, nom: 'Lumbin — atterrissage officiel' } : s));
        expect(linkFlightsToSites([flight], renamed)).toBe(1);
        expect(flight).toMatchObject({ site: 'LUMBIN — ATTERRISSAGE OFFICIEL', siteId: 'lumbin-7' });
    });

    it('renomme le champ `lieu` des anciens vols', () => {
        const flight = { lieu: 'PLANFAIT' };
        linkFlightsToSites([flight], SITES);
        expect(flight).toMatchObject({ lieu: 'PLANFAIT — DÉCO SUD', siteId: 'planfait-1001' });
        expect(flight.site).toBeUndefined();
    });

    it('ne touche ni aux vols déjà à jour ni aux lieux hors base, et ne fait rien sans catalogue', () => {
        const upToDate = { site: 'LUMBIN ATTERRO', siteId: 'lumbin-7' };
        const free = { site: 'Prairie du voisin' };
        expect(linkFlightsToSites([upToDate, free], SITES)).toBe(0);
        expect(free).toEqual({ site: 'Prairie du voisin' });
        expect(linkFlightsToSites([{ site: 'PLANFAIT' }], [])).toBe(0);
    });
});
