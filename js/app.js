/* --- STATE MANAGEMENT --- */
const state = {
    mode: 'MENU', // MENU, ADVENTURE, EXAM
    altitude: 1000, // PV equivalent
    knowledge: 0, // XP equivalent
    level: 'INITIAL', // INITIAL, PILOTE, CONFIRME
    currentScenarioIndex: 0,
    examUnlocked: false
};

const SCENARIOS = [
    // --- INITIAL LEVEL ---
    {
        id: 'init_1',
        level: 'INITIAL',
        icon: '🌤️',
        text: "Vous êtes au décollage pour votre premier grand vol. La manche à air souffle légèrement de face (10 km/h). Votre moniteur vous donne le feu vert. Que faites-vous ?",
        choices: [
            {
                text: "Je gonfle ma voile, je temporise pour vérifier qu'elle est au-dessus de moi, puis j'accélère.",
                correct: true,
                explanation: "C'est la procédure standard : Gonflage -> Tempo (contrôle visuel) -> Accélération décisive."
            },
            {
                text: "Je cours le plus vite possible sans regarder ma voile pour décoller vite.",
                correct: false,
                explanation: "DANGER ! Si la voile n'est pas parfaitement montée, vous risquez de tomber ou de décoller en 'vrac'. La phase de temporisation et de contrôle visuel est OBLIGATOIRE.",
                penalty: 200
            },
            {
                text: "J'attends que le vent s'arrête complètement pour être plus tranquille.",
                correct: false,
                explanation: "En parapente, on décolle face au vent. Un vent nul demande une course très rapide. 10 km/h est idéal pour faciliter le gonflage.",
                penalty: 50
            }
        ]
    },
    {
        id: 'init_2',
        level: 'INITIAL',
        icon: '🦅',
        text: "En l'air, vous croisez un autre parapente qui arrive sur votre droite à la même altitude. Qui a la priorité ?",
        choices: [
            {
                text: "L'autre pilote (priorité à droite).",
                correct: true,
                explanation: "Règle de base de l'air : comme sur la route, priorité à droite lors d'un croisement à altitude égale."
            },
            {
                text: "C'est moi, car je suis plus rapide.",
                correct: false,
                explanation: "La vitesse ne donne aucune priorité. Vous devez éviter l'autre aéronef en virant à droite.",
                penalty: 100
            }
        ]
    },

    // --- PILOT LEVEL ---
    {
        id: 'pil_1',
        level: 'PILOTE',
        icon: '☁️',
        text: "Vous observez un Cumulonimbus (Cb) en développement à 10km. Le ciel s'assombrit. Que décidez-vous ?",
        choices: [
            {
                text: "Je vais atterrir immédiatement.",
                correct: true,
                explanation: "Sage décision. Les Cb génèrent des rafales violentes et des ascendances incontrôlables, même à distance (front de rafales)."
            },
            {
                text: "Je continue, il est encore loin.",
                correct: false,
                explanation: "ERREUR FATALE. Un Cb peut aspirer un parapente à plusieurs kilomètres de distance. Le danger est mortel.",
                penalty: 500
            }
        ]
    },
    {
        id: 'pil_2',
        level: 'PILOTE',
        icon: '⛰️',
        text: "Vous volez près du relief. Le vent météo vient de la gauche. Où se trouve la zone sous le vent (dangereuse) ?",
        choices: [
            {
                text: "Sur la droite du relief.",
                correct: true,
                explanation: "Bravo. Si le vent vient de gauche, la zone abritée derrière le relief (à droite) est turbulente (rotors). À éviter absolument."
            },
            {
                text: "Sur la gauche, face au vent.",
                correct: false,
                explanation: "Non, ça c'est la zone 'au vent' (dynamique). La zone dangereuse est derrière l'obstacle par rapport au vent.",
                penalty: 150
            }
        ]
    },

    // --- CONFIRMED LEVEL ---
    {
        id: 'conf_1',
        level: 'CONFIRME',
        icon: '🗺️',
        text: "Vous préparez un cross. L'émagramme annonce une inversion de température marquée à 1500m. Qu'est-ce que cela signifie ?",
        choices: [
            {
                text: "Les thermiques seront bloqués à cette altitude.",
                correct: true,
                explanation: "Exact. L'inversion agit comme un couvercle. Il sera très difficile de monter plus haut que 1500m."
            },
            {
                text: "C'est excellent, les thermiques seront très puissants au-dessus de 1500m.",
                correct: false,
                explanation: "Au contraire. L'air chaud étant plus léger, l'inversion stabilise la masse d'air et stoppe les ascendances.",
                penalty: 150
            }
        ]
    },
    {
        id: 'conf_2',
        level: 'CONFIRME',
        icon: '✈️',
        text: "Transition face au vent ! Vous devez traverser une vallée avec 20 km/h de vent de face. Quel régime de vol adoptez-vous pour aller le plus loin possible ?",
        choices: [
            {
                text: "J'accélère (Polaire des vitesses).",
                correct: true,
                explanation: "C'est crucial. Face au vent, votre finesse sol se dégrade. Pour l'optimiser, il faut voler plus vite que le taux de chute mini (accélérateur). Regardez votre polaire !",
                schematic: 'POLAR'
            },
            {
                text: "Je freine un peu pour chuter moins vite (Taux de chute mini).",
                correct: false,
                explanation: "Erreur classique. En freinant face au vent, vous reculez presque par rapport au sol. Vous n'avancerez pas et poserez aux vaches rapidement.",
                penalty: 200
            }
        ]
    },

    // --- NOUVEAUX SCENARIOS : ESPACES AERIENS (BI/BP/BPC) ---

    // BI - Règles de base
    {
        id: 'air_bi_1',
        level: 'INITIAL',
        icon: '🛑',
        text: "Vous voyez une zone rouge sur la carte aéronautique marquée 'R' (Réglementée). Elle est active. Pouvez-vous la traverser ?",
        choices: [
            {
                text: "Non, c'est formellement interdit quand elle est active.",
                correct: true,
                explanation: "Exact. Une zone R active est impénétrable (tirs militaires, drones, etc.). Pénétrer = Danger de mort + Amende."
            },
            {
                text: "Oui, si je reste en dessous de 300m.",
                correct: false,
                explanation: "Faux. Les limites de la zone s'appliquent (souvent du sol à une altitude donnée).",
                penalty: 300
            }
        ]
    },
    {
        id: 'air_bi_2',
        level: 'INITIAL',
        icon: '🚁',
        text: "Un hélicoptère du SAMU arrive pour un secours en montagne à proximité. Que faites-vous ?",
        choices: [
            {
                text: "Je m'éloigne immédiatement ou je vais atterrir.",
                correct: true,
                explanation: "Priorité absolue aux secours. Vous devez dégager la zone pour ne pas gêner leur manœuvre."
            },
            {
                text: "Je continue à voler en observant, c'est beau.",
                correct: false,
                explanation: "Irresponsable. Vous mettez en danger l'équipage et la victime. C'est une infraction grave.",
                penalty: 500
            }
        ]
    },

    // BP - Espaces contrôlés
    {
        id: 'air_bp_1',
        level: 'PILOTE',
        icon: '🛫',
        text: "Vous approchez d'une CTR (Zone de Contrôle Terminal) d'un aéroport civil classe D. Avez-vous le droit d'y entrer ?",
        choices: [
            {
                text: "Seulement avec une radio aviation et une clairance de la tour.",
                correct: true,
                explanation: "Les CTR de classe D sont contrôlées. Sans contact radio et autorisation explicite, l'entrée est interdite aux VFR (nous).",
                schematic: 'PARAGLIDER'
            },
            {
                text: "Oui, tant que je ne croise pas d'avion.",
                correct: false,
                explanation: "Absolument interdit. Vous seriez invisible pour le contrôle et créeriez un risque de collision majeur.",
                penalty: 400
            }
        ]
    },
    {
        id: 'air_bp_2',
        level: 'PILOTE',
        icon: '📏',
        text: "En VFR (Vol à Vue), quelle est la distance minimale par rapport aux nuages en espace non-contrôlé au-dessus de la surface S (ou 900m AMSL) ?",
        choices: [
            {
                text: "1500m horizontalement, 300m verticalement.",
                correct: true,
                explanation: "C'est la règle VFR standard hors nuage : 1.5km en latéral, 300m (1000ft) en vertical."
            },
            {
                text: "Je peux lécher le nuage tant que je vois le sol.",
                correct: false,
                explanation: "Non, ça c'est le 'Vol de pente' (conditions particulières). En vol libre général, on doit garder ses distances.",
                penalty: 150
            }
        ]
    },
    {
        id: 'air_bp_3',
        level: 'PILOTE',
        icon: '🗺️',
        text: "Sur votre carte OACI, vous voyez une ligne bleue épaisse avec des 'dents' vers l'intérieur marquée TMA. ",
        choices: [
            {
                text: "C'est une zone de contrôle (Terminal Manoeuvring Area) située en altitude.",
                correct: true,
                explanation: "Les TMA chapeautent généralement les CTR et les aérodromes. Elles ont un plancher (ex: 1500m) et un plafond."
            },
            {
                text: "C'est une zone de parc naturel.",
                correct: false,
                explanation: "Non, les parcs sont souvent en vert avec des animaux/logos. Du bleu = Espace Aérien (souvent contrôlé).",
                penalty: 100
            }
        ]
    },

    // BPC - Complexité & Règles de l'air
    {
        id: 'air_bpc_1',
        level: 'CONFIRME',
        icon: '🏔️',
        text: "Vous volez dans le Parc National des Écrins (Cœur). Quelle est la réglementation spécifique ?",
        choices: [
            {
                text: "Interdit à moins de 1000m sol, sauf dérogations/couloirs spécifiques.",
                correct: true,
                explanation: "Les cœurs de Parc Nationaux sont très protégés. Le survol est généralement interdit ou très restreint (hauter min > 1000m)."
            },
            {
                text: "Autorisé si je ne fais pas de bruit.",
                correct: false,
                explanation: "Le parapente est silencieux mais le dérangement de la faune (ombre, visuel) est réel. C'est interdit.",
                penalty: 300
            }
        ]
    },
    {
        id: 'air_bpc_2',
        level: 'CONFIRME',
        icon: '⚔️',
        text: "Vous voyez une zone 'D' (Dangereuse) sur la carte. Contrairement à une zone 'R' ou 'P', que signifie-t-elle ?",
        choices: [
            {
                text: "La pénétration n'est pas interdite, mais à mes risques et périls.",
                correct: true,
                explanation: "Zone D = Danger pour l'aéronef (ex: zone d'essais non-tirs). L'entrée est laissée à l'initiative du commandant de bord (vous), mais déconseillée."
            },
            {
                text: "C'est une zone de Demande obligatoire.",
                correct: false,
                explanation: "Non. D = Danger. R = Restricted (Réglementé). P = Prohibited (Interdit).",
                penalty: 100
            }
        ]
    },
    {
        id: 'air_bpc_3',
        level: 'CONFIRME',
        icon: '⏱️',
        text: "Le 'VFR de nuit' est-il autorisé en parapente en France ?",
        choices: [
            {
                text: "Jamais. Le vol libre est limité à la période 'Lever du soleil -30min' à 'Coucher +30min'.",
                correct: true,
                explanation: "On ne vole qu'entre les éphémérides aéronautiques (jour). Le vol de nuit nécessite équipement + qualification + aéronef certifié."
            },
            {
                text: "Oui, si j'ai une lumière stroboscopique.",
                correct: false,
                explanation: "Non, même avec des lumières, le parapente n'est pas certifié VFR nuit.",
                penalty: 250
            }
        ]
    },
    {
        id: 'air_bpc_4',
        level: 'CONFIRME',
        icon: '🔄',
        text: "Priorité : Vous êtes en thermiques avec un autre pilote. Il est un peu plus bas que vous et monte plus vite. Il va vous percuter par dessous.",
        choices: [
            {
                text: "Je dois m'écarter, priorité à l'aéronef le plus bas (et le moins manœuvrant).",
                correct: true,
                explanation: "Celui du dessous ne vous voit pas forcément (voile) et a moins d'énergie potentielle. Priorité absolue au plus bas."
            },
            {
                text: "Je reste dans mon noyau, il doit faire attention.",
                correct: false,
                explanation: "Comportement dangereux. Vous avez le visuel, c'est à vous d'anticiper pour éviter la collision.",
                penalty: 200
            }
        ]
    },
    {
        id: 'air_bpc_5',
        level: 'CONFIRME',
        icon: '✈️',
        text: "FL 115 (Flight Level 115). À quelle altitude pression cela correspond-il environ (en atmosphère standard) ?",
        choices: [
            {
                text: "Environ 3500 mètres (11 500 pieds).",
                correct: true,
                explanation: "C'est souvent le plafond max pour le vol libre en espace non contrôlé (LTA classe D ou C au-dessus). FL100 ~3000m."
            },
            {
                text: "1150 mètres.",
                correct: false,
                explanation: "Non, FL est en centaines de pieds. 115 * 100 = 11500 ft. Divisé par ~3.28 = ~3500m.",
                penalty: 100
            }
        ]
    }
];

