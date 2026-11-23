import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import QuizView from '../../js/views/quiz.js';
import { explanationHtml } from '../../js/views/quiz_explanation.js';
import QuizService from '../../js/services/quiz_service.js';
import GlobalState from '../../js/core/app_state.js';
import GdprEngine from '../../js/gdpr_engine.js';
import { buildQuestionAnswersHtml } from '../../js/views/quiz_stats_html.js';

// Spec 024 : les textes du quiz passent dans le catalogue sans rien changer à l'affichage. Ces
// instantanés ont été enregistrés AVANT le déplacement ; ils doivent rester identiques.
const INDEX = readFileSync('index.html', 'utf8');
const SCREENS = (() => {
    const tpl = document.createElement('template');
    tpl.innerHTML = INDEX.slice(INDEX.indexOf('<div id="qcm-setup-screen"'));
    return ['qcm-setup-screen', 'qcm-screen', 'stats-screen', 'qcm-bank-screen']
        .map((id) => tpl.content.getElementById(id).outerHTML)
        .join('')
        .replace(/\s(src|href)="https?:[^"]*"/g, '');
})();

const Q = (code, theme, question, explication, extra = {}) => ({
    code,
    theme,
    question,
    explication,
    parapente: true,
    choices: [
        { text: `${code} bonne`, pts: 2 },
        { text: `${code} fausse`, pts: -1 },
        { text: `${code} neutre`, pts: 0 },
    ],
    ...extra,
});
const QUESTIONS = [
    Q('A1V', 'Météo', 'Qu’est-ce qu’un front ?', 'Un front sépare deux masses d’air.', {
        courseId: 'general/20240409-ffvl-formation-espacesaeriens',
        coursePage: 3,
    }),
    Q('E2VB', 'Mécavol', 'La finesse dépend de :', 'De la polaire.'),
    Q('S3V', 'Réglementation', 'La zone R est :', ''),
    Q('F4V', 'Facteurs humains', 'Le stress :', 'Il réduit l’attention.'),
];
const STATS = {
    totalQuestions: 9,
    themes: {},
    questions: {
        A1V: { total: 2, correct: 2, streak: 3 },
        E2VB: { total: 4, correct: 1, streak: 0 },
        S3V: { total: 1, correct: 0, streak: 0 },
    },
};
const EXAMS = [
    {
        id: 'x1',
        date: '2026-09-28T09:30:00',
        level: 'BI',
        score: 1,
        total: 2,
        results: [
            { isCorrect: true, question: QUESTIONS[0], selected: [QUESTIONS[0].choices[0]] },
            { isCorrect: false, question: QUESTIONS[1], selected: [QUESTIONS[1].choices[1]] },
        ],
    },
    { id: 'x2', date: '2026-09-27T09:30:00', level: 'BI', score: 2, total: 2, invalidated: true, results: [] },
];

