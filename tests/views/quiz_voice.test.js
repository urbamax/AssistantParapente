import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import QuizView from '../../js/views/quiz.js';
import QuizService from '../../js/services/quiz_service.js';
import VoiceService from '../../js/services/voice_service.js';
import { buildQuestionSpeech, buildFeedbackSpeech, buildAutoFeedbackSpeech } from '../../js/services/quiz_voice.js';

// Spec 016 : mode vocal de l'écran de question du QCM.

const DOM = `
    <div id="qcm-screen" class="mode-screen active">
        <div id="qcm-mode-label"></div>
        <div id="qcm-mastery-progress"></div>
        <div id="qcm-voice-bar" hidden></div>
        <div id="qcm-question-text"></div>
        <div id="qcm-choices"></div>
        <div id="qcm-feedback" style="display: none"></div>
        <div id="qcm-actions-container"></div>
    </div>`;

function makeQuestion(code) {
    return {
        code,
        theme: 'Météo',
        question: `Question ${code} ?`,
        choices: [
            { text: 'Vent de face', pts: 6 },
            { text: 'Vent latéral', pts: -2 },
            { text: 'Vent arrière', pts: 0 },
            { text: 'Aucun vent', pts: 6 },
        ],
        explication: 'Explication du cours.',
    };
}

let speech;
let listening;
let listenHandlers;

function mockVoice({ speak = true, listen = true } = {}) {
    speech = { speaking: false, echo: false, texts: [], onEnd: null };
    listening = false;
    listenHandlers = null;
    vi.spyOn(VoiceService, 'canSpeak').mockReturnValue(speak);
    vi.spyOn(VoiceService, 'canListen').mockReturnValue(listen);
    vi.spyOn(VoiceService, 'speak').mockImplementation((text, { onEnd } = {}) => {
        speech.speaking = true;
        speech.texts.push(text);
        speech.onEnd = onEnd || null;
    });
    vi.spyOn(VoiceService, 'stopSpeaking').mockImplementation(() => {
        speech.speaking = false;
    });
    vi.spyOn(VoiceService, 'isSpeaking').mockImplementation(() => speech.speaking);
    vi.spyOn(VoiceService, 'isEchoWindow').mockImplementation(() => speech.speaking || speech.echo);
    vi.spyOn(VoiceService, 'startListening').mockImplementation((handlers) => {
        listening = true;
        listenHandlers = handlers;
        return true;
    });
    vi.spyOn(VoiceService, 'stopListening').mockImplementation(() => {
        listening = false;
    });
    vi.spyOn(VoiceService, 'isListening').mockImplementation(() => listening);
}

function finishSpeech() {
    speech.speaking = false;
    const onEnd = speech.onEnd;
    speech.onEnd = null;
    if (onEnd) onEnd();
}

function startSession(mode = 'TRAINING', count = 3) {
    QuizService.state.qcmConfig.mode = mode;
    QuizService.state.qcmSessionData = Array.from({ length: count }, (_, i) => makeQuestion(`Q${i + 1}`));
    QuizService.state.qcmIndex = 0;
    QuizService.state.examResults = [];
    QuizService.state.currentQcmSelection = new Set();
    QuizView.renderQuestion(QuizService.getCurrentQuestion());
}

const bar = () => document.getElementById('qcm-voice-bar');
const btn = (action) => /** @type {HTMLButtonElement} */ (document.querySelector(`[data-action="${action}"]`));
const click = (action) => QuizView.handleClick({ target: btn(action), preventDefault() {} });
const status = () => document.getElementById('qcm-voice-status').textContent;
const selectedLetters = () =>
    [...document.querySelectorAll('.qcm-option')]
        .filter((b) => b.classList.contains('selected'))
        .map((b) => b.querySelector('.qcm-option-letter').textContent);
const hear = (...alternatives) => listenHandlers.onResult(alternatives);

beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = DOM;
    vi.spyOn(QuizView, 'getCourseUrl').mockReturnValue(null);
    vi.spyOn(QuizService, 'updateStats').mockImplementation(() => {});
    vi.spyOn(QuizView, 'renderExamResults').mockImplementation(() => {});
});

afterEach(async () => {
    await QuizView.unmount();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
});

describe('US1 - read aloud (spec 016)', () => {
    it('hides the voice bar and letters when the browser has no speech', () => {
        mockVoice({ speak: false, listen: false });
        startSession();
        expect(bar().hidden).toBe(true);
        expect(document.querySelector('.qcm-option-letter')).toBeNull();
    });

    it('shows letters on the answers in the displayed order', () => {
        mockVoice();
        startSession();
        expect(bar().hidden).toBe(false);
        const letters = [...document.querySelectorAll('.qcm-option-letter')].map((s) => s.textContent);
        expect(letters).toEqual(['A', 'B', 'C', 'D']);
    });

    it('« Lire » reads the question and its lettered answers', () => {
        mockVoice();
        startSession();
        expect(btn('quiz-voice-read').getAttribute('aria-pressed')).toBe('false');
        click('quiz-voice-read');
        expect(speech.texts).toEqual([buildQuestionSpeech(QuizService.getCurrentQuestion())]);
        expect(btn('quiz-voice-read').getAttribute('aria-pressed')).toBe('true');
        finishSpeech();
        expect(btn('quiz-voice-read').getAttribute('aria-pressed')).toBe('false');
    });

    it('a second tap stops the reading', () => {
        mockVoice();
        startSession();
        click('quiz-voice-read');
        click('quiz-voice-read');
        expect(VoiceService.stopSpeaking).toHaveBeenCalled();
        expect(speech.speaking).toBe(false);
        expect(speech.texts.length).toBe(1);
    });

    it('after validation, « Lire » reads the verdict and the explanation', () => {
        mockVoice();
        startSession();
        QuizView.handleClick({ target: document.querySelector('.qcm-option[data-idx="0"]') });
        QuizView.validateQuestion();
        click('quiz-voice-read');
        const result = QuizService.state.examResults[0];
        expect(speech.texts).toEqual([buildFeedbackSpeech(result)]);
    });

    it('in exam mode, never reads an explanation', () => {
        mockVoice();
        startSession('EXAM');
        QuizView.validateQuestion();
        click('quiz-voice-read');
        expect(speech.texts).toEqual([buildQuestionSpeech(QuizService.state.qcmSessionData[1])]);
    });

    it('changing question stops the reading', () => {
        mockVoice();
        startSession();
        click('quiz-voice-read');
        VoiceService.stopSpeaking.mockClear();
        QuizView.validateQuestion();
        QuizView.renderQuestion(QuizService.nextQuestion());
        expect(VoiceService.stopSpeaking).toHaveBeenCalled();
        expect(speech.speaking).toBe(false);
    });

    it('leaving the quiz stops the reading and the listening', async () => {
        mockVoice();
        startSession();
        click('quiz-voice-read');
        await QuizView.unmount();
        expect(VoiceService.stopSpeaking).toHaveBeenCalled();
        expect(VoiceService.stopListening).toHaveBeenCalled();
    });

    it('the controls are native buttons with accessible names', () => {
        mockVoice();
        startSession();
        for (const action of ['quiz-voice-read', 'quiz-voice-auto', 'quiz-voice-mic']) {
            expect(btn(action).tagName).toBe('BUTTON');
            expect(btn(action).getAttribute('type')).toBe('button');
            expect(btn(action).getAttribute('aria-label') || btn(action).textContent.trim()).not.toBe('');
        }
        expect(document.getElementById('qcm-voice-status').getAttribute('aria-live')).toBe('polite');
    });

    it('keeps the focus on the pressed control after an update', () => {
        mockVoice();
        startSession();
        btn('quiz-voice-read').focus();
        click('quiz-voice-read');
        expect(document.activeElement).toBe(btn('quiz-voice-read'));
    });
});

