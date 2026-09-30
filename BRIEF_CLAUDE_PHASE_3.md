# 🚀 Cahier des Charges - Phase 3 (Session 1) : Features Immédiates

**Destinataire :** Claude
**Statut de la base de code :** 100% stable, 109/109 tests au vert, 0 erreur ESLint, audit de sécurité validé.
**Objectif :** Intégrer les 5 premières fonctionnalités validées. Ne toucher à aucune architecture existante.

*(Note pour Claude : Les 10 autres idées discutées ont été sécurisées dans `ideas_roadmap.md` pour de futures itérations).*

---

## 📍 1. Auto-tagging intelligent du Site depuis IGC
* **Ce qui est attendu :** Lors de l'import d'une trace `.igc` dans `js/views/logbook.js`.
* **L'action :** Extraire les coordonnées GPS du premier point (le décollage) depuis `flightStats.data`. Utiliser `calculateDistance` de `js/utils/geo_utils.js` pour comparer ce point à la liste des sites (`SitesService.getSites()`). 
* **Critère :** Si le site le plus proche est à moins de 2-3 km, auto-remplir l'input texte "Lieu de vol".

## ✂️ 2. Auto-Nettoyage IGC (Détection Atterrissage Réel)
*(Problème ciblé : le pilote oublie de couper son GPS après avoir posé, faussant le temps de vol et la vitesse)*
* **L'action :** Améliorer l'algorithme de `igc_parser.js`.
* **La logique :** Parcourir la trace depuis la fin. Trouver le moment exact de l'atterrissage en détectant une chute de vitesse (< 5 km/h) combinée à une altitude qui ne varie plus (delta < 5m) sur une certaine fenêtre de temps.
* **Le but :** Tronquer la fin de la trace (la "marche vers la voiture") pour un temps de vol et une moyenne fidèles à 100%.

## 🧠 3. Apprentissage Espacé "Spaced Repetition" (QCM)
* **L'algorithme :** Implémenter un algorithme type SM-2 ultra-allégé dans `QuizService`.
* **La logique :** Bonne réponse = l'intervalle avant la prochaine révision grandit (1j -> 3j -> 7j -> 15j). Mauvaise réponse = l'intervalle retombe à zéro.
* **L'UI :** Sauvegarder un timestamp `nextReviewDate` pour chaque question. Le mode "Révision" tirera en priorité les questions dont la date est échue.

## ☁️ 4. Indicateur de Synchronisation Cloud discret
* **L'UI :** Ajouter un tout petit indicateur dans le header global.
* **Comportement :** Brancher l'indicateur sur l'état de `FirebaseService`. Delta non envoyé = pastille orange/grise. Tout est synchronisé = pastille cachée ou vert très pâle.

## 🆘 5. Module "Procédure d'Urgence" (Hors-ligne)
*Un bouton vital pour la sécurité, accessible de partout.*
* **Placement :** Bouton "⚠️ Secours" dans le menu de navigation principal (nav).
* **Fonctionnement :** Ouvre une page/modale 100% hors-ligne (fonctionnelle sans réseau) contenant :
  - La récupération instantanée des coordonnées GPS du téléphone (affichage décimal et degrés, pour l'hélico).
  - La fréquence sécurité FFVL (143.987 MHz).
  - Les numéros de secours (112, PGHM).
  - La trame radio type du message d'urgence (Message MAYDAY : Qui, Quoi, Où) à lire au micro.
