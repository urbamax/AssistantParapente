// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import QuizService from '../../js/services/quiz_service.js';

// L'application mélange l'ordre des choix à chaque séance (QuizService.shuffleQuestionChoices) :
// l'explication d'une option ne peut donc pas renvoyer à une autre (« à l'inverse », « pour la
// même raison », « non plus »…), car l'autre option n'est plus à la même place, ni même à côté.
// Chaque explication doit se suffire : elle énonce le fait qui rend l'option juste ou fausse.
// Les codes H, R et X (delta) sont exclus du quiz parapente.
const explanations = QuizService.parseExplicationsCSV(readFileSync('js/data/qcm_ffvl_explanations.csv', 'utf8'));

const CROSS_REFERENCES = [
    /(^|[.:;!?]\s+|\n)À l'inverse/,
    /(^|[.:;!?]\s+|\n)De même[ ,]/,
    /pour (la|les) mêmes? raisons?/i,
    /\bmême raison\b/i,
    /\bne\b[^.]{0,60}\bpas\b[^.]{0,20}\bnon plus\b/i,
    /(^|[.:;!?]\s+|\n)(Faux|Fausse|Fausses|Inexact|Inexacte|Vrai|Vraie|Juste) aussi/,
    /dans l'autre sens/i,
    /à l'opposé (des|de l'|de la|du) (deux|autre|précédent|premier|dernier)/i,
    /\bdéjà vue?s?\b/i,
    /\bvu(e)?s? plus haut\b/i,
    /les deux autres (options|réponses|propositions|cas)/i,
    /deux cas précédents/i,
    /autres? (option|réponse|proposition)s?/i,
    /(option|réponse|proposition)s? (précédente|suivante)s?/i,
    /\bidem\b/i,
    /(comme|ainsi que) (indiqué|vu|dit|précisé|noté|expliqué)e?s? plus haut/i,
    /\bcette étude\b/i,
    /\bégalement (juste|vrai|vraie|faux|fausse)\b/i,
    /\ble même chapitre\b/i,
];

describe('quiz explanations stand alone (answer choices are shuffled)', () => {
    it('no paragliding explanation refers to another option', () => {
        const offending = Object.entries(explanations)
            .filter(([code]) => !/^[HRX]/.test(code))
            .flatMap(([code, text]) =>
                CROSS_REFERENCES.filter((re) => re.test(String(text))).map((re) => `${code}: ${re}`),
            );
        expect(offending).toEqual([]);
    });
});
