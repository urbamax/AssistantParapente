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
export const READY_CHECKLIST = [
    {
        domain: 'En forme ?',
        questions: [
            {
                id: 'vie',
                label: 'Dans ma vie de tous les jours, c’est :',
                answers: [
                    ['Chouette', 'green'],
                    ['Moyen', 'yellow'],
                    ['Pas terrible', 'red'],
                ],
            },
            {
                id: 'physique',
                label: 'Physiquement, je me sens :',
                answers: [
                    ['En forme', 'green'],
                    ['Ça va', 'yellow'],
                    ['Pas top top', 'red'],
                ],
            },
            {
                id: 'humeur',
                label: 'Aujourd’hui je suis :',
                answers: [
                    ['Décontracté', 'green'],
                    ['Tendu', 'yellow'],
                    ['Anxieux', 'red'],
                ],
            },
        ],
    },
    {
        domain: 'Matériel OK ?',
        questions: [
            {
                id: 'aile',
                label: 'Mon aile est à mon niveau, je l’ai installée et vérifiée dans le calme :',
                answers: [
                    ['Oui', 'green'],
                    ['Non', 'red'],
                ],
            },
            {
                id: 'attache',
                label: 'Je suis bien attaché, maillons serrés, parachute de secours vérifié :',
                answers: [
                    ['Oui', 'green'],
                    ['Non', 'red'],
                ],
            },
        ],
    },
    {
        domain: 'Prêt à partir ?',
        questions: [
            {
                id: 'conditions',
                label: 'Les conditions sont :',
                answers: [
                    ['Bonnes', 'green'],
                    ['Bof', 'yellow'],
                    ['À la limite', 'red'],
                ],
            },
            {
                id: 'deco',
                label: 'Ici le déco me semble :',
                answers: [
                    ['Facile', 'green'],
                    ['Délicat', 'yellow'],
                    ['Engagé', 'red'],
                ],
            },
            {
                id: 'espace',
                label: 'L’espace aérien est dégagé :',
                answers: [
                    ['Oui', 'green'],
                    ['Chargé', 'yellow'],
                    ['Non', 'red'],
                ],
            },
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

const READY_VERDICT_TEXT = {
    red: 'Rouge : vous êtes vulnérable. Mieux vaut renoncer ou différer.',
    yellow: 'Un ou plusieurs jaunes : soyez vigilant.',
    green: 'Les trois domaines sont verts : bon vol !',
};

/** Livret Initiation 2025 : « une vérification attentive d'un minimum de 7 points ». */
export const PREFLIGHT_CHECKLIST = [
    {
        phase: "Avant d'enfiler la sellette",
        items: [
            'Système de verrouillage du container du parachute de secours',
            "Bon positionnement de la poignée d'extraction",
        ],
    },
    {
        phase: 'Sellette mise',
        items: [
            'Fermeture des cuissardes',
            'Ventrale et son réglage',
            'Mousquetons de connexion sellette / élévateurs',
            'Jugulaire du casque',
        ],
    },
    {
        phase: 'Avant de décoller',
        items: ['Commandes bien prises (cheminement direct entre la poignée et la poulie)'],
    },
];

const PREFLIGHT_COUNT = PREFLIGHT_CHECKLIST.reduce((n, group) => n + group.items.length, 0);

/** Les 7 « plaques » de l'affiche SIGR, dans l'ordre de l'affiche. */
export const SIGR_PLATES = [
    { id: 'pilotage', title: 'Pilotage', detail: 'Compétences de pilotage' },
    { id: 'aerologie', title: 'Aérologie', detail: 'Analyse, placement…' },
    {
        id: 'accidentologie',
        title: 'Accidentologie',
        detail: 'Connaître les accidents types, avoir une culture aéronautique',
    },
    { id: 'materiel', title: 'Matériel', detail: 'Choix, entretien, réglage, ergonomie' },
    {
        id: 'physique',
        title: 'Condition physique',
        detail: 'Vue, fatigue, réflexes, maladie, gestion du froid',
    },
    {
        id: 'communaute',
        title: 'Rapport à la communauté',
        detail: "Partager / demander des infos, s'intégrer dans un groupe de pilotes qui s'entraident",
    },
    {
        id: 'mental',
        title: 'Mental',
        detail: "Gestion du stress, de l'attention, capacité à renoncer, résister aux effets de groupe",
    },
];

export const SIGR_STORAGE_KEY = 'parapente_sigr_assessment';
const SIGR_RATINGS = ['solid', 'weak'];

const TABS = ['urgence', 'prevol', 'sigr'];

const GEO_ERRORS = {
    1: 'Accès à la position refusé. Autorisez la localisation pour ce site dans les réglages du navigateur, puis réessayez.',
    2: 'Position indisponible. Sortez à découvert (loin des arbres et des parois) et réessayez.',
    3: "Le GPS n'a pas répondu à temps. Restez immobile à découvert et réessayez : le premier fix peut prendre une minute.",
};

function sourceLink(url, label) {
    return `<button type="button" class="safety-source" data-action="openUrl" data-url="${url}">
        <i class="ri-file-pdf-2-line" aria-hidden="true"></i> Source : ${label}
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
            <h2 class="page-title">SÉCURITÉ</h2>
            <div class="safety-tabs" role="tablist" aria-label="Rubriques sécurité">
                <button type="button" role="tab" id="safety-tab-urgence" aria-controls="safety-panel-urgence"
                    class="safety-tab safety-tab-urgent" data-action="SafetyswitchTab" data-args="urgence">
                    <i class="ri-alarm-warning-line" aria-hidden="true"></i> Urgence
                </button>
                <button type="button" role="tab" id="safety-tab-prevol" aria-controls="safety-panel-prevol"
                    class="safety-tab" data-action="SafetyswitchTab" data-args="prevol">
                    <i class="ri-checkbox-multiple-line" aria-hidden="true"></i> Check-lists
                </button>
                <button type="button" role="tab" id="safety-tab-sigr" aria-controls="safety-panel-sigr"
                    class="safety-tab" data-action="SafetyswitchTab" data-args="sigr">
                    <i class="ri-shield-check-line" aria-hidden="true"></i> Ma SIGR
                </button>
            </div>
            <section id="safety-panel-urgence" role="tabpanel" aria-labelledby="safety-tab-urgence" class="safety-panel">
                ${this.renderEmergency()}
            </section>
            <section id="safety-panel-prevol" role="tabpanel" aria-labelledby="safety-tab-prevol" class="safety-panel">
                ${this.renderReady()}
                ${this.renderPreflight()}
            </section>
            <section id="safety-panel-sigr" role="tabpanel" aria-labelledby="safety-tab-sigr" class="safety-panel">
                ${this.renderSigr()}
            </section>
        `;
    }

    renderEmergency() {
        return `
            <div class="safety-alert-actions">
                <a class="safety-call-btn" href="tel:112">
                    <i class="ri-phone-fill" aria-hidden="true"></i>
                    <span><strong>Appeler le 112</strong><small>Numéro d'urgence européen</small></span>
                </a>
                <div class="safety-frequency" aria-label="Fréquence radio sécurité vol libre">
                    <i class="ri-broadcast-line" aria-hidden="true"></i>
                    <span><strong>${SAFETY_FREQUENCY}</strong><small>Fréquence FFVL</small></span>
                </div>
            </div>

            <div class="safety-card">
                <h3><i class="ri-map-pin-user-line" aria-hidden="true"></i> Ma position GPS</h3>
                <p class="safety-hint">Utilise le GPS du téléphone : fonctionne sans réseau mobile.</p>
                <button type="button" class="safety-btn safety-btn-primary" data-action="Safetylocate">
                    <i class="ri-focus-3-line" aria-hidden="true"></i> <span id="safety-locate-label">Obtenir ma position</span>
                </button>
                <p id="safety-geo-status" class="safety-geo-status" role="status" aria-live="polite"></p>
                <dl id="safety-position" class="safety-position" hidden>
                    <dt>Degrés minutes <small>(aéro / hélico)</small></dt>
                    <dd id="safety-pos-dm" class="safety-coord"></dd>
                    <dt>Degrés décimaux</dt>
                    <dd id="safety-pos-dd" class="safety-coord"></dd>
                    <dt>Degrés minutes secondes</dt>
                    <dd id="safety-pos-dms" class="safety-coord"></dd>
                    <dt>Altitude GPS</dt>
                    <dd id="safety-pos-alt"></dd>
                    <dt>Précision</dt>
                    <dd id="safety-pos-acc"></dd>
                </dl>
                <div id="safety-position-actions" class="safety-position-actions" hidden>
                    <button type="button" class="safety-btn" data-action="SafetycopyPosition">
                        <i class="ri-file-copy-line" aria-hidden="true"></i> Copier
                    </button>
                    <button type="button" class="safety-btn" id="safety-share-btn" data-action="SafetysharePosition" hidden>
                        <i class="ri-share-line" aria-hidden="true"></i> Partager
                    </button>
                </div>
            </div>

            <div class="safety-card">
                <h3><i class="ri-megaphone-line" aria-hidden="true"></i> L'alerte</h3>
                <ol class="safety-steps">
                    <li>Appelez le <strong>112</strong>.</li>
                    <li>Passez sur la fréquence <strong>${SAFETY_FREQUENCY}</strong> pour être joignable par l'hélicoptère.</li>
                    <li>Donnez votre <strong>position GPS</strong> et précisez les <strong>conditions d'accès</strong>.</li>
                    <li>Soyez prêt à répondre aux questions des secours.</li>
                </ol>
                <p class="safety-hint">En vol, gardez votre téléphone allumé, glissé dans la sellette à un endroit accessible.</p>
            </div>

            <div class="safety-card">
                <h3><i class="ri-tree-line" aria-hidden="true"></i> Vous êtes « branché » ou en falaise</h3>
                <p class="safety-warning">Attention aux sur-accidents : ne prenez pas de risques en cherchant à descendre par vos propres moyens.</p>
                <h4>Vous avez besoin d'aide</h4>
                <ul>
                    <li>Sécurisez-vous en vous attachant solidement avec votre kit de secours.</li>
                    <li>Signalez aux secouristes si votre aile risque d'être entraînée par le souffle de l'hélicoptère.</li>
                </ul>
                <h4>Vous n'avez pas besoin d'aide</h4>
                <ul>
                    <li>Appelez quand même le 112 pour éviter un déplacement inutile des secours, et signalez votre position.</li>
                </ul>
            </div>

            <div class="safety-card">
                <h3><i class="ri-user-follow-line" aria-hidden="true"></i> Signaler à l'hélicoptère</h3>
                <div class="safety-signals">
                    <figure class="safety-signal safety-signal-yes">
                        ${this.renderSignal(true)}
                        <figcaption><strong>YES</strong> · Les deux bras levés : j'ai besoin d'aide</figcaption>
                    </figure>
                    <figure class="safety-signal safety-signal-no">
                        ${this.renderSignal(false)}
                        <figcaption><strong>NO</strong> · Un bras levé, un bras baissé : pas besoin d'aide</figcaption>
                    </figure>
                </div>
            </div>

            <div class="safety-card">
                <h3><i class="ri-flight-takeoff-line" aria-hidden="true"></i> Hélicoptère en intervention</h3>
                <ul>
                    <li><strong>Priorité aux secours</strong> : ne décollez plus pendant toute la durée de l'intervention sur zone.</li>
                    <li>Sortez de la zone d'interdiction de vol : <strong>500 m</strong> autour du lieu de l'accident, <strong>sans limite de hauteur</strong>.</li>
                    <li>Cela laisse l'hélicoptère manœuvrer (repérage, approche, dépose, treuillage) et vous protège de ses turbulences de sillage, sensibles loin et longtemps après son passage.</li>
                    <li>Plusieurs rotations sont souvent nécessaires pour procéder à l'évacuation.</li>
                </ul>
            </div>

            <div class="safety-card">
                <h3><i class="ri-first-aid-kit-line" aria-hidden="true"></i> Kit de secours personnel</h3>
                <p class="safety-hint">À garder accessible dans la sellette.</p>
                <ul>
                    <li>Sangle Dyneema 120 cm et mousqueton de sécurité (sécuriser sa position).</li>
                    <li>Cordelette de 20 m (permettre le hissage de la corde des secouristes).</li>
                    <li>Un couteau (lest éventuel de la cordelette).</li>
                    <li>Un sifflet (signaler sa position).</li>
                </ul>
            </div>

            ${sourceLink(SOURCES.SECOURS, 'affiche FFVL « Secours vol libre » (2022)')}
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
                            <span class="safety-check-label">${label}</span>
                        </button>
                    </li>`;
                })
                .join('');
            return `<h4 class="safety-phase">${group.phase}</h4><ul class="safety-checklist">${items}</ul>`;
        }).join('');

        return `
            <div class="safety-card">
                <div class="safety-checklist-head">
                    <h3><i class="ri-checkbox-multiple-line" aria-hidden="true"></i> Visite prévol</h3>
                    <span id="safety-check-progress" class="safety-progress" aria-live="polite"></span>
                </div>
                <p class="safety-hint">Une vérification attentive d'un minimum de 7 points, avant chaque décollage.</p>
                ${groups}
                <p id="safety-check-done" class="safety-done" hidden>
                    <i class="ri-checkbox-circle-fill" aria-hidden="true"></i> Prévol complète. Bon vol !
                </p>
                <div class="safety-position-actions">
                    <button type="button" class="safety-btn" id="safety-read-btn" data-action="SafetyreadChecklist" hidden>
                        <i class="ri-volume-up-line" aria-hidden="true"></i> Lire à voix haute
                    </button>
                    <button type="button" class="safety-btn" data-action="SafetyresetChecklist">
                        <i class="ri-restart-line" aria-hidden="true"></i> Recommencer
                    </button>
                </div>
                <p class="safety-hint">Astuce : faites-la en « partner-check », en vérifiant à deux l'équipement de chacun.</p>
            </div>
            ${sourceLink(SOURCES.PREVOL, 'livret FFVL Initiation 2025, « Visite prévol »')}
        `;
    }

    renderReady() {
        const domains = READY_CHECKLIST.map((domain) => {
            const questions = domain.questions
                .map(
                    (q) => `<fieldset class="safety-question">
                        <legend>${q.label}</legend>
                        <div class="safety-answers">
                            ${q.answers
                                .map(
                                    ([label, level], i) => `<button type="button" aria-pressed="false"
                                        class="safety-answer safety-answer-${level}" data-action="SafetyanswerReady"
                                        data-question="${q.id}" data-answer="${i}">${label}</button>`,
                                )
                                .join('')}
                        </div>
                    </fieldset>`,
                )
                .join('');
            return `<h4 class="safety-phase">${domain.domain}</h4>${questions}`;
        }).join('');

        return `
            <div class="safety-card">
                <h3><i class="ri-traffic-light-line" aria-hidden="true"></i> Prêt pour le déco ?</h3>
                <p class="safety-hint">Check-list ou prise de conscience ? Répondez franchement, avant de vous équiper.</p>
                ${domains}
                <p id="safety-ready-verdict" class="safety-verdict" role="status" aria-live="polite" hidden></p>
                <p class="safety-hint">N’oubliez pas que c’est toujours un enchaînement de petites choses qui entraîne des surprises.</p>
                <div class="safety-position-actions">
                    <button type="button" class="safety-btn" data-action="SafetyresetReady">
                        <i class="ri-restart-line" aria-hidden="true"></i> Recommencer
                    </button>
                </div>
            </div>
            ${sourceLink(SOURCES.READY, 'livret FFVL 9BD, « Votre check-list » (© Mentalpilote)')}
        `;
    }

    renderSigr() {
        const plates = SIGR_PLATES.map(
            (plate) => `<li class="safety-plate" data-plate="${plate.id}">
                <div class="safety-plate-text">
                    <strong>${plate.title}</strong>
                    <small>${plate.detail}</small>
                </div>
                <div class="safety-plate-rating" role="group" aria-label="${plate.title}">
                    <button type="button" class="safety-rate safety-rate-solid" aria-pressed="false"
                        data-action="SafetyratePlate" data-plate="${plate.id}" data-rating="solid">Solide</button>
                    <button type="button" class="safety-rate safety-rate-weak" aria-pressed="false"
                        data-action="SafetyratePlate" data-plate="${plate.id}" data-rating="weak">À renforcer</button>
                </div>
            </li>`,
        ).join('');

        return `
            <div class="safety-card">
                <h3><i class="ri-shield-check-line" aria-hidden="true"></i> Stratégie individuelle de gestion des risques</h3>
                <p>Inspirée du modèle de Reason : plusieurs « plaques » vous protègent de l'accident. Chacune a ses
                    « trous » (vos lacunes). Quand ces trous s'alignent, le risque d'accident augmente.</p>
                <p><strong>Pour bâtir votre SIGR</strong> : faites le bilan des compétences nécessaires à votre pratique,
                    identifiez celles qui vous manquent, puis acquérez-les pour « boucher les trous ».</p>
                <p class="safety-hint">Évaluez honnêtement chaque plaque. Votre bilan reste sur cet appareil.</p>
                <ul class="safety-plates">${plates}</ul>
                <p id="safety-sigr-summary" class="safety-sigr-summary" aria-live="polite"></p>
                <p class="safety-warning">La SIGR doit être continuellement réévaluée au fur et à mesure de votre progression.</p>
            </div>
            ${sourceLink(SOURCES.SIGR, 'affiche FFVL « La SIGR » (2019)')}
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
            const btn = document.getElementById(`safety-tab-${tab}`);
            const panel = document.getElementById(`safety-panel-${tab}`);
            const active = tab === this.activeTab;
            if (btn) {
                btn.setAttribute('aria-selected', String(active));
                btn.classList.toggle('active', active);
            }
            if (panel) panel.hidden = !active;
        });
    }

    // ------------------------------------------------------------------ position GPS

    locate() {
        const status = document.getElementById('safety-geo-status');
        const label = document.getElementById('safety-locate-label');
        if (!('geolocation' in navigator)) {
            if (status) status.textContent = 'Ce navigateur ne donne pas accès au GPS.';
            return;
        }
        if (status) status.textContent = 'Recherche du signal GPS…';
        if (label) label.textContent = 'Recherche en cours…';

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                this.setPosition(pos.coords, pos.timestamp);
                if (label) label.textContent = 'Actualiser ma position';
            },
            (err) => {
                if (status) status.textContent = GEO_ERRORS[err.code] || 'Position indisponible.';
                if (label) label.textContent = this.position ? 'Actualiser ma position' : 'Obtenir ma position';
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
        set('safety-pos-alt', typeof altitude === 'number' ? `${Math.round(altitude)} m` : 'Non fournie par le GPS');
        set('safety-pos-acc', typeof accuracy === 'number' ? `± ${Math.round(accuracy)} m` : 'Inconnue');

        const time = new Date(timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        const imprecise = typeof accuracy === 'number' && accuracy > 100;
        set(
            'safety-geo-status',
            imprecise
                ? `Position de ${time}, encore imprécise : restez à découvert et actualisez dans quelques secondes.`
                : `Position relevée à ${time}.`,
        );

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
            'Position GPS :',
            formatDegreesMinutes(latitude, longitude),
            formatDecimalDegrees(latitude, longitude),
        ];
        if (typeof altitude === 'number') lines.push(`Altitude : ${Math.round(altitude)} m`);
        if (typeof accuracy === 'number') lines.push(`Précision : ± ${Math.round(accuracy)} m`);
        return lines.join('\n');
    }

    async copyPosition() {
        const status = document.getElementById('safety-geo-status');
        try {
            await navigator.clipboard.writeText(this.positionText());
            if (status) status.textContent = 'Position copiée : collez-la dans un SMS ou un message.';
        } catch {
            if (status) status.textContent = 'Copie impossible : lisez les coordonnées ci-dessus.';
        }
    }

    async sharePosition() {
        if (typeof navigator.share !== 'function' || !this.position) return;
        try {
            await navigator.share({ title: 'Ma position GPS', text: this.positionText() });
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
        document.querySelectorAll('#safety-panel-prevol [data-check-index]').forEach((btn) => {
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
            ? `Visite prévol. ${remaining.map(({ label, i }) => `Point ${i + 1} : ${label}.`).join(' ')}`
            : 'Prévol complète. Bon vol !';
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
        this.renderReadyState();
    }

    renderReadyState() {
        document.querySelectorAll('#safety-panel-prevol .safety-answer').forEach((btn) => {
            btn.setAttribute(
                'aria-pressed',
                String(this.readyAnswers[btn.dataset.question] === Number(btn.dataset.answer)),
            );
        });
        const verdictEl = document.getElementById('safety-ready-verdict');
        if (!verdictEl) return;
        const verdict = readyVerdict(this.readyAnswers);
        verdictEl.hidden = verdict === 'incomplete';
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
        document.querySelectorAll('#safety-panel-sigr .safety-rate').forEach((btn) => {
            btn.setAttribute('aria-pressed', String(ratings[btn.dataset.plate] === btn.dataset.rating));
        });
        const summary = document.getElementById('safety-sigr-summary');
        if (!summary) return;
        const weak = SIGR_PLATES.filter((p) => ratings[p.id] === 'weak').map((p) => p.title);
        const rated = SIGR_PLATES.filter((p) => ratings[p.id]).length;
        if (rated === 0) summary.textContent = '';
        else if (weak.length === 0)
            summary.textContent = `${rated} / ${SIGR_PLATES.length} plaques évaluées, aucune à renforcer.`;
        else summary.textContent = `À renforcer en priorité : ${weak.join(', ')}.`;
    }
}

const SafetyView = new SafetyViewClass();
export default SafetyView;
