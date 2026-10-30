import { describe, it, expect, beforeEach, vi } from 'vitest';
import QuizService from '../../js/services/quiz_service.js';
import StorageService from '../../js/services/storage.js';

describe('QuizService - Mode REVISION', () => {
    // Faux jeu de données "Météo" de niveau "BI" (Suffixe V)
    const mockQuestions = [
        { code: 'A01V', theme: 'Météo', question: 'Q1' },
        { code: 'A02V', theme: 'Météo', question: 'Q2' },
        { code: 'A03V', theme: 'Météo', question: 'Q3' },
        { code: 'A04V', theme: 'Météo', question: 'Q4' },
    ];

    beforeEach(() => {
        // Injection des données dans le service (simule le chargement du CSV)
        QuizService.setQuestions(mockQuestions);

        // Initialisation de l'état du service
        QuizService.state.isLoaded = true;
        QuizService.state.qcmConfig.mode = 'REVISION';
        QuizService.state.qcmConfig.count = 'ALL';
        QuizService.state.qcmConfig.theme = 'ALL';
    });

    it('Cas 1 : Filtre correctement les questions < 75% ou non tentées', () => {
        // Préparation : Injection des statistiques dans le localStorage
        const mockStats = {
            questions: {
                A01V: { total: 10, correct: 10 }, // 100% -> Doit être ignorée
                A02V: { total: 4, correct: 2 }, // 50% -> Doit être incluse
                A03V: { total: 0, correct: 0 }, // Non tentée -> Doit être incluse
                // A04V est absente des stats -> Considérée non tentée -> Doit être incluse
            },
            themes: {},
        };
        StorageService.set(StorageService.KEYS.QCM_STATS, mockStats);

        // Exécution
        QuizService.startSession('BI');
        const sessionData = QuizService.state.qcmSessionData;

        // Vérifications
        expect(sessionData).toHaveLength(3); // 3 questions sur 4 doivent ressortir

        const returnedCodes = sessionData.map((q) => q.code);
        expect(returnedCodes).not.toContain('A01V'); // Ignorée (taux parfait)
        expect(returnedCodes).toContain('A02V'); // Incluse (< 75%)
        expect(returnedCodes).toContain('A03V'); // Incluse (0 totale)
        expect(returnedCodes).toContain('A04V'); // Incluse (absente stats)
    });

    it('Cas 2 : Applique bien un mélange (shuffle) sur les questions filtrées', () => {
        // Préparation : Aucune question n'a été tentée
        StorageService.set(StorageService.KEYS.QCM_STATS, { questions: {}, themes: {} });

        // On "espionne" la fonction interne shuffle pour vérifier qu'elle est bien appelée
        const shuffleSpy = vi.spyOn(QuizService, 'shuffle');

        // Exécution
        QuizService.startSession('BI');

        // Vérifications
        expect(shuffleSpy).toHaveBeenCalled();
        expect(QuizService.state.qcmSessionData).toHaveLength(4);

        // Nettoyage de l'espion
        shuffleSpy.mockRestore();
    });

    it('Cas 3 : Fallback si 100% de réussite partout (renvoie les moins bons scores)', () => {
        // Préparation : L'utilisateur a tout réussi avec brio (> 75%)
        const mockStats = {
            questions: {
                A01V: { total: 10, correct: 10 }, // 100% (Ratio 1)
                A02V: { total: 10, correct: 8 }, // 80%  (Ratio 0.8) - C'est le pire
                A03V: { total: 10, correct: 9 }, // 90%  (Ratio 0.9)
                A04V: { total: 10, correct: 10 }, // 100% (Ratio 1)
            },
            themes: {},
        };
        StorageService.set(StorageService.KEYS.QCM_STATS, mockStats);

        // Exécution
        QuizService.startSession('BI');
        const sessionData = QuizService.state.qcmSessionData;

        // Vérifications
        // Le fallback doit récupérer TOUTES les questions...
        expect(sessionData).toHaveLength(4);

        // ...mais triées par taux de réussite croissant (les plus dures en premier)
        expect(sessionData[0].code).toBe('A02V'); // 80% (Le pire de tous)
        expect(sessionData[1].code).toBe('A03V'); // 90%

        // Les questions A01V et A04V (100%) doivent être reléguées à la fin
        expect(['A01V', 'A04V']).toContain(sessionData[2].code);
        expect(['A01V', 'A04V']).toContain(sessionData[3].code);
    });

    it('Cas 4 : getQuestionsByTheme() groupe correctement par thème via Object.groupBy', () => {
        QuizService.setQuestions([
            { code: 'A01V', theme: 'Météo' },
            { code: 'E01V', theme: 'Mécavol' },
            { code: 'A02V', theme: 'Météo' },
        ]);

        const grouped = QuizService.getQuestionsByTheme();
        expect(Object.keys(grouped)).toContain('Météo');
        expect(Object.keys(grouped)).toContain('Mécavol');
        expect(grouped['Météo']).toHaveLength(2);
        expect(grouped['Mécavol']).toHaveLength(1);
    });

    it('Cas 5 : getThemes() retourne les thèmes uniques et triés avec toSorted()', () => {
        QuizService.setQuestions([
            { code: 'U01V', theme: 'Pilotage' },
            { code: 'A01V', theme: 'Météo' },
            { code: 'E01V', theme: 'Mécavol' },
            { code: 'A02V', theme: 'Météo' },
        ]);

        const themes = QuizService.getThemes();
        expect(themes).toEqual(['Mécavol', 'Météo', 'Pilotage']);
    });

    it('Cas 6 : getQuestions() et setQuestions() encapsulent les questions sans dépendre directement du global', () => {
        const customQuestions = [
            { code: 'Z01', question: 'Q custom 1' },
            { code: 'Z02', question: 'Q custom 2' },
        ];
        QuizService.setQuestions(customQuestions);

        expect(QuizService.getQuestions()).toEqual(customQuestions);
        expect(window.QCM_OFFICIAL).toBeUndefined();
    });

    it('Cas 7 : getQuestionByCode() indexe et retourne la question par code ou id en O(1)', () => {
        QuizService.setQuestions([
            { code: 'A10', id: '10', question: 'Question A10' },
            { code: 'B20', id: '20', question: 'Question B20' },
        ]);

        expect(QuizService.getQuestionByCode('A10')?.question).toBe('Question A10');
        expect(QuizService.getQuestionByCode('20')?.question).toBe('Question B20');
        expect(QuizService.getQuestionByCode('INCONNU')).toBeNull();
        expect(QuizService.getQuestionByCode(null)).toBeNull();
    });
});

