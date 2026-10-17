/**
 * PURE VIEW - QuizView, mode vocal (spec 016) : lecture à voix haute et réponses à la voix
 */
import QuizService from '../services/quiz_service.js';
import VoiceService from '../services/voice_service.js';
import {
    buildQuestionSpeech,
    buildFeedbackSpeech,
    buildAutoFeedbackSpeech,
    describeSelection,
    parseVoiceCommand,
    looksLikeEcho,
} from '../services/quiz_voice.js';
import { t } from '../utils/i18n.js';
import { tv } from './quiz_strings.js';
import { QuizStatsBase } from './quiz_stats.js';

export class QuizVoiceBase extends QuizStatsBase {
    constructor() {
        super();
        /** @type {any} Question affichée, posée par QuizView.renderQuestion (lue par le mode vocal). */
        this._voiceQuestion = null;
        /** @type {any} Résultat de la correction affiché (QuizView.showAnswerFeedback). */
        this._voiceFeedback = null;
        /** @type {any[]} Choix de la question affichée. */
        this._currentChoices = [];
    }

    /** À fournir par QuizView. */
    renderQuestion(_q) {
        throw new Error('QuizView must implement renderQuestion()');
    }

    /** À fournir par QuizView. */
    toggleOptionSelection(_btn) {
        throw new Error('QuizView must implement toggleOptionSelection()');
    }

    /** À fournir par QuizView. */
    validateQuestion() {
        throw new Error('QuizView must implement validateQuestion()');
    }

    isVoiceAvailable() {
        return VoiceService.canSpeak() || VoiceService.canListen();
    }

    /**
     * Ce que « Lire » dit : la correction si la question est validée, sinon la question.
     * En lecture automatique, l'explication n'est lue qu'après une erreur (spec 022).
     */
    currentSpeech({ auto = false } = {}) {
        if (this._voiceFeedback) {
            return auto ? buildAutoFeedbackSpeech(this._voiceFeedback) : buildFeedbackSpeech(this._voiceFeedback);
        }
        return this._voiceQuestion ? buildQuestionSpeech(this._voiceQuestion) : '';
    }

    readAloud({ auto = false } = {}) {
        const text = this.currentSpeech({ auto });
        if (!text || !VoiceService.canSpeak()) return;
        VoiceService.speak(text, { onEnd: () => this.renderVoiceBar() });
        this.renderVoiceBar();
    }

    toggleReadAloud() {
        if (VoiceService.isSpeaking()) {
            VoiceService.stopSpeaking();
            this.renderVoiceBar();
        } else {
            this.readAloud();
        }
    }

    toggleAutoRead() {
        VoiceService.setPrefs({ autoRead: !VoiceService.getPrefs().autoRead });
        this.renderVoiceBar();
    }

    toggleVoiceAnswers() {
        if (VoiceService.isListening()) {
            VoiceService.stopListening();
            this._voiceStatus = t('quiz.voice.stopped');
        } else if (!VoiceService.getPrefs().voiceConsent) {
            this._voiceNoticeOpen = true;
        } else {
            this.startVoiceAnswers();
        }
        this.renderVoiceBar();
    }

    acceptVoiceConsent() {
        VoiceService.setPrefs({ voiceConsent: true });
        this._voiceNoticeOpen = false;
        this.startVoiceAnswers();
        this.renderVoiceBar();
    }

    revokeVoiceConsent() {
        VoiceService.stopListening();
        VoiceService.setPrefs({ voiceConsent: false });
        this._voiceNoticeOpen = false;
        this._voiceStatus = t('quiz.voice.revoked');
        this.renderVoiceBar();
    }

    startVoiceAnswers() {
        const started = VoiceService.startListening({
            onResult: (alternatives) => this.handleVoiceResult(alternatives),
            onError: (code) => this.handleVoiceError(code),
        });
        if (started) this._voiceStatus = t('quiz.voice.listening');
    }

