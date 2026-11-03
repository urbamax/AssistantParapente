import { describe, it, expect } from 'vitest';
import {
    explanationHtml,
    optionExplanationHtml,
    optionExplanations,
    optionOutcome,
} from '../../js/views/quiz_explanation.js';
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

describe('optionExplanations', () => {
    it('gives one paragraph per choice, in the original order', () => {
        expect(optionExplanations(question)).toEqual([
            'Bonne <b>réponse</b>.',
            'Pourquoi A est faux.',
            'Pourquoi B est faux.',
        ]);
    });

    it('returns null when the split is unreliable, so the whole explanation is shown', () => {
        expect(optionExplanations({ ...question, explication: 'un seul bloc' })).toBeNull();
    });
});

describe('optionOutcome', () => {
    it('tells a fault from what was done right', () => {
        expect(optionOutcome({ pts: -6 }, true)).toBe('incorrect');
        expect(optionOutcome({ pts: 6 }, false)).toBe('missed');
        expect(optionOutcome({ pts: 6 }, true)).toBe('ok');
        expect(optionOutcome({ pts: -6 }, false)).toBe('ok');
        expect(optionOutcome({ pts: 0 }, true)).toBe('ok');
    });
});

describe('optionExplanationHtml', () => {
    it('shows the explanation of a fault right away, escaped', () => {
        expect(optionExplanationHtml('A <b>faux</b>', 'incorrect', 'Voir')).toBe(
            '<div class="qcm-option-explanation" data-kind="incorrect">A &lt;b&gt;faux&lt;/b&gt;</div>',
        );
        expect(optionExplanationHtml('Oubliée', 'missed', 'Voir')).toContain('data-kind="missed"');
    });

    it('folds the explanation of what was done right', () => {
        const html = optionExplanationHtml('Juste', 'ok', 'Voir l’explication');
        expect(html).toContain('<details class="qcm-option-explanation" data-kind="ok">');
        expect(html).toContain('<summary>Voir l’explication</summary>');
        expect(html).not.toContain(' open');
    });
});
