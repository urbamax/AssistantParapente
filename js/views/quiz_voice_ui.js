/**
 * PURE VIEW - QuizView, mode vocal (spec 016) : lecture à voix haute et réponses à la voix
 */
import QuizService from '../services/quiz_service.js';
import VoiceService from '../services/voice_service.js';
import {
    buildQuestionSpeech,
    buildFeedbackSpeech,
    buildAutoFeedbackSpeech,
    buildFinishedSpeech,
    describeSelection,
    parseVoiceCommand,
    looksLikeEcho,
} from '../services/quiz_voice.js';
import { t } from '../utils/i18n.js';
import { tv } from './quiz_strings.js';
import { QuizStatsBase } from './quiz_stats.js';

// Mode enchaîné : pause entre la fin de la correction lue et la question suivante, pour pouvoir
// dire « répète » ou « stop » avant qu'elle ne passe.
const CHAIN_PAUSE_MS = 1500;

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
            // Les choix de la séance sont mélangés : les passages de l'explication se retrouvent sur la question d'origine.
            const original = QuizService.getQuestionByCode(this._voiceFeedback.question?.code);
            return auto
                ? buildAutoFeedbackSpeech(this._voiceFeedback, original)
                : buildFeedbackSpeech(this._voiceFeedback, original);
        }
        return this._voiceQuestion ? buildQuestionSpeech(this._voiceQuestion) : '';
    }

    readAloud({ auto = false } = {}) {
        const text = this.currentSpeech({ auto });
        if (!text || !VoiceService.canSpeak()) return;
        const isFeedback = auto && Boolean(this._voiceFeedback);
        VoiceService.speak(text, {
            onEnd: () => {
                this.renderVoiceBar();
                if (isFeedback) this.scheduleChainAdvance();
            },
        });
        this.renderVoiceBar();
    }

    /**
     * Mode enchaîné (mains libres) : une fois la correction lue, passe seul à la question suivante, qui
     * est lue à son tour. Il faut la lecture automatique. Toute commande entendue, ou tout changement de
     * question, annule le passage prévu.
     */
    scheduleChainAdvance() {
        this.cancelChainAdvance();
        const prefs = VoiceService.getPrefs();
        if (!prefs.chain || !prefs.autoRead) return;
        const index = QuizService.state.qcmIndex;
        this._chainTimer = setTimeout(() => {
            this._chainTimer = null;
            if (QuizService.state.qcmIndex !== index || !this._voiceFeedback || VoiceService.isSpeaking()) return;
            this.renderQuestion(QuizService.nextQuestion());
        }, CHAIN_PAUSE_MS);
    }

    cancelChainAdvance() {
        if (this._chainTimer) clearTimeout(this._chainTimer);
        this._chainTimer = null;
    }

    /** Fin de série en mode enchaîné : le résultat est dit, l'écran n'est pas forcément regardé. */
    speakFinishedIfChained() {
        if (!VoiceService.getPrefs().chain || !VoiceService.canSpeak()) return;
        const results = QuizService.state.examResults.filter(Boolean);
        const total = QuizService.state.qcmSessionData.length || results.length;
        VoiceService.speak(buildFinishedSpeech(results.filter((r) => r.isCorrect).length, total));
    }

    toggleChain() {
        const chain = !VoiceService.getPrefs().chain;
        // Enchaîner suppose de lire automatiquement : on active les deux ensemble.
        VoiceService.setPrefs(chain ? { chain, autoRead: true } : { chain });
        if (!chain) this.cancelChainAdvance();
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
        const next = !VoiceService.getPrefs().autoRead;
        VoiceService.setPrefs(next ? { autoRead: true } : { autoRead: false, chain: false });
        if (!next) {
            this.cancelChainAdvance();
            if (VoiceService.isSpeaking()) VoiceService.stopSpeaking();
        } else if (!VoiceService.isSpeaking()) {
            this.readAloud({ auto: true });
        }
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
        this.cancelChainAdvance();
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

        // Le pilote répond sans attendre la fin de la lecture : on se tait, et on n'enchaîne pas seul.
        this.cancelChainAdvance();
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
        const { autoRead, voiceConsent, chain } = VoiceService.getPrefs();
        const listening = VoiceService.isListening();

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
                <div class="qcm-voice-buttons">
                    ${
                        canSpeak
                            ? `<button type="button" class="qcm-voice-btn" data-action="quiz-voice-auto" aria-pressed="${autoRead}" aria-label="${tv('autoLabel')}">${tv('auto')}</button>
                    <button type="button" class="qcm-voice-btn" data-action="quiz-voice-chain" aria-pressed="${chain}" aria-label="${tv('chainLabel')}">${tv('chain')}</button>`
                            : ''
                    }
                    ${
                        canListen
                            ? `<button type="button" class="qcm-voice-btn" data-action="quiz-voice-mic" aria-pressed="${listening}"${listening ? ` aria-label="${tv('micStopLabel')}"` : ''}>${tv('mic')}</button>`
                            : ''
                    }
                </div>
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