const dialogs = [];
const html = (id) => document.getElementById(id).innerHTML;
const text = (id) => document.getElementById(id).innerText || document.getElementById(id).textContent;

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-30T10:00:00'));
    document.body.innerHTML = SCREENS;
    dialogs.length = 0;
    window.alert = (m) => dialogs.push(`alert: ${m}`);
    window.confirm = (m) => (dialogs.push(`confirm: ${m}`), true);
    vi.spyOn(GlobalState, 'get').mockImplementation((key) => (key === 'level' ? 'BI' : undefined));
    vi.spyOn(GdprEngine, 'isConsentGranted').mockReturnValue(true);
    vi.spyOn(QuizService, 'getQuestions').mockReturnValue(QUESTIONS);
    vi.spyOn(QuizService, 'getQuestionByCode').mockImplementation((c) => QUESTIONS.find((q) => q.code === c));
    vi.spyOn(QuizService, 'getPersistentStats').mockImplementation(() => structuredClone(STATS));
    vi.spyOn(QuizService, 'getExamHistory').mockReturnValue(EXAMS);
    Object.assign(QuizService.state, {
        isLoaded: true,
        loadingError: null,
        qcmIndex: 0,
        qcmSessionData: QUESTIONS.slice(0, 2),
        examResults: [],
        invalidated: false,
        qcmConfig: { mode: 'TRAINING', count: 10, theme: 'ALL', masteryTarget: 75 },
    });
    Object.assign(QuizView.state, {
        masteryFilter: 'ALL',
        themeFilter: null,
        themeSort: 'alpha',
        themeSortDir: 'asc',
        questionSort: 'rate',
        questionSortDir: 'asc',
    });
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('quiz renders (spec 024: identical before and after moving the texts)', () => {
    it('question bank, full and empty', () => {
        QuizView.renderBankContent('ALL');
        const full = html('bank-results');
        QuizView.renderBankContent('Inexistant');
        expect({ full, empty: html('bank-results') }).toMatchSnapshot();
    });

    it('mode descriptions', () => {
        const out = {};
        for (const mode of ['EXAM', 'REVISION', 'MASTERY', 'TRAINING']) {
            QuizView.updateModeUI(mode);
            out[mode] = { description: text('mode-description'), theme: text('qcm-theme-label') };
        }
        expect(out).toMatchSnapshot();
    });

    it('statistics: consent off, loading, loading error, no question', () => {
        const out = {};
        GdprEngine.isConsentGranted.mockReturnValue(false);
        QuizView.renderStats();
        out.noConsent = html('stats-content');
        GdprEngine.isConsentGranted.mockReturnValue(true);
        QuizService.state.isLoaded = false;
        QuizView.renderStats();
        out.loading = html('stats-content');
        QuizService.state.isLoaded = true;
        QuizService.state.loadingError = 'CORS';
        QuizView.renderStats();
        out.error = html('stats-content');
        QuizService.state.loadingError = null;
        QuizService.getQuestions.mockReturnValue([]);
        QuizView.renderStats();
        out.empty = html('stats-content');
        expect(out).toMatchSnapshot();
    });

    it('statistics with every filter label', () => {
        const out = {};
        for (const filter of ['ALL', 'PERFECT', 'EXCELLENT', 'VERY_GOOD', 'GOOD', 'POOR', 'FAILED', 'NOT_ATTEMPTED']) {
            QuizView.state.masteryFilter = filter;
            QuizView.renderStats();
            out[filter] = html('stats-content');
        }
        QuizView.state.masteryFilter = 'ALL';
        QuizView.state.themeFilter = 'Météo';
        QuizView.state.themeSort = 'rate';
        QuizView.renderStats();
        out.theme = html('stats-content');
        expect(out).toMatchSnapshot();
    });

    it('statistics for all levels, without attempts, and question sort buttons', () => {
        GlobalState.get.mockImplementation((key) => (key === 'level' ? 'ALL' : undefined));
        QuizService.getPersistentStats.mockReturnValue({ totalQuestions: 0, themes: {}, questions: {} });
        QuizService.getExamHistory.mockReturnValue([]);
        QuizView.renderStats();
        const none = html('stats-content');
        QuizService.getPersistentStats.mockImplementation(() => structuredClone(STATS));
        QuizView.renderStats();
        QuizView.sortQuestions('attempts');
        const attempts = html('sort-questions-select');
        QuizView.sortQuestions('streak');
        const streak = html('sort-questions-select');
        QuizView.sortQuestions('date');
        const date = html('sort-questions-select');
        expect({
            none,
            attempts,
            streak,
            date,
        }).toMatchSnapshot();
    });

    it('statistics for a level without questions', () => {
        GlobalState.get.mockImplementation((key) => (key === 'level' ? 'TREUIL' : undefined));
        QuizView.renderStats();
        expect(html('stats-content')).toMatchSnapshot();
    });

    it('exam history levels and exam review', () => {
        const levels = ['BP', 'BPC', 'TREUIL'].map((level) => {
            QuizService.getExamHistory.mockReturnValue([{ ...EXAMS[1], level }]);
            GlobalState.get.mockImplementation((key) => (key === 'level' ? level : undefined));
            return QuizView.renderExamHistory();
        });
        QuizService.getExamHistory.mockReturnValue(EXAMS);
        QuizView.reviewExam('x1');
        const withErrors = html('stats-content');
        QuizService.getExamHistory.mockReturnValue([
            { ...EXAMS[0], results: [EXAMS[0].results[0]] },
            { ...EXAMS[0], id: 'x3', results: [{ isCorrect: false, code: 'Z9', question: null }] },
        ]);
        QuizView.reviewExam('x1');
        const perfect = html('stats-content');
        QuizView.reviewExam('x3');
        expect({ levels, withErrors, perfect, missing: html('stats-content') }).toMatchSnapshot();
    });

    it('question, revision badges, mastery progress, mode labels', () => {
        const out = {};
        for (const mode of ['EXAM', 'REVISION', 'MASTERY', 'TRAINING', 'OTHER']) {
            QuizService.state.qcmConfig.mode = mode;
            vi.spyOn(QuizService, 'getMasteryProgress').mockReturnValue({ target: 75, current: 40 });
            QuizView.renderQuestion(QUESTIONS[mode === 'REVISION' ? 3 : 0]);
            out[mode] = {
                label: text('qcm-mode-label'),
                progress: text('qcm-mastery-progress'),
                question: html('qcm-question-text'),
                actions: html('qcm-actions-container'),
            };
        }
        QuizService.state.qcmConfig.mode = 'REVISION';
        QuizService.state.qcmIndex = 1;
        QuizView.renderQuestion(QUESTIONS[0]);
        out.revisionSeen = html('qcm-question-text');
        expect(out).toMatchSnapshot();
    });

    it('no acronym tooltip in the question nor in the choices, only in the explanations', () => {
        const q = Q(
            'QA1',
            'Réglementation',
            'Que signifie un calage au QNH près d’une TMA ?',
            'Le QNH donne l’altitude.',
            {
                choices: [
                    { text: 'Une altitude au-dessus de la mer (QNH)', pts: 6 },
                    { text: 'Une hauteur au-dessus de la TMA', pts: -6 },
                ],
            },
        );
        QuizService.state.qcmConfig.mode = 'TRAINING';
        QuizView.renderQuestion(q);
        const screen = document.getElementById('qcm-screen');
        expect(screen.querySelectorAll('.qcm-acronym')).toHaveLength(0);
        expect(screen.textContent).toContain('QNH');
        expect(explanationHtml('Le QNH donne l’altitude.')).toContain('class="qcm-acronym"');
    });

    it('answer feedback with course link', () => {
        QuizView.renderQuestion(QUESTIONS[0]);
        QuizView.showAnswerFeedback(
            { selected: [QUESTIONS[0].choices[0]], isCorrect: true, question: QUESTIONS[0] },
            true,
        );
        expect({ actions: html('qcm-actions-container'), feedback: html('qcm-feedback') }).toMatchSnapshot();
    });

    it('puts each choice explanation under the choice, always foldable: open for a fault, shut otherwise', () => {
        const q = Q(
            'B7V',
            'Météo',
            'Question à trois choix',
            'Pourquoi la bonne.\nPourquoi la fausse est fausse.\nPourquoi la neutre.',
            { courseId: 'general/20240409-ffvl-formation-espacesaeriens', coursePage: 3 },
        );
        QuizService.getQuestionByCode.mockImplementation((c) =>
            c === q.code ? q : QUESTIONS.find((x) => x.code === c),
        );
        QuizView.renderQuestion(q);
        const folds = () => [...document.querySelectorAll('#qcm-choices details.qcm-option-explanation')];
        const state = () => folds().map((e) => `${e.dataset.kind}:${e.hasAttribute('open') ? 'open' : 'shut'}`);

        // Fausse cochée, bonne oubliée : deux fautes ouvertes, la neutre repliée, tout repliable.
        QuizView.showAnswerFeedback({ selected: [q.choices[1]], isCorrect: false, question: q }, true);
        expect(state()).toEqual(['missed:open', 'incorrect:open', 'ok:shut']);
        expect(folds()[1].textContent).toContain('Pourquoi la fausse est fausse.');
        expect(document.querySelector('#qcm-feedback details.instructor-feedback')).toBeNull();

        // Le bouton du cours est sous la bonne réponse, pas sous les autres, pas dans le bloc du bas.
        expect(folds()[0].querySelector('[data-action="openUrl"]')).not.toBeNull();
        expect(folds()[1].querySelector('[data-action="openUrl"]')).toBeNull();
        expect(folds()[2].querySelector('[data-action="openUrl"]')).toBeNull();
        expect(document.querySelector('#qcm-feedback [data-action="openUrl"]')).toBeNull();

        // Chaque pli est dans le même groupe que son choix (la flèche se pose sur la ligne du choix).
        expect(folds().every((f) => f.parentElement.classList.contains('qcm-option-group'))).toBe(true);
        expect(folds().every((f) => f.previousElementSibling.classList.contains('qcm-option'))).toBe(true);

        // On peut replier ce qui est ouvert.
        folds()[1].removeAttribute('open');
        expect(state()[1]).toBe('incorrect:shut');

        // Appelé de nouveau (retour sur la question) : pas de doublon.
        QuizView.showAnswerFeedback({ selected: [q.choices[1]], isCorrect: false, question: q }, true);
        expect(folds()).toHaveLength(3);

        // Bonne réponse complète : tout est replié, la zone du bas est masquée.
        QuizView.renderQuestion(q);
        QuizView.showAnswerFeedback({ selected: [q.choices[0]], isCorrect: true, question: q }, true);
        expect(state()).toEqual(['ok:shut', 'ok:shut', 'ok:shut']);
        expect(document.getElementById('qcm-feedback').style.display).toBe('none');
    });

    it('explanation fold: shut after a complete correct answer, open after a miss or a wrong answer', () => {
        QuizView.renderQuestion(QUESTIONS[0]);
        const show = (isCorrect) => {
            QuizView.showAnswerFeedback({ selected: [], isCorrect, question: QUESTIONS[0] }, true);
            return document.querySelector('#qcm-feedback details.instructor-feedback');
        };
        expect(show(true).hasAttribute('open')).toBe(false);
        expect(show(false).hasAttribute('open')).toBe(true);
    });

    it('results: training with errors, exam passed, failed and invalidated, no error', () => {
        const out = {};
        const results = [
            { isCorrect: false, question: QUESTIONS[0], selected: [QUESTIONS[0].choices[1], QUESTIONS[0].choices[2]] },
            { isCorrect: true, question: QUESTIONS[1], selected: [QUESTIONS[1].choices[0]] },
        ];
        vi.spyOn(QuizService, 'saveExamHistory').mockImplementation(() => {});
        const run = (mode, examResults, invalidated = false) => {
            QuizService.state.qcmConfig.mode = mode;
            QuizService.state.examResults = examResults;
            QuizService.state.invalidated = invalidated;
            QuizView.renderExamResults();
            return {
                label: text('qcm-mode-label'),
                body: html('qcm-question-text'),
                actions: html('qcm-actions-container'),
            };
        };
        out.training = run('TRAINING', results);
        out.revision = run('REVISION', results);
        out.mastery = run('MASTERY', results);
        out.examFailed = run('EXAM', results);
        out.examPassed = run('EXAM', [results[1], results[1]]);
        out.examInvalidated = run('EXAM', [results[1], results[1]], true);
        expect(out).toMatchSnapshot();
        expect(out.examInvalidated.body).toContain('INVALIDÉ');
        expect(out.examInvalidated.body).not.toContain('Récapitulatif des questions');
        expect(out.examInvalidated.body).not.toContain("Félicitations, vous n'avez fait aucune erreur !");
        expect(out.examInvalidated.body).not.toContain('bank-container');
    });

    it('dialogs', async () => {
        vi.spyOn(QuizView, 'renderExamResults').mockImplementation(() => {});
        QuizView.invalidateExam();
        // L'alerte est montrée au retour de l'élève sur la page.
        document.dispatchEvent(new Event('visibilitychange'));
        vi.spyOn(QuizView, 'renderStats').mockImplementation(() => {});
        QuizView.resetStats();
        globalThis.URL.createObjectURL = () => 'blob:x';
        globalThis.URL.revokeObjectURL = () => {};
        QuizView.exportData();
        QuizService.getPersistentStats.mockImplementation(() => {
            throw new Error('x');
        });
        vi.spyOn(console, 'error').mockImplementation(() => {});
        QuizView.exportData();
        expect(dialogs).toMatchSnapshot();
    });
});

