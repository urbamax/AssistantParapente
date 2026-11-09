import { describe, it, expect } from 'vitest';
import { buildQuestionsHtml } from '../../js/views/quiz_stats_html.js';

describe('buildQuestionsHtml - Questions déjà posées en examen', () => {
    const levelQs = [
        { code: 'A1V', theme: 'Météo', question: 'Question A', choices: [{ text: 'x', pts: 1 }] },
        { code: 'B2V', theme: 'Météo', question: 'Question B', choices: [{ text: 'y', pts: 1 }] },
        { code: 'C3V', theme: 'Pilotage', question: 'Question C', choices: [{ text: 'z', pts: 1 }] },
    ];

    const stats = {
        questions: {
            A1V: { total: 2, correct: 2, streak: 2 },
            B2V: { total: 1, correct: 1, streak: 1 },
            C3V: { total: 0, correct: 0, streak: 0 },
        },
    };

    const levelQuestionEntries = [
        ['A1V', stats.questions.A1V],
        ['B2V', stats.questions.B2V],
        ['C3V', stats.questions.C3V],
    ];

    const mockView = {
        state: { masteryFilter: 'ALL', themeFilter: null, questionSort: 'rate', questionSortDir: 'asc' },
        getQuestionByCode: (code) => levelQs.find((q) => q.code === code),
        getCourseUrl: () => null,
    };

    const exam = (level, codes, day = 1) => ({
        date: `2026-10-0${day}T10:00:00Z`,
        level,
        results: codes.map((code) => ({ code, isCorrect: true })),
    });

    const render = (view, examHistory, currentLevel = 'BI') =>
        buildQuestionsHtml(view, { levelQs, levelQuestionEntries, stats, examHistory, currentLevel });

    const text = (html) =>
        html
            .replace(/<[^>]+>/g, '')
            .replace(/\s+/g, ' ')
            .trim();

    it("n'affiche rien sur les examens tant qu'aucun n'a été passé", () => {
        const html = render(mockView, []);
        expect(text(html)).toContain('3 questions');
        expect(text(html)).not.toContain('déjà posée');
    });

    it('singulier : « dont 1 déjà posée en examen »', () => {
        expect(text(render(mockView, [exam('BI', ['A1V'])]))).toContain('3 questions, dont 1 déjà posée en examen');
    });

    it('pluriel : « dont 2 déjà posées en examen », une question reposée dans plusieurs examens ne compte qu’une fois', () => {
        const html = render(mockView, [exam('BI', ['A1V', 'B2V'], 1), exam('BI', ['A1V'], 2)]);
        expect(text(html)).toContain('dont 2 déjà posées en examen');
    });

    it('filtre par niveau courant (les examens BP ne comptent pas pour BI)', () => {
        const history = [exam('BI', ['A1V'], 1), exam('BP', ['B2V', 'C3V'], 2)];
        expect(text(render(mockView, history, 'BI'))).toContain('dont 1 déjà posée en examen');
        expect(text(render(mockView, history, 'BP'))).toContain('dont 2 déjà posées en examen');
    });

    it("n'affiche rien pour un niveau sans examen", () => {
        expect(text(render(mockView, [exam('BP', ['A1V'])], 'BI'))).not.toContain('déjà posée');
    });

    it('adapte le décompte au filtre de thème actif', () => {
        const viewWithTheme = { ...mockView, state: { ...mockView.state, themeFilter: 'Météo' } };
        const html = render(viewWithTheme, [exam('BI', ['A1V', 'C3V'])]);
        // Questions de météo visibles : A1V et B2V ; seule A1V a été posée en examen.
        expect(text(html)).toContain('2 questions (Thème : Météo), dont 1 déjà posée en examen');
    });
});
