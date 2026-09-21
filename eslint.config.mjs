import js from '@eslint/js';
import globals from 'globals';

// Minimal, deliberately unopinionated: catch real bugs (no-var, prefer-const,
// eqeqeq, no-undef via eslint:recommended) without stylistic rules — those
// are Prettier's job, added separately later so the reformat diff never mixes
// with a logic change. Reassess strictness (no-unused-vars as error, curly,
// etc.) once this baseline has been live for a bit.
const projectGlobals = {
    // Globals restants : firebase_config.js (classic script, requis par sw.js) et
    // quelques références historiques lues via `window`.
    Engine: 'readonly',
    FirebaseAuthEngine: 'readonly',
    LibraryEngine: 'readonly',
    LogbookEngine: 'readonly',
    LogbookView: 'readonly',
    QCM_OFFICIAL: 'readonly',
    QuizEngine: 'readonly',
    QuizService: 'readonly',
    Security: 'readonly',
    SITES_DATA: 'readonly',
    SitesEngine: 'readonly',
    SitesService: 'readonly',
    SitesView: 'readonly',
    StorageService: 'readonly',
    AdventureEngine: 'readonly',
    COMPONENTS: 'readonly',
    GENERATED_CONTENT: 'readonly',
    GlobalState: 'readonly',
    TEMPORARY_IGC_RAW: 'readonly',
    IS_FIREBASE_ENABLED: 'readonly',
    FIREBASE_CONFIG: 'readonly',
    FCM_VAPID_KEY: 'readonly',
    // Third-party UMD builds loaded from CDN <script> tags (Leaflet, MapLibre GL, deck.gl).
    L: 'readonly',
    maplibregl: 'readonly',
    deck: 'readonly',
};

const baseRules = {
    ...js.configs.recommended.rules,
    'no-var': 'error',
    'prefer-const': 'error',
    eqeqeq: 'error',
    // Swallowing a non-critical error in an empty catch is a real, common
    // pattern in this codebase (best-effort cloud sync, optional parsing) —
    // not a smell worth flagging here.
    'no-empty': ['error', { allowEmptyCatch: true }],
    'no-unused-vars': ['error', { argsIgnorePattern: '^_|^e$|^target$' }],
};

export default [
    {
        ignores: [
            'node_modules/**',
            '.venv/**',
            'courses/**',
            'css/**',
            'img/**',
            'playwright-report/**',
            'test-results/**',
            '.claude/**',
            'js/data/*.json',
        ],
    },
    {
        files: ['js/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...projectGlobals,
            },
        },
        rules: baseRules,
    },
    {
        // Seul script classique restant : sw.js le charge via importScripts(), ce qui
        // exclut un module ES. Il déclare les globals que firebase_service.js lit.
        files: ['js/firebase_config.js'],
        languageOptions: {
            sourceType: 'script',
        },
        rules: {
            'no-redeclare': 'off',
        },
    },
    {
        files: ['sw.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: {
                ...globals.serviceworker,
                firebase: 'readonly',
                FIREBASE_CONFIG: 'readonly',
                IS_FIREBASE_ENABLED: 'readonly',
            },
        },
        rules: baseRules,
    },
    {
        files: ['tests/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.node,
                ...projectGlobals,
                describe: 'readonly',
                it: 'readonly',
                test: 'readonly',
                expect: 'readonly',
                beforeEach: 'readonly',
                afterEach: 'readonly',
                beforeAll: 'readonly',
                afterAll: 'readonly',
                vi: 'readonly',
            },
        },
        rules: baseRules,
    },
    {
        files: ['scripts/**/*.js', '*.config.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: { ...globals.node },
        },
    },
];
