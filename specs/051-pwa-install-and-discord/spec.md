# Spec 051 — Installation PWA en 1 clic & Intégration Communauté Discord

**Statut** : En cours  
**Branche** : `feat/pwa-install-and-discord`  
**Date** : 2026-11-20  

---

## Contexte et objectifs

Assistant Parapente est une Progressive Web App (PWA) conçue pour être utilisée aussi bien sur mobile (sur le décollage, à l'atterrissage, dans les navettes) que sur tablette et ordinateur (révisions théoriques, analyse des traces IGC).
Pour offrir la meilleure expérience utilisateur possible :
1. **Bouton d'installation sur l'écran d'accueil en 1 clic** :
   - Sur Android, Chrome et Chromium desktop : déclenchement direct du prompt natif d'installation via l'événement `beforeinstallprompt`.
   - Sur iOS Safari (iPhone / iPad) : Apple n'autorisant pas le déclenchement programmatique d'installation, un guidage visuel clair en 2 étapes (`Partager ⎋ -> Sur l'écran d'accueil ⊕ -> Ajouter`) est affiché dans une modale dédiée.
   - En mode autonome déjà installé (`display-mode: standalone` ou `navigator.standalone === true`) : le bouton d'installation est automatiquement masqué pour ne pas encombrer l'interface des pilotes qui ont déjà installé l'application.
2. **Bouton et lien Discord pour rejoindre la communauté** :
   - Accès immédiat au serveur Discord communautaire officiel « Assistant Parapente » (`https://discord.gg/mZsjqXmGn3`) depuis le menu d'en-tête, le pied de page et la modale de retours.
   - Respect absolu de l'architecture offline-first (zéro dépendance externe au démarrage, icône RemixIcon locale).

---

## User Stories

### US1 (P1) — Bouton d'installation PWA dans l'en-tête et le pied de page
En tant que pilote visitant l'application dans son navigateur, je veux voir un bouton d'installation sur l'écran d'accueil afin de l'installer en 1 clic sans devoir chercher dans les menus du navigateur.

**Critères d'acceptation** :
- Un bouton `#pwa-install-btn` est présent dans l'en-tête (`components/header.html`).
- Un lien `#footer-pwa-install-link` est présent dans le pied de page (`components/footer.html`).
- Si l'application tourne déjà en mode autonome (`isStandalone() === true`), tous les boutons d'installation restent masqués (`display: none`).
- Si l'application tourne dans un navigateur compatible (Android/Chromium avec `beforeinstallprompt` capturé) :
  - Le bouton est affiché.
  - Au clic, le prompt d'installation natif s'affiche (`deferredPrompt.prompt()`).
  - Après acceptation, le bouton est masqué et l'événement `appinstalled` est pris en compte.
- Si le pilote utilise iOS Safari :
  - Le bouton est affiché tant que l'app n'est pas en plein écran standalone.
  - Au clic, la modale d'aide visuelle `#pwa-install-modal` s'ouvre avec les 3 étapes illustrées.

### US2 (P1) — Modale d'accompagnement pour l'installation sur iOS Safari
En tant que pilote sur iPhone ou iPad, je veux comprendre en un coup d'œil comment ajouter l'application sur mon écran d'accueil malgré les restrictions d'iOS.

**Critères d'acceptation** :
- Dialogue accessible `<dialog id="pwa-install-modal">` avec fermeture par touche `Échap`, clic sur l'arrière-plan ou bouton de fermeture.
- Étape 1 : Toucher l'icône Partager Safari (`ri-share-box-line`).
- Étape 2 : Toucher « Sur l'écran d'accueil » (`ri-add-box-line`).
- Étape 3 : Toucher « Ajouter » en haut à droite.
- Bouton « J'ai compris » pour fermer.

### US3 (P1) — Bouton Discord pour rejoindre la communauté
En tant que pilote, je veux pouvoir rejoindre facilement le serveur Discord de la communauté pour échanger, poser des questions, partager des traces ou discuter avec l'auteur.

**Critères d'acceptation** :
- Bouton icône Discord `#discord-header-btn` dans le menu supérieur droit (`floating-user-menu`).
- Lien Discord dans le pied de page (`.footer-gdpr-links`).
- Bannière Discord dans la modale de signalement (`#feedback-modal`) invitant à échanger en direct.
- URL d'invitation permanente : `https://discord.gg/mZsjqXmGn3`.
- Liens ouverts dans un nouvel onglet avec `target="_blank" rel="noopener noreferrer"`.
- Totalement accessible au clavier et aux lecteurs d'écran (`aria-label`, infobulles `title`).
