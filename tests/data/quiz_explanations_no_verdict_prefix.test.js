// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import QuizService from '../../js/services/quiz_service.js';

// L'écran colore déjà la bonne réponse (vert), les mauvaises (rouge) et les réponses neutres : une
// explication n'a pas à répéter le verdict en tête (« Juste : … », « Fausse : … », « Neutre : … »).
// Elle commence directement par la raison. Les codes H, R et X (delta) sont exclus du quiz parapente.
const explanations = QuizService.parseExplicationsCSV(readFileSync('js/data/qcm_ffvl_explanations.csv', 'utf8'));

const VERDICT_WORD = '(?:Fausses?|Faux|Juste|Justes|Vrai|Vraie|Vrais|Neutre|Correcte?|Incorrecte?|Exacte?|Inexacte?)';
const VERDICT_PREFIX = new RegExp(`^\\s*${VERDICT_WORD}(?:\\s+aussi)?\\s*[:,]`, 'i');
const SELF_VERDICT = /^\s*Cet(?:te)? (?:réponse|option|proposition|affirmation) (?:est|n'est pas) /i;

describe('quiz explanations do not announce the verdict', () => {
    it('no option explanation starts with « Juste : », « Fausse : », « Neutre : » or similar', () => {
        const offending = Object.entries(explanations)
            .filter(([code]) => !/^[HRX]/.test(code))
            .flatMap(([code, text]) =>
                String(text)
                    .split(/\r?\n|\\n/)
                    .map((line, index) => [index, line])
                    .filter(([, line]) => VERDICT_PREFIX.test(line) || SELF_VERDICT.test(line))
                    .map(([index]) => `${code} (choix ${index + 1})`),
            );
        expect(offending).toEqual([]);
    });
});
