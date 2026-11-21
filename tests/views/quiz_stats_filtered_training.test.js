import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import QuizView from '../../js/views/quiz.js';
import QuizService from '../../js/services/quiz_service.js';
import GlobalState from '../../js/core/app_state.js';
import GdprEngine from '../../js/gdpr_engine.js';
import AppRouter from '../../js/core/router.js';
import { filterStatsQuestionEntries, buildFilteredTrainingButtonHtml } from '../../js/views/quiz_stats_html.js';

const INDEX = readFileSync('index.html', 'utf8');

const Q = (code, theme, question, explication, extra = {}) => ({
    code,
    theme,
    question,
    explication,
    parapente: true,
    choices: [
        { text: `${code} bonne réponse`, pts: 6 },
        { text: `${code} mauvaise réponse`, pts: -6 },
    ],
    ...extra,
});

const QUESTIONS = [
    Q(
        'A80V',
        'Météo',
        'En montagne, la brise de pente montante souffle :',
        'Le réchauffement solaire des pentes dilate l’air et crée une brise montante.\n\nAucune source trouvée dans les documents fournis.',
        {
            courseId:
                'brevet-initial---vert/affiches-pedagogiques-a3/05-les-pieges-aerologiques2019/05-les-pieges-aerologiques2019',
            coursePage: 4,
        },
    ),
    Q(
        'A81V',
        'Météo',
        'La brise de vallée descendante s’établit :',
        'La nuit, le refroidissement radiatif alourdit l’air qui s’écoule vers la plaine.',
        {
            courseId:
                'brevet-initial---vert/affiches-pedagogiques-a3/05-les-pieges-aerologiques2019/05-les-pieges-aerologiques2019',
            coursePage: 5,
        },
    ),
    Q(
        'A82V',
        'Météo',
        'L’effet Venturi sur un col :',
        'Le resserrement des lignes de flux provoque une accélération du vent sur le col.',
        {
            courseId:
                'brevet-initial---vert/affiches-pedagogiques-a3/05-les-pieges-aerologiques2019/05-les-pieges-aerologiques2019',
            coursePage: null, // Non vérifiée -> ne doit pas afficher de lien de page
        },
    ),
    Q(
        'E35V',
        'Mécavol',
        'Face au vent, pour améliorer la finesse sol :',
        'Il faut accélérer pour réduire le temps passé dans la masse d’air descendante ou de face.',
        {
            courseId:
                'brevet-de-pilote---bleu/affiches-pedagogiques-a3/01-desequilibre-du-vol2021/01-desequilibre-du-vol2021',
            coursePage: 7,
        },
    ),
    Q('F1V', 'Facteurs humains', 'L’effet de groupe au décollage :', 'Il peut altérer le jugement individuel.'),
    Q('P1V', 'Milieu naturel', 'Survol d’une réserve naturelle :', 'Respecter les hauteurs minimales de survol.'),
];

const STATS = {
    totalQuestions: 10,
    themes: {},
    questions: {
        A80V: { total: 3, correct: 1, streak: 0, lastSeen: Date.parse('2026-10-27T08:00:00Z') }, // struggling -> BLOCKER
        A81V: { total: 4, correct: 3, streak: 1, lastSeen: Date.parse('2026-10-27T08:00:00Z') }, // hesitant -> BLOCKER
        A82V: { total: 3, correct: 3, streak: 3, lastSeen: Date.parse('2026-10-27T08:00:00Z') }, // mastered
        E35V: { total: 3, correct: 3, streak: 1, lastSeen: Date.parse('2026-10-01T08:00:00Z') }, // due -> REFRESH
        P1V: { total: 3, correct: 3, streak: 3, lastSeen: Date.parse('2026-10-27T08:00:00Z') }, // mastered -> MASTERED
        // F1V non tentée -> EXPLORE
    },
};

