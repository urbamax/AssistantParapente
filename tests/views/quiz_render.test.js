import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import QuizView from '../../js/views/quiz.js';
import QuizService from '../../js/services/quiz_service.js';
import GlobalState from '../../js/core/app_state.js';
import GdprEngine from '../../js/gdpr_engine.js';

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
        const attempts = ['sort-rate-btn', 'sort-attempts-btn', 'sort-streak-btn'].map(html);
        QuizView.sortQuestions('streak');
        expect({
            none,
            attempts,
            streak: ['sort-rate-btn', 'sort-attempts-btn', 'sort-streak-btn'].map(html),
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

    it('answer feedback with course link', () => {
        QuizView.renderQuestion(QUESTIONS[0]);
        QuizView.showAnswerFeedback(
            { selected: [QUESTIONS[0].choices[0]], isCorrect: true, question: QUESTIONS[0] },
            true,
        );
        expect({ actions: html('qcm-actions-container'), feedback: html('qcm-feedback') }).toMatchSnapshot();
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
    });

    it('dialogs', async () => {
        vi.spyOn(QuizView, 'renderExamResults').mockImplementation(() => {});
        QuizView.invalidateExam();
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
        expect(content.textContent).toContain(
            '(Toutes les questions tentées • Thème : <img src=x onerror="window.__spec025=1">)',
        );
    });

    it('puts a space before the colon in « Thème : » and « Détail : »', () => {
        QuizView.state.themeFilter = 'Météo';
        QuizView.renderStats();
        expect(text('stats-content')).toContain('(Toutes les questions tentées • Thème : Météo)');
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
