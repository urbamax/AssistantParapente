/**
 * VIEW - SafetyView
 * Écran « Sécurité » : procédure d'urgence (alerte, position GPS, hélicoptère, arbre/falaise),
 * visite prévol en 7 points et auto-évaluation SIGR.
 *
 * Tout le contenu est statique et embarqué dans ce module (précaché par sw.js) : l'écran doit
 * rester utilisable sans réseau, typiquement à l'atterrissage ou au pied d'un arbre. La position
 * vient du GPS du téléphone (navigator.geolocation), qui ne dépend pas du réseau mobile.
 *
 * Sources (toutes présentes dans courses/) :
 *  - Affiche FFVL « Secours vol libre – Conseils aux pilotes » (2022)
 *  - Livret FFVL Initiation 2025, § « Visite prévol »
 *  - Affiche FFVL « La SIGR – Stratégie individuelle de gestion des risques » (2019)
 *  - Livret FFVL « 9BD » (2014), « Votre check-list » / « Prêt pour le déco ? » (© Mentalpilote)
 */
import BaseView from '../core/base_view.js';
import StorageService from '../services/storage.js';
import { formatDecimalDegrees, formatDegreesMinutes, formatDegreesMinutesSeconds } from '../utils/geo_utils.js';
import { shuffled } from '../utils/array_utils.js';
import { escapeHTML } from '../core/security.js';
import { t } from '../utils/i18n.js';
import { FR } from '../i18n/fr.js';

// Textes de l'écran (spec 019), tous dans js/i18n/fr.js (section safety). esc() : texte pour du
// HTML ; rich() : idem, en gardant le gras <strong> de l'affiche ou du livret (seule balise permise).
const S = FR.safety;
const esc = (text) => escapeHTML(text);
const rich = (text) => escapeHTML(text).replace(/&lt;(\/?)strong&gt;/g, '<$1strong>');
const tl = (key, params) => t(`safety.${key}`, params);

export const SAFETY_FREQUENCY = '143,9875 MHz';

const SOURCES = {
    SECOURS: 'courses/GENERAL/affiches-pedagogiques-a3/19-secours2022/19-secours2022.pdf',
    PREVOL: 'courses/BREVET INITIAL - VERT/livrets-pp-2025/initiation-2025-web/initiation-2025-web.pdf#page=15',
    SIGR: 'courses/GENERAL/affiches-pedagogiques-a3/16-sigr2019/16-sigr2019.pdf',
    READY: 'courses/GENERAL/2014_Livret_FFVL_9BD.pdf#page=7',
};

/**
 * Livret 9BD, « Votre check-list » : chaque réponse est codée vert / jaune / rouge sur le livret,
 * reproduit ici à l'identique (level).
 */
/** Question du livret : libellés dans le catalogue, couleur de chaque réponse ici (level). */
const readyQuestion = (id, levels) => ({
    id,
    label: S.ready.questions[id].label,
    answers: S.ready.questions[id].answers.map((answer, i) => [answer, levels[i]]),
});

export const READY_CHECKLIST = [
    {
        domain: S.ready.domains.fitness,
        questions: [
            readyQuestion('vie', ['green', 'yellow', 'red']),
            readyQuestion('physique', ['green', 'yellow', 'red']),
            readyQuestion('humeur', ['green', 'yellow', 'red']),
        ],
    },
    {
        domain: S.ready.domains.gear,
        questions: [readyQuestion('aile', ['green', 'red']), readyQuestion('attache', ['green', 'red'])],
    },
    {
        domain: S.ready.domains.ready,
        questions: [
            readyQuestion('conditions', ['green', 'yellow', 'red']),
            readyQuestion('deco', ['green', 'yellow', 'red']),
            readyQuestion('espace', ['green', 'yellow', 'red']),
        ],
    },
];

const READY_QUESTIONS = READY_CHECKLIST.flatMap((d) => d.questions);

