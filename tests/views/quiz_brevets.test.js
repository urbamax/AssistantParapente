import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import QuizView from '../../js/views/quiz.js';
import QuizService from '../../js/services/quiz_service.js';
import BrevetService from '../../js/services/brevet_service.js';
import GlobalState from '../../js/core/app_state.js';
import GdprEngine from '../../js/gdpr_engine.js';

const INDEX = readFileSync('index.html', 'utf8');
const QUIZ_SCREENS = ['qcm-setup-screen', 'qcm-screen', 'stats-screen', 'qcm-bank-screen']
    .map((id) => {
        const tpl = document.createElement('template');
        tpl.innerHTML = INDEX.slice(INDEX.search(new RegExp(`<div\\s[^>]*id="${id}"`)));
        return tpl.content.getElementById(id).outerHTML;
    })
    .join('');

describe('QuizView — Official Theory Exam & Progression (spec 042)', () => {
    beforeEach(async () => {
        localStorage.clear();
        GlobalState.init();
        GlobalState.set('level', 'BI');
        GlobalState.set('mode', 'QCM');
        vi.spyOn(GdprEngine, 'isConsentGranted').mockReturnValue(true);
        vi.spyOn(QuizService, 'init').mockResolvedValue(undefined);
        QuizService.state.isLoaded = true;
        QuizService.state.loadingError = null;
        vi.spyOn(QuizService, 'getQuestions').mockReturnValue([
            {
                code: 'A001V',
                theme: 'Météo',
                question: 'Question BI ?',
                choices: [{ text: 'Oui', pts: 6 }],
                parapente: true,
            },
            {
                code: 'A002B',
                theme: 'Mécavol',
                question: 'Question BP ?',
                choices: [{ text: 'Oui', pts: 6 }],
                parapente: true,
            },
        ]);
        QuizService.setMode('TRAINING');

        document.body.innerHTML = QUIZ_SCREENS;
        await QuizView.mount();
    });

    afterEach(async () => {
        await QuizView.unmount();
        vi.restoreAllMocks();
    });

    it('renders an unvalidated official theory banner on #qcm-setup-screen when BI theory is not yet passed', () => {
        const banner = document.querySelector('#qcm-setup-screen [data-quiz-brevet-banner]');
        expect(banner).toBeTruthy();
        expect(banner.textContent).toContain('BI');
        expect(banner.querySelector('[data-action="openBrevetModal"]')).toBeTruthy();
    });

    it('advances QCM level to BP when BI theory is validated, and auto-switches to REVISION mode when returning to BI', () => {
        BrevetService.saveBrevet('BI', {
            theory: { passed: true, date: '2026-10-15', score: 28, total: 30, school: 'Cumulus' },
            practical: { validated: true, date: '2026-10-26' },
        });

        // Saving BI theory automatically advances active QCM level to BP
        expect(GlobalState.get('level')).toBe('BP');
        const bpBanner = document.querySelector('#qcm-setup-screen [data-quiz-brevet-banner]');
        expect(bpBanner.textContent).toContain('BP');

        // When the pilot switches back to BI to review, mode auto-switches to REVISION and shows the official score
        QuizService.setMode('TRAINING');
        GlobalState.set('level', 'BI');

        expect(QuizService.state.qcmConfig.mode).toBe('REVISION');
        expect(document.getElementById('mode-revision').classList.contains('active')).toBe(true);

        const biBanner = document.querySelector('#qcm-setup-screen [data-quiz-brevet-banner]');
        expect(biBanner.textContent).toContain('28/30 (93%)');
    });

    it('displays the official theory validation badge inside #stats-screen for a validated level', () => {
        BrevetService.saveBrevet('BI', {
            theory: { passed: true, date: '2026-10-15', score: 28, total: 30 },
            practical: { validated: false },
        });
        GlobalState.set('level', 'BI');
        QuizView.showStatsScreen();

        const statsBanner = document.querySelector('#stats-screen [data-stats-brevet-banner]');
        expect(statsBanner).toBeTruthy();
        expect(statsBanner.textContent).toContain('28/30 (93%)');
        expect(statsBanner.querySelector('[data-action="openBrevetModal"]')).toBeTruthy();
    });
});
