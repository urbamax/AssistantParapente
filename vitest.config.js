import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'happy-dom',
        // Le simulateur de navigateur n'ouvre jamais d'autre page ni de cadre : sans cela, un test qui clique
        // un lien target="_blank" ou insère une <iframe src> lui fait charger l'adresse sur un serveur
        // localhost:3000 inexistant, et des erreurs ECONNREFUSED s'affichent dans la sortie des tests.
        environmentOptions: {
            happyDOM: {
                settings: {
                    disableIframePageLoading: true,
                    navigation: { disableChildPageNavigation: true, disableChildFrameNavigation: true },
                },
            },
        },
        setupFiles: ['./tests/setupTests.js'],
        globals: true,
        // Le délai par défaut (5 s) est trop juste quand la suite complète tourne sur une machine chargée
        // (vérification du pré-push, CI) : des tests sans rapport entre eux le dépassent au hasard et bloquent
        // l'envoi. Le délai ne sert qu'à arrêter un test qui ne finit jamais, 30 s y suffisent.
        testTimeout: 30_000,
        hookTimeout: 30_000,
        // .claude/ : copies de travail des autres sessions (worktrees), jamais les tests de ce dépôt.
        // tests/firestore_rules : exigent l'émulateur Firestore, voir vitest.rules.config.js (npm run test:rules).
        exclude: ['**/node_modules/**', '**/dist/**', '**/tests/e2e/**', '**/tests/firestore_rules/**', '.claude/**'],
        // npm run test:coverage : résumé dans le terminal et rapport détaillé dans coverage/index.html
        // (fichiers du code de l'application seulement : ni les données, ni la configuration Firebase).
        coverage: {
            provider: 'v8',
            include: ['js/**/*.js'],
            exclude: ['js/data/**', 'js/firebase_config.js'],
            reporter: ['text-summary', 'html'],
            thresholds: {
                statements: 75,
                branches: 70,
                functions: 75,
                lines: 75,
            },
        },
    },
});
