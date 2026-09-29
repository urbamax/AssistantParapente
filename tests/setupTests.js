import { beforeEach, vi } from 'vitest';
import QuizService from '../js/services/quiz_service.js';

beforeEach(() => {
    // 1. Nettoyer le LocalStorage natif de Happy-DOM (absent des tests serveur en environnement node)
    if (typeof localStorage !== 'undefined') localStorage.clear();

    // 2. Vider la banque de questions du service QCM
    QuizService.setQuestions([]);

    // 3. Mocker la fonction fetch au cas où le service essaie de télécharger le CSV
    global.fetch = vi.fn();
});
