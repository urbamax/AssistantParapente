import { beforeEach, vi } from 'vitest';
import QuizService from '../js/services/quiz_service.js';
import { setConsent } from './helpers/stats_consent.js';

beforeEach(() => {
    // 1. Nettoyer le LocalStorage natif de Happy-DOM (absent des tests serveur en environnement node)
    if (typeof localStorage !== 'undefined') {
        localStorage.clear();
        // Par défaut les tests tournent avec le consentement « statistiques » accordé : ceux qui testent
        // le refus l'effacent (voir tests/services/stats_consent_gate.test.js).
        setConsent();
    }

    // 2. Vider la banque de questions du service QCM
    QuizService.setQuestions([]);
    QuizService._volatileStats = null;

    // 3. Mocker la fonction fetch au cas où le service essaie de télécharger le CSV
    global.fetch = vi.fn();
});
