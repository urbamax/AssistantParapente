/**
 * Catalogue des textes fixes de index.html et des composants (header, footer), en français.
 *
 * Le texte reste dans le HTML (affichage immédiat) avec une clé data-i18n / data-i18n-html /
 * data-i18n-<attribut> ; tests/views/static_texts.test.js vérifie que les deux sont identiques.
 * data-i18n-html : texte mêlé de balises (liens, gras), conservé tel quel.
 *
 * Ce fichier n'est PAS chargé par l'application (elle affiche le HTML tel quel, 63 Ko de texte qu'elle
 * ne lit jamais) : il sert aux tests et à une future traduction (js/utils/i18n_dom.js). Les quelques
 * clés que le code lit vraiment sont aussi dans FR.html (js/i18n/fr.js), un test vérifie qu'elles
 * sont identiques.
 */
export const FR_HTML = Object.freeze({
    qcmSetupScreen: Object.freeze({
        theorie: 'THÉORIE',
        vousNEtesPasConnecte: "Vous n'êtes pas connecté",
        vosResultatsDExamensSont:
            'Vos résultats d\'examens sont stockés localement. <a href="#" data-action="FirebaseAuthopenAuthModal" data-prevent-default style="color: var(--accent-orange); text-decoration: underline" >Créez un compte (100% gratuit)</a > pour synchroniser votre progression et ne jamais la perdre.',
        entrainement: 'Entraînement',
        examen: 'Examen',
        revision: 'Révision',
        perfectionnement: 'Perfectionnement',
        modeEntrainementChoisissez:
            'Mode Entraînement : choisissez votre thème et volume. Correction immédiate après chaque question.',
        nombreDeQuestions: 'NOMBRE DE QUESTIONS',
        tout: 'TOUT',
        themeSpecifiqueOptionnel: 'THÈME SPÉCIFIQUE (OPTIONNEL)',
        tousLesThemes: 'Tous les thèmes',
        palierObjectif: 'PALIER OBJECTIF',
        commencer: 'COMMENCER',
        consulterLaBanqueDe: 'Consulter la Banque de Questions',
    }),
    qcmScreen: Object.freeze({
        modeExamen: 'MODE EXAMEN',
        chargement: 'Chargement...',
    }),
    statsScreen: Object.freeze({
        statistiques: 'STATISTIQUES',
        vousNEtesPasConnecte: "Vous n'êtes pas connecté",
        vosStatistiquesDeRevision:
            'Vos statistiques de révision sont stockées localement. <a href="#" data-action="FirebaseAuthopenAuthModal" data-prevent-default style="color: var(--accent-orange); text-decoration: underline" >Créez un compte (100% gratuit)</a > pour les synchroniser sur tous vos appareils.',
    }),
    revisionAxesScreen: Object.freeze({
        axesDeRevision: 'AXES DE RÉVISION',
    }),
    qcmBankScreen: Object.freeze({
        banqueDeQuestions: 'BANQUE DE QUESTIONS',
        placeholderRechercherParMotCle: 'Rechercher par mot-clé (ex: cumulus)...',
        tousLesThemes: 'Tous les thèmes',
        meteo: 'Météo',
        mecavol: 'Mécavol',
        materiel: 'Matériel',
        pilotage: 'Pilotage',
        reglementation: 'Réglementation',
        facteursHumains: 'Facteurs humains',
        milieuNaturel: 'Milieu naturel',
    }),
    welcomeScreen: Object.freeze({
        bienvenue: 'Bienvenue',
        assistantParapenteVousAide:
            'Assistant Parapente vous aide à choisir où voler, à tenir votre carnet de vol et à préparer la théorie du brevet.',
        quelEstVotreNiveau: 'Quel est votre niveau ?',
        ilAdapteLesQuestions:
            "Il adapte les questions et les cours. Vous pourrez le changer à tout moment en haut de l'écran.",
        ariaLabelNiveauDePilote: 'Niveau de pilote',
        brevetInitial: 'Brevet Initial',
        niveauVert: 'Niveau vert',
        brevetDePilote: 'Brevet de Pilote',
        niveauBleu: 'Niveau bleu',
        piloteConfirme: 'Pilote Confirmé',
        niveauMarron: 'Niveau marron',
        tousLesNiveaux: 'Tous les niveaux',
        parOuCommencer: 'Par où commencer ?',
        sitesDeVol: 'Sites de vol',
        meteoEtVolabiliteDes: 'Météo et volabilité des sites de vol autour de vous.',
        carteEtListeDesSites: 'Carte et liste des sites de vol autour de vous.',
        carnetDeVol: 'Carnet de vol',
        vosVolsLImportDe: "Vos vols, l'import de traces .igc et le suivi du matériel.",
        theorie: 'Théorie',
        qcmOfficielsFfvlExamens: 'QCM officiels FFVL, examens blancs et révisions.',
        bibliotheque: 'Bibliothèque',
        lesCoursEtLivrets: 'Les cours et livrets PDF officiels.',
        aucunCompteRequis:
            'Aucun compte requis : vos données restent sur cet appareil, sauf si vous vous connectez pour les synchroniser.',
    }),
    libraryScreen: Object.freeze({
        bibliotheque: 'BIBLIOTHEQUE',
        placeholderRechercherUnDossier: 'Rechercher un dossier, une affiche...',
        parCategorie: 'PAR CATÉGORIE',
        avisProprieteDocuments:
            'Ces documents appartiennent à la FFVL et à leurs auteurs. Ils sont présentés ici pour faciliter la formation des pilotes.',
    }),
    courseScreen: Object.freeze({
        retourALaBibliotheque: 'Retour à la bibliothèque',
    }),
    sitesScreen: Object.freeze({
        sitesDeVol: 'SITES DE VOL',
        rayonMaximal: 'Rayon maximal :',
        n50Km: '50 km',
        placeholderAdresseOuVille: 'Adresse ou ville (ex: Annecy)...',
        valider: 'Valider',
        titleEnregistrerCeLieu: 'Enregistrer ce lieu',
        gps: 'GPS',
        aucunPointDeReference: 'Aucun point de référence (GPS désactivé).',
        orientation: 'Orientation',
        type: 'Type',
        parametresDeCalculMeteo: 'Paramètres de calcul météo',
        modeleMeteo: 'Modèle Météo :',
        aromeMeteoFrance: 'AROME (Météo-France)',
        iconEuDwd: 'ICON-EU (DWD)',
        iconDwdGlobal: 'ICON (DWD, global)',
        ecmwfIfs: 'ECMWF (IFS)',
        gfsNoaa: 'GFS (NOAA)',
        selectionAutomatiqueOpenMeteoMultiModele: 'Sélection automatique (Open-Meteo, multi-modèles)',
        dureeDesPrevisions: 'Durée des prévisions :',
        n24Heures: '24 Heures',
        n48Heures: '48 Heures',
        n72Heures: '72 Heures',
        n5Jours: '5 Jours',
        n7Jours: '7 Jours',
        modeDeCalculDu: 'Mode de calcul du vent :',
        filtresPersonnelsChampsLibres: 'Filtres Personnels (champs libres)',
        monMaterielPlagesDes: 'Mon Matériel (plages des voiles)',
        aucuneVoileValideConfiguree: 'Aucune voile valide configurée. Retour au mode manuel.',
        limitesDeVentKmH: 'Limites de vent (km/h) :',
        ventMin: 'Vent Min',
        ventMax: 'Vent Max',
        rafalesMax: 'Rafales Max',
        placeholderRechercherUnSite: 'Rechercher un site, ville, code postal...',
        favoris: 'Favoris',
        comparer: 'Comparer',
        titleComparerMesSites: 'Comparer mes sites favoris côte-à-côte',
        heureDeVol: 'Heure de vol :',
        chargementDesPrevisions: 'Chargement des prévisions...',
        masquerLesSitesSans: 'Masquer les sites sans créneau volable dans les',
        titleRemonterEnHaut: 'Remonter en haut',
    }),
    sitesMapView: Object.freeze({
        cartographie: 'Cartographie',
        windy: 'Windy',
        meteoP: 'Météo-P.',
        pgEarth: 'PG Earth',
        paraglidable: 'Paraglidable',
        frontsIsobares: 'Fronts & Isobares',
        plus: 'Plus',
        titleCartesActives: 'Cartes actives',
        windy2: 'Windy :',
        general: 'Général',
        ouvrir: 'Ouvrir',
        meteoParapente: 'Météo-Parapente :',
        general2: 'Général',
        ouvrir2: 'Ouvrir',
        paraglidingEarth: 'Paragliding Earth :',
        general3: 'Général',
        ouvrir3: 'Ouvrir',
        paraglidable2: 'Paraglidable :',
        general4: 'Général',
        ouvrir4: 'Ouvrir',
        frontsIsobares2: 'Fronts & Isobares :',
        meteoFrance: 'Météo-France',
        ouvrir5: 'Ouvrir',
        carteInteractiveDesFronts: 'Carte Interactive des Fronts',
        meteoFranceNAutorisePasLIntegration:
            "Météo-France n'autorise pas l'intégration directe de cette carte interactive.",
        ouvrirLaCarteIsobares: 'Ouvrir la carte Isobares',
        paraglidingEarth2: 'Paragliding Earth :',
        general5: 'Général',
        ouvrir6: 'Ouvrir',
        paraglidable3: 'Paraglidable :',
        general6: 'Général',
        ouvrir7: 'Ouvrir',
        frontsIsobares3: 'Fronts & Isobares :',
        meteoFrance2: 'Météo-France',
        ouvrir8: 'Ouvrir',
        carteInteractiveDesFronts2: 'Carte Interactive des Fronts',
        meteoFranceProposeUneExcellente:
            "Météo-France propose une excellente carte interactive pour visualiser les fronts et isobares de manière détaillée.<br /><br />Le chargement direct n'étant pas autorisé par Météo-France, vous pouvez la consulter sur leur site.",
        ouvrirSurMeteoFrance: 'Ouvrir sur Météo-France',
    }),
    mapToggleFullscreen: Object.freeze({
        pleinEcran: 'Plein écran',
    }),
    conditionsStrategyPanel: Object.freeze({
        definitionDesMeilleuresConditions: 'Définition des meilleures conditions :',
        meilleuresConditions: 'Meilleures conditions',
        plusProcheGps: 'Plus proche (GPS)',
        nomAZ: 'Nom (A - Z)',
        creneauContinu: 'Créneau continu',
        demiJournee: 'Demi-journée',
        journeeComplete: 'Journée complète',
        volumeTotal: 'Volume total',
    }),
    logbookScreen: Object.freeze({
        carnetDeVol: 'CARNET DE VOL',
        ajouterUneSession: 'Ajouter une session',
        toutRecalculer: 'Tout recalculer',
        exporterEnPdf: 'Exporter en PDF',
        ajouterUnEquipement: 'Ajouter un Équipement',
        type: 'Type :',
        voile: 'Voile',
        sellette: 'Sellette',
        parachuteDeSecours: 'Parachute de Secours',
        accessoire: 'Accessoire',
        linkedRescue: 'Secours monté sur cette sellette :',
        noneOrNotApplicable: 'Aucun / Non applicable',
        marque: 'Marque :',
        choisirOuSaisie: '-- Choisir ou Saisie Libre --',
        autre: 'Autre...',
        placeholderSpecifiezLaMarque: 'Spécifiez la marque...',
        modele: 'Modèle :',
        choisirOuSaisie2: '-- Choisir ou Saisie Libre --',
        autre2: 'Autre...',
        placeholderSpecifiezLeModele: 'Spécifiez le modèle...',
        taille: 'Taille :',
        choisirOuSaisie3: '-- Choisir ou Saisie Libre --',
        autre3: 'Autre...',
        placeholderSpecifiezLaTaille: 'Spécifiez la taille...',
        couleur: 'Couleur :',
        choisirOuSaisie4: '-- Choisir ou Saisie Libre --',
        autre4: 'Autre...',
        placeholderSpecifiezLaCouleur: 'Spécifiez la couleur...',
        nomDuMaterielAuto: 'Nom du matériel (auto) :',
        placeholderExSupairBirdy: 'Ex: Supair Birdy 2 M',
        ventMinKmH: 'Vent min (km/h) :',
        ventMaxKmH: 'Vent max (km/h) :',
        dateDAchat: "Date d'achat :",
        derniereRevision: 'Dernière révision :',
        dernierPliage: 'Dernier pliage :',
        periodiciteTemps: 'Périodicité (Temps) :',
        tousLes12Mois: 'Tous les 12 mois (1 an)',
        tousLes24Mois: 'Tous les 24 mois (2 ans)',
        tousLes6Mois: 'Tous les 6 mois',
        aucunControleRequis: 'Aucun contrôle requis / Jamais',
        periodiciteHeures: 'Périodicité (Heures) :',
        nonApplicable: 'Non applicable',
        toutesLes50Heures: 'Toutes les 50 heures',
        toutesLes100Heures: 'Toutes les 100 heures',
        toutesLes150Heures: 'Toutes les 150 heures',
        toutesLes200Heures: 'Toutes les 200 heures',
        enregistrerLEquipement: "Enregistrer l'équipement",
        annuler: 'Annuler',
    }),
    common: Object.freeze({
        espaceSynchro: 'ESPACE SYNCHRO',
        theorie: 'Théorie',
        qcm: 'QCM',
        axesDeRevision: 'Axes de révision',
        biblio: 'Biblio',
        stats: 'Stats',
        sites: 'Sites',
        carnet: 'Carnet',
        titleMaterielAReviser: 'Matériel à réviser',
        historique: 'Activités',
        statistiques: 'Statistiques',
        materiel: 'Matériel',
        securite: 'Sécurité',
        urgence: 'Urgence',
        checkLists: 'Check-lists',
        maSigr: 'Ma SIGR',
        manuel: 'Manuel',
    }),
    authSetupRequiredView: Object.freeze({
        laSynchronisationEnLigne: "La synchronisation en ligne n'est pas activée sur ce déploiement.",
        pourActiverLaSynchronisation: 'Pour activer la synchronisation de vos statistiques sur tous vos appareils :',
        creezUnProjetSur: 'Créez un projet sur la console Firebase.',
        activezLAuthentificationParEmailMot:
            "Activez l'authentification par email/mot de passe et la base de données Firestore.",
        renseignezVosClesDans: 'Renseignez vos clés dans le fichier <code>js/firebase_config.js</code>.',
        basculezA: 'Basculez <code>IS_FIREBASE_ENABLED</code> à <code>true</code>.',
        consentementRequisPourLa: 'Consentement requis pour la synchronisation',
        pourCreerUnCompte:
            "Pour créer un compte et synchroniser vos statistiques, vous devez accepter le stockage de vos informations d'authentification et de vos scores sur nos serveurs sécurisés (Firebase).",
        gererMesPreferences: 'Gérer mes préférences',
    }),
    authAnonymousView: Object.freeze({
        connexion: 'Connexion',
        sInscrire: "S'inscrire",
        gratuit: 'Gratuit',
        adresseEmail: 'Adresse Email',
        placeholderPiloteEmailCom: 'pilote@email.com',
        motDePasse: 'Mot de passe',
        resterConnecte: 'Rester connecté',
        motDePasseOublie: 'Mot de passe oublié ?',
        seConnecter: 'Se connecter',
        etSansPubliciteElle: "et sans publicité. Elle vous permet de sauvegarder vos statistiques d'entraînement.",
        lInscriptionEst100Gratuite: "L'inscription est 100% gratuite",
        adresseEmail2: 'Adresse Email',
        placeholderPiloteEmailCom2: 'pilote@email.com',
        motDePasseMin: 'Mot de passe (min 6 car.)',
        confirmerLeMotDe: 'Confirmer le mot de passe',
        resterConnecte2: 'Rester connecté',
        sInscrireGratuitement: "S'inscrire gratuitement",
    }),
    authLoggedInView: Object.freeze({
        emailProtected: '[email protected]',
        compteConnecteSynchronise: 'Compte connecté & synchronisé',
        statut: 'Statut :',
        actif: 'Actif',
        derniereSynchro: 'Dernière synchro :',
        jamais: 'Jamais',
        synchro: 'Synchro',
        deconnexion: 'Déconnexion',
        activerLesAlertesMeteo: 'Activer les alertes météo',
        titleRecevoirUneNotification: 'Recevoir une notification quand un site favori devient volable, même app fermée',
    }),
    localBackup: Object.freeze({
        titre: 'Sauvegarde sur cet appareil',
        texte: 'Sans compte ni connexion : enregistrez toutes vos données (carnet de vol, équipement, statistiques, préférences) dans un fichier, puis restaurez-les quand vous voulez.',
        exporter: 'Exporter',
        importer: 'Importer',
    }),
    moreMapsBottomSheet: Object.freeze({
        cartesExternes: 'CARTES EXTERNES',
        selectionnezUneCarteSupplementaire: 'Sélectionnez une carte supplémentaire',
    }),
    gpsBottomSheet: Object.freeze({
        sYRendreAvec: "S'y rendre avec...",
        waze: 'Waze',
        googleMaps: 'Google Maps',
        applePlans: 'Apple Plans',
    }),
    gdprBanner: Object.freeze({
        respectDeVotreVie: 'Respect de votre vie privée',
        nousUtilisonsDesTechnologies:
            'Nous utilisons des technologies de stockage local (comme <code>localStorage</code>) et des services cloud (Firebase) pour assurer le fonctionnement de l\'application, sauvegarder vos thèmes et préférences, conserver vos statistiques d\'entraînement, et synchroniser vos données sur tous vos appareils. Pour en savoir plus, consultez notre <a role="button" tabindex="0" data-action="showModal" data-args="&#39;gdpr-privacy-modal&#39;">Politique de Confidentialité</a >.',
        parametrer: 'Paramétrer',
        toutRefuser: 'Tout refuser',
        toutAccepter: 'Tout accepter',
    }),
    gdprSettingsModal: Object.freeze({
        optionsDeConfidentialite: 'Options de Confidentialité',
        personnalisezVosPreferencesConcernant:
            'Personnalisez vos préférences concernant les données stockées et traitées par cette application.',
        fonctionnementTheme: 'Fonctionnement & Thème',
        essentiel: 'Essentiel',
        permetDeConserverVos:
            "Permet de conserver vos préférences d'affichage (mode sombre/clair) et votre niveau de pilotage sélectionné. Obligatoire pour le bon fonctionnement.",
        statistiquesDEntrainement: "Statistiques d'Entraînement",
        stockeLocalementVosScores:
            "Stocke localement vos scores de QCM et votre historique d'examens afin de suivre votre progression. Si désactivé, l'historique local sera effacé.",
        synchronisationCloudCompte: 'Synchronisation Cloud & Compte',
        permetDeCreerUn:
            "Permet de créer un compte et de sauvegarder vos statistiques d'entraînement dans notre base de données sécurisée (Firebase) pour y accéder depuis vos autres appareils.",
        geolocalisationGps: 'Géolocalisation (GPS)',
        utiliseLeGpsDe:
            'Utilise le GPS de votre appareil pour calculer les distances vous séparant des sites de vol libre de la région et filtrer les spots à proximité.',
        toutRefuser: 'Tout Refuser',
        enregistrer: 'Enregistrer',
    }),
    gdprPrivacyModal: Object.freeze({
        politiqueDeConfidentialite: 'Politique de Confidentialité',
        derniereMiseAJour: 'Dernière mise à jour : 17 octobre 2026',
        cettePolitiqueDecritLa:
            "Cette politique décrit la manière dont vos données personnelles sont traitées dans le cadre de l'application éducative <em>Assistant Parapente</em>.",
        n1ResponsableDuTraitement: '1. Responsable du Traitement',
        leTraitementDesDonnees:
            'Le traitement des données est effectué sous la responsabilité de Maxime Urbaniak, développeur indépendant.',
        n2DonneesCollectees: '2. Données Collectées & Finalités',
        siVousChoisissezDe:
            "Si vous choisissez de créer un compte pour la synchronisation, votre adresse e-mail et votre mot de passe (crypté) sont traités par le service d'authentification Firebase Auth.",
        identifiantsDeConnexion: 'Identifiants de Connexion :',
        vosScoresTauxDe:
            "Vos scores, taux de réussite par thème, et historique d'examens. Ils sont stockés localement sur votre appareil ou synchronisés dans la base Firestore si vous êtes connecté.",
        donneesDeProgressionQcm: 'Données de Progression (QCM) :',
        vosCoordonneesGpsSont:
            "Votre position GPS du moment est traitée temporairement sur votre appareil pour calculer les distances avec les sites de vol. Elle n'est jamais envoyée à nos serveurs.",
        donneesDeGeolocalisation: 'Données de Géolocalisation :',
        vosVolsMaterielEtTraces:
            'Vos vols (dates, sites, durées, notes), votre matériel et vos préférences sont conservés sur votre appareil. Si vous êtes connecté et avez accepté la synchronisation, ils sont aussi enregistrés dans la base Firestore, de même que les traces GPS (fichiers IGC) que vous avez vous-même importées avec un vol, afin de les retrouver sur vos autres appareils. Supprimer un vol supprime aussi sa trace.',
        carnetDeVolEtTraces: 'Carnet de vol et traces GPS (optionnel) :',
        uniquementSiVousLActivez:
            "uniquement si vous l'activez après avoir lu l'avertissement, votre voix est envoyée au service de reconnaissance vocale de votre navigateur (Google pour Chrome et Edge, Apple pour Safari) pour être transcrite. L'application ne conserve aucun enregistrement. Vous pouvez retirer votre accord à tout moment depuis l'écran du QCM. La lecture à voix haute, elle, reste sur votre appareil.",
        reponsesVocalesAuQcm: 'Réponses vocales au QCM (optionnel) :',
        choixDuThemeSombreClair:
            'Choix du thème (sombre/clair) et niveau, conservés uniquement dans votre stockage local.',
        donneesTechniques: 'Données Techniques :',
        n3HebergementDesDonnees: '3. Hébergement des Données',
        leSiteWebEst:
            "Le site web est auto-hébergé localement par l'éditeur. Les données de synchronisation optionnelles (comptes et statistiques si consentis) sont hébergées et sécurisées via la plateforme cloud Firebase (Google Ireland Limited, Dublin, Irlande). Les serveurs de Firebase sont situés au sein de l'Union Européenne.",
        n4DureeDeConservation: '4. Durée de Conservation des Données',
        lesDonneesStockeesLocalement:
            "Les données stockées localement (LocalStorage) restent stockées sur votre navigateur jusqu'à ce que vous effaciez les données de votre site ou révoquiez votre consentement.",
        lesComptesUtilisateursInactifs:
            "Les comptes utilisateurs inactifs sur Firebase sont supprimés au bout de 24 mois. Vous pouvez à tout moment demander la suppression définitive de votre compte depuis l'interface ou en nous contactant.",
        n5VosDroitsRgpd: '5. Vos Droits (RGPD)',
        conformementAuReglementGeneral:
            "Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez de droits d'accès, de rectification, de portabilité et de suppression de vos données, ainsi que du droit de retirer votre consentement à tout moment.",
        pourTouteQuestionOu:
            "Pour toute question ou pour exercer vos droits, vous pouvez contacter le responsable par le biais de la page du club-école <em>Le Fil d'Ariane</em> ou directement dans l'Espace Synchro.",
    }),
    gdprLegalModal: Object.freeze({
        mentionsLegales: 'Mentions Légales',
        n1EditeurDeLApplication: "1. Éditeur de l'Application",
        lApplicationEstEditeeEt:
            "L'application <em>Assistant Parapente</em> est éditée et développée de manière bénévole par <strong>Maxime Urbaniak</strong> à titre strictement personnel et indépendant. Ce site est un outil à but éducatif et non commercial.",
        n2ClauseDeNonResponsabilite: '2. Clause de Non-Responsabilité',
        bienQueLEditeurSoit:
            "Bien que l'éditeur soit adhérent du club-école de parapente <strong>Le Fil d'Ariane</strong> (Nord-Pas-de-Calais, France), le club décline toute responsabilité juridique, éditoriale ou opérationnelle quant au contenu, au fonctionnement ou à l'utilisation de cette application. L'application est un projet personnel indépendant et n'engage en aucun cas le club <em>Le Fil d'Ariane</em>.",
        deMemeLesQuestionnaires:
            "De même, les questionnaires QCM et les données relatives aux sites de vol libre sont mis à disposition à titre indicatif et proviennent de la <strong>Fédération Française de Vol Libre (FFVL)</strong>. La FFVL décline toute responsabilité quant à l'exactitude, à l'exhaustivité, à l'utilisation ou au bon fonctionnement de cette application, qui reste sous la seule responsabilité de son éditeur à titre personnel.",
        lesInformationsEtPrevisions:
            "Les informations et prévisions météorologiques affichées dans l'application sont issues de modèles de prévision automatiques externes. Elles sont fournies à titre purement informatif et indicatif. Elles ne peuvent en aucun cas se substituer à une analyse météorologique aérologique approfondie et officielle avant tout vol. L'éditeur ne saurait être tenu responsable d'écarts de prévision, de l'état des conditions réelles sur site, ou des décisions de vol prises par les pilotes.",
        previsionsMeteo: 'Prévisions Météo :',
        cetteApplicationEstUn:
            "Cette application est un outil d'accompagnement à l'apprentissage et aux révisions. La réussite aux examens blancs ou entraînements proposés au sein de cette application ne garantit en aucun cas la réussite aux épreuves réelles des brevets théoriques officiels organisés par la FFVL. L'éditeur (et toute personne ayant contribué au projet) décline toute responsabilité quant aux résultats finaux obtenus par les candidats lors des examens officiels.",
        resultatsAuxExamensOfficiels: 'Résultats aux Examens Officiels :',
        n3HebergeurDuSite: '3. Hébergeur du Site',
        leSiteWebEst:
            "Le site web est auto-hébergé à titre personnel par l'éditeur (<strong>Maxime Urbaniak</strong>) en France.",
        n4ProprieteIntellectuelle: '4. Propriété Intellectuelle',
        leCodeSourceDe:
            "Le code source de l'application et les éléments d'interface sont la propriété de l'éditeur. Les questionnaires QCM et les données relatives aux sites de vol libre proviennent de la <strong>Fédération Française de Vol Libre (FFVL)</strong> et sont mis à disposition à des fins de formation pour la préparation des brevets théoriques de parapente.",
        laBaseDesSites:
            'La base des sites de vol est dérivée des données ouvertes de la <strong>FFVL</strong> (<em >Source : FFVL</em >, Licence Ouverte / Etalab 2.0) complétées par <strong>ParaglidingEarth</strong> (licence Creative Commons BY-SA 3.0). Ces données sont fournies à titre indicatif et ne remplacent pas les informations officielles des structures gestionnaires.',
        touteReproductionOuUtilisation:
            "Toute reproduction ou utilisation non autorisée des cours et des affiches à des fins commerciales est interdite sans l'accord préalable des auteurs ou de la FFVL.",
        lesCoursAffichesEtDocuments:
            "Les cours, affiches, livrets et questions du QCM présentés ou liés dans cette application ne nous appartiennent pas : ils sont la propriété de la <strong>FFVL</strong> et de leurs auteurs, qui conservent tous leurs droits. Ils ne sont mis à disposition ici que pour faciliter la formation des pilotes, gratuitement et sans but lucratif. Pour toute demande de retrait ou de modification, contactez l'éditeur.",
    }),
    spotairModal: Object.freeze({
        ventEnDirect: 'Vent en direct — SpotAiR',
    }),
    logbookSessionModal: Object.freeze({
        nouvelleSession: 'Nouvelle session',
        ariaLabelFermer: 'Fermer',
        vol: 'Vol',
        gonflage: 'Gonflage',
        enregistrer: 'Enregistrer',
        annuler: 'Annuler',
    }),
    manualModal: Object.freeze({
        modeDEmploi: "Mode d'emploi",
        aPropos: 'À propos',
        general: 'Général',
        sitesDeVol: 'Sites de vol',
        calculVolabilite: 'Calcul Volabilité',
        carnetDeVol: 'Carnet de Vol',
        materielUsure: 'Matériel & Usure',
        securite: 'Sécurité',
        qcm: 'QCM',
        bibliotheque: 'Bibliothèque',
        statistiques: 'Statistiques',
        assistantParapente: 'Assistant Parapente',
        n100Gratuit: '100% Gratuit',
        unProjetBenevoleEntierement:
            "Un projet bénévole, entièrement gratuit et sans publicité, conçu pour les élèves et pilotes du club-école <strong>Le Fil d'Ariane</strong> (Nord-Pas-de-Calais), mais dédié à toute la communauté de vol libre francophone.",
        pourquoiCetteApplication: 'Pourquoi cette application ?',
        laPreparationAuxBrevets:
            'La préparation aux brevets de parapente peut être longue et morcelée : les questions officielles de la FFVL sont dispersées dans des documents PDF peu pratiques sur téléphone, les cours théoriques ne sont pas toujours réunis au même endroit, et la lecture des conditions météo sur un décollage demande de jongler entre plusieurs outils différents (Windy, Météo-Parapente, PiouPiou, les données FFVL...).',
        laPreparationAuxBrevetsSansMeteo:
            'La préparation aux brevets de parapente peut être longue et morcelée : les questions officielles de la FFVL sont dispersées dans des documents PDF peu pratiques sur téléphone, et les cours théoriques ne sont pas toujours réunis au même endroit.',
        lEstNeDe:
            "L'<strong>Assistant Parapente</strong> est né de la volonté de regrouper tout cela en un seul endroit, pensé pour fonctionner parfaitement sur mobile depuis le décollage, et adapté à toutes les étapes du parcours d'un pilote — du tout débutant (BI) au confirmé (BPC).",
        uneApplication100Gratuite: 'Une application 100% gratuite & sans publicité',
        lEstMisA:
            "L'<strong>Assistant Parapente</strong> est mis à disposition de la communauté <strong>entièrement gratuitement</strong>. Il n'y a aucune fonctionnalité payante, aucune collecte de données commerciales, aucun abonnement, et aucune publicité. Il s'agit d'une initiative bénévole et personnelle pour soutenir l'apprentissage théorique et la sécurité des pilotes de vol libre.",
        ceQueLApplicationFait: "Ce que l'application fait concrètement",
        elleCentraliseLesDans:
            'Elle centralise les <strong>questions officielles FFVL</strong> dans un QCM interactif avec correction et explications pédagogiques, accessible à tout moment, même hors ligne.',
        elleCroiseEnTemps:
            'Elle croise en temps réel les <strong>données géographiques des sites de vol</strong> (orientation des décollages, altitude, type) avec les <strong>prévisions météo multi-modèles</strong> (AROME, ICON, GFS…) pour indiquer quels sites sont potentiellement volables et à quelle heure.',
        elleReunitLesSites:
            "Elle réunit les <strong>sites de vol</strong> (orientation des décollages, altitude, type) sur une carte et dans une liste, avec recherche et filtres, autour de vous ou de l'endroit de votre choix.",
        elleRegroupeLesDu:
            'Elle regroupe les <strong>cours, manuels et fiches synthèse</strong> du brevet de pilote dans une bibliothèque consultable et téléchargeable.',
        elleTientVotreImport:
            "Elle tient votre <strong>carnet de vol</strong> (import de traces .igc, météo du jour enregistrée automatiquement) et suit l'<strong>usure de votre matériel</strong>.",
        elleRassembleSurUn:
            "Elle rassemble sur un écran <strong>Sécurité</strong> la conduite à tenir en cas d'accident, votre position GPS et les check-lists avant le décollage.",
        elleSuitVotreEt:
            'Elle suit votre <strong>progression dans le temps</strong> et identifie précisément les thèmes où vous avez le plus de lacunes, pour orienter vos révisions efficacement.',
        ceQueLApplicationNe: "Ce que l'application ne fait PAS",
        lApplicationEstUn:
            "L'application est un <strong>outil d'accompagnement et d'aide à la décision</strong>, pas un outil de décision. Les prévisions météo affichées proviennent de modèles automatiques et ne remplacent pas une analyse aérologique complète et officielle. <strong>La décision de voler reste toujours et uniquement celle du pilote.</strong>",
        lApplicationEstUnSansMeteo:
            "L'application est un <strong>outil d'accompagnement et d'aide à la décision</strong>, pas un outil de décision. <strong>La décision de voler reste toujours et uniquement celle du pilote.</strong>",
        deMemeLaReussite:
            "De même, la réussite aux QCM de l'application ne garantit pas la réussite aux examens officiels organisés par la FFVL.",
        quiLADeveloppee: "Qui l'a développée ?",
        cetteApplicationAEte:
            "Cette application a été développée bénévolement par <strong>Maxime Urbaniak</strong>, élève pilote du club-école <em>Le Fil d'Ariane</em> (Nord - Pas-de-Calais, France). Elle n'a aucune vocation commerciale. Le club décline toute responsabilité éditoriale sur le contenu de cette application.",
        lesDonneesDeQuestions:
            'Les données de questions QCM et les informations sur les sites de vol libre sont issues de la <strong>FFVL (Fédération Française de Vol Libre)</strong> et sont utilisées à des fins strictement éducatives.',
        bienvenueSurLAssistantParapente: "Bienvenue sur l'Assistant Parapente",
        lAssistantParapenteEstUne:
            "L'Assistant Parapente est une application tout-en-un conçue pour accompagner les pilotes de vol libre, de l'apprentissage théorique jusqu'à la préparation météo de leurs vols. Voici les concepts clés du fonctionnement général :",
        lAssistantParapenteEstUneSansMeteo:
            "L'Assistant Parapente est une application tout-en-un conçue pour accompagner les pilotes de vol libre, de l'apprentissage théorique jusqu'à la préparation de leurs vols. Voici les concepts clés du fonctionnement général :",
        n1ProfilEtNiveau: '1. Profil et Niveau de Pilotage',
        enHautDeLEcran:
            "En haut de l'écran, un menu déroulant vous permet de sélectionner votre niveau actuel (Brevet Initial, Brevet Pilote, Brevet Pilote Confirmé, Treuil, ou Tous les niveaux). Il est proposé dès votre première visite sur l'écran d'accueil, et vous pouvez le changer à tout moment. Ce réglage adapte automatiquement le contenu de l'application : les questions des QCM et les cours de la bibliothèque sont filtrés selon votre niveau, le nombre de questions de l'examen blanc est ajusté, et la couleur dominante de l'interface change pour refléter votre progression (Vert pour BI, Bleu pour BP, Marron pour BPC).",
        n2ThemeVisuelClair: '2. Thème Visuel (Clair / Sombre)',
        lApplicationDisposeDUnBouton:
            "L'application dispose d'un bouton ☀️/🌙 (en haut à droite). Il bascule entre le mode Clair, le mode Sombre, et le mode \"Auto\" (qui suit les réglages de votre système d'exploitation). Le mode sombre est particulièrement recommandé pour réduire la fatigue visuelle et économiser la batterie sur le terrain.",
        n3CreerSonCompte: "3. Créer son compte : pourquoi c'est important",
        sansCompteVousPerdez: "Sans compte, vous perdez tout en changeant d'appareil.",
        vosScoresVotreHistorique:
            "Vos scores, votre historique d'examens, vos sites favoris et vos préférences sont stockés localement dans votre navigateur. Si vous changez de téléphone, effacez le cache, ou passez de votre mobile à votre PC, tout disparaît. Un compte résout ce problème en 30 secondes.",
        concretementVoiciCeQuUn: "Concrètement, voici ce qu'un compte vous apporte :",
        commencezVotreRevisionQcm:
            'Commencez votre révision QCM sur votre téléphone au décollage, et retrouvez exactement le même état de progression le soir sur votre ordinateur — sans aucune manipulation manuelle.',
        continuiteParfaite: 'Continuité parfaite :',
        leModeRevisionSe:
            "Le mode Révision se base sur l'historique de vos erreurs pour vous reposer les bonnes questions. Sans compte, cet historique ne survit pas à un changement d'appareil. Avec un compte, l'algorithme garde une mémoire complète de toutes vos sessions passées.",
        memoireLongueDureeDu: 'Mémoire longue durée du mode Révision :',
        vosVolsVosSessions:
            "Vos vols, vos sessions de gonflage, vos voiles/sellettes enregistrées et l'usure calculée de votre matériel sont sauvegardés de manière sécurisée.",
        carnetDeVol2: 'Carnet de Vol & Équipement :',
        votreNiveauDeBrevet:
            'Votre niveau de brevet sélectionné, vos filtres de recherche météo, votre thème visuel, et vos configurations météo personnalisées (limites de vent, modèle préféré, rayon GPS, tri) sont synchronisés automatiquement.',
        votreNiveauDeBrevetSansMeteo:
            'Votre niveau de brevet sélectionné, vos filtres de recherche, votre thème visuel et vos réglages de recherche de sites (rayon GPS) sont synchronisés automatiquement.',
        sauvegardeDeVosPreferences: 'Sauvegarde de vos préférences :',
        unEffacementAccidentelDu:
            "Un effacement accidentel du cache du navigateur, un reset de téléphone, ou un changement d'appareil en urgence ne vous feront plus perdre des semaines de progression.",
        protectionContreLaPerte: 'Protection contre la perte de données :',
        pourCreerVotreCompte:
            "Pour créer votre compte (ce qui est <strong>100% gratuit</strong>), cliquez sur l'icône <strong>👤</strong> en haut à droite de l'application (Espace Synchro). La création prend moins d'une minute : une adresse e-mail et un mot de passe suffisent. Aucune information personnelle supplémentaire n'est requise.",
        ellesSontHebergeesSur:
            "elles sont hébergées sur l'infrastructure Firebase (Google Ireland, serveurs européens) et ne sont jamais partagées ni vendues. Vous pouvez les supprimer à tout moment depuis l'Espace Synchro ou en contactant l'éditeur.",
        vosDonneesRestentLes: 'Vos données restent les vôtres :',
        uneFoisConnecteUn:
            "Une fois connecté, un petit point dans l'en-tête indique qu'une synchronisation est en cours ou que des modifications n'ont pas encore pu être envoyées (hors ligne) : l'application réessaie automatiquement. Les boutons <strong>Exporter</strong> et <strong>Importer</strong> de l'Espace Synchro, disponibles aussi sans compte, permettent de garder une copie de vos données dans un fichier et de les restaurer plus tard.",
        n4HorsLigneEt: '4. Hors ligne et mises à jour',
        lesQcmLeCarnet:
            "les QCM, le carnet de vol et l'écran Sécurité fonctionnent hors ligne. La dernière prévision météo chargée, les cours déjà ouverts et les zones de carte déjà consultées restent disponibles sur l'appareil.",
        lesQcmLeCarnetSansMeteo:
            "les QCM, le carnet de vol et l'écran Sécurité fonctionnent hors ligne. Les cours déjà ouverts et les zones de carte déjà consultées restent disponibles sur l'appareil.",
        sansReseau: 'Sans réseau :',
        lorsquUneMiseAJour:
            "lorsqu'une mise à jour de l'application est disponible, un message vous le signale pour que vous puissiez recharger la page.",
        nouvelleVersion: 'Nouvelle version :',
        preparationDesVolsSites: 'Préparation des Vols (Sites & Météo)',
        preparationDesVolsSitesSeuls: 'Sites de Vol',
        ceModuleCroiseLes:
            'Ce module croise les données géographiques des sites de vol libre (fournies par la FFVL) avec les prévisions de plusieurs modèles météorologiques, pour indiquer quels sites sont potentiellement volables autour de vous et à quelle heure.',
        ceModulePresenteLesSites:
            'Ce module présente les sites de vol libre (données fournies par la FFVL) sur une carte et dans une liste, autour de vous.',
        n1PointDeReference: '1. Point de Référence et Rayon de Recherche',
        autorisezLeGpsBouton:
            'Autorisez le GPS (bouton "GPS") pour centrer la recherche sur vous, ou tapez le nom d\'une ville ou d\'une adresse (ex : Annecy) puis cliquez sur "Valider". Sans GPS ni adresse, la recherche est centrée sur Boulogne-sur-Mer et un message vous le rappelle.',
        leGpsOuUne: 'Le GPS ou une adresse :',
        lEtoileACoteDu:
            "L'étoile à côté du champ d'adresse mémorise le lieu courant pour le recharger en un clic plus tard.",
        lieuxEnregistres: 'Lieux enregistrés :',
        leCurseurRayonMaximal:
            'Le curseur "Rayon maximal" définit la zone de recherche autour de ce point, de 10 à 200 km (50 km par défaut). La météo n\'est demandée que pour les sites de cette zone (et vos favoris) ; la carte suit le rayon choisi.',
        leCurseurRayonMaximalSansMeteo:
            'Le curseur "Rayon maximal" définit la zone de recherche autour de ce point, de 10 à 200 km (50 km par défaut) ; la carte suit le rayon choisi.',
        leRayon: 'Le Rayon :',
        laBarreDeRecherche:
            'La barre de recherche trouve un site par son nom, sa ville ou son code postal. Les menus "Orientation" et "Type" (site naturel, atterrissage, dune, piste de treuil, gonflage…) affinent la liste.',
        rechercheEtFiltres: 'Recherche et filtres :',
        n2ParametresDeCalcul: '2. Paramètres de Calcul Météo',
        aromeMeteoFranceHauteDefinition:
            "AROME (Météo-France, haute définition, très précis à courte échéance en France), ICON-EU et ICON (DWD), ECMWF (IFS), GFS (NOAA, long terme mondial), ou une sélection automatique multi-modèles d'Open-Meteo. Changer de modèle recalcule les prévisions.",
        modeleMeteo: 'Modèle Météo :',
        de24HeuresA: 'De 24 heures à 7 jours. Elle fixe la fenêtre sur laquelle les créneaux volables sont recherchés.',
        dureeDesPrevisions: 'Durée des prévisions :',
        enFiltresPersonnelsVous:
            'En "Filtres Personnels", vous définissez votre plage de vent (Vent Min, Vent Max) et l\'écart maximal toléré entre rafales et vent moyen (Rafales Max). En "Mon Matériel", ce sont les plages de vent des voiles enregistrées dans votre carnet qui servent de limites : un site est volable si au moins une de vos voiles accepte le vent prévu.',
        modeDeCalculDu: 'Mode de calcul du vent :',
        n3TriEtDefinition: '3. Tri et Définition des Meilleures Conditions',
        laListePeutEtre:
            'La liste peut être triée par meilleures conditions, par distance (GPS) ou par nom. Vos sites favoris (étoile ⭐ sur une fiche) restent toujours en tête. En tri "Meilleures conditions", quatre stratégies sont proposées :',
        chercheLaPlusLongue: "Cherche la plus longue période d'heures consécutives volables (idéal pour un long vol).",
        creneauContinu: 'Créneau continu :',
        compteLesHeuresVolables: "Compte les heures volables de l'après-midi (de 12 h à 18 h).",
        demiJournee: 'Demi-journée :',
        verifieQueLeSite:
            "Vérifie que le site est volable le matin, en début d'après-midi et en fin de journée (10 h, 14 h et 18 h).",
        journeeComplete: 'Journée complète :',
        cumuleToutesLesHeures:
            'Cumule toutes les heures volables sur la durée des prévisions, même si elles sont hachées.',
        volumeTotal: 'Volume total :',
        n4HeureDeVol: '4. Heure de Vol et Fiabilité des Prévisions',
        leCurseurHeureDe:
            'Le curseur "Heure de vol" choisit l\'heure affichée pour tous les sites. La case "Masquer les sites sans créneau volable" retire ceux qui n\'ont aucune heure volable sur la durée des prévisions.',
        heureDeVol: 'Heure de vol :',
        chaqueAvisIndiqueLe:
            'Chaque avis indique le modèle utilisé, l\'heure à laquelle la prévision a été récupérée et l\'heure de calcul du modèle (run). Au-delà de 3 heures, la prévision est signalée comme ancienne, avec un bouton "Actualiser".',
        contexteDeLaPrevision: 'Contexte de la prévision :',
        pourLHeureAfficheeLApplication:
            "Pour l'heure affichée, l'application compare avec un second modèle (GFS, ou AROME si GFS est déjà choisi) et indique s'il est d'accord ou non.",
        secondAvis: 'Second avis :',
        siUneDonneeManque:
            "Si une donnée manque (vent, rafales, pluie, risque d'orage…), aucun avis n'est donné pour cette heure plutôt que d'inventer une valeur, et les données manquantes sont listées.",
        previsionIncomplete: 'Prévision incomplète :',
        laDernierePrevisionChargee:
            "La dernière prévision chargée reste consultable sans réseau, avec la date de récupération pour rappeler qu'elle peut être dépassée.",
        horsLigne: 'Hors ligne :',
        n5FicheSiteFavoris: '5. Fiche Site, Favoris et Comparateur',
        n2FicheSiteEtFavoris: '2. Fiche Site et Favoris',
        chaqueFicheSiteAffiche:
            "Chaque fiche site affiche l'altitude, les prochains créneaux volables, et donne accès à la fiche officielle FFVL, au vent en direct de la balise la plus proche (SpotAiR), à l'itinéraire (\"S'y rendre\" avec Waze, Google Maps ou Apple Plans) et aux détails du site (praticabilité, dangers signalés, réglementation…). Un <strong>brief pré-vol</strong> rappelle votre niveau et l'état de révision de votre matériel. Le bouton <strong>Comparer</strong> met vos sites favoris côte à côte : météo de l'heure affichée, heures volables, meilleur créneau et accord entre les deux modèles.",
        chaqueFicheSiteAfficheSansMeteo:
            "Chaque fiche site affiche l'altitude et donne accès à la fiche officielle FFVL, au vent en direct de la balise la plus proche (SpotAiR), à l'itinéraire (\"S'y rendre\" avec Waze, Google Maps ou Apple Plans) et aux détails du site (praticabilité, dangers signalés, réglementation…). Un <strong>brief pré-vol</strong> rappelle votre niveau et l'état de révision de votre matériel.",
        n6CartographieCartes: '6. Cartographie & Cartes Externes',
        n3CartographieCartes: '3. Cartographie & Cartes Externes',
        auDessusDeLaListe:
            "Au-dessus de la liste, la carte interactive affiche les sites autour de vous avec les icônes officielles FFVL. Des onglets permettent d'afficher en un clic des services météo externes : <strong>Windy</strong> (vent animé), <strong>Météo-Parapente</strong> (émagrammes &amp; thermiques), <strong>Paragliding Earth</strong>, <strong>Paraglidable</strong>, les cartes <strong>Fronts &amp; Isobares</strong> de Météo-France, et d'autres cartes via le bouton \"Plus\". Le bouton <strong>Spot It</strong> d'une fiche site centre toutes ces cartes sur ce site.",
        calculDeLaVolabilite: 'Calcul de la Volabilité (Scoring météo)',
        lApplicationEvalueEnTemps:
            'L\'application évalue en temps réel la "volabilité" de chaque spot de parapente selon un algorithme qui croise les prévisions météo avec vos filtres personnels. Ce calcul s\'effectue en deux étapes successives.',
        auPrealableChaqueHeure:
            "Au préalable, chaque heure doit disposer de toutes les données nécessaires (vent moyen, rafales, direction du vent, précipitations, risque d'orage, heures de jour). S'il en manque une, l'heure est marquée <strong>\"Prévision incomplète\"</strong> : aucun avis n'est donné et aucune valeur par défaut n'est inventée.",
        n1LesVerrousDe: '1. Les Verrous de Sécurité (Kill Switches)',
        avantDEstimerUnScore:
            "Avant d'estimer un score de vol, l'application vérifie 6 verrous de sécurité fondamentaux.",
        siUnSeulVerrou: 'Si un seul verrou est actif, le spot est déclaré "Non Volable" (0/100) :',
        leVolEstBloque: 'Le vol est bloqué si le soleil est couché.',
        nuit: '🌙 Nuit :',
        bloqueDesLePremier: 'Bloqué dès le premier millimètre de pluie (> 0 mm).',
        pluie: '🌧️ Pluie :',
        bloqueSiLeVent:
            'Bloqué si le vent moyen est inférieur à votre limite minimale (vMin) ou supérieur à votre limite maximale (vMax). En mode "Mon Matériel", bloqué si aucune de vos voiles n\'accepte ce vent.',
        ventMoyenHors: '💨 Vent moyen hors limites :',
        bloqueSiLEcartEntre:
            "Bloqué si l'écart entre les rafales et le vent moyen dépasse votre seuil de rafales toléré.",
        rafalesExcessives: '🌪️ Rafales excessives :',
        bloqueSiLEnergiePotentielle:
            "Bloqué si l'énergie potentielle convective (CAPE) de l'air dépasse 1000 J/kg, signe d'une forte instabilité convective et de danger.",
        risqueOrageux: '⚡ Risque orageux :',
        bloqueSiLaDirection:
            "Bloqué si la direction d'où vient le vent ne correspond pas à l'orientation de décollage enregistrée pour ce site.",
        orientationIncompatible: '🧭 Orientation incompatible :',
        siLOrientationDuDecollage:
            "Si l'orientation du décollage n'est pas connue, l'application ne la suppose jamais idéale : les autres verrous s'appliquent, mais le site est affiché <strong>\"Orientation du décollage inconnue : à vérifier\"</strong>, sans score.",
        n2CalculDuScore: '2. Calcul du Score Continu (de 0 à 100)',
        siTousLesVerrous:
            "Si tous les verrous sont au vert, l'algorithme calcule un score de qualité du vol basé sur deux critères pondérés à 50% chacun :",
        plusLeVentMoyen:
            "Plus le vent moyen est proche du milieu de votre plage idéale, plus la note se rapproche de 100/100. À l'extrême limite (vent égal à vMin ou vMax), la note descend à 0/100.",
        noteDeLaVitesse: 'Note de la Vitesse du Vent (50%) :',
        ventIdealVmin: 'Vent idéal = (vMin + vMax) / 2',
        evalueeSelonLaPrecision: "Évaluée selon la précision de l'alignement face à la pente :",
        noteDeLOrientation50: "Note de l'Orientation (50%) :",
        ventDeFaceA: 'Vent de face à ±11.25° près.',
        parfait100100: 'Parfait (100/100) :',
        ecartEntre1125Et: 'Écart entre 11.25° et 22.5°.',
        bon100A70100: 'Bon (100 à 70/100) :',
        ecartEntre225Et: 'Écart entre 22.5° et 45°.',
        passable70A0100: 'Passable (70 à 0/100) :',
        ecartSuperieurA45: 'Écart supérieur à 45° (ou rejeté par le filtre cardinal).',
        horsJeu0100: 'Hors-jeu (0/100) :',
        scoreFinal: '💡 Score Final = (Note Vent * 0.5) + (Note Orientation * 0.5).',
        unSpotJugeSecuritaire:
            'Un spot jugé sécuritaire (volable) aura son score global pondéré de manière fluide selon la force du vent et son alignement : Excellent à partir de 80/100, Bon de 50 à 79/100, Passable en dessous de 50/100.',
        cetAvisRepose:
            "⚠️ Cet avis repose sur des prévisions et le risque d'orage n'est qu'une estimation : la décision de voler vous appartient, vérifiez toujours les conditions sur place.",
        leCarnetDeVol: 'Le Carnet de Vol (Logbook) & Traces 3D',
        ceModuleVousPermet:
            "Ce module vous permet d'enregistrer et de conserver l'historique complet de vos activités en vol libre et au sol (vols et sessions de gonflage). Le bouton <strong>Carnet</strong> de la barre de navigation ouvre un sous-menu : <strong>Activités</strong>, <strong>Statistiques</strong> et <strong>Matériel</strong>. Le bouton <strong>Ajouter une session</strong>, en haut de la page Activités, ouvre une fenêtre de saisie ; la modification d'une session se fait dans la même fenêtre, fermée par <strong>Annuler</strong>, la croix ou la touche Échap.",
        n1AjouterUnVol: '1. Ajouter un Vol',
        importerTraceIgc:
            "<strong>Importer une trace GPS (.igc) :</strong> Glissez-déposez ou sélectionnez le fichier IGC de votre vario. L'application repère le vrai décollage et le vrai atterrissage (ni le parking, ni la marche du retour, même avec des virages serrés en approche), puis calcule la date, la durée, l'altitude max, le gain, la distance, le vario max et les vitesses. Un <strong>départ au treuil</strong> est reconnu tout seul (montée régulière en ligne droite dès le décollage) : le type de vol passe alors à <strong>Treuil</strong>. Si votre vario était mal calé (par exemple une altitude d'atterrissage négative), elle vous le signale et vous pouvez corriger les altitudes en saisissant l'altitude réelle du décollage ou de l'atterrissage. <strong>Plusieurs vols d'un coup :</strong> sélectionnez ou déposez plusieurs fichiers ensemble (avec leurs fichiers .sdf si vous en avez) : un tableau s'ouvre avec une ligne par vol, rangée par date. Chaque ligne part de la trace et de vos habitudes ; corrigez-la directement (date, site, durée, voile, sellette, type de vol, école et stage, pilotes), ou recopiez une colonne sur les autres lignes avec « Appliquer à toutes ». Un fichier illisible, un doublon ou un vol déjà dans le carnet est signalé et décoché. Rien n'est ajouté avant de cliquer sur « Importer ».",
        capteursSyride:
            "<strong>Capteurs Syride (.sdf) :</strong> Avec un vario Syride, ajoutez le fichier <strong>.sdf</strong> exporté avec le .igc (sélectionnez ou glissez les deux fichiers ensemble). Il apporte ce que l'IGC ne contient pas : le <strong>facteur de charge</strong> (G) mesuré par l'accéléromètre, y compris au largage du treuil. Vous pouvez aussi l'ajouter plus tard en modifiant le vol. L'application vérifie qu'il s'agit bien du même vol : sa trace doit suivre celle du .igc sur toute sa longueur, sinon il est refusé.",
        uneProposeLesSites:
            "<strong>Site de vol :</strong> Une <strong>autocomplétion</strong> propose les sites de la base officielle FFVL, vos sites habituels en tête. À l'import d'une trace, l'application choisit le site connu le plus proche du décollage, dans un rayon de 500 m ; si plusieurs sites sont possibles, ils s'affichent en boutons sous le champ pour changer d'un clic. Pour un lieu absent de la base, le bouton <strong>\"Placer sur la carte\"</strong> permet de le pointer sur une carte (vue carte ou satellite) ou de coller des coordonnées, y compris un lien Google Maps. La position est ensuite reprise automatiquement lors de vos prochaines sessions à ce lieu.",
        materielSession:
            '<strong>Matériel :</strong> Associez la voile et la sellette utilisées, choisies parmi vos équipements enregistrés ou saisies librement (les saisies précédentes sont proposées).',
        indiquezLeTypeDe:
            '<strong>Type de vol et décollage :</strong> Indiquez le type de vol (Plouf, Thermique, Soaring, Restit, Cross, Treuil) et la technique de décollage, obligatoire : <strong>"Face voile"</strong>, <strong>"Dos voile"</strong> ou une autre technique. Pour un vol au treuil, indiquez aussi le <strong>treuilleur</strong> : la liste propose d\'abord ceux de la journée sur ce site.',
        sessionEcoleExercices:
            "<strong>Session encadrée par une école :</strong> Cochez cette case et indiquez le nom de l'école, des moniteurs (plusieurs possibles) et, s'il y en a, des accompagnateurs lorsque la séance a eu lieu en stage (ceux de votre dernière session avec cette école au même endroit sont proposés). Cochez « C'est un stage » pour donner son nom et sa spécialité : en choisissant ensuite le nom d'un stage déjà saisi, ou pour une session à moins de 3 h d'une session de stage au même endroit, l'école, la spécialité, les moniteurs, les accompagnateurs et les pilotes de ce stage sont repris. Les stages sont aussi comptés dans les statistiques. Pour un vol, cochez aussi les <strong>exercices travaillés</strong> ; un exercice absent de la liste s'ajoute avec le bouton <strong>Ajouter</strong> et sera proposé aux sessions suivantes.",
        pilotesSession:
            "<strong>Pilotes :</strong> Choisissez dans la liste déroulante les pilotes présents, en école ou non, ou saisissez un nouveau nom : il rejoint la liste pour les sessions suivantes. Chaque pilote choisi s'affiche en étiquette, retirée d'un clic sur sa croix. Pour un vol à moins de 3 h d'une autre session au même endroit, les pilotes de cette session sont déjà sélectionnés.",
        formulaireQuiApprend:
            "<strong>Un formulaire qui apprend de vous :</strong> Pour une nouvelle session, l'application pré-remplit ce que vous faites d'habitude dans la même situation : type de vol et technique de décollage sur ce site, voile et sellette utilisées la dernière fois à cet endroit, école si vous y volez en stage en ce moment. Vos vols récents comptent davantage, et vos propres vols l'emportent sur les règles générales (par exemple « au treuil, on décolle dos voile »). Une ligne sous le formulaire indique ce qui a été pré-rempli et pourquoi. Tout reste modifiable : un champ que vous changez n'est jamais remplacé, et une session existante n'est jamais complétée. À l'import d'une trace IGC, le type de vol est aussi déduit de la trace (thermiques, distance, départ au treuil) et la ligne le précise ; « Restit » ne se lit pas dans une trace, il reste à choisir vous-même.",
        commentaireSession:
            '<strong>Commentaire :</strong> Notez vos impressions, conditions aérologiques locales, ou faits marquants de votre vol.',
        n2SessionDeGonflage: '2. Session de Gonflage (Jeux de Voile / Groundhandling)',
        leTravailAuSol: 'Le travail au sol est crucial pour la sécurité. Enregistrez vos sessions de gonflage :',
        lieuGonflage:
            "<strong>Lieu &amp; Autocomplétion :</strong> Saisissez le lieu où vous avez gonflé, assisté par l'autocomplétion des sites, ou placez-le sur la carte. Votre lieu habituel est pré-rempli.",
        exercicesGonflage:
            '<strong>Exercices travaillés (Multi-sélection) :</strong> Cochez les exercices de la séance (face voile, dos voile, tangage/roulis, affalage, vent fort, prégonflage/démêlage) ou ajoutez-en un avec le bouton <strong>Ajouter</strong>, pour garder une trace précise de votre progression technique.',
        n3Historique: '3. Activités',
        toutesVosSessionsSont: 'Toutes vos sessions sont répertoriées chronologiquement avec un code couleur clair :',
        sessionsDeVolEn: 'Sessions de vol en conditions réelles.',
        bleuVols: 'Bleu (Vols) :',
        seancesDEntrainementAuSol: "Séances d'entraînement au sol.",
        orangeGonflages: 'Orange (Gonflages) :',
        pourUnVolImporte:
            '<strong>Trace 3D :</strong> Pour un vol importé, le bouton <strong>"Voir la trace"</strong> ouvre un lecteur 3D (propulsé par <strong>MapLibre GL JS</strong>) qui rejoue le vol sur le relief réel.',
        statsDetaillees:
            "<strong>Statistiques détaillées :</strong> Sous chaque vol avec une trace, un bloc repliable détaille le remorquage au treuil (durée, hauteur de largage, montée), les altitudes et le dénivelé cumulé, le vario et le taux de chute, les thermiques enroulés (nombre, montée moyenne, meilleur thermique, tours à gauche et à droite), la finesse en transition, les distances (dont la distance libre à 3 points), ainsi que le facteur de charge mesuré si le .sdf a été ajouté (sinon un facteur de charge estimé d'après les virages), et l'instrument qui a enregistré le vol : marque, modèle, numéro de série et version du logiciel, lus dans le fichier IGC.",
        chaqueEntreePeutEtre:
            "<strong>Modification et Suppression :</strong> Chaque entrée peut être modifiée (le formulaire se préremplit, avec un bouton <strong>Annuler</strong>) ou supprimée. Les heures d'usure de votre matériel sont ajustées automatiquement. En modification, le bouton <strong>Recalculer depuis la trace IGC</strong> refait les calculs à partir de la trace enregistrée (date, durée, altitudes, statistiques, site, et type Treuil si besoin) sans toucher au reste.",
        exporterCarnet:
            "<strong>Exporter :</strong> le bouton <strong>Exporter en PDF</strong> ouvre un bilan A4 de tout le carnet (date, type, site, voile, durée, commentaire, totaux) : choisissez « Enregistrer au format PDF » dans la fenêtre d'impression. Sur une session avec trace, <strong>Télécharger l'IGC</strong> redonne le fichier d'origine, prêt à être déclaré sur CFD ou XContest.",
        n4StatistiquesDuCarnet: '4. Statistiques du Carnet',
        statistiquesEtRecords:
            'La partie Statistiques résume votre activité : nombre et temps de vol, sessions de gonflage, altitude maximale et gain cumulé, utilisation de chaque voile et heures restantes avant révision, lieux les plus fréquentés, part des sessions en école, types de vols, techniques de décollage et exercices de gonflage. La section <strong>Records personnels</strong> donne vos meilleurs vols (plus long, plus haut, distance libre, meilleur thermique, meilleure finesse, plus haut largage au treuil, facteur de charge…) avec leur date et leur site, et les cumuls de vos vols avec trace. Le bouton <strong>Tout recalculer</strong>, à côté d’<strong>Ajouter une session</strong> (ou sous les records), recalcule tous vos vols depuis leur trace : date, durée, altitude max, gain, position du décollage et statistiques. Vos saisies sont gardées : site, type de vol, matériel, école, pilotes, commentaire et correction d’altitude.',
        captureMeteoAutomatiqueOpenMeteo: 'Capture Météo Automatique (Open-Meteo)',
        lorsDeLEnregistrementDUn:
            "Lors de l'enregistrement d'un vol ou d'une session de gonflage, l'application interroge automatiquement le service météorologique <strong>Open-Meteo</strong> (modèles de Météo-France pour les dates récentes, archives pour les plus anciennes). À partir des coordonnées du site et de l'heure de votre activité, elle enregistre les conditions au <strong>décollage et à l'atterrissage</strong> (ou au début et à la fin d'un gonflage) : <strong >vitesse du vent, rafales, direction (en degrés et cardinal), température, et état du ciel</strong >. Lorsque les deux relevés sont identiques, une seule ligne est affichée. Si le site dispose d'une balise FFVL, le graphique du <strong>vent réellement mesuré</strong> ce jour-là est aussi consultable. Pas besoin de saisie manuelle !",
        gestionDuMateriel: "Gestion du Matériel & Suivi d'Usure",
        pourVolerSereinementLApplication:
            "Pour voler sereinement, l'application intègre un suivi complet de la durée de vie et de la périodicité de maintenance de vos équipements (ailes, sellettes, secours, accessoires).",
        n1EnregistrerSonEquipement: '1. Enregistrer son Équipement',
        pourChaqueMaterielCarnet:
            'Pour chaque matériel (Carnet &gt; Matériel), vous pouvez définir : le type (Voile, Sellette, Parachute de Secours, Accessoire), la marque, le modèle, la taille et la couleur (choisis dans une liste ou saisis librement, le nom du matériel est composé automatiquement), la date d\'achat, ainsi que la date de sa dernière révision en atelier certifié. Pour une voile, renseignez aussi sa <strong>plage de vent</strong> (vent min et max) : elle sert au mode de calcul "Mon Matériel" de l\'écran Sites de vol.',
        pourChaqueMaterielCarnetSansMeteo:
            "Pour chaque matériel (Carnet &gt; Matériel), vous pouvez définir : le type (Voile, Sellette, Parachute de Secours, Accessoire), la marque, le modèle, la taille et la couleur (choisis dans une liste ou saisis librement, le nom du matériel est composé automatiquement), la date d'achat, ainsi que la date de sa dernière révision en atelier certifié.",
        n2PeriodiciteCombineeTemps: '2. Périodicité Combinée (Temps et Heures)',
        selectionnezLIntervalleTemporelRecommand:
            "Sélectionnez l'intervalle temporel recommandé par le constructeur (<strong >6 mois</strong >, <strong>12 mois</strong>, <strong>24 mois</strong>, ou aucun contrôle requis) ET la limite d'heures de vol (<strong>50h</strong>, <strong>100h</strong>, <strong>150h</strong>, <strong>200h</strong>, ou non applicable). L'application surveillera les deux compteurs en temps réel grâce au carnet de vol, et déclenchera une alerte au premier des deux termes échu. Un badge sur le bouton <strong>Carnet</strong> de la barre de navigation signale le matériel à réviser.",
        n3CodeCouleur: '3. Code Couleur & Alertes Visuelles de Maintenance',
        pourRepererRapidementLe:
            "Pour repérer rapidement le matériel nécessitant votre attention, l'application utilise des indicateurs visuels :",
        materielReviseRecemmentLa:
            "Matériel révisé récemment. La date de prochaine révision est lointaine et le compteur d'heures est dans la norme.",
        vertOk: 'Vert (OK) :',
        dateDeRevisionPrevue:
            '<span style=" display: inline-block; width: 12px; height: 12px; border-radius: 50%; background-color: #f59e0b; margin-right: 8px; vertical-align: middle; " ></span ><strong>Orange (Proche) :</strong> Date de révision prévue dans <strong>moins de 30 jours</strong> OU limite d\'heures de vol approchant à <strong>moins de 15h</strong>. Préparez votre envoi en atelier.',
        dateDeRevisionExpiree:
            "Date de révision expirée OU volume d'heures maximum atteint. Par sécurité, faites contrôler votre équipement.",
        rougeDepassee: 'Rouge (Dépassée) :',
        n4ArchiverOuSupprimer: '4. Archiver ou Supprimer définitivement',
        lorsqueVousChangezDe: 'Lorsque vous changez de matériel, vous avez deux options :',
        masqueLEquipementDesMenus:
            "Masque l'équipement des menus d'ajout (lors de la saisie d'un nouveau vol), mais conserve tout son historique d'heures de vol et de gonflage associés. Idéal pour garder des statistiques correctes de vos anciennes ailes.",
        archiver: 'Archiver :',
        effaceCompletementLeMateriel: "Efface complètement le matériel et rompt l'association avec vos vols passés.",
        supprimerDefinitivement: 'Supprimer définitivement :',
        n5UsureEnHeures: "5. Usure en Heures d'Utilisation Réelles",
        leSystemeCroiseAutomatiquement:
            "Le système croise automatiquement chaque équipement avec votre carnet de vol. Pour chaque aile, sellette ou secours, elle affiche le <strong>cumul d'heures réelles passées en l'air</strong> ainsi que le nombre de séances de gonflage au sol. Un indicateur fiable et automatisé de l'usure de votre matériel !",
        synchronisationCloudFirebase: 'Synchronisation Cloud (Firebase) & Préférences',
        desQueVousEtes:
            "Dès que vous êtes connecté à votre compte, l'application synchronise instantanément en tâche de fond votre <strong>Carnet de Vol</strong>, votre <strong>Équipement</strong>, et l'intégralité de vos configurations : modèles de prévision météo préférés, rayon GPS, tri des sites, limites de vent moyen et de rafales personnalisées. Retrouvez votre espace de pilotage personnalisé sur n'importe quel ordinateur, tablette ou smartphone sans aucune perte de données.",
        desQueVousEtesSansMeteo:
            "Dès que vous êtes connecté à votre compte, l'application synchronise instantanément en tâche de fond votre <strong>Carnet de Vol</strong>, votre <strong>Équipement</strong>, et l'intégralité de vos configurations : rayon GPS, tri des sites. Retrouvez votre espace de pilotage personnalisé sur n'importe quel ordinateur, tablette ou smartphone sans aucune perte de données.",
        lEcranSecurite: "L'Écran Sécurité",
        cetEcranReprendDes:
            'Cet écran reprend des contenus officiels de la FFVL (source indiquée sur chaque rubrique). Le bouton <strong>Sécurité</strong> de la barre de navigation ouvre un sous-menu donnant accès à ses trois rubriques.',
        n1Urgence: '1. Urgence',
        enUnGesteEt: 'en un geste, et la fréquence radio sécurité vol libre de la FFVL (143,9875 MHz).',
        appelerLe112: 'Appeler le 112',
        elleUtiliseLeGps:
            "Elle utilise le GPS du téléphone et fonctionne donc sans réseau mobile. Les coordonnées sont affichées en degrés minutes (format utilisé par les secours aériens), en degrés décimaux et en degrés minutes secondes, avec l'altitude et la précision. Elles peuvent être copiées ou partagées par message.",
        maPositionGps: 'Ma position GPS :',
        lesEtapesDeLAlerte:
            "Les étapes de l'alerte, que faire si vous êtes posé dans un arbre ou bloqué en falaise, les signes YES / NO à faire à l'hélicoptère, les règles lorsqu'un hélicoptère intervient et le contenu du kit de secours personnel.",
        conduiteATenir: 'Conduite à tenir :',
        n2CheckLists: '2. Check-lists',
        les7PointsA:
            'Les 7 points à vérifier avant chaque décollage, à cocher un par un, avec une lecture à voix haute possible.',
        visitePrevol: 'Visite prévol :',
        unCourtQuestionnaireSur:
            'Un court questionnaire sur votre forme, votre matériel et les conditions, à remplir franchement avant de vous équiper. Chaque domaine passe au vert, au jaune ou au rouge ; un rouge invite à renoncer ou à différer.',
        pretPourLeDeco: 'Prêt pour le déco ? :',
        n3MaSigr: '3. Ma SIGR',
        laStrategieIndividuelleDe:
            'La Stratégie Individuelle de Gestion des Risques vous fait évaluer honnêtement sept "plaques" de protection (pilotage, aérologie, accidentologie, matériel, condition physique, rapport à la communauté, mental) comme solides ou à renforcer. L\'application résume celles à travailler en priorité. Votre bilan reste sur cet appareil.',
        entrainementAuxQcmOfficiels: 'Entraînement aux QCM Officiels',
        ceModuleUtiliseLa:
            'Ce module utilise la base de données officielle des questions de la Fédération Française de Vol Libre (FFVL) pour préparer vos brevets théoriques.',
        n1LesQuatreModes: "1. Les Quatre Modes d'Apprentissage",
        cEstLeModePar:
            "C'est le mode par défaut. Lorsque vous répondez à une question, la correction est affichée immédiatement, accompagnée d'une explication pédagogique détaillée. Il n'y a pas de limite de temps. C'est le meilleur mode pour apprendre.",
        modeEntrainement: 'Mode Entraînement :',
        uneSimulationDeLExamen:
            "Une simulation de l'examen théorique, avec un volume et des thèmes imposés : 30 questions tirées dans tous les thèmes (60 pour le BP). Vous ne savez pas si votre réponse est juste avant d'avoir terminé la totalité des questions. Un rapport détaillé est fourni à la fin et l'examen rejoint votre historique.",
        modeExamen: 'Mode Examen :',
        revisionEspaceeUneQuestion:
            "Révision espacée. Une question ratée revient dès la session suivante ; à chaque bonne réponse d'affilée, elle revient plus tard (1, 3, 7, 14 puis 30 jours). Les questions jamais tentées passent en premier, puis celles dont la date de révision est dépassée. Très utile pour retenir durablement avant le jour J.",
        modeRevision: 'Mode Révision :',
        choisissezUnNiveauGlobal:
            "Choisissez un niveau global ou un thème précis, puis un palier cible (50%, 75% ou 100% de réussite). L'application pioche en priorité vos questions non maîtrisées ou en échec, et calcule le nombre de bonnes réponses nécessaires pour atteindre ce palier. Si vous vous trompez en cours de série, l'objectif recule automatiquement et de nouvelles questions sont ajoutées en temps réel, pour garantir qu'à la fin de la série, votre palier soit bien atteint.",
        modePerfectionnement: 'Mode Perfectionnement :',
        n2ParametrageAvance: '2. Paramétrage Avancé',
        enModeEntrainementOu:
            "En mode Entraînement ou Révision, vous pouvez choisir le nombre de questions (10, 20, 30, 40 ou TOUTES) et forcer le QCM sur un thème précis (ex: uniquement la Météo, ou uniquement la Réglementation). En mode Perfectionnement, ce nombre est calculé automatiquement : vous choisissez uniquement le périmètre (niveau ou thème) et le palier objectif. Dans tous les modes, l'ordre des réponses est mélangé à chaque session, pour retenir la théorie plutôt que la position de la bonne réponse.",
        n3LectureEtReponses: '3. Lecture et Réponses à la Voix',
        leBoutonLitLa:
            "<strong>Lecture à voix haute :</strong> Le bouton <strong>Lire</strong> lit la question et ses réponses, et <strong>Lecture auto</strong> lit chaque nouvelle question. Après validation, la correction est lue : le verdict seul pour une bonne réponse, le verdict et l'explication après une erreur ou une réponse incomplète.",
        ditesLesLettresDes:
            "Dites les lettres des réponses (« A », « B et D »), puis « valider », « suivante », « précédente », « répète », « effacer » ou « stop ». Vous pouvez répondre pendant la lecture. Une connexion internet est nécessaire : votre navigateur envoie votre voix à son service de reconnaissance vocale (Google pour Chrome et Edge, Apple pour Safari). L'application ne conserve aucun enregistrement et vous pouvez retirer votre accord à tout moment.",
        repondreALaVoix: 'Répondre à la voix (expérimental) :',
        n4LaBanqueDe: '4. La Banque de Questions',
        accessibleDepuisLeMenu:
            'Accessible depuis le menu QCM, ce répertoire permet de consulter librement l\'intégralité des questions existantes. Une barre de recherche vous permet de taper un mot-clé (ex: "Cumulonimbus", "Finesse") pour retrouver instantanément la question officielle correspondante et son explication, et un menu filtre les questions par thème.',
        laBibliothequeDeCours: 'La Bibliothèque de Cours',
        unEspaceCentralisantDe:
            'Un espace centralisant de nombreux supports de cours, manuels de vol libre et affiches pédagogiques pour consolider la théorie.',
        n1NavigationEtTri: '1. Navigation et Tri',
        lesDocumentsSontClasses:
            'Les documents sont classés de manière logique (Mécanique de vol, Météorologie, Matériel, Réglementation...). Utilisez les boutons "Par catégorie" ou "A-Z" pour les regrouper par catégorie ou par ordre alphabétique. Seuls les cours de votre niveau (et les cours généraux) sont affichés.',
        categorisation: 'Catégorisation :',
        laBarreDeRecherche2:
            'La barre de recherche filtre instantanément les documents selon leur titre ou leur catégorie.',
        rechercheRapide: 'Recherche Rapide :',
        n2LectureDesCours: '2. Lecture des Cours',
        enCliquantSurUn:
            "En cliquant sur un cours, le document PDF original s'ouvre dans un nouvel onglet de votre navigateur, où vous pouvez le lire en plein écran, le télécharger ou l'imprimer. Un cours déjà ouvert reste ensuite consultable hors ligne.",
        suiviEtStatistiques: 'Suivi et Statistiques',
        ceTableauDeBord:
            "Ce tableau de bord personnel agrège l'ensemble de vos résultats aux QCM du niveau sélectionné pour vous aider à cibler vos révisions. En haut, une jauge affiche votre taux de réussite global, suivie de la répartition de vos questions par degré de maîtrise (maîtrisées, excellentes, très bonnes, satisfaisantes…).",
        n1AnalyseParTheme: '1. Analyse par Thème',
        lApplicationCalculeVotrePourcentage:
            "L'application calcule votre pourcentage de réussite exact pour chaque grande famille (Météo, Mécavol, Pilotage...). Des barres de progression visuelles vous indiquent d'un coup d'œil où se situent vos lacunes (en orange ou rouge) et vos points forts (en vert).",
        n2HistoriqueDesExamens: '2. Historique des Examens',
        vousRetrouverezLHistoriqueDe:
            "Vous retrouverez l'historique de vos examens blancs pour le niveau sélectionné, avec la date et le score obtenu, ainsi qu'une liste détaillée de toutes les questions déjà tentées.",
        n3Reinitialisation: '3. Réinitialisation',
        siVousSouhaitezRecommencer:
            "Si vous souhaitez recommencer à zéro (par exemple pour préparer le niveau supérieur l'année suivante), un bouton de réinitialisation vous permet d'effacer vos statistiques locales. Attention, cette action est irréversible !",
    }),
    header: Object.freeze({
        altAssistantParapente: 'Assistant Parapente',
        tousLesNiveaux: 'Tous les niveaux',
        brevetInitial: 'Brevet Initial',
        brevetPilote: 'Brevet Pilote',
        brevetPiloteConfirme: 'Brevet Pilote Confirmé',
        treuil: 'Treuil',
        titleModeAutoSysteme: 'Mode: Auto (Système)',
        titleEspacePersonnel: 'Espace Personnel / Connexion',
    }),
    footer: Object.freeze({
        titleVisiterLeSite: "Visiter le site du Club Le Fil d'Ariane",
        altLogoClub: 'Logo Club',
        titleVisiterLeSite2: 'Visiter le site de la FFVL',
        altLogoFfvl: 'Logo FFVL',
        developpeBenevolementATitre:
            'Développé bénévolement à titre personnel par <a href="https://www.facebook.com/maxime.urbaniak/" target="_blank" rel="noopener noreferrer">Maxime Urbaniak</a>, élève pioupiou du club-école <a href="https://parapente62lefildariane.wordpress.com" target="_blank" rel="noopener noreferrer">Le Fil d\'Ariane</a>.',
        baseSurLesDonnees: 'Basé sur les données de la',
        federationFrancaiseDeVol: 'Fédération Française de Vol Libre',
        mentionsLegales: 'Mentions Légales',
        confidentialite: 'Confidentialité',
        gestionDesCookies: 'Gestion des cookies & données',
        leClubEtLa:
            "Le club et la FFVL déclinent toute responsabilité quant à l'édition, au contenu et à l'utilisation de cette application indépendante.",
        proprieteDesCours:
            'Cours, affiches et questions du QCM : propriété de la FFVL et de leurs auteurs, présentés ici pour faciliter la formation.',
    }),
});
