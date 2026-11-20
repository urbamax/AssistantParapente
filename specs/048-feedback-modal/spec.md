# Spec 048 — Fenêtre de signalement de problème et de suggestion (`#feedback-modal`)

**Statut** : En cours  
**Branche** : `feat/feedback-modal`  
**Date** : 2026-11-15  

---

## Contexte et objectifs

Assistant Parapente ne dispose actuellement d'aucun espace dédié permettant aux pilotes et élèves de signaler un problème technique, une erreur dans les QCM/cours, une inexactitude sur un site de vol/météo ou de proposer une amélioration. Le dépôt GitHub public interdit les issues publiques (`README.md`) et l'auteur souhaite **ne jamais exposer d'adresse e-mail personnelle** dans le code source public tout en **recevant les messages par e-mail** de façon simple, gratuite et compatible avec l'architecture statique (PWA / Raspberry Pi + Firebase Hosting).

---

## User Stories

### US1 (P1) — Accès depuis le pied de page et ouverture accessible
En tant que pilote, je veux cliquer sur un lien « Signaler un problème / Suggestion » dans le pied de page afin d'ouvrir une fenêtre dédiée depuis n'importe quel écran de l'application.

**Critères d'acceptation** :
- Le lien apparaît dans `.footer-gdpr-links` (`components/footer.html`) avec `role="button"` et `tabindex="0"`.
- Un clic, `Entrée` ou `Espace` sur ce lien ouvre `<dialog id="feedback-modal">`.
- `Échap`, le bouton de fermeture `×` ou un clic sur l'arrière-plan ferme la modale proprement et restaure la navigation.

### US2 (P1) — Formulaire complet, contexte technique transparent et brouillon persistant
En tant que pilote, je veux rédiger un retour structuré et précis avec un minimum d'effort tout en gardant un contrôle total sur les informations techniques transmises.

**Critères d'acceptation** :
- Sélecteur de catégorie (5 choix) avec texte d'aide adapté à la catégorie sélectionnée :
  1. `bug` — Bug / problème technique
  2. `qcm_course` — Erreur QCM ou cours
  3. `site_weather` — Erreur site de vol ou météo
  4. `suggestion` — Suggestion d'amélioration
  5. `other` — Autre remarque