describe('US2 - automatic reading (spec 016)', () => {
    it('is off by default: nothing is read on a new question', () => {
        mockVoice();
        startSession();
        expect(btn('quiz-voice-auto').getAttribute('aria-pressed')).toBe('false');
        expect(speech.texts).toEqual([]);
    });

    it('when on, reads each new question and the feedback, and is remembered', () => {
        mockVoice();
        startSession();
        click('quiz-voice-auto');
        expect(btn('quiz-voice-auto').getAttribute('aria-pressed')).toBe('true');
        expect(VoiceService.getPrefs().autoRead).toBe(true);

        QuizView.validateQuestion();
        expect(speech.texts.at(-1)).toBe(buildAutoFeedbackSpeech(QuizService.state.examResults[0]));

        QuizView.renderQuestion(QuizService.nextQuestion());
        expect(speech.texts.at(-1)).toBe(buildQuestionSpeech(QuizService.getCurrentQuestion()));
    });

    // Spec 022 : l'explication n'est lue d'office qu'après une erreur.
    function answer(indexes) {
        indexes.forEach((i) =>
            QuizView.handleClick({ target: document.querySelector(`.qcm-option[data-idx="${i}"]`) }),
        );
        QuizView.validateQuestion();
        return QuizService.state.examResults[QuizService.state.qcmIndex];
    }

    it('after a right answer, reads only the verdict (spec 022, FR-001)', () => {
        mockVoice();
        VoiceService.setPrefs({ autoRead: true });
        startSession();
        const result = answer([0, 3]);
        expect(result.isCorrect).toBe(true);
        expect(speech.texts.at(-1)).toBe('Bonne réponse.');
        expect(document.getElementById('qcm-feedback').textContent).toContain('Explication du cours.');
    });

    it('after a wrong answer, reads the verdict and the explanation (spec 022, FR-002)', () => {
        mockVoice();
        VoiceService.setPrefs({ autoRead: true });
        startSession();
        const result = answer([1]);
        expect(result.isCorrect).toBe(false);
        expect(speech.texts.at(-1)).toBe(buildFeedbackSpeech(result));
        expect(speech.texts.at(-1)).toContain('Explication du cours.');
    });

    it('after an incomplete answer, reads the explanation too (spec 022, FR-002)', () => {
        mockVoice();
        VoiceService.setPrefs({ autoRead: true });
        startSession();
        const result = answer([0]);
        expect(result.isCorrect).toBe(false);
        expect(speech.texts.at(-1)).toContain('Explication du cours.');
    });

    it('on request, reads the explanation even after a right answer (spec 022, FR-003)', () => {
        mockVoice();
        VoiceService.setPrefs({ autoRead: true });
        startSession();
        const result = answer([0, 3]);
        finishSpeech();
        click('quiz-voice-read');
        expect(speech.texts.at(-1)).toBe(buildFeedbackSpeech(result));
        expect(speech.texts.at(-1)).toContain('Explication du cours.');
    });

    it('turning it off stops auto reading', () => {
        mockVoice();
        VoiceService.setPrefs({ autoRead: true });
        startSession();
        expect(speech.texts.length).toBe(1);
        click('quiz-voice-auto');
        expect(VoiceService.getPrefs().autoRead).toBe(false);
        QuizView.validateQuestion();
        QuizView.renderQuestion(QuizService.nextQuestion());
        expect(speech.texts.length).toBe(1);
    });
});