// Spec 025 : le nom du thème filtré est affiché comme du texte, et la ponctuation suit l'usage
// français (espace avant les deux-points).
describe('statistics filter label (spec 025)', () => {
    it('shows a theme name with markup as text', () => {
        QuizView.state.themeFilter = '<img src=x onerror="window.__spec025=1">';
        QuizView.renderStats();
        const content = document.getElementById('stats-content');
        expect(content.querySelector('img')).toBeNull();
        expect(content.textContent).toContain('(Thème : <img src=x onerror="window.__spec025=1">)');
    });

    it('puts a space before the colon in « Thème : » and « Détail : »', () => {
        QuizView.state.themeFilter = 'Météo';
        QuizView.renderStats();
        expect(text('stats-content')).toContain('(Thème : Météo)');
        QuizService.state.loadingError = 'CORS';
        QuizView.renderStats();
        expect(text('stats-content')).toContain('Détail : CORS');
    });
});

// Spec 027 : sur l'écran des résultats, le code, l'énoncé et l'explication d'une question fausse
// sont affichés comme du texte (audit C6).
describe('results screen escapes quiz texts (spec 027)', () => {
    it('shows markup in the code, statement and explanation as text', () => {
        const markup = (tag) => `<img src=x data-spec027="${tag}">`;
        const question = Q(
            `Z1${markup('code')}`,
            'Météo',
            `Énoncé ${markup('question')}`,
            `Interdit < 1000m & ${markup('explication')}`,
        );
        QuizService.state.qcmConfig.mode = 'TRAINING';
        QuizService.state.examResults = [{ isCorrect: false, question, selected: [question.choices[1]] }];

        QuizView.renderExamResults();

        const body = document.getElementById('qcm-question-text');
        expect(body.querySelector('[data-spec027]')).toBeNull();
        expect(body.querySelector('.bank-item-code').textContent).toBe(`#${question.code}`);
        expect(body.querySelector('.bank-item-question').textContent).toBe(question.question);
        expect(body.querySelector('.bank-item-explication').textContent).toContain(question.explication);
    });
});

