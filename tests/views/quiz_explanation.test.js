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
    it('is always a fold: open under a fault, shut under what was done right', () => {
        const fault = optionExplanationHtml('A <b>faux</b>', 'incorrect', 'Explication');
        expect(fault).toBe(
            '<details class="qcm-option-explanation" data-kind="incorrect" open><summary aria-label="Explication" title="Explication"></summary><div>A &lt;b&gt;faux&lt;/b&gt;</div></details>',
        );
        expect(optionExplanationHtml('Oubliée', 'missed', 'Explication')).toContain('data-kind="missed" open');
        const ok = optionExplanationHtml('Juste', 'ok', 'Explication');
        expect(ok).toContain('data-kind="ok"><summary');
        expect(ok).not.toContain(' open');
    });

    it('shows only an arrow: the label is for screen readers and the tooltip, never written in the fold', () => {
        const html = optionExplanationHtml('Texte', 'ok', 'Explication');
        expect(html).toContain('<summary aria-label="Explication" title="Explication"></summary>');
        expect(html.replace(/<[^>]+>/g, '')).toBe('Texte');
    });

    it('puts the ready-made extra html (course buttons) inside the fold, under the text', () => {
        const html = optionExplanationHtml('Juste', 'ok', 'Explication', '<div class="course-links">x</div>');
        expect(html.indexOf('Juste')).toBeLessThan(html.indexOf('course-links'));
        expect(html.endsWith('</div></details>')).toBe(true);
    });
});
