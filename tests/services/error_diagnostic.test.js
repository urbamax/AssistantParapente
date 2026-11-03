import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import QuizService from '../../js/services/quiz_service.js';
import {
    computeTrapStatus,
    diagnoseQuestionErrors,
    getTopTraps,
    isFullyCorrectMask,
    pickAntiTrapQuestions,
    splitOptionExplanations,
} from '../../js/services/error_diagnostic.js';
import { buildRevisionAxes, pickWorkshopQuestions } from '../../js/services/revision_axes.js';

const choices = [
    { text: 'bonne', pts: 6 },
    { text: 'piège A', pts: -6 },
    { text: 'piège B', pts: -3 },
    { text: 'neutre', pts: 0 },
];
const GOOD = 0b0001;
const TRAP_A = 0b0010;
const q = (code, extra = {}) => ({
    code,
    question: `Question ${code}`,
    choices,
    explication: 'Pourquoi bonne.\nPourquoi A est faux.\nPourquoi B est faux.\nPourquoi neutre.',
    parapente: true,
    ...extra,
});
const stat = (answers, pickedChoices) => ({ total: answers.length, correct: 0, answers, pickedChoices });

describe('splitOptionExplanations', () => {
    it('returns one paragraph per choice, in order', () => {
        expect(splitOptionExplanations(q('U1V'))[1]).toBe('Pourquoi A est faux.');
    });

    it('drops a trailing "Aucune source trouvée" line', () => {
        const parts = splitOptionExplanations(
            q('U1V', { explication: 'a\nb\nc\nd\nAucune source trouvée pour le moment.' }),
        );
        expect(parts).toEqual(['a', 'b', 'c', 'd']);
    });

    it('returns nulls when the split is not reliable, so the caller shows the whole text', () => {
        expect(splitOptionExplanations(q('U1V', { explication: 'un seul paragraphe' }))).toEqual([
            null,
            null,
            null,
            null,
        ]);
    });
});

describe('isFullyCorrectMask', () => {
    it('needs every positive choice and no negative one; zero-point choices do not matter', () => {
        expect(isFullyCorrectMask(GOOD, choices)).toBe(true);
        expect(isFullyCorrectMask(GOOD | 0b1000, choices)).toBe(true);
        expect(isFullyCorrectMask(GOOD | TRAP_A, choices)).toBe(false);
        expect(isFullyCorrectMask(0, choices)).toBe(false);
    });
});

describe('computeTrapStatus', () => {
    it('is active right after the trap is ticked', () => {
        expect(computeTrapStatus([[100, TRAP_A]], 1, choices)).toMatchObject({ status: 'active', lastPickedDay: 100 });
    });

    it('stays active with a single correct answer since', () => {
        expect(
            computeTrapStatus(
                [
                    [100, TRAP_A],
                    [101, GOOD],
                ],
                1,
                choices,
            ).status,
        ).toBe('active');
    });

    it('is consolidating after two correct answers, even on the same day', () => {
        const log = [
            [100, TRAP_A],
            [100, GOOD],
            [100, GOOD],
        ];
        expect(computeTrapStatus(log, 1, choices).status).toBe('consolidating');
    });

    it('is overcome only with 3 correct answers over 2+ days and 7+ days after the trap', () => {
        const log = [
            [100, TRAP_A],
            [101, GOOD],
            [104, GOOD],
            [108, GOOD],
        ];
        expect(computeTrapStatus(log, 1, choices).status).toBe('overcome');
        const tooSoon = [
            [100, TRAP_A],
            [101, GOOD],
            [102, GOOD],
            [103, GOOD],
        ];
        expect(computeTrapStatus(tooSoon, 1, choices).status).toBe('consolidating');
        const sameDay = [
            [100, TRAP_A],
            [110, GOOD],
            [110, GOOD],
            [110, GOOD],
        ];
        expect(computeTrapStatus(sameDay, 1, choices).status).toBe('consolidating');
    });

    it('flags a relapse when an overcome trap is ticked again', () => {
        const log = [
            [100, TRAP_A],
            [101, GOOD],
            [104, GOOD],
            [108, GOOD],
            [120, TRAP_A],
        ];
        expect(computeTrapStatus(log, 1, choices)).toMatchObject({ status: 'active', relapse: true });
    });

    it('does not flag a relapse for a quick repeat', () => {
        expect(
            computeTrapStatus(
                [
                    [100, TRAP_A],
                    [101, TRAP_A],
                ],
                1,
                choices,
            ).relapse,
        ).toBe(false);
    });

    it('treats a trap that left the journal as consolidating at least', () => {
        const log = [
            [100, GOOD],
            [101, GOOD],
        ];
        expect(computeTrapStatus(log, 1, choices).status).toBe('consolidating');
    });

    it('ignores answers that avoided the trap but missed the right answer', () => {
        const log = [
            [100, TRAP_A],
            [101, 0],
            [102, 0],
            [103, 0],
        ];
        expect(computeTrapStatus(log, 1, choices).status).toBe('active');
    });
});

