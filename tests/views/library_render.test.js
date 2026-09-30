import { describe, it, expect, beforeEach, vi } from 'vitest';
import GlobalState from '../../js/core/app_state.js';
import LibraryView from '../../js/views/manual.js';

// Spec 021 : les textes de la bibliothèque passent dans le catalogue sans rien changer à
// l'affichage. Instantanés enregistrés AVANT le déplacement.
const COURSES = {
    a: { title: 'Aérologie', category: 'Météo', level: ['BI', 'BP'], pdf: 'a.pdf' },
    b: { title: 'Facteurs humains', category: 'Général', level: 'GENERAL', pdf: 'b.pdf' },
    c: { title: 'Treuil', category: 'Autre', level: 'TREUIL', pdf: 'c.pdf' },
    d: { title: 'Pilotage', category: 'Pilotage', level: 'BPC', pdf: 'd.pdf' },
};

beforeEach(() => {
    document.body.innerHTML = '<div id="library-screen"><div id="library-results"></div></div>';
    LibraryView.state.courses = COURSES;
    LibraryView.state.search = '';
    vi.spyOn(GlobalState, 'get').mockReturnValue('ALL');
});

const results = () => document.getElementById('library-results').innerHTML;

describe('library renders (spec 021: identical before and after moving the texts)', () => {
    it.each([['CATEGORY'], ['LEVEL'], ['TITLE']])('sorted by %s', (sort) => {
        LibraryView.state.sort = sort;
        LibraryView.render();
        expect(results()).toMatchSnapshot();
    });

    it('no result', () => {
        LibraryView.state.search = 'introuvable';
        LibraryView.render();
        expect(results()).toMatchSnapshot();
    });
});