    /** Arrête lecture et écoute (changement d'écran, fin de session). */
    stopVoice() {
        VoiceService.stopSpeaking();
        VoiceService.stopListening();
        this._voiceNoticeOpen = false;
        this._voiceStatus = '';
    }

    handleVoiceError(code) {
        const keys = {
            'not-allowed': 'errorNotAllowed',
            network: 'errorNetwork',
            offline: 'errorOffline',
            unsupported: 'errorUnsupported',
        };
        this._voiceStatus = keys[code] ? t(`quiz.voice.${keys[code]}`) : t('quiz.voice.errorOther', { code });
        this.renderVoiceBar();
    }

    /** @param {string[]} alternatives transcriptions proposées, de la plus probable à la moins probable */
    handleVoiceResult(alternatives) {
        const q = this._voiceQuestion;
        if (!q) return;
        // Spec 022 : l'écoute continue pendant la lecture. Pendant (et juste après) une lecture, une
        // phrase non comprise ou qui reprend « Réponse A : … » est l'écho de l'application : ignorée.
        const echoWindow = VoiceService.isEchoWindow();
        let heard = alternatives[0] || '';
        let command = /** @type {import('../services/quiz_voice.js').VoiceCommand} */ ({ type: 'unknown' });
        for (const alt of alternatives) {
            if (echoWindow && looksLikeEcho(alt)) continue;
            const parsed = parseVoiceCommand(alt, q.choices.length);
            if (parsed.type !== 'unknown') {
                heard = alt;
                command = parsed;
                break;
            }
        }

        if (command.type === 'unknown') {
            if (echoWindow) return;
            this._voiceStatus = t('quiz.voice.notUnderstood', { text: heard.trim() });
            this.renderVoiceBar();
            return;
        }

        // Le pilote répond sans attendre la fin de la lecture : on se tait.
        if (VoiceService.isSpeaking()) VoiceService.stopSpeaking();

        this._voiceStatus = t('quiz.voice.heard', { text: heard.trim() });
        const isExam = QuizService.state.qcmConfig.mode === 'EXAM';
        const answered = !isExam && !!QuizService.state.examResults[QuizService.state.qcmIndex];

        if (command.type === 'letters') {
            if (answered) this._voiceStatus = t('quiz.voice.frozen');
            else this.selectOptionsByVoice(command.indexes);
            this.renderVoiceBar();
            return;
        }

        switch (command.name) {
            case 'validate':
                if (answered) {
                    this._voiceStatus = t('quiz.voice.frozen');
                    this.renderVoiceBar();
                } else {
                    this.validateQuestion();
                }
                break;
            case 'next':
                if (answered) {
                    this.renderQuestion(QuizService.nextQuestion());
                } else {
                    this._voiceStatus = t('quiz.voice.validateFirst');
                    this.renderVoiceBar();
                }
                break;
            case 'prev':
                if (QuizService.state.qcmIndex > 0) this.renderQuestion(QuizService.prevQuestion());
                else this.renderVoiceBar();
                break;
            case 'repeat':
                this.readAloud();
                break;
            case 'clear':
                if (answered) this._voiceStatus = t('quiz.voice.frozen');
                else this.selectOptionsByVoice([]);
                this.renderVoiceBar();
                break;
            case 'stop':
                VoiceService.stopListening();
                this._voiceStatus = t('quiz.voice.stopped');
                this.renderVoiceBar();
                break;
        }
    }

