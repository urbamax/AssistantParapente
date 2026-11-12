import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import VoiceService, { formatSpeechText, splitSpeechChunks } from '../../js/services/voice_service.js';

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
        vi.useRealTimers();
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

        describe('audio session (iPhone silent switch)', () => {
            afterEach(() => {
                delete navigator.audioSession;
            });

            it('declares a playback session before speaking and gives it back at the end', () => {
                const synth = installSynthesis();
                const seen = [];
                Object.defineProperty(navigator, 'audioSession', {
                    configurable: true,
                    value: {
                        set type(v) {
                            seen.push(v);
                        },
                    },
                });
                VoiceService.speak('Bonjour');
                expect(seen).toEqual(['playback']);
                synth.finish();
                expect(seen).toEqual(['playback', 'auto']);
            });

            it('keeps the microphone usable when listening is active', () => {
                installSynthesis();
                window.webkitSpeechRecognition = FakeRecognition;
                const seen = [];
                Object.defineProperty(navigator, 'audioSession', {
                    configurable: true,
                    value: {
                        set type(v) {
                            seen.push(v);
                        },
                    },
                });
                VoiceService.startListening({ onResult: () => {}, onError: () => {} });
                VoiceService.speak('Bonjour');
                expect(seen).toEqual(['play-and-record']);
            });

            it('speaks normally when the browser has no audio session or refuses the type', () => {
                const synth = installSynthesis();
                expect(() => VoiceService.speak('Sans API')).not.toThrow();
                Object.defineProperty(navigator, 'audioSession', {
                    configurable: true,
                    value: {
                        set type(_v) {
                            throw new Error('refusé');
                        },
                    },
                });
                expect(() => VoiceService.speak('Refusé')).not.toThrow();
                expect(synth.spoken).toHaveLength(2);
            });
        });

        it('does nothing without synthesis', () => {
            expect(() => VoiceService.speak('Bonjour')).not.toThrow();
            expect(VoiceService.isSpeaking()).toBe(false);
        });

        it('normalizes acronyms and technical units for French TTS', () => {
            expect(formatSpeechText('La norme CEN et le FL 100 ou FL115')).toBe(
                'La norme C.E.N. et le F.L. 100 ou F.L. 115',
            );
            expect(formatSpeechText('Norme CEN.')).toBe('Norme C.E.N.');
            expect(formatSpeechText('Ailes ENA, ENB-, ENB+ et EN 926-1')).toBe(
                'Ailes E.N.A., E.N.B. moins, E.N.B. plus et E.N. 926-1',
            );
            expect(formatSpeechText('Par NOTAM ou SUP AIP sur eAIP, carte VAC et message AZBA')).toBe(
                'Par notam ou sup A.I.P. sur e-A.I.P., carte vac et message azba',
            );
            expect(formatSpeechText('1013,25 hPa, 800 daN, 300 m/sol, 3500 m/mer, TMA LYON 6')).toBe(
                '1013,25 hectopascals, 800 décanewtons, 300 mètres sol, 3500 mètres mer, T.M.A. Lyon 6',
            );
            expect(formatSpeechText('En tension ET sans tension, répond OUI, déjà U.L.M.')).toBe(
                'En tension et sans tension, répond oui, déjà U.L.M.',
            );
        });

        it('splits long texts into chunks without cutting off mid-sentence and calls onEnd at the very end', () => {
            const synth = installSynthesis();
            const onEnd = vi.fn();
            const long =
                'Un niveau de vol (FL, Flight Level) se mesure par rapport à la surface isobare 1 013,25 hPa. ' +
                'Le FL115, soit 11 500 pieds ou environ 3 500 m, est la limite en VFR sauf dans les Alpes et les Pyrénées. ' +
                'Au-dessus se trouve la LTA interdite au vol libre en dehors de quelques exceptions prévues par la FFVL.';
            const chunks = splitSpeechChunks(formatSpeechText(long), 120);
            expect(chunks.length).toBeGreaterThan(1);
            expect(chunks.every((c) => c.length <= 120)).toBe(true);

            VoiceService.speak(long, { onEnd });
            expect(synth.spoken).toHaveLength(1);
            expect(VoiceService.isSpeaking()).toBe(true);

            // Déroule chaque segment jusqu'à la fin sans couper la phrase.
            while (synth.current) {
                expect(onEnd).not.toHaveBeenCalled();
                synth.finish();
            }
            expect(synth.spoken.length).toBeGreaterThan(1);
            expect(synth.spoken.map((u) => u.text).join(' ')).toContain('F.F.V.L.');
            expect(onEnd).toHaveBeenCalledTimes(1);
            expect(VoiceService.isSpeaking()).toBe(false);
        });

        it('recovers via watchdog if the browser drops onend', () => {
            vi.useFakeTimers();
            installSynthesis();
            const onEnd = vi.fn();
            VoiceService.speak('Bonjour', { onEnd });
            expect(VoiceService.isSpeaking()).toBe(true);
            vi.advanceTimersByTime(15000);
            expect(VoiceService.isSpeaking()).toBe(false);
            expect(onEnd).toHaveBeenCalledTimes(1);
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

        it('listens in French and passes every alternative, then starts a fresh recognizer', () => {
            const onResult = vi.fn();
            expect(VoiceService.startListening({ onResult, onError: vi.fn() })).toBe(true);
            const rec = recognizers[0];
            expect(rec.lang).toBe('fr-FR');
            expect(rec.maxAlternatives).toBe(3);
            expect(VoiceService.isListening()).toBe(true);
            rec.hear('bédé', 'B et D');
            expect(onResult).toHaveBeenCalledWith(['bédé', 'B et D']);
            expect(recognizers).toHaveLength(2);
            expect(recognizers[1].active).toBe(true);
        });

        it('restarts silently after silence', () => {
            const onError = vi.fn();
            VoiceService.startListening({ onResult: vi.fn(), onError });
            recognizers[0].fail('no-speech');
            expect(onError).not.toHaveBeenCalled();
            expect(recognizers).toHaveLength(2);
            expect(recognizers[1].active).toBe(true);
        });

        it('retries automatically when restarting throws InvalidStateError (iOS/Android)', () => {
            vi.useFakeTimers();
            let shouldThrow = false;
            class FlakyRecognition extends FakeRecognition {
                start() {
                    if (shouldThrow) throw new Error('InvalidStateError');
                    super.start();
                }
            }
            window.SpeechRecognition = FlakyRecognition;
            const onResult = vi.fn();
            VoiceService.startListening({ onResult, onError: vi.fn() });

            shouldThrow = true;
            recognizers[0].hear('A');
            expect(onResult).toHaveBeenCalledWith(['A']);
            expect(recognizers.at(-1).active).toBe(false);

            shouldThrow = false;
            vi.advanceTimersByTime(150);
            expect(recognizers.at(-1).active).toBe(true);
            recognizers.at(-1).hear('valider');
            expect(onResult).toHaveBeenLastCalledWith(['valider']);
        });

        it('backs off after aborted errors and recovers', () => {
            vi.useFakeTimers();
            const onError = vi.fn();
            VoiceService.startListening({ onResult: vi.fn(), onError });
            recognizers[0].fail('aborted');
            expect(onError).not.toHaveBeenCalled();
            expect(recognizers).toHaveLength(1);
            vi.advanceTimersByTime(150);
            expect(recognizers).toHaveLength(2);
            expect(recognizers[1].active).toBe(true);
        });

        it('survives a transient network blip after an earlier exchange in a car', () => {
            vi.useFakeTimers();
            const onError = vi.fn();
            VoiceService.startListening({ onResult: vi.fn(), onError });
            recognizers[0].hear('oui');
            recognizers[1].fail('network');
            expect(onError).not.toHaveBeenCalled();
            expect(VoiceService.isListening()).toBe(true);
            vi.advanceTimersByTime(150);
            expect(recognizers).toHaveLength(3);
            expect(recognizers[2].active).toBe(true);
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

        // Spec 022 : on peut répondre sans attendre la fin de la lecture ; si la reco s'arrête
        // pendant que l'app parle, la relance attend la fin de la phrase pour éviter les coupures Bluetooth.
        it('keeps listening while speaking and resumes cleanly once speech ends', () => {
            const synth = installSynthesis();
            const onResult = vi.fn();
            VoiceService.startListening({ onResult, onError: vi.fn() });
            const rec = recognizers[0];
            VoiceService.speak('Réponse A : oui.');
            expect(rec.active).toBe(true);
            expect(rec.aborted).toBe(0);
            rec.hear('B');
            expect(onResult).toHaveBeenCalledWith(['B']);
            expect(recognizers).toHaveLength(1);
            synth.finish();
            expect(recognizers).toHaveLength(2);
            expect(recognizers[1].active).toBe(true);
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

    describe('screen wake lock while listening (hands-free in a car)', () => {
        const installWakeLock = () => {
            const lock = { release: vi.fn(), addEventListener: vi.fn() };
            const request = vi.fn(async () => lock);
            Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } });
            return { lock, request };
        };

        afterEach(() => {
            delete navigator.wakeLock;
        });

        it('keeps the screen on while listening and releases it when listening stops', async () => {
            window.webkitSpeechRecognition = FakeRecognition;
            const { lock, request } = installWakeLock();
            VoiceService.startListening({ onResult: () => {}, onError: () => {} });
            await Promise.resolve();
            await Promise.resolve();
            expect(request).toHaveBeenCalledWith('screen');
            VoiceService.stopListening();
            expect(lock.release).toHaveBeenCalledTimes(1);
        });

        it('releases a lock granted after listening was already stopped', async () => {
            window.webkitSpeechRecognition = FakeRecognition;
            const { lock } = installWakeLock();
            VoiceService.startListening({ onResult: () => {}, onError: () => {} });
            VoiceService.stopListening();
            await Promise.resolve();
            await Promise.resolve();
            expect(lock.release).toHaveBeenCalled();
        });

        it('listens normally without the API or when the lock is refused', async () => {
            window.webkitSpeechRecognition = FakeRecognition;
            expect(VoiceService.startListening({ onResult: () => {}, onError: () => {} })).toBe(true);
            VoiceService.stopListening();
            Object.defineProperty(navigator, 'wakeLock', {
                configurable: true,
                value: { request: vi.fn(async () => Promise.reject(new Error('refusé'))) },
            });
            expect(VoiceService.startListening({ onResult: () => {}, onError: () => {} })).toBe(true);
            await Promise.resolve();
            await Promise.resolve();
        });
    });

    describe('prefs (data-model VoicePrefs)', () => {
        it('defaults to everything off', () => {
            expect(VoiceService.getPrefs()).toEqual({ autoRead: false, voiceConsent: false, chain: false });
        });

        it('stores partial updates', () => {
            VoiceService.setPrefs({ autoRead: true });
            VoiceService.setPrefs({ voiceConsent: true });
            VoiceService.setPrefs({ chain: true });
            expect(VoiceService.getPrefs()).toEqual({ autoRead: true, voiceConsent: true, chain: true });
            expect(JSON.parse(localStorage.getItem('parapente_voice_prefs'))).toEqual({
                autoRead: true,
                voiceConsent: true,
                chain: true,
            });
        });

        it('falls back to defaults on a corrupt value', () => {
            localStorage.setItem('parapente_voice_prefs', 'oops');
            expect(VoiceService.getPrefs()).toEqual({ autoRead: false, voiceConsent: false, chain: false });
            localStorage.setItem('parapente_voice_prefs', JSON.stringify({ autoRead: 'yes', voiceConsent: 1 }));
            expect(VoiceService.getPrefs()).toEqual({ autoRead: false, voiceConsent: false, chain: false });
        });
    });
});
