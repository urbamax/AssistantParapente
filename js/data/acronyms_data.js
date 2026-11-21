/**
 * DATA - Sigles du vol libre expliqués dans les explications du QCM (infobulle, js/views/quiz_explanation.js).
 *
 * Uniquement dans les explications : jamais dans le texte d'une question ni dans ses choix, pour ne pas
 * souffler la réponse. Seuls les sigles qui apparaissent réellement dans les explications sont ici, avec
 * le sens qu'ils y ont (ex. PTS = prise de terrain en S, pas un poids).
 *
 * Chaque définition est vérifiée sur une page d'un document de la bibliothèque : `source.course` est la
 * clé du cours dans js/data/courses_data.js, `source.page` la page du PDF où le sigle est expliqué.
 * Un sigle ajouté ici doit avoir sa source (tests/data/acronyms_data.test.js le vérifie).
 */

const ESPACES_AERIENS = 'general/20240409-ffvl-formation-espacesaeriens';
const REGLEMENTATION = 'brevet-de-pilote---bleu/affiches-pedagogiques-a3/12-reglementation2025/12-reglementation2025';
const BPC_MANUEL = 'brevet-de-pilote-confirme---marron/bpc--pp---delta--v-2025-may-';
const METEO_FRANCE = 'general/meteo/meteofrance-guide-aviation-2024';
const CYCLE_1 = 'brevet-initial---vert/livrets-pp-2025/cycle1-2025web/cycle1-2025web';
const CYCLE_2 = 'brevet-de-pilote---bleu/livrets-pp-2025/cycle2-2025web/cycle2-2025web';
const INITIATION = 'brevet-initial---vert/livrets-pp-2025/initiation-2025-web/initiation-2025-web';
const TRACTE = 'treuil/ffvl-dossiertracte-2023';

