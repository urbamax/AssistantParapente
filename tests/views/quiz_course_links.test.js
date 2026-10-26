import { describe, it, expect, afterEach, vi } from 'vitest';
import QuizView from '../../js/views/quiz.js';
import QuizService from '../../js/services/quiz_service.js';
import { courseLinksHtml } from '../../js/views/quiz_course_links.js';

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
