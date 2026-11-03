import { describe, it, expect } from 'vitest';
import { explanationHtml, highlightedExplanationHtml } from '../../js/views/quiz_explanation.js';
import QuizService from '../../js/services/quiz_service.js';
import { buildFeedbackSpeech } from '../../js/services/quiz_voice.js';

// Une explication garde un paragraphe par réponse : « \n » dans le CSV, saut de ligne à l'affichage,
// simple pause à la lecture vocale.
describe('explanation paragraphs', () => {
    it('turns each change of answer into a line break and escapes the text', () => {
        expect(explanationHtml('Un.\nDeux <b>gras</b>.')).toBe('Un.<br>Deux &lt;b&gt;gras&lt;/b&gt;.');
        expect(explanationHtml('Sans retour.')).toBe('Sans retour.');
        expect(explanationHtml(undefined)).toBe('');
    });

    it('reads the two-character \\n of the CSV as a real line break', () => {
        const csv = 'code;question;explication\nA1V;Q;Première réponse.\\nSeconde réponse.\n';
        expect(QuizService.parseExplicationsCSV(csv).A1V).toBe('Première réponse.\nSeconde réponse.');
    });

    it('does not put line breaks in the spoken feedback', () => {
        const speech = buildFeedbackSpeech({
            isCorrect: false,
            question: { explication: 'Première réponse.\nSeconde réponse.' },
        });
        expect(speech).not.toContain('\n');
        expect(speech).toContain('Première réponse. Seconde réponse.');
    });
});

const question = {
    choices: [{ pts: 6 }, { pts: -6 }, { pts: -3 }],
    explication: 'Bonne <b>réponse</b>.\nPourquoi A est faux.\nPourquoi B est faux.',
};

describe('highlightedExplanationHtml', () => {
    it('highlights the paragraph of each wrong choice picked, and escapes the text', () => {
        const html = highlightedExplanationHtml(question, new Set([1]));
        expect(html).toBe(
            'Bonne &lt;b&gt;réponse&lt;/b&gt;.<br><mark class="explanation-picked">Pourquoi A est faux.</mark><br>Pourquoi B est faux.',
        );
    });

    it('returns null when nothing is picked or the split is unreliable, so the full text is shown', () => {
        expect(highlightedExplanationHtml(question, new Set())).toBeNull();
        expect(highlightedExplanationHtml({ ...question, explication: 'un seul bloc' }, new Set([1]))).toBeNull();
    });
});
