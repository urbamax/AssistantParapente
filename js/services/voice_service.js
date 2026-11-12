/**
 * SERVICE - Voice (spec 016)
 * Enveloppe des API vocales du navigateur : lecture à voix haute (hors ligne, sur l'appareil) et
 * reconnaissance vocale (service du navigateur, avec réseau). L'écoute continue pendant la lecture
 * pour qu'on puisse répondre sans attendre la fin (spec 022) : isEchoWindow() et getSpokenContext()
 * permettent à l'écran d'écarter l'écho de la voix de l'application.
 */
import StorageService from './storage.js';

const PREFS_KEY = 'parapente_voice_prefs';
// Erreurs sans gravité : on relance l'écoute sans rien signaler.
const SILENT_ERRORS = new Set(['no-speech', 'aborted']);
// Délai après la fin d'une lecture pendant lequel une phrase entendue peut encore en être l'écho
// (la reconnaissance rend son résultat un peu après la fin du son).
const ECHO_DELAY_MS = 1500;
// Longueur max par énoncé : évite la coupure des phrases longues par les moteurs TTS mobiles/Chrome.
const MAX_SPEECH_CHUNK_LEN = 160;
const INITIAL_RETRY_MS = 120;
const MAX_RETRY_MS = 1500;

// Mots français parfois écrits en majuscules pour l'emphase : mis en minuscules pour éviter qu'ils
// soient épelés lettre par lettre par la synthèse vocale.
const UPPERCASE_WORDS_LOWER = new Set([
    'OUI',
    'NON',
    'ET',
    'OU',
    'SI',
    'NE',
    'PAS',
    'PLUS',
    'MOINS',
    'SANS',
    'AVEC',
    'POUR',
    'DANS',
    'SUR',
    'SOUS',
    'TRES',
    'BIEN',
    'MAL',
    'BON',
    'VRAI',
    'FAUX',
    'TOUT',
    'TOUS',
    'CAS',
    'EST',
    'SONT',
    'UN',
    'UNE',
    'DES',
    'LES',
    'AUX',
    'DONC',
    'CAR',
    'MAIS',
    'SOIT',
    'SAUF',
]);

// Acronymes ou noms propres prononcés comme des mots en français.
const PRONOUNCEABLE_UPPERCASE = new Map([
    ['NOTAM', 'notam'],
    ['SAMU', 'samu'],
    ['AZBA', 'azba'],
    ['VAC', 'vac'],
    ['SUP', 'sup'],
    ['LYON', 'Lyon'],
    ['PARIS', 'Paris'],
    ['NICE', 'Nice'],
]);

/**
 * Épelle un sigle en « C.E.N. » pour que la synthèse vocale française le prononce lettre par lettre
 * au lieu de le lire comme un mot (« sans ») ou un État américain (« FL » → « Florida »).
 * @param {string} word
 * @returns {string}
 */
function spellAcronym(word) {
    return `${word.split('').join('.')}.`;
}

/**
 * Prépare un texte pour la synthèse vocale française : normalise les sigles (« CEN » → « C.E.N. »,
 * « FL115 » → « F.L. 115 ») et les unités techniques courantes du QCM.
 * @param {string} text
 * @returns {string}
 */
