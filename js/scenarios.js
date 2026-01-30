/**
 * SCENARIOS.JS
 * Database of Flight Scenarios.
 * Content: 90 Scenarios (30 BI, 30 BP, 30 BPC).
 * Structure: DEEP 10-STEP FLIGHTS generated dynamically using QCM_DATA.
 */

const FLIGHTS = [];

// =============================================================================
// NARRATIVE DATA (Intros and Endings)
// =============================================================================

const FLIGHT_NARRATIVES = {
    BI: {
        intros: [
            { t: "Grand Vol Matinal", s: "C'est le matin, brise calme. Idéal pour un grand vol d'application." },
            { t: "Vol du Soir", s: "Restitution douce. L'air est laminaire." },
            { t: "Premier Thermique", s: "Ça commence à buller doucement." },
            { t: "Site Venté", s: "Il y a un peu de vent au déco ce matin (15km/h)." },
            { t: "Reprise", s: "Vous n'avez pas volé depuis 3 semaines. Prudence." }
        ],
        outros: [
            { t: "PTU Calme", s: "Approche standard. Vent nul." },
            { t: "Finale Ventée", s: "Ça contré un peu en bas." },
            { t: "Cible", s: "Vous essayez de viser la cible." }
        ]
    },
    BP: {
        intros: [
            { t: "Cross de crêtes", s: "Instabilité moyenne. Plafond 2500m." },
            { t: "Thermique pur", s: "Pas de vent, que du thermique bleu." },
            { t: "Soaring Mer", s: "Brise de mer soutenue, vol dynamique." },
            { t: "Site Alpin", s: "Déco falaise impressionnant." }
        ],
        outros: [
            { t: "Top Landing", s: "Vous tentez de reposer au déco." },
            { t: "Atterro Vache", s: "Posé dans un champ inconnu." },
            { t: "Venturi Vallée", s: "La brise est forte à l'atterro." }
        ]
    },
    BPC: {
        intros: [
            { t: "Manche de 80km", s: "Gros conditions. Vario moyen +4m/s." },
            { t: "Triangle FAI", s: "Tentative de record de site." },
            { t: "Vol Bivouac", s: "Chargé comme une mule, décollage 3000m." },
            { t: "Compétition", s: "La meute est prête. Le Start est dans 5 min." }
        ],
        outros: [
            { t: "Goal Glide", s: "Arrivée planée à 60km/h." },
            { t: "Posé Sauvage", s: "Au milieu de nulle part, près d'un glacier." },
            { t: "Vent Fort", s: "Atterro dans 35km/h de brise." }
        ]
    }
};

// =============================================================================
// LOGICAL ORDERING DEFINITIONS
// =============================================================================
// Defines the chronological order of a flight for sorting questions.

const PHASE_ORDER = {
    'MÉTÉO': 1,
    'PRÉVOL': 2,
    'MATÉRIEL': 2,
    'DÉCOLLAGE': 3,
    'RÈGLEMENTATION': 4,
    'MÉCANIQUE DE VOL': 4,
    'AÉRO': 4,
    'PILOTAGE': 5,
    'THERMIQUE': 5,
    'CROSS': 5,
    'PERFORMANCE': 5,
    'SOARING': 5,
    'COMPÉTITION': 5,
    'NAV': 5,
    'INCIDENTS': 6,
    'APPROCHE': 7,
    'ATTERRISSAGE': 8,
    'MENTAL': 9, // Can be anytime, but good as a check-in
    'DIVERS': 9
};

function getPhaseRank(theme) {
    const t = theme.toUpperCase();
    // Partial match check
    for (const key in PHASE_ORDER) {
        if (t.includes(key)) return PHASE_ORDER[key];
    }
    return 5; // Default middle flight
}


// =============================================================================
// GENERATOR LOGIC
// =============================================================================

// Helper: Shuffle array and pick N items
function pickRandom(arr, n) {
    if (!arr || arr.length === 0) return [];
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, n);
}

// Helper: Convert a QCM Question Object into a Flight Step Object
function qcmToStep(q) {
    const engineChoices = q.choices.map(c => ({
        text: c.text,
        correct: c.correct,
        feedback: c.correct ? "Exact. " + q.explanation : "Attention. " + q.explanation,
        impact: c.correct ? { score: 10 } : { score: -10, stress: 10 }
    }));

    return {
        stage: q.theme.toUpperCase(),
        text: `<b>${q.theme}</b><br>${q.question}`,
        choices: engineChoices,
        _themeRank: getPhaseRank(q.theme) // Internal property for sorting
    };
}

