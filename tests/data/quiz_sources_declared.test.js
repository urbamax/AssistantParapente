// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import QuizService from '../../js/services/quiz_service.js';

// Spec 031 : chaque question de parapente renvoie à une page vérifiée de la bibliothèque, ou son
// explication dit clairement qu'aucune source n'a été trouvée. Les codes H, R et X (delta) sont
// exclus du quiz parapente.
const mapping = JSON.parse(readFileSync('js/data/question_course_mapping.json', 'utf8'));
const questions = QuizService.parseQuestionsCSV(
    readFileSync('js/data/qcm_ffvl.csv', 'utf8'),
    QuizService.parseExplicationsCSV(readFileSync('js/data/qcm_ffvl_explanations.csv', 'utf8')),
    mapping,
).filter((q) => !/^[HRX]/.test(q.code));
const SAYS_NO_SOURCE =
    /Aucune source trouvée|La bibliothèque de l'application ne traite pas ce point|La bibliothèque consultée/;

describe('quiz sources are declared (spec 031)', () => {
    it('every paragliding question has a verified page or says it has no source', () => {
        const silent = questions
            .filter((q) => !mapping[q.code]?.verifiedPage && !SAYS_NO_SOURCE.test(q.explication || ''))
            .map((q) => q.code);
        expect(silent).toEqual([]);
    });
});
