# Plan d'implémentation 048 — Modale de signalement et de suggestion (`#feedback-modal`)

**Branche** : `feat/feedback-modal`  
**Spec** : [spec.md](./spec.md)  

---

## Contexte technique

- **Architecture** : PWA statique en modules ES natifs (`Vite` en build), routage d'actions centralisé via `EventDelegator` / `AppEvents` (`js/core/events.js`, `js/core/main.js`), fenêtres modales sur `<dialog>` natif (`showModal()` / `close()`), chargement paresseux des vues via `lazyViewModule` + `viewProxy` (`js/core/router.js`).
- **Stockage** : `StorageService` (`js/services/storage.js`) sur `localStorage` pour le brouillon (`parapente_feedback_draft`).
- **Livraison par e-mail sans adresse publique** : API JSON Web3Forms (`POST https://api.web3forms.com/submit`) avec clé d'accès publique configurable dans `js/feedback_config.js` et option `customEndpoint` pour auto-hébergement ultérieur.
- **Tests** : Vitest (`jsdom`) pour service et vue + tests statiques transverses (`csp`, `action_wiring`, `inline_strings`, `static_texts`, `keyboard_access`, `route_code_splitting`, `sw_precache`, `icons_exist`) + Playwright pour les scénarios E2E (`feedback.spec.js`, `privacy.spec.js`).

---

## Contrôle Constitution (`.specify/memory/constitution.md`)

| Principe | Vérification | Mesures prévues |
|---|---|---|
| **I. Client-First & Vie Privée** | Conforme | Aucun envoi automatique ; contexte limité aux métadonnées non personnelles inspectables avant envoi ; zéro donnée de vol/GPS/ICE/email stocké. |
| **II. Sécurité (XSS, CSP, Secrets)** | Conforme | Utilisation stricte de `textContent` / `escapeHTML` ; CSP `connect-src` augmentée uniquement de `https://api.web3forms.com` ; `form-action 'self'` préservé via `fetch` JS ; aucune adresse e-mail ni secret privé dans le dépôt ; honeypot `botcheck`. |
| **III. Code Modulaire & Lazy Loading** | Conforme | Séparation `feedback_config.js` / `feedback_service.js` / `views/feedback.js` ; chargement paresseux dans `main.js` via `lazyViewModule` + `viewProxy`. |
| **IV. Conformité RGPD & Offline-First** | Conforme | Notice RGPD transparente dans `#feedback-modal` et `#gdpr-privacy-modal` ; brouillon local persistant ; repli « Copier le message » + lien Facebook hors ligne ou sans clé. |
| **V. i18n & Accessibilité** | Conforme | Clés dédiées dans `js/i18n/fr.js` et `js/i18n/fr_html.js` ; `<dialog>`, `aria-live="polite"`, `role="button" tabindex="0"` sur le lien du pied de page, fermeture clavier `Escape`. |
| **VI. Qualité & TDD** | Conforme | Tests Vitest et Playwright écrits avant l'implémentation (cycle Rouge → Vert → Refactor) ; lint, formatage, `tsc --noEmit` et build vérifiés. |
| **VII. Documentation & Spec Kit** | Conforme | `specs/048-feedback-modal/{spec,plan,tasks}.md` créés avant le code ; mise à jour de `DOCUMENTATION.md` si applicable. |
| **VIII. Anti-Régression** | Conforme | Ajout des nouveaux fichiers dans `sw.js` (`CRITICAL_ASSETS`) et `tests/views/inline_strings.test.js` (`SCREENS`) ; exécution des tests de confidentialité et de sécurité existants. |

---

## Découpage des fichiers modifiés / ajoutés

### Nouveaux fichiers
1. `js/feedback_config.js` — Configuration ES module gelée (`FEEDBACK_CONFIG`) avec `web3FormsAccessKey` (chaîne vide par défaut) et `customEndpoint`.
2. `js/services/feedback_service.js` — Logique métier pure : catégories, limites, validation, collecte non personnelle du contexte UI, formatage du message copiable, gestion du brouillon `StorageService`, appel `fetch` Web3Forms / endpoint personnalisé.
3. `js/views/feedback.js` — Contrôleur de `#feedback-modal` : ouverture/fermeture `<dialog>`, gestion des événements formulaire, aperçu du contexte en direct, statut accessible, copie presse-papiers avec feedback visuel, soumission asynchrone.
4. `tests/services/feedback_service.test.js` — Tests unitaires complets du service.
5. `tests/views/feedback_modal.test.js` — Tests unitaires DOM/jsdom de la modale et de la vue.
6. `tests/e2e/feedback.spec.js` — Tests Playwright E2E (ouverture pied de page, envoi mocké Web3Forms, brouillon persistant, mode hors ligne / copie, clavier).

### Fichiers mis à jour
1. `js/services/storage.js` — Ajout de `FEEDBACK_DRAFT: 'parapente_feedback_draft'` dans `StorageService.KEYS`.
2. `js/i18n/fr.js` — Ajout de l'espace de noms `feedback` (catégories, aides contextuelles, libellés, validations, statuts, formatage texte).
3. `js/i18n/fr_html.js` — Ajout de `footer.signalerProblemeSuggestion`, `feedbackModal.*` et mise à jour de `gdprPrivacyModal.*`.
4. `components/footer.html` — Ajout du séparateur et du lien `Signaler un problème / Suggestion` (`data-action="openFeedbackModal"`).
5. `index.html` — CSP `connect-src` (+ `https://api.web3forms.com`), bloc `<dialog id="feedback-modal">`, mention feedback dans `#gdpr-privacy-modal`.
6. `css/components.css` — Styles responsive et thèmes clair/sombre pour `.feedback-*`.
7. `js/core/main.js` — Enregistrement paresseux `feedbackModule` / `FeedbackView` et câblage des actions `AppEvents`.
8. `sw.js` — Ajout de `./js/feedback_config.js`, `./js/services/feedback_service.js`, `./js/views/feedback.js` dans `CRITICAL_ASSETS`.
9. `tests/views/inline_strings.test.js` — Ajout de `js/services/feedback_service.js` et `js/views/feedback.js` dans `SCREENS`.
10. `DOCUMENTATION.md` — Documentation des nouveaux modules si une table d'architecture liste les services/vues.