describe('US3 - answer by voice (spec 016)', () => {
    function agreeAndListen() {
        click('quiz-voice-mic');
        click('quiz-voice-consent');
    }

    it('hides the microphone when the browser cannot listen', () => {
        mockVoice({ listen: false });
        startSession();
        expect(btn('quiz-voice-mic')).toBeNull();
    });

    it('shows the notice first and listens to nothing before agreement', () => {
        mockVoice();
        startSession();
        click('quiz-voice-mic');
        expect(VoiceService.startListening).not.toHaveBeenCalled();
        expect(bar().textContent).toContain('Google pour Chrome et Edge, Apple pour Safari');
        expect(btn('quiz-voice-consent')).not.toBeNull();
    });

    it('cancel keeps the microphone off and asks again next time', () => {
        mockVoice();
        startSession();
        click('quiz-voice-mic');
        click('quiz-voice-cancel');
        expect(btn('quiz-voice-consent')).toBeNull();
        expect(VoiceService.getPrefs().voiceConsent).toBe(false);
        click('quiz-voice-mic');
        expect(btn('quiz-voice-consent')).not.toBeNull();
        expect(VoiceService.startListening).not.toHaveBeenCalled();
    });

    it('agreeing stores the consent and starts listening', () => {
        mockVoice();
        startSession();
        agreeAndListen();
        expect(VoiceService.getPrefs().voiceConsent).toBe(true);
        expect(VoiceService.startListening).toHaveBeenCalledTimes(1);
        expect(btn('quiz-voice-mic').getAttribute('aria-pressed')).toBe('true');
        expect(btn('quiz-voice-consent')).toBeNull();
    });

    it('with consent already given, the microphone starts at once', () => {
        mockVoice();
        VoiceService.setPrefs({ voiceConsent: true });
        startSession();
        click('quiz-voice-mic');
        expect(VoiceService.startListening).toHaveBeenCalledTimes(1);
    });

    it('letters replace the selection and what was heard is shown', () => {
        mockVoice();
        startSession();
        agreeAndListen();
        hear('A');
        expect(selectedLetters()).toEqual(['A']);
        hear('B et D');
        expect(selectedLetters()).toEqual(['B', 'D']);
        expect([...QuizService.state.currentQcmSelection].map((o) => o.text)).toEqual(['Vent latéral', 'Aucun vent']);
        expect(status()).toBe('Entendu : B et D');
        expect(speech.texts.at(-1)).toBe('Sélection : B, Vent latéral. D, Aucun vent.');
    });

    it('uses the first alternative that is understood', () => {
        mockVoice();
        startSession();
        agreeAndListen();
        hear('bébé', 'B');
        expect(selectedLetters()).toEqual(['B']);
        expect(status()).toBe('Entendu : B');
    });

    it('a phrase not understood changes nothing and validates nothing', () => {
        mockVoice();
        startSession();
        agreeAndListen();
        hear('A');
        finishSpeech(); // fin de la confirmation « Sélection : A… » et du délai d'écho
        hear('je ne sais pas');
        expect(selectedLetters()).toEqual(['A']);
        expect(QuizService.state.examResults.length).toBe(0);
        expect(status()).toBe('Pas compris : je ne sais pas');
    });

    it('commands do what the buttons do', () => {
        mockVoice();
        startSession();
        agreeAndListen();
        hear('suivante');
        expect(QuizService.state.qcmIndex).toBe(0);
        expect(status()).toContain('Validez d’abord');

        hear('A et D');
        hear('effacer');
        expect(selectedLetters()).toEqual([]);
        hear('A et D');
        hear('valider');
        expect(QuizService.state.examResults[0].isCorrect).toBe(true);
        expect(document.querySelector('[data-action="next-question"]')).not.toBeNull();

        hear('B');
        expect(status()).toContain('dites « suivante »');
        expect(QuizService.state.examResults[0].selected.length).toBe(2);

        hear('répète');
        expect(speech.texts.at(-1)).toBe(buildFeedbackSpeech(QuizService.state.examResults[0]));
        speech.texts.length = 0;
        hear('explication');
        expect(speech.texts.at(-1)).toBe(buildFeedbackSpeech(QuizService.state.examResults[0]));
        expect(speech.texts.at(-1)).toContain('Explication du cours.');

        hear('suivante');
        expect(QuizService.state.qcmIndex).toBe(1);
        hear('précédente');
        expect(QuizService.state.qcmIndex).toBe(0);

        hear('stop');
        expect(VoiceService.stopListening).toHaveBeenCalled();
        expect(btn('quiz-voice-mic').getAttribute('aria-pressed')).toBe('false');
    });

    // Spec 022 : répondre sans attendre la fin de la lecture, sans prendre l'écho pour une réponse.
    it('can answer while the question is being read (spec 022, FR-005)', () => {
        mockVoice();
        startSession();
        agreeAndListen();
        click('quiz-voice-read');
        expect(speech.speaking).toBe(true);
        VoiceService.stopSpeaking.mockClear();
        hear('B et D');
        expect(VoiceService.stopSpeaking).toHaveBeenCalled();
        expect(selectedLetters()).toEqual(['B', 'D']);
        expect(status()).toBe('Entendu : B et D');
    });

    it('a command interrupts the reading too', () => {
        mockVoice();
        startSession();
        agreeAndListen();
        hear('A');
        click('quiz-voice-read');
        hear('valider');
        expect(QuizService.state.examResults[0]).toBeTruthy();
    });

    it('ignores its own voice while reading (spec 022, FR-006)', () => {
        mockVoice();
        startSession();
        agreeAndListen();
        const before = status();
        click('quiz-voice-read');
        hear('Réponse A : Vent de face');
        hear('réponse A');
        hear('Que signifie un vent de travers');
        expect(selectedLetters()).toEqual([]);
        expect(status()).toBe(before);
        expect(speech.speaking).toBe(true);
    });

    it('ignores an echo that arrives just after the reading ended', () => {
        mockVoice();
        startSession();
        agreeAndListen();
        const before = status();
        speech.echo = true;
        hear('réponse D aucun vent');
        hear('réponse D');
        expect(selectedLetters()).toEqual([]);
        expect(status()).toBe(before);
        hear('D');
        expect(selectedLetters()).toEqual(['D']);
    });

    it('in exam mode « valider » moves to the next question', () => {
        mockVoice();
        startSession('EXAM');
        agreeAndListen();
        hear('C');
        hear('valider');
        expect(QuizService.state.qcmIndex).toBe(1);
    });

    it('shows a clear message on errors', () => {
        mockVoice();
        startSession();
        agreeAndListen();
        listening = false;
        listenHandlers.onError('not-allowed');
        expect(status()).toContain('Micro refusé');
        expect(btn('quiz-voice-mic').getAttribute('aria-pressed')).toBe('false');
    });

    it('reports offline when listening cannot start', () => {
        mockVoice();
        VoiceService.startListening.mockImplementation(({ onError }) => {
            onError('offline');
            return false;
        });
        VoiceService.setPrefs({ voiceConsent: true });
        startSession();
        click('quiz-voice-mic');
        expect(status()).toContain('Hors ligne');
        expect(btn('quiz-voice-mic').getAttribute('aria-pressed')).toBe('false');
    });

    it('the agreement can be withdrawn', () => {
        mockVoice();
        startSession();
        agreeAndListen();
        click('quiz-voice-revoke');
        expect(VoiceService.getPrefs().voiceConsent).toBe(false);
        expect(VoiceService.stopListening).toHaveBeenCalled();
        expect(btn('quiz-voice-revoke')).toBeNull();
        expect(status()).toContain('Accord retiré');
    });

    it('the end of the session releases the microphone', () => {
        mockVoice();
        startSession('TRAINING', 1);
        agreeAndListen();
        hear('A');
        hear('valider');
        hear('suivante');
        expect(VoiceService.stopListening).toHaveBeenCalled();
        expect(bar().hidden).toBe(true);
    });
});
