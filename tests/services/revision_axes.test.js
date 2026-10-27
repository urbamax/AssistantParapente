import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import QuizService from '../../js/services/quiz_service.js';
import {
    REVISION_AXES_CATALOG,
    resolveAxisIdForQuestion,
    formatPageRanges,
    classifyQuestionForAxis,
    buildRevisionAxes,
    pickWorkshopQuestions,
} from '../../js/services/revision_axes.js';

const NOW = new Date('2026-10-27T10:00:00Z');
const DAY_MS = 86_400_000;

function makeQuestion(overrides = {}) {
    return {
        id: 'A80_brise',
        num: 'A80',
        category: 'Météo',
        question: 'En montagne, la brise de pente montante souffle :',
        options: [
            { text: 'Le jour sur les versants ensoleillés', points: 6 },
            { text: 'La nuit uniquement', points: -6 },
        ],
        parapente: true,
        levels: ['BI', 'BP', 'BPC'],
        explication:
            "En journée, le réchauffement solaire des pentes dilate l'air au contact du relief, créant une brise montante (anabatique).\n\nAucune source trouvée dans les documents fournis.",
        courseId: 'meteo-brises',
        coursePage: 4,
        extraCourses: [],
        ...overrides,
    };
}

const SAMPLE_COURSES = [
    {
        id: 'meteo-brises',
        title: 'Les brises',
        category: 'Météorologie et aérologie',
        level: 'BI',
        file: 'courses/Les brises.pdf',
    },
    {
        id: 'meteo-generalites',
        title: 'Météo - Généralités',
        category: 'Météorologie et aérologie',
        level: 'BI',
        file: 'courses/Meteo - Generalites.pdf',
    },
    {
        id: 'mecavol-polaire',
        title: 'La polaire des vitesses',
        category: 'Mécanique de vol',
        level: 'BP',
        file: 'courses/La polaire des vitesses.pdf',
    },
];

describe('revision_axes — Taxonomie complète des 777 questions Parapente', () => {
    it('rattache 100 % des questions Parapente de qcm_ffvl.csv à un axe connu du catalogue', () => {
        const csvPath = join(process.cwd(), 'js/data/qcm_ffvl.csv');
        const csvText = readFileSync(csvPath, 'utf8');
        const parsed = QuizService.parseQuestionsCSV(csvText, {}, {});
        const parapenteQuestions = parsed.filter((q) => q.parapente);

        expect(parapenteQuestions.length).toBeGreaterThanOrEqual(770);

        const catalogIds = new Set(REVISION_AXES_CATALOG.map((a) => a.id));
        const unmapped = [];
        const countsByAxis = {};

        for (const q of parapenteQuestions) {
            const axisId = resolveAxisIdForQuestion(q);
            if (!axisId || !catalogIds.has(axisId)) {
                unmapped.push(q.num);
            } else {
                countsByAxis[axisId] = (countsByAxis[axisId] || 0) + 1;
            }
        }

        expect(unmapped).toEqual([]);
        // Chaque axe du catalogue doit contenir au moins 10 questions sur le niveau ALL
        for (const axis of REVISION_AXES_CATALOG) {
            expect(countsByAxis[axis.id] || 0).toBeGreaterThanOrEqual(10);
        }
    });

    it('distingue correctement les sous-chapitres de Météo, Mécavol, Matériel, Réglementation et Pilotage', () => {
        expect(resolveAxisIdForQuestion({ num: 'A12', category: 'Météo' })).toBe('meteo-nuages-masses-air');
        expect(resolveAxisIdForQuestion({ num: 'A45', category: 'Météo' })).toBe('meteo-pression-fronts');
        expect(resolveAxisIdForQuestion({ num: 'A92', category: 'Météo' })).toBe('meteo-brises-aerologie');
        expect(resolveAxisIdForQuestion({ num: 'E15', category: 'Mécavol' })).toBe('mecavol-forces-trainees');
        expect(resolveAxisIdForQuestion({ num: 'E42', category: 'Mécavol' })).toBe('mecavol-polaire-finesse');
        expect(resolveAxisIdForQuestion({ num: 'E74', category: 'Mécavol' })).toBe('mecavol-charge-decrochage');
        expect(resolveAxisIdForQuestion({ num: 'G18', category: 'Mécavol' })).toBe('mecavol-pendulaire-fermetures');
        expect(resolveAxisIdForQuestion({ num: 'N12', category: 'Matériel' })).toBe('materiel-voile-suspentage');
        expect(resolveAxisIdForQuestion({ num: 'N44', category: 'Matériel' })).toBe('materiel-homologation-sellette');
        expect(resolveAxisIdForQuestion({ num: 'L20', category: 'Matériel' })).toBe('materiel-instruments-secours');
        expect(resolveAxisIdForQuestion({ num: 'L65T', category: 'Matériel' })).toBe('materiel-treuil');
        expect(resolveAxisIdForQuestion({ num: 'S12T', category: 'Réglementation' })).toBe('reglementation-treuil');
        expect(resolveAxisIdForQuestion({ num: 'S10B', category: 'Réglementation' })).toBe(
            'reglementation-cadre-sites',
        );
        expect(resolveAxisIdForQuestion({ num: 'S55P', category: 'Réglementation' })).toBe(
            'reglementation-priorites-espaces',
        );
        expect(resolveAxisIdForQuestion({ num: 'W10', category: 'Pilotage' })).toBe('pilotage-gonflage-decollage');
        expect(resolveAxisIdForQuestion({ num: 'U20', category: 'Pilotage' })).toBe('pilotage-plan-vol-vent');
        expect(resolveAxisIdForQuestion({ num: 'U55', category: 'Pilotage' })).toBe('pilotage-thermique-pente');
        expect(resolveAxisIdForQuestion({ num: 'W35', category: 'Pilotage' })).toBe('pilotage-manoeuvres-incidents');
        expect(resolveAxisIdForQuestion({ num: 'U75', category: 'Pilotage' })).toBe('pilotage-approche-atterrissage');
        expect(resolveAxisIdForQuestion({ num: 'W52', category: 'Pilotage' })).toBe('pilotage-approche-atterrissage');
        expect(resolveAxisIdForQuestion({ num: 'F14', category: 'Facteurs humains' })).toBe('facteurs-humains');
        expect(resolveAxisIdForQuestion({ num: 'P8', category: 'Milieu naturel' })).toBe('milieu-naturel');
    });
});

