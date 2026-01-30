const QCM_BI = [
    // =========================================================================
    // NIVEAU BI (Brevet Initial) - 50 QUESTIONS
    // =========================================================================
    {
        id: "bi_meteo_1",
        level: "BI",
        theme: "Météo",
        question: "En journée, comment souffle généralement la brise de vallée ?",
        choices: [
            { text: "De la plaine vers la montagne (brise montante).", correct: true },
            { text: "De la montagne vers la plaine (brise descendante).", correct: false },
            { text: "Toujours du Nord, peu importe le relief.", correct: false }
        ],
        explanation: "Le soleil chauffe les reliefs, créant une dépression thermique qui attire l'air de la vallée vers les sommets."
    },
    {
        id: "bi_meteo_2",
        level: "BI",
        theme: "Météo",
        question: "Que signifie la présence d'un cumulus de beau temps au-dessus d'un relief ?",
        choices: [
            { text: "Il matérialise le sommet d'une ascendance thermique.", correct: true },
            { text: "Il annonce l'arrivée imminente d'un orage.", correct: false },
            { text: "Il indique une zone de descendance froide.", correct: false }
        ],
        explanation: "Le cumulus se forme par condensation de l'humidité au sommet de la colonne d'air chaud montant."
    },
    {
        id: "bi_meteo_3",
        level: "BI",
        theme: "Météo",
        question: "Vous êtes débutant au décollage et le vent est établi à 30 km/h. Que faites-vous ?",
        choices: [
            { text: "Je renonce à décoller car le risque de reculade est trop grand.", correct: true },
            { text: "Je prends une voile plus petite pour décoller.", correct: false },
            { text: "Je demande de l'aide pour me tenir au sol et je décolle.", correct: false }
        ],
        explanation: "30 km/h est une vitesse de vent très élevée, proche de la vitesse de vol du parapente, rendant le décollage dangereux pour un débutant."
    },
    {
        id: "bi_meteo_4",
        level: "BI",
        theme: "Météo",
        question: "Le phénomène de refroidissement de l'air le soir favorise :",
        choices: [
            { text: "La restitution (air calme et porteur en vallée).", correct: true },
            { text: "La convection thermique violente.", correct: false },
            { text: "L'effet de foehn.", correct: false }
        ],
        explanation: "L'air se stabilise en se refroidissant, offrant souvent des conditions de vol très douces et laminaires (vol du soir)."
    },
    {
        id: "bi_meteo_5",
        level: "BI",
        theme: "Météo",
        question: "Vous observez des 'moutons' (écume blanche) à la surface d'un lac. Qu'en déduisez-vous ?",
        choices: [
            { text: "Le vent est fort, supérieur à 20-25 km/h.", correct: true },
            { text: "Il va pleuvoir dans l'heure.", correct: false },
            { text: "Le vent est nul, c'est juste du clapot.", correct: false }
        ],
        explanation: "L'apparition d'écume sur l'eau indique généralement une vitesse de vent critique pour le parapente."
    },
    {
        id: "bi_meteo_6",
        level: "BI",
        theme: "Météo",
        question: "Qu'est-ce que le 'vent relatif' ?",
        choices: [
            { text: "C'est la vitesse et la direction de l'air ressentis par le pilote en mouvement.", correct: true },
            { text: "C'est uniquement la vitesse du vent météo.", correct: false },
            { text: "C'est la vitesse par rapport au sol.", correct: false }
        ],
        explanation: "Le vent relatif est créé par votre propre vitesse. C'est le flux d'air qui permet à l'aile de porter."
    },
    {
        id: "bi_meteo_7",
        level: "BI",
        theme: "Météo",
        question: "Un nuage en forme de capuchon coiffe le sommet de la montagne. Que cela signifie-t-il ?",
        choices: [
            { text: "Il y a du vent fort en altitude, c'est un signe de danger.", correct: true },
            { text: "C'est un signe de beau temps stable.", correct: false },
            { text: "Cela indique des thermiques doux.", correct: false }
        ],
        explanation: "Ce nuage orographique signale souvent un vent fort et humide franchissant le relief (effet de foehn local)."
    },
    {
        id: "bi_meteo_8",
        level: "BI",
        theme: "Météo",
        question: "Quel est le principe de base de la convection (thermique) ?",
        choices: [
            { text: "L'air chaud est moins dense que l'air froid, donc il monte.", correct: true },
            { text: "L'air chaud est plus lourd, donc il descend.", correct: false },
            { text: "L'air chaud reste immobile au sol.", correct: false }
        ],
        explanation: "C'est la différence de densité due à la température qui crée le mouvement ascendant (Poussée d'Archimède)."
    },
    {
        id: "bi_meteo_9",
        level: "BI",
        theme: "Météo",
        question: "L'arrivée d'un front froid est généralement synonyme de :",
        choices: [
            { text: "Forte instabilité, averses et risques d'orages.", correct: true },
            { text: "Grand beau temps stable et chaud.", correct: false },
            { text: "Conditions anticycloniques durables.", correct: false }
        ],
        explanation: "L'air froid, plus lourd, soulève brutalement l'air chaud qu'il remplace, créant des nuages à développement vertical."
    },
    {
        id: "bi_meteo_10",
        level: "BI",
        theme: "Météo",
        question: "D'où vient la brise de mer ?",
        choices: [
            { text: "Elle souffle de la mer vers la terre.", correct: true },
            { text: "Elle souffle de la terre vers la mer.", correct: false },
            { text: "Elle descend des nuages.", correct: false }
        ],
        explanation: "La terre chauffe plus vite que la mer, créant une aspiration de l'air marin vers l'intérieur des terres."
    },

    {
        id: "bi_meca_1",
        level: "BI",
        theme: "Mécanique de Vol",
        question: "Quelle est la conséquence immédiate d'une action de freinage sur le profil de l'aile ?",
        choices: [
            { text: "Cela augmente la portance et la traînée.", correct: true },
            { text: "Cela diminue la portance immédiatement.", correct: false },
            { text: "Cela diminue uniquement la traînée.", correct: false }
        ],
        explanation: "Baisser les freins creuse le profil, ce qui le rend plus porteur à basse vitesse mais augmente sa résistance à l'air."
    },
    {
        id: "bi_meca_2",
        level: "BI",
        theme: "Mécanique de Vol",
        question: "Comment définit-on l'angle d'incidence ?",
        choices: [
            { text: "C'est l'angle entre la corde du profil et le vent relatif.", correct: true },
            { text: "C'est l'angle entre l'horizon et la voile.", correct: false },
            { text: "C'est l'angle entre le pilote et la verticale.", correct: false }
        ],
        explanation: "L'incidence est le paramètre clé de la mécanique de vol. Trop d'incidence mène au décrochage."
    },
    {
        id: "bi_meca_3",
        level: "BI",
        theme: "Mécanique de Vol",
        question: "Qu'est-ce que la finesse air ?",
        choices: [
            { text: "Le rapport entre la distance horizontale parcourue et la hauteur perdue.", correct: true },
            { text: "La vitesse horizontale de l'aile.", correct: false },
            { text: "Le poids de l'aile divisé par sa surface.", correct: false }
        ],
        explanation: "Une finesse de 10 signifie qu'on avance de 10 mètres pour 1 mètre de chute (en air calme)."
    },
    {
        id: "bi_meca_4",
        level: "BI",
        theme: "Mécanique de Vol",
        question: "Lors d'un virage stabilisé, comment évolue le taux de chute ?",
        choices: [
            { text: "Il augmente (on descend plus vite).", correct: true },
            { text: "Il diminue (on descend moins vite).", correct: false },
            { text: "Il reste strictement identique au vol droit.", correct: false }
        ],
        explanation: "En virage, la portance est inclinée. Pour compenser le poids, il faut plus de portance totale, ce qui augmente la traînée et le taux de chute."
    },
    {
        id: "bi_meca_5",
        level: "BI",
        theme: "Mécanique de Vol",
        question: "À quoi correspond la vitesse 'bras hauts' ?",
        choices: [
            { text: "C'est la vitesse de vol naturelle de l'aile sans action du pilote.", correct: true },
            { text: "C'est la vitesse de décrochage.", correct: false },
            { text: "C'est la vitesse minimale de l'aile.", correct: false }
        ],
        explanation: "C'est la vitesse de conception, offrant généralement la meilleure finesse."
    },
    {
        id: "bi_meca_6",
        level: "BI",
        theme: "Mécanique de Vol",
        question: "Physiquement, le décrochage se produit lorsque :",
        choices: [
            { text: "L'angle d'incidence devient trop grand et les filets d'air se décollent.", correct: true },
            { text: "La vitesse sol est nulle.", correct: false },
            { text: "Le vent de face est trop fort.", correct: false }
        ],
        explanation: "Lorsque l'air ne peut plus suivre la courbure de l'extrados, la portance s'effondre brutalement."
    },
    {
        id: "bi_meca_7",
        level: "BI",
        theme: "Mécanique de Vol",
        question: "Comment calcule-t-on la charge alaire ?",
        choices: [
            { text: "Poids Total Volant (PTV) divisé par la surface de l'aile.", correct: true },
            { text: "Poids du pilote divisé par la finesse.", correct: false },
            { text: "Surface de l'aile divisée par le poids du pilote.", correct: false }
        ],
        explanation: "Une forte charge alaire rend l'aile plus rapide et plus réactive, mais augmente le taux de chute."
    },
    {
        id: "bi_meca_8",
        level: "BI",
        theme: "Mécanique de Vol",
        question: "Si vous volez face à un vent de 20 km/h, comment évolue votre finesse sol ?",
        choices: [
            { text: "Elle diminue considérablement.", correct: true },
            { text: "Elle augmente.", correct: false },
            { text: "Elle reste identique à la finesse air.", correct: false }
        ],
        explanation: "Vous parcourez beaucoup moins de distance au sol pour la même hauteur perdue."
    },
    {
        id: "bi_meca_9",
        level: "BI",
        theme: "Mécanique de Vol",
        question: "Si vous volez vent de dos (vent arrière), comment évolue votre finesse sol ?",
        choices: [
            { text: "Elle augmente.", correct: true },
            { text: "Elle diminue.", correct: false },
            { text: "Elle devient nulle.", correct: false }
        ],
        explanation: "Le vent vous pousse, augmentant la distance parcourue au sol."
    },
    {
        id: "bi_meca_10",
        level: "BI",
        theme: "Mécanique de Vol",
        question: "Quel est le rôle principal de l'effet pendulaire en parapente ?",
        choices: [
            { text: "Il stabilise naturellement l'aile en tangage et en roulis.", correct: true },
            { text: "Il empêche le pilote de tourner.", correct: false },
            { text: "C'est un défaut de conception dangereux.", correct: false }
        ],
        explanation: "Le centre de gravité (pilote) étant très bas sous le centre de poussée (voile), le système tend à revenir à l'équilibre."
    },

    {
        id: "bi_pilotage_1",
        level: "BI",
        theme: "Pilotage",
        question: "Quelle est la bonne séquence d'actions pour initier un virage à droite ?",
        choices: [
            { text: "Regard à droite, appui sellette à droite, puis commande droite.", correct: true },
            { text: "Commande droite à fond uniquement.", correct: false },
            { text: "Se pencher à gauche pour contrer et tirer à droite.", correct: false }
        ],
        explanation: "Le virage commence par la prise d'information (regard) et le transfert de poids, avant l'action au frein."
    },
    {
        id: "bi_pilotage_2",
        level: "BI",
        theme: "Pilotage",
        question: "Votre voile effectue une abattée (plonge vers l'avant). Que devez-vous faire ?",
        choices: [
            { text: "Donner une impulsion rapide et dosée sur les freins (temporisation).", correct: true },
            { text: "Mettre les mains bras hauts immédiatement.", correct: false },
            { text: "Accélérer pour reprendre de la vitesse.", correct: false }
        ],
        explanation: "Il faut freiner l'aile pour l'empêcher de passer devant vous, puis relâcher quand elle est stabilisée."
    },
    {
        id: "bi_pilotage_3",
        level: "BI",
        theme: "Pilotage",
        question: "Quel est le meilleur moyen de garder un cap rectiligne ?",
        choices: [
            { text: "Fixer un repère visuel lointain dans l'axe.", correct: true },
            { text: "Regarder sa voile en permanence.", correct: false },
            { text: "Regarder ses pieds ou son instrument.", correct: false }
        ],
        explanation: "Le corps suit naturellement le regard. Fixer un point loin permet de corriger instinctivement les dérives."
    },
    {
        id: "bi_pilotage_4",
        level: "BI",
        theme: "Pilotage",
        question: "À quoi sert la course d'élan lors du décollage ?",
        choices: [
            { text: "À créer la vitesse air nécessaire pour que l'aile porte.", correct: true },
            { text: "À arriver le plus vite possible au bord du terrain.", correct: false },
            { text: "À tendre les suspentes uniquement.", correct: false }
        ],
        explanation: "Sans vitesse air, pas de portance. Il faut courir tant que l'aile ne vous soulève pas franchement."
    },
    {
        id: "bi_pilotage_5",
        level: "BI",
        theme: "Pilotage",
        question: "Comment réalise-t-on la manœuvre des 'oreilles' ?",
        choices: [
            { text: "En tirant symétriquement les suspentes A extérieures.", correct: true },
            { text: "En tirant les deux commandes de frein à fond.", correct: false },
            { text: "En tirant sur les élévateurs arrière.", correct: false }
        ],
        explanation: "Cette manœuvre réduit la surface portante pour augmenter le taux de chute sans dégrader la stabilité."
    },
    {
        id: "bi_pilotage_6",
        level: "BI",
        theme: "Pilotage",
        question: "Quelle est la précaution majeure lors de la sortie d'un virage 360 engagé ?",
        choices: [
            { text: "Sortir progressivement pour dissiper l'énergie et éviter une ressource violente.", correct: true },
            { text: "Relâcher brutalement la commande pour revenir à plat tout de suite.", correct: false },
            { text: "Freiner l'intérieur du virage.", correct: false }
        ],
        explanation: "Une sortie brutale transforme toute la vitesse en montée (chandelle), suivie d'une abattée dangereuse."
    },
    {
        id: "bi_pilotage_7",
        level: "BI",
        theme: "Pilotage",
        question: "Vous subissez une fermeture asymétrique. Quelle est la priorité absolue ?",
        choices: [
            { text: "Garder son cap en contrant à la sellette (poids côté ouvert).", correct: true },
            { text: "Regarder l'aile fermée pour voir ce qui se passe.", correct: false },
            { text: "Pomper frénétiquement sur le frein.", correct: false }
        ],
        explanation: "Le danger est la rotation involontaire vers le relief. Maintenir le cap est vital."
    },
    {
        id: "bi_pilotage_8",
        level: "BI",
        theme: "Pilotage",
        question: "En quoi consiste l'arrondi (le freinage final) à l'atterrissage ?",
        choices: [
            { text: "Transformer la vitesse horizontale en ressource pour toucher le sol en douceur.", correct: true },
            { text: "Freiner l'aile pour qu'elle s'arrête en l'air à 10m du sol.", correct: false },
            { text: "C'est une option facultative.", correct: false }
        ],
        explanation: "C'est une conversion d'énergie : on échange de la vitesse contre un palier à vitesse nulle."
    },
    {
        id: "bi_pilotage_9",
        level: "BI",
        theme: "Pilotage",
        question: "Pourquoi est-il important de regarder sa voile pendant la montée au gonflage ?",
        choices: [
            { text: "Pour vérifier qu'elle monte droit, qu'elle est ouverte et pour la centrer.", correct: true },
            { text: "C'est inutile, on sent tout à la sellette.", correct: false },
            { text: "C'est dangereux car on ne regarde pas devant.", correct: false }
        ],
        explanation: "Le contrôle visuel est la seule façon de garantir que l'aile est prête à voler avant de se retourner/décoller."
    },
    {
        id: "bi_pilotage_10",
        level: "BI",
        theme: "Pilotage",
        question: "Quel est le risque principal si vous volez avec trop de frein en permanence ?",
        choices: [
            { text: "Vous êtes proche du décrochage et l'aile est instable.", correct: true },
            { text: "Vous allez monter plus haut.", correct: false },
            { text: "Vous allez voler plus vite.", correct: false }
        ],
        explanation: "Le surpilotage ou le vol aux basses vitesses est une cause majeure d'accident."
    },

    {
        id: "bi_prevol_1",
        level: "BI",
        theme: "Prévol",
        question: "Quels sont les trois points de fermeture vitaux de la sellette à vérifier ?",
        choices: [
            { text: "Les deux cuissardes et la ventrale.", correct: true },
            { text: "Le casque, les gants et la radio.", correct: false },
            { text: "La poche parachute, le sac et la veste.", correct: false }
        ],
        explanation: "Oublier les cuissardes peut être fatal (chute au décollage). C'est le cœur de la check-list."
    },
    {
        id: "bi_prevol_2",
        level: "BI",
        theme: "Prévol",
        question: "Quand doit-on s'accrocher à la voile (élévateurs) ?",
        choices: [
            { text: "Uniquement APRÈS s'être correctement attaché dans la sellette (cuissardes).", correct: true },
            { text: "Avant de mettre la sellette pour gagner du temps.", correct: false },
            { text: "L'ordre n'a aucune importance.", correct: false }
        ],
        explanation: "Cela évite de se retrouver connecté à une voile qui décolle alors que vous n'êtes pas attaché à la sellette."
    },
    {
        id: "bi_prevol_3",
        level: "BI",
        theme: "Prévol",
        question: "Vous détectez un tour de sellette (twist) juste après avoir décollé des pieds. Que faites-vous ?",
        choices: [
            { text: "Je m'arrête immédiatement si je suis encore au sol (Stop !).", correct: true },
            { text: "Je décolle quand même et j'essaierai de détwister en l'air.", correct: false },
            { text: "Ce n'est pas grave, ça volera quand même.", correct: false }
        ],
        explanation: "Un twist bloque les commandes et empêche le pilotage. Si vous êtes au sol, il faut tout arrêter."
    },
    {
        id: "bi_prevol_4",
        level: "BI",
        theme: "Prévol",
        question: "Le port du casque est-il obligatoire pour voler ?",
        choices: [
            { text: "Il est obligatoire en école et fortement recommandé ensuite.", correct: true },
            { text: "Il est totalement facultatif.", correct: false },
            { text: "Uniquement pour la compétition.", correct: false }
        ],
        explanation: "C'est un élément de sécurité passive indispensable."
    },
    {
        id: "bi_prevol_5",
        level: "BI",
        theme: "Prévol",
        question: "Lors de la prévol, que vérifiez-vous sur les maillons reliant la voile à la sellette ?",
        choices: [
            { text: "Qu'ils sont correctement fermés (vis serrée ou clip verrouillé).", correct: true },
            { text: "Qu'ils sont propres.", correct: false },
            { text: "Qu'ils sont de la même couleur.", correct: false }
        ],
        explanation: "Un maillon ouvert peut s'ouvrir sous charge ou casser par déformation."
    },
    {
        id: "bi_prevol_6",
        level: "BI",
        theme: "Prévol",
        question: "En quoi consiste la prévol de la voile au sol ?",
        choices: [
            { text: "Vérifier le démêlage, l'état du tissu (pas de déchirure) et que le bord d'attaque est ouvert.", correct: true },
            { text: "Vérifier la marque de la voile.", correct: false },
            { text: "La replier pour voir si elle rentre dans le sac.", correct: false }
        ],
        explanation: "Une clé dans le suspentage ou une déchirure peut entraîner un incident grave au décollage."
    },
    {
        id: "bi_prevol_7",
        level: "BI",
        theme: "Prévol",
        question: "Quel est le contrôle radio essentiel avant le vol ?",
        choices: [
            { text: "Vérifier qu'elle est allumée, sur la bonne fréquence, avec du volume et de la batterie.", correct: true },
            { text: "Vérifier qu'elle est bien au fond du sac.", correct: false },
            { text: "Vérifier qu'elle capte la radio FM.", correct: false }
        ],
        explanation: "La radio est un outil de sécurité (guidage, secours). Elle doit être opérationnelle."
    },
    {
        id: "bi_prevol_8",
        level: "BI",
        theme: "Prévol",
        question: "Avant de gonfler votre voile, que devez-vous vérifier dans l'espace aérien ?",
        choices: [
            { text: "Qu'aucun autre aéronef n'est en approche pour atterrir ou passer devant le déco.", correct: true },
            { text: "Rien, celui qui est au sol a la priorité.", correct: false },
            { text: "La couleur des nuages.", correct: false }
        ],
        explanation: "La règle 'voir et éviter' commence au sol. Ne coupez pas la route à quelqu'un en l'air."
    },
    {
        id: "bi_prevol_9",
        level: "BI",
        theme: "Prévol",
        question: "Que faire des sangles de compression et des éléments pendants du sac/sellette ?",
        choices: [
            { text: "Tout ranger et sécuriser pour éviter qu'ils ne s'accrochent ou ne battent au vent.", correct: true },
            { text: "Les laisser pendre, ça ne gêne pas.", correct: false },
            { text: "Les couper.", correct: false }
        ],
        explanation: "Une sangle qui pend peut s'accrocher au sol lors de la course ou gêner l'installation."
    },
    {
        id: "bi_prevol_10",
        level: "BI",
        theme: "Prévol",
        question: "Quel est le contrôle visuel à faire sur la poignée du parachute de secours ?",
        choices: [
            { text: "Vérifier que les goupilles sont bien en place et la poignée accessible.", correct: true },
            { text: "Tirer dessus pour voir si ça vient.", correct: false },
            { text: "Vérifier la date de pliage.", correct: false }
        ],
        explanation: "Une poignée mal positionnée peut conduire à une ouverture intempestive ou à une impossibilité de tirer le secours."
    },

    {
        id: "bi_matos_1",
        level: "BI",
        theme: "Matériel",
        question: "Quel est le rôle d'un airbag ou d'un mousse-bag sous la sellette ?",
        choices: [
            { text: "Absorber une partie de l'énergie en cas d'impact au sol.", correct: true },
            { text: "Améliorer le confort en vol.", correct: false },
            { text: "Servir de lest pour alourdir le pilote.", correct: false }
        ],
        explanation: "C'est une protection passive essentielle pour protéger la colonne vertébrale."
    },
    {
        id: "bi_matos_2",
        level: "BI",
        theme: "Matériel",
        question: "Que signifie l'homologation EN-A pour une voile ?",
        choices: [
            { text: "C'est une voile école avec un haut niveau de sécurité passive.", correct: true },
            { text: "C'est une voile de compétition très performante.", correct: false },
            { text: "C'est une voile d'acrobatie.", correct: false }
        ],
        explanation: "Les voiles EN-A pardonnent beaucoup d'erreurs de pilotage et rouvrent seules après fermeture."
    },
    {
        id: "bi_matos_3",
        level: "BI",
        theme: "Matériel",
        question: "Quelle est l'action mécanique de l'accélérateur sur la voile ?",
        choices: [
            { text: "Il tire sur les élévateurs avant (A) pour diminuer l'incidence.", correct: true },
            { text: "Il freine la voile pour aller plus vite.", correct: false },
            { text: "Il tire sur les élévateurs arrière (C).", correct: false }
        ],
        explanation: "En diminuant l'incidence, on augmente la vitesse sur trajectoire, mais on rend la voile plus sensible aux fermetures."
    },
    {
        id: "bi_matos_4",
        level: "BI",
        theme: "Matériel",
        question: "Quelle partie de la voile est soutenue par les suspentes A ?",
        choices: [
            { text: "Le bord d'attaque (l'avant de l'aile).", correct: true },
            { text: "Le bord de fuite (l'arrière de l'aile).", correct: false },
            { text: "Le milieu de l'aile uniquement.", correct: false }
        ],
        explanation: "Les A sont vitaux pour maintenir l'ouverture des caissons face au vent relatif."
    },
    {
        id: "bi_matos_5",
        level: "BI",
        theme: "Matériel",
        question: "Sur quelle partie de l'aile agissent les commandes de frein ?",
        choices: [
            { text: "Sur le bord de fuite (l'arrière).", correct: true },
            { text: "Sur le bord d'attaque.", correct: false },
            { text: "Sur les stabilos uniquement.", correct: false }
        ],
        explanation: "Les freins déforment l'arrière du profil pour augmenter la traînée et la portance localement."
    },
    {
        id: "bi_matos_6",
        level: "BI",
        theme: "Matériel",
        question: "À quelle fréquence est-il recommandé de faire réviser sa voile ?",
        choices: [
            { text: "Tous les ans ou toutes les 100 heures de vol.", correct: true },
            { text: "Jamais, tant qu'elle vole.", correct: false },
            { text: "Uniquement quand le tissu se déchire.", correct: false }
        ],
        explanation: "Le calage des suspentes bouge et la porosité du tissu augmente avec le temps (UV, humidité)."
    },
    {
        id: "bi_matos_7",
        level: "BI",
        theme: "Matériel",
        question: "Quelle norme doit respecter un casque de parapente ?",
        choices: [
            { text: "La norme EN 966 (Sports Aériens).", correct: true },
            { text: "Une norme de casque de vélo suffit.", correct: false },
            { text: "Une norme de casque de chantier.", correct: false }
        ],
        explanation: "Cette norme teste la résistance à la pénétration (rochers pointus) et l'absorption des chocs spécifiques."
    },
    {
        id: "bi_matos_8",
        level: "BI",
        theme: "Matériel",
        question: "Quelle est la particularité de la propagation des ondes radio VHF ?",
        choices: [
            { text: "Elles se propagent en ligne directe (portée à vue).", correct: true },
            { text: "Elles traversent les montagnes.", correct: false },
            { text: "Elles ont une portée limitée à 100 mètres.", correct: false }
        ],
        explanation: "Si vous êtes derrière une montagne, vous ne capterez pas. En l'air, la portée est excellente."
    },
    {
        id: "bi_matos_9",
        level: "BI",
        theme: "Matériel",
        question: "À quoi sert le quadrillage 'Ripstop' sur le tissu des parapentes ?",
        choices: [
            { text: "À empêcher la propagation d'une déchirure.", correct: true },
            { text: "À rendre le tissu imperméable.", correct: false },
            { text: "À faire joli.", correct: false }
        ],
        explanation: "C'est le fil plus épais qui forme des petits carrés. Si le tissu accroche, la déchirure s'arrête au carré suivant."
    },
    {
        id: "bi_matos_10",
        level: "BI",
        theme: "Matériel",
        question: "Comment choisir la taille de sa voile ?",
        choices: [
            { text: "En fonction de son Poids Total Volant (Pilote + Matériel).", correct: true },
            { text: "En fonction de sa taille en hauteur.", correct: false },
            { text: "En prenant la même que les copains.", correct: false }
        ],
        explanation: "Il faut être dans la fourchette de poids homologuée pour que la voile réagisse comme prévu."
    }
];