// Spec 061 : encart « À lire de près » dans la correction, seulement après une erreur (2026-11-23).
describe('read-closely box in the corrections (spec 061)', () => {
    const TRAPS = { A1V: ['Le mot « sépare » décide.'], E2VB: ['Deux choix ne diffèrent que d’un mot.'] };
    const box = (root) => root.querySelector('.quiz-read-closely');
    let wrong;
    beforeEach(() => {
        wrong = new Set();
        vi.spyOn(QuizService, 'getQuestionTraps').mockImplementation((c) => Object.freeze(TRAPS[c] || []));
        vi.spyOn(QuizService, 'lastAnswerWasWrong').mockImplementation((c) => wrong.has(c));
    });

    it('training: absent before the answer and after a right answer, shown after a wrong one', () => {
        QuizService.state.qcmConfig.mode = 'TRAINING';
        QuizView.renderQuestion(QUESTIONS[0]);
        expect(box(document.getElementById('qcm-screen'))).toBeNull();
        expect(document.getElementById('qcm-screen').textContent).not.toContain('« sépare »');

        QuizView.showAnswerFeedback(
            { selected: [QUESTIONS[0].choices[0]], isCorrect: true, question: QUESTIONS[0] },
            true,
        );
        expect(box(document.getElementById('qcm-feedback'))).toBeNull();

        QuizView.renderQuestion(QUESTIONS[0]);
        QuizView.showAnswerFeedback(
            { selected: [QUESTIONS[0].choices[1]], isCorrect: false, question: QUESTIONS[0] },
            true,
        );
        const feedback = document.getElementById('qcm-feedback');
        expect(box(feedback).textContent).toContain('Le mot « sépare » décide.');
        expect(feedback.style.display).toBe('block');

        QuizView.renderQuestion(QUESTIONS[3]);
        QuizView.showAnswerFeedback(
            { selected: [QUESTIONS[3].choices[1]], isCorrect: false, question: QUESTIONS[3] },
            true,
        );
        expect(box(document.getElementById('qcm-feedback'))).toBeNull();
    });

    it('end-of-series review shows the box above a wrong answer’s explanations', () => {
        QuizService.state.qcmConfig.mode = 'TRAINING';
        QuizService.state.examResults = [
            { isCorrect: false, question: QUESTIONS[1], selected: [QUESTIONS[1].choices[1]] },
        ];
        QuizView.renderExamResults();
        expect(box(document.getElementById('qcm-question-text')).textContent).toContain('ne diffèrent que');
    });

    it('question bank shows the box only when the last answer to the question was wrong', () => {
        QuizView.renderBankContent('ALL');
        const item = () => [...document.querySelectorAll('.bank-item')].find((i) => i.textContent.includes('A1V'));
        expect(box(item())).toBeNull();
        wrong.add('A1V');
        QuizView.renderBankContent('ALL');
        expect(box(item())).not.toBeNull();
    });

    it('statistics: exam review shows the box for errors, the detailed list after a wrong last answer', () => {
        QuizView.reviewExam('x1');
        expect(box(document.getElementById('stats-content'))).not.toBeNull();
        const detail = document.createElement('div');
        detail.innerHTML = buildQuestionAnswersHtml(QuizView, QUESTIONS[0], 'A1V');
        expect(box(detail)).toBeNull();
        wrong.add('A1V');
        detail.innerHTML = buildQuestionAnswersHtml(QuizView, QUESTIONS[0], 'A1V');
        expect(box(detail).textContent).toContain('« sépare »');
        wrong.add('F4V');
        detail.innerHTML = buildQuestionAnswersHtml(QuizView, QUESTIONS[3], 'F4V');
        expect(box(detail)).toBeNull();
    });
});

