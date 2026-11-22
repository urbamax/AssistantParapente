import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import AccessService, { applyRoleVisibility } from '../../js/services/access_service.js';

// Spec 053 : le mode d'emploi décrit l'application telle qu'elle est (contracts/manual-content.md).
// Chaque onglet doit parler des fonctions visibles du pilote et ne plus rien dire de dépassé.
const MANUAL_FILE = readFileSync('components/manual_modal.html', 'utf8');
const MANUAL = MANUAL_FILE.slice(0, MANUAL_FILE.lastIndexOf('</dialog>'));

// Même liste que tests/views/manual_by_role.test.js : mots propres à la météo calculée.
const CALCULATED_WEATHER =
    /prévision|volab|AROME|ICON|GFS|ECMWF|rafale|créneau|CAPE\b|Comparer|Mon Matériel|Paramètres de Calcul/i;

let root;

/** Monte le mode d'emploi et applique les rôles donnés (aucun rôle : pilote non connecté). */
function mount(roles = []) {
    document.body.innerHTML = MANUAL.replace('<dialog', '<div').replace(/$/, '</div>');
    root = document.body;
    AccessService.clear();
    if (roles.length) AccessService.setRoles('pilote-test', roles);
    applyRoleVisibility(root);
}

/** Texte visible d'un onglet (tout ce qui n'est pas dans un élément `hidden`). */
function visibleText(tab) {
    const section = root.querySelector(`#manual-section-${tab}`);
    if (!section || section.closest('[hidden]')) return '';
    const parts = [];
    const walk = (node) => {
        if (node.nodeType === 3) parts.push(node.textContent);
        else if (node.nodeType === 1 && !node.hasAttribute('hidden')) node.childNodes.forEach(walk);
    };
    walk(section);
    return parts.join(' ').replace(/\s+/g, ' ');
}

const ALL_TABS = [
    'about',
    'dashboard',
    'sites',
    'scoring',
    'logbook',
    'equipment',
    'safety',
    'qcm',
    'library',
    'stats',
];
const allVisibleText = () => ALL_TABS.map(visibleText).join(' ');

afterEach(() => AccessService.clear());

