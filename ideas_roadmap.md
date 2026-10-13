# 🚀 Pistes d'Évolution & R&D - Assistant Parapente

Ce fichier centralise les concepts techniques et les idées d'amélioration validés pour le futur, afin de ne pas perturber le code stable actuel.

**Légende :** ✅ fait · 🟡 partiel · ❌ abandonné · (sans marque) à faire. Statuts revérifiés dans le code le 2026-10-12.

### Fait récemment (2026-10-11 et 12)
- Export PDF du carnet et téléchargement `.igc` (9 et 10 ci-dessous).
- Type de vol pré-rempli d'après la trace IGC (4).
- Page stats du carnet redessinée, avec filtre de l'historique au clic (2).
- Secours compté en ouvertures et en défaut jusqu'au pliage (5).
- Découpage de `js/views/logbook.js` : 3 757 → ~1 180 lignes, en classes de base par onglet (matériel, stats, historique) et par rôle (coordonnées, sites, listes, pré-remplissage, import IGC).

### Priorités actuelles
1. Valider les seuils de la classification de vol (`CLASSIFICATION` dans `js/services/flight_classifier.js`) sur de vrais fichiers IGC : soaring de crête, journée thermique, cross.
2. Météo : digest « meilleur créneau des 7 prochains jours » sur les sites favoris (le meilleur créneau par site et le comparateur de favoris existent déjà).
3. Alertes de révision du matériel en notification, avant l'échéance.
4. Répétition espacée : facteur de difficulté par question (SM-2 complet) et rappel des questions à réviser (voir le point 5 de la phase 3).

### Secondaire
- Brief pré-vol unifié : une version simple existe déjà dans le panneau de chaque site (niveau de brevet sélectionné et état du matériel, secours ouvert compris). Reste, si utile, de l'unifier avec le verdict météo. Pas jugé prioritaire pour le moment.

---

## 🎨 1. Iconographie Officielle FFVL & SpotAir — ❌ ABANDONNÉ (vérifié 2026-09-15)
*Objectif : Remplacer les marqueurs génériques de la carte des sites par les icônes vectorielles dynamiques de la fédération.*

**Tenté puis annulé.** L'URL "Spots" (`icones/spots/spot.svg`) ne répond plus du tout, quels que soient les paramètres. L'URL "POI" (`icones/pois/poi.svg`) répond bien (HTTP 200, SVG valide) mais **ignore silencieusement tous les paramètres** (`p`, `t`, `o`, absents ou non) et renvoie toujours la même icône générique — vérifié en comparant 6 combinaisons de paramètres côte à côte, pixels identiques. Inspection du vrai site spotair.mobi (onglet réseau sur leur carte en direct) : aucune requête vers `icones/spots/` ou `icones/pois/` n'a lieu pour afficher leurs propres marqueurs — ils sont rendus autrement (tuiles vectorielles/canvas via leur propre lib JS), pas via cette API. Cette spec d'URL paramétrée ne correspond donc à aucun comportement observable de leur service actuel ; les marqueurs colorés d'origine (volabilité en direct) ont été restaurés dans `js/views/sites.js`. À revisiter uniquement si un vrai endpoint public équivalent est retrouvé/documenté.

### Spécifications de l'API SpotAir
Les icônes SVG sont générées à la volée via des paramètres d'URL :
- **Base URL Spots :** `https://www.spotair.mobi/icones/spots/spot.svg`
- **Base URL POI :** `https://www.spotair.mobi/icones/pois/poi.svg`

### Paramètres clés :
- `p` (Pratique) : `1` = Parapente, `2` = Delta, `3` = Speed-Riding.
- `t` (Type) : `1` = Déco, `2` = Atterro, `3` = Biplace (Déco+Atterro), `4` = Pente école, `8` = Treuil.
- `n` (Niveau IPPI) : `3` = Vert (BI), `4` = Bleu (BP), `5` = Marron (BPC).
- `h` (PMR) : `1` = Accessible.

