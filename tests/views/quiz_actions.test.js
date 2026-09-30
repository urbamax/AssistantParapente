import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import AppEvents from '../../js/core/events.js';
import QuizService from '../../js/services/quiz_service.js';
import QuizView from '../../js/views/quiz.js';

// Spec 018 : les commandes de l'écran du QCM sont exécutées par sa propre délégation. La
// délégation globale ne doit ni avertir « Unregistered action triggered » ni les exécuter une
// seconde fois. Les menus « Autre… » du formulaire d'équipement ne doivent pas avertir non plus.
const indexHtml = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');

describe('quiz and equipment controls with both delegations active (spec 018)', () => {
    let warn;
    let quizClick;

    beforeAll(() => {
        AppEvents.init();
    });

    beforeEach(() => {
        quizClick = QuizView.handleClick.bind(QuizView); // comme QuizView.mount()
        document.body.addEventListener('click', quizClick);
        warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        document.body.removeEventListener('click', quizClick);
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    const unregisteredWarnings = () =>
        warn.mock.calls.filter((args) => String(args[0]).startsWith('Unregistered action triggered'));

    const click = (action, args) => {
        document.body.innerHTML = `<button data-action="${action}"${args ? ` data-args="${args}"` : ''}>x</button>`;
        document.querySelector('button').click();
    };

    it.each([
        ['QuizsetThemeSort', 'setThemeSort'],
        ['toggle-option', 'toggleOptionSelection'],
        ['quiz-voice-cancel', 'renderVoiceBar'],
    ])('runs the quiz action %s once and does not warn', (action, method) => {
        const spy = vi.spyOn(QuizView, method).mockImplementation(() => {});

        click(action);

        expect(spy).toHaveBeenCalledTimes(1);
        expect(unregisteredWarnings()).toEqual([]);
    });

    // Ces réglages sont enregistrés dans js/core/main.js (non chargé ici : le test enregistre un
    // équivalent). L'écran du QCM ne doit pas les appliquer une seconde fois.
    it.each([
        ['setQcmMode', "'EXAM'", 'setMode', 'updateModeUI'],
        ['setQcmCount', "'20'", 'setCount', 'updateCountUI'],
        ['setMasteryTarget', "'3'", 'setMasteryTarget', 'updateMasteryTargetUI'],
    ])('applies the setting %s once', (action, args, serviceMethod, uiMethod) => {
        const set = vi.spyOn(QuizService, serviceMethod).mockImplementation(() => {});
        vi.spyOn(QuizView, uiMethod).mockImplementation(() => {});
        AppEvents.register(action, (value) => QuizService[serviceMethod](value));

        click(action, args);

        expect(set).toHaveBeenCalledTimes(1);
        expect(unregisteredWarnings()).toEqual([]);
    });

    it('keeps the quiz settings registered in main.js', () => {
        const main = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'core', 'main.js'), 'utf8');
        for (const action of ['setQcmMode', 'setQcmCount', 'setMasteryTarget', 'goBack']) {
            expect(main).toContain(`AppEvents.register('${action}'`);
        }
    });

    it('still warns for an action nobody handles', () => {
        click('spec018NoSuchAction');

        expect(unregisteredWarnings()).toEqual([['Unregistered action triggered: spec018NoSuchAction']]);
    });

    it.each(['eq-marque', 'eq-modele', 'eq-taille', 'eq-couleur'])(
        'changing the equipment select #%s does not warn',
        (id) => {
            // Le vrai <select> de index.html (seul le fragment : analyser toute la page ferait
            // charger ses scripts et styles par happy-dom).
            const markup = new RegExp(`<select\\s+id="${id}"[\\s\\S]*?</select>`).exec(indexHtml);
            expect(markup).not.toBeNull();
            document.body.innerHTML = markup[0];
            const select = /** @type {HTMLSelectElement} */ (document.getElementById(id));

            select.value = 'Autre';
            select.dispatchEvent(new Event('change', { bubbles: true }));

            expect(unregisteredWarnings()).toEqual([]);
        },
    );
});