    /** Remplace la sélection par exactement ces réponses, comme si on les touchait. */
    selectOptionsByVoice(indexes) {
        const wanted = new Set(indexes);
        /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('#qcm-choices .qcm-option')).forEach(
            (btn) => {
                const idx = parseInt(btn.getAttribute('data-idx'));
                const isSelected = QuizService.state.currentQcmSelection.has(this._currentChoices[idx]);
                if (isSelected !== wanted.has(idx)) this.toggleOptionSelection(btn);
            },
        );
        if (VoiceService.canSpeak()) VoiceService.speak(describeSelection(indexes, this._currentChoices));
    }

    renderVoiceBar() {
        const bar = document.getElementById('qcm-voice-bar');
        if (!bar) return;
        if (!this._voiceQuestion || !this.isVoiceAvailable()) {
            bar.hidden = true;
            bar.innerHTML = '';
            return;
        }

        const focusedAction =
            document.activeElement && bar.contains(document.activeElement)
                ? document.activeElement.getAttribute('data-action')
                : null;

        const canSpeak = VoiceService.canSpeak();
        const canListen = VoiceService.canListen();
        const { autoRead, voiceConsent } = VoiceService.getPrefs();
        const speaking = VoiceService.isSpeaking();
        const listening = VoiceService.isListening();
        const readLabel = speaking ? 'stopLabel' : this._voiceFeedback ? 'readFeedbackLabel' : 'readLabel';

        bar.hidden = false;
        // La zone d'état reste le même élément pour que les lecteurs d'écran annoncent ses changements.
        let main = bar.querySelector('.qcm-voice-main');
        let statusEl = bar.querySelector('#qcm-voice-status');
        if (!main || !statusEl) {
            bar.innerHTML = `<div class="qcm-voice-main"></div><p id="qcm-voice-status" class="qcm-voice-status" aria-live="polite"></p>`;
            main = bar.querySelector('.qcm-voice-main');
            statusEl = bar.querySelector('#qcm-voice-status');
        }
        main.innerHTML = `
            <div class="qcm-voice-controls">
                ${
                    canSpeak
                        ? `<button type="button" class="qcm-voice-btn" data-action="quiz-voice-read" aria-pressed="${speaking}" aria-label="${tv(readLabel)}">
                    <i class="${speaking ? 'ri-stop-circle-line' : 'ri-volume-up-line'}" aria-hidden="true"></i> ${tv('read')}
                </button>
                <button type="button" class="qcm-voice-btn" data-action="quiz-voice-auto" aria-pressed="${autoRead}" aria-label="${tv('autoLabel')}">
                    <i class="ri-play-list-line" aria-hidden="true"></i> ${tv('auto')}
                </button>`
                        : ''
                }
                ${
                    canListen
                        ? `<button type="button" class="qcm-voice-btn" data-action="quiz-voice-mic" aria-pressed="${listening}"${listening ? ` aria-label="${tv('micStopLabel')}"` : ''}>
                    <i class="${listening ? 'ri-mic-fill' : 'ri-mic-line'}" aria-hidden="true"></i> ${tv('mic')}
                </button>`
                        : ''
                }
                ${canListen && voiceConsent ? `<button type="button" class="qcm-voice-link" data-action="quiz-voice-revoke">${tv('revoke')}</button>` : ''}
            </div>
            ${
                this._voiceNoticeOpen && canListen
                    ? `<div class="qcm-voice-notice" role="region" aria-label="${tv('noticeTitle')}">
                <strong>${tv('noticeTitle')}</strong>
                <p>${tv('noticeBody')}</p>
                <p>${tv('noticeHelp')}</p>
                <div class="qcm-voice-notice-actions">
                    <button type="button" class="qcm-voice-btn qcm-voice-accept" data-action="quiz-voice-consent">${tv('accept')}</button>
                    <button type="button" class="qcm-voice-btn" data-action="quiz-voice-cancel">${tv('cancel')}</button>
                </div>
            </div>`
                    : ''
            }
        `;
        if (statusEl.textContent !== (this._voiceStatus || '')) statusEl.textContent = this._voiceStatus || '';

        if (focusedAction) {
            // Le bouton pressé est recréé : on lui rend le focus (ou au micro si l'avis vient de se fermer).
            const again = /** @type {HTMLElement | null} */ (
                bar.querySelector(`[data-action="${focusedAction}"]`) ||
                    bar.querySelector('[data-action="quiz-voice-mic"]')
            );
            if (again) again.focus();
        }
    }
}
