/**
 * SERVICE - Voice (spec 016)
 * Enveloppe des API vocales du navigateur : lecture à voix haute (hors ligne, sur l'appareil) et
 * reconnaissance vocale (service du navigateur, avec réseau). L'écoute continue pendant la lecture
 * pour qu'on puisse répondre sans attendre la fin (spec 022) : isEchoWindow() permet à l'écran
 * d'écarter l'écho de la voix de l'application.
 */
import StorageService from './storage.js';

const PREFS_KEY = 'parapente_voice_prefs';
// Erreurs sans gravité : on relance l'écoute sans rien signaler.
const SILENT_ERRORS = new Set(['no-speech', 'aborted']);
// Délai après la fin d'une lecture pendant lequel une phrase entendue peut encore en être l'écho
// (la reconnaissance rend son résultat un peu après la fin du son).
const ECHO_DELAY_MS = 1500;

/** @returns {any} */
function recognitionClass() {
    if (typeof window === 'undefined') return null;
    const w = /** @type {any} */ (window);
    return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

const VoiceService = {
    PREFS_KEY,

    _speechId: 0,
    _speaking: false,
    _lastSpeechEnd: -Infinity,
    /** @type {any} */
    _recognizer: null,
    _recognizerActive: false,
    _wantListen: false,

    canSpeak() {
        return typeof window !== 'undefined' && !!window.speechSynthesis && !!window.SpeechSynthesisUtterance;
    },

    canListen() {
        return !!recognitionClass();
    },

    isSpeaking() {
        return this._speaking;
    },

    /**
     * Vrai pendant une lecture et peu après : une phrase entendue peut être l'écho de l'application.
     * @param {number} [now]
     */
    isEchoWindow(now = Date.now()) {
        return this._speaking || now - this._lastSpeechEnd < ECHO_DELAY_MS;
    },

    isListening() {
        return this._wantListen;
    },

    /**
     * Lit un texte en français. Remplace toute lecture en cours.
     * @param {string} text
     * @param {{ onEnd?: () => void }} [options] onEnd n'est appelé que si la lecture va à son terme
     */
    speak(text, { onEnd } = {}) {
        if (!this.canSpeak()) return;
        const id = ++this._speechId;
        this._speaking = true;
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'fr-FR';
        utterance.rate = 0.95;
        const finish = () => {
            if (id !== this._speechId) return; // lecture remplacée ou arrêtée
            this._speaking = false;
            this._lastSpeechEnd = Date.now();
            if (onEnd) onEnd();
        };
        utterance.onend = finish;
        utterance.onerror = finish;
        window.speechSynthesis.speak(utterance);
    },

    stopSpeaking() {
        this._speechId += 1;
        if (this._speaking) this._lastSpeechEnd = Date.now();
        this._speaking = false;
        if (this.canSpeak()) window.speechSynthesis.cancel();
    },

    /**
     * Démarre l'écoute continue (relancée après chaque phrase).
     * @param {{ onResult: (alternatives: string[]) => void, onError: (code: string) => void }} handlers
     * @returns {boolean} false si l'écoute ne peut pas démarrer (onError a été appelé)
     */
    startListening({ onResult, onError }) {
        const Recognition = recognitionClass();
        if (!Recognition) {
            onError('unsupported');
            return false;
        }
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            onError('offline');
            return false;
        }
        this.stopListening();

        const rec = new Recognition();
        rec.lang = 'fr-FR';
        rec.continuous = false;
        rec.interimResults = false;
        rec.maxAlternatives = 3;
        rec.onresult = (event) => {
            const result = event.results[event.results.length - 1];
            const alternatives = Array.from(result || [], (alt) => /** @type {any} */ (alt).transcript);
            onResult(alternatives.filter(Boolean));
        };
        rec.onerror = (event) => {
            if (SILENT_ERRORS.has(event.error)) return;
            this._wantListen = false;
            onError(event.error === 'service-not-allowed' ? 'not-allowed' : event.error);
        };
        rec.onend = () => {
            if (rec !== this._recognizer) return;
            this._recognizerActive = false;
            this._resumeRecognizer();
        };

        this._recognizer = rec;
        this._wantListen = true;
        this._resumeRecognizer();
        return true;
    },

    stopListening() {
        this._wantListen = false;
        const rec = this._recognizer;
        this._recognizer = null;
        this._recognizerActive = false;
        if (rec) {
            try {
                rec.abort();
            } catch {
                // déjà arrêtée
            }
        }
    },

    _resumeRecognizer() {
        if (!this._wantListen || !this._recognizer || this._recognizerActive) return;
        try {
            this._recognizer.start();
            this._recognizerActive = true;
        } catch {
            // Déjà démarrée : le navigateur relancera onend.
        }
    },

    /** @returns {{ autoRead: boolean, voiceConsent: boolean }} */
    getPrefs() {
        const stored = StorageService.get(PREFS_KEY, null);
        const prefs = stored && typeof stored === 'object' ? stored : {};
        return {
            autoRead: prefs.autoRead === true,
            voiceConsent: prefs.voiceConsent === true,
        };
    },

    /** @param {Partial<{ autoRead: boolean, voiceConsent: boolean }>} partial */
    setPrefs(partial) {
        StorageService.set(PREFS_KEY, { ...this.getPrefs(), ...partial });
    },
};

export default VoiceService;
