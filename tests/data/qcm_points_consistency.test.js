import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import QuizService, {
    calculateExamPoints,
    compactExamResult,
    migrateExamToPoints,
} from '../../js/services/quiz_service.js';

// Garde-fou sur le vrai QCM : pour chaque question et chaque combinaison de réponses cochées (≈ 10 000),
// les points de la validation, ceux de l'historique compacté et ceux de la migration d'un ancien examen
// doivent être identiques, et valoir la somme des points des choix cochés plancher à 0.
describe('QCM FFVL : cohérence du calcul des points sur toutes les combinaisons de réponses', () => {
    it('validate, compactExamResult et migrateExamToPoints donnent les mêmes points', async () => {
        global.fetch = vi.fn().mockImplementation(async (url) => {
            const content = readFileSync(String(url).replace(/^\.\//, ''), 'utf8');
            return { ok: true, text: async () => content, json: async () => JSON.parse(content) };
        });
        QuizService.setQuestions([]);
        QuizService.state.isLoaded = false;
        await QuizService.init('.');

        const lookup = (code) => QuizService.getQuestionByCode(code);
        const questions = QuizService.questions;
        expect(questions.length).toBeGreaterThan(800);

        const problems = [];
        let combinations = 0;
        for (const q of questions) {
            const texts = q.choices.map((c) => c.text);
            const maxPoints = q.choices.filter((c) => c.pts > 0).reduce((sum, c) => sum + c.pts, 0);
            // Deux choix de même texte feraient confondre les index de l'historique compacté.
            if (new Set(texts).size !== texts.length) problems.push(`${q.code}: choix en double`);
            if (maxPoints === 0) problems.push(`${q.code}: aucune bonne réponse`);

            for (let mask = 0; mask < 1 << q.choices.length; mask++) {
                combinations++;
                const shown = QuizService.shuffleQuestionChoices(q);
                QuizService.state.qcmConfig.mode = 'EXAM';
                QuizService.state.qcmSessionData = [shown];
                QuizService.state.examResults = [];
                QuizService.state.qcmIndex = 0;
                QuizService.state.invalidated = false;
                QuizService.state.currentQcmSelection = new Set(
                    q.choices
                        .map((c, i) => ((mask >> i) & 1 ? shown.choices.find((s) => s.text === c.text) : null))
                        .filter(Boolean),
                );
                const result = QuizService.validate();
                const expected = Math.max(
                    0,
                    q.choices.reduce((sum, c, i) => sum + ((mask >> i) & 1 ? c.pts : 0), 0),
                );

                const live = calculateExamPoints([result], [shown], lookup);
                const compact = calculateExamPoints([compactExamResult(result, lookup)], [], lookup);
                const migrated = migrateExamToPoints(
                    { id: 'x', date: '2026-01-01T00:00:00Z', results: [compactExamResult(result, lookup)] },
                    lookup,
                );
                for (const [label, earned, total] of [
                    ['validation', live.earnedPoints, live.totalPoints],
                    ['historique compacté', compact.earnedPoints, compact.totalPoints],
                    ['migration', migrated.score, migrated.total],
                ]) {
                    if (earned !== expected || total !== maxPoints) {
                        problems.push(
                            `${q.code} #${mask} (${label}): ${earned}/${total}, attendu ${expected}/${maxPoints}`,
                        );
                    }
                }
            }
        }

        expect(combinations).toBeGreaterThan(10000);
        expect(problems.slice(0, 10)).toEqual([]);
    });
});
