import { describe, it, expect } from 'vitest';
import { buildRevisionAxes } from '../../js/services/revision_axes.js';
import { buildRevisionAxesDashboardHtml } from '../../js/views/quiz_axes_html.js';

const DAY = 86_400_000;
const choices = [
    { text: 'BONNE-SECRETE', pts: 6 },
    { text: 'PIEGE-SECRET', pts: -6 },
    { text: 'AUTRE-SECRET', pts: -6 },
];
const question = (code, extra = {}) => ({
    code,
    question: `ENONCE-SECRET ${code}`,
    choices,
    explication: 'Pourquoi la bonne.\nPourquoi ce piège est faux.\nPourquoi l’autre est faux.',
    parapente: true,
    levels: ['BI'],
    ...extra,
});
const day = (d) => Math.floor(Date.now() / DAY) - d;
const log = (...pairs) => pairs.map(([d, mask]) => day(d) * 1024 + mask);
const good = { total: 5, correct: 5, streak: 5, lastSeen: Date.now(), recent: [1, 1, 1, 1, 1] };

const questions = ['U1V', 'U2V', 'U3V', 'U4V'].map((c) => question(c));
const statsWith = (extra) => ({
    questions: { ...Object.fromEntries(questions.map((q) => [q.code, { ...good }])), ...extra },
});
const render = (stats, ui = {}) => {
    const report = buildRevisionAxes(questions, stats, [], { level: 'BI' });
    return { report, html: buildRevisionAxesDashboardHtml(report, ui) };
};

describe('axes de révision : pièges', () => {
    it('adds the trap items to the report without the question or choice texts', () => {
        const { report } = render(statsWith({ U1V: { ...good, choicePicks: [0, 2, 0], answers: log([0, 0b010]) } }));
        const axis = report.axes.find((a) => a.id === 'pilotage-plan-vol-vent');
        expect(axis.traps.active).toBe(1);
        expect(axis.traps.items[0]).toMatchObject({
            questionId: 'U1V',
            status: 'active',
            count: 2,
            explanation: 'Pourquoi ce piège est faux.',
            isOptionExplanation: true,
        });
        expect(JSON.stringify(report)).not.toMatch(/PIEGE-SECRET|ENONCE-SECRET|BONNE-SECRET/);
        expect(report.trapTotals).toEqual({ active: 1, consolidating: 0, overcome: 0, axes: 1 });
    });

    it('falls back to the whole explanation when it cannot be split per choice', () => {
        const q = question('U1V', { explication: 'Un seul bloc d’explication.' });
        const report = buildRevisionAxes([q], { questions: { U1V: { ...good, answers: log([0, 0b010]) } } }, [], {
            level: 'BI',
        });
        expect(report.axes[0].traps.items[0]).toMatchObject({
            explanation: 'Un seul bloc d’explication.',
            isOptionExplanation: false,
        });
    });

    it('shows the trap pill, the block and the workshop shortcut on the card, never the QCM texts', () => {
        const { html } = render(statsWith({ U1V: { ...good, answers: log([0, 0b010]) } }));
        expect(html).toContain('1 piège actif');
        expect(html).toContain('revision-axis-traps');
        expect(html).toContain('Pourquoi ce piège est faux.');
        expect(html).toContain('data-action="QuizstartTrapsWorkshop"');
        expect(html).toContain('Avec pièges actifs (1)');
        expect(html).not.toMatch(/PIEGE-SECRET|ENONCE-SECRET|BONNE-SECRET/);
    });

    it('stays silent when there is no trap', () => {
        const { html } = render(statsWith({}));
        expect(html).not.toContain('revision-axis-traps');
        expect(html).not.toContain('QuizstartTrapsWorkshop');
        expect(html).not.toContain('Avec pièges actifs');
    });

    it('lists only urgent traps by default, and the overcome ones once unfolded', () => {
        const stats = statsWith({
            U1V: {
                ...good,
                choicePicks: [0, 1, 0],
                answers: log([30, 0b010]).concat(log([29, 0b001], [25, 0b001], [20, 0b001])),
            },
            U2V: { ...good, answers: log([0, 0b010]) },
            U3V: { ...good, answers: log([0, 0b010]) },
            U4V: { ...good, answers: log([0, 0b010]) },
        });
        const folded = render(stats).html;
        expect((folded.match(/revision-axis-trap-item"/g) || []).length).toBe(3);
        expect(folded).toContain('Voir tous mes pièges (4)');
        const unfolded = render(stats, { expandedIds: new Set(['traps:pilotage-plan-vol-vent']) }).html;
        expect((unfolded.match(/revision-axis-trap-item"/g) || []).length).toBe(4);
        expect(unfolded).toContain('data-trap-status="overcome"');
    });

    it('filters the axes with an active trap', () => {
        const { html } = render(statsWith({ U1V: { ...good, answers: log([0, 0b010]) } }), { statusFilter: 'TRAPS' });
        expect(html).toContain('aria-pressed="true"');
        expect(html).toContain('data-axis-id="pilotage-plan-vol-vent"');
    });
});