describe('revision_axes — formatPageRanges & classifyQuestionForAxis', () => {
    it('formate des numéros de pages triés en plages compactes', () => {
        expect(formatPageRanges([])).toBe('');
        expect(formatPageRanges([4])).toBe('4');
        expect(formatPageRanges([4, 5, 6, 9, 11, 12])).toBe('4–6, 9, 11–12');
        expect(formatPageRanges([12, 4, 5, 4, 6])).toBe('4–6, 12');
    });

    it('classe une question en unattempted, struggling, hesitant, due ou mastered', () => {
        expect(classifyQuestionForAxis(undefined, NOW)).toBe('unattempted');
        expect(classifyQuestionForAxis({ total: 0, correct: 0 }, NOW)).toBe('unattempted');
        // Échec (< 50 %) -> struggling
        expect(classifyQuestionForAxis({ total: 3, correct: 1, streak: 0 }, NOW)).toBe('struggling');
        // Plusieurs tentatives mais dernière ratée (streak === 0) -> struggling même à 50 %
        expect(classifyQuestionForAxis({ total: 2, correct: 1, streak: 0 }, NOW)).toBe('struggling');
        // Hésitante (entre 50 % et 84 % avec streak >= 1) -> hesitant
        expect(classifyQuestionForAxis({ total: 4, correct: 3, streak: 1 }, NOW)).toBe('hesitant');
        // Maîtrisée (>= 85 %) mais échue -> due
        const oldSeen = new Date(NOW.getTime() - 10 * DAY_MS).toISOString();
        expect(classifyQuestionForAxis({ total: 4, correct: 4, streak: 2, lastSeen: oldSeen }, NOW)).toBe('due');
        // Maîtrisée (>= 85 %) et récente -> mastered
        const recentSeen = new Date(NOW.getTime() - 6 * 3600_000).toISOString();
        expect(classifyQuestionForAxis({ total: 4, correct: 4, streak: 2, lastSeen: recentSeen }, NOW)).toBe(
            'mastered',
        );
    });
});