/**
 * Lecture du livret : « Rouge (et) jaune : vous êtes vulnérable. Un ou plusieurs jaunes :
 * soyez vigilant. Les trois domaines sont verts : bon vol. »
 * @param {Object<string, number>} answers - id de question → index de la réponse choisie
 * @returns {'incomplete'|'red'|'yellow'|'green'}
 */
export function readyVerdict(answers) {
    const levels = READY_QUESTIONS.map((q) => q.answers[answers[q.id]]?.[1]);
    if (levels.some((l) => !l)) return 'incomplete';
    if (levels.includes('red')) return 'red';
    if (levels.includes('yellow')) return 'yellow';
    return 'green';
}

const READY_VERDICT_TEXT = S.ready.verdicts;

/** Livret Initiation 2025 : « une vérification attentive d'un minimum de 7 points ». */
export const PREFLIGHT_CHECKLIST = ['harnessOff', 'harnessOn', 'takeoff'].map((phase) => ({
    phase: S.preflight.phases[phase],
    items: [...S.preflight.items[phase]],
}));

const PREFLIGHT_COUNT = PREFLIGHT_CHECKLIST.reduce((n, group) => n + group.items.length, 0);

/** Les 7 « plaques » de l'affiche SIGR, dans l'ordre de l'affiche. */
export const SIGR_PLATES = [
    'pilotage',
    'aerologie',
    'accidentologie',
    'materiel',
    'physique',
    'communaute',
    'mental',
].map((id) => ({ id, title: S.sigr.plates[id].title, detail: S.sigr.plates[id].detail }));

export const SIGR_STORAGE_KEY = 'parapente_sigr_assessment';
const SIGR_RATINGS = ['solid', 'weak'];

const TABS = ['urgence', 'prevol', 'sigr'];

const GEO_ERRORS = S.geo.errors;

function sourceLink(url, label) {
    return `<button type="button" class="safety-source" data-action="openUrl" data-url="${url}">
        <i class="ri-file-pdf-2-line" aria-hidden="true"></i> ${esc(tl('source', { label }))}
    </button>`;
}

class SafetyViewClass extends BaseView {
    constructor() {
        super();
        this.activeTab = 'urgence';
        this.checked = new Set();
        this.readyAnswers = {};
        this.position = null;
        this._rendered = false;
    }

    async mount(params) {
        await super.mount(params);
        const root = document.getElementById('safety-root');
        if (!root) return;
        // Toujours ouvrir sur l'urgence : c'est l'onglet dont on a besoin sans chercher.
        this.activeTab = 'urgence';
        if (!this._rendered) {
            root.innerHTML = this.renderPage();
            this._rendered = true;
        }
        this.applyTab();
        this.renderChecklistState();
        this.renderReadyState();
        this.renderSigrState();
    }

    async unmount() {
        await super.unmount();
        if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
    }

    // ------------------------------------------------------------------ rendu

    renderPage() {
        return `
            <h2 class="page-title">${esc(S.title)}</h2>
            <section id="safety-panel-urgence" aria-label="${esc(S.tabs.urgence)}" class="safety-panel">
                ${this.renderEmergency()}
            </section>
            <section id="safety-panel-prevol" aria-label="${esc(S.tabs.prevol)}" class="safety-panel">
                ${this.renderReady()}
                ${this.renderPreflight()}
            </section>
            <section id="safety-panel-sigr" aria-label="${esc(S.tabs.sigr)}" class="safety-panel">
                ${this.renderSigr()}
            </section>
        `;
    }