describe('diagnoseQuestionErrors', () => {
    it('lists only ticked negative choices, never the neutral or correct ones', () => {
        const d = diagnoseQuestionErrors(q('U1V'), stat([[100, TRAP_A | 0b1000]], [0, 1, 0, 1]));
        expect(d.traps.map((t) => t.choiceIndex)).toEqual([1]);
        expect(d.hasActive).toBe(true);
        expect(d.traps[0]).toMatchObject({ text: 'piège A', pts: -6, count: 1, explanation: 'Pourquoi A est faux.' });
    });

    it('treats missing stats (old history) as no trap', () => {
        expect(diagnoseQuestionErrors(q('U1V'), undefined).traps).toEqual([]);
        expect(diagnoseQuestionErrors(q('U1V'), { total: 3, correct: 1 }).traps).toEqual([]);
    });

    it('orders active traps before overcome ones, then by frequency', () => {
        const log = [
            [100, 0b0110],
            [100, 0b0110],
            [101, GOOD],
            [104, GOOD],
            [110, GOOD],
        ];
        const d = diagnoseQuestionErrors(q('U1V'), stat(log, [0, 2, 2, 0]));
        expect(d.traps.map((t) => t.status)).toEqual(['overcome', 'overcome']);
        const mixed = diagnoseQuestionErrors(
            q('U1V'),
            stat(
                [
                    [100, 0b0100],
                    [101, TRAP_A],
                ],
                [0, 1, 1, 0],
            ),
        );
        expect(mixed.traps.map((t) => t.choiceIndex)).toEqual([1, 2]);
    });
});

describe('getTopTraps and pickAntiTrapQuestions', () => {
    const stats = {
        questions: {
            U1V: stat(
                [
                    [100, TRAP_A],
                    [101, TRAP_A],
                    [102, TRAP_A],
                ],
                [0, 3, 0, 0],
            ),
            U2V: stat([[100, TRAP_A]], [0, 1, 0, 0]),
            U3V: stat(
                [
                    [100, TRAP_A],
                    [101, GOOD],
                    [104, GOOD],
                    [110, GOOD],
                ],
                [0, 1, 0, 0],
            ),
            U4V: stat([[100, GOOD]], [1, 0, 0, 0]),
        },
    };
    const questions = ['U1V', 'U2V', 'U3V', 'U4V'].map((c) => q(c));

    it('sorts the most frequent active traps first and hides overcome ones by default', () => {
        const top = getTopTraps(questions, stats);
        expect(top.map((t) => t.code)).toEqual(['U1V', 'U2V']);
        expect(top[0]).toMatchObject({ count: 3, questionText: 'Question U1V' });
        expect(getTopTraps(questions, stats, { statuses: ['overcome'] }).map((t) => t.code)).toEqual(['U3V']);
        expect(getTopTraps(questions, stats, { limit: 1 })).toHaveLength(1);
    });

    it('picks only questions with an unresolved trap, worst first', () => {
        expect(pickAntiTrapQuestions(questions, stats).map((x) => x.code)).toEqual(['U1V', 'U2V']);
        expect(pickAntiTrapQuestions(questions, stats, { maxQuestions: 1 })).toHaveLength(1);
    });
});

describe('revision axes integration', () => {
    const questions = ['U1V', 'U2V', 'U3V', 'U4V', 'U5V', 'U6V', 'U7V', 'U8V'].map((c) => q(c, { levels: ['BI'] }));

    it('turns a well-mastered axis into BLOCKER when a trap is still active', () => {
        const good = { total: 10, correct: 10, streak: 10, lastSeen: Date.now(), recent: [1, 1, 1, 1, 1] };
        const stats = Object.fromEntries(questions.map((x) => [x.code, { ...good }]));
        const axisOf = (r) => r.axes.find((a) => a.id === 'pilotage-plan-vol-vent');
        expect(axisOf(buildRevisionAxes(questions, stats, [], { level: 'BI' })).status).not.toBe('BLOCKER');

        stats.U1V = { ...good, answers: [[Math.floor(Date.now() / 86_400_000), TRAP_A]], pickedChoices: [0, 1, 0, 0] };
        const axis = axisOf(buildRevisionAxes(questions, stats, [], { level: 'BI' }));
        expect(axis.status).toBe('BLOCKER');
        expect(axis.traps).toMatchObject({ active: 1, consolidating: 0, overcome: 0 });
        expect(axis.traps.items[0]).toMatchObject({ questionId: 'U1V', choiceIndex: 1 });
    });

    it('puts questions with an active trap first in the axis workshop', () => {
        const good = { total: 10, correct: 10, streak: 10, lastSeen: Date.now(), recent: [1, 1, 1, 1, 1] };
        const stats = Object.fromEntries(questions.map((x) => [x.code, { ...good }]));
        stats.U7V = { ...good, answers: [[Math.floor(Date.now() / 86_400_000), TRAP_A]], pickedChoices: [0, 1, 0, 0] };
        const picked = pickWorkshopQuestions(questions, stats, {
            axisId: 'pilotage-plan-vol-vent',
            level: 'BI',
            targetCount: 5,
        });
        expect(picked[0].code).toBe('U7V');
    });
});

describe('données réelles : découpage des explications par choix', () => {
    const questions = QuizService.parseQuestionsCSV(
        readFileSync('js/data/qcm_ffvl.csv', 'utf8'),
        QuizService.parseExplicationsCSV(readFileSync('js/data/qcm_ffvl_explanations.csv', 'utf8')),
    );

    // Plafond à ne jamais dépasser : ces questions ont une explication qui ne se découpe pas
    // proprement, le diagnostic y affiche l'explication entière. À faire baisser lors des lots d'audit.
    const MAX_UNSPLITTABLE = 88;

    it('maps a paragraph to each choice for almost every question', () => {
        const unsplittable = questions.filter((x) => splitOptionExplanations(x).some((p) => p === null));
        expect(questions.length).toBeGreaterThan(800);
        expect(unsplittable.length).toBeLessThanOrEqual(MAX_UNSPLITTABLE);
    });
});