describe('Statistiques — entraînement sur les questions filtrées', () => {
    beforeEach(() => {
        const tpl = document.createElement('template');
        tpl.innerHTML = INDEX.slice(INDEX.indexOf('<div id="qcm-setup-screen"'));
        const screenIds = ['qcm-setup-screen', 'qcm-screen', 'stats-screen'];
        document.body.innerHTML = screenIds.map((id) => tpl.content.getElementById(id)?.outerHTML || '').join('');

        vi.spyOn(GlobalState, 'get').mockImplementation((key) => (key === 'level' ? 'BI' : undefined));
        vi.spyOn(GdprEngine, 'isConsentGranted').mockReturnValue(true);
        vi.spyOn(QuizService, 'getQuestions').mockReturnValue(QUESTIONS);
        vi.spyOn(QuizService, 'getQuestionByCode').mockImplementation((c) => QUESTIONS.find((q) => q.code === c));
        vi.spyOn(QuizService, 'getPersistentStats').mockImplementation(() => structuredClone(STATS));
        vi.spyOn(QuizService, 'getExamHistory').mockReturnValue([]);

        Object.assign(QuizService.state, {
            isLoaded: true,
            loadingError: null,
            qcmIndex: 0,
            qcmSessionData: [],
            examResults: [],
            invalidated: false,
            qcmConfig: { mode: 'REVISION', count: 10, theme: 'ALL', masteryTarget: 75 },
        });
        Object.assign(QuizView.state, {
            masteryFilter: 'ALL',
            themeFilter: null,
            themeSort: 'alpha',
            themeSortDir: 'asc',
            questionSort: 'rate',
            questionSortDir: 'asc',
        });
        QuizView._activeWorkshopAxisId = null;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const trainButton = () => document.querySelector('[data-action="QuizstartFilteredTraining"]');

    it('filtre par tuile de maîtrise et par thème, questions non tentées comprises', () => {
        const view = {
            state: { masteryFilter: 'NOT_ATTEMPTED', themeFilter: null },
            getQuestionByCode: (c) => QUESTIONS.find((q) => q.code === c),
        };
        const data = {
            levelQs: QUESTIONS,
            levelQuestionEntries: Object.entries(STATS.questions),
            stats: STATS,
        };
        expect(filterStatsQuestionEntries(view, data).map(([code]) => code)).toEqual(['F1V']);

        view.state = { masteryFilter: 'ALL', themeFilter: 'Météo' };
        expect(filterStatsQuestionEntries(view, data).map(([code]) => code)).toEqual(['A80V', 'A81V', 'A82V']);

        view.state = { masteryFilter: 'NOT_ATTEMPTED', themeFilter: 'Météo' };
        expect(filterStatsQuestionEntries(view, data)).toEqual([]);
    });

    it('additionne les tuiles cochées et croise avec les thèmes cochés', () => {
        const view = {
            state: { masteryFilter: ['NOT_ATTEMPTED', 'PERFECT'], themeFilter: null },
            getQuestionByCode: (c) => QUESTIONS.find((q) => q.code === c),
        };
        const data = { levelQs: QUESTIONS, levelQuestionEntries: Object.entries(STATS.questions), stats: STATS };
        const all = filterStatsQuestionEntries(view, data).map(([code]) => code);
        expect(all).toContain('F1V');
        expect(new Set(all).size).toBe(all.length);

        view.state = { masteryFilter: 'ALL', themeFilter: ['Météo', 'Milieu naturel'] };
        expect(filterStatsQuestionEntries(view, data).map(([code]) => code)).toEqual(['A80V', 'A81V', 'A82V', 'P1V']);
    });

    it('coche et décoche plusieurs tuiles et thèmes au clic', () => {
        QuizView.setMasteryFilter('GOOD');
        QuizView.setMasteryFilter('POOR');
        expect(QuizView.state.masteryFilter).toEqual(['GOOD', 'POOR']);
        QuizView.setMasteryFilter('GOOD');
        expect(QuizView.state.masteryFilter).toEqual(['POOR']);
        QuizView.setMasteryFilter('POOR');
        expect(QuizView.state.masteryFilter).toBe('ALL');

        QuizView.setThemeFilter('Météo');
        QuizView.setThemeFilter('Milieu naturel');
        expect(QuizView.state.themeFilter).toEqual(['Météo', 'Milieu naturel']);
        expect(trainButton()?.textContent).toContain('ces 4 questions');
        expect(document.getElementById('stats-content').textContent).toContain('Thèmes : Météo, Milieu naturel');
        QuizView.setThemeFilter('Météo');
        QuizView.setThemeFilter('Milieu naturel');
        expect(QuizView.state.themeFilter).toBeNull();
    });

    it('accorde le libellé du bouton au nombre de questions et le masque sans question', () => {
        expect(buildFilteredTrainingButtonHtml(0)).toBe('');
        expect(buildFilteredTrainingButtonHtml(1)).toContain('S&#39;entraîner sur cette question');
        expect(buildFilteredTrainingButtonHtml(12)).toContain('S&#39;entraîner sur ces 12 questions');
    });

    it("n'affiche le bouton qu'avec un filtre actif", () => {
        QuizView.renderStats();
        expect(trainButton()).toBeNull();

        QuizView.state.themeFilter = 'Météo';
        QuizView.renderStats();
        expect(trainButton()?.textContent).toContain('ces 3 questions');
    });

    it('lance une série Entraînement sur les questions affichées, figée au clic', () => {
        QuizView.state.themeFilter = 'Météo';
        QuizView.renderStats();
        QuizView.handleClick({ target: trainButton() });

        expect(document.getElementById('qcm-screen').classList.contains('active')).toBe(true);
        expect(QuizService.state.qcmConfig.mode).toBe('TRAINING');
        expect(QuizService.state.qcmSessionData.map((q) => q.code).sort()).toEqual(['A80V', 'A81V', 'A82V']);
        expect(QuizView._activeWorkshopAxisId).toBeNull();
        expect(document.getElementById('qcm-mode-label').textContent).toBe('MODE ENTRAÎNEMENT');
    });
    it('termine par un retour aux statistiques, filtres effacés', () => {
        QuizView.state.masteryFilter = ['GOOD'];
        QuizView.state.themeFilter = ['Météo'];
        QuizView._statsFilteredCodes = ['A80V', 'A81V'];
        QuizView.startFilteredTraining();
        QuizService.state.examResults = [
            { isCorrect: true, question: QUESTIONS[0], selected: [QUESTIONS[0].choices[0]] },
        ];
        QuizView.renderExamResults();

        const back = document.querySelector('#qcm-question-text [data-action="QuizbackToStatsAfterTraining"]');
        expect(back?.textContent).toContain('Retour aux statistiques');
        expect(document.querySelector('#qcm-question-text [data-action="finish-session"]')).toBeNull();

        QuizView.handleClick({ target: back });
        expect(QuizView.state.masteryFilter).toBe('ALL');
        expect(QuizView.state.themeFilter).toBeNull();
        expect(QuizView._statsTrainingActive).toBe(false);
        expect(document.getElementById('stats-screen').classList.contains('active')).toBe(true);
        expect(document.querySelector('[data-action="QuizstartFilteredTraining"]')).toBeNull();
    });

    it('reconstruit la page avant la navigation, pour que la transition montre déjà le bon contenu', () => {
        QuizView.state.themeFilter = ['Météo'];
        QuizView.renderStats();
        expect(document.querySelector('[data-action="QuizstartFilteredTraining"]')).not.toBeNull();
        expect(document.querySelector('[data-action="QuizclearAllFilters"]')).not.toBeNull();

        const hadRoutes = AppRouter.routes;
        AppRouter.routes = new Map([['STATS', {}]]);
        let contentAtNavigate = null;
        const navigate = vi.spyOn(AppRouter, 'navigate').mockImplementation(() => {
            contentAtNavigate = document.getElementById('stats-content').innerHTML;
            return Promise.resolve();
        });
        try {
            QuizView.backToStatsAfterTraining();
        } finally {
            AppRouter.routes = hadRoutes;
        }

        expect(navigate).toHaveBeenCalledWith('STATS');
        // Au moment de naviguer, la page cachée n'a déjà plus les filtres ni le bouton de la sélection.
        expect(contentAtNavigate).not.toContain('QuizstartFilteredTraining');
        expect(contentAtNavigate).not.toContain('QuizclearAllFilters');
    });

    it('garde le bouton Terminer pour une série lancée ailleurs', () => {
        QuizView._statsFilteredCodes = ['A80V'];
        QuizView.startFilteredTraining();
        QuizView.launchWorkshop([QUESTIONS[0]], null);
        QuizService.state.examResults = [
            { isCorrect: true, question: QUESTIONS[0], selected: [QUESTIONS[0].choices[0]] },
        ];
        QuizView.renderExamResults();
        expect(document.querySelector('#qcm-question-text [data-action="finish-session"]')).not.toBeNull();
        expect(document.querySelector('#qcm-question-text [data-action="QuizbackToStatsAfterTraining"]')).toBeNull();
    });
});
