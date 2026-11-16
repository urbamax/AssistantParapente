import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import QuizView from '../../js/views/quiz.js';
import QuizService, { isExamModeAvailable } from '../../js/services/quiz_service.js';
import BrevetService, { OFFICIAL_THEORY_TOTAL_POINTS } from '../../js/services/brevet_service.js';
import LogbookView from '../../js/views/logbook.js';
import LogbookService from '../../js/services/logbook_service.js';
import SitesService from '../../js/services/sites_service.js';
import GlobalState from '../../js/core/app_state.js';
import GdprEngine from '../../js/gdpr_engine.js';
import StorageService from '../../js/services/storage.js';

const INDEX = readFileSync('index.html', 'utf8');
const QUIZ_SCREENS = ['qcm-setup-screen', 'qcm-screen', 'stats-screen', 'qcm-bank-screen']
    .map((id) => {
        const tpl = document.createElement('template');
        tpl.innerHTML = INDEX.slice(INDEX.search(new RegExp(`<div\\s[^>]*id="${id}"`)));
        return tpl.content.getElementById(id).outerHTML;
    })
    .join('')
    .replace(/\s(src|href)="https?:[^"]*"/g, '');

const QUESTIONS = [
    {
        code: 'A01V',
        theme: 'Météo',
        question: 'Question BI ?',
        choices: [
            { text: 'Juste', pts: 6 },
            { text: 'Faux', pts: -6 },
        ],
        parapente: true,
    },
    {
        code: 'S32T',
        theme: 'Réglementation',
        question: 'La formation treuil :',
        choices: [
            { text: 'Contrôle continu', pts: 6 },
            { text: 'Autre', pts: -6 },
        ],
        parapente: true,
    },
];

