import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import SafetyView, { READY_CHECKLIST, SIGR_PLATES } from '../../js/views/safety.js';

// Spec 019 : les textes de l'écran Sécurité passent dans le catalogue sans rien changer à
// l'affichage. Ces instantanés ont été enregistrés AVANT le déplacement ; ils doivent rester identiques.
const root = () => document.getElementById('safety-root');
const text = (id) => document.getElementById(id).textContent;
const spoken = [];

async function mountFresh() {
    document.body.innerHTML = '<div id="safety-root"></div>';
    SafetyView._rendered = false;
    SafetyView.checked.clear();
    SafetyView.readyAnswers = {};
    SafetyView.position = null;
    await SafetyView.mount({});
}

beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-30T10:00:00'));
    localStorage.clear();
    spoken.length = 0;
    window.speechSynthesis = /** @type {any} */ ({ cancel() {}, speak: (u) => spoken.push(u.text) });
    window.SpeechSynthesisUtterance = /** @type {any} */ (
        class {
            constructor(t) {
                this.text = t;
            }
        }
    );
    await mountFresh();
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete window.speechSynthesis;
});

const answerAll = (level) => {
    for (const q of READY_CHECKLIST.flatMap((d) => d.questions)) {
        const i = q.answers.findIndex(([, l]) => l === level);
        SafetyView.readyAnswers[q.id] = i >= 0 ? i : 0;
    }
    SafetyView.renderReadyState();
    return text('safety-ready-verdict');
};

describe('safety renders (spec 019: identical before and after moving the texts)', () => {
    it('whole page', () => {
        expect(root().innerHTML).toMatchSnapshot();
    });

    it('pre-flight progress, done state and spoken checklist', () => {
        SafetyView.toggleCheck(0);
        const one = text('safety-check-progress');
        SafetyView.readChecklist();
        for (let i = 1; i < 7; i++) SafetyView.toggleCheck(i);
        SafetyView.readChecklist();
        expect({ one, all: text('safety-check-progress'), spoken }).toMatchSnapshot();
    });

    it('ready verdicts', () => {
        expect({ red: answerAll('red'), yellow: answerAll('yellow'), green: answerAll('green') }).toMatchSnapshot();
    });

    it('SIGR summaries', () => {
        const rate = (plate, rating) =>
            SafetyView.ratePlate(null, null, /** @type {any} */ ({ dataset: { plate, rating } }));
        rate(SIGR_PLATES[0].id, 'solid');
        const oneSolid = text('safety-sigr-summary');
        rate(SIGR_PLATES[1].id, 'weak');
        rate(SIGR_PLATES[6].id, 'weak');
        expect({ oneSolid, weak: text('safety-sigr-summary') }).toMatchSnapshot();
    });

    it('GPS messages and position text', async () => {
        const states = {};
        const geo = (impl) =>
            Object.defineProperty(navigator, 'geolocation', {
                configurable: true,
                value: { getCurrentPosition: impl },
            });
        let ok;
        let ko;
        geo((a, b) => ((ok = a), (ko = b)));
        SafetyView.locate();
        states.searching = { status: text('safety-geo-status'), label: text('safety-locate-label') };
        ko({ code: 1 });
        states.denied = { status: text('safety-geo-status'), label: text('safety-locate-label') };
        SafetyView.locate();
        ko({ code: 2 });
        states.unavailable = text('safety-geo-status');
        SafetyView.locate();
        ko({ code: 3 });
        states.timeout = text('safety-geo-status');
        SafetyView.locate();
        ko({ code: 9 });
        states.unknown = text('safety-geo-status');
        SafetyView.locate();
        ok({ coords: { latitude: 45.1, longitude: 6.2, altitude: 1500.4, accuracy: 250 }, timestamp: Date.now() });
        states.imprecise = {
            status: text('safety-geo-status'),
            label: text('safety-locate-label'),
            alt: text('safety-pos-alt'),
            acc: text('safety-pos-acc'),
        };
        SafetyView.locate();
        ko({ code: 2 });
        states.failedAfterFix = text('safety-locate-label');
        SafetyView.setPosition({ latitude: 45.1, longitude: 6.2, altitude: null, accuracy: 8 }, Date.now());
        states.precise = {
            status: text('safety-geo-status'),
            alt: text('safety-pos-alt'),
            acc: text('safety-pos-acc'),
        };
        SafetyView.setPosition({ latitude: 45.1, longitude: 6.2, altitude: 900, accuracy: undefined }, Date.now());
        states.noAccuracy = text('safety-pos-acc');
        states.positionText = SafetyView.positionText();
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText: () => Promise.resolve() },
        });
        await SafetyView.copyPosition();
        states.copied = text('safety-geo-status');
        navigator.clipboard.writeText = () => Promise.reject(new Error('no'));
        await SafetyView.copyPosition();
        states.copyFailed = text('safety-geo-status');
        let shared;
        Object.defineProperty(navigator, 'share', {
            configurable: true,
            value: (d) => ((shared = d), Promise.resolve()),
        });
        await SafetyView.sharePosition();
        states.shareTitle = shared.title;
        vi.stubGlobal('navigator', {});
        SafetyView.locate();
        vi.unstubAllGlobals();
        states.noGps = text('safety-geo-status');
        expect(states).toMatchSnapshot();
    });
});
