/**
 * DATA - Dictionnaire des acronymes et sigles aéronautiques du vol libre (FFVL)
 * Utilisé pour enrichir les explications et questions du QCM avec des définitions claires et immédiates.
 * Format standard : [Mots entiers / Code Q (mnémo)] : [Explication détaillée].
 */

export const ACRONYMS_DATA = Object.freeze({
    // --- Calages et altimétrie ---
    QNH: 'Code Q (mnémo : Nautical Height) : Calage altimétrique ramené au niveau moyen de la mer (donne l’altitude vraie, affiche l’altitude topographique au décollage).',
    QFE: 'Code Q (mnémo : Field Elevation) : Calage altimétrique calé sur la pression locale du terrain (donne la hauteur au-dessus du sol, affiche 0 mètre sur place).',
    QNE: 'Code Q (mnémo : Normal Elevation) : Calage altimétrique sur l’atmosphère standard (1 013,25 hPa) pour voler en niveau de vol (FL - Flight Level).',
    QFU: 'Code Q : Orientation magnétique de la piste d’atterrissage en dizaines de degrés (ex. QFU 27 = piste orientée au cap 270°).',
    QDM: 'Code Q (mnémo : Direction Magnetic) : Cap magnétique à suivre sans vent vers une balise ou station radio.',
    FL: 'Flight Level : Niveau de vol en centaines de pieds, calé à la pression standard 1 013,25 hPa (ex. FL 115 = 11 500 pieds standard).',
    AMSL: 'Above Mean Sea Level : Altitude mesurée au-dessus du niveau moyen de la mer.',
    ASFC: 'Above Surface : Hauteur mesurée au-dessus de la surface du sol ou de l’eau.',
    AGL: 'Above Ground Level : Hauteur mesurée au-dessus du sol survolé.',
    hPa: 'Hectopascal : Unité de mesure de la pression atmosphérique (1 hPa = 100 Pa ; pression standard au niveau de la mer = 1 013,25 hPa).',

    // --- Espaces aériens et réglementation ---
    TMA: 'Terminal Maneuvering Area : Région de contrôle terminale (espace aérien contrôlé entourant un ou plusieurs aérodromes).',
    CTR: 'Control Zone : Zone de contrôle d’aérodrome (espace contrôlé protégeant les trajectoires de décollage et d’atterrissage près du sol).',
    AWY: 'Airway : Voie aérienne (couloir de navigation contrôlé pour les vols de croisière).',
    LTA: 'Lower Traffic Area : Espace aérien inférieur contrôlé.',
    VFR: 'Visual Flight Rules : Règles de vol à vue (régime de vol obligatoire pour le parapente et le vol libre).',
    IFR: 'Instrument Flight Rules : Règles de vol aux instruments (sans visibilité, pour aviation commerciale et militaire).',
    VMC: 'Visual Meteorological Conditions : Conditions météorologiques de vol à vue (visibilité minimale et distances aux nuages requises en VFR).',
    NOTAM: 'Notice to Airmen : Avis aux navigants aériens (publication officielle signalant des modifications ou restrictions temporaires de l’espace aérien).',
    AZBA: 'Activité des Zones de Basse Altitude : Carte d’information sur l’activité en temps réel du Réseau Très Basse Altitude militaire (RTBA).',
    RTBA: 'Réseau Très Basse Altitude : Réseau de couloirs militaires réservé aux vols à grande vitesse et très basse altitude (interdit en vol libre lorsqu’il est actif).',
    SIA: 'Service de l’Information Aéronautique : Organisme officiel français publiant les cartes aéronautiques, l’AIP, les SUP AIP et les NOTAM.',
    AIP: 'Aeronautical Information Publication : Publication d’information aéronautique (recueil permanent des règles, espaces et aérodromes).',
    eAIP: 'Electronic Aeronautical Information Publication : Version électronique en ligne de l’AIP accessible sur le site du SIA.',
    'SUP AIP':
        'Supplément à l’Aeronautical Information Publication : Document publiant les modifications temporaires de l’espace aérien (création de zones temporaires, exercices militaires, travaux).',
    VAC: 'Visual Approach Chart : Carte d’approche et d’atterrissage à vue pour aérodrome (tours de piste, fréquences radio et consignes).',
    ZSM: 'Zone de Sensibilité Majeure : Zone protégée pour préserver la nidification et la reproduction de la faune sauvage (notamment les grands rapaces).',
    ZIT: 'Zone Interdite Temporaire : Espace aérien interdit à tout aéronef non autorisé (sites sensibles, centrales nucléaires, événements).',
    ZRT: 'Zone Réglementée Temporaire : Espace aérien soumis à des conditions particulières de pénétration (contact radio, créneaux horaires).',
    APPB: 'Arrêté Préfectoral de Protection de Biotope : Arrêté préfectoral de protection de la faune ou flore interdisant ou limitant le survol.',
    APPHN: 'Arrêté Préfectoral de Protection des Habitats Naturels : Arrêté préfectoral protégeant un habitat naturel.',

    // --- Matériel, pilotage et sécurité ---
    PTV: 'Poids Total Volant : Masse totale au décollage (pilote habillé + aile + sellette + parachute de secours + tous les accessoires).',
    PTS: 'Poids Total au Saut : Masse totale suspendue sous le parachute de secours lors de son ouverture.',
    PUL: 'Planeur Ultra-Léger : Catégorie réglementaire comprenant les parapentes et deltaplanes (aéronefs non motorisés sans immatriculation requise).',
    SIV: 'Simulation d’Incidents de Vol : Stage de pilotage et de sécurité au-dessus de l’eau encadré par des moniteurs formés.',
    EPI: 'Équipement de Protection Individuelle : Équipements de sécurité du pilote (casque homologué, sellette, parachute de secours).',
    CEN: 'Comité Européen de Normalisation : Organisme définissant les normes européennes d’homologation des ailes de parapente (EN 926-1 et EN 926-2).',
    ENA: 'Norme Européenne catégorie A : Aile de parapente à sécurité passive maximale (destinée à l’apprentissage et aux débutants).',
    ENB: 'Norme Européenne catégorie B : Aile de parapente à bonne sécurité passive pour la progression et le cross.',
    ENC: 'Norme Européenne catégorie C : Aile de parapente de performance destinée aux pilotes confirmés et expérimentés.',
    END: 'Norme Européenne catégorie D : Aile de parapente de haute performance réservée aux pilotes experts et compétiteurs.',
    daN: 'Décanewton : Unité de force valant 10 newtons (environ la force exercée par une masse de 1 kg).',

    // --- Fédérations, brevets et organismes ---
    FFVL: 'Fédération Française de Vol Libre : Fédération délégataire de l’État pour le parapente, delta, kite et speed-riding.',
    BPC: 'Brevet de Pilote Confirmé : 3ème niveau du passeport de pilote FFVL (autonomie complète, cross, compétition).',
    BP: 'Brevet de Pilote : 2ème niveau du passeport FFVL (autonomie en conditions thermiques variées).',
    BPI: 'Brevet de Pilote Initial : 1er niveau du passeport FFVL (autonomie sur site connu en conditions calmes).',
    OACI: 'Organisation de l’Aviation Civile Internationale : Agence de l’ONU régissant les standards de l’aviation civile mondiale.',
    DGAC: 'Direction Générale de l’Aviation Civile : Autorité française chargée de la sécurité et de la régulation de l’aviation.',
    DSAC: 'Direction de la Sécurité de l’Aviation Civile : Branche de contrôle et de surveillance de la DGAC.',
    SAMU: 'Service d’Aide Médicale Urgente : Service médical d’urgence joignable au 15 ou au 112 en cas d’accident.',
    RC: 'Responsabilité Civile : Assurance couvrant les dommages corporels ou matériels causés aux tiers.',
    RCA: 'Responsabilité Civile Aérienne : Assurance aérienne obligatoire pour la pratique du vol libre.',
    UTC: 'Universal Time Coordinated : Temps Universel Coordonné (heure internationale de référence en aviation ; UTC+1 en hiver, UTC+2 en été en France).',
    VHF: 'Very High Frequency : Très haute fréquence radio (la fréquence sécurité du vol libre FFVL est 143,9875 MHz).',
    GPS: 'Global Positioning System : Système mondial de positionnement par satellites.',
    IGN: 'Institut National de l’Information Géographique et Forestière : Éditeur des cartes topographiques et aéronautiques OACI 1/500 000.',
    ULM: 'Ultra-Léger Motorisé : Aéronef ultra-léger muni d’un moteur.',
});
