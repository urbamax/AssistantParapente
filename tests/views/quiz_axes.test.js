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

describe('QuizView — Écran Axes de révision anti-bachotage (Spec 043)', () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-27T10:00:00Z'));

        const tpl = document.createElement('template');
        tpl.innerHTML = INDEX.slice(INDEX.indexOf('<div id="qcm-setup-screen"'));
        const screenIds = ['qcm-setup-screen', 'qcm-screen', 'stats-screen', 'revision-axes-screen', 'qcm-bank-screen'];
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
            qcmConfig: { mode: 'TRAINING', count: 10, theme: 'ALL', masteryTarget: 75 },
        });

        QuizView._axesStatusFilter = 'ALL';
        QuizView._expandedAxisTakeaways = new Set();
        QuizView._activeWorkshopAxisId = null;
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('affiche les axes triés par priorité avec Étape 1 (liens PDF #page=N), Étape 2 (points clés) et Étape 3 (atelier)', () => {
        QuizView.showRevisionAxesScreen();

        const screen = document.getElementById('revision-axes-screen');
        expect(screen.classList.contains('active')).toBe(true);

        const cards = [...document.querySelectorAll('.revision-axis-card')];
        expect(cards).toHaveLength(4);
        expect(cards.map((c) => c.getAttribute('data-axis-id'))).toEqual([
            'meteo-brises-aerologie',
            'mecavol-polaire-finesse',
            'facteurs-humains',
            'milieu-naturel',
        ]);
        expect(cards[0].getAttribute('data-axis-status')).toBe('BLOCKER');
        expect(cards[1].getAttribute('data-axis-status')).toBe('REFRESH');
        expect(cards[2].getAttribute('data-axis-status')).toBe('EXPLORE');
        expect(cards[3].getAttribute('data-axis-status')).toBe('MASTERED');

        // Étape 1 : liens directs vers les pages vérifiées du PDF (et pas de page non vérifiée)
        const pdfLinks = [...cards[0].querySelectorAll('a[href*="#page="]')].map((a) => a.getAttribute('href'));
        expect(pdfLinks).toContain('courses/d2e39ba7e74b.pdf#page=4');
        expect(pdfLinks).toContain('courses/d2e39ba7e74b.pdf#page=5');
    });

    it('déplie les points clés à retenir sans afficher les choix A/B/C/D ni la mention "Aucune source trouvée"', () => {
        QuizView.showRevisionAxesScreen();

        // Par défaut replié
        expect(document.querySelector('.revision-axis-takeaways-list')).toBeNull();

        // Clic sur le bouton QuiztoggleAxisTakeaways
        const toggleBtn = document.querySelector(
            '[data-action="QuiztoggleAxisTakeaways"][data-args="meteo-brises-aerologie"]',
        );
        QuizView.handleClick({ target: toggleBtn });

        const takeawaysList = document.querySelector('.revision-axis-takeaways-list');
        expect(takeawaysList).not.toBeNull();
        const text = takeawaysList.textContent;
        expect(text).toContain('Le réchauffement solaire des pentes dilate l’air');
        expect(text).not.toContain('Aucune source trouvée');
        // Ne contient ni l'énoncé QCM ni les choix de réponse
        expect(text).not.toContain('A80V bonne réponse');
        expect(text).not.toContain('A80V mauvaise réponse');
    });

    it('filtre les axes par statut via QuizsetAxesFilter', () => {
        QuizView.showRevisionAxesScreen();
        const filterBtn = document.querySelector('[data-action="QuizsetAxesFilter"][data-args="BLOCKER"]');
        QuizView.handleClick({ target: filterBtn });

        const cards = [...document.querySelectorAll('.revision-axis-card')];
        expect(cards).toHaveLength(1);
        expect(cards[0].getAttribute('data-axis-id')).toBe('meteo-brises-aerologie');
    });

    it('lance un atelier ciblé via QuizstartAxisWorkshop et propose le retour aux axes en fin de session', () => {
        QuizView.showRevisionAxesScreen();
        const startBtn = document.querySelector(
            '[data-action="QuizstartAxisWorkshop"][data-args="meteo-brises-aerologie"]',
        );
        QuizView.handleClick({ target: startBtn });

        const qcmScreen = document.getElementById('qcm-screen');
        expect(qcmScreen.classList.contains('active')).toBe(true);
        expect(QuizService.state.qcmSessionData).toHaveLength(3);
        expect(document.getElementById('qcm-mode-label').textContent).toContain('ATELIER CIBLÉ');

        // Fin de l'atelier -> le bouton de fin permet de revenir aux axes de révision
        QuizService.state.examResults = [
            { isCorrect: true, question: QUESTIONS[0], selected: [QUESTIONS[0].choices[0]] },
        ];
        QuizView.renderExamResults();
        const actionsHtml = document.getElementById('qcm-actions-container').innerHTML;
        expect(actionsHtml).toContain('QuizshowRevisionAxes');
    });
});