### Logique des Vents (Masque Binaire sur 8 bits) :
Pour afficher les secteurs de vent favorables (`o`) ou défavorables (`od`), il faut additionner les puissances de 2 des directions :
- **N** : 1 | **NE** : 2 | **E** : 4 | **SE** : 8 | **S** : 16 | **SO** : 32 | **O** : 64 | **NO** : 128
*Exemple : Pour un déco exploitable par vent de Nord (1) et Nord-Ouest (128), l'URL contiendra `?o=129`.*

---

## ⛰️ 2. R&D Cartographie 3D (Traces Suspendues) — ✅ FAIT (vérifié 2026-09-14)
*Objectif : Obtenir une trace fine qui vole en altitude réelle sans l'effet "mur vertical" du fill-extrusion classique sous MapLibre GL JS.*

**Implémenté différemment de la piste ci-dessous, mais objectif atteint** : `js/components/map_3d.js` (`_buildDeckLayers`) utilise deck.gl (`PathLayer` en `positionFormat: 'XYZ'`) superposé à MapLibre plutôt que des couches de style MapLibre natives. deck.gl rend sa propre géométrie 3D en WebGL indépendamment du drapage terrain de MapLibre, donc le problème du "mur vertical" ne se pose jamais — pas besoin du hack MultiPolygon décrit plus bas. Le rendu est déjà en prod : trace colorée par vario (bleu=chute, rouge=ascendance), badge pilote (altitude + vario) qui suit la trace via `TextLayer`/`ScatterplotLayer` en XYZ, testé visuellement sur une vraie trace IGC (coloration + suspension au-dessus du relief confirmées).

<details>
<summary>Piste technique originale (non retenue, gardée pour mémoire)</summary>

### Piste technique : Le Ruban Horizontal (MultiPolygon)
Puisque MapLibre drape obligatoirement les couches `type: 'line'` sur le relief (DEM), la parade consiste à transformer mathématiquement la ligne de points GPS en une suite de dalles horizontales (polygones) très fines (5m de large) calculées en l'air.

### Structure du style :
```javascript
paint: {
    'fill-extrusion-color': '#ff6600',
    'fill-extrusion-opacity': 0.85,
    // On crée une épaisseur de seulement 2 mètres juste sous le vol
    'fill-extrusion-base': ['-', ['get', 'altitude'], 2], 
    'fill-extrusion-height': ['get', 'altitude']
}
```

Note : Veiller à lier le badge du pilote (Altitude/Vario) à une couche symbol WebGL pour qu'il reste accroché au ruban sans s'enterrer sous le relief.

</details>

---

## 💻 3. Optimisations UX Futures

Formulaires Intelligents (Vol 🔄 Gonflage)
•	Mémoire de bascule : Lors du switch entre les onglets "Vol" et "Gonflage" dans la section "Ajouter", implémenter un pont de données temporaire pour ne pas vider les champs communs déjà saisis (Date & Heure, Lieu, Voile, Sellette).
Module Théorie (Brevet Initial)
•	Reset d'Examen : Forcer la réinitialisation stricte de la variable globale selectedTheme = null lors de l'accès au "Mode Examen". Cela évitera que les filtres d'un entraînement thématique précédent ne brisent l'obligation d'avoir un examen blanc à 60 questions totalement aléatoires.

---

## 📡 4. Offline & Alertes (validé 2026-09-14)

### Cache offline réel pour les sites favoris — 🟡 PARTIEL (vérifié 2026-10-11)
*Fait : dernière prévision conservée hors ligne avec son horodatage (specs 007 et 008, `sw.js`). Reste à vérifier : mise en cache des tuiles de carte des favoris (voir 9.15).*
Le `sw.js` existe déjà mais il faut vérifier qu'il précache bien les tuiles carte + la météo + les données de site pour les favoris, car en zone de déco/atterro le réseau est souvent absent. Prévoir un indicateur "dernière synchro" visible pour ne pas laisser croire qu'une météo vieille de plusieurs heures est en direct.

