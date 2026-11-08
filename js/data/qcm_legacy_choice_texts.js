/**
 * DONNEES - Anciens libellés des choix du QCM, pour retrouver un choix enregistré avant une correction.
 *
 * js/data/qcm_ffvl.csv suit jruffet/qcmffvl mot pour mot. Quand jruffet corrige un libellé (orthographe,
 * grammaire, unités), un choix enregistré sous son ancien texte (ancien format de l'historique d'examens,
 * export de sauvegarde, copie cloud d'un autre appareil) ne se retrouve plus par son texte. Cette table
 * donne, par question, la position (ordre du CSV, qui n'a pas changé) de chaque ancien libellé.
 * Générée en comparant la copie du 2026-02-11 au commit fb5e183 de jruffet (2026-04-22).
 * À compléter à chaque resynchronisation qui change un libellé de choix.
 */

export const LEGACY_CHOICE_TEXTS = Object.freeze({
    A47M: Object.freeze({
        "+22° à 500m / +18° à 1000m d'altitude": 0,
        "-2° à 500m / -10° à 1200 m d'altitude": 1,
        "+18° à 500m / +22° à 1000m d'altitude": 2,
    }),
    A76M: Object.freeze({
        'est toujours, dés le premier jour, favorable pour le vol libre': 0,
    }),
    A7B: Object.freeze({
        'cirrostratus et nimbo stratus': 1,
    }),
    E75T: Object.freeze({
        'le facteur de charge maximale recommandé est de 1,6': 0,
    }),
    E78M: Object.freeze({
        "d'une prise vitesse de l'aile qui cherche à revoler": 1,
    }),
    E81B: Object.freeze({
        'à la vitesse de taux de chute mini': 0,
    }),
    F11BM: Object.freeze({
        'Votre état de fatigue physique et mental du jour': 0,
    }),
    F15VBM: Object.freeze({
        "Elle n'a aucun effet": 0,
        'Elle améliore la concentration': 1,
        'Elle peut conduire à des décisions hâtives': 2,
        'Elle augmente la confiance en soi': 3,
    }),
    F21VBM: Object.freeze({
        "l'indifférence": 2,
        "l'humour": 3,
    }),
    F28V: Object.freeze({
        'Les prise de décisions impulsives': 2,
    }),
    G15M: Object.freeze({
        "de caractère instable aérodynamiquement s'il utilise un profil reflexé": 3,
    }),
    G35M: Object.freeze({
        "une brutale abattée dissymétrique suivi d'une fermeture": 2,
    }),
    H14V: Object.freeze({
        "l'aile réalise d'elle-même en majeure partie le poussé utile au virage ; la barre de contrôle lâchée est en position avancée par rapport à la ligne droite": 0,
        "à inclinaison faible et moyenne, beaucoup d'ailes ne réclament pas de poussé additionnel pour être au taux de chute mini, si elles sont réglées proches du taux de chute mini en ligne droite": 2,
    }),
    L2B: Object.freeze({
        "envisager de l'aérer le replier et le reconditionner au moins 1 fois par an": 0,
    }),
    L4B: Object.freeze({
        'demande de réfléchir à la direction, la puissance et la rapidité du geste de lancé': 3,
    }),
    L63T: Object.freeze({
        "n'est pas jamais nécessaire": 2,
    }),
    L86T: Object.freeze({
        'peut comporter une drisse en corde dynamique de diamètre 6 à 10 m pour absorber les chocs': 3,
    }),
    N34M: Object.freeze({
        "d'une radio VHF calée sur la fréquence 143,987.5 Mhz": 3,
    }),
    N46M: Object.freeze({
        "je m'assure que la chaîne « parachute & pod & poignée d'extraction et container extérieur » sont compatibles": 0,
    }),
    N49M: Object.freeze({
        "le conditionnement du parachute dans la sellette est un point récurent d'erreurs pouvant entraver son fonctionnement": 1,
    }),
    N52B: Object.freeze({
        "peut envisager de faire l'essaie d'une voile classée en « D »": 1,
        "peut envisager de faire l'essaie un prototype en air calme": 2,
    }),
    P16BM: Object.freeze({
        'sont mises en place pour protéger la zone de reproduction de rapaces': 0,
    }),
    P1V: Object.freeze({
        "est déterminé en France par l'Etat": 3,
    }),
    P4BM: Object.freeze({
        'une zone coeur à statut de protection fort': 0,
    }),
    R19M: Object.freeze({
        "le protége de l'oxydation": 2,
    }),
    S100B: Object.freeze({
        'est un produit fédéral permettant aux club de mieux accueillir et aider les nouveaux pilotes': 0,
    }),
    S108V: Object.freeze({
        '3500m (FL115)': 2,
    }),
    S10M: Object.freeze({
        'sont des diplômes Etat (Ministère Jeunesse & Sports) construits en collaboration avec la FFVL': 1,
    }),
    S119B: Object.freeze({
        'Le FL 100 ou 1000ft surface en haute montagne': 2,
    }),
    S121B: Object.freeze({
        "Oui, mais il faut que je respecte le circuit d'aérodrome": 1,
    }),
    S124B: Object.freeze({
        "L'anticollision n'est jamais assurée dans les zones d'entrainement militaires": 0,
    }),
    S126B: Object.freeze({
        "La carte au 1/500 000 suffit amplement pour voler uniquement jusqu'au FL115": 2,
    }),
    S134B: Object.freeze({
        'Il suffit de voler à moins de 500ft (150m) sol, les autres aéronefs volant au-dessus de cette limite': 2,
    }),
    S13T: Object.freeze({
        "n'est pas couvert pas le contrat d'assurance fédéral": 3,
    }),
    S14B: Object.freeze({
        "garantit à l'élève le respects des exigences fédérales en matière d'apprentissage": 1,
    }),
    S20T: Object.freeze({
        'est coopté par la commission nationale Tracte fédérale': 1,
    }),
    S21M: Object.freeze({
        'est composé des présidents de clubs affiliés et des directeurs des OBL, représentés au prorata du nombre de leurs adhérents': 3,
    }),
    S21T: Object.freeze({
        "peut nommer un Tuteur pour aider les élèves a acquérir de l'expérience": 1,
    }),
    S22T: Object.freeze({
        'treuille dans le cadre des activités de clubs affiliés': 3,
    }),
    S27M: Object.freeze({
        'au service de la politique de la FFVL et généralement mis en soutient des commissions formation, compétition, sécurité, sites, espace aérien…': 0,
    }),
    S28T: Object.freeze({
        "peut être rémunéré pour la prestation de formation s'il n'est pas diplômé d'Etat": 1,
    }),
    S30T: Object.freeze({
        'est temporaire, liée à une formation donnée': 0,
    }),
    S35B: Object.freeze({
        "sous les 15 jours à l'assureur": 0,
        'sous les 15 jours à la FFVL': 1,
    }),
    S38T: Object.freeze({
        "n'a aucun rôle vis à vis de la sécurité des personnes au sol": 0,
    }),
    S52T: Object.freeze({
        "est équipé d'un gyrophare allumé sur le treuil lorsqu'il est en fonctionnement": 2,
    }),
    S58M: Object.freeze({
        'réservé aux aeronefs possédant certains équipements particuliers': 0,
        'applicable à tous les aeronefs, au-dessus du niveau de vol 195': 2,
    }),
    S59M: Object.freeze({
        'soit le régime IFR soit le régime VFR': 0,
    }),
    S5V: Object.freeze({
        'atteste de la capacité à voler seul en conditions calme sur site connu': 1,
    }),
    S62M: Object.freeze({
        'est autorisé dans tous les espaces aériens contrôlés': 0,
    }),
    S70T: Object.freeze({
        "celui qui l'enregistre atteste sa conforme au cahier des charges du dossier Tracté": 3,
    }),
    S72M: Object.freeze({
        '5000 m sous le FL100 8000m au-dessus': 2,
    }),
    S74B: Object.freeze({
        'rester en vol au delà de 30 min après le coucher du soleil': 2,
    }),
    S7M: Object.freeze({
        'est réservé aux élèves moniteurs et moniteurs fédéraux': 1,
    }),
    S82M: Object.freeze({
        "visibilité 5 km jusqu'au FL100 puis 8 km au-dessus et distances par rapport aux nuages de 1500m horizontalement et 300m verticalement": 2,
    }),
    S85B: Object.freeze({
        'une visibilité de 5 km sous le FL100, 8 km au-dessus et un espacement par rapport aux nuages de 300m verticalement et 1500m horizontalement': 2,
    }),
    S86M: Object.freeze({
        "imposent de ne pas survoler les zones à fortes densités de population 300 m au-dessus de l'obstacle le plus élevé dans un rayon de 600m": 0,
        "imposent généralement une limite de survol variant de 300 et 1000 m suivant les cas au-dessus d'un espace protégé (réserve naturelle, parc national, ZIT)": 2,
    }),
    S95V: Object.freeze({
        "la déclaration en mairie avec dépose d'un plan de vol": 2,
    }),
    S9M: Object.freeze({
        "est réservée au futurs moniteurs brevetés d'Etat ou brevets professionnels": 2,
    }),
    U17B: Object.freeze({
        'vous attendez en espérant que la nuée se dégage sinon vous ne décollez pas': 1,
    }),
    U35B: Object.freeze({
        'vous rapprocher dangereusement de la vitesses minimum et des risques associés': 2,
    }),
    U38B: Object.freeze({
        'la somme de vos 2 vitesse/air': 1,
    }),
    U54B: Object.freeze({
        'vous prenez de la marge/relief, volez plus lentement et augmentez votre niveau présence au pilotage': 1,
    }),
    U65V: Object.freeze({
        VRAI: 2,
    }),
    U81V: Object.freeze({
        "est dangereuse car l'appareil va faire une ressource au freinage": 2,
    }),
    W15V: Object.freeze({
        "peut nécessiter parfois d'un freinage franc et momentané": 1,
    }),
    W26V: Object.freeze({
        'en tirant les élévateurs avants': 1,
    }),
    W2V: Object.freeze({
        'nécessite une adaptation progressive au vide ( petits vols, vols intermédiaires, biplaces pédagogiques)': 3,
    }),
    W41B: Object.freeze({
        'vous infléchissez energiquement votre trajectoire vers la vallée malgré la demi-aile fermée': 2,
    }),
    W43B: Object.freeze({
        "c'est une erreur de pilotage, j'aurai du agir préalablement pour éviter la fermeture": 0,
    }),
    W47M: Object.freeze({
        "remonter les mains pour laisser voler l'aile ce qui n'est pas sans risque": 0,
    }),
    W72V: Object.freeze({
        'le prégonflage est possible sans vent': 3,
    }),
    W73B: Object.freeze({
        "je ne croise pas mes commandes, je les prends en main comme je l'aurais fait en étant dos à l'aile puis réuni les 2 A dans la main du côté de mon sens de rotation": 3,
    }),
    W74M: Object.freeze({
        "ne tient pas compte des modifications de calage créés par l'utilisation de l'accélérateur": 0,
    }),
    W85B: Object.freeze({
        "vous faite symétriquement des tours de frein en dosant leur nombre pour stabiliser l'ensemble": 1,
    }),
    W8B: Object.freeze({
        "vous utilisez l'accélérateur dés que possible pour pouvoir vous éloigner du relief": 2,
    }),
    X15V: Object.freeze({
        "l'aile accélère jusqu'a la vitesse maximale": 1,
    }),
    X1V: Object.freeze({
        'vous utilisez les ailes des années 70 beaucoup plus sures à ce niveau': 1,
    }),
    X21B: Object.freeze({
        'a une vitesse plus élevée que le régime de vol finesse/maximum': 2,
        'a une vitesse moins élevée que le régime de vol finesse/maximum': 3,
    }),
    X2V: Object.freeze({
        'par le fabriquant ou le revendeur': 0,
        'a défaut du professionnel concerné, par un pilote habitué une machine de même niveau': 2,
    }),
    X30B: Object.freeze({
        "en fin de finale, s'il y a du vent pour être sûr de « rentrer »": 0,
        "lors de son approche et avant l'étape de base": 1,
        'en finale si nécessaire': 2,
    }),
    X35B: Object.freeze({
        "j'envisage le posé sur les roulettes avec le drag chute si je me sent très fatigué": 1,
    }),
});