/* --- CORE FUNCTIONS --- */
function initApp() {
    updateStatusBar();
}

// Global Level Management
function updateStatusBar() {
    const bar = document.getElementById('status-bar');
    if (!bar) return;

    // Determine current selection based on state or default
    const currentLevel = state.level || 'INITIAL';

    bar.innerHTML = `
        <div class="global-level-selector">
            <label for="global-level-select">🎓 Niveau :</label>
            <select id="global-level-select" onchange="changeGlobalLevel(this.value)">
                <option value="INITIAL" ${currentLevel === 'INITIAL' ? 'selected' : ''}>Brevet Initial</option>
                <option value="PILOTE" ${currentLevel === 'PILOTE' ? 'selected' : ''}>Brevet Pilote</option>
                <option value="CONFIRME" ${currentLevel === 'CONFIRME' ? 'selected' : ''}>Brevet de Pilote Confirmé</option>
            </select>
        </div>
    `;
}

// Make global for inline HTML calls
window.changeGlobalLevel = function (newLevel) {
    // Update State
    state.level = newLevel;
    console.log(`Global Level set to ${newLevel}`);

    // Update QCM Level if existing
    const qcmSelect = document.getElementById('qcm-level');
    if (qcmSelect) {
        const map = { 'INITIAL': 'BI', 'PILOTE': 'BP', 'CONFIRME': 'BPC' };
        qcmSelect.value = map[newLevel];
        if (window.changeQcmLevel) window.changeQcmLevel(map[newLevel]);
    }

    // NO auto-start of Adventure Mode.
    // If user is already playing, the next scenario load will naturally use the new level 
    // or they can restart manually.
};