describe('revision_axes — buildRevisionAxes (diagnostic, cours vérifiés, points clés)', () => {
    const recentIso = new Date(NOW.getTime() - 3600_000).toISOString();
    const expiredIso = new Date(NOW.getTime() - 20 * DAY_MS).toISOString();

    const questions = [
        // Axe 1 : meteo-brises-aerologie -> BLOCKER (1 struggling, 1 hesitant, 1 mastered)
        makeQuestion({
            id: 'A80',
            num: 'A80',
            levels: ['BI', 'BP'],
            courseId: 'meteo-brises',
            coursePage: 4,
            extraCourses: [{ courseId: 'meteo-generalites', page: 18 }],
            explication:
                "La brise de pente montante s'établit le jour sur les faces chauffées par le soleil.\n\nAucune source trouvée dans les documents fournis.",
        }),
        makeQuestion({
            id: 'A81',
            num: 'A81',
            levels: ['BI', 'BP'],
            courseId: 'meteo-brises',
            coursePage: 5,
            explication: 'La brise de vallée descendante (catabatique) se met en place en soirée et la nuit.',
        }),
        makeQuestion({
            id: 'A82',
            num: 'A82',
            levels: ['BI', 'BP'],
            courseId: 'meteo-brises',
            coursePage: null, // Non vérifiée -> ne doit JAMAIS produire de lien de page
            explication: "L'effet Venturi accélère le flux d'air au passage d'un col ou d'une crête.",
        }),
        // Axe 2 : mecavol-polaire-finesse -> REFRESH (due)
        makeQuestion({
            id: 'E35',
            num: 'E35',
            category: 'Mécavol',
            levels: ['BI', 'BP'],
            courseId: 'mecavol-polaire',
            coursePage: 7,
            explication:
                "Face au vent, pour optimiser la finesse sol, il faut voler plus vite qu'en air calme (accélérer).",
        }),
        // Axe 3 : facteurs-humains -> EXPLORE (unattempted)
        makeQuestion({
            id: 'F1',
            num: 'F1',
            category: 'Facteurs humains',
            levels: ['BI'],
            courseId: null,
            coursePage: null,
            explication: "L'effet de groupe peut pousser un pilote à décoller malgré des conditions inadaptées.",
        }),
        // Axe 4 : milieu-naturel -> MASTERED
        makeQuestion({
            id: 'P1',
            num: 'P1',
            category: 'Milieu naturel',
            levels: ['BI', 'BP'],
            courseId: null,
            coursePage: null,
            explication:
                'Pendant la période de nidification du gypaète barbu, des zones de sensibilité majeure (ZSM) sont définies.',
        }),
        // Axe 5 : treuil uniquement
        makeQuestion({
            id: 'L60T',
            num: 'L60T',
            category: 'Matériel',
            levels: ['TREUIL'],
            courseId: null,
            coursePage: null,
            explication: "Le fusible mécanique protège l'aile d'une surcharge excessive lors du treuillage.",
        }),
    ];

    const stats = {
        A80: { total: 3, correct: 1, streak: 0, lastSeen: recentIso }, // struggling
        A81: { total: 4, correct: 3, streak: 1, lastSeen: recentIso }, // hesitant
        A82: { total: 3, correct: 3, streak: 3, lastSeen: recentIso }, // mastered
        E35: { total: 3, correct: 3, streak: 1, lastSeen: expiredIso }, // due
        P1: { total: 2, correct: 2, streak: 2, lastSeen: recentIso }, // mastered
    };

    it('filtre par niveau et trie les axes selon la priorité pédagogique (BLOCKER > REFRESH > EXPLORE > MASTERED)', () => {
        const report = buildRevisionAxes(questions, stats, SAMPLE_COURSES, { level: 'BI', now: NOW });

        // L60T (TREUIL uniquement) est exclu en niveau BI
        expect(report.axes.map((a) => a.id)).toEqual([
            'meteo-brises-aerologie',
            'mecavol-polaire-finesse',
            'facteurs-humains',
            'milieu-naturel',
        ]);

        expect(report.axes[0].status).toBe('BLOCKER');
        expect(report.axes[0].strugglingCount).toBe(1);
        expect(report.axes[0].hesitantCount).toBe(1);
        expect(report.axes[0].masteredCount).toBe(1);

        expect(report.axes[1].status).toBe('REFRESH');
        expect(report.axes[1].dueCount).toBe(1);

        expect(report.axes[2].status).toBe('EXPLORE');
        expect(report.axes[2].unattemptedCount).toBe(1);

        expect(report.axes[3].status).toBe('MASTERED');
        // 2 bonnes réponses sur 2 tentatives : 2/10 d'un cycle de maîtrise, pas 100 %
        expect(report.axes[3].masteryPct).toBe(20);

        expect(report.counts).toEqual({
            ALL: 4,
            BLOCKER: 1,
            REFRESH: 1,
            EXPLORE: 1,
            MASTERED: 1,
        });
    });

    it('agrège uniquement les pages de cours vérifiées (Principe III de la Constitution) et construit les liens #page=N', () => {
        const report = buildRevisionAxes(questions, stats, SAMPLE_COURSES, { level: 'BI', now: NOW });
        const brisesAxis = report.axes.find((a) => a.id === 'meteo-brises-aerologie');

        expect(brisesAxis.courseReadings).toHaveLength(2);
        expect(brisesAxis.courseReadings[0]).toMatchObject({
            courseId: 'meteo-brises',
            title: 'Les brises',
            pages: [4, 5],
            pageRangesText: '4–5',
            primaryUrl: 'courses/Les brises.pdf#page=4',
        });
        expect(brisesAxis.courseReadings[0].pageLinks).toEqual([
            { page: 4, url: 'courses/Les brises.pdf#page=4' },
            { page: 5, url: 'courses/Les brises.pdf#page=5' },
        ]);
        expect(brisesAxis.courseReadings[1]).toMatchObject({
            courseId: 'meteo-generalites',
            title: 'Météo - Généralités',
            pages: [18],
            pageRangesText: '18',
            primaryUrl: 'courses/Meteo - Generalites.pdf#page=18',
        });
    });

    it('extrait les points clés à retenir nettoyés sans jamais exposer les choix de réponses QCM', () => {
        const report = buildRevisionAxes(questions, stats, SAMPLE_COURSES, { level: 'BI', now: NOW });
        const brisesAxis = report.axes.find((a) => a.id === 'meteo-brises-aerologie');

        expect(brisesAxis.takeaways.length).toBeGreaterThanOrEqual(2);
        const first = brisesAxis.takeaways[0];
        expect(first.questionNum).toBe('A80');
        expect(first.bucket).toBe('struggling');
        expect(first.explanation).toContain("La brise de pente montante s'établit le jour");
        expect(first.explanation).not.toContain('Aucune source trouvée');
        expect(first.courseTitle).toBe('Les brises');
        expect(first.coursePage).toBe(4);
        expect(first.courseUrl).toBe('courses/Les brises.pdf#page=4');
        // Aucun choix de réponse QCM ne figure dans l'objet takeaway
        expect(first.options).toBeUndefined();
        expect(first.question).toBeUndefined();
    });
});

