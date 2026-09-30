/**
 * CORE - Main Boot Sequence
 * Entrypoint of the Parapente Application.
 */

import GlobalState from './app_state.js';
import AppRouter from './router.js';
import AppEvents from './events.js';
import UIManager from './ui_manager.js';
import StorageService from '../services/storage.js';
import GdprEngine from '../gdpr_engine.js';
import SitesService from '../services/sites_service.js';
import { initAppUpdateNotifier } from './app_update.js';

// Import Views
import QuizView from '../views/quiz.js';
import LogbookView from '../views/logbook.js';
import SitesView from '../views/sites.js';
import LibraryView from '../views/manual.js';
import QuizService from '../services/quiz_service.js';
import WelcomeView from '../views/welcome.js';
import SafetyView from '../views/safety.js';
import { resolveStartMode } from './start_mode.js';

async function bootApplication() {
    console.time('BOOT_TOTAL');
    console.log('🚀 Booting Application...');

    // 1. Initialize State & Core Services
    console.time('INIT_STATE_EVENTS');
    GlobalState.init();
    AppEvents.init();
    console.timeEnd('INIT_STATE_EVENTS');

    console.time('UI_INIT');
    // Launch UI components loading in background without blocking the boot sequence
    UIManager.init()
        .then(() => {
            console.timeEnd('UI_INIT');
        })
        .catch(console.error);

    // Initialisation du Global IGC Input
    const globalInput = document.getElementById('global-igc-input');
    if (globalInput) {
        globalInput.addEventListener('change', (e) => {
            const file = /** @type {HTMLInputElement} */ (e.target).files[0];
            if (!file) return;
            // Réutilise le traitement de logbook.js (parsing + remplissage + géolocalisation
            // du site par reverse-geocoding) plutôt qu'une copie qui en divergeait et
            // laissait le site à "Lieu détecté (GPS)" sans jamais le résoudre.
            LogbookView._processIgcFile(file);
            /** @type {HTMLInputElement} */ (e.target).value = ''; // Reset indispensable
        });
    }

    // Setup Global Event Listeners via EventDelegator
    AppEvents.register('navigate', (target) => AppRouter.navigate(target));
    AppEvents.register('toggleTheme', () => UIManager.toggleTheme());
    AppEvents.register('changeLevel', (level) => {
        GlobalState.set('level', level);
        if (window.FirebaseAuthEngine && window.FirebaseAuthEngine.enabled && window.FirebaseAuthEngine.currentUser) {
            window.FirebaseAuthEngine.savePreferencesToCloud();
            if (typeof window.FirebaseAuthEngine.triggerDebouncedSync === 'function') {
                window.FirebaseAuthEngine.triggerDebouncedSync();
            }
        }
    });
    AppEvents.register('goBack', () => {
        if (GlobalState.get('mode') === 'COURSE') {
            const frame = /** @type {HTMLIFrameElement} */ (document.getElementById('course-pdf-frame'));
            if (frame) frame.src = '';
            document.body.classList.remove('course-open');
            AppRouter.navigate('LIBRARY');
        } else if (window.history.length > 1) {
            window.history.back();
        } else {
            AppRouter.navigate('MENU');
        }
    });

    // Manual/Guide Events
    AppEvents.register('showManual', (section) => UIManager.showManual(section || 'about'));
    AppEvents.register('hideManual', () => UIManager.hideManual());
    AppEvents.register('showManualSection', (section) => UIManager.showManualSection(section));

    // QCM Events
    AppEvents.register('showQcmBank', () => QuizView.showBankScreen());
    AppEvents.register('setQcmMode', (mode, e, target) => {
        QuizService.setMode(mode);
        if (QuizView.updateModeUI) QuizView.updateModeUI(mode, target);
    });
    AppEvents.register('setQcmCount', (count, e, target) => {
        QuizService.setCount(count === 'ALL' ? 'ALL' : parseInt(count));
        if (QuizView.updateCountUI) QuizView.updateCountUI(count, target);
    });
    AppEvents.register('setMasteryTarget', (target, e, btn) => {
        QuizService.setMasteryTarget(parseInt(target));
        if (QuizView.updateMasteryTargetUI) QuizView.updateMasteryTargetUI(target, btn);
    });
    AppEvents.register('startQcmSession', () => QuizView.startSession());
    AppEvents.register('QuizreviewExam', (args) => QuizView.reviewExam(args));
    AppEvents.register('QuizshowStatsScreen', () => QuizView.showStatsScreen());

    // Library Events
    AppEvents.register('setLibrarySort', (sort) => LibraryView.setSort(sort));

    // Logbook Events mappings from extracted data
    [
        'switchTab',
        'setFormType',
        'resetForm',
        'resetEquipmentForm',
        'submitForm',
        'updateEquipmentNomPreview',
        'handleIgcUpload',
        'forceWeatherRefresh',
        'editEntry',
        'deleteEntry',
        'showTrace',
        'editEquipment',
        'deleteEquipment',
        'toggleEquipmentStatus',
        'triggerIgcUpload',
        'toggleCoordsPicker',
        'clearCoords',
    ].forEach((action) => {
        AppEvents.register('Logbook' + action, (args, e, t) =>
            LogbookView[action] ? LogbookView[action](args || e, e, t) : null,
        );
        AppEvents.register(action, (args, e, t) => (LogbookView[action] ? LogbookView[action](args || e, e, t) : null)); // Map without prefix too
    });

    // Sites Events mappings from extracted data
    [
        'switchMapMode',
        'openMoreMapsDropdown',
        'toggleFullscreen',
        'toggleDropdown',
        'geocodeAddress',
        'saveCurrentLocation',
        'requestGpsLocation',
        'changeWeatherModel',
        'updateWindLimits',
        'changeForecastMaxRange',
        'changeSortMode',
        'changeStrategy',
        'toggleFilterFavoritesOnly',
        'scrollToTop',
        'filterByTag',
        'filterByType',
        'renderList',
        'openSpotairModal',
        'closeSpotairModal',
        'closeMoreMapsDropdown',
        'closeGpsMenu',
        'refreshWeather',
    ].forEach((action) => {
        AppEvents.register('Sites' + action, (args, e, t) =>
            SitesView[action] ? SitesView[action](args, e, t) : null,
        );
    });

    // Sites service actions triggered by typing / Enter (see data-input-action, data-enter-action)
    ['updateWindLimits', 'updateSearchQuery', 'geocodeAddress'].forEach((action) => {
        AppEvents.register('SitesService' + action, (value) => SitesService[action](value));
    });
    AppEvents.register('SitesServicesetRadiusLimit', (value) => SitesService.setRadiusLimit(parseInt(value)));
    AppEvents.register('SitesServicetoggleHideUnflyable', (_value, _e, target) =>
        SitesService.toggleHideUnflyable(target.checked),
    );
    AppEvents.register('SitessetForecastOffset', (offset) => SitesService.setForecastOffset(parseInt(offset)));
    AppEvents.register('SitesopenSpotairModal', (_args, _e, target) =>
        SitesView.openSpotairModal(target.dataset.spotairId, target.dataset.siteId),
    );
    // "Valider" button next to #address-input: reads the field's live value at click time.
    // data-args can't carry that (it's a static HTML attribute), and it isn't JS to evaluate —
    // an earlier attempt here passed the literal string "document.getElementById('address-input')"
    // as the search query, so every click geocoded that text instead of the typed address.
    AppEvents.register('SitesvalidateAddress', () =>
        SitesService.geocodeAddress(/** @type {HTMLInputElement} */ (document.getElementById('address-input'))?.value),
    );

    // Safety (écran Secours / check-lists / SIGR)
    [
        'switchTab',
        'locate',
        'copyPosition',
        'sharePosition',
        'toggleCheck',
        'resetChecklist',
        'readChecklist',
        'answerReady',
        'resetReady',
        'ratePlate',
    ].forEach((action) => {
        AppEvents.register('Safety' + action, (args, e, t) => SafetyView[action](args, e, t));
    });

    // Generic UI helpers
    AppEvents.register('reloadApp', () => window.location.reload());
    AppEvents.register('openUrl', (_args, _e, target) =>
        window.open(target.dataset.url, '_blank', 'noopener,noreferrer'),
    );
    AppEvents.register('triggerClick', (id) => document.getElementById(id)?.click());
    AppEvents.register('toggleOtherField', (value, _e, target) => {
        const other = document.getElementById(target.dataset.toggleId);
        if (other) other.style.display = value === 'Autre' ? 'block' : 'none';
    });
    AppEvents.register('toggleTheorySubBar', () =>
        document.getElementById('theory-sub-bar')?.classList.toggle('active'),
    );
    document
        .getElementById('theory-sub-bar')
        ?.addEventListener('click', (e) => /** @type {HTMLElement} */ (e.currentTarget).classList.remove('active'));
    AppEvents.register('importDataFile', (_value, _e, target) => {
        const file = target.files[0];
        if (!file || !window.FirebaseAuthEngine) return;
        window.FirebaseAuthEngine.importAllData(file);
        target.value = '';
    });
    AppEvents.register('openGdprSettingsFromAuth', () => {
        GdprEngine.showModal('gdpr-settings-modal');
        window.FirebaseAuthEngine?.closeAuthModal();
    });

    // FirebaseAuth Events
    [
        'switchTab',
        'signIn',
        'signUp',
        'signOut',
        'forgotPassword',
        'syncDataWithCloud',
        'closeAuthModal',
        'openAuthModal',
        'exportAllData',
        'importAllData',
        'enablePushNotifications',
    ].forEach((action) => {
        AppEvents.register('FirebaseAuth' + action, (args, e, t) =>
            window.FirebaseAuthEngine && window.FirebaseAuthEngine[action]
                ? window.FirebaseAuthEngine[action](args, e, t)
                : null,
        );
    });

    // GDPR Events
    ['showModal', 'hideModal', 'acceptAll', 'refuseAll', 'saveCustomSettings'].forEach((action) => {
        AppEvents.register('Gdpr' + action, (args, e, t) =>
            GdprEngine[action] ? GdprEngine[action](args, e, t) : null,
        );
    });

    // --- FirebaseAuthEngine : chargé à la demande (SDK Firebase), exposé sur window pour les handlers ---
    import('../services/firebase_service.js')
        .then((module) => {
            window.FirebaseAuthEngine = module.FirebaseAuthEngine;
            if (window.FirebaseAuthEngine.init) {
                window.FirebaseAuthEngine.init();
            }
        })
        .catch((err) => console.log('Firebase module not loaded', err));
    // -------------------------

    // 3. Register Routes
    AppRouter.register('MENU', {
        mount: () => {
            document.body.classList.remove('course-open');
            const startScreen = document.getElementById('start-screen');
            if (startScreen) {
                startScreen.classList.add('active');
                const dashContent = /** @type {HTMLElement} */ (document.querySelector('.dashboard-content'));
                if (dashContent) dashContent.style.display = 'block';
            } else {
                // Fallback to SITES if no start-screen exists (legacy engine_v4_6.js behavior)
                AppRouter.navigate('SITES');
            }
        },
        unmount: () => {
            const startScreen = document.getElementById('start-screen');
            if (startScreen) startScreen.classList.remove('active');
        },
    });
    AppRouter.register('QCM', QuizView);
    AppRouter.register('QCM_BANK', QuizView);
    AppRouter.register('STATS', QuizView);
    AppRouter.register('LOGBOOK', LogbookView);
    AppRouter.register('SITES', SitesView);
    AppRouter.register('LIBRARY', LibraryView);
    AppRouter.register('WELCOME', WelcomeView);
    AppRouter.register('SAFETY', SafetyView);

    // 4. Initialize History API
    AppRouter.initHistory();

    // 5. Restore State or Default
    const params = new URLSearchParams(window.location.search);
    // Lien direct > dernière page ouverte > écran d'accueil (toute première visite uniquement)
    const startMode = resolveStartMode(params.get('mode'), StorageService.get('LAST_ACTIVE_ROUTE'));

    AppRouter.navigate(startMode);

    // 6. Connect to Firebase SDKs
    // Handled in Polyfills section

    console.timeEnd('BOOT_TOTAL');
    console.log('✅ Application Booted Successfully.');

    // Service Worker réactivé (cache offline pour les sites favoris + tuiles carte + assets
    // statiques) après un kill-switch temporaire : un ancien SW en "Cache First" sur
    // index.html rendait l'app impossible à mettre à jour, même en hard refresh. sw.js a été
    // réécrit avec un cache versionné (purge automatique de toute version différente à
    // l'activation) et un fetch réseau forcé pendant l'installation (voir commentaire en tête
    // de sw.js pour le détail du bug évité). On enregistre désormais dans tous les cas — les
    // navigateurs qui avaient encore l'ancien kill-switch actif reçoivent cette nouvelle
    // version au prochain contrôle de mise à jour du navigateur, comme n'importe quel SW.
    if ('serviceWorker' in navigator) {
        const swRegistration = navigator.serviceWorker.register('./sw.js').catch(() => null);
        initAppUpdateNotifier(swRegistration);
    }
}

// Start
document.addEventListener('DOMContentLoaded', () => {
    // Déclenche le chargement asynchrone des sites en arrière-plan sans bloquer le boot
    SitesService.ensureSitesLoaded().catch((e) => console.error('Erreur chargement asynchrone sites_data.json:', e));
    bootApplication();
});