- Champ **Objet** optionnel (120 caractères max).
- Champ **Description détaillée** obligatoire (entre 10 et 3 000 caractères), avec compteur de caractères.
- Champ **Contact** optionnel (120 caractères max : e-mail pour réponse ou pseudo ; transmet `replyto` uniquement si c'est une adresse e-mail valide).
- Bloc **Contexte technique non personnel** coché par défaut, inspectable en direct dans un aperçu `<pre>` avant envoi, incluant uniquement :
  - version de l'application (`data-app-version` / `meta`),
  - écran actif (`GlobalState.get('mode')`),
  - niveau sélectionné (`GlobalState.get('userLevel')`),
  - thème actif (`GlobalState.get('themeMode')`),
  - dimensions du viewport (`window.innerWidth x window.innerHeight`),
  - mode d'exécution (`PWA` vs `Navigateur`),
  - état réseau (`En ligne` / `Hors ligne`),
  - identifiant contextuel non personnel si visible à l'écran : code QCM affiché (`.bank-item-code`), site déplié (`details.site-details-toggle[open][data-site-id]`), ou sous-onglet actif carnet/sécurité.
  - **Exclusion stricte** : aucune donnée de carnet de vol, position GPS, fiche ICE, historique QCM ou e-mail de compte.
- Sauvegarde automatique du brouillon dans `localStorage` (`StorageService.KEYS.FEEDBACK_DRAFT`) à chaque saisie/changement, restaurée à la réouverture de la modale, et bouton « Effacer le brouillon ».

### US3 (P1) — Envoi par e-mail sans adresse publique et repli complet hors ligne
En tant que pilote et en tant qu'éditeur du site, je veux que le message soit envoyé par e-mail sans exposer d'adresse personnelle dans le dépôt, avec une solution de secours fiable hors ligne ou si le service d'envoi est indisponible ou non configuré.

**Critères d'acceptation** :
- Utilisation de **Web3Forms** (`POST https://api.web3forms.com/submit`) avec clé publique `FEEDBACK_CONFIG.web3FormsAccessKey` configurable dans `js/feedback_config.js` (et support optionnel de `FEEDBACK_CONFIG.customEndpoint`).
- Aucun secret ni aucune adresse e-mail personnelle stockés dans le code source.
- Champ honeypot caché (`botcheck`) : s'il est rempli, aucune requête réseau n'est émise.
- En cas de succès HTTP avec `{ success: true }`, affichage d'un message de confirmation clair et suppression du brouillon local.
- Si l'appareil est hors ligne, si `web3FormsAccessKey` (et `customEndpoint`) ne sont pas configurés, ou en cas d'erreur réseau/API :
  - le brouillon reste conservé localement,
  - un message explicite oriente l'utilisateur vers le bouton **« Copier le message »** (qui copie un texte proprement formaté catégorie + objet + description + contact + contexte si coché) et le lien vers le profil Facebook de l'auteur (`https://www.facebook.com/maxime.urbaniak/`).

### US4 (P2) — Transparence RGPD et zéro requête tierce au démarrage
En tant que pilote soucieux de sa vie privée, je veux qu'aucune requête vers un service de feedback ne soit effectuée au chargement de l'application et être clairement informé avant d'envoyer un message.

**Critères d'acceptation** :
- Zéro requête vers `api.web3forms.com` au démarrage de l'application (`tests/e2e/privacy.spec.js`).
- Requête émise **uniquement** sur clic explicite sur « Envoyer » (hors hors-ligne/honeypot/clé vide).
- Mention claire dans `#feedback-modal` sur la finalité et l'absence de traceur/stockage serveur inutile.
- Mise à jour cohérente de `#gdpr-privacy-modal` (`index.html` et `js/i18n/fr_html.js`).

---

## Exigences fonctionnelles

- **FR-001** : Lien `data-action="openFeedbackModal"` dans `components/footer.html` avec `data-i18n="footer.signalerProblemeSuggestion"`, `role="button"`, `tabindex="0"`.
- **FR-002** : Modale `<dialog id="feedback-modal" class="gdpr-modal-overlay" data-backdrop-action="closeFeedbackModal">` dans `index.html`, stylisée en thèmes clair et sombre et responsive sur mobile.
- **FR-003** : Vue `js/views/feedback.js` chargée paresseusement via `lazyViewModule` + `viewProxy` dans `js/core/main.js` (sans import statique vers `js/views/` hors `views/`).
- **FR-004** : Service pur `js/services/feedback_service.js` gérant validation, collecte de contexte non personnel, formatage texte, gestion du brouillon `StorageService.KEYS.FEEDBACK_DRAFT`, et soumission `fetch` JSON.
- **FR-005** : Fichier de configuration ES module `js/feedback_config.js` contenant `FEEDBACK_CONFIG` (`web3FormsAccessKey: ''`, `customEndpoint: ''`) et les instructions de configuration en français.
- **FR-006** : Directive CSP `connect-src` dans `index.html` étendue avec `https://api.web3forms.com` ; `form-action 'self'` conservé (pas de `<form action>` externe).
- **FR-007** : Toutes les chaînes utilisateur externalisées dans `js/i18n/fr.js` et `js/i18n/fr_html.js`, sans chaîne française en dur dans les modules JS.
- **FR-008** : Pré-cache Service Worker mis à jour dans `sw.js` (`CRITICAL_ASSETS`) pour `js/feedback_config.js`, `js/services/feedback_service.js` et `js/views/feedback.js`.
- **FR-009** : Gestion complète des erreurs et fallbacks (« Copier le message », lien Facebook `rel="noopener noreferrer"`).

---

## Cas limites

- Description trop courte (< 10 caractères après `trim()`) ou absente → erreur de validation claire, focus sur le champ, aucun envoi réseau.
- Description > 3 000 caractères ou objet > 120 caractères → erreur de validation / limitation propre.
- Contact renseigné mais non e-mail (ex. `@pseudo`) → conservé dans le corps du message, champ `replyto` omis pour éviter un rejet Web3Forms.
- Contact renseigné sous forme d'e-mail valide → transmis en `replyto` à Web3Forms et affiché dans le message formaté.
- Clipboard API indisponible ou refusée → repli sur sélection/copie ou message d'erreur explicite sans exception non capturée.
- Mode hors ligne (`navigator.onLine === false`) ou `web3FormsAccessKey === ''` → refus d'appel réseau inutile, message explicite orientant vers la copie locale et brouillon préservé.

---

## Critères de succès

- **SC-001** : Tous les tests unitaires (`tests/services/feedback_service.test.js`, `tests/views/feedback_modal.test.js`) et E2E (`tests/e2e/feedback.spec.js`) passent.
- **SC-002** : Tous les garde-fous existants (`csp.test.js`, `action_wiring.test.js`, `inline_strings.test.js`, `static_texts.test.js`, `keyboard_access.test.js`, `route_code_splitting.test.js`, `sw_precache.test.js`, `icons_exist.test.js`, `third_party.test.js`, `privacy.spec.js`) passent sans exception.
- **SC-003** : `npm run lint`, `npm run format:check`, `npm run typecheck` et `npm run build` réussissent sans erreur ni avertissement.
- **SC-004** : Aucune adresse e-mail personnelle ni clé privée n'apparaît dans le diff.