function changeGlobalLevel(newLevel) {
    window.changeGlobalLevel(newLevel);
}

function getAltitudeColor() {
    if (state.altitude > 800) return '#48BB78';
    if (state.altitude > 400) return '#ED8936';
    return '#F56565';
}

function showDashboard() {
    document.getElementById('dashboard').style.display = 'grid';
    document.getElementById('adventure-area').style.display = 'none';
    document.getElementById('exam-area').style.display = 'none';
    state.mode = 'MENU';
}

/* --- ADVENTURE LOGIC --- */
function startGame() {
    state.mode = 'ADVENTURE';

    // Reset specific scenario tracking but keep global level
    state.altitude = 1000;
    state.knowledge = 0;
    state.currentScenarioIndex = 0;
    // state.level is already set by global selector

    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('adventure-area').style.display = 'flex';
    document.getElementById('exam-area').style.display = 'none'; // Ensure exam is hidden

    // Filter Scenarios based on Global Level
    const currentLevel = state.level || 'INITIAL';

    if (currentLevel === 'ALL') {
        state.scenarios = SCENARIOS.sort(() => Math.random() - 0.5);
    } else {
        state.scenarios = SCENARIOS.filter(s => s.level === currentLevel);
    }

    if (state.scenarios.length === 0) {
        alert("Aucun scénario disponible pour ce niveau.");
        showDashboard();
        return;
    }

    // Reset UI Progress
    const progress = document.getElementById('scenario-progress');
    if (progress) progress.innerText = `Scénario 1/${state.scenarios.length}`;

    loadScenario(); // StatusBar update is inside init or loaded by global update
    updateStatusBar();
}

