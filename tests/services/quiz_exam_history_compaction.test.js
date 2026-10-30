import { describe, it, expect, beforeEach, vi } from 'vitest';
import QuizService, { compactExam, compactExamResult, isExamBloated } from '../../js/services/quiz_service.js';
import StorageService from '../../js/services/storage.js';
import { FirebaseAuthEngine } from '../../js/services/firebase_service.js';
import QuizView from '../../js/views/quiz.js';
import GlobalState from '../../js/core/app_state.js';

describe('Quiz Exam History Compaction & Migration', () => {
    const mockQuestions = [
        {
            code: 'E52V',
            question: "L'assiette est l'angle entre :",
            theme: 'Mécavol',
            choices: [
                { text: "le plan de l'aile et l'horizontale", pts: 6 },
                { text: "le plan de l'aile et le vent relatif", pts: -6 },
                { text: "le vent relatif et l'horizontale", pts: -6 },
            ],
            explication: "C'est l'angle entre le plan du profil...",
            courseId: 'brevet-initial---vert/06-mecanique-du-vol2021',
            coursePage: 1,
            niveau: 0,
            parapente: true,
        },
        {
            code: 'P10B',
            question: 'En virage engagé, que faire ?',
            theme: 'Pilotage',
            choices: [
                { text: 'Contrer à la sellette', pts: 6 },
                { text: 'Accélérer à fond', pts: -6 },
            ],
            explication: 'Il faut dissiper la spirale...',
            courseId: 'brevet-pilote/virage',
            coursePage: 2,
            niveau: 1,
            parapente: true,
        },
    ];

    beforeEach(() => {
        localStorage.clear();
        QuizService.setQuestions(mockQuestions);
        QuizService.state.examResults = [];
        QuizService.state.examSaved = false;
        QuizService.state.qcmSessionData = [];
    });

    it('compactExamResult strips the full question object, choices, and explanations', () => {
        const bloatedResult = {
            theme: 'Mécavol',
            question: mockQuestions[0],
            selected: [{ text: "le plan de l'aile et l'horizontale", pts: 6 }],
            isCorrect: true,
        };

        const compacted = compactExamResult(bloatedResult, (code) => QuizService.getQuestionByCode(code));

        expect(compacted).toEqual({
            code: 'E52V',
            isCorrect: true,
            selected: [0], // Index 0 in canonical choices
        });

        // Ensure heavy fields are completely gone
        expect(compacted.theme).toBeUndefined();
        expect(compacted.question).toBeUndefined();
        expect(compacted.choices).toBeUndefined();
        expect(compacted.explication).toBeUndefined();
        expect(compacted.courseId).toBeUndefined();
    });

    it('compactExamResult handles multiple selections and canonical index matching', () => {
        const result = {
            code: 'E52V',
            theme: 'Mécavol',
            isCorrect: false,
            selected: [
                { text: "le vent relatif et l'horizontale", pts: -6 },
                { text: "le plan de l'aile et l'horizontale", pts: 6 },
            ],
        };

        const compacted = compactExamResult(result, (code) => QuizService.getQuestionByCode(code));
        expect(compacted.selected).toEqual([2, 0]);
        expect(compacted.isCorrect).toBe(false);
        expect(compacted.theme).toBeUndefined();
    });

    it('compactExam reduces payload size by ~90% for typical exams', () => {
        const bloatedResults = Array.from({ length: 30 }, (_, i) => ({
            theme: 'Mécavol',
            question: {
                ...mockQuestions[0],
                code: `E${i}V`,
                question: `Long question text ${i} with detailed context and diagrams`,
                explication: `Detailed explanation paragraph for question ${i} with flight mechanics rules`,
            },
            selected: [{ text: "le plan de l'aile et l'horizontale", pts: 6 }],
            isCorrect: true,
        }));

        const exam = {
            id: 'exam_12345',
            date: '2026-10-30T12:00:00.000Z',
            level: 'BI',
            score: 30,
            total: 30,
            percentage: 100,
            passed: true,
            invalidated: false,
            results: bloatedResults,
        };

        const beforeJson = JSON.stringify(exam);
        const compacted = compactExam(exam, (_code) => mockQuestions[0]);
        const afterJson = JSON.stringify(compacted);

        expect(afterJson.length).toBeLessThan(beforeJson.length * 0.2); // At least 80% reduction
        expect(compacted.results[0].question).toBeUndefined();
        expect(compacted.results[0].theme).toBeUndefined();
        expect(compacted.results[0].code).toBe('E0V');
    });

    it('isExamBloated detects legacy bloated results with full question objects, choice objects, or redundant themes', () => {
        const cleanExam = {
            id: '1',
            results: [{ code: 'E52V', isCorrect: true, selected: [0] }],
        };
        const bloatedThemeExam = {
            id: '2',
            results: [{ code: 'E52V', theme: 'Mécavol', isCorrect: true, selected: [0] }],
        };
        const bloatedQuestionExam = {
            id: '3',
            results: [{ question: mockQuestions[0], selected: [0], isCorrect: true }],
        };
        const bloatedSelectedExam = {
            id: '4',
            results: [{ code: 'E52V', selected: [{ text: 'opt', pts: 6 }], isCorrect: true }],
        };

        expect(isExamBloated(cleanExam)).toBe(false);
        expect(isExamBloated(bloatedThemeExam)).toBe(true);
        expect(isExamBloated(bloatedQuestionExam)).toBe(true);
        expect(isExamBloated(bloatedSelectedExam)).toBe(true);
    });

    it('QuizService.saveExamHistory saves compact results without question objects in StorageService', () => {
        QuizService.state.examResults = [
            {
                question: mockQuestions[0],
                selected: [mockQuestions[0].choices[0]],
                isCorrect: true,
            },
            {
                question: mockQuestions[1],
                selected: [mockQuestions[1].choices[1]],
                isCorrect: false,
            },
        ];

        QuizService.saveExamHistory('BI');

        const saved = StorageService.get(StorageService.KEYS.EXAM_HISTORY);
        expect(saved.exams).toHaveLength(1);
        const exam = saved.exams[0];
        expect(exam.score).toBe(1);
        expect(exam.total).toBe(2);
        expect(exam.results).toEqual([
            { code: 'E52V', isCorrect: true, selected: [0] },
            { code: 'P10B', isCorrect: false, selected: [1] },
        ]);
    });

    it('QuizService.getExamHistory migrates existing bloated exams in localStorage', () => {
        const legacyExam = {
            id: 'exam_old',
            date: '2026-10-15T10:00:00.000Z',
            level: 'BI',
            score: 1,
            total: 1,
            results: [
                {
                    theme: 'Mécavol',
                    question: mockQuestions[0],
                    selected: [{ text: "le plan de l'aile et l'horizontale", pts: 6 }],
                    isCorrect: true,
                },
            ],
        };
        StorageService.set(StorageService.KEYS.EXAM_HISTORY, { exams: [legacyExam] });

        const history = QuizService.getExamHistory();
        expect(history).toHaveLength(1);
        expect(history[0].results[0]).toEqual({
            code: 'E52V',
            isCorrect: true,
            selected: [0],
        });

        // Verify StorageService was updated in place
        const updatedStorage = StorageService.get(StorageService.KEYS.EXAM_HISTORY);
        expect(updatedStorage.exams[0].results[0].question).toBeUndefined();
        expect(updatedStorage.exams[0].results[0].theme).toBeUndefined();
    });

    it('FirebaseAuthEngine.mergeExamHistory compacts cloud and local exams and limits to 20', () => {
        const cloudBloated = {
            exams: [
                {
                    id: 'exam_cloud',
                    date: '2026-10-20T12:00:00.000Z',
                    results: [
                        {
                            question: mockQuestions[0],
                            selected: [{ text: "le plan de l'aile et l'horizontale", pts: 6 }],
                            isCorrect: true,
                        },
                    ],
                },
            ],
        };
        const localClean = {
            exams: [
                {
                    id: 'exam_local',
                    date: '2026-10-21T12:00:00.000Z',
                    results: [{ code: 'P10B', isCorrect: true, selected: [0] }],
                },
            ],
        };

        const merged = FirebaseAuthEngine.mergeExamHistory(localClean, cloudBloated);
        expect(merged.exams).toHaveLength(2);
        expect(merged.exams[0].id).toBe('exam_local'); // Newest first
        expect(merged.exams[1].id).toBe('exam_cloud');
        // Cloud exam has been compacted
        expect(merged.exams[1].results[0]).toEqual({
            code: 'E52V',
            isCorrect: true,
            selected: [0],
        });
        expect(merged.exams[1].results[0].question).toBeUndefined();
        expect(merged.exams[1].results[0].theme).toBeUndefined();
    });

    it('QuizView.renderExamHistory renders questions and explanations by looking up question code', () => {
        vi.spyOn(GlobalState, 'get').mockReturnValue('ALL');
        vi.spyOn(QuizService, 'getExamHistory').mockReturnValue([
            {
                id: 'exam_test',
                date: '2026-10-30T14:00:00.000Z',
                level: 'BI',
                score: 1,
                total: 1,
                results: [{ code: 'E52V', isCorrect: true, selected: [0] }],
            },
        ]);

        const div = document.createElement('div');
        div.innerHTML = QuizView.renderExamHistory();
        // Question text, choices and explanation resolved from bank by code
        expect(div.textContent).toContain("L'assiette est l'angle entre :");
        expect(div.textContent).toContain("le plan de l'aile et l'horizontale");
        expect(div.textContent).toContain("C'est l'angle entre le plan du profil");
    });

    it('QuizView.reviewExam displays errors with details looked up by code', () => {
        document.body.innerHTML = '<div id="stats-content"></div>';
        vi.spyOn(QuizService, 'getExamHistory').mockReturnValue([
            {
                id: 'exam_review',
                date: '2026-10-30T14:00:00.000Z',
                level: 'BI',
                score: 0,
                total: 1,
                results: [{ code: 'E52V', isCorrect: false, selected: [1] }],
            },
        ]);

        QuizView.reviewExam('exam_review');
        const content = document.getElementById('stats-content').textContent;

        expect(content).toContain('E52V');
        expect(content).toContain("L'assiette est l'angle entre :");
        expect(content).toContain("le plan de l'aile et l'horizontale");
    });
});
