import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import VoiceService from '../../js/services/voice_service.js';

// Spec 016 : enveloppe des API vocales du navigateur (lecture, écoute, préférences).

class FakeUtterance {
    constructor(text) {
        this.text = text;
    }
}

function installSynthesis() {
    const synth = {
        spoken: [],
        current: null,
        speak: vi.fn((u) => {
            synth.spoken.push(u);
            synth.current = u;
        }),
        cancel: vi.fn(() => {
            // Comme Chrome : annuler déclenche la fin de l'énoncé en cours.
            const u = synth.current;
            synth.current = null;
            if (u && u.onend) u.onend();
        }),
        finish() {
            const u = synth.current;
            synth.current = null;
            if (u && u.onend) u.onend();
        },
    };
    window.speechSynthesis = /** @type {any} */ (synth);
    window.SpeechSynthesisUtterance = /** @type {any} */ (FakeUtterance);
    return synth;
}

let recognizers = [];
class FakeRecognition {
    constructor() {
        this.started = 0;
        this.aborted = 0;
        this.active = false;
        recognizers.push(this);
    }
    start() {
        if (this.active) throw new Error('InvalidStateError');
        this.active = true;
        this.started += 1;
    }
    abort() {
        this.aborted += 1;
        if (this.active) {
            this.active = false;
            if (this.onend) this.onend();
        }
    }
    stop() {
        this.abort();
    }
    // Aides de test
    hear(...alternatives) {
        const result = alternatives.map((transcript) => ({ transcript }));
        this.onresult({ results: [result] });
        this.active = false;
        this.onend();
    }
    fail(error) {
        this.onerror({ error });
        this.active = false;
        this.onend();
    }
}

function setOnline(value) {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => value });
}

