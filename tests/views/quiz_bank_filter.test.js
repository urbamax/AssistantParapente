import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import AppEvents from '../../js/core/events.js';
import QuizView from '../../js/views/quiz.js';

// Spec 017 : le filtre de thème de la banque de questions est géré par l'écouteur propre de
// l'écran du QCM. La délégation globale ne doit ni avertir « Unregistered action triggered » ni
// déclencher un second rendu.
const indexHtml = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');

describe('quiz bank theme filter (spec 017)', () => {
    beforeAll(() => {
        AppEvents.init();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    it('renders the chosen theme once and does not warn', () => {
        // Le vrai <select> de index.html, pour tester ses attributs réels (seul le fragment est
        // extrait : analyser toute la page ferait charger ses scripts et styles par happy-dom).
        const realSelect = /<select id="bank-theme-filter"[\s\S]*?<\/select>/.exec(indexHtml);
        expect(realSelect).not.toBeNull();
        document.body.innerHTML = `${realSelect[0]}<div id="bank-results"></div>`;

        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const render = vi.spyOn(QuizView, 'renderBankContent').mockImplementation(() => {});
        const select = /** @type {HTMLSelectElement} */ (document.getElementById('bank-theme-filter'));
        const onChange = QuizView.handleChange.bind(QuizView); // comme QuizView.mount()
        select.addEventListener('change', onChange);

        select.value = 'Météo';
        select.dispatchEvent(new Event('change', { bubbles: true }));

        expect(render).toHaveBeenCalledTimes(1);
        expect(render).toHaveBeenCalledWith('Météo');
        expect(warn.mock.calls.filter((args) => String(args[0]).startsWith('Unregistered action'))).toEqual([]);
    });
});