describe('Qualification Treuil — pas de mode examen, suivi de qualification', () => {
    beforeEach(async () => {
        localStorage.clear();
        GlobalState.init();
        GlobalState.set('level', 'BI');
        GlobalState.set('mode', 'QCM');
        vi.spyOn(GdprEngine, 'isConsentGranted').mockReturnValue(true);
        vi.spyOn(QuizService, 'init').mockResolvedValue(undefined);
        QuizService.setQuestions(QUESTIONS);
        QuizService.state.isLoaded = true;
        QuizService.state.loadingError = null;
        QuizService.setMode('TRAINING');

        document.body.innerHTML = QUIZ_SCREENS;
        await QuizView.mount();
    });

    afterEach(async () => {
        await QuizView.unmount();
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    it('isExamModeAvailable renvoie false pour TREUIL et true pour les autres niveaux', () => {
        expect(isExamModeAvailable('TREUIL')).toBe(false);
        expect(isExamModeAvailable('BI')).toBe(true);
        expect(isExamModeAvailable('BP')).toBe(true);
        expect(isExamModeAvailable('BPC')).toBe(true);
        expect(isExamModeAvailable('ALL')).toBe(true);
        expect(OFFICIAL_THEORY_TOTAL_POINTS).not.toHaveProperty('TREUIL');
    });

    it('masque et désactive #mode-exam quand le niveau TREUIL est sélectionné, puis le réaffiche pour BI', () => {
        const examBtn = /** @type {HTMLButtonElement} */ (document.getElementById('mode-exam'));
        expect(examBtn.hidden).toBe(false);
        expect(examBtn.disabled).toBe(false);

        GlobalState.set('level', 'TREUIL');
        expect(examBtn.hidden).toBe(true);
        expect(examBtn.disabled).toBe(true);
        expect(examBtn.getAttribute('aria-hidden')).toBe('true');

        GlobalState.set('level', 'BI');
        expect(examBtn.hidden).toBe(false);
        expect(examBtn.disabled).toBe(false);
        expect(examBtn.getAttribute('aria-hidden')).toBe('false');
    });

    it('bascule automatiquement hors du mode EXAM vers TRAINING en passant sur TREUIL', () => {
        QuizService.setMode('EXAM');
        QuizView.updateModeUI('EXAM');
        expect(document.getElementById('mode-exam').classList.contains('active')).toBe(true);
        expect(document.getElementById('training-options').style.pointerEvents).toBe('none');

        GlobalState.set('level', 'TREUIL');

        expect(QuizService.state.qcmConfig.mode).toBe('TRAINING');
        expect(document.getElementById('mode-exam').classList.contains('active')).toBe(false);
        expect(document.getElementById('mode-training').classList.contains('active')).toBe(true);
        expect(document.getElementById('training-options').style.opacity).toBe('1');
        expect(document.getElementById('training-options').style.pointerEvents).toBe('auto');
        expect(document.getElementById('mode-description').textContent).toContain('Entraînement');
    });

    it("refuse d'activer le mode EXAM via updateModeUI ou de lancer un examen via startSession en TREUIL", () => {
        GlobalState.set('level', 'TREUIL');
        QuizView.updateModeUI('EXAM');

        expect(QuizService.state.qcmConfig.mode).toBe('TRAINING');
        expect(document.getElementById('mode-training').classList.contains('active')).toBe(true);
        expect(document.getElementById('mode-exam').classList.contains('active')).toBe(false);

        // Même si le service était forcé en EXAM, startSession('TREUIL') bascule en TRAINING
        QuizService.setMode('EXAM');
        QuizView.startSession();
        expect(QuizService.state.qcmConfig.mode).toBe('TRAINING');
        expect(document.getElementById('qcm-mode-label').textContent).toContain('ENTRAÎNEMENT');

        // saveExamHistory n'enregistre aucun examen pour TREUIL
        QuizService.saveExamHistory('TREUIL');
        expect(StorageService.get(StorageService.KEYS.EXAM_HISTORY, [])).toEqual([]);
    });

    it('affiche un bandeau de Qualification Treuil (sans mention examen) et bascule en REVISION si validée', () => {
        GlobalState.set('level', 'TREUIL');
        const unvalidatedBanner = document.querySelector('#qcm-setup-screen [data-quiz-brevet-banner]');
        expect(unvalidatedBanner).not.toBeNull();
        expect(unvalidatedBanner.textContent).toContain('Qualification Treuil');
        expect(unvalidatedBanner.textContent).toContain('Valider ma qualification');
        expect(unvalidatedBanner.textContent).not.toContain('examen');

        BrevetService.saveBrevet('TREUIL', {
            practical: { validated: true, date: '2026-10-15' },
        });
        expect(QuizService.state.qcmConfig.mode).toBe('REVISION');

        const validatedBanner = document.querySelector('#qcm-setup-screen [data-quiz-brevet-banner]');
        expect(validatedBanner).not.toBeNull();
        expect(validatedBanner.textContent).toContain('Qualification Treuil validée');
        expect(validatedBanner.textContent).toContain('Modifier ma qualification');
        expect(validatedBanner.textContent).not.toContain('examen');
    });

    it("n'affiche ni historique des examens, ni tri par examens sur #stats-screen en TREUIL, tout en proposant la validation de qualification", () => {
        StorageService.set(StorageService.KEYS.QCM_STATS, {
            totalQuestions: 1,
            totalCorrect: 1,
            themes: { Réglementation: { total: 1, correct: 1 } },
            questions: { S32T: { total: 1, correct: 1, streak: 1 } },
        });
        GlobalState.set('level', 'TREUIL');
        QuizView.showStatsScreen();

        const statsHtml = document.getElementById('stats-content').innerHTML;
        const statsBanner = document.querySelector('#stats-screen [data-stats-brevet-banner]');
        expect(statsBanner).not.toBeNull();
        expect(statsBanner.textContent).toContain('Valider ma qualification');
        expect(statsBanner.textContent).not.toContain('examen');
        expect(statsHtml).not.toContain('HISTORIQUE DES EXAMENS');
        expect(document.querySelector('#sort-questions-select option[value="exams-desc"]')).toBeNull();
        expect(document.querySelector('#sort-questions-select option[value="exams-asc"]')).toBeNull();

        // Vérifie que BI conserve bien ces éléments d'examen
        GlobalState.set('level', 'BI');
        expect(document.querySelector('#stats-screen [data-stats-brevet-banner]').textContent).toContain(
            'Valider mon examen théorique',
        );
        expect(document.getElementById('stats-content').innerHTML).toContain('HISTORIQUE DES EXAMENS');
    });

    it('affiche la section de qualification (sans examen théorique) dans le carnet pour TREUIL', () => {
        vi.spyOn(SitesService, 'getSites').mockReturnValue([]);
        LogbookService.flights = [];
        const tpl = document.createElement('template');
        tpl.innerHTML = INDEX.slice(INDEX.search(/<div\s[^>]*id="logbook-screen"/));
        document.body.innerHTML = tpl.content.getElementById('logbook-screen').outerHTML;

        LogbookView.openBrevetModal('TREUIL');
        expect(document.getElementById('lb-brevet-theory-passed')).toBeNull();
        expect(document.getElementById('lb-brevet-practical-validated')).not.toBeNull();
        expect(document.getElementById('lb-brevet-modal').textContent).toContain('Obtention de la qualification');
        expect(document.getElementById('lb-brevet-modal').textContent).toContain('Qualification obtenue / validée');

        /** @type {HTMLInputElement} */ (document.getElementById('lb-brevet-practical-validated')).checked = true;
        /** @type {HTMLInputElement} */ (document.getElementById('lb-brevet-practical-date')).value = '2026-10-20';
        LogbookView.saveBrevetModal();

        const treuil = BrevetService.getBrevet('TREUIL');
        expect(treuil.practical.validated).toBe(true);
        expect(treuil.theory.passed).toBe(false);

        const brevetsHtml = LogbookView.renderBrevetsSection([]);
        expect(brevetsHtml).toContain('Qualification Treuil');
        expect(brevetsHtml).toContain('Qualification validée');
        expect(brevetsHtml).not.toContain('Théorie validée');

        // Pour BI, la section examen théorique officiel reste bien présente
        LogbookView.openBrevetModal('BI');
        expect(document.getElementById('lb-brevet-theory-passed')).not.toBeNull();
    });
});
