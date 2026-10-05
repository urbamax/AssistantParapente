// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import QuizService from '../../js/services/quiz_service.js';

// Spec 030 : chaque question du quiz a une explication que l'application sait lire. 23 explications
// rédigées étaient invisibles : la question, qui contient un point-virgule, avait été coupée dans
// le fichier des explications et son guillemet n'était jamais refermé.
const explanations = QuizService.parseExplicationsCSV(readFileSync('js/data/qcm_ffvl_explanations.csv', 'utf8'));
const questions = QuizService.parseQuestionsCSV(
    readFileSync('js/data/qcm_ffvl.csv', 'utf8'),
    explanations,
    JSON.parse(readFileSync('js/data/question_course_mapping.json', 'utf8')),
);

describe('quiz explanations are readable (spec 030)', () => {
    it('every question has a non-empty explanation as read by the app', () => {
        const missing = questions.filter((q) => !String(q.explication || '').trim()).map((q) => q.code);
        expect(missing).toEqual([]);
    });

    it('every explanation row has exactly three fields: code, question, explanation', () => {
        const rows = readFileSync('js/data/qcm_ffvl_explanations.csv', 'utf8').split('\n').slice(1);
        const bad = rows
            .map((row) => row.trim())
            .filter(Boolean)
            .filter((row) => QuizService.parseDelimitedLine(row, ';').length !== 3)
            .map((row) => row.split(';')[0]);
        expect(bad).toEqual([]);
    });
});
