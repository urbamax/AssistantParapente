import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import QuizView from '../../js/views/quiz.js';
import QuizService from '../../js/services/quiz_service.js';
import GlobalState from '../../js/core/app_state.js';
import GdprEngine from '../../js/gdpr_engine.js';

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

describe('Statistiques — filtres à facettes', () => {
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

    const tileCount = (filter) =>
        Number(
            document.querySelector(`[data-action="QuizsetMasteryFilter"][data-args="['${filter}']"]`)?.firstElementChild
                ?.textContent,
        );
    const themeCard = (theme) => document.querySelector(`[data-action="QuizsetThemeFilter"][data-args="['${theme}']"]`);

    it('recalcule les tuiles de maîtrise sur les thèmes cochés', () => {
        QuizView.renderStats();
        expect(tileCount('NOT_ATTEMPTED')).toBe(1); // F1V

        QuizView.setThemeFilter('Météo');
        expect(tileCount('NOT_ATTEMPTED')).toBeNaN(); // aucune question Météo non tentée : tuile masquée
        const meteoTiles = [...document.querySelectorAll('[data-action="QuizsetMasteryFilter"]')].reduce(
            (sum, el) => sum + Number(el.firstElementChild.textContent),
            0,
        );
        expect(meteoTiles).toBe(3);

        QuizView.setThemeFilter('Facteurs humains');
        expect(tileCount('NOT_ATTEMPTED')).toBe(1);
    });

    it('affiche sur chaque thème le nombre de questions retenues par les tuiles, sans toucher au taux', () => {
        QuizView.renderStats();
        expect(document.querySelector('.theme-card-selection')).toBeNull();
        const meteoRate = themeCard('Météo').textContent.match(/\d+%/)?.[0];

        QuizView.setMasteryFilter('NOT_ATTEMPTED');
        expect(themeCard('Facteurs humains').querySelector('.theme-card-selection').textContent).toBe(
            '1 dans la sélection',
        );
        expect(themeCard('Météo').querySelector('.theme-card-selection').textContent).toBe('Aucune dans la sélection');
        expect(themeCard('Météo').getAttribute('style')).toContain('opacity:0.45');
        expect(themeCard('Météo').textContent.match(/\d+%/)?.[0]).toBe(meteoRate);
    });
});