describe('revision_axes — pickWorkshopQuestions (Atelier ciblé anti-élimination)', () => {
    it('mélange les questions fragiles/à revoir avec 1 à 2 questions de consolidation du même axe', () => {
        const recentIso = new Date(NOW.getTime() - 3600_000).toISOString();
        const axisQuestions = [
            makeQuestion({ id: 'A80', num: 'A80' }),
            makeQuestion({ id: 'A81', num: 'A81' }),
            makeQuestion({ id: 'A82', num: 'A82' }),
            makeQuestion({ id: 'A83', num: 'A83' }),
            makeQuestion({ id: 'A84', num: 'A84' }),
            makeQuestion({ id: 'A85', num: 'A85' }),
            makeQuestion({ id: 'A86', num: 'A86' }),
        ];
        const stats = {
            A80: { total: 3, correct: 0, streak: 0, lastSeen: recentIso }, // struggling
            A81: { total: 3, correct: 1, streak: 0, lastSeen: recentIso }, // struggling
            A82: { total: 4, correct: 3, streak: 1, lastSeen: recentIso }, // hesitant
            A83: { total: 4, correct: 4, streak: 3, lastSeen: recentIso }, // mastered
            A84: { total: 4, correct: 4, streak: 3, lastSeen: recentIso }, // mastered
            A85: { total: 4, correct: 4, streak: 3, lastSeen: recentIso }, // mastered
            A86: { total: 4, correct: 4, streak: 3, lastSeen: recentIso }, // mastered
        };

        const selected = pickWorkshopQuestions(axisQuestions, stats, {
            axisId: 'meteo-brises-aerologie',
            targetCount: 5,
            now: NOW,
        });

        expect(selected).toHaveLength(5);
        const ids = selected.map((q) => q.id);
        // Contient les 3 questions en difficulté (A80, A81, A82) + 2 questions maîtrisées de consolidation
        expect(ids).toContain('A80');
        expect(ids).toContain('A81');
        expect(ids).toContain('A82');
        const masteredIncluded = ids.filter((id) => ['A83', 'A84', 'A85', 'A86'].includes(id));
        expect(masteredIncluded).toHaveLength(2);
    });
});