    renderEmergency() {
        return `
            <div class="safety-alert-actions">
                <a class="safety-call-btn" href="tel:112">
                    <i class="ri-phone-fill" aria-hidden="true"></i>
                    <span><strong>${esc(S.emergency.call)}</strong><small>${esc(S.emergency.callHint)}</small></span>
                </a>
                <div class="safety-frequency" aria-label="${esc(S.emergency.frequencyLabel)}">
                    <i class="ri-broadcast-line" aria-hidden="true"></i>
                    <span><strong>${SAFETY_FREQUENCY}</strong><small>${esc(S.emergency.frequencyHint)}</small></span>
                </div>
            </div>

            <div class="safety-card">
                <h3><i class="ri-map-pin-user-line" aria-hidden="true"></i> ${esc(S.emergency.positionTitle)}</h3>
                <p class="safety-hint">${esc(S.emergency.positionHint)}</p>
                <button type="button" class="safety-btn safety-btn-primary" data-action="Safetylocate">
                    <i class="ri-focus-3-line" aria-hidden="true"></i> <span id="safety-locate-label">${esc(S.emergency.locate)}</span>
                </button>
                <p id="safety-geo-status" class="safety-geo-status" role="status" aria-live="polite"></p>
                <dl id="safety-position" class="safety-position" hidden>
                    <dt>${esc(S.emergency.dm)} <small>${esc(S.emergency.dmHint)}</small></dt>
                    <dd id="safety-pos-dm" class="safety-coord"></dd>
                    <dt>${esc(S.emergency.dd)}</dt>
                    <dd id="safety-pos-dd" class="safety-coord"></dd>
                    <dt>${esc(S.emergency.dms)}</dt>
                    <dd id="safety-pos-dms" class="safety-coord"></dd>
                    <dt>${esc(S.emergency.altitude)}</dt>
                    <dd id="safety-pos-alt"></dd>
                    <dt>${esc(S.emergency.accuracy)}</dt>
                    <dd id="safety-pos-acc"></dd>
                </dl>
                <div id="safety-position-actions" class="safety-position-actions" hidden>
                    <button type="button" class="safety-btn" data-action="SafetycopyPosition">
                        <i class="ri-file-copy-line" aria-hidden="true"></i> ${esc(S.emergency.copy)}
                    </button>
                    <button type="button" class="safety-btn" id="safety-share-btn" data-action="SafetysharePosition" hidden>
                        <i class="ri-share-line" aria-hidden="true"></i> ${esc(S.emergency.share)}
                    </button>
                </div>
            </div>

            <div class="safety-card">
                <h3><i class="ri-megaphone-line" aria-hidden="true"></i> ${esc(S.emergency.alertTitle)}</h3>
                <ol class="safety-steps">
                    <li>${rich(S.emergency.alertSteps[0])}</li>
                    <li>${rich(S.emergency.alertSteps[1]).replace('{frequency}', SAFETY_FREQUENCY)}</li>
                    <li>${rich(S.emergency.alertSteps[2])}</li>
                    <li>${rich(S.emergency.alertSteps[3])}</li>
                </ol>
                <p class="safety-hint">${esc(S.emergency.alertHint)}</p>
            </div>

            <div class="safety-card">
                <h3><i class="ri-tree-line" aria-hidden="true"></i> ${esc(S.emergency.treeTitle)}</h3>
                <p class="safety-warning">${esc(S.emergency.treeWarning)}</p>
                <h4>${esc(S.emergency.needHelp)}</h4>
                <ul>
                    <li>${esc(S.emergency.needHelpItems[0])}</li>
                    <li>${esc(S.emergency.needHelpItems[1])}</li>
                </ul>
                <h4>${esc(S.emergency.noHelp)}</h4>
                <ul>
                    <li>${esc(S.emergency.noHelpItems[0])}</li>
                </ul>
            </div>

            <div class="safety-card">
                <h3><i class="ri-user-follow-line" aria-hidden="true"></i> ${esc(S.emergency.signalTitle)}</h3>
                <div class="safety-signals">
                    <figure class="safety-signal safety-signal-yes">
                        ${this.renderSignal(true)}
                        <figcaption>${rich(S.emergency.signalYes)}</figcaption>
                    </figure>
                    <figure class="safety-signal safety-signal-no">
                        ${this.renderSignal(false)}
                        <figcaption>${rich(S.emergency.signalNo)}</figcaption>
                    </figure>
                </div>
            </div>

            <div class="safety-card">
                <h3><i class="ri-flight-takeoff-line" aria-hidden="true"></i> ${esc(S.emergency.heliTitle)}</h3>
                <ul>
                    <li>${rich(S.emergency.heliItems[0])}</li>
                    <li>${rich(S.emergency.heliItems[1])}</li>
                    <li>${rich(S.emergency.heliItems[2])}</li>
                    <li>${rich(S.emergency.heliItems[3])}</li>
                </ul>
            </div>

            <div class="safety-card">
                <h3><i class="ri-first-aid-kit-line" aria-hidden="true"></i> ${esc(S.emergency.kitTitle)}</h3>
                <p class="safety-hint">${esc(S.emergency.kitHint)}</p>
                <ul>
                    <li>${esc(S.emergency.kitItems[0])}</li>
                    <li>${esc(S.emergency.kitItems[1])}</li>
                    <li>${esc(S.emergency.kitItems[2])}</li>
                    <li>${esc(S.emergency.kitItems[3])}</li>
                </ul>
            </div>

            ${sourceLink(SOURCES.SECOURS, S.sources.secours)}
        `;
    }