// Spec 063 : option « Questions à piège » de l'écran de lancement.
describe('trap series option in the quiz setup (spec 063)', () => {
    const group = () => document.getElementById('qcm-traps-group');
    const box = () => /** @type {HTMLInputElement} */ (document.getElementById('qcm-traps-only'));
    afterEach(() => QuizService.setTrapsOnly(false));

    it('is shown in training mode only', () => {
        vi.spyOn(QuizService, 'hasQuestionTraps').mockReturnValue(true);
        const shown = {};
        for (const mode of ['EXAM', 'REVISION', 'MASTERY', 'TRAINING']) {
            QuizView.updateModeUI(mode);
            shown[mode] = group().style.display !== 'none';
        }
        expect(shown).toEqual({ EXAM: false, REVISION: false, MASTERY: false, TRAINING: true });
        expect(box().disabled).toBe(false);
    });

    it('is disabled when the trap sentences are not loaded', () => {
        vi.spyOn(QuizService, 'hasQuestionTraps').mockReturnValue(false);
        QuizView.updateModeUI('TRAINING');
        expect(box().disabled).toBe(true);
        expect(box().checked).toBe(false);
    });

    it('sets the option when ticked and labels the series', () => {
        vi.spyOn(QuizService, 'hasQuestionTraps').mockReturnValue(true);
        QuizView.updateModeUI('TRAINING');
        box().checked = true;
        QuizView.handleChange({ target: box() });
        expect(QuizService.state.qcmConfig.trapsOnly).toBe(true);
        QuizService.state.qcmConfig.mode = 'TRAINING';
        vi.spyOn(QuizService, 'startSession').mockReturnValue(QUESTIONS[0]);
        QuizView.startSession();
        expect(text('qcm-mode-label')).toBe('MODE ENTRAÎNEMENT · QUESTIONS À PIÈGE');
        // Une série lancée depuis les statistiques n'en est pas une.
        QuizView.launchWorkshop([QUESTIONS[0]], null);
        expect(text('qcm-mode-label')).not.toContain('PIÈGE');
        box().checked = false;
        QuizView.handleChange({ target: box() });
        expect(QuizService.state.qcmConfig.trapsOnly).toBe(false);
    });
});