function loadScenario() {
    if (state.currentScenarioIndex >= SCENARIOS.length) {
        // Victory logic could go here
        finishAdventure();
        return;
    }

    const scene = SCENARIOS[state.currentScenarioIndex];

    // Update Level Badge color
    const badge = document.getElementById('adv-level-badge');
    badge.innerText = scene.level === 'INITIAL' ? 'BREVET INITIAL' : scene.level === 'PILOTE' ? 'BREVET PILOTE' : 'BREVET DE PILOTE CONFIRMÉ';
    if (scene.level === 'INITIAL') badge.style.background = '#48BB78';
    else if (scene.level === 'PILOTE') badge.style.background = '#4299E1';
    else badge.style.background = '#92400e';

    document.getElementById('adv-progress').innerText = `Scénario ${state.currentScenarioIndex + 1} / ${SCENARIOS.length}`;
    document.getElementById('adv-scene-display').innerText = scene.icon;
    document.getElementById('adv-text').innerText = scene.text;

    const choicesDiv = document.getElementById('adv-choices');
    choicesDiv.innerHTML = '';

    scene.choices.forEach((choice, idx) => {
        const btn = document.createElement('div');
        btn.className = 'choice-btn';
        btn.innerText = choice.text;
        btn.onclick = () => handleChoice(choice);
        choicesDiv.appendChild(btn);
    });
}

