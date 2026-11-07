import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import QuizService, {
    FFVL_THEME_DISTRIBUTION,
    FFVL_EXAM_QUOTAS,
    getExamQuotas,
    calculateExamPoints,
} from '../../js/services/quiz_service.js';
import { readFileSync } from 'node:fs';

describe('QuizService - Conformité officielle des examens FFVL (BI / BP / BPC)', () => {
    beforeEach(async () => {
        // Mock fetch pour charger les vrais CSV officiels du dépôt
        global.fetch = vi.fn().mockImplementation(async (url) => {
            const cleanPath = url.replace(/^\.\//, '');
            const content = readFileSync(cleanPath, 'utf8');
            return {
                ok: true,
                text: async () => content,
                json: async () => JSON.parse(content),
            };
        });

        QuizService.setQuestions([]);
        QuizService.state.isLoaded = false;
        await QuizService.init('.');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('définit la distribution officielle FFVL de 10 thèmes par bloc de 10 questions', () => {
        expect(FFVL_THEME_DISTRIBUTION).toEqual([
            'Matériel',
            'Mécavol',
            'Mécavol',
            'Pilotage',
            'Pilotage',
            'Réglementation',
            'Météo',
            'Météo',
            'Facteurs humains',
            'Milieu naturel',
        ]);
        expect(FFVL_THEME_DISTRIBUTION).toHaveLength(10);
    });

    it('définit les quotas exacts par brevet (BI : 30, BP : 60, BPC : 30)', () => {
        expect(FFVL_EXAM_QUOTAS.BI.total).toBe(30);
        expect(FFVL_EXAM_QUOTAS.BP.total).toBe(60);
        expect(FFVL_EXAM_QUOTAS.BPC.total).toBe(30);

        expect(getExamQuotas('BI')).toEqual(FFVL_EXAM_QUOTAS.BI);
        expect(getExamQuotas('BP')).toEqual(FFVL_EXAM_QUOTAS.BP);
        expect(getExamQuotas('BPC')).toEqual(FFVL_EXAM_QUOTAS.BPC);
    });

    it("l'examen du Brevet Initial (BI) respecte à 100% le nombre de questions (30) et la répartition par thème", () => {
        QuizService.setMode('EXAM');
        QuizService.startSession('BI');

        const session = QuizService.state.qcmSessionData;
        expect(session).toHaveLength(30);

        const counts = {};
        session.forEach((q) => {
            counts[q.theme] = (counts[q.theme] || 0) + 1;
        });

        expect(counts).toEqual({
            Matériel: 3,
            Mécavol: 6,
            Pilotage: 6,
            Réglementation: 3,
            Météo: 6,
            'Facteurs humains': 3,
            'Milieu naturel': 3,
        });

        // Chaque bloc de 10 questions doit également respecter la distribution unitaire (1/2/2/1/2/1/1)
        for (let chunkIdx = 0; chunkIdx < 3; chunkIdx++) {
            const chunk = session.slice(chunkIdx * 10, (chunkIdx + 1) * 10);
            expect(chunk).toHaveLength(10);
            const chunkCounts = {};
            chunk.forEach((q) => {
                chunkCounts[q.theme] = (chunkCounts[q.theme] || 0) + 1;
            });
            expect(chunkCounts).toEqual({
                Matériel: 1,
                Mécavol: 2,
                Pilotage: 2,
                Réglementation: 1,
                Météo: 2,
                'Facteurs humains': 1,
                'Milieu naturel': 1,
            });
        }
    });

    it("l'examen du Brevet de Pilote (BP) respecte à 100% le nombre de questions (60) et la répartition par thème", () => {
        QuizService.setMode('EXAM');
        QuizService.startSession('BP');

        const session = QuizService.state.qcmSessionData;
        expect(session).toHaveLength(60);

        const counts = {};
        session.forEach((q) => {
            counts[q.theme] = (counts[q.theme] || 0) + 1;
        });

        expect(counts).toEqual({
            Matériel: 6,
            Mécavol: 12,
            Pilotage: 12,
            Réglementation: 6,
            Météo: 12,
            'Facteurs humains': 6,
            'Milieu naturel': 6,
        });

        // Chaque bloc de 10 questions doit respecter la distribution unitaire (1/2/2/1/2/1/1)
        for (let chunkIdx = 0; chunkIdx < 6; chunkIdx++) {
            const chunk = session.slice(chunkIdx * 10, (chunkIdx + 1) * 10);
            expect(chunk).toHaveLength(10);
            const chunkCounts = {};
            chunk.forEach((q) => {
                chunkCounts[q.theme] = (chunkCounts[q.theme] || 0) + 1;
            });
            expect(chunkCounts).toEqual({
                Matériel: 1,
                Mécavol: 2,
                Pilotage: 2,
                Réglementation: 1,
                Météo: 2,
                'Facteurs humains': 1,
                'Milieu naturel': 1,
            });
        }
    });

    it("l'examen du Brevet de Pilote Confirmé (BPC) respecte à 100% le nombre de questions (30) et la répartition par thème", () => {
        QuizService.setMode('EXAM');
        QuizService.startSession('BPC');

        const session = QuizService.state.qcmSessionData;
        expect(session).toHaveLength(30);

        const counts = {};
        session.forEach((q) => {
            counts[q.theme] = (counts[q.theme] || 0) + 1;
        });

        expect(counts).toEqual({
            Matériel: 3,
            Mécavol: 6,
            Pilotage: 6,
            Réglementation: 3,
            Météo: 6,
            'Facteurs humains': 3,
            'Milieu naturel': 3,
        });

        // Chaque bloc de 10 questions doit respecter la distribution unitaire (1/2/2/1/2/1/1)
        for (let chunkIdx = 0; chunkIdx < 3; chunkIdx++) {
            const chunk = session.slice(chunkIdx * 10, (chunkIdx + 1) * 10);
            expect(chunk).toHaveLength(10);
            const chunkCounts = {};
            chunk.forEach((q) => {
                chunkCounts[q.theme] = (chunkCounts[q.theme] || 0) + 1;
            });
            expect(chunkCounts).toEqual({
                Matériel: 1,
                Mécavol: 2,
                Pilotage: 2,
                Réglementation: 1,
                Météo: 2,
                'Facteurs humains': 1,
                'Milieu naturel': 1,
            });
        }
    });

    it('conserve 100% de conformité sur 50 tirages aléatoires successifs pour chaque brevet', () => {
        QuizService.setMode('EXAM');

        for (const [level, expectedCount, expectedThemes] of [
            ['BI', 30, FFVL_EXAM_QUOTAS.BI.themes],
            ['BP', 60, FFVL_EXAM_QUOTAS.BP.themes],
            ['BPC', 30, FFVL_EXAM_QUOTAS.BPC.themes],
        ]) {
            for (let i = 0; i < 50; i++) {
                const questions = QuizService.buildExamSelection(level);
                expect(questions).toHaveLength(expectedCount);

                const counts = {};
                questions.forEach((q) => {
                    counts[q.theme] = (counts[q.theme] || 0) + 1;
                });
                expect(counts).toEqual(expectedThemes);
            }
        }
    });

    it('gère élégamment le fallback si un pool de questions a moins de questions que requis', () => {
        const miniPool = [
            { code: 'A1V', theme: 'Météo', question: 'Q1', choices: [] },
            { code: 'E2V', theme: 'Mécavol', question: 'Q2', choices: [] },
            { code: 'S3V', theme: 'Réglementation', question: 'Q3', choices: [] },
        ];
        const selection = QuizService.buildExamSelection('BI', miniPool);
        expect(selection).toHaveLength(3);
        const codes = selection.map((q) => q.code).sort();
        expect(codes).toEqual(['A1V', 'E2V', 'S3V']);
    });
});

describe('calculateExamPoints : seuil de réussite sur le ratio exact', () => {
    const q = { code: 'X1V', choices: [{ text: 'a', pts: 6 }, { text: 'b', pts: -6 }] };
    const mk = (okCount, total) =>
        Array.from({ length: total }, (_, i) => ({ code: 'X1V', question: q, userPoints: i < okCount ? 6 : 0 }));

    it('74,6 % (arrondi à 75 %) ne réussit pas', () => {
        expect(calculateExamPoints(mk(373, 500)).passed).toBe(false);
    });
    it('exactement 75 % réussit', () => {
        expect(calculateExamPoints(mk(3, 4)).passed).toBe(true);
    });
});