// Régression (spec 061, trouvée par spec 063) : l'encart de la question précédente ne doit pas rester
// caché dans la page quand la question suivante s'affiche.
describe('read-closely box does not linger on the next question', () => {
    it('clears the previous correction when the next question renders', () => {
        vi.spyOn(QuizService, 'getQuestionTraps').mockImplementation((c) =>
            Object.freeze(c === 'A1V' ? ['Le mot « sépare » décide.'] : []),
        );
        QuizService.state.qcmConfig.mode = 'TRAINING';
        QuizView.renderQuestion(QUESTIONS[0]);
        QuizView.showAnswerFeedback(
            { selected: [QUESTIONS[0].choices[1]], isCorrect: false, question: QUESTIONS[0] },
            true,
        );
        expect(document.querySelector('.quiz-read-closely')).not.toBeNull();
        QuizView.renderQuestion(QUESTIONS[1]);
        expect(document.querySelector('.quiz-read-closely')).toBeNull();
        expect(document.getElementById('qcm-feedback').textContent).not.toContain('« sépare »');
    });
});

// Spec 064 : section « Vos pièges » des statistiques et entraînement par type.
describe('« Vos pièges » in the statistics (spec 064)', () => {
    const TYPES = {
        A1V: [{ type: 'absolu', choices: [1] }],
        E2VB: [{ type: 'un_mot', choices: [0] }],
    };
    const section = () => document.getElementById('stats-traps');
    beforeEach(() => {
        vi.spyOn(QuizService, 'hasTrapTypes').mockReturnValue(true);
        vi.spyOn(QuizService, 'getTrapTypes').mockImplementation((c) => Object.freeze(TYPES[c] || []));
    });
    afterEach(() => {
        QuizService.setTrapsOnly(false);
        QuizService.setTrapType(null);
    });
    const withAnswers = (answers) => {
        const s = structuredClone(STATS);
        for (const [code, masks] of Object.entries(answers)) {
            s.questions[code] = { ...(s.questions[code] || {}), answers: masks.map((m, i) => (20000 + i) * 1024 + m) };
        }
        QuizService.getPersistentStats.mockImplementation(() => structuredClone(s));
    };

    it('lists the types met, most falls first, with « N sur M »', () => {
        // A1V : le choix piégé (index 1, négatif) coché deux fois sur deux ; E2VB : bonne réponse oubliée une fois sur deux.
        withAnswers({ A1V: [0b011, 0b010], E2VB: [0b001, 0b000] });
        QuizView.renderStats();
        const rows = [...section().querySelectorAll('[data-trap-type]')];
        expect(rows.map((r) => r.getAttribute('data-trap-type'))).toEqual(['absolu', 'un_mot']);
        expect(rows[0].textContent).toContain('Mots absolus');
        expect(rows[0].textContent).toContain('2 fois sur 2');
        expect(rows[1].textContent).toContain('1 fois sur 2');
        expect(rows[0].querySelector('[data-action="QuizstartTrapTypeTraining"]').getAttribute('data-args')).toBe(
            'absolu',
        );
    });

    it('invites to train when no trap was met, and is absent without type data', () => {
        QuizView.renderStats();
        expect(section().textContent).toContain('Questions à piège');
        expect(section().querySelectorAll('[data-trap-type]')).toHaveLength(0);
        QuizService.hasTrapTypes.mockReturnValue(false);
        QuizView.renderStats();
        expect(section()).toBeNull();
    });

    it('« S’entraîner » starts a series of that type, labelled with it, and leaves the setup as it was', () => {
        vi.spyOn(QuizService, 'startSession').mockImplementation(() => {
            expect(QuizService.state.qcmConfig.trapsOnly).toBe(true);
            expect(QuizService.state.qcmConfig.trapType).toBe('absolu');
            return QUESTIONS[0];
        });
        QuizView.startTrapTypeTraining('absolu');
        expect(text('qcm-mode-label')).toBe('QUESTIONS À PIÈGE · MOTS ABSOLUS');
        expect(QuizService.state.qcmConfig.trapType).toBe(null);
        expect(QuizService.state.qcmConfig.trapsOnly).toBe(false);
    });
});
