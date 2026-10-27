import { describe, it, expect, beforeEach } from 'vitest';
import QuizService from '../../js/services/quiz_service.js';
import StorageService from '../../js/services/storage.js';
import { MASTERY_WINDOW } from '../../js/services/mastery.js';

// Périmètre de 20 questions de niveau BI (suffixe V) : 14 maîtrisées, 6 avec une erreur récente.
const questions = Array.from({ length: 20 }, (_, i) => ({
    code: `M${String(i + 1).padStart(2, '0')}V`,
    theme: 'Météo',
    question: `Q${i + 1}`,
    choices: [
        { text: 'bonne', pts: 1 },
        { text: 'mauvaise', pts: -1 },
    ],
}));
const mastered = questions.slice(0, 14);
const weak = questions.slice(14);

const full = () => Array(MASTERY_WINDOW).fill(1);
const withOneMistake = () => [0, ...Array(MASTERY_WINDOW - 1).fill(1)];

function seedStats() {
    const stats = { themes: {}, questions: {} };
    mastered.forEach((q) => (stats.questions[q.code] = { total: 12, correct: 12, streak: 12, recent: full() }));
    weak.forEach((q) => (stats.questions[q.code] = { total: 12, correct: 11, streak: 9, recent: withOneMistake() }));
    StorageService.set(StorageService.KEYS.QCM_STATS, stats);
}

const answer = (isCorrect) => {
    const q = QuizService.getCurrentQuestion();
    const good = q.choices.findIndex((c) => c.pts > 0);
    const bad = q.choices.findIndex((c) => c.pts < 0);
    QuizService.state.currentQcmSelection = new Set([q.choices[isCorrect ? good : bad]]);
    QuizService.validate();
};

describe('QuizService - mode MASTERY (fenêtre glissante)', () => {
    beforeEach(() => {
        QuizService.setQuestions(questions);
        QuizService.state.isLoaded = true;
        QuizService.state.qcmConfig.mode = 'MASTERY';
        QuizService.state.qcmConfig.count = 'ALL';
        QuizService.state.qcmConfig.theme = 'ALL';
        QuizService.state.qcmConfig.masteryTarget = 100;
        seedStats();
    });

    it('only proposes the questions that are not mastered yet, each once', () => {
        QuizService.startSession('BI');
        const codes = QuizService.state.qcmSessionData.map((q) => q.code);
        expect(codes.toSorted()).toEqual(weak.map((q) => q.code).toSorted());
    });

    it('does not lengthen the series while questions are still waiting, even after a wrong answer', () => {
        QuizService.startSession('BI');
        answer(true);
        QuizService.nextQuestion();
        answer(false);
        expect(QuizService.state.qcmSessionData).toHaveLength(weak.length);
    });

    it('never pulls a question already at 100 % into the series', () => {
        QuizService.startSession('BI');
        for (let guard = 0; guard < 400 && QuizService.getCurrentQuestion(); guard++) {
            answer(true);
            QuizService.nextQuestion();
        }
        const masteredCodes = new Set(mastered.map((q) => q.code));
        expect(QuizService.state.qcmSessionData.some((q) => masteredCodes.has(q.code))).toBe(false);
    });

    it('ends at 100 % once every question has gone MASTERY_WINDOW answers without a mistake', () => {
        QuizService.startSession('BI');
        for (let guard = 0; guard < 400 && QuizService.getCurrentQuestion(); guard++) {
            answer(true);
            QuizService.nextQuestion();
        }
        expect(QuizService.getCurrentQuestion()).toBeFalsy();
        expect(QuizService.getMasteryProgress()).toEqual({ current: 100, target: 100 });
        // Chaque question faible avait une erreur à faire sortir de la fenêtre : un seul tour suffit
        // (une bonne réponse la remplace), la série ne s'allonge donc pas.
        expect(QuizService.state.qcmSessionData).toHaveLength(weak.length);
    });

    it('adds another round when the last answer leaves the target unreached', () => {
        QuizService.startSession('BI');
        for (let i = 0; i < weak.length - 1; i++) {
            answer(true);
            QuizService.nextQuestion();
        }
        answer(false);
        const length = QuizService.state.qcmSessionData.length;
        expect(length).toBeGreaterThan(weak.length);
        expect(QuizService.getMasteryProgress().current).toBeLessThan(100);
        // seule la question ratée est à refaire
        expect(length - weak.length).toBe(1);
    });

    it('stops at the target without pulling in the whole scope', () => {
        QuizService.state.qcmConfig.masteryTarget = 95;
        QuizService.startSession('BI');
        // 14 à 100 %, 6 à 90 % : moyenne 97 %, l'objectif de 95 % est déjà atteint => consolidation
        expect(QuizService.state.qcmSessionData).toHaveLength(5);
    });

    it('shows the target only once it is really reached', () => {
        // une seule question à 90 % sur 20 : 99,5 % arrondirait à 100 alors que l'objectif n'est pas atteint
        const stats = StorageService.get(StorageService.KEYS.QCM_STATS);
        weak.slice(1).forEach((q) => (stats.questions[q.code].recent = full()));
        StorageService.set(StorageService.KEYS.QCM_STATS, stats);
        QuizService.state.qcmConfig.masteryTarget = 100;
        QuizService.startSession('BI');
        expect(QuizService.getMasteryProgress().current).toBe(99);
    });

    it('offers targets from one point above the current mastery up to 100 %', () => {
        // 14 à 100 %, 6 à 90 % : moyenne 97 %
        expect(QuizService.getMasteryTargetBounds('BI', 'ALL')).toEqual({ current: 97, min: 98, max: 100 });
    });

    it('measures the mastery of the chosen theme only', () => {
        QuizService.setQuestions(questions.map((q, i) => ({ ...q, theme: i < 14 ? 'Météo' : 'Pilotage' })));
        expect(QuizService.getMasteryTargetBounds('BI', 'Météo')).toEqual({ current: 100, min: 100, max: 100 });
        expect(QuizService.getMasteryTargetBounds('BI', 'Pilotage')).toEqual({ current: 90, min: 91, max: 100 });
    });

    it('never offers a minimum above 100 %, and starts at 1 % without any history', () => {
        StorageService.set(StorageService.KEYS.QCM_STATS, { themes: {}, questions: {} });
        expect(QuizService.getMasteryTargetBounds('BI', 'ALL')).toEqual({ current: 0, min: 1, max: 100 });
        const stats = { themes: {}, questions: {} };
        questions.forEach((q) => (stats.questions[q.code] = { total: 12, correct: 12, recent: full() }));
        StorageService.set(StorageService.KEYS.QCM_STATS, stats);
        expect(QuizService.getMasteryTargetBounds('BI', 'ALL')).toEqual({ current: 100, min: 100, max: 100 });
    });
});