    /** Silhouette simplifiée des signaux sol-air de l'affiche FFVL. */
    renderSignal(yes) {
        const rightArm = yes ? 'M50 44 L68 18' : 'M50 44 L68 72';
        return `<svg viewBox="0 0 100 110" aria-hidden="true" focusable="false">
            <circle cx="50" cy="26" r="9" />
            <path d="M50 36 V74 M50 74 L38 104 M50 74 L62 104 M50 44 L32 18 ${rightArm}" />
        </svg>`;
    }

    renderPreflight() {
        let index = 0;
        const groups = PREFLIGHT_CHECKLIST.map((group) => {
            const items = group.items
                .map((label) => {
                    const i = index++;
                    return `<li>
                        <button type="button" role="checkbox" aria-checked="false" class="safety-check"
                            data-check-index="${i}" data-action="SafetytoggleCheck" data-args="${i}">
                            <span class="safety-check-box" aria-hidden="true"><i class="ri-check-line"></i></span>
                            <span class="safety-check-num">${i + 1}</span>
                            <span class="safety-check-label">${esc(label)}</span>
                        </button>
                    </li>`;
                })
                .join('');
            return `<h4 class="safety-phase">${esc(group.phase)}</h4><ul class="safety-checklist">${items}</ul>`;
        }).join('');

        return `
            <div class="safety-card">
                <div class="safety-checklist-head">
                    <h3><i class="ri-checkbox-multiple-line" aria-hidden="true"></i> ${esc(S.preflight.title)}</h3>
                    <span id="safety-check-progress" class="safety-progress" aria-live="polite"></span>
                </div>
                <p class="safety-hint">${esc(S.preflight.hint)}</p>
                ${groups}
                <p id="safety-check-done" class="safety-done" hidden>
                    <i class="ri-checkbox-circle-fill" aria-hidden="true"></i> ${esc(S.preflight.done)}
                </p>
                <div class="safety-position-actions">
                    <button type="button" class="safety-btn" id="safety-read-btn" data-action="SafetyreadChecklist" hidden>
                        <i class="ri-volume-up-line" aria-hidden="true"></i> ${esc(S.preflight.read)}
                    </button>
                    <button type="button" class="safety-btn" data-action="SafetyresetChecklist">
                        <i class="ri-restart-line" aria-hidden="true"></i> ${esc(S.preflight.reset)}
                    </button>
                </div>
                <p class="safety-hint">${esc(S.preflight.tip)}</p>
            </div>
            ${sourceLink(SOURCES.PREVOL, S.sources.prevol)}
        `;
    }