export function formatSpeechText(text) {
    let out = String(text || '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!out) return '';

    out = out
        .replace(/\beAIP\b/g, 'e-A.I.P.')
        .replace(/\bm\/sol\b/g, 'mètres sol')
        .replace(/\bm\/mer\b/g, 'mètres mer')
        .replace(/\bhPa\b/g, 'hectopascals')
        .replace(/\bdaN\b/g, 'décanewtons')
        .replace(/\bEN([A-D])([+-])/g, (_m, cat, sign) => `E.N.${cat}. ${sign === '+' ? 'plus' : 'moins'}`)
        .replace(/\b([A-Z]{2,6})(\d+)\b/g, (match, prefix, num) => {
            if (UPPERCASE_WORDS_LOWER.has(prefix) || PRONOUNCEABLE_UPPERCASE.has(prefix)) return match;
            return `${spellAcronym(prefix)} ${num}`;
        })
        .replace(/\b([A-Z]{2,7})(?![a-zàâäéèêëîïôöùûüç])(\.{1,3})?/g, (_match, word, dots) => {
            if (UPPERCASE_WORDS_LOWER.has(word)) return `${word.toLowerCase()}${dots || ''}`;
            if (PRONOUNCEABLE_UPPERCASE.has(word)) return `${PRONOUNCEABLE_UPPERCASE.get(word)}${dots || ''}`;
            const spelled = spellAcronym(word);
            if (!dots || dots === '.') return spelled;
            return `${spelled.slice(0, -1)}${dots}`;
        });

    return out;
}

/**
 * Découpe un texte long en segments naturels <= maxLen caractères pour contourner la coupure
 * des énoncés longs par les moteurs Web Speech (Chrome / Android / Safari).
 * @param {string} text
 * @param {number} [maxLen]
 * @returns {string[]}
 */
export function splitSpeechChunks(text, maxLen = MAX_SPEECH_CHUNK_LEN) {
    const clean = String(text || '').trim();
    if (!clean) return [];
    if (clean.length <= maxLen) return [clean];

    const chunks = [];
    let rest = clean;
    const minBreak = Math.floor(maxLen * 0.35);

    while (rest.length > maxLen) {
        const slice = rest.slice(0, maxLen + 1);
        let splitAt = -1;

        // 1. Fin de phrase réelle (pas à l'intérieur d'un sigle comme « C.E.N. avant »).
        for (let i = slice.length - 1; i >= minBreak; i--) {
            if (!/[.!?…]/.test(slice[i]) || !/\s/.test(slice[i + 1] || '')) continue;
            const before = slice.slice(0, i + 1);
            const afterChar = rest
                .slice(i + 1)
                .trimStart()
                .charAt(0);
            const isAcronymEnd = /(?:^|[\s'(])(?:[A-Z]\.){2,}$/.test(before);
            if (isAcronymEnd && afterChar && !/[A-ZÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ]/.test(afterChar)) continue;
            splitAt = i + 1;
            break;
        }

        // 2. Ponctuation de proposition (, ; : — – )).
        if (splitAt === -1) {
            for (let i = slice.length - 1; i >= minBreak; i--) {
                if (/[;:,—–)]/.test(slice[i]) && /\s/.test(slice[i + 1] || '')) {
                    splitAt = i + 1;
                    break;
                }
            }
        }

        // 3. Repli sur un espace, ou coupe brute si mot interminable.
        if (splitAt === -1) {
            const spaceIdx = slice.lastIndexOf(' ');
            splitAt = spaceIdx >= minBreak ? spaceIdx : maxLen;
        }

        const part = rest.slice(0, splitAt).trim();
        if (part) chunks.push(part);
        rest = rest.slice(splitAt).trimStart();
    }

    if (rest) chunks.push(rest);
    return chunks;
}

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
    _spokenText: '',
    _lastSpeechEnd: -Infinity,
    /** @type {SpeechSynthesisUtterance | null} Référence forte pour éviter le GC prématuré sur Chrome/Safari. */
    _utterance: null,
    /** @type {ReturnType<typeof setTimeout> | null} */
    _speechWatchdog: null,
    /** @type {any} */
    _recognizer: null,
    _recognizerActive: false,
    _wantListen: false,
    _listenSessionId: 0,
    /** @type {{ onResult: (alternatives: string[]) => void, onError: (code: string) => void } | null} */
    _listenHandlers: null,
    _pendingResume: false,
    _hadResultInSession: false,
    _consecutiveQuickEnds: 0,
    _consecutiveFailures: 0,
    _retryDelayMs: INITIAL_RETRY_MS,
    _transientErrorCount: 0,
    _attemptStartedAt: 0,
    _attemptGotResult: false,
    _attemptHadAborted: false,
    _attemptHadTransient: false,
    /** @type {ReturnType<typeof setTimeout> | null} */
    _resumeTimer: null,
    /** @type {'auto' | 'playback' | 'play-and-record'} */
    _audioSessionType: 'auto',
    /** @type {any} */
    _wakeLock: null,

    /**
     * Sur iPhone, le commutateur « vibreur » coupe la synthèse vocale d'une page web : la voix ne sort que
     * si la page déclare une session audio de lecture (API Audio Session de Safari). On la déclare juste
     * avant de parler, en lecture + enregistrement quand l'écoute est active pour ne pas couper le micro,
     * puis on rend la main au navigateur. Sans cette API (Chrome, Firefox), rien ne change.
     * @param {'auto' | 'playback' | 'play-and-record'} type
     */
    _setAudioSession(type) {
        const session = typeof navigator !== 'undefined' ? /** @type {any} */ (navigator).audioSession : null;
        if (!session) {
            this._audioSessionType = 'auto';
            return;
        }
        if (this._audioSessionType === type) return;
        try {
            session.type = type;
            this._audioSessionType = type;
        } catch {
            // type refusé par le navigateur : on parle quand même
        }
    },

    _clearSpeechWatchdog() {
        if (this._speechWatchdog) {
            clearTimeout(this._speechWatchdog);
            this._speechWatchdog = null;
        }
    },

    _clearResumeTimer() {
        if (this._resumeTimer) {
            clearTimeout(this._resumeTimer);
            this._resumeTimer = null;
        }
    },

    /**
     * Garde l'écran allumé tant que l'écoute est active : l'écran qui s'éteint suspend la page, donc la
     * lecture et la reconnaissance (téléphone en support dans une voiture, par exemple). Le navigateur
     * relâche le verrou quand la page passe en arrière-plan : on le reprend au retour. Sans l'API, rien.
     */
    async _acquireWakeLock() {
        const wakeLock = typeof navigator !== 'undefined' ? /** @type {any} */ (navigator).wakeLock : null;
        if (!wakeLock || this._wakeLock) return;
        try {
            const lock = await wakeLock.request('screen');
            if (!this._wantListen) {
                lock.release?.();
                return;
            }
            this._wakeLock = lock;
            lock.addEventListener?.('release', () => {
                if (this._wakeLock === lock) this._wakeLock = null;
            });
        } catch {
            // refusé (économie d'énergie, page masquée) : on continue sans
        }
    },

    _releaseWakeLock() {
        const lock = this._wakeLock;
        this._wakeLock = null;
        try {
            lock?.release?.();
        } catch {
            // déjà relâché
        }
    },

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

    /**
     * Texte actuellement lu ou tout juste lu (pendant la fenêtre d'écho), pour filtrer l'écho du haut-parleur.
     * @param {number} [now]
     * @returns {string}
     */
    getSpokenContext(now = Date.now()) {
        return this.isEchoWindow(now) ? this._spokenText : '';
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
        const formatted = formatSpeechText(text);
        const chunks = splitSpeechChunks(formatted);
        if (!chunks.length) {
            if (onEnd) onEnd();
            return;
        }

        const synth = window.speechSynthesis;
        const wasActive = this._speaking || Boolean(synth.speaking) || Boolean(synth.pending);
        const id = ++this._speechId;
        this._speaking = true;
        this._spokenText = formatted;
        this._clearSpeechWatchdog();
        if (wasActive) synth.cancel();
        this._setAudioSession(this._wantListen ? 'play-and-record' : 'playback');

        const speakChunk = (index) => {
            if (id !== this._speechId) return;
            const chunk = chunks[index];
            const utterance = new SpeechSynthesisUtterance(chunk);
            utterance.lang = 'fr-FR';
            utterance.rate = 0.95;
            this._utterance = utterance;

            let settled = false;
            const finish = () => {
                if (settled) return;
                settled = true;
                this._clearSpeechWatchdog();
                if (this._utterance === utterance) this._utterance = null;
                if (id !== this._speechId) return; // lecture remplacée ou arrêtée
                if (index + 1 < chunks.length) {
                    speakChunk(index + 1);
                    return;
                }
                this._speaking = false;
                this._lastSpeechEnd = Date.now();
                if (!this._wantListen && this._audioSessionType !== 'auto') this._setAudioSession('auto');
                if (onEnd) onEnd();
                if (this._pendingResume && this._wantListen && !this._recognizerActive && !this._speaking) {
                    this._pendingResume = false;
                    this._scheduleResume(80);
                }
            };

            utterance.onend = finish;
            utterance.onerror = finish;
            // Garde-fou si le navigateur omet onend/onerror sur une phrase.
            const watchdogMs = Math.max(8000, chunk.length * 120 + 4000);
            this._speechWatchdog = setTimeout(() => {
                if (id === this._speechId && !settled) finish();
            }, watchdogMs);
            if (synth.paused && typeof synth.resume === 'function') synth.resume();
            synth.speak(utterance);
        };

        speakChunk(0);
    },

    stopSpeaking() {
        const wasActive =
            this._speaking ||
            (this.canSpeak() && (Boolean(window.speechSynthesis.speaking) || Boolean(window.speechSynthesis.pending)));
        this._speechId += 1;
        this._clearSpeechWatchdog();
        this._utterance = null;
        if (this._speaking) this._lastSpeechEnd = Date.now();
        this._speaking = false;
        if (wasActive && this.canSpeak()) window.speechSynthesis.cancel();
        if (!this._wantListen && this._audioSessionType !== 'auto') this._setAudioSession('auto');
        if (this._pendingResume && this._wantListen && !this._recognizerActive) {
            this._pendingResume = false;
            this._scheduleResume(80);
        }
    },

    /**
     * Démarre l'écoute continue en réutilisant l'instance créée dans le geste utilisateur
     * (requis par Safari iOS/macOS ; recréée seulement après plusieurs échecs consécutifs).
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

        this._listenSessionId += 1;
        this._listenHandlers = { onResult, onError };
        this._wantListen = true;
        this._pendingResume = false;
        this._hadResultInSession = false;
        this._consecutiveQuickEnds = 0;
        this._consecutiveFailures = 0;
        this._retryDelayMs = INITIAL_RETRY_MS;
        this._transientErrorCount = 0;
        this._resumeRecognizer();
        this._acquireWakeLock();
        return true;
    },

    stopListening() {
        this._listenSessionId += 1;
        this._wantListen = false;
        this._pendingResume = false;
        this._listenHandlers = null;
        this._clearResumeTimer();
        this._releaseWakeLock();
        this._discardRecognizer();
        if (!this._speaking && this._audioSessionType !== 'auto') this._setAudioSession('auto');
    },

    _discardRecognizer() {
        const old = this._recognizer;
        this._recognizer = null;
        this._recognizerActive = false;
        this._consecutiveFailures = 0;
        if (old) {
            try {
                old.abort();
            } catch {
                // déjà arrêtée
            }
        }
    },

    _scheduleResume(delayMs) {
        this._clearResumeTimer();
        if (!this._wantListen || this._recognizerActive) return;
        const sessionId = this._listenSessionId;
        this._resumeTimer = setTimeout(() => {
            this._resumeTimer = null;
            if (sessionId !== this._listenSessionId || !this._wantListen || this._recognizerActive) return;
            if (this._speaking) {
                this._pendingResume = true;
                return;
            }
            this._resumeRecognizer();
        }, delayMs);
    },

    _createRecognizer(handlers, sessionId) {
        const Recognition = recognitionClass();
        const rec = new Recognition();
        rec.lang = 'fr-FR';
        rec.continuous = false;
        rec.interimResults = false;
        rec.maxAlternatives = 3;

        rec.onresult = (event) => {
            if (rec !== this._recognizer || sessionId !== this._listenSessionId) return;
            const results = event?.results;
            const result = results && results.length ? results[results.length - 1] : null;
            if (!result) return;
            this._attemptGotResult = true;
            this._hadResultInSession = true;
            this._consecutiveQuickEnds = 0;
            this._consecutiveFailures = 0;
            this._retryDelayMs = INITIAL_RETRY_MS;
            this._transientErrorCount = 0;
            const alternatives = [];
            for (let i = 0; i < result.length; i += 1) {
                const t = result[i]?.transcript;
                if (t) alternatives.push(t);
            }
            if (alternatives.length) handlers.onResult(alternatives);
        };

        rec.onerror = (event) => {
            if (rec !== this._recognizer || sessionId !== this._listenSessionId) return;
            const rawCode = event?.error;
            const code = rawCode === 'service-not-allowed' ? 'not-allowed' : rawCode;
            if (code === 'aborted') {
                this._attemptHadAborted = true;
                this._consecutiveFailures += 1;
            }
            if (SILENT_ERRORS.has(code)) return;

            // En voiture, le basculement Bluetooth ou une micro-coupure réseau peuvent provoquer une erreur
            // transitoire après un premier échange réussi : on retente brièvement avant d'abandonner.
            const isTransient = code === 'audio-capture' || code === 'network';
            const canRetryTransient =
                isTransient && (this._speaking || (this._hadResultInSession && this._transientErrorCount < 2));
            if (canRetryTransient) {
                this._transientErrorCount += 1;
                this._consecutiveFailures += 1;
                this._attemptHadTransient = true;
                if (this._speaking) this._pendingResume = true;
                return;
            }

            this._listenSessionId += 1;
            this._wantListen = false;
            this._pendingResume = false;
            this._clearResumeTimer();
            this._releaseWakeLock();
            this._recognizer = null;
            this._recognizerActive = false;
            if (!this._speaking && this._audioSessionType !== 'auto') this._setAudioSession('auto');
            handlers.onError(code);
        };

        rec.onend = () => {
            if (rec !== this._recognizer || sessionId !== this._listenSessionId) return;
            this._recognizerActive = false;
            if (!this._wantListen) return;

            const elapsed = Date.now() - this._attemptStartedAt;
            const quickEnd = !this._attemptGotResult && elapsed < 350;
            if (quickEnd) {
                this._consecutiveQuickEnds += 1;
            } else {
                this._consecutiveQuickEnds = 0;
                if (!this._attemptHadAborted && !this._attemptHadTransient) {
                    this._consecutiveFailures = 0;
                    this._retryDelayMs = INITIAL_RETRY_MS;
                }
            }

            const hadCollision = this._attemptHadAborted || this._attemptHadTransient;
            if (this._consecutiveFailures >= 2) {
                this._discardRecognizer();
            }

            // En lecture active, ne mettre en pause que si le navigateur/Bluetooth coupe réellement le micro.
            if (this._speaking && (hadCollision || quickEnd)) {
                this._pendingResume = true;
                return;
            }

            if (hadCollision || this._consecutiveQuickEnds >= 2) {
                const delay = this._retryDelayMs;
                this._retryDelayMs = Math.min(this._retryDelayMs * 2, MAX_RETRY_MS);
                this._scheduleResume(delay);
                return;
            }

            this._resumeRecognizer();
        };

        return rec;
    },

    _resumeRecognizer() {
        if (!this._wantListen || this._recognizerActive) return;
        const Recognition = recognitionClass();
        const handlers = this._listenHandlers;
        if (!Recognition || !handlers) return;

        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            this._scheduleResume(1000);
            return;
        }

        const sessionId = this._listenSessionId;
        if (!this._recognizer || this._consecutiveFailures >= 2) {
            this._discardRecognizer();
            this._recognizer = this._createRecognizer(handlers, sessionId);
        }
        const rec = this._recognizer;

        this._attemptStartedAt = Date.now();
        this._attemptGotResult = false;
        this._attemptHadAborted = false;
        this._attemptHadTransient = false;
        this._pendingResume = false;

        try {
            this._recognizerActive = true;
            rec.start();
        } catch (err) {
            this._recognizerActive = false;
            const name = err && typeof err === 'object' ? /** @type {any} */ (err).name : '';
            if (name === 'NotAllowedError' || name === 'SecurityError') {
                this._listenSessionId += 1;
                this._wantListen = false;
                this._pendingResume = false;
                this._clearResumeTimer();
                this._releaseWakeLock();
                this._discardRecognizer();
                if (!this._speaking && this._audioSessionType !== 'auto') this._setAudioSession('auto');
                handlers.onError('not-allowed');
                return;
            }
            this._consecutiveFailures += 1;
            if (this._consecutiveFailures >= 2) {
                this._discardRecognizer();
            }
            if (this._speaking) {
                this._pendingResume = true;
            } else {
                const delay = this._retryDelayMs;
                this._retryDelayMs = Math.min(this._retryDelayMs * 2, MAX_RETRY_MS);
                this._scheduleResume(delay);
            }
        }
    },

    /** @returns {{ autoRead: boolean, voiceConsent: boolean, chain: boolean }} */
    getPrefs() {
        const stored = StorageService.get(PREFS_KEY, null);
        const prefs = stored && typeof stored === 'object' ? stored : {};
        return {
            autoRead: prefs.autoRead === true,
            voiceConsent: prefs.voiceConsent === true,
            chain: prefs.chain === true,
        };
    },

    /** @param {Partial<{ autoRead: boolean, voiceConsent: boolean, chain: boolean }>} partial */
    setPrefs(partial) {
        StorageService.set(PREFS_KEY, { ...this.getPrefs(), ...partial });
    },
};

if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && VoiceService._wantListen) {
            VoiceService._acquireWakeLock();
            if (!VoiceService._recognizerActive && !VoiceService._speaking) {
                VoiceService._resumeRecognizer();
            }
        }
    });
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('online', () => {
        if (VoiceService._wantListen && !VoiceService._recognizerActive && !VoiceService._speaking) {
            VoiceService._resumeRecognizer();
        }
    });
}

export default VoiceService;