### Alertes météo push sur les sites favoris — ✅ FAIT (vérifié 2026-10-11)
*Cloud Function `checkFavoriteSitesWeather` (toutes les 30 min, `functions/index.js`) + FCM + `sw.js`, scoring partagé avec `js/weatherScoring.js`.*
S'appuyer sur le moteur de scoring déjà en place (`js/weatherScoring.js`) pour envoyer une notification (Notification API) quand une fenêtre de vol s'ouvre sur un site favori. Dépend du Service Worker actif (point précédent) + gestion des permissions navigateur.

### Digest "meilleure fenêtre des 7 prochains jours" — 🟡 PARTIEL (vérifié 2026-10-11)
*Fait : « meilleur créneau à venir » par site (`js/views/sites.js`). Reste : le digest multi-sites sur 7 jours.*
Le scoring répond aujourd'hui à "est-ce volable maintenant" mais pas "quel est le meilleur créneau à venir". Un résumé hebdo sur les sites favoris (même sans notif, juste affiché) éviterait de re-checker chaque site un par un.

---

## 🪂 5. Carnet de Vol & Matériel (validé 2026-09-14)

### Auto-tag du site de vol depuis la trace IGC — ✅ FAIT (vérifié 2026-10-11)
*`LogbookView.findNearestSite` (rayon 500 m), testé dans `tests/services/igc_takeoff.test.js`.*
`js/services/logbook_service.js` ne fait aujourd'hui aucun lien avec `sites_data.json`. Au moment du parsing IGC (`js/services/igc_parser.js`), matcher le point de décollage au site connu le plus proche via `calculateDistance()` (déjà présent dans `js/utils/geo_utils.js`) et pré-remplir le champ "Lieu" automatiquement.