    // Les réponses sont mélangées à chaque affichage (et à « Recommencer ») et leur couleur n'apparaît
    // qu'une fois la check-list complète : un ordre fixe vert / jaune / rouge pousse à cliquer la
    // première réponse sans lire et à ne jamais choisir le rouge.
    renderReady() {
        const domains = READY_CHECKLIST.map((domain) => {
            const questions = domain.questions
                .map(
                    (q) => `<fieldset class="safety-question">
                        <legend>${esc(q.label)}</legend>
                        <div class="safety-answers">
                            ${shuffled(q.answers.map((answer, i) => [...answer, i]))
                                .map(
                                    ([label, level, i]) => `<button type="button" aria-pressed="false"
                                        class="safety-answer safety-answer-${level}" data-action="SafetyanswerReady"
                                        data-question="${q.id}" data-answer="${i}">${esc(label)}</button>`,
                                )
                                .join('')}
                        </div>
                    </fieldset>`,
                )
                .join('');
            return `<h4 class="safety-phase">${esc(domain.domain)}</h4>${questions}`;
        }).join('');

        return `
            <div class="safety-card">
                <h3><i class="ri-traffic-light-line" aria-hidden="true"></i> ${esc(S.ready.title)}</h3>
                <p class="safety-hint">${esc(S.ready.hint)}</p>
                ${domains}
                <p id="safety-ready-verdict" class="safety-verdict" role="status" aria-live="polite" hidden></p>
                <p class="safety-hint">${esc(S.ready.reminder)}</p>
                <div class="safety-position-actions">
                    <button type="button" class="safety-btn" data-action="SafetyresetReady">
                        <i class="ri-restart-line" aria-hidden="true"></i> ${esc(S.ready.reset)}
                    </button>
                </div>
            </div>
            ${sourceLink(SOURCES.READY, S.sources.ready)}
        `;
    }

    // Comme pour « Prêt pour le déco ? » : ordre des deux notes mélangé et couleur révélée seulement
    // une fois les 7 plaques évaluées, pour ne pas pousser vers « Solide » sans réfléchir.
    renderSigr() {
        const plates = SIGR_PLATES.map(
            (plate) => `<li class="safety-plate" data-plate="${plate.id}">
                <div class="safety-plate-text">
                    <strong>${esc(plate.title)}</strong>
                    <small>${esc(plate.detail)}</small>
                </div>
                <div class="safety-plate-rating" role="group" aria-label="${esc(plate.title)}">
                    ${shuffled(SIGR_RATINGS)
                        .map(
                            (
                                rating,
                            ) => `<button type="button" class="safety-rate safety-rate-${rating}" aria-pressed="false"
                        data-action="SafetyratePlate" data-plate="${plate.id}" data-rating="${rating}">${esc(S.sigr[rating])}</button>`,
                        )
                        .join('')}
                </div>
            </li>`,
        ).join('');

        return `
            <div class="safety-card">
                <h3><i class="ri-shield-check-line" aria-hidden="true"></i> ${esc(S.sigr.title)}</h3>
                <p>${esc(S.sigr.intro)}</p>
                <p>${rich(S.sigr.build)}</p>
                <p class="safety-hint">${esc(S.sigr.hint)}</p>
                <ul class="safety-plates">${plates}</ul>
                <p id="safety-sigr-summary" class="safety-sigr-summary" aria-live="polite"></p>
                <p class="safety-warning">${esc(S.sigr.warning)}</p>
            </div>
            ${sourceLink(SOURCES.SIGR, S.sources.sigr)}
        `;
    }

    // ------------------------------------------------------------------ onglets

    switchTab(tab) {
        if (!TABS.includes(tab)) return;
        this.activeTab = tab;
        this.applyTab();
    }

    applyTab() {
        TABS.forEach((tab) => {
            const panel = document.getElementById(`safety-panel-${tab}`);
            if (panel) panel.hidden = tab !== this.activeTab;
        });
        // Rubrique affichée, signalée dans le sous-menu « Sécurité » de la barre de navigation
        document.querySelectorAll('[data-safety-tab]').forEach((btn) => {
            btn.setAttribute('aria-current', String(btn.getAttribute('data-safety-tab') === this.activeTab));
        });
    }

    // ------------------------------------------------------------------ position GPS

