# Tâches 048 — Modale de signalement et de suggestion

## Phase 1 — Spécification & Tests d'abord (TDD Rouge)

- [x] T001 Créer `specs/048-feedback-modal/spec.md`, `plan.md` et `tasks.md`
- [x] T002 Inspecter les extraits de référence (`js/utils/i18n_dom.js`, `js/i18n/fr_html.js` bloc `gdprPrivacyModal`, `sw.js` `CRITICAL_ASSETS`, `tests/e2e/gdpr_flow.spec.js`)
- [x] T003 Écrire les tests unitaires du service dans `tests/services/feedback_service.test.js`
- [x] T004 Écrire les tests unitaires de la vue dans `tests/views/feedback_modal.test.js`
- [x] T005 Écrire les tests E2E Playwright dans `tests/e2e/feedback.spec.js`
- [x] T006 Exécuter les tests Vitest ciblés et confirmer leur échec avant implémentation

## Phase 2 — Configuration, Stockage & Service

- [x] T007 Créer `js/feedback_config.js` avec `FEEDBACK_CONFIG` et les instructions Web3Forms
- [x] T008 Ajouter `FEEDBACK_DRAFT` dans `StorageService.KEYS` (`js/services/storage.js`)
- [x] T009 Implémenter `js/services/feedback_service.js` (validation, contexte non personnel, formatage, brouillon, soumission)

## Phase 3 — UI, i18n, Câblage & Offline

- [x] T010 Compléter `js/i18n/fr.js` (`feedback`) et `js/i18n/fr_html.js` (`footer`, `feedbackModal`, `gdprPrivacyModal`)
- [x] T011 Ajouter le lien dans `components/footer.html` (`data-action="openFeedbackModal"`)
- [x] T012 Ajouter `<dialog id="feedback-modal">`, mettre à jour la CSP `connect-src` et `#gdpr-privacy-modal` dans `index.html`
- [x] T013 Ajouter les styles `.feedback-*` dans `css/components.css`
- [x] T014 Implémenter `js/views/feedback.js`
- [x] T015 Câbler `feedbackModule`, `FeedbackView` et les `AppEvents` dans `js/core/main.js`
- [x] T016 Ajouter les nouveaux scripts dans `sw.js` (`CRITICAL_ASSETS`) et `tests/views/inline_strings.test.js` (`SCREENS`)

## Phase 4 — Documentation & Vérification complète

- [x] T017 Mettre à jour `DOCUMENTATION.md` si applicable
- [x] T018 Exécuter `npm run format`, `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm test`, `npm run build`
- [x] T019 Exécuter `npx playwright test tests/e2e/feedback.spec.js tests/e2e/privacy.spec.js tests/e2e/csp_no_violation.spec.js` (et la suite complète si nécessaire) et vérifier 0 échec
