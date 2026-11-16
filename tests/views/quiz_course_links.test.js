import { describe, it, expect, afterEach, vi } from 'vitest';
import QuizView from '../../js/views/quiz.js';
import QuizService from '../../js/services/quiz_service.js';
import { choiceSourceHtml, courseLinksHtml } from '../../js/views/quiz_course_links.js';

// Quand plusieurs bonnes réponses relèvent de cours (ou de pages) différents, le retour de correction
// propose un bouton par endroit du cours ; avec une seule source, l'affichage reste celui d'avant.
const ESPACES = 'general/20240409-ffvl-formation-espacesaeriens';
const link = (url, title, page) => ({ url, title, page });

describe('courseLinksHtml', () => {
    it('renders nothing without a link', () => {
        expect(courseLinksHtml([])).toBe('');
        expect(courseLinksHtml(null)).toBe('');
    });

    it('keeps the single "see in the course" button when there is one source', () => {
        const html = courseLinksHtml([link('courses/a.pdf#page=3', 'Cours A', 3)]);
        expect(html.match(/<button/g)).toHaveLength(1);
        expect(html).toContain('VOIR DANS LE COURS');
        expect(html).toContain('data-url="courses/a.pdf#page=3"');
    });

    it('renders one button per course with its title and page when there are several', () => {
        const html = courseLinksHtml([
            link('courses/a.pdf#page=3', 'Cours A', 3),
            link('courses/b.pdf#page=12', 'Cours B', 12),
        ]);
        expect(html.match(/<button/g)).toHaveLength(2);
        expect(html).toContain('data-url="courses/a.pdf#page=3"');
        expect(html).toContain('data-url="courses/b.pdf#page=12"');
        expect(html).toContain('Cours A (p. 3)');
        expect(html).toContain('Cours B (p. 12)');
        expect(html).not.toContain('VOIR DANS LE COURS');
    });

    it('escapes titles and urls', () => {
        const html = courseLinksHtml([
            link('courses/a.pdf#page=1', '<img src=x onerror=alert(1)>', 1),
            link('courses/b.pdf#page=2" onmouseover="alert(1)', 'B', 2),
        ]);
        expect(html).not.toContain('<img');
        expect(html).not.toContain('" onmouseover="');
    });
});

// La page vérifiée vaut pour la question entière. Sous une bonne réponse que la note de fin déclare sans
// source, on n'affiche donc pas le bouton du cours mais la mention d'absence de source.
describe('choiceSourceHtml', () => {
    const links = [link('courses/a.pdf#page=34', 'Cours A', 34)];
    const question = (note) => ({
        choices: [
            { text: 'bonne réponse du cours', pts: 3 },
            { text: 'bonne réponse hors du cours', pts: 3 },
            { text: 'piège', pts: -6 },
        ],
        explication: `raison 1\nraison 2\nraison 3${note ? `\n${note}` : ''}`,
    });

    it('shows the course button under a sourced choice', () => {
        const q = question('Aucune source trouvée pour la réponse « bonne réponse hors du cours ».');
        const html = choiceSourceHtml(links, q, 0);
        expect(html).toContain('COURS · p. 34');
        expect(html).not.toContain('Aucune source');
    });

    it('shows the "no source" mention, and no button, under a choice the note lists', () => {
        const q = question('Aucune source trouvée pour la réponse « bonne réponse hors du cours ».');
        const html = choiceSourceHtml(links, q, 1);
        expect(html).not.toContain('<button');
        expect(html).toContain('Aucune source trouvée pour le moment.');
    });

    it('shows the mention under every choice when the whole question has no source', () => {
        const q = question('Aucune source trouvée pour le moment.');
        expect(choiceSourceHtml([], q, 0)).toContain('Aucune source trouvée pour le moment.');
        expect(choiceSourceHtml([], q, 1)).toContain('Aucune source trouvée pour le moment.');
    });

    it('keeps the buttons when the explanation carries no note', () => {
        expect(choiceSourceHtml(links, question(''), 1)).toContain('COURS · p. 34');
        expect(choiceSourceHtml([], question(''), 1)).toBe('');
    });
});