// MAIN GENERATOR
function generateDeepFlight(id, level, themeIndex) {
    // 1. Get Narrative Context
    const intros = FLIGHT_NARRATIVES[level].intros;
    const outros = FLIGHT_NARRATIVES[level].outros;
    const intro = intros[themeIndex % intros.length];
    const outro = outros[themeIndex % outros.length];

    // 2. Fetch Questions
    const levelQuestions = typeof QCM_DATA !== 'undefined'
        ? QCM_DATA.filter(q => q.level === level)
        : [];

    // Pick ~8 random questions
    const selectedQuestions = pickRandom(levelQuestions, 8);

    // 3. Transform and Sort Questions by Logical Flight Phase
    let flightSteps = selectedQuestions.map(q => qcmToStep(q));

    flightSteps.sort((a, b) => a._themeRank - b._themeRank);

    // 4. Assemble the Flight
    let finalSteps = [];

    // STEP 1: CONTEXTE
    finalSteps.push({
        stage: "SITUATION",
        text: `<b>${intro.t}</b><br>${intro.s}`,
        choices: [
            { text: "Je prends mon temps pour m'équiper.", correct: true, feedback: "La préparation mentale commence au sol." },
            { text: "Je me dépêche.", correct: false, impact: { stress: 10 }, feedback: "La précipitation crée l'accident." }
        ]
    });

    // MIDDLE STEPS: The sorted QCM questions
    finalSteps = finalSteps.concat(flightSteps);

    // STEP 10: ATTERRISSAGE (If not covered by QCM, force a narrative landing)
    // We add a specific narrative outro
    finalSteps.push({
        stage: "FIN DU VOL",
        text: `<b>${outro.t}</b><br>${outro.s}<br>Le sol se rapproche.`,
        choices: [
            { text: "Je soigne ma finale et mon arrondi.", correct: true, feedback: "Beau vol !" },
            { text: "Je relâche tout.", correct: false, impact: { crash: true }, feedback: "Attention au relachement final." }
        ]
    });

    return {
        id: id,
        level: level,
        title: `${intro.t} #${themeIndex + 1}`,
        steps: finalSteps
    };
}


// =============================================================================
// SCENARIO GENERATOR (JUST-IN-TIME)
// =============================================================================

const ScenarioGenerator = {

    generate: function (level) {
        if (typeof QCM_DATA === 'undefined') {
            console.error("QCM_DATA not loaded.");
            return null;
        }

        // 1. Pick Random Narrative Context
        const intros = FLIGHT_NARRATIVES[level].intros;
        const outros = FLIGHT_NARRATIVES[level].outros;

        // Random pick (Math.random) instead of sequential index
        const intro = intros[Math.floor(Math.random() * intros.length)];
        const outro = outros[Math.floor(Math.random() * outros.length)];

        // 2. Fetch & Shuffle Questions
        const levelQuestions = QCM_DATA.filter(q => q.level === level);
        // Pick 8 to 10 unique questions
        const questionsCount = 8 + Math.floor(Math.random() * 3); // 8, 9 or 10
        const selectedQuestions = pickRandom(levelQuestions, questionsCount);

        // 3. Transform & Sort
        let flightSteps = selectedQuestions.map(q => qcmToStep(q));
        flightSteps.sort((a, b) => a._themeRank - b._themeRank);

        // 4. Assemble the Flight
        let finalSteps = [];

        // INTRO
        finalSteps.push({
            stage: "SITUATION",
            text: `<b>${intro.t}</b><br>${intro.s}`,
            choices: [
                { text: "Je prends le temps de m'équiper (Prévol).", correct: true, feedback: "La sécurité commence au sol." },
                { text: "Je suis pressé, je décolle.", correct: false, impact: { stress: 20 }, feedback: "Mauvais état d'esprit." }
            ]
        });

        // QUESTIONS
        finalSteps = finalSteps.concat(flightSteps);

        // OUTRO
        finalSteps.push({
            stage: "ATTERRISSAGE", // Consistent key for engine stats
            text: `<b>${outro.t}</b><br>${outro.s}<br>Approche du sol.`,
            choices: [
                { text: "Je soigne ma finale et mon arrondi.", correct: true, feedback: "Vol terminé en beauté." },
                { text: "Je relâche l'attention.", correct: false, impact: { crash: true }, feedback: "Attention, le vol ne finit qu'à l'arrêt complet." }
            ]
        });

        // Unique ID for this session
        const flightId = `gen_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

        return {
            id: flightId,
            level: level,
            title: intro.t, // Title matches context
            steps: finalSteps
        };
    }
};

// Start logic remains compatible if we want to expose keys
window.ScenarioGenerator = ScenarioGenerator;
console.log("ScenarioGenerator Ready.");
