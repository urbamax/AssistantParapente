import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import SafetyView, {
    PREFLIGHT_CHECKLIST,
    READY_CHECKLIST,
    SIGR_PLATES,
    SIGR_STORAGE_KEY,
    readyVerdict,
} from '../../js/views/safety.js';

const questions = READY_CHECKLIST.flatMap((d) => d.questions);
const allAnswers = (pick) => Object.fromEntries(questions.map((q) => [q.id, pick(q)]));
const indexOf = (q, level) => q.answers.findIndex(([, l]) => l === level);

async function mountFresh() {
    document.body.innerHTML = '<div id="safety-root"></div>';
    SafetyView._rendered = false;
    SafetyView.checked.clear();
    SafetyView.readyAnswers = {};
    SafetyView.position = null;
    await SafetyView.mount({});
}

describe('SafetyView', () => {
    beforeEach(async () => {
        localStorage.clear();
        await mountFresh();
    });

    it('keeps the official 7-point prévol from the Initiation booklet', () => {
        expect(PREFLIGHT_CHECKLIST.flatMap((g) => g.items)).toHaveLength(7);
        expect(document.querySelectorAll('[data-check-index]')).toHaveLength(7);
    });

    it('opens on the emergency tab with the 112 call and safety frequency', () => {
        expect(document.getElementById('safety-panel-urgence').hidden).toBe(false);
        expect(document.getElementById('safety-panel-prevol').hidden).toBe(true);
        expect(document.querySelector('a[href="tel:112"]')).not.toBeNull();
        expect(document.getElementById('safety-panel-urgence').textContent).toContain('143,9875 MHz');
    });

    it('switches tabs and ignores unknown tab names', () => {
        SafetyView.switchTab('prevol');
        expect(document.getElementById('safety-panel-prevol').hidden).toBe(false);
        expect(document.getElementById('safety-tab-prevol').getAttribute('aria-selected')).toBe('true');
        SafetyView.switchTab('nope');
        expect(document.getElementById('safety-panel-prevol').hidden).toBe(false);
    });

    it('ticks prévol items, shows completion, and resets', () => {
        for (let i = 0; i < 7; i++) SafetyView.toggleCheck(String(i));
        expect(document.getElementById('safety-check-progress').textContent).toBe('7 / 7');
        expect(document.getElementById('safety-check-done').hidden).toBe(false);

        SafetyView.toggleCheck('3');
        expect(document.querySelector('[data-check-index="3"]').getAttribute('aria-checked')).toBe('false');
        expect(document.getElementById('safety-check-done').hidden).toBe(true);

        SafetyView.resetChecklist();
        expect(document.getElementById('safety-check-progress').textContent).toBe('0 / 7');
    });

    describe('readyVerdict (livret 9BD)', () => {
        it('is incomplete until every question is answered', () => {
            expect(readyVerdict({})).toBe('incomplete');
        });

        it('is green only when everything is green', () => {
            expect(readyVerdict(allAnswers((q) => indexOf(q, 'green')))).toBe('green');
        });

        it('is yellow with one yellow and no red', () => {
            const answers = allAnswers((q) => indexOf(q, 'green'));
            answers.conditions = indexOf(
                questions.find((q) => q.id === 'conditions'),
                'yellow',
            );
            expect(readyVerdict(answers)).toBe('yellow');
        });

        it('is red as soon as any answer is red', () => {
            const answers = allAnswers((q) => indexOf(q, 'green'));
            answers.attache = indexOf(
                questions.find((q) => q.id === 'attache'),
                'red',
            );
            expect(readyVerdict(answers)).toBe('red');
        });
    });

    it('displays the verdict once the ready check-list is complete', () => {
        const verdict = document.getElementById('safety-ready-verdict');
        questions.forEach((q) => {
            const btn = document.querySelector(`[data-question="${q.id}"][data-answer="0"]`);
            SafetyView.answerReady(null, null, btn);
        });
        expect(verdict.hidden).toBe(false);
        expect(verdict.classList.contains('safety-verdict-green')).toBe(true);

        SafetyView.resetReady();
        expect(verdict.hidden).toBe(true);
    });

    describe('ready check-list answer bias', () => {
        afterEach(() => vi.restoreAllMocks());

        const order = (id) =>
            [...document.querySelectorAll(`[data-question="${id}"]`)].map((b) => b.dataset.answer).join('');

        it('shuffles the answers instead of always listing green first', async () => {
            vi.spyOn(Math, 'random').mockReturnValue(0);
            await mountFresh();
            expect(order('vie')).toBe('120');
            // Chaque bouton garde l'index (donc la couleur) de sa réponse.
            const btn = document.querySelector('[data-question="vie"][data-answer="2"]');
            expect(btn.textContent).toBe(questions.find((q) => q.id === 'vie').answers[2][0]);
            expect(btn.classList.contains('safety-answer-red')).toBe(true);
        });

        it('reshuffles the answers on reset', async () => {
            vi.spyOn(Math, 'random').mockReturnValue(0.9999);
            await mountFresh();
            expect(order('vie')).toBe('012');
            vi.spyOn(Math, 'random').mockReturnValue(0);
            SafetyView.resetReady();
            expect(order('vie')).toBe('120');
        });

        it('only reveals the answer colours once the check-list is complete', () => {
            const card = document.getElementById('safety-ready-verdict').closest('.safety-card');
            questions.forEach((q, n) => {
                expect(card.classList.contains('safety-ready-complete')).toBe(false);
                const btn = document.querySelector(`[data-question="${q.id}"][data-answer="0"]`);
                SafetyView.answerReady(null, null, btn);
                expect(card.classList.contains('safety-ready-complete')).toBe(n === questions.length - 1);
            });
            SafetyView.resetReady();
            expect(card.classList.contains('safety-ready-complete')).toBe(false);
        });
    });

    describe('pre-flight order bias', () => {
        afterEach(() => vi.restoreAllMocks());

        const shown = () =>
            [...document.querySelectorAll('[data-check-index]')].map((b) => ({
                i: Number(b.dataset.checkIndex),
                num: b.querySelector('.safety-check-num').textContent,
            }));

        it('shuffles the points within each phase and numbers them in display order', async () => {
            vi.spyOn(Math, 'random').mockReturnValue(0);
            await mountFresh();
            const items = shown();
            // Les étapes restent dans l'ordre : 2 points, puis 4, puis 1.
            expect(items.map((x) => x.i)).toEqual([1, 0, 3, 4, 5, 2, 6]);
            expect(items.map((x) => x.num)).toEqual(['1', '2', '3', '4', '5', '6', '7']);
            const labels = PREFLIGHT_CHECKLIST.flatMap((g) => g.items);
            const first = document.querySelector('[data-check-index]');
            expect(first.textContent).toContain(labels[1]);
        });

        it('reshuffles on reset and keeps the numbering in display order', async () => {
            vi.spyOn(Math, 'random').mockReturnValue(0.9999);
            await mountFresh();
            expect(shown().map((x) => x.i)).toEqual([0, 1, 2, 3, 4, 5, 6]);
            SafetyView.toggleCheck(0);
            vi.spyOn(Math, 'random').mockReturnValue(0);
            SafetyView.resetChecklist();
            expect(shown().map((x) => x.i)).toEqual([1, 0, 3, 4, 5, 2, 6]);
            expect(shown().map((x) => x.num)).toEqual(['1', '2', '3', '4', '5', '6', '7']);
            expect(document.querySelectorAll('[aria-checked="true"]')).toHaveLength(0);
        });

        it('reads the remaining points aloud in display order with the displayed numbers', async () => {
            vi.spyOn(Math, 'random').mockReturnValue(0);
            await mountFresh();
            const spoken = [];
            window.speechSynthesis = /** @type {any} */ ({ cancel() {}, speak: (u) => spoken.push(u.text) });
            window.SpeechSynthesisUtterance = /** @type {any} */ (
                class {
                    constructor(t) {
                        this.text = t;
                    }
                }
            );
            const labels = PREFLIGHT_CHECKLIST.flatMap((g) => g.items);
            SafetyView.toggleCheck(1); // affiché en n° 1
            SafetyView.readChecklist();
            expect(spoken[0]).not.toContain(labels[1]);
            expect(spoken[0]).toContain(`Point 2 : ${labels[0]}.`);
            expect(spoken[0].indexOf(labels[0])).toBeLessThan(spoken[0].indexOf(labels[3]));
            delete window.speechSynthesis;
        });
    });

    describe('SIGR rating bias', () => {
        afterEach(() => vi.restoreAllMocks());

        const order = (plate) =>
            [...document.querySelectorAll(`[data-plate="${plate}"][data-rating]`)].map((b) => b.dataset.rating);

        it('shuffles the two ratings instead of always listing « Solide » first', async () => {
            vi.spyOn(Math, 'random').mockReturnValue(0);
            await mountFresh();
            expect(order('mental')).toEqual(['weak', 'solid']);
            const weak = document.querySelector('[data-plate="mental"][data-rating="weak"]');
            expect(weak.classList.contains('safety-rate-weak')).toBe(true);
            expect(weak.textContent).toBe('À renforcer');
        });

        it('only reveals the rating colours once every plate is rated', () => {
            const card = document.getElementById('safety-sigr-summary').closest('.safety-card');
            SIGR_PLATES.forEach((p, n) => {
                expect(card.classList.contains('safety-sigr-complete')).toBe(false);
                const btn = document.querySelector(`[data-plate="${p.id}"][data-rating="solid"]`);
                SafetyView.ratePlate(null, null, btn);
                expect(card.classList.contains('safety-sigr-complete')).toBe(n === SIGR_PLATES.length - 1);
            });
            // Effacer une note masque de nouveau les couleurs.
            SafetyView.ratePlate(null, null, document.querySelector('[data-plate="mental"][data-rating="solid"]'));
            expect(card.classList.contains('safety-sigr-complete')).toBe(false);
        });
    });

    it('persists SIGR ratings and toggles a rating off on second press', () => {
        const btn = document.querySelector('[data-plate="mental"][data-rating="weak"]');
        SafetyView.ratePlate(null, null, btn);
        expect(JSON.parse(localStorage.getItem(SIGR_STORAGE_KEY)).ratings).toEqual({ mental: 'weak' });
        expect(btn.getAttribute('aria-pressed')).toBe('true');
        expect(document.getElementById('safety-sigr-summary').textContent).toContain('Mental');

        SafetyView.ratePlate(null, null, btn);
        expect(JSON.parse(localStorage.getItem(SIGR_STORAGE_KEY)).ratings).toEqual({});
        expect(SIGR_PLATES).toHaveLength(7);
    });

    it('renders a GPS fix in aeronautical and decimal formats', () => {
        SafetyView.setPosition({ latitude: 45.902061, longitude: 6.874283, altitude: 1999.6, accuracy: 8 });
        expect(document.getElementById('safety-position').hidden).toBe(false);
        expect(document.getElementById('safety-pos-dm').textContent).toBe("45°54.124' N 006°52.457' E");
        expect(document.getElementById('safety-pos-dd').textContent).toBe('45.90206, 6.87428');
        expect(document.getElementById('safety-pos-alt').textContent).toBe('2000 m');
        expect(SafetyView.positionText()).toContain('Précision : ± 8 m');
    });
});