function handleChoice(choice) {
    const modal = document.getElementById('feedback-modal');
    const icon = document.getElementById('feedback-icon');
    const title = document.getElementById('feedback-title');
    const msg = document.getElementById('feedback-msg');
    const detail = document.getElementById('feedback-detail');
    const canvasContainer = document.getElementById('feedback-canvas-container');

    modal.style.display = 'flex';
    canvasContainer.innerHTML = ''; // Clear previous canvas

    if (choice.correct) {
        state.knowledge += 50;
        icon.innerText = '✅';
        title.innerText = 'Excellent choix !';
        title.style.color = 'var(--success)';
        msg.innerText = "Vous avez pris la bonne décision et maîtrisez la situation.";
        detail.innerHTML = `<b>L'avis de l'expert :</b><br>${choice.explanation}`;
        detail.style.borderLeftColor = 'var(--success)';
    } else {
        state.altitude -= (choice.penalty || 100);
        icon.innerText = '⚠️';
        title.innerText = 'Attention...';
        title.style.color = 'var(--danger)';
        msg.innerText = `Vous perdez de l'altitude (-${choice.penalty || 100}m) suite à cette erreur.`;
        detail.innerHTML = `<b>Correction ultra-précise :</b><br>${choice.explanation}`;
        detail.style.borderLeftColor = 'var(--danger)';
    }

    // Schematic injection logic
    if (choice.schematic) {
        const canvas = document.createElement('canvas');
        canvas.id = 'schematic-canvas';
        canvas.width = 400;
        canvas.height = 250;
        canvas.style.marginTop = '20px';
        canvas.style.borderRadius = '8px';
        canvas.style.background = 'white';
        canvasContainer.appendChild(canvas);
        drawSchematic(canvas, choice.schematic);
    }

    updateStatusBar();
}