### Alertes de révision matériel proactives — 🟡 PARTIEL (vérifié 2026-10-11)
*Fait : pastille sur le menu Carnet et alertes par carte (date, heures). Un secours ne compte pas d'heures de vol mais ses ouvertures, et il est en défaut tant qu'il n'a pas été replié après la dernière ouverture. Reste : notification avant l'échéance.*
Les périodes de révision (mois/heures) sont déjà définies dans `js/data/equipment_config.js` (`REVISION_PERIODS_MONTHS`, `REVISION_PERIODS_HOURS`), mais rien ne prévient l'utilisateur avant l'échéance. Ajouter un badge dashboard ou une notification (même mécanisme que l'alerte météo) qui alerte avant la date/heures limite plutôt que de devoir consulter la fiche matériel.

---

## ✈️ 6. Vue d'ensemble & Confort (validé 2026-09-14)

### Brief pré-vol unifié — 🟡 PARTIEL, secondaire (vérifié 2026-10-13)
*Fait : un « Brief pré-vol » dans le panneau de chaque site (`buildPreFlightBriefHtml`, `js/views/sites.js`) : niveau de brevet sélectionné à confronter aux dangers du site, et état du matériel via `LogbookService.countEquipmentAlerts` (même règle que la pastille du Carnet : date, heures, secours ouvert non replié). Les check-lists de prévol sont à part, dans `safety.js`. Reste : l'unifier avec le verdict météo du créneau.*
Une vue unique combinant météo du site + niveau de brevet requis (BI/BP/BPC) + état des révisions matériel, plutôt que de checker ces trois choses séparément avant de partir voler. Capitalise sur les sections 4 et 5 ci-dessus.

### Indicateur de sync visible — ✅ FAIT (vérifié 2026-10-11)
*Pastille `sync-active-dot` : bleu pendant la synchro, orange si des modifications sont en attente, masquée sinon (`firebase_service.js`).*
`js/services/firebase_service.js` gère déjà tout le merge local/cloud (stats, historique, logbook, équipement) mais aucune UI ne montre "en attente de sync" / "synchronisé". Utile pour rassurer l'utilisateur en zone blanche, en cohérence avec le cache offline de la section 4.

### Comparateur multi-sites — ✅ FAIT (vérifié 2026-10-13)
*Bouton « Comparer mes favoris » : tableau côte à côte des sites favoris pour le créneau affiché (`renderComparator`, `js/views/sites.js`), avec le contexte de la prévision.*
Un tableau côte-à-côte du score d'exploitabilité de plusieurs sites favoris pour le jour même, pour décider où aller sans ouvrir chaque fiche une par une. Complète le digest 7 jours de la section 4.

---

## 📊 7. Stats & Fiabilité (validé 2026-09-14)

### Stats de vol avancées depuis l'IGC — ✅ FAIT (vérifié 2026-10-11)
*`igc_parser.js` extrait vario, distance, vitesses, thermiques ; records personnels interactifs dans l'onglet Stats du carnet.*
`js/services/igc_parser.js` n'extrait aujourd'hui que durée, altitude max et gain. Les points GPS + altitude + timestamp permettent aussi de calculer le vario max (taux de montée), la distance parcourue et la vitesse max/moyenne — stats attendues par les pilotes (façon XCTrack/Strava), rien ne bloque techniquement.

### Indice de confiance météo multi-modèles — 🟡 PARTIEL (vérifié 2026-10-11)
*Fait : comparaison de deux modèles avec indication d'accord (`loadModelComparison`). Reste : étendre à 3 modèles ou plus.*
`weather_config.js` référence 4 modèles (AROME, ICON, GFS, ECMWF) mais `js/services/sites_service.js` (ligne ~219) n'en interroge qu'un seul à la fois, choisi manuellement. Comparer 2-3 modèles pour le même créneau et afficher un indice "modèles d'accord / en désaccord" donnerait un signal de fiabilité plus parlant qu'un chiffre brut.

---

## 🎓 8. Théorie & Sécurité (validé 2026-09-14)

### Spaced repetition réelle pour le mode Révision QCM — ✅ FAIT (vérifié 2026-10-13)
*Correction : cette note était périmée. Le mode Révision planifie déjà les questions dans le temps : série de bonnes réponses (`streak`) et date de dernière présentation (`lastSeen`), intervalles de 0, 1, 3, 7, 14 puis 30 jours, états fusionnés entre appareils. Fait en plus (spec 035) : logique extraite et testée dans `js/services/review_scheduler.js`, ligne « À réviser : N · Nouvelles : M » dans l'écran du mode, message honnête quand rien n'est à réviser.*
`js/services/quiz_service.js` (`startSession`, mode `REVISION`, ligne ~203) filtre déjà les questions par ratio de réussite (< 75% = à revoir), mais sans notion temporelle : une question ratée une fois il y a 6 mois pèse pareil qu'une ratée hier. Ajouter un vrai espacement (type SM-2 simplifié : intervalle qui grandit à chaque bonne réponse, se réinitialise à une erreur) rendrait la révision plus efficace qu'un simple seuil fixe.

### Content-Security-Policy — ✅ FAIT (vérifié 2026-10-11)
*Balise `Content-Security-Policy` dans `index.html`.*
`index.html` ne déclare aucune CSP alors que l'app fait déjà un travail rigoureux d'échappement XSS (`js/core/security.js`, `escapeHTML` systématique). Une meta CSP (`default-src 'self'`, whitelist des domaines Firebase/API météo/tuiles carte) serait un renfort naturel en défense en profondeur, cohérent avec la politique de sécurité déjà en place.



## 🚀 9. Phase 3 & Idées Validées (2026-09-26)
### 1. Auto-tagging intelligent du Site depuis IGC — ✅ FAIT (vérifié 2026-10-11)
Extraire le point de décollage depuis l'IGC et trouver le site le plus proche dans `SITES_DATA` (rayon de 2-3km) pour pré-remplir le lieu de vol.

### 2. Exploitation avancée des statistiques IGC — 🟡 PARTIEL (vérifié 2026-10-12)
*Fait : records et totaux, page stats redessinée (cartes, barres, grille adaptative) avec filtre de l'historique au clic sur une statistique. Reste à confirmer : profil altimétrique 2D coloré par le vario dans le détail d'un vol (la coloration existe en 3D, `map_3d.js`).*
Dashboard avec records (Vitesse max, Thermique max, Distance). Profil altimétrique 2D coloré par le Vario dans la vue de détail du vol.

### 3. Auto-Nettoyage IGC (Détection Atterrissage Réel) — ✅ FAIT (vérifié 2026-10-11)
*`detectLandingIndex` dans `igc_parser.js`.*
Tronquer automatiquement la fin de la trace IGC (la marche vers la voiture) en détectant une vitesse < 5 km/h et une altitude constante, pour des stats de vol exactes.

### 4. Auto-Classification du Vol (Analyse IGC) — ✅ FAIT (vérifié 2026-10-12)
*À l'import d'une trace dans une nouvelle session, le type est pré-rempli et la ligne sous le formulaire dit pourquoi ; un type choisi par le pilote n'est jamais remplacé (`js/services/flight_classifier.js`, spec 034). Règles : Treuil (remorquage détecté), Cross (thermique ≥ 50 m et distance libre ≥ 15 km), Thermique, Soaring (≥ 10 min, vario moyen ≥ -0,6 m/s, sans thermique, au moins 3 demi-tours), sinon Plouf. « Restit » ne se lit pas dans une trace. Les seuils sont des estimations, validées sur des traces synthétiques et un seul vol réel : à ajuster sur d'autres vols (priorité 2). Reste du point d'origine : le graphique de répartition.*
L'app tague le vol (Plouf, Thermique, Soaring, Cross) en analysant la géométrie de la trace (virages 360, inversions de cap, distance max). Affichage d'un graphique de répartition.

### 5. Apprentissage Espacé "Spaced Repetition" (QCM) — 🟡 PARTIEL (vérifié 2026-10-13)
*Fait : intervalles croissants 1, 3, 7, 14, 30 jours selon la série de bonnes réponses, remise à zéro à l'erreur, tirage prioritaire des questions échues, affichage du nombre de questions à réviser. Reste : le facteur de difficulté par question de SM-2 (intervalles fixes aujourd'hui) et un rappel (notification) des questions à réviser.*
Algorithme SM-2. Bonne réponse = intervalle grandi (1j, 3j, 7j). Mauvaise réponse = reset. Tirage prioritaire des questions échues.