describe('VoiceService (spec 016)', () => {
    beforeEach(() => {
        recognizers = [];
        localStorage.clear();
        setOnline(true);
        VoiceService._lastSpeechEnd = -Infinity;
    });

    afterEach(() => {
        VoiceService.stopListening();
        VoiceService.stopSpeaking();
        delete window.speechSynthesis;
        delete window.SpeechSynthesisUtterance;
        delete window.SpeechRecognition;
        delete window.webkitSpeechRecognition;
        vi.restoreAllMocks();
    });

    describe('support', () => {
        it('reports missing APIs', () => {
            expect(VoiceService.canSpeak()).toBe(false);
            expect(VoiceService.canListen()).toBe(false);
        });

        it('detects synthesis and prefixed recognition', () => {
            installSynthesis();
            window.webkitSpeechRecognition = FakeRecognition;
            expect(VoiceService.canSpeak()).toBe(true);
            expect(VoiceService.canListen()).toBe(true);
        });
    });

    describe('speak', () => {
        it('speaks in French and calls onEnd once finished', () => {
            const synth = installSynthesis();
            const onEnd = vi.fn();
            VoiceService.speak('Bonjour', { onEnd });
            expect(synth.spoken[0].text).toBe('Bonjour');
            expect(synth.spoken[0].lang).toBe('fr-FR');
            expect(VoiceService.isSpeaking()).toBe(true);
            synth.finish();
            expect(onEnd).toHaveBeenCalledTimes(1);
            expect(VoiceService.isSpeaking()).toBe(false);
        });

        it('stopSpeaking cancels without calling onEnd', () => {
            const synth = installSynthesis();
            const onEnd = vi.fn();
            VoiceService.speak('Bonjour', { onEnd });
            VoiceService.stopSpeaking();
            expect(synth.cancel).toHaveBeenCalled();
            expect(onEnd).not.toHaveBeenCalled();
            expect(VoiceService.isSpeaking()).toBe(false);
        });

        it('a new reading replaces the previous one', () => {
            const synth = installSynthesis();
            const first = vi.fn();
            VoiceService.speak('Un', { onEnd: first });
            VoiceService.speak('Deux');
            expect(first).not.toHaveBeenCalled();
            expect(synth.current.text).toBe('Deux');
        });

        it('does nothing without synthesis', () => {
            expect(() => VoiceService.speak('Bonjour')).not.toThrow();
            expect(VoiceService.isSpeaking()).toBe(false);
        });
    });

    describe('listen', () => {
        beforeEach(() => {
            window.SpeechRecognition = FakeRecognition;
        });

        it('reports unsupported browsers', () => {
            delete window.SpeechRecognition;
            const onError = vi.fn();
            expect(VoiceService.startListening({ onResult: vi.fn(), onError })).toBe(false);
            expect(onError).toHaveBeenCalledWith('unsupported');
        });

        it('reports offline before asking for the microphone', () => {
            setOnline(false);
            const onError = vi.fn();
            expect(VoiceService.startListening({ onResult: vi.fn(), onError })).toBe(false);
            expect(onError).toHaveBeenCalledWith('offline');
            expect(recognizers.length).toBe(0);
        });

        it('listens in French and passes every alternative, then listens again', () => {
            const onResult = vi.fn();
            expect(VoiceService.startListening({ onResult, onError: vi.fn() })).toBe(true);
            const rec = recognizers[0];
            expect(rec.lang).toBe('fr-FR');
            expect(rec.maxAlternatives).toBe(3);
            expect(VoiceService.isListening()).toBe(true);
            rec.hear('bédé', 'B et D');
            expect(onResult).toHaveBeenCalledWith(['bédé', 'B et D']);
            expect(rec.started).toBe(2);
        });

        it('restarts silently after silence', () => {
            const onError = vi.fn();
            VoiceService.startListening({ onResult: vi.fn(), onError });
            recognizers[0].fail('no-speech');
            expect(onError).not.toHaveBeenCalled();
            expect(recognizers[0].started).toBe(2);
        });

        it.each([
            ['not-allowed', 'not-allowed'],
            ['service-not-allowed', 'not-allowed'],
            ['network', 'network'],
            ['audio-capture', 'audio-capture'],
        ])('stops on %s and reports %s', (error, code) => {
            const onError = vi.fn();
            VoiceService.startListening({ onResult: vi.fn(), onError });
            recognizers[0].fail(error);
            expect(onError).toHaveBeenCalledWith(code);
            expect(VoiceService.isListening()).toBe(false);
            expect(recognizers[0].started).toBe(1);
        });

        // Spec 022 : on peut répondre sans attendre la fin de la lecture.
        it('keeps listening while speaking (spec 022, FR-005)', () => {
            const synth = installSynthesis();
            const onResult = vi.fn();
            VoiceService.startListening({ onResult, onError: vi.fn() });
            const rec = recognizers[0];
            VoiceService.speak('Réponse A : oui.');
            expect(rec.active).toBe(true);
            expect(rec.aborted).toBe(0);
            rec.hear('B');
            expect(onResult).toHaveBeenCalledWith(['B']);
            expect(rec.active).toBe(true);
            synth.finish();
            expect(rec.active).toBe(true);
        });

        it('reports an echo window while speaking and shortly after (spec 022, FR-006)', () => {
            const synth = installSynthesis();
            const now = vi.spyOn(Date, 'now').mockReturnValue(10_000);
            expect(VoiceService.isEchoWindow()).toBe(false);
            VoiceService.speak('Texte');
            expect(VoiceService.isEchoWindow()).toBe(true);
            synth.finish();
            now.mockReturnValue(11_000);
            expect(VoiceService.isEchoWindow()).toBe(true);
            now.mockReturnValue(12_000);
            expect(VoiceService.isEchoWindow()).toBe(false);
        });

        it('stopSpeaking also opens the echo window', () => {
            installSynthesis();
            const now = vi.spyOn(Date, 'now').mockReturnValue(50_000);
            VoiceService.speak('Texte');
            VoiceService.stopSpeaking();
            now.mockReturnValue(50_500);
            expect(VoiceService.isEchoWindow()).toBe(true);
        });

        it('stopListening releases the microphone and does not restart', () => {
            VoiceService.startListening({ onResult: vi.fn(), onError: vi.fn() });
            VoiceService.stopListening();
            expect(recognizers[0].active).toBe(false);
            expect(recognizers[0].started).toBe(1);
            expect(VoiceService.isListening()).toBe(false);
        });
    });

    describe('prefs (data-model VoicePrefs)', () => {
        it('defaults to everything off', () => {
            expect(VoiceService.getPrefs()).toEqual({ autoRead: false, voiceConsent: false });
        });

        it('stores partial updates', () => {
            VoiceService.setPrefs({ autoRead: true });
            VoiceService.setPrefs({ voiceConsent: true });
            expect(VoiceService.getPrefs()).toEqual({ autoRead: true, voiceConsent: true });
            expect(JSON.parse(localStorage.getItem('parapente_voice_prefs'))).toEqual({
                autoRead: true,
                voiceConsent: true,
            });
        });

        it('falls back to defaults on a corrupt value', () => {
            localStorage.setItem('parapente_voice_prefs', 'oops');
            expect(VoiceService.getPrefs()).toEqual({ autoRead: false, voiceConsent: false });
            localStorage.setItem('parapente_voice_prefs', JSON.stringify({ autoRead: 'yes', voiceConsent: 1 }));
            expect(VoiceService.getPrefs()).toEqual({ autoRead: false, voiceConsent: false });
        });
    });
});
