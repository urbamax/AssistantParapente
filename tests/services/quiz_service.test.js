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
