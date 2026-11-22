import { describe, it, expect } from 'vitest';
import { buildRevisionAxesDashboardHtml } from '../../js/views/quiz_axes_html.js';

// Spec 062 : l'écran « Axes de révision » dit ce que compte chaque chiffre, n'emploie pas un mot pour
// deux choses, suit l'ordre Lire → Comprendre → Vérifier et replie les chapitres.

const errors = (active = 0, consolidating = 0, overcome = 0, items = []) => ({
    active,
    consolidating,
    overcome,
    items,
});
const axis = (id, status, extra = {}) => ({
    id,
    status,
    category: 'Météo',
    title: `Titre ${id}`,
    subtitle: `Sous-titre ${id}`,
    totalQuestions: 10,
    attemptedCount: 10,
    masteryPct: 80,
    strugglingCount: 0,
    hesitantCount: 0,
    dueCount: 0,
    unattemptedCount: 0,
    masteredCount: 10,
    traps: errors(),
    omissions: errors(),
    courseReadings: [],
    takeaways: [],
    workshopSize: 6,
    ...extra,
});
const report = (axes) => {
    const counts = { ALL: axes.length, BLOCKER: 0, REFRESH: 0, EXPLORE: 0, MASTERED: 0 };
    const trapTotals = { active: 0, consolidating: 0, overcome: 0, axes: 0 };
    const omissionTotals = { active: 0, consolidating: 0, overcome: 0, axes: 0 };
    for (const a of axes) {
        counts[a.status] += 1;
        for (const [tot, e] of [
            [trapTotals, a.traps],
            [omissionTotals, a.omissions],
        ]) {
            tot.active += e.active;
            tot.consolidating += e.consolidating;
            tot.overcome += e.overcome;
            if (e.active > 0) tot.axes += 1;
        }
    }
    return { level: 'BP', axes, counts, trapTotals, omissionTotals };
};

const AXES = [
    axis('a1', 'BLOCKER', {
        strugglingCount: 1,
        hesitantCount: 11,
        traps: errors(1, 4, 5, [{ status: 'active', count: 1, questionNum: 'A1B', explanation: 'À retenir.' }]),
    }),
    axis('a2', 'BLOCKER', { hesitantCount: 1, omissions: errors(0, 2) }),
    axis('a3', 'REFRESH', { masteryPct: 99, omissions: errors(0, 2) }),
    axis('m1', 'MASTERED', { title: 'Facteurs humains' }),
    axis('m2', 'MASTERED', { title: 'Milieu naturel' }),
];
const html = (ui = {}, axes = AXES) => buildRevisionAxesDashboardHtml(report(axes), ui);

describe('spec 062 : vocabulaire et chiffres', () => {
    it('gives each priority one name, on the filters and on the cards, and keeps « consolidation » for errors', () => {
        const page = html();
        expect(page).toContain('Priorité 1 · À retravailler (2)');
        expect(page).toContain('Priorité 2 · À entretenir (1)');
        expect((page.match(/Priorité 1 · À retravailler</g) || []).length).toBe(2);
        expect(page).not.toMatch(/Points à consolider|Acquis à rafraîchir|Blocages &amp; hésitations/);
    });

    it('splits the filters into two labelled rows that count chapters', () => {
        const page = html();
        expect(page).toContain('aria-label="Chapitres"');
        expect(page).toContain('aria-label="Chapitres avec erreurs"');
        expect(page).toContain('Tous (3)');
        expect(page).toContain('À corriger (1)');
    });

    it('hides an error filter that keeps every chapter, unless it is selected', () => {
        expect(html()).not.toContain('data-args="CONSOLIDATING"');
        expect(html({ statusFilter: 'CONSOLIDATING' })).toContain('data-args="CONSOLIDATING" aria-pressed="true"');
    });

    it('counts omissions in the « À corriger » filter', () => {
        const page = html({}, [
            axis('a1', 'BLOCKER', { omissions: errors(1) }),
            axis('a2', 'BLOCKER', { hesitantCount: 1 }),
        ]);
        expect(page).toContain('À corriger (1)');
    });

    it('says how many chapters the errors of the box come from', () => {
        expect(html()).toContain('À revoir : 5 pièges et 4 oublis dans 3 chapitres');
    });

    it('says why each chapter is in its priority', () => {
        const page = html();
        expect(page).toContain('Pourquoi Priorité 1 : 1 blocage, 11 hésitations, 1 piège à corriger.');
        expect(page).toContain('Pourquoi Priorité 2 : 2 oublis en consolidation.');
    });

    it('explains every term once the page guide is open', () => {
        expect(html()).toContain('Comment lire cette page');
        expect(html()).not.toContain('revision-axes-guide-list');
        const open = html({ expandedIds: new Set(['guide']) });
        for (const term of ['Priorité 1 · À retravailler', 'blocage', 'hésitation', 'En consolidation', 'Surmonté']) {
            expect(open).toContain(term);
        }
        expect(open).toContain('les filtres comptent des chapitres');
    });
});

describe('spec 062 : une méthode, dans l’ordre', () => {
    const reading = (title, focusHitCount) => ({
        title,
        primaryUrl: `${title}.pdf#page=1`,
        pageRangesText: '1',
        pageLinks: [{ page: 1, url: `${title}.pdf#page=1` }],
        focusHitCount,
    });

    it('announces a 6-question workshop in the method box', () => {
        expect(html()).toContain('atelier de 6 questions');
        expect(html()).not.toContain('5 à 8 questions');
    });

    it('orders a card Read → Understand → Check, without a gap in the numbering', () => {
        const withErrors = html({ expandedIds: new Set(['card:a1']) });
        const card = withErrors.slice(withErrors.indexOf('data-axis-id="a1"'));
        const read = card.indexOf('Étape 1 —');
        const understand = card.indexOf('Étape 2 — Comprendre');
        const check = card.indexOf('Étape 3 — Vérifier');
        expect(read).toBeGreaterThan(-1);
        expect(understand).toBeGreaterThan(read);
        expect(check).toBeGreaterThan(understand);

        const bare = html({}, [axis('b1', 'REFRESH', { dueCount: 2 })]);
        expect(bare).toContain('Étape 2 — Vérifier');
        expect(bare).not.toContain('Étape 3');
    });

    it('marks only the first manual as the one to read first', () => {
        const page = html({}, [
            axis('a1', 'BLOCKER', {
                hesitantCount: 1,
                courseReadings: [reading('A', 3), reading('B', 2), reading('C', 1)],
            }),
        ]);
        expect((page.match(/À lire en premier/g) || []).length).toBe(1);
    });
});

describe('spec 062 : une liste courte', () => {
    it('folds every card by default and opens one with card:<id>', () => {
        const folded = html();
        expect((folded.match(/class="revision-axis-card-body" hidden/g) || []).length).toBe(3);
        expect(folded).toContain('aria-expanded="false"');
        const open = html({ expandedIds: new Set(['card:a2']) });
        expect((open.match(/class="revision-axis-card-body" hidden/g) || []).length).toBe(2);
        expect(open).toContain('data-axis-id="a2" data-axis-status="BLOCKER" data-open="true"');
    });

    it('names the hidden mastered chapters', () => {
        expect(html()).toContain('2 chapitres maîtrisés masqués : Facteurs humains, Milieu naturel.');
        expect(html({}, [axis('a1', 'BLOCKER', { hesitantCount: 1 })])).not.toContain('maîtrisés masqués');
    });
});
