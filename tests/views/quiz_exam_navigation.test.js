import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import QuizView from '../../js/views/quiz.js';
import QuizService from '../../js/services/quiz_service.js';

describe('QuizView - Navigation arrière/avant et affichage des sélections en examen', () => {
    const q1 = {
        code: 'A1V',
        theme: 'Météo',
        question: 'Question 1',
        choices: [
            { text: 'Choix 1A', pts: 1 },
            { text: 'Choix 1B', pts: 0 },
        ],
    };
    const q2 = {
        code: 'A2V',
        theme: 'Météo',
        question: 'Question 2',
        choices: [
            { text: 'Choix 2A', pts: 0 },
            { text: 'Choix 2B', pts: 1 },
        ],
    };

    beforeEach(() => {
        document.body.innerHTML = `
            <div id="qcm-screen" class="active">
                <div id="qcm-mode-label"></div>
                <div id="qcm-question-text"></div>
                <div id="qcm-choices"></div>
                <div id="qcm-actions-container"></div>
                <div id="qcm-feedback"></div>
                <div id="qcm-voice-bar"></div>
            </div>
        `;
        QuizService.state.qcmConfig.mode = 'EXAM';
        QuizService.state.qcmSessionData = [q1, q2];
        QuizService.state.qcmIndex = 0;
        QuizService.state.examResults = [];
        QuizService.state.currentQcmSelection = new Set();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    it('affiche le choix sélectionné avec la classe .selected lors du retour arrière en examen', () => {
        // Affiche Q1
        QuizView.renderQuestion(q1);

        const optionsQ1 = document.querySelectorAll('.qcm-option');
        expect(optionsQ1).toHaveLength(2);
        expect(optionsQ1[0].classList.contains('selected')).toBe(false);

        // Sélectionne le premier choix de Q1
        QuizView.handleClick({ target: optionsQ1[0] });
        expect(optionsQ1[0].classList.contains('selected')).toBe(true);
        expect(QuizService.state.currentQcmSelection.has(q1.choices[0])).toBe(true);

        // Valide Q1 -> passe automatiquement à Q2 en mode EXAM
        QuizView.validateQuestion();
        expect(QuizService.state.qcmIndex).toBe(1);

        // Q2 est affichée : aucun choix ne doit être sélectionné
        const optionsQ2 = document.querySelectorAll('.qcm-option');
        expect(optionsQ2).toHaveLength(2);
        expect(optionsQ2[0].classList.contains('selected')).toBe(false);
        expect(optionsQ2[1].classList.contains('selected')).toBe(false);

        // Clic sur le bouton retour en arrière
        const prevBtn = document.querySelector('[data-action="prev-question"]');
        expect(prevBtn).not.toBeNull();
        QuizView.handleClick({ target: prevBtn });

        // On est revenu sur Q1
        expect(QuizService.state.qcmIndex).toBe(0);
        const optionsBackQ1 = document.querySelectorAll('.qcm-option');
        expect(optionsBackQ1).toHaveLength(2);

        // Le premier choix DOIT être affiché comme sélectionné (.selected)
        expect(optionsBackQ1[0].classList.contains('selected')).toBe(true);
        expect(optionsBackQ1[1].classList.contains('selected')).toBe(false);
        expect(QuizService.state.currentQcmSelection.has(q1.choices[0])).toBe(true);

        // Correction : on désélectionne le choix 1A et on sélectionne le choix 1B
        QuizView.handleClick({ target: optionsBackQ1[0] });
        expect(optionsBackQ1[0].classList.contains('selected')).toBe(false);
        expect(QuizService.state.currentQcmSelection.has(q1.choices[0])).toBe(false);

        QuizView.handleClick({ target: optionsBackQ1[1] });
        expect(optionsBackQ1[1].classList.contains('selected')).toBe(true);
        expect(QuizService.state.currentQcmSelection.has(q1.choices[1])).toBe(true);

        // Re-validation de Q1 corrigée -> avance vers Q2
        QuizView.validateQuestion();
        expect(QuizService.state.qcmIndex).toBe(1);
        expect(QuizService.state.examResults[0].selected).toEqual([q1.choices[1]]);
    });
});