describe('QuizService - chargement hors ligne', () => {
    it('demande des URL stables (sans paramètre) pour que le service worker serve la copie en cache', async () => {
        QuizService.setQuestions([]);
        const fetchMock = vi.fn().mockResolvedValue({ ok: false });
        vi.stubGlobal('fetch', fetchMock);
        await QuizService.loadOfficialData();
        vi.unstubAllGlobals();
        expect(fetchMock).toHaveBeenCalled();
        for (const [url] of fetchMock.mock.calls) expect(url).not.toContain('?');
    });
});

describe('QuizService - Révision espacée (échéances)', () => {
    const DAY = 24 * 60 * 60 * 1000;
    const questions = [
        { code: 'A01V', theme: 'Météo', question: 'Q1' },
        { code: 'A02V', theme: 'Météo', question: 'Q2' },
        { code: 'A03V', theme: 'Météo', question: 'Q3' },
        { code: 'P01V', theme: 'Pilotage', question: 'Q4' },
        { code: 'P02B', theme: 'Pilotage', question: 'Q5' }, // niveau BP seulement
    ];
    const stat = (streak, daysAgo) => ({ total: 4, correct: 4, streak, lastSeen: Date.now() - daysAgo * DAY });

    beforeEach(() => {
        QuizService.setQuestions(questions);
        QuizService.state.isLoaded = true;
        QuizService.state.qcmConfig.mode = 'REVISION';
        QuizService.state.qcmConfig.count = 'ALL';
        QuizService.state.qcmConfig.theme = 'ALL';
    });

    it('proposes only the questions that are due, the most overdue first', () => {
        StorageService.set(StorageService.KEYS.QCM_STATS, {
            themes: {},
            questions: {
                A01V: stat(2, 40), // due depuis longtemps
                A02V: stat(2, 4.5), // due depuis peu (3 + 1 = 4 jours)
                A03V: stat(5, 2), // pas due avant 31 jours
                // P01V jamais vue : toujours en premier
            },
        });
        QuizService.startSession('BI');
        expect(QuizService.state.qcmSessionData.map((q) => q.code)).toEqual(['P01V', 'A01V', 'A02V']);
    });

    it('falls back on the questions closest to their due date when nothing is due', () => {
        StorageService.set(StorageService.KEYS.QCM_STATS, {
            themes: {},
            questions: {
                A01V: stat(5, 2),
                A02V: stat(5, 20), // la plus proche de son échéance
                A03V: stat(5, 1),
                P01V: stat(5, 3),
            },
        });
        QuizService.startSession('BI');
        const codes = QuizService.state.qcmSessionData.map((q) => q.code);
        expect(codes).toHaveLength(4);
        expect(codes[0]).toBe('A02V');
    });

    it('getReviewSummary counts for the level, and for the chosen theme', () => {
        StorageService.set(StorageService.KEYS.QCM_STATS, {
            themes: {},
            questions: { A01V: stat(2, 40), A02V: stat(5, 2) },
        });
        // Niveau BI : A01V, A02V, A03V, P01V (P02B est BP seulement)
        expect(QuizService.getReviewSummary('BI')).toMatchObject({ total: 4, fresh: 2, due: 1, notDue: 1 });
        expect(QuizService.getReviewSummary('BP')).toMatchObject({ total: 1, fresh: 1 });

        QuizService.state.qcmConfig.theme = 'Pilotage';
        expect(QuizService.getReviewSummary('BI')).toMatchObject({ total: 1, fresh: 1, due: 0 });
    });
});

