const QCM_BP = [
    // =========================================================================
    // NIVEAU BP (Brevet Pilote) - 50 QUESTIONS
    // =========================================================================
    {
        id: "bp_meteo_1",
        level: "BP",
        theme: "Météo",
        question: "Qu'est-ce qu'un ciel de traîne ?",
        choices: [
            { text: "Une masse d'air instable avec des cumulus, des averses et des thermiques.", correct: true },
            { text: "Un ciel stable et calme sans nuage.", correct: false },
            { text: "Un brouillard épais et persistant.", correct: false }
        ],
        explanation: "La traîne survient après le passage du front froid. L'air froid arrive sur un sol réchauffé, créant une forte instabilité."
    },
    {
        id: "bp_meteo_2",
        level: "BP",
        theme: "Météo",
        question: "Vous volez sous le vent d'une crête avec un vent météo de 20 km/h. À quoi devez-vous vous attendre ?",
        choices: [
            { text: "À rencontrer des rotors et de fortes turbulences (rabattants).", correct: true },
            { text: "À être dans une zone abritée et très calme.", correct: false },
            { text: "À trouver une ascendance dynamique puissante et régulière.", correct: false }
        ],
        explanation: "Le vol sous le vent est l'un des plus grands dangers. Les tourbillons peuvent fermer la voile violemment."
    },
    {
        id: "bp_meteo_3",
        level: "BP",
        theme: "Météo",
        question: "Quelle est la valeur du gradient thermique standard (moyen) de l'atmosphère ?",
        choices: [
            { text: "-0.65°C tous les 100 mètres (ou 1000 ft).", correct: true },
            { text: "-1°C tous les 100 mètres.", correct: false },
            { text: "+0.6°C tous les 100 mètres.", correct: false }
        ],
        explanation: "C'est la moyenne de refroidissement de l'air avec l'altitude."
    },
    {
        id: "bp_meteo_4",
        level: "BP",
        theme: "Météo",
        question: "Quel est l'effet d'une inversion de température sur l'aérologie ?",
        choices: [
            { text: "Elle bloque la convection thermique (couche de stabilité).", correct: true },
            { text: "Elle renforce les thermiques qui la traversent.", correct: false },
            { text: "Elle n'a aucun effet notable.", correct: false }
        ],
        explanation: "Si l'air au-dessus est plus chaud que l'air qui monte, l'ascendance s'arrête net (plafond bas)."
    },
    {
        id: "bp_meteo_5",
        level: "BP",
        theme: "Météo",
        question: "Quand et comment se forme la brise catabatique (brise descendante) ?",
        choices: [
            { text: "Le soir et la nuit, l'air froid coule le long des pentes.", correct: true },
            { text: "Le matin, quand le soleil chauffe.", correct: false },
            { text: "À midi, au plus fort de la journée.", correct: false }
        ],
        explanation: "C'est l'inverse de la brise thermique. L'air refroidi au contact du sol devient plus lourd et descend."
    },
    {
        id: "bp_meteo_6",
        level: "BP",
        theme: "Météo",
        question: "Que représente une isobare sur une carte météo ?",
        choices: [
            { text: "Une ligne reliant les points d'égale pression atmosphérique.", correct: true },
            { text: "Une ligne d'égale température.", correct: false },
            { text: "Une ligne d'égale altitude.", correct: false }
        ],
        explanation: "Plus les isobares sont resserrées, plus le gradient de pression est fort, et donc plus le vent est fort."
    },
    {
        id: "bp_meteo_7",
        level: "BP",
        theme: "Météo",
        question: "Dans l'hémisphère Nord, la force de Coriolis dévie le vent :",
        choices: [
            { text: "Vers la droite par rapport à son mouvement.", correct: true },
            { text: "Vers la gauche.", correct: false },
            { text: "Elle ne le dévie pas.", correct: false }
        ],
        explanation: "C'est pourquoi le vent tourne autour des dépressions dans le sens anti-horaire."
    },
    {
        id: "bp_meteo_8",
        level: "BP",
        theme: "Météo",
        question: "Comment se forme un brouillard de rayonnement ?",
        choices: [
            { text: "Par refroidissement nocturne du sol par ciel clair et vent nul.", correct: true },
            { text: "Par l'arrivée brutale d'un vent fort.", correct: false },
            { text: "Par réchauffement rapide le matin.", correct: false }
        ],
        explanation: "Le sol froid condense l'humidité de l'air à son contact."
    },
    {
        id: "bp_meteo_9",
        level: "BP",
        theme: "Météo",
        question: "Qu'est-ce qu'une zone de confluence ?",
        choices: [
            { text: "La rencontre de deux flux d'air (ou brises) de directions différentes.", correct: true },
            { text: "L'endroit où une rivière se jette dans un lac.", correct: false },
            { text: "La zone d'atterrissage.", correct: false }
        ],
        explanation: "Les masses d'air qui s'affrontent sont obligées de monter, créant souvent une ligne d'ascendance exploitable mais turbulente."
    },
    {
        id: "bp_meteo_10",
        level: "BP",
        theme: "Météo",
        question: "Que représente le point de rosée ?",
        choices: [
            { text: "La température à laquelle l'air doit être refroidi pour saturer (faire des nuages).", correct: true },
            { text: "La température minimale de la nuit.", correct: false },
            { text: "0°C.", correct: false }
        ],
        explanation: "Si la température ambiante atteint le point de rosée, le nuage se forme. Cela permet de prédire la base des nuages (plafond)."
    },

    {
        id: "bp_thermique_1",
        level: "BP",
        theme: "Pilotage",
        question: "En enroulant un thermique, votre demi-aile intérieure 'mollit' (perd de la pression). Que cela signifie-t-il ?",
        choices: [
            { text: "Que le cœur du thermique est à l'EXTÉRIEUR de votre virage.", correct: true },
            { text: "Que le thermique est à l'intérieur.", correct: false },
            { text: "Que vous êtes en train de décrocher.", correct: false }
        ],
        explanation: "L'aile extérieure porte plus car elle est dans l'air qui monte plus vite. Il faut élargir le virage ou changer de sens."
    },
    {
        id: "bp_thermique_2",
        level: "BP",
        theme: "Pilotage",
        question: "Que signifie 'noyauter' un thermique ?",
        choices: [
            { text: "Resserrer le virage pour rester dans la zone où ça monte le plus fort.", correct: true },
            { text: "Élargir le virage pour explorer.", correct: false },
            { text: "Sortir du thermique.", correct: false }
        ],
        explanation: "Le but est de centrer le 'noyau' (la partie la plus forte) pour optimiser le taux de montée."
    },
    {
        id: "bp_thermique_3",
        level: "BP",
        theme: "Pilotage",
        question: "Vous entrez brutalement dans un thermique puissant. La voile cabre et recule. Que faites-vous ?",
        choices: [
            { text: "Je laisse faire bras hauts (ou j'accompagne) puis je contrôle l'abattée qui va suivre.", correct: true },
            { text: "Je freine fort pour ne pas reculer.", correct: false },
            { text: "J'accélère à fond.", correct: false }
        ],
        explanation: "Si vous freinez quand la voile est derrière, vous risquez le décrochage. Attendez qu'elle revienne au-dessus."
    },
    {
        id: "bp_thermique_4",
        level: "BP",
        theme: "Pilotage",
        question: "En sortie de thermique fort, vous ressentez une dégueulante et la voile plonge devant. Que faites-vous ?",
        choices: [
            { text: "Je freine (temporisation) pour arrêter l'abattée.", correct: true },
            { text: "Je mets bras hauts pour récupérer de la vitesse.", correct: false },
            { text: "Je freine avant que ça plonge.", correct: false }
        ],
        explanation: "La perte de portance fait piquer l'aile. Il faut l'empêcher d'aller trop loin devant pour éviter la fermeture frontale."
    },
    {
        id: "bp_thermique_5",
        level: "BP",
        theme: "Pilotage",
        question: "Qu'est-ce un thermique bleu ?",
        choices: [
            { text: "Une ascendance dans de l'air trop sec pour former un nuage.", correct: true },
            { text: "Un thermique froid qui descend.", correct: false },
            { text: "Un thermique au-dessus d'un lac.", correct: false }
        ],
        explanation: "Il n'y a pas de cumulus pour le matérialiser. Il faut se fier au relief, aux oiseaux ou aux autres pilotes."
    },
    {
        id: "bp_thermique_6",
        level: "BP",
        theme: "Pilotage",
        question: "En quoi consiste la technique du cheminement ?",
        choices: [
            { text: "Voler le long d'une ligne porteuse (crête ou rue de nuages) sans faire de virages complets.", correct: true },
            { text: "Voler au hasard en espérant trouver quelque chose.", correct: false },
            { text: "Faire des 360 tout le long du relief.", correct: false }
        ],
        explanation: "C'est la façon la plus efficace de parcourir de la distance (le 'Dauphin')."
    },
    {
        id: "bp_thermique_7",
        level: "BP",
        theme: "Pilotage",
        question: "Votre variomètre indique +3 m/s intégré. Qu'est-ce que cela signifie ?",
        choices: [
            { text: "Vous gagnez 3 mètres d'altitude chaque seconde en moyenne.", correct: true },
            { text: "Vous volez à 3 km/h.", correct: false },
            { text: "Vous montez de 300 mètres par minute.", correct: false }
        ],
        explanation: "C'est un thermique solide et confortable."
    },
    {
        id: "bp_thermique_8",
        level: "BP",
        theme: "Pilotage",
        question: "Quel est l'avantage de virer 'à plat' dans du petit thermique ?",
        choices: [
            { text: "On dégrade moins le taux de chute (plus grande surface projetée), donc on monte mieux.", correct: true },
            { text: "C'est plus joli.", correct: false },
            { text: "Cela permet de tourner plus vite.", correct: false }
        ],
        explanation: "Incliner fort l'aile augmente le taux de chute, ce qui est contre-productif si l'ascendance est faible."
    },
    {
        id: "bp_thermique_9",
        level: "BP",
        theme: "Pilotage",
        question: "Quelle est la règle tacite pour choisir son sens de rotation en entrant dans un thermique ?",
        choices: [
            { text: "Je tourne dans le même sens que le premier pilote qui y est entré.", correct: true },
            { text: "Je tourne toujours à droite par défaut.", correct: false },
            { text: "Je tourne toujours à gauche.", correct: false }
        ],
        explanation: "Cela permet à tout le monde de tourner en harmonie sans risque de collision frontale."
    },
    {
        id: "bp_thermique_10",
        level: "BP",
        theme: "Pilotage",
        question: "Vous montez bien, puis le thermique s'arrête brutalement et l'air devient turbulent. Que se passe-t-il ?",
        choices: [
            { text: "Vous avez atteint une couche d'inversion (blocage).", correct: true },
            { text: "Vous avez raté le noyau.", correct: false },
            { text: "Le thermique est mort.", correct: false }
        ],
        explanation: "L'ascendance bute contre une couche d'air chaud et s'étale horizontalement, créant de la turbulence."
    },

    {
        id: "bp_regle_1",
        level: "BP",
        theme: "Réglementation",
        question: "Deux pilotes sont à la même altitude dans un thermique. Qui a la priorité pour gérer sa trajectoire ?",
        choices: [
            { text: "Le pilote qui voit l'autre (l'extérieur, et souvent le plus haut) doit s'écarter.", correct: true },
            { text: "Le pilote à l'intérieur doit s'écarter.", correct: false },
            { text: "Priorité à droite systématique.", correct: false }
        ],
        explanation: "En pratique, celui qui est à l'intérieur ne voit pas l'autre et ne peut pas élargir sans collision. L'extérieur doit adapter."
    },
    {
        id: "bp_regle_2",
        level: "BP",
        theme: "Réglementation",
        question: "Quelles sont les conditions de vol VFR en espace non contrôlé (Classe G) ?",
        choices: [
            { text: "Voler hors des nuages, en vue du sol et avec une visibilité suffisante (1.5 km ou 5 km).", correct: true },
            { text: "On peut entrer dans les nuages si on a un GPS.", correct: false },
            { text: "On peut voler la nuit.", correct: false }
        ],
        explanation: "\"Voir et Éviter\" est la règle d'or. Impossible sans visibilité."
    },
    {
        id: "bp_regle_3",
        level: "BP",
        theme: "Réglementation",
        question: "Au-dessus de la surface S (ou 900m/3000ft AMSL), quelle distance minimale faut-il garder par rapport aux nuages ?",
        choices: [
            { text: "1500 m horizontalement et 300 m (1000 ft) verticalement.", correct: true },
            { text: "Aucune distance, il faut juste ne pas entrer dedans.", correct: false },
            { text: "50 mètres.", correct: false }
        ],
        explanation: "C'est la marge de sécurité pour éviter un avion qui sortirait du nuage en IFR (vol aux instruments)."
    },
    {
        id: "bp_regle_4",
        level: "BP",
        theme: "Réglementation",
        question: "Comment doit s'effectuer un dépassement le long d'une pente ?",
        choices: [
            { text: "Toujours par l'extérieur (côté vide), pour ne pas coincer l'autre contre le relief.", correct: true },
            { text: "Par l'intérieur, entre le pilote et le relief.", correct: false },
            { text: "En passant par dessus.", correct: false }
        ],
        explanation: "Règle de sécurité élémentaire : laisser une échappatoire à tout le monde."
    },
    {
        id: "bp_regle_5",
        level: "BP",
        theme: "Réglementation",
        question: "Deux pilotes se croisent le long d'une pente à la même hauteur. Qui a la priorité ?",
        choices: [
            { text: "Celui qui a le relief à sa main DROITE.", correct: true },
            { text: "Celui qui a le relief à gauche.", correct: false },
            { text: "Celui qui monte.", correct: false }
        ],
        explanation: "Celui qui a le relief à droite ne peut pas virer à droite sans percuter la montagne. L'autre doit s'écarter."
    },
    {
        id: "bp_regle_6",
        level: "BP",
        theme: "Réglementation",
        question: "Quelles sont les contraintes d'un espace aérien de Classe D ?",
        choices: [
            { text: "C'est un espace contrôlé. Pénétration interdite sans clairance radio (et souvent transpondeur).", correct: true },
            { text: "C'est un espace libre pour le vol libre.", correct: false },
            { text: "C'est une zone interdite de tir.", correct: false }
        ],
        explanation: "Sans radio aviation et contact avec la tour, c'est une infraction grave."
    },
    {
        id: "bp_regle_7",
        level: "BP",
        theme: "Réglementation",
        question: "À quoi sert l'Altitude de Transition ?",
        choices: [
            { text: "C'est l'altitude où l'on passe du calage QNH (local) au calage Standard (1013 hPa) pour les Niveaux de Vol.", correct: true },
            { text: "C'est l'altitude où l'on a le droit de faire de l'acrobatie.", correct: false },
            { text: "C'est la hauteur du décollage.", correct: false }
        ],
        explanation: "Cela permet à tous les avions en altitude d'avoir la même référence de pression pour éviter les collisions."
    },
    {
        id: "bp_regle_8",
        level: "BP",
        theme: "Réglementation",
        question: "Que signifie une zone 'P' (ex: P12) sur une carte aéronautique ?",
        choices: [
            { text: "Zone Prohibited (Interdite) en permanence.", correct: true },
            { text: "Zone Parapente (autorisée).", correct: false },
            { text: "Zone Parking.", correct: false }
        ],
        explanation: "Le contournement est obligatoire (ex: Centrale nucléaire, base militaire sensible)."
    },
    {
        id: "bp_regle_9",
        level: "BP",
        theme: "Réglementation",
        question: "Deux pilotes se font face loin du relief. Quelle est la manœuvre d'évitement ?",
        choices: [
            { text: "Chacun dégage vers sa DROITE.", correct: true },
            { text: "Chacun dégage vers sa gauche.", correct: false },
            { text: "On continue tout droit en espérant que ça passe.", correct: false }
        ],
        explanation: "Règle universelle de l'air (et de la mer)."
    },
    {
        id: "bp_regle_10",
        level: "BP",
        theme: "Réglementation",
        question: "Quel est le statut du survol d'une Réserve Naturelle ou d'un Parc National ?",
        choices: [
            { text: "Il est souvent interdit ou réglementé avec une hauteur minimale de survol (ex: 300m ou 1000m sol).", correct: true },
            { text: "C'est toujours autorisé, les animaux aiment les parapentes.", correct: false },
            { text: "C'est interdit uniquement le week-end.", correct: false }
        ],
        explanation: "C'est pour protéger la faune (rapaces, chamois...) du dérangement."
    },

    {
        id: "bp_aero_1",
        level: "BP",
        theme: "Mécanique de Vol",
        question: "Comment trouve-t-on le point de finesse max sur une polaire des vitesses ?",
        choices: [
            { text: "C'est le point de tangence de la droite passant par l'origine des axes.", correct: true },
            { text: "C'est le sommet de la courbe.", correct: false },
            { text: "C'est le point de vitesse maximale.", correct: false }
        ],
        explanation: "C'est le meilleur compromis entre vitesse horizontale et vitesse verticale."
    },
    {
        id: "bp_aero_2",
        level: "BP",
        theme: "Mécanique de Vol",
        question: "À quoi correspond le point de taux de chute mini sur la polaire ?",
        choices: [
            { text: "Au sommet de la courbe (vitesse verticale la plus faible).", correct: true },
            { text: "À la vitesse la plus élevée.", correct: false },
            { text: "Au décrochage.", correct: false }
        ],
        explanation: "C'est la vitesse pour tenir en l'air le plus longtemps possible (mais pas pour aller le plus loin)."
    },
    {
        id: "bp_aero_3",
        level: "BP",
        theme: "Mécanique de Vol",
        question: "Vous volez avec 20 km/h de vent de face. Quelle est l'influence sur votre vitesse ?",
        choices: [
            { text: "Votre vitesse SOL diminue, mais votre vitesse AIR reste inchangée.", correct: true },
            { text: "Votre vitesse AIR diminue de 20 km/h.", correct: false },
            { text: "Votre portance augmente magiquement.", correct: false }
        ],
        explanation: "Le vent ne change pas l'aérodynamique de l'aile (vitesse air), il déplace juste la masse d'air par rapport au sol."
    },
    {
        id: "bp_aero_4",
        level: "BP",
        theme: "Mécanique de Vol",
        question: "Si vous augmentez votre PTV (en prenant du lest), comment évoluent vos performances ?",
        choices: [
            { text: "La vitesse horizontale et le taux de chute augmentent. La finesse max reste quasi identique.", correct: true },
            { text: "La finesse augmente beaucoup.", correct: false },
            { text: "Vous planez moins bien.", correct: false }
        ],
        explanation: "Vous descendez le long de la même pente (finesse), mais plus vite (comme une luge chargée)."
    },
    {
        id: "bp_aero_5",
        level: "BP",
        theme: "Mécanique de Vol",
        question: "Quelle est la cause de la traînée induite ?",
        choices: [
            { text: "Elle est générée par la création de portance (tourbillons marginaux en bout d'aile).", correct: true },
            { text: "C'est le frottement de l'air sur le tissu.", correct: false },
            { text: "C'est la résistance du pilote.", correct: false }
        ],
        explanation: "Plus l'incidence est forte (basses vitesses), plus la traînée induite est importante."
    },
    {
        id: "bp_aero_6",
        level: "BP",
        theme: "Mécanique de Vol",
        question: "Comment évolue la traînée parasite (résistance de l'air sur les suspentes/pilote) avec la vitesse ?",
        choices: [
            { text: "Elle augmente avec le carré de la vitesse.", correct: true },
            { text: "Elle diminue avec la vitesse.", correct: false },
            { text: "Elle reste constante.", correct: false }
        ],
        explanation: "Voler deux fois plus vite engendre quatre fois plus de traînée parasite."
    },
    {
        id: "bp_aero_7",
        level: "BP",
        theme: "Mécanique de Vol",
        question: "Quel est le facteur de charge subi lors d'un virage stabilisé incliné à 60° ?",
        choices: [
            { text: "2G (votre poids apparent est doublé).", correct: true },
            { text: "1G (inchangé).", correct: false },
            { text: "4G.", correct: false }
        ],
        explanation: "La formule est 1/cos(60°) = 2. C'est le début des sensations physiques fortes en 360."
    },
    {
        id: "bp_aero_8",
        level: "BP",
        theme: "Mécanique de Vol",
        question: "Qu'est-ce un décrochage dynamique ?",
        choices: [
            { text: "Un décrochage provoqué par une augmentation brutale de l'incidence (ex: ressource violente), même à haute vitesse.", correct: true },
            { text: "Un décrochage par vent fort.", correct: false },
            { text: "Un décrochage au sol.", correct: false }
        ],
        explanation: "L'aile pivote sur elle-même lors d'un freinage ou d'une turbulence, et l'incidence dépasse l'angle critique instantanément."
    },
    {
        id: "bp_aero_9",
        level: "BP",
        theme: "Mécanique de Vol",
        question: "Que caractérise généralement une voile de catégorie EN-B ?",
        choices: [
            { text: "Un bon compromis performance/sécurité, qui demande un pilotage actif.", correct: true },
            { text: "Une voile impossible à fermer.", correct: false },
            { text: "Une voile très instable réservée aux experts.", correct: false }
        ],
        explanation: "C'est la catégorie la plus large, allant de l'aile de progression (B-low) à l'aile de cross (B-high)."
    },
    {
        id: "bp_aero_10",
        level: "BP",
        theme: "Mécanique de Vol",
        question: "Qu'est-ce qu'un l'allongement d'une aile ?",
        choices: [
            { text: "Le rapport entre l'envergure et la corde moyenne.", correct: true },
            { text: "La longueur totale des suspentes.", correct: false },
            { text: "La taille de la voile.", correct: false }
        ],
        explanation: "Plus une aile est allongée (fine comme une lame), plus elle performante mais plus elle est exigeante à piloter."
    },

    {
        id: "bp_incid_1",
        level: "BP",
        theme: "Incidents",
        question: "Suite à une fermeture asymétrique, que devez-vous faire ?",
        choices: [
            { text: "Contrer à la sellette côté ouvert pour garder le cap, puis pomper si nécessaire.", correct: true },
            { text: "Tirer le parachute de secours immédiatement.", correct: false },
            { text: "Freiner le côté fermé à fond.", correct: false }
        ],
        explanation: "La priorité est la trajectoire. Ne pas laisser la voile partir en rotation."
    },
    {
        id: "bp_incid_2",
        level: "BP",
        theme: "Incidents",
        question: "Vous êtes en autorotation incontrôlée près du sol. Que faites-vous ?",
        choices: [
            { text: "Je fais secours immédiatement.", correct: true },
            { text: "J'essaie de comprendre pourquoi ça tourne.", correct: false },
            { text: "Je crie.", correct: false }
        ],
        explanation: "L'autorotation consomme énormément d'altitude très vite. Sans hauteur, le secours est la seule option."
    },
    {
        id: "bp_incid_3",
        level: "BP",
        theme: "Incidents",
        question: "Qu'est-ce qu'une cravate ?",
        choices: [
            { text: "Un bout d'aile qui se coince dans les suspentes.", correct: true },
            { text: "Une figure de style.", correct: false },
            { text: "Un nœud sur les élévateurs.", correct: false }
        ],
        explanation: "La cravate crée une énorme traînée qui fait tourner la voile. Il faut la contrer à la sellette et au frein opposé."
    },
    {
        id: "bp_incid_4",
        level: "BP",
        theme: "Incidents",
        question: "Vous êtes en parachutale (la voile est ouverte mais descend verticalement). Que faire ?",
        choices: [
            { text: "Pousser sur les élévateurs A ou utiliser l'accélérateur pour faire revoler l'aile.", correct: true },
            { text: "Freiner pour retrouver de la portance.", correct: false },
            { text: "Attendre.", correct: false }
        ],
        explanation: "Freiner aggraverait la situation vers un décrochage. Il faut redonner de la vitesse."
    },
    {
        id: "bp_incid_5",
        level: "BP",
        theme: "Incidents",
        question: "Après avoir tiré le secours (coupole hémisphérique), que devez-vous faire de votre voile principale ?",
        choices: [
            { text: "L'affaler (la neutraliser) en tirant les B ou les freins pour éviter l'effet miroir.", correct: true },
            { text: "La laisser voler pour porter plus.", correct: false },
            { text: "La détacher.", correct: false }
        ],
        explanation: "Si la voile revole, elle peut s'opposer au secours (effet miroir), augmentant le taux de chute."
    },
    {
        id: "bp_incid_6",
        level: "BP",
        theme: "Incidents",
        question: "Vous devez vacher (poser hors terrain). Quelle est la priorité ?",
        choices: [
            { text: "Repérer le sens du vent, choisir un champ dégagé sans lignes électriques ni obstacles.", correct: true },
            { text: "Poser le plus près possible de la route.", correct: false },
            { text: "Finir son vol en beauté.", correct: false }
        ],
        explanation: "La sécurité prime sur la récupération. Les lignes électriques sont invisibles et mortelles."
    },
    {
        id: "bp_incid_7",
        level: "BP",
        theme: "Incidents",
        question: "L'arbrissage est inévitable. Quelle est la bonne posture ?",
        choices: [
            { text: "Se protéger le visage et les artères (bras croisés), jambes serrées, et ne plus bouger une fois arrêté.", correct: true },
            { text: "Essayer d'attraper une branche en volant.", correct: false },
            { text: "Sauter de la sellette avant l'impact.", correct: false }
        ],
        explanation: "Une fois dans l'arbre, ne bougez plus. Le risque de chute secondaire est élevé."
    },
    {
        id: "bp_incid_8",
        level: "BP",
        theme: "Incidents",
        question: "Vous cassez une suspente haute en vol. La voile vole droit. Que faites-vous ?",
        choices: [
            { text: "Je vais atterrir tranquillement en pilotant tout en douceur.", correct: true },
            { text: "Je fais secours.", correct: false },
            { text: "Je continue mon vol normalement.", correct: false }
        ],
        explanation: "La redondance du suspentage permet souvent de voler encore, mais la structure est fragilisée."
    },
    {
        id: "bp_incid_9",
        level: "BP",
        theme: "Incidents",
        question: "Votre commande de frein casse. Comment piloter ?",
        choices: [
            { text: "En tirant doucement sur les élévateurs arrière (C ou D) ou à la sellette.", correct: true },
            { text: "Je ne peux plus piloter, je fais secours.", correct: false },
            { text: "Je tire sur une suspente au hasard.", correct: false }
        ],
        explanation: "Le pilotage aux arrières est efficace mais physique. Attention à ne pas décrocher."
    },
    {
        id: "bp_incid_10",
        level: "BP",
        theme: "Incidents",
        question: "Vous subissez un twist sellette (tours de sangle) en vol stable. Comment détordre ?",
        choices: [
            { text: "Ecarter les deux faisceaux d'élévateurs à la main pour créer un couple de rotation inverse.", correct: true },
            { text: "Tourner la tête.", correct: false },
            { text: "Freiner.", correct: false }
        ],
        explanation: "L'écartement des montants oblige la sellette à se réaligner avec la voile."
    }
];