function drawSchematic(canvas, type) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    // Background
    ctx.fillStyle = '#f0f9ff';
    ctx.fillRect(0, 0, w, h);

    if (type === 'PTU') {
        // Landing Pattern (PTU)
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;

        // Ground
        ctx.fillStyle = '#81C784';
        ctx.fillRect(0, h - 40, w, 40); // Field
        ctx.fillStyle = '#666';
        ctx.fillRect(w / 2 - 20, h - 40, 40, 10); // Target

        // Trajectory
        ctx.beginPath();
        ctx.moveTo(50, 50); // Loss height zone
        ctx.lineTo(50, h - 100); // Vent arrière
        ctx.lineTo(w / 2, h - 100); // Etape de base start
        ctx.lineTo(w / 2, h - 60); // Etape de base end (turn)
        ctx.lineTo(w / 2, h - 45); // Final

        ctx.strokeStyle = '#E53935';
        ctx.setLineDash([5, 5]);
        ctx.stroke();

        // Arrows
        ctx.fillStyle = '#0277BD';
        ctx.font = '12px sans-serif';
        ctx.fillText("Vent Arrière", 60, h - 110);
        ctx.fillText("Base", w / 2 + 10, h - 80);
        ctx.fillText("Finale", w / 2 + 10, h - 50);

        // Wind
        ctx.font = '20px sans-serif';
        ctx.fillText("💨 Vent", w - 80, 30);
        ctx.beginPath();
        ctx.moveTo(w - 30, 40);
        ctx.lineTo(w - 80, 40);
        ctx.stroke();

    } else if (type === 'POLAR') {
        // Polar Curve schematic
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;

        // Axes
        ctx.beginPath();
        ctx.moveTo(40, 40); ctx.lineTo(40, h - 40); // Y: Vz
        ctx.moveTo(40, 40); ctx.lineTo(w - 40, 40); // X: Vx
        ctx.stroke();

        ctx.fillStyle = '#000';
        ctx.font = '12px sans-serif';
        ctx.fillText("Vz (m/s)", 10, h / 2);
        ctx.fillText("Vitesse (km/h)", w / 2, 20);

        // The Curve (Speed increases right, Sink increases DOWN)
        ctx.beginPath();
        ctx.strokeStyle = '#E53935';
        ctx.lineWidth = 3;
        ctx.setLineDash([]);
        ctx.moveTo(40, 40); // Stall
        ctx.quadraticCurveTo(150, 40, 200, 100); // Finesse max area
        ctx.quadraticCurveTo(250, 150, 300, 220); // Full speed
        ctx.stroke();

        ctx.fillStyle = '#1565C0';
        ctx.fillText("Finesse Max", 160, 100);
        ctx.beginPath();
        ctx.moveTo(40, 40);
        ctx.lineTo(220, 130);
        ctx.strokeStyle = '#1565C0';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.stroke();

    } else if (type === 'PARAGLIDER') {
        // Simple Paraglider
        ctx.fillStyle = '#0288D1';
        // Canopy
        ctx.beginPath();
        ctx.ellipse(w / 2, 60, 120, 30, 0, Math.PI, 0);
        ctx.fill();

        ctx.fillStyle = '#333';
        ctx.font = '12px sans-serif';
        ctx.fillText("Extrados", w / 2 - 40, 25);
        ctx.fillText("Intrados", w / 2 - 40, 80);

        // Lines
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.beginPath();
        // A
        ctx.moveTo(w / 2 - 80, 60); ctx.lineTo(w / 2, 180);
        ctx.moveTo(w / 2 + 80, 60); ctx.lineTo(w / 2, 180);
        // B/C
        ctx.moveTo(w / 2 - 40, 60); ctx.lineTo(w / 2, 180);
        ctx.moveTo(w / 2 + 40, 60); ctx.lineTo(w / 2, 180);
        ctx.stroke();

        // Pilot
        ctx.fillStyle = '#333';
        ctx.fillRect(w / 2 - 10, 180, 20, 30);
        ctx.fillText("Pilote", w / 2 - 20, 230);
    }
}

function closeFeedback() {
    document.getElementById('feedback-modal').style.display = 'none';

    if (state.altitude <= 0) {
        alert("GAME OVER ! Vous avez touché le sol. On recommence !");
        startGame();
    } else {
        state.currentScenarioIndex++;
        loadScenario();
    }
}

function finishAdventure() {
    alert("🎉 FÉLICITATIONS ! Vous avez terminé tous les scénarios ! Le mode EXAMEN est maintenant fortement conseillé.");
    showDashboard();
    // Unlock visual cue for exam if wanted
}


/* --- EXAM MODE (LEGACY INTEGRATION) --- */
let qcmPool = [];
let qcmIdx = 0;
let qcmLevel = 'BI';
let qcmTheme = 'all';

function startExam() {
    state.mode = 'EXAM';
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('exam-area').style.display = 'block';

    initQcmSession();
}

function changeQcmLevel(val) { qcmLevel = val; initQcmSession(); }
function changeQcmTheme(val) { qcmTheme = val; initQcmSession(); }

function initQcmSession() {
    if (typeof FFVL_DATA === 'undefined') {
        document.getElementById('qcm-game-area').innerHTML = "<p>Erreur: Données QCM non chargées.</p>";
        return;
    }

    const mapping = { 'BI': 0, 'BP': 1, 'BPC': 2 };
    const targetLvl = mapping[qcmLevel];

    const filtered = FFVL_DATA.questions.filter(q => {
        return (q.niveau == targetLvl) && (qcmTheme === 'all' || q.theme === qcmTheme);
    });

    if (filtered.length === 0) {
        document.getElementById('qcm-game-area').innerHTML = "<p>Pas de questions pour cette sélection.</p>";
        return;
    }

    // Shuffle
    for (let i = filtered.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
    }

    qcmPool = filtered.slice(0, 30); // Max 30 questions
    qcmIdx = 0;
    renderQcmQuestion();
}

