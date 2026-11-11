import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import QuizView, { questionResultBadge } from '../../js/views/quiz.js';
import QuizService from '../../js/services/quiz_service.js';

const INDEX = readFileSync('index.html', 'utf8');
const SCREENS = (() => {
    const tpl = document.createElement('template');
    tpl.innerHTML = INDEX.slice(INDEX.indexOf('<div id="qcm-setup-screen"'));
    return ['qcm-setup-screen', 'qcm-screen', 'stats-screen', 'qcm-bank-screen']
        .map((id) => tpl.content.getElementById(id).outerHTML)
        .join('')
        .replace(/\s(src|href)="https?:[^"]*"/g, '');
})();

describe('questionResultBadge logic', () => {
    const question = {
        code: 'E38B',
        question: 'Vous volez par fort vent arrière, cela implique :',
        choices: [
            { text: 'une diminution de la Force Aérodynamique', pts: -6 },
            { text: 'une augmentation de la vitesse-sol', pts: 3 },
            { text: 'une augmentation de l’incidence', pts: -6 },
            { text: 'une augmentation de la finesse-sol', pts: 3 },
        ],
    };

    it('returns "incomplete" (INCOMPLET, orange) when only green and orange are present (no red)', () => {
        // Choix 1 (+3) coché (vert), choix 3 (+3) non coché (orange), pas de faute cochée (pas de rouge)
        const result = {
            question,
            selected: [question.choices[1]],
        };
        const badge = questionResultBadge(result);
        expect(badge.status).toBe('incomplete');
        expect(badge.labelKey).toBe('results.incomplete');
        expect(badge.style).toContain('#ea580c');
        expect(badge.style).toContain('#fb923c');
    });

    it('returns "incomplete" when no choice was selected (all correct choices missed, orange)', () => {
        const result = {
            question,
            selected: [],
        };
        const badge = questionResultBadge(result);
        expect(badge.status).toBe('incomplete');
        expect(badge.labelKey).toBe('results.incomplete');
    });

    it('returns "wrong" (FAUX, red) when red and green are present', () => {
        // Choix 0 (-6, rouge) coché et choix 1 (+3, vert) coché
        const result = {
            question,
            selected: [question.choices[0], question.choices[1]],
        };
        const badge = questionResultBadge(result);
        expect(badge.status).toBe('wrong');
        expect(badge.labelKey).toBe('results.wrong');
        expect(badge.style).toContain('#dc2626');
        expect(badge.style).toContain('#f87171');
    });

    it('returns "wrong" (FAUX, red) when red and orange are present', () => {
        // Choix 0 (-6, rouge) coché, aucun bon choix coché (les 2 bons choix sont orange)
        const result = {
            question,
            selected: [question.choices[0]],
        };
        const badge = questionResultBadge(result);
        expect(badge.status).toBe('wrong');
        expect(badge.labelKey).toBe('results.wrong');
    });

    it('returns "wrong" (FAUX, red) when red, green, and orange are all present', () => {
        // Choix 0 (-6, rouge), choix 1 (+3, vert), choix 3 (+3 non coché, orange)
        const result = {
            question,
            selected: [question.choices[0], question.choices[1]],
        };
        const badge = questionResultBadge(result);
        expect(badge.status).toBe('wrong');
        expect(badge.labelKey).toBe('results.wrong');
    });

    it('returns "correct" (VRAI, green) when only green is present', () => {
        // Les deux bons choix cochés (+3, +3), aucune faute cochée
        const result = {
            question,
            selected: [question.choices[1], question.choices[3]],
        };
        const badge = questionResultBadge(result);
        expect(badge.status).toBe('correct');
        expect(badge.labelKey).toBe('results.correct');
        expect(badge.style).toContain('#16a34a');
        expect(badge.style).toContain('#4ade80');
    });
});

describe('results screen badge DOM rendering', () => {
    beforeEach(() => {
        document.body.innerHTML = SCREENS;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const questionE38B = {
        code: 'E38B',
        question: 'Vous volez par fort vent arrière, cela implique :',
        explication: 'La finesse-sol est la finesse modifiée sous l’influence du vent.',
        choices: [
            { text: 'une diminution de la Force Aérodynamique', pts: -6 },
            { text: 'une augmentation de la vitesse-sol', pts: 3 },
            { text: 'une augmentation de l’incidence', pts: -6 },
            { text: 'une augmentation de la finesse-sol', pts: 3 },
        ],
    };

    it('renders INCOMPLET badge when only green and orange are present', () => {
        vi.spyOn(QuizService, 'getQuestionByCode').mockReturnValue(questionE38B);
        vi.spyOn(QuizView, 'getCourseLinks').mockReturnValue([]);

        QuizService.state.qcmConfig.mode = 'EXAM';
        // Pilote a seulement coché le choix 1 (+3), omission du choix 3 (+3), aucune réponse fausse
        QuizService.state.examResults = [
            { isCorrect: false, question: questionE38B, selected: [questionE38B.choices[1]] },
        ];

        QuizView.renderExamResults();

        const badge = document.querySelector('.bank-item-header .badge');
        expect(badge).not.toBeNull();
        expect(badge.textContent.trim()).toBe('INCOMPLET');
        expect(badge.style.color).toBe('#ea580c');
    });

    it('renders FAUX badge when a negative choice is selected', () => {
        vi.spyOn(QuizService, 'getQuestionByCode').mockReturnValue(questionE38B);
        vi.spyOn(QuizView, 'getCourseLinks').mockReturnValue([]);

        QuizService.state.qcmConfig.mode = 'EXAM';
        QuizService.state.examResults = [
            {
                isCorrect: false,
                question: questionE38B,
                selected: [questionE38B.choices[0], questionE38B.choices[1]],
            },
        ];

        QuizView.renderExamResults();

        const badge = document.querySelector('.bank-item-header .badge');
        expect(badge).not.toBeNull();
        expect(badge.textContent.trim()).toBe('FAUX');
        expect(badge.style.color).toBe('#dc2626');
    });
});