### 6. Indicateur de Synchronisation Cloud discret — ✅ FAIT (vérifié 2026-10-11)
Petite pastille de couleur (orange=en attente, vert/invisible=sync) branchée sur l'état de `FirebaseService`.

### 7. Espaces Aériens 3D (TMA / CTR)
Intégration d'OpenAIP dans Deck.GL avec une option "Afficher les espaces aériens" désactivable par défaut.

### 8. Prédiction de Plafond (Météo Avancée)
Affichage de l'isotherme 0°C ou couverture nuageuse base (`cloudbase`) via Open-Meteo.

### 9. Export de la Trace IGC (Déclaration CFD / XContest) — ✅ FAIT (vérifié 2026-10-12)
*Bouton « Télécharger l'IGC » sur les vols avec trace : le fichier d'origine, sans modification, nommé `<date>_<site>.igc` (spec 033).*
Bouton pour recréer le fichier `.igc` depuis `rawIgc` et le télécharger sur le téléphone/PC.

### 10. Export PDF du Carnet de Vol (Bilan FFVL) — ✅ FAIT (vérifié 2026-10-12)
*Bouton « Exporter en PDF » : bilan A4 imprimable du carnet (sessions par date, totaux vols et gonflage), via la boîte d'impression du navigateur, sans dépendance et hors ligne (spec 033).*
Bouton pour générer un PDF A4 tabulaire du carnet (Date, Site, Voile, Durée, Commentaires).

### 11. Partage Météo aux Copains (Visuel WhatsApp)
Générer une image / canvas propre du bloc Météo pour la partager facilement.

