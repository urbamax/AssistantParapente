import { describe, it, expect } from 'vitest';
import {
    optionLetter,
    buildQuestionSpeech,
    buildFeedbackSpeech,
    buildAutoFeedbackSpeech,
    describeSelection,
    parseVoiceCommand,
    looksLikeEcho,
} from '../../js/services/quiz_voice.js';

// Spec 016 : textes lus à voix haute et interprétation des phrases entendues.
const QUESTION = {
    question: 'Que signifie un vent de travers ?',
    choices: [{ text: 'Vent de face' }, { text: 'Vent latéral' }, { text: 'Vent arrière' }, { text: 'Aucun vent' }],
    explication: 'Le vent de travers souffle sur le côté.',
};

describe('spoken texts (spec 016, FR-001, FR-002)', () => {
    it('letters follow the displayed order', () => {
        expect([0, 1, 2, 3, 4, 5].map(optionLetter)).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
    });

    it('reads the question then every lettered answer, verbatim', () => {
        expect(buildQuestionSpeech(QUESTION)).toBe(
            'Que signifie un vent de travers ? Réponse A : Vent de face. Réponse B : Vent latéral. ' +
                'Réponse C : Vent arrière. Réponse D : Aucun vent.',
        );
    });

    it('does not double the final punctuation of an answer', () => {
        const q = { question: 'Q ?', choices: [{ text: 'Oui.' }, { text: 'Non !' }] };
        expect(buildQuestionSpeech(q)).toBe('Q ? Réponse A : Oui. Réponse B : Non !');
    });

    it('reads the verdict then the explanation', () => {
        expect(buildFeedbackSpeech({ isCorrect: true, question: QUESTION })).toBe(
            'Bonne réponse. Le vent de travers souffle sur le côté.',
        );
        expect(buildFeedbackSpeech({ isCorrect: false, question: QUESTION })).toBe(
            'Mauvaise réponse. Le vent de travers souffle sur le côté.',
        );
    });

    it('auto-read: verdict only for a right answer (spec 022, FR-001)', () => {
        expect(buildAutoFeedbackSpeech({ isCorrect: true, question: QUESTION })).toBe('Bonne réponse.');
    });

    it('auto-read: verdict and explanation for a wrong or incomplete answer (spec 022, FR-002)', () => {
        expect(buildAutoFeedbackSpeech({ isCorrect: false, question: QUESTION })).toBe(
            'Mauvaise réponse. Le vent de travers souffle sur le côté.',
        );
        const incomplete = {
            isCorrect: false,
            userPoints: 6,
            selected: [{ text: 'Vent latéral', pts: 6 }],
            question: QUESTION,
        };
        expect(buildAutoFeedbackSpeech(incomplete)).toBe(buildFeedbackSpeech(incomplete));
        expect(buildAutoFeedbackSpeech(incomplete)).toContain('Le vent de travers souffle sur le côté.');
    });

    it('reads only the verdict when there is no explanation', () => {
        expect(buildFeedbackSpeech({ isCorrect: false, question: { explication: '' } })).toBe('Mauvaise réponse.');
    });

    it('describes the selection', () => {
        expect(describeSelection([1, 3])).toBe('Sélection : B, D.');
        expect(describeSelection([])).toBe('Sélection effacée.');
    });

    it('reads the selected answers with their text when known', () => {
        const choices = [
            { text: 'Vent de face' },
            { text: 'Vent latéral' },
            { text: 'Vent arrière' },
            { text: 'Aucun vent' },
        ];
        expect(describeSelection([1, 3], choices)).toBe('Sélection : B, Vent latéral. D, Aucun vent.');
    });

    it('says « incomplète » when points were earned without any wrong answer', () => {
        const base = { isCorrect: false, question: { explication: '' } };
        expect(buildFeedbackSpeech({ ...base, userPoints: 2, selected: [{ pts: 2 }] })).toBe('Réponse incomplète.');
        expect(buildFeedbackSpeech({ ...base, userPoints: 1, selected: [{ pts: 2 }, { pts: -1 }] })).toBe(
            'Mauvaise réponse.',
        );
        expect(buildFeedbackSpeech({ ...base, userPoints: 0, selected: [] })).toBe('Mauvaise réponse.');
    });
});

describe('parseVoiceCommand (spec 016, FR-007, FR-008)', () => {
    const letters = (text, count = 4) => parseVoiceCommand(text, count);

    it.each([
        ['A', [0]],
        ['b', [1]],
        ['B et D', [1, 3]],
        ['b, d', [1, 3]],
        ['réponse C', [2]],
        ['réponses A et C', [0, 2]],
        ['la réponse D', [3]],
        ['bé', [1]],
        ['c’est', [2]],
        ["c'est", [2]],
        ['dé', [3]],
        ['ah', [0]],
        ['BD', [1, 3]],
        ['D et B', [1, 3]],
        ['a et a', [0]],
        ['lettre B', [1]],
        // Homophones de suites de lettres (reconnaissance vocale française).
        ['aider', [0, 3]],
        ['à aider', [0, 3]],
        ['A aider', [0, 3]],
        ['A et dé', [0, 3]],
        ['B et des', [1, 3]],
        ['A et c’est', [0, 2]],
        ['assez', [0, 2]],
        ['abaisser', [0, 1, 2]],
        ['baisser', [1, 2]],
        ['céder', [2, 3]],
        ['décès', [2, 3]],
        ['baie', [1]],
    ])('« %s » selects %j', (text, indexes) => {
        expect(letters(text)).toEqual({ type: 'letters', indexes });
    });

    it.each([
        ['valider', 'validate'],
        ['Valide', 'validate'],
        ['validé', 'validate'],
        ['suivante', 'next'],
        ['question suivante', 'next'],
        ['suivant', 'next'],
        ['précédente', 'prev'],
        ['question précédente', 'prev'],
        ['retour', 'prev'],
        ['répète', 'repeat'],
        ['répéter', 'repeat'],
        ['relis', 'repeat'],
        ['explication', 'repeat'],
        ['explique', 'repeat'],
        ['explique-moi', 'repeat'],
        ['effacer', 'clear'],
        ['efface', 'clear'],
        ['stop', 'stop'],
        ['arrête', 'stop'],
    ])('« %s » is the command %s', (text, name) => {
        expect(letters(text)).toEqual({ type: 'command', name });
    });

    it.each([[''], ['   '], ['je ne sais pas'], ['des nuages'], ['c’est la B'], ['E'], ['A et E'], ['bonjour']])(
        '« %s » is not understood with 4 answers',
        (text) => {
            expect(letters(text)).toEqual({ type: 'unknown' });
        },
    );

    it('accepts E when there are 5 answers', () => {
        expect(parseVoiceCommand('E', 5)).toEqual({ type: 'letters', indexes: [4] });
    });

    it('ignores case and surrounding spaces', () => {
        expect(parseVoiceCommand('  VALIDER  ', 4)).toEqual({ type: 'command', name: 'validate' });
    });
});

describe('looksLikeEcho (spec 022, FR-006)', () => {
    it.each([
        ['Réponse A : Vent de face', true],
        ['réponse A', true],
        ['réponses B et D', true],
        ['Sélection : B, Vent latéral', true],
        ['B et D', false],
        ['A', false],
        ['valider', false],
    ])('« %s » → %s', (text, expected) => {
        expect(looksLikeEcho(text)).toBe(expected);
    });
});
