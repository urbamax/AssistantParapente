import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import QuizView from '../../js/views/quiz.js';
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

describe('results screen explanations (like during training)', () => {
    beforeEach(() => {
        document.body.innerHTML = SCREENS;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders per-option explanations in folds under each choice when splittable', () => {
        const question = {
            code: 'A65B',
            theme: 'Météo',
            question: 'Dans une atmosphère à tendance instable :',
            explication: 'Explication choix A\nExplication choix B\nExplication choix C\nExplication choix D',
            parapente: true,
            choices: [
                { text: 'les stratus ont tendance à se développer', pts: -6 },
                { text: 'il y a peu d’ascendances', pts: -6 },
                { text: 'les cumulus ont tendance à se développer', pts: 3 },
                { text: 'la température décroît rapidement quand on s’élève en altitude', pts: 3 },
            ],
        };

        vi.spyOn(QuizService, 'getQuestionByCode').mockReturnValue(question);
        vi.spyOn(QuizView, 'getCourseLinks').mockReturnValue([
            { url: 'courses/meteo.pdf#page=12', title: 'Météo', page: 12 },
        ]);

        // Pilote a coché choix A (-6) et choix C (+3). A oublié choix D (+3). N'a pas coché B (-6).
        const selected = [question.choices[0], question.choices[2]];
        QuizService.state.qcmConfig.mode = 'TRAINING';
        QuizService.state.examResults = [{ isCorrect: false, question, selected }];

        QuizView.renderExamResults();

        const container = document.getElementById('qcm-question-text');
        // No monolithic block
        expect(container.querySelector('.bank-item-explication')).toBeNull();

        // 4 option groups
        const groups = container.querySelectorAll('.qcm-option-group');
        expect(groups).toHaveLength(4);

        // Choice 0: Fausse cochée -> incorrect, open
        const fold0 = groups[0].querySelector('.qcm-option-explanation');
        expect(fold0.getAttribute('data-kind')).toBe('incorrect');
        expect(fold0.hasAttribute('open')).toBe(true);
        expect(fold0.textContent).toContain('Explication choix A');

        // Choice 1: Fausse non cochée -> ok, closed
        const fold1 = groups[1].querySelector('.qcm-option-explanation');
        expect(fold1.getAttribute('data-kind')).toBe('ok');
        expect(fold1.hasAttribute('open')).toBe(false);
        expect(fold1.textContent).toContain('Explication choix B');

        // Choice 2: Bonne cochée -> ok, closed, with course link
        const fold2 = groups[2].querySelector('.qcm-option-explanation');
        expect(fold2.getAttribute('data-kind')).toBe('ok');
        expect(fold2.hasAttribute('open')).toBe(false);
        expect(fold2.textContent).toContain('Explication choix C');
        expect(fold2.querySelector('.course-links')).not.toBeNull();

        // Choice 3: Bonne oubliée -> missed, open, with course link
        const fold3 = groups[3].querySelector('.qcm-option-explanation');
        expect(fold3.getAttribute('data-kind')).toBe('missed');
        expect(fold3.hasAttribute('open')).toBe(true);
        expect(fold3.textContent).toContain('Explication choix D');
        expect(fold3.querySelector('.course-links')).not.toBeNull();
    });

    it('falls back to whole explanation box when question cannot be split', () => {
        const question = {
            code: 'X99',
            theme: 'Météo',
            question: 'Question insécable',
            explication: 'Un seul paragraphe pour toute la question.',
            parapente: true,
            choices: [
                { text: 'Choix 1', pts: 3 },
                { text: 'Choix 2', pts: -3 },
            ],
        };

        vi.spyOn(QuizService, 'getQuestionByCode').mockReturnValue(question);
        QuizService.state.qcmConfig.mode = 'TRAINING';
        QuizService.state.examResults = [{ isCorrect: false, question, selected: [question.choices[1]] }];

        QuizView.renderExamResults();

        const container = document.getElementById('qcm-question-text');
        expect(container.querySelectorAll('.qcm-option-group')).toHaveLength(0);
        const fallback = container.querySelector('.bank-item-explication');
        expect(fallback).not.toBeNull();
        expect(fallback.textContent).toContain('Un seul paragraphe pour toute la question.');
    });
});