### 12. Module "Procédure d'Urgence" (Hors-ligne) — ✅ FAIT (2026-09-26)
*Écran `SAFETY` (`js/views/safety.js`), onglet Urgence. Contenu repris de l'affiche FFVL « Secours vol libre » 2022. Fréquence exacte : 143,9875 MHz. Pas de trame « MAYDAY » : l'affiche FFVL ne la mentionne pas.*

Bouton "⚠️ Secours" dans le menu. Modale offline avec : GPS décimal/degrés, fréquence FFVL (143.987 MHz), numéros d'urgence, trame MAYDAY.

### 13. Calendrier de Vol façon "GitHub" (Heatmap Annuelle)
Grille annuelle où les jours avec vols sont colorés selon l'intensité (durée/nombre).

### 14. Calculateur de "Polaire de Vitesses" Réelle
Analyse des lignes droites (transitions) de l'IGC pour tracer le Taux de Chute vs Vitesse Sol de l'aile du pilote.

### 15. Cartographie Topographique 100% Hors-Ligne (Mise en cache)
Bouton pour aspirer et cacher (IndexedDB) les tuiles MapLibre vectorielles de la zone affichée pour un usage sans réseau.

### 16. Générateur "QR Code Secours" (ICE) pour Casque
Dans le module d'urgence ou le profil, générer une petite étiquette imprimable avec un QR Code. L'étiquette mentionne clairement "INFO SECOURS / ICE". Au scan, le QR Code affiche le groupe sanguin, allergies, et contacts d'urgence du pilote.

### 17. Score d'Efficacité en Thermique
L'analyse IGC calcule le ratio entre le temps passé à chercher le thermique (virages en S, zérotage) et le temps passé à l'enrouler efficacement (spirale). Donne un pourcentage d'efficacité affiché dans le carnet.

### 18. Module "Checklist Pré-vol" — ✅ FAIT (2026-09-26)
*⚠️ Correction : dans le vocabulaire FFVL, SIGR veut dire « Stratégie Individuelle de Gestion des Risques » (affiche FFVL 2019, modèle de Reason). Ce n'est pas une check-list « Sangles / Instruments / Goupille / Radio ». Ce qui a été fait : la prévol officielle en 7 points (livret Initiation 2025), la check-list « Prêt pour le déco ? » (livret 9BD) et une auto-évaluation SIGR, dans l'écran `SAFETY`.*

Une section d'assistance au décollage affichant la checklist vitale de pré-vol (SIGR : Sangles, Instruments, Goupille de secours, Radio, etc.). L'idée est de fournir une interface claire, peut-être avec une option pour se la faire lire à voix haute par le téléphone pour avoir les mains libres, afin de garantir une sécurité maximale avant de décoller.

### 19. Le "Sniper" Météo (Alertes Push Sur-Mesure) — 🟡 PARTIEL (vérifié 2026-10-11)
*Les alertes push utilisent déjà les préférences de scoring de chaque utilisateur ; reste à vérifier la finesse par site (plafond, orientation, jours de la semaine).*
Plutôt qu'une alerte météo générique, permettre au pilote de configurer ses "Conditions Idéales" par site (ex: Plafond > 2000m, Vent < 15km/h, Orientation N/NE, uniquement le week-end). Une Cloud Function surveille ces critères et envoie une notification push uniquement quand la fenêtre parfaite s'ouvre.

### 20. Tableau de Bord "Navettes & Covoiturage"
Un module temps réel sur la fiche du site pour mettre en relation les pilotes à l'atterrissage cherchant à monter, et les conducteurs offrant des places dans leur voiture vers le décollage. Évite la saturation des groupes WhatsApp.

### 21. Optimiseur de Triangle FAI (Planificateur Cross)
Lié à l'outil de planification de route : une fois 2 balises posées sur la carte, l'application dessine la zone d'intersection mathématique obligatoire où le pilote doit placer son 3ème point pour que le triangle respecte la règle FAI des 28%.
