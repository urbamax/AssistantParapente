import { describe, it, expect } from 'vitest';
import { buildQuestionsHtml } from '../../js/views/quiz_stats_html.js';

describe('buildQuestionsHtml - Affichage des questions posées en examen', () => {
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

    it('affiche "dont 0 posée en examen sur 0 examen réalisé" quand aucun examen n’a été passé', () => {
        const html = buildQuestionsHtml(mockView, {
            levelQs,
            levelQuestionEntries,
            stats,
            examHistory: [],
            currentLevel: 'BI',
        });

        expect(html).toContain('3</span> questions');
        expect(html).toContain(
            'dont <span style="font-weight:700; color:var(--text-main);">0</span> posée en examen sur <span style="font-weight:700; color:var(--text-main);">0</span> examen réalisé',
        );
    });

    it('affiche le singulier "dont 1 posée en examen sur 1 examen réalisé"', () => {
        const examHistory = [
            {
                date: '2026-10-01T10:00:00Z',
                level: 'BI',
                results: [{ code: 'A1V', isCorrect: true }],
            },
        ];

        const html = buildQuestionsHtml(mockView, {
            levelQs,
            levelQuestionEntries,
            stats,
            examHistory,
            currentLevel: 'BI',
        });

        expect(html).toContain(
            'dont <span style="font-weight:700; color:var(--text-main);">1</span> posée en examen sur <span style="font-weight:700; color:var(--text-main);">1</span> examen réalisé',
        );
    });

    it('gère singulier questions et pluriel examens : "dont 1 posée en examen sur 2 examens réalisés"', () => {
        const examHistory = [
            {
                date: '2026-10-01T10:00:00Z',
                level: 'BI',
                results: [{ code: 'A1V', isCorrect: true }],
            },
            {
                date: '2026-10-02T10:00:00Z',
                level: 'BI',
                results: [{ code: 'A1V', isCorrect: true }],
            },
        ];

        const html = buildQuestionsHtml(mockView, {
            levelQs,
            levelQuestionEntries,
            stats,
            examHistory,
            currentLevel: 'BI',
        });

        expect(html).toContain(
            'dont <span style="font-weight:700; color:var(--text-main);">1</span> posée en examen sur <span style="font-weight:700; color:var(--text-main);">2</span> examens réalisés',
        );
    });

    it('gère pluriel questions et singulier examens : "dont 2 posées en examen sur 1 examen réalisé"', () => {
        const examHistory = [
            {
                date: '2026-10-01T10:00:00Z',
                level: 'BI',
                results: [
                    { code: 'A1V', isCorrect: true },
                    { code: 'B2V', isCorrect: true },
                ],
            },
        ];

        const html = buildQuestionsHtml(mockView, {
            levelQs,
            levelQuestionEntries,
            stats,
            examHistory,
            currentLevel: 'BI',
        });

        expect(html).toContain(
            'dont <span style="font-weight:700; color:var(--text-main);">2</span> posées en examen sur <span style="font-weight:700; color:var(--text-main);">1</span> examen réalisé',
        );
    });

    it('gère pluriel questions et pluriel examens : "dont 2 posées en examen sur 3 examens réalisés"', () => {
        const examHistory = [
            {
                date: '2026-10-01T10:00:00Z',
                level: 'BI',
                results: [{ code: 'A1V', isCorrect: true }],
            },
            {
                date: '2026-10-02T10:00:00Z',
                level: 'BI',
                results: [{ code: 'B2V', isCorrect: true }],
            },
            {
                date: '2026-10-03T10:00:00Z',
                level: 'BI',
                results: [{ code: 'A1V', isCorrect: true }],
            },
        ];

        const html = buildQuestionsHtml(mockView, {
            levelQs,
            levelQuestionEntries,
            stats,
            examHistory,
            currentLevel: 'BI',
        });

        expect(html).toContain(
            'dont <span style="font-weight:700; color:var(--text-main);">2</span> posées en examen sur <span style="font-weight:700; color:var(--text-main);">3</span> examens réalisés',
        );
    });

    it('filtre bien par niveau courant (isole les examens BP de BI)', () => {
        const examHistory = [
            {
                date: '2026-10-01T10:00:00Z',
                level: 'BI',
                results: [{ code: 'A1V', isCorrect: true }],
            },
            {
                date: '2026-10-02T10:00:00Z',
                level: 'BP',
                results: [
                    { code: 'B2V', isCorrect: true },
                    { code: 'C3V', isCorrect: true },
                ],
            },
        ];

        const htmlBI = buildQuestionsHtml(mockView, {
            levelQs,
            levelQuestionEntries,
            stats,
            examHistory,
            currentLevel: 'BI',
        });

        expect(htmlBI).toContain(
            'dont <span style="font-weight:700; color:var(--text-main);">1</span> posée en examen sur <span style="font-weight:700; color:var(--text-main);">1</span> examen réalisé',
        );

        const htmlBP = buildQuestionsHtml(mockView, {
            levelQs,
            levelQuestionEntries,
            stats,
            examHistory,
            currentLevel: 'BP',
        });

        expect(htmlBP).toContain(
            'dont <span style="font-weight:700; color:var(--text-main);">2</span> posées en examen sur <span style="font-weight:700; color:var(--text-main);">1</span> examen réalisé',
        );
    });

    it('adapte le décompte des questions posées au filtre de thème actif', () => {
        const examHistory = [
            {
                date: '2026-10-01T10:00:00Z',
                level: 'BI',
                results: [
                    { code: 'A1V', isCorrect: true }, // Thème Météo
                    { code: 'C3V', isCorrect: true }, // Thème Pilotage
                ],
            },
        ];

        const viewWithTheme = {
            ...mockView,
            state: { ...mockView.state, themeFilter: 'Météo' },
        };

        const html = buildQuestionsHtml(viewWithTheme, {
            levelQs,
            levelQuestionEntries,
            stats,
            examHistory,
            currentLevel: 'BI',
        });

        // Visible questions en météo: A1V et B2V (2 questions)
        // Seule A1V a été posée en examen
        expect(html).toContain('2</span> questions');
        expect(html).toContain('(Thème : Météo)');
        expect(html).toContain(
            'dont <span style="font-weight:700; color:var(--text-main);">1</span> posée en examen sur <span style="font-weight:700; color:var(--text-main);">1</span> examen réalisé',
        );
    });

    it('affiche le badge EF (Facteur de Facilité SM-2) si la question a un easeFactor', () => {
        const statsWithEf = {
            questions: {
                A1V: { total: 2, correct: 2, streak: 2, easeFactor: 2.6 },
                B2V: { total: 1, correct: 1, streak: 1 },
                C3V: { total: 0, correct: 0, streak: 0 },
            },
        };
        const entriesWithEf = [
            ['A1V', statsWithEf.questions.A1V],
            ['B2V', statsWithEf.questions.B2V],
            ['C3V', statsWithEf.questions.C3V],
        ];
        const html = buildQuestionsHtml(mockView, {
            levelQs,
            levelQuestionEntries: entriesWithEf,
            stats: statsWithEf,
            examHistory: [],
            currentLevel: 'BI',
        });
        expect(html).toContain('EF 2.6');
        expect(html).toContain('Facteur de facilité');
    });
});