/** @type {Readonly<Record<string, Readonly<{ def: string, source: Readonly<{ course: string, page: number }> }>>>} */
export const ACRONYMS_DATA = Object.freeze({
    // --- Calages et altimétrie ---
    QNH: {
        def: 'Calage de l’altimètre sur la pression ramenée au niveau de la mer : l’altimètre indique alors une altitude. Les codes Q sont des codes radio, pas des sigles.',
        source: { course: METEO_FRANCE, page: 32 },
    },
    QFE: {
        def: 'Calage de l’altimètre sur la pression au niveau d’un terrain : l’altimètre indique la hauteur au-dessus de ce terrain (0 une fois posé).',
        source: { course: METEO_FRANCE, page: 32 },
    },
    QNE: {
        def: 'Indication de l’altimètre calé sur la pression standard de 1 013,25 hPa : c’est sur ce calage qu’on lit les niveaux de vol (FL).',
        source: { course: BPC_MANUEL, page: 137 },
    },
    FL: {
        def: 'Flight Level, niveau de vol : altitude lue avec l’altimètre calé sur 1 013,25 hPa, en centaines de pieds (FL 65 = 6 500 ft, environ 1 950 m).',
        source: { course: BPC_MANUEL, page: 80 },
    },
    AMSL: {
        def: 'Above Mean Sea Level : au-dessus du niveau moyen de la mer. Indique une altitude.',
        source: { course: BPC_MANUEL, page: 80 },
    },
    ASFC: {
        def: 'Above Surface : au-dessus de la surface, sol ou eau. Indique une hauteur.',
        source: { course: BPC_MANUEL, page: 80 },
    },
    AGL: {
        def: 'Above Ground Level : au-dessus du sol survolé. Indique une hauteur.',
        source: { course: BPC_MANUEL, page: 80 },
    },
    hPa: {
        def: 'Hectopascal, unité de pression atmosphérique. Dans l’atmosphère standard de l’OACI, la pression au niveau de la mer vaut 1 013,25 hPa, à 15 °C.',
        source: { course: BPC_MANUEL, page: 118 },
    },

    // --- Espaces aériens et information aéronautique ---
    TMA: {
        def: 'Terminal Manoeuvring Area, région de contrôle terminale : volume contrôlé d’approche et d’attente des avions, entre les voies aériennes (AWY) et la zone de contrôle (CTR) d’un aérodrome.',
        source: { course: BPC_MANUEL, page: 80 },
    },
    CTR: {
        def: 'Control Zone, zone de contrôle : espace contrôlé qui entoure un aérodrome et part du sol.',
        source: { course: ESPACES_AERIENS, page: 8 },
    },
    AWY: {
        def: 'Airway, voie aérienne : couloir de circulation du trafic aérien.',
        source: { course: BPC_MANUEL, page: 79 },
    },
    LTA: {
        def: 'Lower Traffic Area : partie de l’espace aérien inférieur au-dessus du FL 115 (environ 3 450 m), interdite au vol libre sauf dans certaines LTA de classe E.',
        source: { course: ESPACES_AERIENS, page: 6 },
    },
    VFR: {
        def: 'Visual Flight Rules, règles du vol à vue : le régime auquel sont soumis les parapentes et les deltas.',
        source: { course: REGLEMENTATION, page: 1 },
    },
    IFR: {
        def: 'Instrument Flight Rules, règles du vol aux instruments : le régime d’autres catégories d’aéronefs, par opposition au vol à vue.',
        source: { course: REGLEMENTATION, page: 1 },
    },
    VMC: {
        def: 'Visual Meteorological Conditions, conditions météorologiques de vol à vue : visibilité et distances aux nuages minimales à respecter en VFR.',
        source: { course: ESPACES_AERIENS, page: 5 },
    },
    NOTAM: {
        def: 'NOTice To AirMen, avis aux navigants : message qui annonce notamment l’activation de certaines zones.',
        source: { course: BPC_MANUEL, page: 135 },
    },
    AZBA: {
        def: 'Activation des zones basse altitude : publication du SIA qui indique quand les zones du réseau très basse altitude (RTBA) sont actives.',
        source: { course: ESPACES_AERIENS, page: 25 },
    },
    RTBA: {
        def: 'Réseau très basse altitude : réseau de zones militaires qui maille le territoire, activé selon les besoins militaires.',
        source: { course: REGLEMENTATION, page: 1 },
    },
    SIA: {
        def: 'Service de l’information aéronautique : l’organe officiel qui diffuse en France toute l’information aéronautique (cartes, AIP, SUP AIP, NOTAM, message AZBA).',
        source: { course: REGLEMENTATION, page: 1 },
    },
    AIP: {
        def: 'Aeronautical Information Publication, publication d’information aéronautique : le recueil officiel diffusé par le SIA.',
        source: { course: REGLEMENTATION, page: 1 },
    },
    'SUP AIP': {
        def: 'Supplément à l’AIP : information aéronautique temporaire, publiée sur le site du SIA.',
        source: { course: BPC_MANUEL, page: 77 },
    },
    VAC: {
        def: 'Visual Approach Chart, carte d’approche à vue : les environs d’un aérodrome et ses renseignements détaillés.',
        source: { course: BPC_MANUEL, page: 77 },
    },
    ZIT: {
        def: 'Zone interdite temporaire : protège un site ou un événement (usine sensible, événement politique, sportif ou culturel important).',
        source: { course: REGLEMENTATION, page: 1 },
    },
    ZRT: {
        def: 'Zone réglementée temporaire : son accès est soumis à conditions pendant son activité (entraînement militaire, événement).',
        source: { course: REGLEMENTATION, page: 1 },
    },

    // --- Milieux naturels ---
    ZSM: {
        def: 'Zone de sensibilité majeure : zone saisonnière qui protège la reproduction d’espèces sensibles, souvent des rapaces, mise à jour chaque année.',
        source: { course: CYCLE_2, page: 12 },
    },
    APPB: {
        def: 'Arrêté préfectoral de protection de biotope : il peut interdire ou limiter le survol d’un milieu pour protéger la faune ou la flore.',
        source: { course: CYCLE_2, page: 12 },
    },
    APPHN: {
        def: 'Arrêté préfectoral de protection des habitats naturels : même principe, pour un habitat naturel.',
        source: { course: CYCLE_2, page: 12 },
    },

    // --- Aéronef, pilotage et matériel ---
    PUL: {
        def: 'Planeur ultraléger : la catégorie d’aéronefs des parapentes et des deltas, soumise aux règles du vol à vue.',
        source: { course: REGLEMENTATION, page: 1 },
    },
    ULM: {
        def: 'Ultraléger motorisé : un aéronef ultraléger muni d’un moteur ; une aile de vol libre équipée d’un moteur en relève.',
        source: { course: TRACTE, page: 6 },
    },
    PTV: {
        def: 'Poids total volant : somme des poids du pilote, de l’aile, de la sellette et de tout ce qui est embarqué.',
        source: {
            course: 'brevet-de-pilote---bleu/affiches-pedagogiques-a3/01-desequilibre-du-vol2021/01-desequilibre-du-vol2021',
            page: 1,
        },
    },
    PTS: {
        def: 'Prise de terrain en S : approche de l’atterrissage en S, qui exige que l’espace sous le vent du terrain soit dégagé de tout obstacle.',
        source: { course: INITIATION, page: 17 },
    },
    SIV: {
        def: 'Simulation d’incidents de vol : stage d’entraînement aux incidents de vol et à leur maîtrise.',
        source: { course: 'general/materiel/macpara-eden6-manuel', page: 15 },
    },
    CEN: {
        def: 'Comité européen de normalisation : il publie les normes européennes, dont l’EN 926 (1 et 2) qui homologue les parapentes.',
        source: { course: 'general/ffvl-textes/charte-efvl-2026', page: 4 },
    },
    ENA: {
        def: 'Aile homologuée en classe A de la norme EN 926-2. Les classes (A, B-, B+…) ne réagissent pas de la même façon aux incidents.',
        source: {
            course: 'brevet-de-pilote-confirme---marron/fiche-eval-2025/2025-fiche-cval-bpc-4-modules/2025-fiche-cval-bpc-4-modules',
            page: 2,
        },
    },
    ENB: {
        def: 'Aile homologuée en classe B de la norme EN 926-2 ; ENB- et ENB+ désignent le bas et le haut de cette classe, aux comportements différents.',
        source: {
            course: 'brevet-de-pilote-confirme---marron/fiche-eval-2025/2025-fiche-cval-bpc-4-modules/2025-fiche-cval-bpc-4-modules',
            page: 2,
        },
    },
    daN: {
        def: 'Décanewton : 10 newtons, à peu près le poids d’une masse d’un kilogramme.',
        source: { course: 'general/materiel/macpara-eden6-manuel', page: 29 },
    },
    GPS: {
        def: 'Global Positioning System : système de positionnement par satellites qui donne la position (latitude, longitude, altitude).',
        source: { course: BPC_MANUEL, page: 74 },
    },
    VHF: {
        def: 'Very High Frequency, très haute fréquence : bande des radios du vol libre. La fréquence officiellement attribuée à la FFVL est 143,9875 MHz.',
        source: { course: CYCLE_1, page: 23 },
    },

    // --- Organismes, brevets, assurance et secours ---
    FFVL: {
        def: 'Fédération française de vol libre.',
        source: { course: TRACTE, page: 1 },
    },
    BPC: {
        def: 'Brevet de pilote confirmé : le brevet FFVL qui suit le brevet initial (BI) et le brevet de pilote (BP).',
        source: { course: BPC_MANUEL, page: 1 },
    },
    OACI: {
        def: 'Organisation de l’aviation civile internationale : ses règles fondent la réglementation aérienne, avec des adaptations nationales.',
        source: { course: REGLEMENTATION, page: 1 },
    },
    DGAC: {
        def: 'Direction générale de l’aviation civile : chargée par le ministère des Transports de la réglementation de l’aviation civile.',
        source: { course: INITIATION, page: 23 },
    },
    DSAC: {
        def: 'Direction de la sécurité de l’aviation civile, organisée en régions : à informer par exemple d’une activité de treuillage.',
        source: { course: TRACTE, page: 28 },
    },
    RC: {
        def: 'Responsabilité civile : l’assurance des dommages causés à des tiers.',
        source: { course: TRACTE, page: 26 },
    },
    RCA: {
        def: 'Responsabilité civile aérienne : l’assurance des dommages causés à des tiers par la pratique, que doit avoir tout pratiquant ; la licence FFVL la comprend.',
        source: {
            course: 'general/passeport-telechargement-web/2012-passeportspeed12-hd/2012-passeportspeed12-hd',
            page: 34,
        },
    },
    SAMU: {
        def: 'Service d’aide médicale urgente, joignable au 15 ; les pompiers se joignent au 18 ou au 112.',
        source: { course: TRACTE, page: 29 },
    },
    UTC: {
        def: 'Temps universel coordonné : l’heure de référence de l’aviation. En France, l’heure légale est UTC + 1 en hiver et UTC + 2 en été.',
        source: { course: REGLEMENTATION, page: 1 },
    },
});
