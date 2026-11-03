import { describe, it, expect } from 'vitest';
import {
    optionLetter,
    buildQuestionSpeech,
    buildFeedbackSpeech,
    buildAutoFeedbackSpeech,
    buildTrapSpeech,
    buildFaultExplanation,
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

describe('spoken trap messages', () => {
    const fail = (trapFeedback) => ({
        isCorrect: false,
        question: { explication: 'Explication.' },
        userPoints: 0,
        selected: [{ pts: -6 }],
        trapFeedback,
    });

    it('says nothing without trap feedback', () => {
        expect(buildTrapSpeech(undefined)).toEqual([]);
        expect(buildTrapSpeech({ recurrent: [], avoided: [], overcome: [] })).toEqual([]);
        expect(buildFeedbackSpeech(fail(undefined))).toBe('Mauvaise réponse. Explication.');
    });

    it('speaks a recurring trap between the verdict and the explanation, without quotes or superscripts', () => {
        const speech = buildFeedbackSpeech(fail({ recurrent: [{ count: 3, text: '12 h', relapse: false }] }));
        expect(speech).toBe('Mauvaise réponse. C’est la 3ème fois que vous choisissez la réponse 12 h. Explication.');
    });

    it('says a relapse differently, and strips the final punctuation of the choice', () => {
        expect(buildTrapSpeech({ recurrent: [{ count: 2, text: 'Oui.', relapse: true }] })).toEqual([
            'Ce piège était surmonté et il est revenu : Oui.',
        ]);
    });

    it('congratulates an avoided or overcome trap, even for a correct answer read automatically', () => {
        const result = {
            isCorrect: true,
            question: { explication: 'Explication.' },
            trapFeedback: { avoided: [{ text: '12 h' }], overcome: [{ text: '14 h' }] },
        };
        expect(buildAutoFeedbackSpeech(result)).toBe(
            'Bonne réponse. Piège surmonté : vous ne tombez plus dans la réponse 14 h. Cette fois, vous avez évité le piège : 12 h.',
        );
    });

    it('keeps the verdict alone for a correct answer without trap feedback', () => {
        expect(buildAutoFeedbackSpeech({ isCorrect: true, question: { explication: 'x' } })).toBe('Bonne réponse.');
    });
});

describe('spoken explanation: only what concerns the fault', () => {
    const original = {
        choices: [
            { text: 'bonne', pts: 6 },
            { text: 'piège', pts: -6 },
            { text: 'autre', pts: -6 },
        ],
        explication:
            'Pourquoi la bonne.\nPourquoi le piège est faux.\nPourquoi l’autre est faux.\nAucune source trouvée pour le moment.',
    };
    // La copie de séance a ses choix mélangés : seul l'objet compte, pas la position.
    const shuffled = { ...original, choices: [original.choices[2], original.choices[0], original.choices[1]] };
    const result = (selected) => ({ question: shuffled, selected });

    it('reads the paragraph of the wrong answer ticked and of the right answer missed, in the original order', () => {
        const text = buildFaultExplanation(result([original.choices[1]]), original);
        expect(text).toBe('Pourquoi la bonne. Pourquoi le piège est faux.');
    });

    it('reads only the missed right answer for an incomplete answer', () => {
        const partial = { question: { ...shuffled, choices: [original.choices[0]] }, selected: [] };
        expect(buildFaultExplanation(partial, original)).toBe('Pourquoi la bonne.');
    });

    it('never reads the "Aucune source trouvée" note, with or without a split', () => {
        expect(buildFaultExplanation(result([original.choices[2]]), original)).not.toMatch(/source/i);
        const unsplit = { question: { explication: 'Un bloc.\nAucune source trouvée dans les documents fournis.' } };
        expect(buildFaultExplanation(unsplit, null)).toBe('Un bloc.');
        expect(buildFaultExplanation(unsplit, { choices: [{ pts: 1 }, { pts: -1 }], explication: 'Un bloc.' })).toBe(
            'Un bloc.',
        );
    });

    it('falls back to the whole explanation when nothing relates to a fault', () => {
        const fine = result([original.choices[0]]);
        expect(buildFaultExplanation(fine, original)).toBe(
            'Pourquoi la bonne. Pourquoi le piège est faux. Pourquoi l’autre est faux.',
        );
    });

    it('is what the feedback speech reads after the verdict', () => {
        const speech = buildFeedbackSpeech(
            { isCorrect: false, userPoints: -6, selected: [original.choices[1]], question: shuffled },
            original,
        );
        expect(speech).toBe('Mauvaise réponse. Pourquoi la bonne. Pourquoi le piège est faux.');
    });
});
