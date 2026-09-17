import js from '@eslint/js';
import globals from 'globals';

// Minimal, deliberately unopinionated: catch real bugs (no-var, prefer-const,
// eqeqeq, no-undef via eslint:recommended) without stylistic rules — those
// are Prettier's job, added separately later so the reformat diff never mixes
// with a logic change. Reassess strictness (no-unused-vars as error, curly,
// etc.) once this baseline has been live for a bit.
const projectGlobals = {
    // Legacy classic-script globals: this app is a zero-build-step SPA where
    // most business logic is ES modules, but a handful of files (weatherScoring.js,
    // gdpr_engine.js, igc_parser.js, map_3d.js, courses_data.js, firebase_config.js)
    // are loaded as plain <script> tags and share one global scope with each other
    // and with the module code that reads them off `window`.
    Engine: 'readonly',
    FirebaseAuthEngine: 'readonly',
    GdprEngine: 'readonly',
    IGCParser: 'readonly',
    LibraryEngine: 'readonly',
    LogbookEngine: 'readonly',
    LogbookView: 'readonly',
    Map3DComponent: 'readonly',
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
    COURSES_DATA: 'readonly',
    GENERATED_CONTENT: 'readonly',
    GlobalState: 'readonly',
    TEMPORARY_IGC_RAW: 'readonly',
    evaluateSpotForecast: 'readonly',
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
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_|^e$|^target$' }],
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
        // Classic (non-module) scripts: no import/export, share the page's
        // global script scope instead.
        files: [
            'js/weatherScoring.js',
            'js/gdpr_engine.js',
            'js/firebase_config.js',
            'js/components/map_3d.js',
            'js/data/courses_data.js',
            'js/services/igc_parser.js',
        ],
        languageOptions: {
            sourceType: 'script',
        },
        rules: {
            // These files intentionally declare the exact global (Map3DComponent,
            // COURSES_DATA, FIREBASE_CONFIG, GdprEngine, IGCParser...) that
            // `projectGlobals` above also lists — that entry exists so *other*
            // files reading it get no-undef coverage, not to flag its own
            // definition site.
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
