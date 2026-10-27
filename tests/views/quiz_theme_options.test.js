import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import QuizService from '../../js/services/quiz_service.js';
import QuizView from '../../js/views/quiz.js';

// La vue est montée à chaque visite de l'écran de configuration : la liste des thèmes ne doit pas
// s'allonger à chaque passage.
const optionValues = () =>
    Array.from(document.querySelectorAll('#qcm-theme-select option')).map(
        (o) => /** @type {HTMLOptionElement} */ (o).value,
    );

beforeEach(() => {
    document.body.innerHTML = `
        <select id="qcm-theme-select">
            <option value="ALL">Tous les thèmes</option>
        </select>`;
    vi.spyOn(QuizService, 'getThemes').mockReturnValue(['Matériel', 'Météo', 'Pilotage']);
});

afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
});

describe('theme select options', () => {
    it('lists "all themes" once, then each theme once', () => {
        QuizView.renderThemeOptions();
        expect(optionValues()).toEqual(['ALL', 'Matériel', 'Météo', 'Pilotage']);
    });

    it('does not stack duplicates when rendered again', () => {
        QuizView.renderThemeOptions();
        QuizView.renderThemeOptions();
        QuizView.renderThemeOptions();
        expect(optionValues()).toEqual(['ALL', 'Matériel', 'Météo', 'Pilotage']);
    });
});