describe('QuizService - Compteurs globaux et auto-guérison', () => {
    beforeEach(() => {
        StorageService.remove(StorageService.KEYS.QCM_STATS);
    });

    it('updateStats incrémente totalQuestions et totalCorrect', () => {
        const q1 = { code: 'A01V', theme: 'Météo' };
        QuizService.updateStats(q1, true);
        let s = QuizService.getPersistentStats();
        expect(s.totalQuestions).toBe(1);
        expect(s.totalCorrect).toBe(1);

        QuizService.updateStats(q1, false);
        s = QuizService.getPersistentStats();
        expect(s.totalQuestions).toBe(2);
        expect(s.totalCorrect).toBe(1);
    });

    it('getPersistentStats auto-guérit les compteurs figés si les questions détaillées ont des totaux supérieurs', () => {
        StorageService.set(StorageService.KEYS.QCM_STATS, {
            totalQuestions: 234,
            totalCorrect: 192,
            themes: {
                Pilotage: { total: 613, correct: 539 },
                Météo: { total: 384, correct: 333 },
            },
            questions: {
                A01V: { total: 500, correct: 450 },
                P01V: { total: 497, correct: 422 },
            },
        });

        const healed = QuizService.getPersistentStats();
        expect(healed.totalQuestions).toBe(997);
        expect(healed.totalCorrect).toBe(872);

        // Vérifie que la valeur guérie a bien été réécrite dans StorageService
        const stored = StorageService.get(StorageService.KEYS.QCM_STATS);
        expect(stored.totalQuestions).toBe(997);
        expect(stored.totalCorrect).toBe(872);
    });
});
