import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import QuizService from '../../js/services/quiz_service.js';
import StorageService from '../../js/services/storage.js';
import { FirebaseAuthEngine } from '../../js/services/firebase_service.js';
import { isConsentGranted } from '../../js/services/consent_store.js';
import { setConsent } from '../helpers/stats_consent.js';

// RGPD : sans consentement « statistiques », ni les réponses ni les examens ne sont écrits dans le
// stockage (ni envoyés au cloud). Perfectionnement et Révision continuent de marcher en mémoire.
const question = {
    code: 'P1V',
    theme: 'Météo',
    question: 'Q',
    choices: [
        { text: 'vrai', pts: 6 },
        { text: 'piège', pts: -6 },
    ],
};

function answerExam() {
    QuizService.state.qcmConfig.mode = 'EXAM';
    QuizService.state.qcmSessionData = [question];
    QuizService.state.examResults = [];
    QuizService.state.qcmIndex = 0;
    QuizService.state.examSaved = false;
    QuizService.state.invalidated = false;
    QuizService.state.currentQcmSelection = new Set([question.choices[0]]);
    QuizService.validate();
}

describe('consent_store', () => {
    it('lit le choix enregistré, faux sans choix ni pour une autre version', () => {
        localStorage.clear();
        expect(isConsentGranted('stats')).toBe(false);
        setConsent({ stats: true });
        expect(isConsentGranted('stats')).toBe(true);
        expect(isConsentGranted('firebase')).toBe(false);
        localStorage.setItem('parapente_gdpr_consent', JSON.stringify({ stats: true, version: 1999 }));
        expect(isConsentGranted('stats')).toBe(false);
        localStorage.setItem('parapente_gdpr_consent', '{pas du json');
        expect(isConsentGranted('stats')).toBe(false);
    });
});

describe('QuizService sans consentement « statistiques »', () => {
    beforeEach(() => {
        setConsent({ stats: false });
        QuizService.setQuestions([question]);
        QuizService.state.isLoaded = true;
    });

    afterEach(() => {
        setConsent();
    });

    it("n'écrit pas les statistiques d'entraînement, mais les garde en mémoire", () => {
        QuizService.state.qcmConfig.mode = 'TRAINING';
        QuizService.state.qcmSessionData = [question];
        QuizService.state.examResults = [];
        QuizService.state.qcmIndex = 0;
        QuizService.state.currentQcmSelection = new Set([question.choices[0]]);
        QuizService.validate();

        expect(localStorage.getItem('parapente_qcm_stats')).toBeNull();
        expect(QuizService.getPersistentStats().questions.P1V.total).toBe(1);
    });

    it("n'enregistre ni l'examen ni ses statistiques", () => {
        answerExam();
        QuizService.saveExamHistory('BI');

        expect(localStorage.getItem('parapente_exam_history')).toBeNull();
        expect(localStorage.getItem('parapente_qcm_stats')).toBeNull();
        expect(QuizService.state.examSaved).toBe(true);
    });

    it("n'envoie rien au cloud", async () => {
        FirebaseAuthEngine.currentUser = { uid: 'u1' };
        FirebaseAuthEngine.enabled = true;
        try {
            expect((await FirebaseAuthEngine.saveStatsToCloud()).error).toBe('stats-consent-missing');
            expect((await FirebaseAuthEngine.saveHistoryToCloud()).error).toBe('stats-consent-missing');
        } finally {
            FirebaseAuthEngine.currentUser = null;
            FirebaseAuthEngine.enabled = false;
        }
    });

    it('enregistre normalement dès que le consentement est accordé', () => {
        setConsent({ stats: true });
        answerExam();
        QuizService.saveExamHistory('BI');

        expect(StorageService.get(StorageService.KEYS.EXAM_HISTORY).exams).toHaveLength(1);
        expect(StorageService.get(StorageService.KEYS.QCM_STATS).totalQuestions).toBe(1);
    });
});