    locate() {
        const status = document.getElementById('safety-geo-status');
        const label = document.getElementById('safety-locate-label');
        if (!('geolocation' in navigator)) {
            if (status) status.textContent = tl('geo.noGps');
            return;
        }
        if (status) status.textContent = tl('geo.searching');
        if (label) label.textContent = tl('geo.searchingLabel');

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                this.setPosition(pos.coords, pos.timestamp);
                if (label) label.textContent = tl('geo.refresh');
            },
            (err) => {
                if (status) status.textContent = GEO_ERRORS[err.code] || tl('geo.unavailable');
                if (label) label.textContent = this.position ? tl('geo.refresh') : tl('emergency.locate');
            },
            { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 },
        );
    }

    setPosition(coords, timestamp = Date.now()) {
        const { latitude, longitude, altitude, accuracy } = coords;
        this.position = { latitude, longitude, altitude, accuracy, timestamp };

        const set = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        };
        set('safety-pos-dm', formatDegreesMinutes(latitude, longitude));
        set('safety-pos-dd', formatDecimalDegrees(latitude, longitude));
        set('safety-pos-dms', formatDegreesMinutesSeconds(latitude, longitude));
        set(
            'safety-pos-alt',
            typeof altitude === 'number' ? tl('geo.altitude', { alt: Math.round(altitude) }) : tl('geo.noAltitude'),
        );
        set(
            'safety-pos-acc',
            typeof accuracy === 'number'
                ? tl('geo.accuracy', { acc: Math.round(accuracy) })
                : tl('geo.unknownAccuracy'),
        );

        const time = new Date(timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        const imprecise = typeof accuracy === 'number' && accuracy > 100;
        set('safety-geo-status', imprecise ? tl('geo.imprecise', { time }) : tl('geo.fixed', { time }));

        const block = document.getElementById('safety-position');
        const actions = document.getElementById('safety-position-actions');
        const share = document.getElementById('safety-share-btn');
        if (block) block.hidden = false;
        if (actions) actions.hidden = false;
        if (share) share.hidden = typeof navigator.share !== 'function';
    }

    positionText() {
        if (!this.position) return '';
        const { latitude, longitude, altitude, accuracy } = this.position;
        const lines = [
            tl('geo.textTitle'),
            formatDegreesMinutes(latitude, longitude),
            formatDecimalDegrees(latitude, longitude),
        ];
        if (typeof altitude === 'number') lines.push(tl('geo.textAltitude', { alt: Math.round(altitude) }));
        if (typeof accuracy === 'number') lines.push(tl('geo.textAccuracy', { acc: Math.round(accuracy) }));
        return lines.join('\n');
    }

    async copyPosition() {
        const status = document.getElementById('safety-geo-status');
        try {
            await navigator.clipboard.writeText(this.positionText());
            if (status) status.textContent = tl('geo.copied');
        } catch {
            if (status) status.textContent = tl('geo.copyFailed');
        }
    }

    async sharePosition() {
        if (typeof navigator.share !== 'function' || !this.position) return;
        try {
            await navigator.share({ title: tl('geo.shareTitle'), text: this.positionText() });
        } catch {
            // Partage annulé par l'utilisateur : rien à signaler.
        }
    }

    // ------------------------------------------------------------------ prévol

    toggleCheck(index) {
        const i = Number(index);
        if (!Number.isInteger(i) || i < 0 || i >= PREFLIGHT_COUNT) return;
        if (this.checked.has(i)) this.checked.delete(i);
        else this.checked.add(i);
        this.renderChecklistState();
    }

    resetChecklist() {
        this.checked.clear();
        if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
        this.renderChecklistState();
    }

    renderChecklistState() {
        /** @type {NodeListOf<HTMLElement>} */ (
            document.querySelectorAll('#safety-panel-prevol [data-check-index]')
        ).forEach((btn) => {
            btn.setAttribute('aria-checked', String(this.checked.has(Number(btn.dataset.checkIndex))));
        });
        const progress = document.getElementById('safety-check-progress');
        if (progress) progress.textContent = `${this.checked.size} / ${PREFLIGHT_COUNT}`;
        const done = document.getElementById('safety-check-done');
        if (done) done.hidden = this.checked.size !== PREFLIGHT_COUNT;
        const read = document.getElementById('safety-read-btn');
        if (read) read.hidden = !(typeof window !== 'undefined' && 'speechSynthesis' in window);
    }

    /** Lit à voix haute les points pas encore cochés (mains libres pendant l'équipement). */
    readChecklist() {
        if (typeof window === 'undefined' || !window.speechSynthesis) return;
        const remaining = PREFLIGHT_CHECKLIST.flatMap((g) => g.items)
            .map((label, i) => ({ label, i }))
            .filter(({ i }) => !this.checked.has(i));
        const text = remaining.length
            ? tl('preflight.spoken', {
                  points: remaining.map(({ label, i }) => tl('preflight.spokenPoint', { n: i + 1, label })).join(' '),
              })
            : tl('preflight.done');
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'fr-FR';
        utterance.rate = 0.95;
        window.speechSynthesis.speak(utterance);
    }

    // ------------------------------------------------------------------ prêt pour le déco

    answerReady(_args, _e, target) {
        const question = READY_QUESTIONS.find((q) => q.id === target?.dataset.question);
        const answer = Number(target?.dataset.answer);
        if (!question || !Number.isInteger(answer) || !question.answers[answer]) return;
        this.readyAnswers[question.id] = answer;
        this.renderReadyState();
    }

    resetReady() {
        this.readyAnswers = {};
        document.querySelectorAll('#safety-panel-prevol .safety-answers').forEach((list) => {
            list.append(...shuffled([...list.children]));
        });
        this.renderReadyState();
    }

    renderReadyState() {
        /** @type {NodeListOf<HTMLElement>} */ (
            document.querySelectorAll('#safety-panel-prevol .safety-answer')
        ).forEach((btn) => {
            btn.setAttribute(
                'aria-pressed',
                String(this.readyAnswers[btn.dataset.question] === Number(btn.dataset.answer)),
            );
        });
        const verdictEl = document.getElementById('safety-ready-verdict');
        if (!verdictEl) return;
        const verdict = readyVerdict(this.readyAnswers);
        verdictEl.hidden = verdict === 'incomplete';
        verdictEl.closest('.safety-card')?.classList.toggle('safety-ready-complete', !verdictEl.hidden);
        verdictEl.className = `safety-verdict safety-verdict-${verdict}`;
        verdictEl.textContent = READY_VERDICT_TEXT[verdict] || '';
    }

    // ------------------------------------------------------------------ SIGR

    getSigrRatings() {
        const stored = StorageService.get(SIGR_STORAGE_KEY, null);
        return stored && typeof stored.ratings === 'object' && stored.ratings ? stored.ratings : {};
    }

    ratePlate(_args, _e, target) {
        const plate = target?.dataset.plate;
        const rating = target?.dataset.rating;
        if (!SIGR_PLATES.some((p) => p.id === plate) || !SIGR_RATINGS.includes(rating)) return;
        const ratings = this.getSigrRatings();
        // Un second appui sur la même note l'efface (retour à « non évalué »).
        if (ratings[plate] === rating) delete ratings[plate];
        else ratings[plate] = rating;
        StorageService.set(SIGR_STORAGE_KEY, { ratings, updatedAt: new Date().toISOString() });
        this.renderSigrState();
    }

    renderSigrState() {
        const ratings = this.getSigrRatings();
        /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('#safety-panel-sigr .safety-rate')).forEach(
            (btn) => {
                btn.setAttribute('aria-pressed', String(ratings[btn.dataset.plate] === btn.dataset.rating));
            },
        );
        const summary = document.getElementById('safety-sigr-summary');
        if (!summary) return;
        const weak = SIGR_PLATES.filter((p) => ratings[p.id] === 'weak').map((p) => p.title);
        const rated = SIGR_PLATES.filter((p) => ratings[p.id]).length;
        summary.closest('.safety-card')?.classList.toggle('safety-sigr-complete', rated === SIGR_PLATES.length);
        if (rated === 0) summary.textContent = '';
        else if (weak.length === 0) summary.textContent = tl('sigr.summaryNone', { rated, total: SIGR_PLATES.length });
        else summary.textContent = tl('sigr.summaryWeak', { plates: weak.join(', ') });
    }
}

const SafetyView = new SafetyViewClass();
export default SafetyView;
