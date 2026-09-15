# 🚀 Pistes d'Évolution & R&D - Assistant Parapente

Ce fichier centralise les concepts techniques et les idées d'amélioration validés pour le futur, afin de ne pas perturber le code stable actuel.

---

## 🎨 1. Iconographie Officielle FFVL & SpotAir — ✅ FAIT (2026-09-15)
*Objectif : Remplacer les marqueurs génériques de la carte des sites par les icônes vectorielles dynamiques de la fédération.*

**Implémenté** dans `js/views/sites.js` (`buildSpotairMarkerIconUrl` + `updateMapMarkers`) : type de pratique et masque de vent binaire calculés depuis les données de site existantes, badge de couleur (volabilité en direct) conservé en surimpression puisque SpotAir n'encode pas la météo. **Écart avec la spec ci-dessous** : l'URL "Spots" (`icones/spots/spot.svg`) ne répond plus du tout, testée en direct avec toutes les combinaisons de paramètres — seule l'URL "POI" (`icones/pois/poi.svg`) répond et accepte les mêmes paramètres p/t/n/h/o, donc c'est celle-ci qui est utilisée en prod. À corriger si SpotAiR republie un endpoint "spots" dédié.

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

### Cache offline réel pour les sites favoris
Le `sw.js` existe déjà mais il faut vérifier qu'il précache bien les tuiles carte + la météo + les données de site pour les favoris, car en zone de déco/atterro le réseau est souvent absent. Prévoir un indicateur "dernière synchro" visible pour ne pas laisser croire qu'une météo vieille de plusieurs heures est en direct.

### Alertes météo push sur les sites favoris
S'appuyer sur le moteur de scoring déjà en place (`js/weatherScoring.js`) pour envoyer une notification (Notification API) quand une fenêtre de vol s'ouvre sur un site favori. Dépend du Service Worker actif (point précédent) + gestion des permissions navigateur.

### Digest "meilleure fenêtre des 7 prochains jours"
Le scoring répond aujourd'hui à "est-ce volable maintenant" mais pas "quel est le meilleur créneau à venir". Un résumé hebdo sur les sites favoris (même sans notif, juste affiché) éviterait de re-checker chaque site un par un.

---

## 🪂 5. Carnet de Vol & Matériel (validé 2026-09-14)

### Auto-tag du site de vol depuis la trace IGC
`js/services/logbook_service.js` ne fait aujourd'hui aucun lien avec `sites_data.json`. Au moment du parsing IGC (`js/services/igc_parser.js`), matcher le point de décollage au site connu le plus proche via `calculateDistance()` (déjà présent dans `js/utils/geo_utils.js`) et pré-remplir le champ "Lieu" automatiquement.

### Alertes de révision matériel proactives
Les périodes de révision (mois/heures) sont déjà définies dans `js/data/equipment_config.js` (`REVISION_PERIODS_MONTHS`, `REVISION_PERIODS_HOURS`), mais rien ne prévient l'utilisateur avant l'échéance. Ajouter un badge dashboard ou une notification (même mécanisme que l'alerte météo) qui alerte avant la date/heures limite plutôt que de devoir consulter la fiche matériel.

---

## ✈️ 6. Vue d'ensemble & Confort (validé 2026-09-14)

### Brief pré-vol unifié
Une vue unique combinant météo du site + niveau de brevet requis (BI/BP/BPC) + état des révisions matériel, plutôt que de checker ces trois choses séparément avant de partir voler. Capitalise sur les sections 4 et 5 ci-dessus.

### Indicateur de sync visible
`js/services/firebase_service.js` gère déjà tout le merge local/cloud (stats, historique, logbook, équipement) mais aucune UI ne montre "en attente de sync" / "synchronisé". Utile pour rassurer l'utilisateur en zone blanche, en cohérence avec le cache offline de la section 4.

### Comparateur multi-sites
Un tableau côte-à-côte du score d'exploitabilité de plusieurs sites favoris pour le jour même, pour décider où aller sans ouvrir chaque fiche une par une. Complète le digest 7 jours de la section 4.

---

## 📊 7. Stats & Fiabilité (validé 2026-09-14)

### Stats de vol avancées depuis l'IGC
`js/services/igc_parser.js` n'extrait aujourd'hui que durée, altitude max et gain. Les points GPS + altitude + timestamp permettent aussi de calculer le vario max (taux de montée), la distance parcourue et la vitesse max/moyenne — stats attendues par les pilotes (façon XCTrack/Strava), rien ne bloque techniquement.

### Indice de confiance météo multi-modèles
`weather_config.js` référence 4 modèles (AROME, ICON, GFS, ECMWF) mais `js/services/sites_service.js` (ligne ~219) n'en interroge qu'un seul à la fois, choisi manuellement. Comparer 2-3 modèles pour le même créneau et afficher un indice "modèles d'accord / en désaccord" donnerait un signal de fiabilité plus parlant qu'un chiffre brut.

---

## 🎓 8. Théorie & Sécurité (validé 2026-09-14)

### Spaced repetition réelle pour le mode Révision QCM
`js/services/quiz_service.js` (`startSession`, mode `REVISION`, ligne ~203) filtre déjà les questions par ratio de réussite (< 75% = à revoir), mais sans notion temporelle : une question ratée une fois il y a 6 mois pèse pareil qu'une ratée hier. Ajouter un vrai espacement (type SM-2 simplifié : intervalle qui grandit à chaque bonne réponse, se réinitialise à une erreur) rendrait la révision plus efficace qu'un simple seuil fixe.

### Content-Security-Policy
`index.html` ne déclare aucune CSP alors que l'app fait déjà un travail rigoureux d'échappement XSS (`js/core/security.js`, `escapeHTML` systématique). Une meta CSP (`default-src 'self'`, whitelist des domaines Firebase/API météo/tuiles carte) serait un renfort naturel en défense en profondeur, cohérent avec la politique de sécurité déjà en place.

> **À vérifier avant tout :** la section 2 (ruban 3D suspendu) semble déjà en grande partie implémentée dans `js/components/map_3d.js` (`_buildDeckLayers`, `_computeVarioSeries`, `_varioColor`, coloration par vario) — à requalifier "fait" plutôt que "R&D" si confirmé.

