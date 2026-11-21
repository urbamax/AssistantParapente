# Audit: User Manual Catch-Up

One row per manual text (catalogue key) after the change, compared with `origin/main` before it (PR 321).

**Method.** Every manual tab was read for every role (none, `beta`, `owner`) and compared with the features merged since 2026-11-07 (PR descriptions, then the strings and code of the screens). Rows marked *kept* were read and found accurate; the evidence column of *added* and *corrected* rows names what they were checked against.

**Totals.** 277 texts: 247 kept, 16 corrected, 14 added, 0 removed (three QCM rows corrected afterwards by spec 055).

**Found outside the manual (not changed here).** The ICE screen intro (`js/i18n/fr.js`, `ice.introHint`) still ends with « Votre fiche reste sur cet appareil : elle n'est ni synchronisée ni exportée », which contradicts the optional online copy (PRs 180, 307). To fix in its own change.

| Tab | Key | Role | Result | Evidence |
|---|---|---|---|---|
| header | modeDEmploi | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| header | aPropos | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| header | general | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| header | sitesDeVol | owner | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| header | calculVolabilite | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| header | carnetDeVol | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| header | materielUsure | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| header | securite | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| header | qcm | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| header | bibliotheque | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| header | statistiques | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| about | assistantParapente | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| about | n100Gratuit | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| about | unProjetBenevoleEntierement | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| about | pourquoiCetteApplication | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| about | laPreparationAuxBrevets | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| about | laPreparationAuxBrevetsSansMeteo | not-beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| about | lEstNeDe | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| about | uneApplication100Gratuite | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| about | lEstMisA | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| about | ceQueLApplicationFait | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| about | elleCentraliseLesDans | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| about | elleCroiseEnTemps | owner | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| about | elleRegroupeLesDu | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| about | elleTientVotreImport | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| about | elleRassembleSurUn | all | corrected | Safety screen has a 4th tab, Fiche ICE |
| about | elleSuitVotreEt | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| about | ceQueLApplicationNe | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| about | lApplicationEstUn | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| about | lApplicationEstUnSansMeteo | not-beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| about | deMemeLaReussite | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| about | quiLADeveloppee | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| about | cetteApplicationAEte | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| about | lesDonneesDeQuestions | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| dashboard | bienvenueSurLAssistantParapente | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| dashboard | lAssistantParapenteEstUne | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| dashboard | lAssistantParapenteEstUneSansMeteo | not-beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| dashboard | n1ProfilEtNiveau | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| dashboard | enHautDeLEcran | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| dashboard | n2ThemeVisuelClair | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| dashboard | lApplicationDisposeDUnBouton | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| dashboard | n3CreerSonCompte | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| dashboard | sansCompteVousPerdez | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| dashboard | vosScoresVotreHistorique | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| dashboard | concretementVoiciCeQuUn | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| dashboard | commencezVotreRevisionQcm | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| dashboard | continuiteParfaite | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| dashboard | leModeRevisionSe | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| dashboard | memoireLongueDureeDu | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| dashboard | vosVolsVosSessions | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| dashboard | carnetDeVol2 | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| dashboard | votreNiveauDeBrevet | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| dashboard | sauvegardeDeVosPreferences | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| dashboard | votreNiveauDeBrevetSansMeteo | not-beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| dashboard | unEffacementAccidentelDu | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| dashboard | protectionContreLaPerte | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| dashboard | pourCreerVotreCompte | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| dashboard | ellesSontHebergeesSur | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| dashboard | vosDonneesRestentLes | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| dashboard | uneFoisConnecteUn | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| dashboard | n4HorsLigneEt | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| dashboard | lesQcmLeCarnet | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| dashboard | sansReseau | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| dashboard | lesQcmLeCarnetSansMeteo | not-beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| dashboard | lorsquUneMiseAJour | all | corrected | Mandatory update overlay, single « Mettre à jour » button (PR 278, js/core/app_update.js) |
| dashboard | nouvelleVersion | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| dashboard | n5InstallerLApplication | all | added | Install button header/footer, iOS steps modal (spec 051, PR 269; pwaInstallModal strings) |
| dashboard | installerLApplicationTexte | all | added | Same as above |
| dashboard | n6SignalerUnProbleme | all | added | Footer link « Signaler un problème / Suggestion » (spec 048, PR 266; feedbackModal strings) |
| dashboard | signalerUnProblemeTexte | all | added | feedbackModal strings: categories, optional contact, technical context, Envoyer, Copier le message, draft kept |
| dashboard | n7LaCommunauteDiscord | all | added | Header Discord button, footer link, « Rejoindre le Discord » in feedback form (spec 051) |
| dashboard | laCommunauteDiscordTexte | all | added | Same as above; channels #mises-a-jour and #guide-utilisation exist |
| sites | preparationDesVolsSites | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| sites | preparationDesVolsSitesSeuls | not-beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| sites | ceModuleCroiseLes | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| sites | ceModulePresenteLesSites | not-beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| sites | n1PointDeReference | owner | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| sites | autorisezLeGpsBouton | owner | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| sites | leGpsOuUne | owner | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| sites | lEtoileACoteDu | owner | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| sites | lieuxEnregistres | owner | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| sites | leCurseurRayonMaximal | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| sites | leRayon | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| sites | leCurseurRayonMaximalSansMeteo | not-beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| sites | leRayon | not-beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| sites | laBarreDeRecherche | owner | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| sites | rechercheEtFiltres | owner | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| sites | n2ParametresDeCalcul | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| sites | aromeMeteoFranceHauteDefinition | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| sites | modeleMeteo | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| sites | de24HeuresA | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| sites | dureeDesPrevisions | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| sites | enFiltresPersonnelsVous | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| sites | modeDeCalculDu | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| sites | n3TriEtDefinition | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| sites | laListePeutEtre | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| sites | chercheLaPlusLongue | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| sites | creneauContinu | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| sites | compteLesHeuresVolables | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| sites | demiJournee | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| sites | verifieQueLeSite | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| sites | journeeComplete | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| sites | cumuleToutesLesHeures | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| sites | volumeTotal | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| sites | n4HeureDeVol | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| sites | leCurseurHeureDe | beta | corrected | Forecast hour read in each site's time zone (PR 313) |
| sites | heureDeVol | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| sites | chaqueAvisIndiqueLe | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| sites | contexteDeLaPrevision | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| sites | pourLHeureAfficheeLApplication | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| sites | secondAvis | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| sites | siUneDonneeManque | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| sites | previsionIncomplete | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| sites | laDernierePrevisionChargee | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| sites | horsLigne | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| sites | n5FicheSiteFavoris | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| sites | n2FicheSiteEtFavoris | not-beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| sites | chaqueFicheSiteAffiche | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| sites | chaqueFicheSiteAfficheSansMeteo | not-beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| sites | n6CartographieCartes | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| sites | n3CartographieCartes | not-beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| sites | auDessusDeLaListe | owner | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| scoring | calculDeLaVolabilite | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| scoring | lApplicationEvalueEnTemps | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| scoring | auPrealableChaqueHeure | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| scoring | n1LesVerrousDe | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| scoring | avantDEstimerUnScore | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| scoring | siUnSeulVerrou | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| scoring | leVolEstBloque | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| scoring | nuit | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| scoring | bloqueDesLePremier | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| scoring | pluie | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| scoring | bloqueSiLeVent | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| scoring | ventMoyenHors | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| scoring | bloqueSiLEcartEntre | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| scoring | rafalesExcessives | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| scoring | bloqueSiLEnergiePotentielle | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| scoring | risqueOrageux | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| scoring | bloqueSiLaDirection | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| scoring | orientationIncompatible | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| scoring | siLOrientationDuDecollage | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| scoring | n2CalculDuScore | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| scoring | siTousLesVerrous | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| scoring | plusLeVentMoyen | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| scoring | noteDeLaVitesse | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| scoring | ventIdealVmin | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| scoring | evalueeSelonLaPrecision | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| scoring | noteDeLOrientation50 | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| scoring | ventDeFaceA | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| scoring | parfait100100 | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| scoring | ecartEntre1125Et | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| scoring | bon100A70100 | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| scoring | ecartEntre225Et | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| scoring | passable70A0100 | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| scoring | ecartSuperieurA45 | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| scoring | horsJeu0100 | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| scoring | scoreFinal | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| scoring | unSpotJugeSecuritaire | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| scoring | cetAvisRepose | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| logbook | leCarnetDeVol | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| logbook | ceModuleVousPermet | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| logbook | n1AjouterUnVol | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| logbook | importerTraceIgc | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| logbook | importerFfvl | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| logbook | capteursSyride | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| logbook | uneProposeLesSites | all | corrected | Flights follow the current name of their site (PR 263, js/services/flight_site_link.js) |
| logbook | materielSession | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| logbook | indiquezLeTypeDe | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| logbook | sessionEcoleExercices | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| logbook | pilotesSession | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| logbook | formulaireQuiApprend | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| logbook | commentaireSession | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| logbook | n2SessionDeGonflage | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| logbook | leTravailAuSol | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| logbook | lieuGonflage | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| logbook | exercicesGonflage | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| logbook | n3Historique | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| logbook | toutesVosSessionsSont | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| logbook | sessionsDeVolEn | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| logbook | bleuVols | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| logbook | seancesDEntrainementAuSol | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| logbook | orangeGonflages | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| logbook | pourUnVolImporte | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| logbook | statsDetaillees | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| logbook | chaqueEntreePeutEtre | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| logbook | exporterCarnet | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| logbook | n4StatistiquesDuCarnet | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| logbook | statistiquesEtRecords | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| logbook | captureMeteoAutomatiqueOpenMeteo | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| logbook | lorsDeLEnregistrementDUn | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| equipment | gestionDuMateriel | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| equipment | pourVolerSereinementLApplication | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| equipment | n1EnregistrerSonEquipement | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| equipment | pourChaqueMaterielCarnet | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| equipment | pourChaqueMaterielCarnetSansMeteo | not-beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| equipment | n2PeriodiciteCombineeTemps | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| equipment | selectionnezLIntervalleTemporelRecommand | all | corrected | Hours counted since the last revision (cfcf23a, logbook_service.js hoursSinceRevision) |
| equipment | n3CodeCouleur | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| equipment | pourRepererRapidementLe | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| equipment | materielReviseRecemmentLa | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| equipment | vertOk | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| equipment | dateDeRevisionPrevue | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| equipment | dateDeRevisionExpiree | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| equipment | rougeDepassee | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| equipment | n4ArchiverOuSupprimer | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| equipment | lorsqueVousChangezDe | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| equipment | masqueLEquipementDesMenus | all | corrected | Inactive (archived) equipment raises no alert (cfcf23a) |
| equipment | archiver | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| equipment | effaceCompletementLeMateriel | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| equipment | supprimerDefinitivement | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| equipment | n5UsureEnHeures | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| equipment | leSystemeCroiseAutomatiquement | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| equipment | synchronisationCloudFirebase | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| equipment | desQueVousEtes | beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| equipment | desQueVousEtesSansMeteo | not-beta | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| safety | lEcranSecurite | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| safety | cetEcranReprendDes | all | corrected | Safety tabs urgence, prevol, sigr, ice (js/views/safety.js TABS); ICE is not FFVL content |
| safety | n1Urgence | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| safety | enUnGesteEt | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| safety | appelerLe112 | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| safety | elleUtiliseLeGps | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| safety | maPositionGps | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| safety | lesEtapesDeLAlerte | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| safety | conduiteATenir | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| safety | n2CheckLists | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| safety | les7PointsA | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| safety | visitePrevol | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| safety | unCourtQuestionnaireSur | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| safety | pretPourLeDeco | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| safety | n3MaSigr | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| safety | laStrategieIndividuelleDe | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| safety | n4FicheIceEtEtiquette | all | added | Safety tab « Fiche ICE / Casque » (fr.js safety.tabs.ice) |
| safety | ficheIceFormulaire | all | added | ICE form fieldsets and « Enregistrer dans mon profil » (fr.js ice.*) |
| safety | ficheIceEtiquette | all | added | ice.introHint, printStickerBtn, testViewBtn |
| safety | ficheIceDonneesDeSante | all | added | ice.cloud* strings; consent on each device (PRs 180, 305, 307) |
| qcm | entrainementAuxQcmOfficiels | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| qcm | ceModuleUtiliseLa | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| qcm | n1LesQuatreModes | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| qcm | cEstLeModePar | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| qcm | modeEntrainement | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| qcm | uneSimulationDeLExamen | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| qcm | modeExamen | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| qcm | revisionEspaceeUneQuestion | all | corrected | Corrected in spec 055: SM-2 intervals (js/services/review_scheduler.js); marked kept by mistake in 053 |
| qcm | modeRevision | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| qcm | choisissezUnNiveauGlobal | all | corrected | Corrected in spec 055: « Palier objectif » slider from current mastery + 1 % to 100 % (QuizService.getMasteryTargetBounds); marked kept by mistake in 053 |
| qcm | modePerfectionnement | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| qcm | n2ParametrageAvance | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| qcm | enModeEntrainementOu | all | corrected | Corrected in spec 055: count slider 5 to 50, last position = all (#qcm-count-slider); marked kept by mistake in 053 |
| qcm | n3LectureEtReponses | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| qcm | leBoutonLitLa | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| qcm | ditesLesLettresDes | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| qcm | repondreALaVoix | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| qcm | n4LaBanqueDe | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| qcm | accessibleDepuisLeMenu | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| qcm | n5LesAxesDeRevision | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| qcm | axesDeRevisionDescription | all | corrected | Priority labels (fr.js axes.status); mastered chapters/questions and empty filters hidden (PR 289); 21 axes (REVISION_AXES_CATALOG) |
| qcm | n6LesSiglesExpliques | all | added | Acronym popover in explanations only, with library source (PRs 251, 252, 309) |
| qcm | lesSiglesExpliquesTexte | all | added | Same as above |
| library | laBibliothequeDeCours | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| library | unEspaceCentralisantDe | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| library | n1NavigationEtTri | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| library | lesDocumentsSontClasses | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| library | categorisation | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| library | laBarreDeRecherche2 | all | corrected | Library search also matches course keywords (cfcf23a, js/views/manual.js) |
| library | rechercheRapide | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| library | textesOfficielsEtDocuments | all | added | New library entries (PRs 253, 260, 262; js/data/courses_data.js) |
| library | n2LectureDesCours | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| library | enCliquantSurUn | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| stats | suiviEtStatistiques | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| stats | ceTableauDeBord | all | corrected | Mastery tile labels (fr.js stats.mastery); no Perfectionnement launch from stats any more (data-actions in js/views/quiz_stats*.js); tiles multi-select (PR 316) |
| stats | n1AnalyseParTheme | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| stats | lApplicationCalculeVotrePourcentage | all | corrected | Faceted filters, « N dans la sélection », « Tout effacer » (PRs 316, 319) |
| stats | sEntrainerSurLaSelection | all | added | « S'entraîner sur ces N questions », « Retour aux statistiques », « Travailler mes axes prioritaires » (PRs 316, 317) |
| stats | n2HistoriqueDesExamens | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| stats | vousRetrouverezLHistoriqueDe | all | kept | Read against the PRs merged since 2026-11-07 and the screen strings; still accurate |
| stats | n3Reinitialisation | all | corrected | Heading now covers Exporter / Importer / Réinitialiser |
| stats | siVousSouhaitezRecommencer | all | corrected | Stats buttons Exporter, Importer, Réinitialiser (quiz_stats.js exportData/importData) |