describe('question bank: course button only under a sourced correct choice', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    it('renders the button under the sourced choice and the mention under the unsourced one', () => {
        const explanations = QuizService.parseExplicationsCSV(
            'code;question;explication\r\nA1V;Question ?;raison du cours\\nraison générale\\nraison du piège\\nAucune source trouvée pour la réponse «\u202fhors du cours\u202f».\r\n',
        );
        const mapping = { A1V: { course_id: ESPACES, verifiedPage: 3 } };
        const [q] = QuizService.parseQuestionsCSV(
            'A1V,Question ?,dans le cours,3,hors du cours,3,piège,-6,,\n',
            explanations,
            mapping,
        );
        vi.spyOn(QuizService, 'getLevelQuestions').mockReturnValue([q]);
        vi.spyOn(QuizView, 'getQuestionByCode').mockReturnValue(q);
        document.body.innerHTML = '<div id="bank-results"></div>';

        QuizView.renderBankContent('ALL');

        const groups = [...document.querySelectorAll('#bank-results .qcm-option-group')];
        expect(groups).toHaveLength(3);
        expect(groups[0].querySelectorAll('button[data-action="openUrl"]')).toHaveLength(1);
        expect(groups[0].textContent).not.toContain('Aucune source');
        expect(groups[1].querySelectorAll('button[data-action="openUrl"]')).toHaveLength(0);
        expect(groups[1].textContent).toContain('Aucune source trouvée pour le moment.');
        expect(groups[2].querySelectorAll('button[data-action="openUrl"]')).toHaveLength(0);
        expect(groups[2].textContent).not.toContain('Aucune source');
    });
});

describe('getCourseLinks', () => {
    afterEach(() => vi.restoreAllMocks());
    const withQuestion = (q) => vi.spyOn(QuizView, 'getQuestionByCode').mockReturnValue(q);

    it('lists the main source then the extra ones, without duplicates', () => {
        withQuestion({
            courseId: ESPACES,
            coursePage: 3,
            extraCourses: [
                { courseId: ESPACES, coursePage: 3 },
                { courseId: ESPACES, coursePage: 9 },
            ],
        });
        const links = QuizView.getCourseLinks('X');
        expect(links.map((l) => l.page)).toEqual([3, 9]);
        expect(links[0].url).toMatch(/\.pdf#page=3$/);
        expect(links[0].title).toBeTruthy();
        expect(QuizView.getCourseUrl('X')).toBe(links[0].url);
    });

    it('skips unknown courses and returns nothing without a verified page', () => {
        withQuestion({ courseId: ESPACES, coursePage: 3, extraCourses: [{ courseId: 'nope/nope', coursePage: 2 }] });
        expect(QuizView.getCourseLinks('X')).toHaveLength(1);
        withQuestion({ courseId: null, coursePage: null, extraCourses: [] });
        expect(QuizView.getCourseLinks('X')).toEqual([]);
        expect(QuizView.getCourseUrl('X')).toBeNull();
        withQuestion(undefined);
        expect(QuizView.getCourseLinks('X')).toEqual([]);
    });
});

describe('question parsing keeps the extra courses', () => {
    const CSV = 'A1V,Question ?,bonne,6,fausse,-6,,,,\n';
    it('exposes the others of the mapping as extraCourses, only with a verified main page', () => {
        const mapping = {
            A1V: {
                course_id: ESPACES,
                verifiedPage: 3,
                others: [{ course_id: 'x/y', verifiedPage: 5 }, { course_id: 'bad' }],
            },
        };
        const [q] = QuizService.parseQuestionsCSV(CSV, {}, mapping);
        expect(q.extraCourses).toEqual([{ courseId: 'x/y', coursePage: 5 }]);
        const [none] = QuizService.parseQuestionsCSV(
            CSV,
            {},
            { A1V: { course_id: ESPACES, others: [{ course_id: 'x/y', verifiedPage: 5 }] } },
        );
        expect(none.extraCourses).toEqual([]);
    });
});
