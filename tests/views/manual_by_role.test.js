import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import AccessService, { applyRoleVisibility } from '../../js/services/access_service.js';

// Le mode d'emploi ne parle de la météo calculée (js/services/access_service.js, rôle « beta »)
// qu'aux comptes qui y ont droit : pour les autres, ni onglet, ni section, ni phrase.
const INDEX = readFileSync('index.html', 'utf8');
const MANUAL = INDEX.slice(
    INDEX.indexOf('<dialog id="manual-modal"'),
    INDEX.indexOf('</dialog>', INDEX.indexOf('<dialog id="manual-modal"')),
);

// Mots qui n'existent que dans la partie météo calculée (verdict, réglages, modèles, créneaux).
const CALCULATED_WEATHER =
    /prévision|volab|AROME|ICON|GFS|ECMWF|Open-Meteo|rafale|créneau|CAPE\b|Comparer|Mon Matériel|Paramètres de Calcul/i;

let root;
beforeEach(() => {
    document.body.innerHTML = MANUAL.replace('<dialog', '<div').replace(/$/, '</div>');
    root = document.body;
    AccessService.clear();
});
afterEach(() => AccessService.clear());

/** Texte que voit le pilote : tout ce qui n'est pas dans un élément `hidden`. */
function visibleText() {
    const parts = [];
    const walk = (node) => {
        if (node.nodeType === 3) parts.push(node.textContent);
        else if (node.nodeType === 1 && !node.hasAttribute('hidden')) node.childNodes.forEach(walk);
    };
    walk(root);
    return parts.join(' ').replace(/\s+/g, ' ');
}
const isHidden = (selector) => /** @type {HTMLElement} */ (root.querySelector(selector)).closest('[hidden]') !== null;

describe('mode d’emploi sans le rôle « beta »', () => {
    beforeEach(() => applyRoleVisibility(root));

    it('ne mentionne rien de la météo calculée', () => {
        expect(visibleText().match(CALCULATED_WEATHER)?.[0] ?? null).toBeNull();
    });

    it("n'a ni l'onglet ni la section « Calcul Volabilité »", () => {
        expect(isHidden('#manual-tab-scoring')).toBe(true);
        expect(isHidden('#manual-section-scoring')).toBe(true);
    });

    it('garde les autres onglets et les parties sur les sites, avec des numéros qui se suivent', () => {
        for (const tab of ['sites', 'logbook', 'equipment', 'safety', 'qcm', 'library', 'stats'])
            expect(isHidden(`#manual-tab-${tab}`)).toBe(false);
        const text = visibleText();
        expect(text).toContain('1. Point de Référence et Rayon de Recherche');
        expect(text).toContain('2. Fiche Site et Favoris');
        expect(text).toContain('3. Cartographie & Cartes Externes');
        expect(text).not.toContain('5. Fiche Site, Favoris et Comparateur');
    });

    it('garde les phrases de remplacement, sans trou', () => {
        const text = visibleText();
        expect(text).toContain('Ce module présente les sites de vol libre');
        expect(text).toContain(
            "les QCM, le carnet de vol et l'écran Sécurité fonctionnent hors ligne. Les cours déjà ouverts",
        );
    });
});

describe('mode d’emploi avec le rôle « beta » ou « owner »', () => {
    it.each(['beta', 'owner'])('montre tout le détail de la météo calculée (%s)', (role) => {
        AccessService.setRoles('pilote-A', [role]);
        applyRoleVisibility(root);
        expect(isHidden('#manual-tab-scoring')).toBe(false);
        expect(isHidden('#manual-section-scoring')).toBe(false);
        const text = visibleText();
        expect(text).toContain('Paramètres de Calcul Météo');
        expect(text).toContain('5. Fiche Site, Favoris et Comparateur');
        expect(text).toContain('Capture Météo Automatique (Open-Meteo)');
        expect(text).not.toContain('2. Fiche Site et Favoris');
        expect(text).not.toContain('Ce module présente les sites de vol libre');
    });
});
