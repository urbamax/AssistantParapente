const QCM_BPC = [
    // =========================================================================
    // NIVEAU BPC (Brevet de Pilote Confirmé) - 50 QUESTIONS
    // =========================================================================
    {
        id: "bpc_meteo_1",
        level: "BPC",
        theme: "Météo",
        question: "Que représente l'Aire Positive (CAPE) sur un émagramme ?",
        choices: [
            { text: "L'énergie convective potentiellement disponible (risque d'orage violent).", correct: true },
            { text: "Une zone de grande stabilité.", correct: false },
            { text: "Une zone de pluie continue.", correct: false }
        ],
        explanation: "Plus l'aire entre la courbe d'état et l'adiabatique est grande, plus l'ascendance sera explosive."
    },
    {
        id: "bpc_meteo_2",
        level: "BPC",
        theme: "Météo",
        question: "Sur un émagramme, que signifie le fait que la courbe de température et la courbe du point de rosée se rejoignent ?",
        choices: [
            { text: "L'air est saturé d'humidité : c'est la formation d'un nuage ou de brouillard.", correct: true },
            { text: "L'air est très sec.", correct: false },
            { text: "Il y a du vent fort.", correct: false }
        ],
        explanation: "T = Td signifie humidité relative = 100%."
    },
    {
        id: "bpc_meteo_3",
        level: "BPC",
        theme: "Météo",
        question: "Vous êtes calé au QNH 1013 et volez à 1000m indiqués. Vous entrez dans une zone de basse pression (1003 hPa). Quelle est votre altitude réelle ?",
        choices: [
            { text: "Plus basse que 1000m (Danger !).", correct: true },
            { text: "Plus haute que 1000m.", correct: false },
            { text: "Exactement 1000m.", correct: false }
        ],
        explanation: "Mémo : 'Vers les Basses Pressions, Gare aux Collisions !'. L'altimètre surestime votre hauteur."
    },
    {
        id: "bpc_meteo_4",
        level: "BPC",
        theme: "Météo",
        question: "Quelles sont les caractéristiques typiques de l'approche d'un Front Chaud ?",
        choices: [
            { text: "Des nuages stratiformes (Cirrus -> Cirrostratus -> Altostratus -> Nimbostratus) et des pluies continues.", correct: true },
            { text: "Des cumulus congestus et des orages isolés.", correct: false },
            { text: "Un ciel de traîne.", correct: false }
        ],
        explanation: "L'air chaud glisse doucement au-dessus de l'air froid, créant une couverture nuageuse étendue et s'épaississant."
    },
    {
        id: "bpc_meteo_5",
        level: "BPC",
        theme: "Météo",
        question: "De quoi dépend la vitesse du vent géostrophique ?",
        choices: [
            { text: "Elle est proportionnelle au gradient de pression (l'espacement des isobares).", correct: true },
            { text: "De la température au sol uniquement.", correct: false },
            { text: "De l'humidité.", correct: false }
        ],
        explanation: "Plus les isobares sont serrées, plus le moteur du vent est puissant."
    },
    {
        id: "bpc_meteo_6",
        level: "BPC",
        theme: "Météo",
        question: "Qu'est-ce que le Jet Stream ?",
        choices: [
            { text: "Un courant d'air très rapide (>100 kt) et étroit circulant à haute altitude (tropopause).", correct: true },
            { text: "Le vent de vallée.", correct: false },
            { text: "Un thermique thermique pur.", correct: false }
        ],
        explanation: "Bien qu'il vole très haut, il peut influencer la météo en basse couche et cisailler les sommets des ascendances."
    },
    {
        id: "bpc_meteo_7",
        level: "BPC",
        theme: "Météo",
        question: "Qu'est-ce qu'une onde de ressaut ?",
        choices: [
            { text: "Une oscillation stationnaire de l'air en aval d'un relief, matérialisée par des nuages lenticulaires.", correct: true },
            { text: "Un thermique classique.", correct: false },
            { text: "Une turbulence près du sol.", correct: false }
        ],
        explanation: "L'onde permet de monter très haut de façon laminaire, mais les rotors en basse couche sont destructeurs."
    },
    {
        id: "bpc_meteo_8",
        level: "BPC",
        theme: "Météo",
        question: "Quelle est la valeur de l'adiabatique sèche ?",
        choices: [
            { text: "Refroidissement de 1°C par 100m pour une particule d'air non saturée.", correct: true },
            { text: "0.6°C par 100m.", correct: false },
            { text: "2°C par 100m.", correct: false }
        ],
        explanation: "C'est la loi physique de détente des gaz parfaits."
    },
    {
        id: "bpc_meteo_9",
        level: "BPC",
        theme: "Météo",
        question: "Pourquoi l'adiabatique humide (saturée) est-elle plus faible que l'adiabatique sèche ?",
        choices: [
            { text: "Car la condensation de la vapeur d'eau libère de la chaleur latente qui réchauffe la particule.", correct: true },
            { text: "Car l'eau est lourde.", correct: false },
            { text: "C'est l'inverse.", correct: false }
        ],
        explanation: "C'est le 'turbo' des nuages d'orage : en condensant, l'air se refroidit moins vite et monte donc plus haut."
    },
    {
        id: "bpc_meteo_10",
        level: "BPC",
        theme: "Météo",
        question: "Qu'est-ce que la subsidence ?",
        choices: [
            { text: "Un mouvement général d'affaissement de la masse d'air (dans un anticyclone).", correct: true },
            { text: "Une montée d'air généralisée.", correct: false },
            { text: "Un vent de travers.", correct: false }
        ],
        explanation: "La subsidence comprime et réchauffe l'air, ce qui l'assèche et crée souvent des inversions de température bloquant les thermiques."
    },

    {
        id: "bpc_perf_1",
        level: "BPC",
        theme: "Performance",
        question: "En transition face au vent, quelle vitesse devez-vous adopter pour optimiser votre finesse sol ?",
        choices: [
            { text: "Je dois accélérer (Premier barreau ou plus) pour pénétrer la masse d'air.", correct: true },
            { text: "Je ralentis au taux de chute mini pour tenir plus longtemps.", correct: false },
            { text: "Je reste bras hauts.", correct: false }
        ],
        explanation: "Voler lent face au vent dégrade catastrophiquement la finesse sol (on fait du surplace)."
    },
    {
        id: "bpc_perf_2",
        level: "BPC",
        theme: "Performance",
        question: "Quel est le principe de la théorie de MacCready ?",
        choices: [
            { text: "Adapter sa vitesse de transition en fonction de la force des thermiques espérés.", correct: true },
            { text: "Voler toujours à fond.", correct: false },
            { text: "Voler toujours au taux de chute mini.", correct: false }
        ],
        explanation: "Si le prochain thermique est fort, il faut voler vite pour y arriver plus tôt, quitte à arriver plus bas."
    },
    {
        id: "bpc_perf_3",
        level: "BPC",
        theme: "Performance",
        question: "En volant sous une rue de nuages, quelle technique adoptez-vous ?",
        choices: [
            { text: "Le vol 'dauphin' : j'accélère dans les dégueulantes et je ralentis (sans enrouler) dans les ascendances.", correct: true },
            { text: "J'enroule chaque thermique jusqu'au plafond.", correct: false },
            { text: "Je vole tout le long au taux de chute mini.", correct: false }
        ],
        explanation: "Cela permet d'avancer vite sans perdre de temps à faire des ronds."
    },
    {
        id: "bpc_perf_4",
        level: "BPC",
        theme: "Performance",
        question: "Quel est l'effet principal de l'ajout de ballast (eau) en compétition ?",
        choices: [
            { text: "Il décale la polaire vers les hautes vitesses : on plane aussi bien, mais plus vite.", correct: true },
            { text: "Il permet de monter plus vite en thermique.", correct: false },
            { text: "Il améliore la stabilité uniquement.", correct: false }
        ],
        explanation: "L'inconvénient est un taux de chute mini plus élevé (moins bon dans le petit temps)."
    },
    {
        id: "bpc_perf_5",
        level: "BPC",
        theme: "Performance",
        question: "Quel est l'avantage aérodynamique d'une sellette cocon (carénée) ?",
        choices: [
            { text: "Elle réduit significativement la traînée parasite du pilote, améliorant la finesse (surtout accéléré).", correct: true },
            { text: "Elle protège du froid uniquement.", correct: false },
            { text: "Elle permet de piloter avec les pieds.", correct: false }
        ],
        explanation: "Le gain de finesse peut être de 1 point ou plus à haute vitesse."
    },
    {
        id: "bpc_perf_6",
        level: "BPC",
        theme: "Performance",
        question: "Quelle est la particularité du pilotage aux arrières sur une voile '2 lignes' ?",
        choices: [
            { text: "Il permet un contrôle direct et efficace de l'incidence sur toute la corde, même accéléré.", correct: true },
            { text: "Il ne sert qu'à se diriger.", correct: false },
            { text: "C'est dangereux et déconseillé.", correct: false }
        ],
        explanation: "On pilote l'aile comme une aile rigide, en changeant son incidence sans déformer le profil (pas de cassure)."
    },
    {
        id: "bpc_perf_7",
        level: "BPC",
        theme: "Performance",
        question: "Pourquoi les voiles de compétition (CCC / EN-D 2 lignes) ont-elles une plage de vitesse très étendue ?",
        choices: [
            { text: "Grâce à leur profil reflex solide et leur structure interne complexe.", correct: true },
            { text: "Parce qu'elles sont petites.", correct: false },
            { text: "Parce qu'elles sont lourdes.", correct: false }
        ],
        explanation: "Elles restent solides même à très basse incidence (haute vitesse)."
    },
    {
        id: "bpc_perf_8",
        level: "BPC",
        theme: "Performance",
        question: "Comment gérer la dérive en thermique avec du vent ?",
        choices: [
            { text: "Il faut décaler ses cercles 'au vent' à chaque tour pour rester dans la colonne inclinée.", correct: true },
            { text: "Il faut dériver avec le vent sans rien faire.", correct: false },
            { text: "Il faut tourner ovale face au vent.", correct: false }
        ],
        explanation: "Si on ne corrige pas, on sort du thermique par 'sous le vent'."
    },
    {
        id: "bpc_perf_9",
        level: "BPC",
        theme: "Performance",
        question: "Au posé, comment utilisez-vous le 'point d'aboutissement' ?",
        choices: [
            { text: "C'est le point au sol qui reste immobile dans mon champ visuel (ni ne monte, ni ne descend).", correct: true },
            { text: "C'est la cible.", correct: false },
            { text: "C'est l'horizon.", correct: false }
        ],
        explanation: "Si le point monte dans votre pare-brise, vous allez être court. S'il descend, vous allez être long."
    },
    {
        id: "bpc_perf_10",
        level: "BPC",
        theme: "Performance",
        question: "L'incidence de finesse max varie-t-elle avec le poids du pilote ?",
        choices: [
            { text: "Non, l'incidence de finesse max est une caractéristique géométrique de l'aile.", correct: true },
            { text: "Oui, plus on est lourd, plus l'incidence optimale change.", correct: false },
            { text: "Ça dépend du vent.", correct: false }
        ],
        explanation: "Ce qui change avec le poids, c'est la VITESSE à laquelle cette finesse max est atteinte."
    },

    {
        id: "bpc_aero_1",
        level: "BPC",
        theme: "Cross",
        question: "Qu'est-ce un Triangle FAI ?",
        choices: [
            { text: "Un triangle fermé dont la plus petite branche fait au moins 28% de la distance totale.", correct: true },
            { text: "Un aller-retour.", correct: false },
            { text: "Un vol libre avec 3 points de virage quelconques.", correct: false }
        ],
        explanation: "C'est le parcours 'roi' car il oblige à voler dans toutes les directions par rapport au vent."
    },
    {
        id: "bpc_aero_2",
        level: "BPC",
        theme: "Cross",
        question: "Qu'est-ce que la Distance Libre ?",
        choices: [
            { text: "Voler le plus loin possible du décollage, quelle que soit la trajectoire (souvent vent de dos).", correct: true },
            { text: "Un vol où l'on ne paie pas.", correct: false },
            { text: "Un triangle plat.", correct: false }
        ],
        explanation: "C'est le type de record de distance le plus courant (ex: Quixada au Brésil)."
    },
    {
        id: "bpc_aero_3",
        level: "BPC",
        theme: "Cross",
        question: "Comment valide-t-on une balise (Turnpoint) en compétition ?",
        choices: [
            { text: "En entrant dans un cylindre virtuel (rayon 400m ou plus) centré sur la balise GPS.", correct: true },
            { text: "En touchant la balise au sol.", correct: false },
            { text: "En prenant une photo.", correct: false }
        ],
        explanation: "Le GPS enregistre la trace et prouve le passage dans le cylindre."
    },
    {
        id: "bpc_aero_4",
        level: "BPC",
        theme: "Cross",
        question: "Pourquoi l'heure de déclenchement est-elle cruciale en cross ?",
        choices: [
            { text: "Partir trop tôt mène au 'tas' (posé), partir trop tard fait perdre des kilomètres potentiels.", correct: true },
            { text: "Il faut partir avant le lever du soleil.", correct: false },
            { text: "Il faut partir à 14h quand c'est le plus fort.", correct: false }
        ],
        explanation: "Il faut décoller dès que les premiers thermiques sont exploitables pour maximiser la journée."
    },
    {
        id: "bpc_aero_5",
        level: "BPC",
        theme: "Cross",
        question: "Quelle précaution prendre lors du franchissement d'un col ?",
        choices: [
            { text: "Arriver avec une grosse marge d'altitude ou passer 'au vent' pour éviter l'effet venturi et les rabattants.", correct: true },
            { text: "Passer le plus bas possible.", correct: false },
            { text: "Passer sous le vent du col.", correct: false }
        ],
        explanation: "L'accélération du vent dans le col peut vous scotcher ou vous mettre dans une turbulence sévère."
    },
    {
        id: "bpc_aero_6",
        level: "BPC",
        theme: "Cross",
        question: "Qu'est-ce qu'une zone de convergence ?",
        choices: [
            { text: "La rencontre de deux brises de vallée qui force l'air à monter sur une longue ligne.", correct: true },
            { text: "Une zone de pluie.", correct: false },
            { text: "Une zone descendante.", correct: false }
        ],
        explanation: "C'est une 'autoroute à thermiques' très prisée des crosseurs."
    },
    {
        id: "bpc_aero_7",
        level: "BPC",
        theme: "Cross",
        question: "En vol de plaine, quels sont les meilleurs déclencheurs de thermiques ?",
        choices: [
            { text: "Les contrastes au sol (villages, zones industrielles, forêts sombres, lisières).", correct: true },
            { text: "Les lacs et rivières.", correct: false },
            { text: "Les zones de forêt dense et humide.", correct: false }
        ],
        explanation: "Il faut chercher les zones qui emmagasinent la chaleur."
    },
    {
        id: "bpc_aero_8",
        level: "BPC",
        theme: "Cross",
        question: "Qu'est-ce que le plafond légal ?",
        choices: [
            { text: "L'altitude maximale autorisée par la réglementation aérienne (TMA, FL 115, etc.).", correct: true },
            { text: "La base des nuages.", correct: false },
            { text: "L'altitude où l'on a froid.", correct: false }
        ],
        explanation: "Le dépassement entraîne la disqualification en compétition et un risque de collision avion."
    },
    {
        id: "bpc_aero_9",
        level: "BPC",
        theme: "Cross",
        question: "Qu'est-ce qu'une ligne de récupération optimale en cross ?",
        choices: [
            { text: "Un axe de vol qui suit une route ou une voie ferrée pour faciliter le retour en stop/train.", correct: true },
            { text: "Une ligne haute tension.", correct: false },
            { text: "Une rivière sauvage.", correct: false }
        ],
        explanation: "Vacher au milieu de nulle part peut transformer le retour en calvaire."
    },
    {
        id: "bpc_aero_10",
        level: "BPC",
        theme: "Cross",
        question: "Pourquoi l'hydratation est-elle vitale en vol de durée ?",
        choices: [
            { text: "La déshydratation entraîne rapidement une baisse de la vigilance, des maux de tête et des erreurs de décision.", correct: true },
            { text: "Pour ne pas avoir la bouche sèche.", correct: false },
            { text: "Ce n'est pas important, on boira à l'atterro.", correct: false }
        ],
        explanation: "En altitude, l'air est sec et on perd beaucoup d'eau. Camelbak indispensable."
    },

    {
        id: "bpc_reg_1",
        level: "BPC",
        theme: "Réglementation",
        question: "Qu'est-ce qu'une TMA (Terminal Manoeuvring Area) ?",
        choices: [
            { text: "Une zone de contrôle d'approche autour des grands aéroports, souvent interdite (Classe C ou D) ou réglementée.", correct: true },
            { text: "Une zone de vol libre.", correct: false },
            { text: "Une zone militaire.", correct: false }
        ],
        explanation: "C'est souvent le 'plafond de verre' qui limite l'altitude des crosseurs."
    },
    {
        id: "bpc_reg_2",
        level: "BPC",
        theme: "Réglementation",
        question: "Qu'est-ce qu'une CTR (Control Zone) ?",
        choices: [
            { text: "Un volume d'espace aérien contrôlé autour d'un aérodrome, allant du sol jusqu'à une certaine hauteur.", correct: true },
            { text: "Un espace libre.", correct: false },
            { text: "Une zone de montagne.", correct: false }
        ],
        explanation: "Pénétration formellement interdite sans clairance (ce qui est quasi impossible pour un parapente)."
    },
    {
        id: "bpc_reg_3",
        level: "BPC",
        theme: "Réglementation",
        question: "En France, quelle est la limite générale de l'espace aérien supérieur (LTA) interdit au VFR ?",
        choices: [
            { text: "Le FL 195 (environ 5800m) ou FL 115 (3500m) dans certaines zones (région parisienne).", correct: true },
            { text: "5000m partout.", correct: false },
            { text: "Il n'y a pas de limite.", correct: false }
        ],
        explanation: "Au-dessus du FL 195, c'est l'espace de Classe C réservé aux IFR."
    },
    {
        id: "bpc_reg_4",
        level: "BPC",
        theme: "Réglementation",
        question: "Dans quel cas un transpondeur est-il obligatoire ?",
        choices: [
            { text: "Pour pénétrer dans certains espaces contrôlés (Classe C, D) ou zones à statut particulier (TMZ).", correct: true },
            { text: "Pour voler en club.", correct: false },
            { text: "C'est obligatoire tout le temps.", correct: false }
        ],
        explanation: "Il permet d'être vu par les contrôleurs et les systèmes anti-collision (TCAS) des avions."
    },
    {
        id: "bpc_reg_5",
        level: "BPC",
        theme: "Réglementation",
        question: "Qu'est-ce que le RTBA (Réseau Très Basse Altitude) ?",
        choices: [
            { text: "Un ensemble de couloirs réservés aux vols d'entraînement militaire à grande vitesse et très basse altitude.", correct: true },
            { text: "Une route pour les voitures.", correct: false },
            { text: "Un réseau de balises météo.", correct: false }
        ],
        explanation: "Si le RTBA est 'ACTIF', la pénétration est danger de mort. Consulter les cartes AZBA."
    },
    {
        id: "bpc_reg_6",
        level: "BPC",
        theme: "Réglementation",
        question: "À quoi servent les NOTAM (Notice To Air Men) ?",
        choices: [
            { text: "À signaler des modifications temporaires de l'espace aérien (ZRT, exercices militaires, travaux).", correct: true },
            { text: "À donner la météo.", correct: false },
            { text: "À donner les résultats du loto.", correct: false }
        ],
        explanation: "Consultation obligatoire avant tout vol de distance pour éviter d'entrer dans une zone temporairement interdite."
    },
    {
        id: "bpc_reg_7",
        level: "BPC",
        theme: "Réglementation",
        question: "Quelle est la différence entre QNH et QFE ?",
        choices: [
            { text: "QNH donne l'altitude par rapport à la mer. QFE donne la hauteur par rapport au terrain (zéro au sol).", correct: true },
            { text: "C'est la même chose.", correct: false },
            { text: "QNH est pour les hélicoptères.", correct: false }
        ],
        explanation: "En vol de distance, on utilise le QNH (ou le niveau de vol standard 1013 au-dessus de l'altitude de transition)."
    },
    {
        id: "bpc_reg_8",
        level: "BPC",
        theme: "Réglementation",
        question: "Est-il autorisé de survoler une ville ou un rassemblement de personnes ?",
        choices: [
            { text: "Non, le survol des agglomérations et rassemblements est interdit (sauf hauteur très importante et plané possible hors zone).", correct: true },
            { text: "Oui, si on fait coucou.", correct: false },
            { text: "Oui, pour prendre des photos.", correct: false }
        ],
        explanation: "C'est une règle de base pour la sécurité des tiers au sol (arrêté 'S-3')."
    },
    {
        id: "bpc_reg_9",
        level: "BPC",
        theme: "Réglementation",
        question: "Pouvez-vous voler en VFR de nuit en parapente ?",
        choices: [
            { text: "Non, le vol à vue est limité à la période entre le lever et le coucher du soleil (+/- 30 min aéronautiques).", correct: true },
            { text: "Oui, avec une lampe frontale.", correct: false },
            { text: "Oui, les nuits de pleine lune.", correct: false }
        ],
        explanation: "Le parapente n'est pas équipé pour le vol de nuit."
    },
    {
        id: "bpc_reg_10",
        level: "BPC",
        theme: "Réglementation",
        question: "Quelle assurance est légalement obligatoire pour voler ?",
        choices: [
            { text: "La Responsabilité Civile Aérienne (RCA).", correct: true },
            { text: "L'Individuelle Accident (IA).", correct: false },
            { text: "Aucune.", correct: false }
        ],
        explanation: "Elle couvre les dommages que vous pourriez causer aux tiers (toiture, ligne électrique, personne...)."
    },

    {
        id: "bpc_incid_1",
        level: "BPC",
        theme: "Incidents",
        question: "Qu'est-ce qu'une vrille à plat ?",
        choices: [
            { text: "Un décrochage dissymétrique (une demi-aile décrochée) entraînant une rotation rapide sur l'axe de lacet.", correct: true },
            { text: "Un 360 très serré.", correct: false },
            { text: "Une glissade.", correct: false }
        ],
        explanation: "C'est souvent causé par une basse vitesse + une action commande trop forte. Action : Bras Hauts immédiats !"
    },
    {
        id: "bpc_incid_2",
        level: "BPC",
        theme: "Incidents",
        question: "Quelle est la définition aérodynamique du décrochage complet ?",
        choices: [
            { text: "Perte totale de portance par décollement des filets d'air sur toute l'aile (chute arrière).", correct: true },
            { text: "Une fermeture frontale.", correct: false },
            { text: "Voler trop vite.", correct: false }
        ],
        explanation: "La voile ne vole plus, elle tombe comme un caillou. La sortie demande une reconstitution du profil et une grosse abattée."
    },
    {
        id: "bpc_incid_3",
        level: "BPC",
        theme: "Incidents",
        question: "Qu'est-ce que la 'satellisation' en 360 face planète ?",
        choices: [
            { text: "Le pilote subit une force centrifuge telle qu'il ne peut plus relever les mains ou se redresser (voile noir imminent).", correct: true },
            { text: "Voler dans l'espace.", correct: false },
            { text: "Monter très haut.", correct: false }
        ],
        explanation: "Danger mortel. Il faut tout faire pour freiner l'aile extérieure ou faire secours avant la perte de conscience."
    },
    {
        id: "bpc_incid_4",
        level: "BPC",
        theme: "Incidents",
        question: "Vos commandes de frein sont inopérantes (ou twistées indémêlable). Vous êtes haut. Que faites-vous ?",
        choices: [
            { text: "Je pilote prudemment aux élévateurs arrière (C ou D) ou je saisis les suspentes de frein au-dessus du twist.", correct: true },
            { text: "Je fais secours direct.", correct: false },
            { text: "J'attends.", correct: false }
        ],
        explanation: "Si le pilotage est impossible, le secours est l'option finale, mais on peut souvent diriger l'aile autrement."
    },
    {
        id: "bpc_incid_5",
        level: "BPC",
        theme: "Incidents",
        question: "Vous traversez un 'noyau dur' de turbulence. Quelle est l'attitude clé ?",
        choices: [
            { text: "Pilotage actif : garder le contact aux freins, amortir les abattées, ne pas surpiloter.", correct: true },
            { text: "Se crisper et freiner à fond.", correct: false },
            { text: "Lâcher les commandes.", correct: false }
        ],
        explanation: "Il faut laisser vivre l'aile tout en l'empêchant de fermer ou de décrocher."
    },
    {
        id: "bpc_incid_6",
        level: "BPC",
        theme: "Incidents",
        question: "Vous êtes contraint d'atterrir vent de cul (pas le choix). Que faites-vous ?",
        choices: [
            { text: "Je prépare un roulé-boulé, je ne freine pas trop tôt (risque décrochage) et j'accepte la vitesse.", correct: true },
            { text: "Je freine à mort à 5m du sol.", correct: false },
            { text: "Je sors le train d'atterrissage.", correct: false }
        ],
        explanation: "Essayer de freiner la vitesse sol mènera au décrochage violent. Mieux vaut rouler au sol."
    },
    {
        id: "bpc_incid_7",
        level: "BPC",
        theme: "Incidents",
        question: "Amerrissage forcé (posé dans l'eau). Quelle est la procédure vitale ?",
        choices: [
            { text: "Se déboucler (cuissardes/ventrale) AVANT l'impact si possible, s'éloigner de la voile immédiatement.", correct: true },
            { text: "Garder tout son équipement.", correct: false },
            { text: "Attendre les secours dans la sellette.", correct: false }
        ],
        explanation: "S'emmêler dans les suspentes sous l'eau est la cause principale de noyade, même avec un gilet."
    },
    {
        id: "bpc_incid_8",
        level: "BPC",
        theme: "Incidents",
        question: "Quels sont les symptômes de l'hypoxie (manque d'oxygène) en haute altitude ?",
        choices: [
            { text: "Euphorie, altération du jugement, troubles visuels, puis perte de connaissance.", correct: true },
            { text: "Douleur aux jambes.", correct: false },
            { text: "Faim intense.", correct: false }
        ],
        explanation: "C'est traître car on ne se sent pas 'mal'. On se sent même souvent 'super bien' juste avant de s'évanouir."
    },
    {
        id: "bpc_incid_9",
        level: "BPC",
        theme: "Incidents",
        question: "Comment lutter contre l'hypothermie (froid) lors d'un long vol ?",
        choices: [
            { text: "S'habiller plus que de raison (manchons, couches multiples) avant de décoller. Bouger les doigts.", correct: true },
            { text: "Boire de l'alcool.", correct: false },
            { text: "Descendre vite.", correct: false }
        ],
        explanation: "Le vent relatif + l'altitude refroidissent le corps très vite. L'onglée peut empêcher de tenir les commandes."
    },
    {
        id: "bpc_incid_10",
        level: "BPC",
        theme: "Incidents",
        question: "Votre GPS tombe en panne en plein cross inconnu. Que faites-vous ?",
        choices: [
            { text: "Je navigue 'à l'ancienne' (repères sol, soleil, carte mentale) en assurant des marges de sécurité (espaces aériens).", correct: true },
            { text: "Je pose tout de suite dans le premier champ.", correct: false },
            { text: "Je continue au hasard.", correct: false }
        ],
        explanation: "L'électronique est une aide, pas une prothèse indispensable. Le pilote doit savoir où il est."
    }
];