describe('spec 053 – US1 : chaque fonction visible est décrite (pilote non connecté)', () => {
    beforeEach(() => mount());

    it('Général explique comment installer l’application, y compris sur iPhone et iPad', () => {
        const text = visibleText('dashboard');
        expect(text).toMatch(/Installer l'application/);
        expect(text).toMatch(/iPhone/);
        expect(text).toMatch(/Sur l'écran d'accueil/);
    });

    it('Général présente le formulaire de retours', () => {
        expect(visibleText('dashboard')).toMatch(/Signaler un problème \/ Suggestion/);
    });

    it('Général présente le serveur Discord', () => {
        expect(visibleText('dashboard')).toMatch(/Discord/);
    });

    it('Sécurité décrit la fiche ICE, ses données de santé et la copie en ligne avec accord sur chaque appareil', () => {
        const text = visibleText('safety');
        expect(text).toMatch(/Fiche ICE/);
        expect(text).toMatch(/étiquette/i);
        expect(text).toMatch(/données de santé/);
        expect(text).toMatch(/uniquement sur cet appareil/);
        expect(text).toMatch(/Sauvegarde en ligne \(facultative\)/);
        expect(text).toMatch(/sur chaque appareil/);
        expect(text).toMatch(/Supprimer ma fiche en ligne/);
    });

    it('QCM explique les sigles des explications et leur source', () => {
        const text = visibleText('qcm');
        expect(text).toMatch(/sigle/i);
        expect(text).toMatch(/source/i);
    });

    it('Carnet de Vol dit qu’un vol prend le nouveau nom de son site', () => {
        expect(visibleText('logbook')).toMatch(/renomm/);
    });

    it('Bibliothèque cite les textes officiels de la FFVL et le guide du parachute de secours', () => {
        const text = visibleText('library');
        expect(text).toMatch(/statuts/i);
        expect(text).toMatch(/chartes?/i);
        expect(text).toMatch(/parachute de secours/i);
    });
});

describe('spec 053 – US2 : rien de dépassé', () => {
    for (const roles of [[], ['beta'], ['owner']]) {
        it(`ne garde aucune phrase dépassée (rôles : ${roles.join(', ') || 'aucun'})`, () => {
            mount(roles);
            const text = allVisibleText();
            expect(text).not.toMatch(/trois rubriques/);
            expect(text).not.toMatch(/pour que vous puissiez recharger la page/);
            expect(text).not.toMatch(/À découvrir, Maîtrisé/);
        });
    }

    it('Général dit que la mise à jour est obligatoire, avec « Mettre à jour »', () => {
        mount();
        const text = visibleText('dashboard');
        expect(text).toMatch(/Mettre à jour/);
        expect(text).toMatch(/obligatoire/);
    });

    it('Sécurité annonce quatre rubriques', () => {
        mount();
        expect(visibleText('safety')).toMatch(/quatre rubriques/);
    });

    it('Statistiques explique les filtres combinés et l’entraînement sur la sélection', () => {
        mount();
        const text = visibleText('stats');
        expect(text).toMatch(/plusieurs/);
        expect(text).toMatch(/dans la sélection/);
        expect(text).toMatch(/S'entraîner sur ces/);
        expect(text).toMatch(/Retour aux statistiques/);
    });

    it('QCM dit que les chapitres maîtrisés n’apparaissent plus dans les axes de révision', () => {
        mount();
        expect(visibleText('qcm')).toMatch(/chapitres maîtrisés/);
    });
});

describe('spec 053 – US3 : chaque rôle voit son mode d’emploi', () => {
    it('sans rôle, aucun texte ne parle de la météo calculée ni des sites', () => {
        mount();
        // La capture automatique de la météo d'un vol (carnet) reste visible de tous.
        root.querySelector('.ri-cloud-windy-line').parentElement.remove();
        expect(allVisibleText().match(CALCULATED_WEATHER)?.[0] ?? null).toBeNull();
        expect(visibleText('sites')).toBe('');
        expect(visibleText('scoring')).toBe('');
    });

    it('avec « owner », la partie Sites de vol est visible', () => {
        mount(['owner']);
        expect(visibleText('sites')).toMatch(/Point de Référence et Rayon de Recherche/);
    });
});

describe('spec 055 : les modes du QCM décrits comme dans l’application', () => {
    for (const roles of [[], ['beta'], ['owner']]) {
        it(`ne garde aucune ancienne description des modes (rôles : ${roles.join(', ') || 'aucun'})`, () => {
            mount(roles);
            const text = allVisibleText();
            expect(text).not.toMatch(/50 ?%, 75 ?% ou 100 ?%/);
            expect(text).not.toMatch(/1, 3, 7, 14 puis 30/);
            expect(text).not.toMatch(/10, 20, 30, 40 ou TOUTES/);
        });
    }

    it('Perfectionnement : palier réglable au curseur, maîtrise sur les 10 dernières réponses', () => {
        mount();
        const text = visibleText('qcm');
        expect(text).toMatch(/Palier objectif/);
        expect(text).toMatch(/Maîtrise actuelle/);
        expect(text).toMatch(/10 dernières réponses/);
    });

    it('Révision : 1 jour, puis 6 jours, puis des intervalles qui s’allongent', () => {
        mount();
        expect(visibleText('qcm')).toMatch(/1 jour, puis 6 jours/);
    });

    it('Nombre de questions : curseur de 5 à 50, dernière position = toutes', () => {
        mount();
        expect(visibleText('qcm')).toMatch(/de 5 à 50/);
    });
});

describe('spec 057 : pas d’icône décorative dans l’encadré « À propos »', () => {
    it('l’encadré du haut garde son titre et son texte, sans icône', () => {
        mount();
        const card = root.querySelector('#manual-section-about > div');
        expect(card.querySelector('i')).toBeNull();
        expect(card.textContent).toMatch(/Assistant Parapente/);
        expect(card.textContent).toMatch(/100% Gratuit/i);
    });
});

describe('spec 059 : la suppression du compte est décrite comme dans l’application', () => {
    it('Général explique « Supprimer mon compte » dans l’Espace Synchro, son caractère définitif et les données de l’appareil', () => {
        mount();
        const text = allVisibleText();
        expect(text).toMatch(/Espace Synchro, puis Supprimer mon compte/);
        expect(text).toMatch(/définitif/);
        expect(text).toMatch(/données de cet appareil restent/);
        expect(text).not.toMatch(/supprimer à tout moment depuis l'Espace Synchro ou en contactant/);
    });
});

describe('spec 059 : la politique de confidentialité indique comment supprimer son compte', () => {
    const LEGAL = readFileSync('components/legal_modals.html', 'utf8');
    it('§4 renvoie au bouton « Supprimer mon compte » et non plus à une demande à l’éditeur', () => {
        expect(LEGAL).toMatch(/Supprimer mon compte/);
        expect(LEGAL).not.toMatch(/demander la suppression définitive de votre compte et de ses données à tout moment en\s+nous contactant/);
    });
});