function renderQcmQuestion() {
    const area = document.getElementById('qcm-game-area');
    if (qcmIdx >= qcmPool.length) {
        area.innerHTML = `<div style="text-align:center"><h3>Série terminée !</h3><button class="btn" onclick="initQcmSession()">Recommencer</button></div>`;
        return;
    }

    const q = qcmPool[qcmIdx];

    let html = `
        <div style="background:#f8f9fa; padding:20px; border-radius:12px; border:1px solid #eee;">
            <div style="font-size:0.8rem; color:#888; margin-bottom:10px;">Question ${qcmIdx + 1}/${qcmPool.length} • Thème: ${q.theme}</div>
            <h3 style="margin-top:0">${q.question}</h3>
            <div style="display:flex; flex-direction:column; gap:10px; margin-top:20px;">
                ${q.ans.map((a, i) => `
                    <button id="qcm-opt-${i}" class="qcm-option-btn" onclick="selectQcmInfo(${i})">
                        ${a.text}
                    </button>
                `).join('')}
            </div>
             <div id="qcm-feedback" style="margin-top:20px; display:none; padding:15px; border-radius:8px;"></div>
             <button id="qcm-next" class="btn" style="display:none; margin-top:15px;" onclick="nextQcm()">Suivant →</button>
             <button id="qcm-validate" class="btn" style="margin-top:15px; display:none;" onclick="validateQcm()">Valider</button>
        </div>
    `;
    area.innerHTML = html;
}

function selectQcmInfo(idx) {
    // Simple selection logic for visual feedback before validation
    const btn = document.getElementById(`qcm-opt-${idx}`);
    if (btn.classList.contains('selected')) {
        btn.classList.remove('selected');
        btn.style.borderColor = '#ccc';
        btn.style.background = 'white';
        btn.style.color = '#333';
    } else {
        btn.classList.add('selected');
        btn.style.borderColor = 'var(--primary)';
        btn.style.background = '#E3F2FD';
        btn.style.color = 'var(--primary)';
    }
    document.getElementById('qcm-validate').style.display = 'block';
}

function validateQcm() {
    const q = qcmPool[qcmIdx];
    const feedback = document.getElementById('qcm-feedback');
    const btns = document.querySelectorAll('[id^=qcm-opt-]');
    let userScore = 0;
    let maxScore = 0;

    q.ans.forEach((a, i) => {
        if (parseInt(a.pts) > 0) maxScore += parseInt(a.pts);
        const btn = document.getElementById(`qcm-opt-${i}`);
        const isSelected = btn.classList.contains('selected');

        if (isSelected) userScore += parseInt(a.pts);

        // Show Correct/Wrong colors immediately
        if (parseInt(a.pts) > 0) {
            btn.style.borderColor = 'var(--success)';
            if (isSelected) btn.style.backgroundColor = '#E8F5E9';
            else btn.innerText += " (Réponse attendue)";
        } else if (isSelected) {
            btn.style.borderColor = 'var(--danger)';
            btn.style.backgroundColor = '#FFEBEE';
        }
        btn.disabled = true;
    });

    const success = (userScore === maxScore && maxScore > 0);

    feedback.style.display = 'block';
    feedback.className = success ? 'correct' : 'wrong'; // Reuse CSS if needed or set style directly
    feedback.style.background = success ? '#E8F5E9' : '#FFEBEE';
    feedback.style.border = `1px solid ${success ? 'var(--success)' : 'var(--danger)'}`;
    feedback.innerHTML = success ?
        `<b>✅ BRAVO !</b>` :
        `<b>❌ OUILLE...</b> Score: ${userScore}/${maxScore}`;

    if (q.explanation) {
        feedback.innerHTML += `<br><br><i>${q.explanation}</i>`;
    }

    document.getElementById('qcm-validate').style.display = 'none';
    document.getElementById('qcm-next').style.display = 'block';
}

function nextQcm() {
    qcmIdx++;
    renderQcmQuestion();
}

// Init
window.onload = initApp;
