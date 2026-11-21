/**
 * SERVICE - Firebase Wrapper (ES6)
 * Wraps the legacy firebase_engine to preserve sync logic exactly as requested.
 */
import StorageService from './storage.js';
import GdprEngine from '../gdpr_engine.js';
import { isStatsConsentGranted } from './consent_store.js';
import AppRouter from '../core/router.js';
import GlobalState from '../core/app_state.js';
import SitesService from './sites_service.js';
import LogbookService from './logbook_service.js';
import IDBStorage from './idb_storage.js';
import {
    TRACE_UPLOADS_PER_SYNC,
    deleteFlightTraceParts,
    downloadFlightTrace,
    needsTraceUpload,
    stripTrace,
    uploadFlightTrace,
} from './flight_trace_sync.js';
import { t } from '../utils/i18n.js';
import AccessService from './access_service.js';
import { getIceCloudState, setIceCloudState, disableIceCloud } from './ice_cloud_state.js';
import {
    getLocalExamHistory,
    getLocalPreferences,
    getLocalQcmStats,
    latestReviewState,
    mergeAnswers,
    mergeChoiceMisses,
    mergeChoicePicks,
    mergeExamHistory,
    mergePreferences,
    mergeQcmStats,
} from './firebase_merge.js';

// We inject the original code but export the Engine
// --- FIREBASE AUTHENTICATION & SYNC ENGINE ---

// SDK hébergé par l'application (spec 013), chargé seulement après consentement. Même version que
// FIREBASE_SDK_DIR dans sw.js (vérifié par tests/core/firebase_sdk.test.js). Adresse résolue par
// rapport à la page (index.html, à la racine en source comme dans dist/) et non par rapport à ce
// module, que le build déplace dans assets/.
const FIREBASE_VERSION = '12.19.0';
const firebaseSdkUrl = (file) => new URL(`vendor/firebase-${FIREBASE_VERSION}/${file}`, document.baseURI).href;

// Memoizes a dynamic import by specifier, but only the *resolved* promise: caching a rejected
// one (e.g. a transient network blip) would permanently break sign-in/sync for the rest of the page
// session, since every later call would just replay the same rejection instead of retrying.
function createModuleLoader(specifier) {
    let cached = null;
    return () => {
        if (!cached) {
            cached = import(specifier).catch((err) => {
                cached = null;
                throw err;
            });
        }
        return cached;
    };
}

const loadAppModule = createModuleLoader(firebaseSdkUrl('firebase-app.js'));
const loadAuthModule = createModuleLoader(firebaseSdkUrl('firebase-auth.js'));
const loadFirestoreModule = createModuleLoader(firebaseSdkUrl('firebase-firestore.js'));
const loadMessagingModule = createModuleLoader(firebaseSdkUrl('firebase-messaging.js'));

let app, auth, db;
let isInitialized = false;

// Clé localStorage pour persister la date de dernière synchro entre sessions
const LAST_SYNC_STORAGE_KEY = 'firebase_last_sync';

/**
 * Lit une liste de suppressions en attente (tombstones : `deleted_flights`, `deleted_equipment`).
 * Une valeur illisible ou qui n'est pas une liste compte comme vide, et seuls les identifiants
 * texte non vides sont gardés : une liste abîmée ne doit ni faire planter la sauvegarde, ni faire
 * supprimer dans le cloud des identifiants inventés (spec 024).
 * @param {string} key
 * @returns {string[]}
 */
function readTombstoneIds(key) {
    let value;
    try {
        value = JSON.parse(localStorage.getItem(key) || '[]');
    } catch {
        return [];
    }
    return Array.isArray(value) ? value.filter((id) => typeof id === 'string' && id !== '') : [];
}

/**
 * Marqueur de suppression stocké dans le cloud à la place du vol. Il survit à la liste locale
 * `deleted_flights` (vidée après la première synchro) : un autre appareil qui a encore le vol
 * en local le voit et le retire au lieu de le renvoyer.
 * @param {string} id
 */
function deletedFlightMarker(id) {
    const now = Date.now();
    return { id, deleted: true, deletedAt: now, updatedAt: now };
}

// We will expose this engine to the window object so it can be called from non-module scripts
const SYNC_DOT_TITLES = {
    syncing: t('account.syncDot.syncing'),
    pending: t('account.syncDot.pending'),
    idle: '',
};

export const FirebaseAuthEngine = {
    enabled: false,
    currentUser: null,

    // Chargeur du SDK Firestore utilisé par la synchro complète ; remplaçable en test, où
    // l'import dynamique de l'URL du SDK hébergé n'est pas résoluble.
    _loadFirestore: loadFirestoreModule,

    // --- État du voyant de synchronisation (point dans le header) ---
    // _changeSeq augmente à chaque modification locale à envoyer ; _syncedSeq retient la
    // dernière modification confirmée par une synchro complète réussie. Tant que
    // _changeSeq > _syncedSeq, des données locales ne sont pas dans le cloud (hors ligne,
    // échec) : le voyant reste orange au lieu de s'éteindre comme si tout était envoyé.
    _changeSeq: 0,
    _syncedSeq: 0,
    _syncsInFlight: 0,
    _activeSyncPromise: null,
    _activeSyncSilent: true,
    _initPromise: null,
    _syncDotSubscribed: false,

    /**
     * Safari : au rechargement ou à la fermeture de la page, le navigateur coupait lui-même les
     * connexions Firestore encore ouvertes et les affichait en erreurs « Fetch API cannot load …
     * due to access control checks » dans la console. L'app les ferme avant, sauf quand la page est
     * seulement gardée pour le bouton « retour » (event.persisted) et peut donc revenir telle quelle.
     * @param {object} firestore Instance Firestore
     * @param {(firestore: object) => Promise<void>} terminate Fonction terminate du SDK
     */
    _closeFirestoreOnPageHide(firestore, terminate) {
        window.addEventListener('pagehide', (event) => {
            if (event.persisted) return;
            terminate(firestore).catch(() => {});
        });
    },

    markUnsyncedChange: function () {
        this._changeSeq++;
        this._updateSyncStatus();
    },

    getSyncStatus: function () {
        if (!this.currentUser) return 'idle';
        if (this._syncsInFlight > 0 || this._debounceSyncTimer) return 'syncing';
        if (this._changeSeq > this._syncedSeq) return 'pending';
        return 'idle';
    },

    _updateSyncStatus: function () {
        GlobalState.set('syncStatus', this.getSyncStatus());
    },

    // --- Getter / Setter pour lastSyncTime ---
    // Persisté dans le localStorage pour survivre aux rechargements de page.
    get lastSyncTime() {
        return localStorage.getItem(LAST_SYNC_STORAGE_KEY) || null;
    },
    set lastSyncTime(value) {
        if (value) {
            localStorage.setItem(LAST_SYNC_STORAGE_KEY, value);
        } else {
            localStorage.removeItem(LAST_SYNC_STORAGE_KEY);
        }
    },

    // Initialize Firebase
    init: async function () {
        // Petit point de statut dans le header (à côté du bouton profil) : bleu clignotant
        // pendant une synchro, orange fixe s'il reste des modifications non envoyées, caché
        // quand tout est dans le cloud (voir getSyncStatus).
        if (!this._syncDotSubscribed) {
            this._syncDotSubscribed = true;
            GlobalState.subscribe('syncStatus', (status) => {
                const dot = document.getElementById('sync-active-dot');
                if (!dot) return;
                dot.classList.toggle('active', status === 'syncing' || status === 'pending');
                dot.classList.toggle('pending', status === 'pending');
                dot.title = SYNC_DOT_TITLES[status] || '';
            });
        }

        if (isInitialized) return;
        if (this._initPromise) return this._initPromise;

        if (typeof IS_FIREBASE_ENABLED === 'undefined' || !IS_FIREBASE_ENABLED) {
            console.log('Firebase sync is disabled (IS_FIREBASE_ENABLED is false).');
            this.updateHeaderUI();
            return;
        }

        // GDPR (RGPD) consent guard
        if (!GdprEngine.isConsentGranted('firebase')) {
            console.log('Firebase initialization bypassed: waiting for user GDPR consent.');
            this.enabled = false;
            this.updateHeaderUI();
            return;
        }

        this._initPromise = (async () => {
            try {
                // Import Firebase SDKs dynamically from CDN
                const { initializeApp } = await loadAppModule();
                const { getAuth, onAuthStateChanged } = await loadAuthModule();
                const { initializeFirestore, terminate } = await loadFirestoreModule();

                app = initializeApp(FIREBASE_CONFIG);
                auth = getAuth(app);
                // Fix Safari CORS/ITP issues with WebChannel by forcing Long Polling
                db = initializeFirestore(app, {
                    experimentalForceLongPolling: true,
                });
                this._closeFirestoreOnPageHide(db, terminate);
                this.enabled = true;
                isInitialized = true;
                console.log('Firebase successfully initialized.');

                // Listen to auth state changes
                onAuthStateChanged(auth, async (user) => {
                    if (user) {
                        console.log('User logged in:', user.email);
                        this.currentUser = user;
                        this.updateHeaderUI();
                        this.updateModalUI();

                        // Rôles du compte (météo calculée) : lus avant la synchro, qui peut être longue.
                        AccessService.expectUser(user.uid);
                        this.refreshAccess();

                        // Synchro complète initiale à la connexion
                        await this.syncDataWithCloud();

                        // 1. Synchro automatique silencieuse toutes les 30 secondes
                        if (!this._syncInterval) {
                            this._syncInterval = setInterval(() => {
                                if (navigator.onLine && this.currentUser) {
                                    this.syncDataWithCloud(true); // silent sync
                                }
                            }, 30 * 1000); // 30 secondes (réduit depuis 2 min)
                        }

                        // 2. Synchro instantanée dès le retour de la connexion internet
                        if (!this._onlineListenerAttached) {
                            window.addEventListener('online', () => {
                                if (this.currentUser) {
                                    console.log('Réseau de retour : synchronisation de rattrapage en cours...');
                                    this.syncDataWithCloud(true);
                                }
                            });
                            this._onlineListenerAttached = true;
                        }
                    } else {
                        console.log('User logged out');
                        this.currentUser = null;
                        AccessService.clear();
                        this._updateSyncStatus(); // déconnecté : plus de voyant
                        // On réinitialise lastSyncTime à la déconnexion pour ne pas afficher
                        // une heure de synchro qui appartient à une autre session.
                        this.lastSyncTime = null;

                        if (this._syncInterval) {
                            clearInterval(this._syncInterval);
                            this._syncInterval = null;
                        }

                        this.updateHeaderUI();
                        this.updateModalUI();
                    }
                });
            } catch (error) {
                console.error('Error initializing Firebase:', error);
                this.enabled = false;
            }
        })().finally(() => {
            this._initPromise = null;
        });

        return this._initPromise;
    },

    // UI Helpers
    /**
     * Lit les rôles du compte dans users/{uid}/access/profile (écrit à la main dans la console
     * Firebase : les règles refusent toute écriture du client). Hors ligne ou en cas d'erreur, les
     * rôles déjà connus de l'appareil sont conservés ; document absent = aucun rôle.
     */
    refreshAccess: async function () {
        const user = this.currentUser;
        if (!user || !this.enabled) return;
        try {
            const { doc, getDoc } = await this._loadFirestore();
            const snap = await getDoc(doc(db, 'users', user.uid, 'access', 'profile'));
            if (this.currentUser?.uid !== user.uid) return; // déconnecté ou changé de compte entre-temps
            AccessService.setRoles(user.uid, snap.exists() ? snap.data()?.roles : []);
        } catch (error) {
            console.warn('Lecture des rôles impossible, rôles de l’appareil conservés :', error?.message || error);
        }
    },

    openAuthModal: function () {
        const overlay = /** @type {HTMLDialogElement & { _cancelBound?: boolean }} */ (
            document.getElementById('auth-modal-overlay')
        );
        if (overlay) {
            if (typeof overlay.showModal === 'function' && !overlay.open) {
                overlay.showModal();
                if (!overlay._cancelBound) {
                    overlay._cancelBound = true;
                    overlay.addEventListener('cancel', (e) => {
                        e.preventDefault();
                        this.closeAuthModal();
                    });
                }
            }
            overlay.style.display = 'flex';
            void overlay.offsetWidth;
            overlay.classList.add('active');
            this.clearAlerts();
            this.updateModalUI();
        }
    },

    closeAuthModal: function () {
        const overlay = /** @type {HTMLDialogElement & { _cancelBound?: boolean }} */ (
            document.getElementById('auth-modal-overlay')
        );
        if (overlay) {
            overlay.classList.remove('active');
            setTimeout(() => {
                if (!overlay.classList.contains('active')) {
                    if (typeof overlay.close === 'function' && overlay.open) {
                        overlay.close();
                    }
                    overlay.style.display = 'none';
                }
            }, 300);
        }
    },

    switchTab: function (tabName) {
        const loginTab = document.getElementById('tab-login');
        const registerTab = document.getElementById('tab-register');
        const loginForm = document.getElementById('form-login-container');
        const registerForm = document.getElementById('form-register-container');

        if (tabName === 'login') {
            loginTab.classList.add('active');
            registerTab.classList.remove('active');
            loginForm.classList.add('active');
            registerForm.classList.remove('active');
        } else {
            loginTab.classList.remove('active');
            registerTab.classList.add('active');
            loginForm.classList.remove('active');
            registerForm.classList.add('active');
        }
        this.clearAlerts();
    },

    // Update the Auth Button in the header
    updateHeaderUI: function () {
        const activeDot = document.getElementById('auth-active-dot');
        const authBtn = document.getElementById('auth-btn');

        if (activeDot && authBtn) {
            if (this.currentUser) {
                activeDot.classList.add('active');
                authBtn.title = t('account.header.connectedAs', { email: this.currentUser.email });
            } else {
                activeDot.classList.remove('active');
                authBtn.title = this.enabled ? t('account.header.signIn') : t('account.header.disabled');
            }
        }

        // Update guest warnings
        const qcmWarning = document.getElementById('qcm-guest-warning');
        const statsWarning = document.getElementById('stats-guest-warning');

        if (this.currentUser) {
            if (qcmWarning) qcmWarning.style.display = 'none';
            if (statsWarning) statsWarning.style.display = 'none';
        } else if (this.enabled) {
            if (qcmWarning) qcmWarning.style.display = 'flex';
            if (statsWarning) statsWarning.style.display = 'flex';
        }
    },

    // Update the contents of the modal based on connection state
    updateModalUI: function () {
        const setupRequiredView = document.getElementById('auth-setup-required-view');
        const anonymousView = document.getElementById('auth-anonymous-view');
        const loggedInView = document.getElementById('auth-logged-in-view');

        if (!setupRequiredView || !anonymousView || !loggedInView) return;

        // Hide all first
        setupRequiredView.style.display = 'none';
        anonymousView.style.display = 'none';
        loggedInView.style.display = 'none';

        const hasConsent = GdprEngine.isConsentGranted('firebase');
        const isFirebaseEnabledGlobally = typeof IS_FIREBASE_ENABLED !== 'undefined' && IS_FIREBASE_ENABLED;

        if (!isFirebaseEnabledGlobally) {
            setupRequiredView.style.display = 'block';
            const devDesc = document.getElementById('auth-setup-required-desc');
            const gdprDesc = document.getElementById('auth-gdpr-required-desc');
            if (devDesc) devDesc.style.display = 'block';
            if (gdprDesc) gdprDesc.style.display = 'none';
        } else if (this.currentUser) {
            loggedInView.style.display = 'flex';

            // Set user email
            const emailEl = document.getElementById('auth-user-email');
            if (emailEl) emailEl.textContent = this.currentUser.email;

            // Set avatar letter
            const avatarEl = document.getElementById('auth-user-avatar');
            if (avatarEl && this.currentUser.email) {
                avatarEl.textContent = this.currentUser.email.charAt(0).toUpperCase();
            }

            // Affiche la dernière heure de synchro lue depuis le localStorage
            const syncTimeEl = document.getElementById('auth-sync-time');
            if (syncTimeEl) {
                syncTimeEl.textContent = this.lastSyncTime || t('account.never');
            }
        } else if (hasConsent) {
            anonymousView.style.display = 'block';
        } else {
            setupRequiredView.style.display = 'block';
            const devDesc = document.getElementById('auth-setup-required-desc');
            const gdprDesc = document.getElementById('auth-gdpr-required-desc');
            if (devDesc) devDesc.style.display = 'none';
            if (gdprDesc) gdprDesc.style.display = 'block';
        }
    },

    // Auth actions
    signUp: async function (_args, _event, target) {
        if (!isInitialized) return;
        this.clearAlerts();

        // Lire les champs directement dans le DOM
        const emailEl = /** @type {HTMLInputElement} */ (document.getElementById('register-email'));
        const passwordEl = /** @type {HTMLInputElement} */ (document.getElementById('register-password'));
        const confirmEl = /** @type {HTMLInputElement} */ (document.getElementById('register-confirm-password'));
        const email = emailEl ? emailEl.value.trim() : '';
        const password = passwordEl ? passwordEl.value : '';
        const confirmPassword = confirmEl ? confirmEl.value : '';

        if (!email || !password || !confirmPassword) {
            this.showAlert(t('account.form.fillAll'), 'error');
            return;
        }

        if (password !== confirmPassword) {
            this.showAlert(t('account.form.passwordMismatch'), 'error');
            return;
        }

        try {
            const {
                createUserWithEmailAndPassword,
                setPersistence,
                indexedDBLocalPersistence,
                browserSessionPersistence,
            } = await loadAuthModule();
            this.showStatus(t('account.signUp.creating'), 'info');

            // Set persistence dynamically
            const rememberMeEl = /** @type {HTMLInputElement} */ (document.getElementById('register-remember-me'));
            const rememberMe = rememberMeEl ? rememberMeEl.checked : true;
            await setPersistence(auth, rememberMe ? indexedDBLocalPersistence : browserSessionPersistence);

            await createUserWithEmailAndPassword(auth, email, password);
            this.showAlert(t('account.signUp.success'), 'success');
        } catch (error) {
            console.error('Signup error:', error.code, error.message);
            let message = t('account.signUp.error');
            if (error.code === 'auth/email-already-in-use') {
                message = t('account.signUp.emailInUse');
            } else if (error.code === 'auth/invalid-email') {
                message = t('account.form.invalidEmail');
            } else if (error.code === 'auth/weak-password') {
                message = t('account.signUp.weakPassword');
            }
            this.showAlert(message, 'error');
        }
    },

    signIn: async function (_args, _event, target) {
        if (!isInitialized) return;
        this.clearAlerts();

        // Lire les champs directement dans le DOM (les args du dispatcher ne sont pas exploitables)
        const emailEl = /** @type {HTMLInputElement} */ (document.getElementById('login-email'));
        const passwordEl = /** @type {HTMLInputElement} */ (document.getElementById('login-password'));
        const email = emailEl ? emailEl.value.trim() : '';
        const password = passwordEl ? passwordEl.value : '';

        if (!email || !password) {
            this.showAlert(t('account.form.fillAll'), 'error');
            return;
        }

        try {
            const { signInWithEmailAndPassword, setPersistence, indexedDBLocalPersistence, browserSessionPersistence } =
                await loadAuthModule();
            this.showStatus(t('account.signIn.connecting'), 'info');

            // Set persistence dynamically
            const rememberMeEl = /** @type {HTMLInputElement} */ (document.getElementById('login-remember-me'));
            const rememberMe = rememberMeEl ? rememberMeEl.checked : true;
            await setPersistence(auth, rememberMe ? indexedDBLocalPersistence : browserSessionPersistence);

            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            console.error('Signin error:', error.code, error.message);
            let message = t('account.signIn.error');
            if (error.code === 'auth/invalid-email') {
                message = t('account.form.invalidEmail');
            } else if (
                error.code === 'auth/user-not-found' ||
                error.code === 'auth/wrong-password' ||
                error.code === 'auth/invalid-credential'
            ) {
                message = t('account.signIn.wrongCredentials');
            } else if (error.code === 'auth/too-many-requests') {
                message = t('account.signIn.tooManyRequests');
            } else if (error.code === 'auth/user-disabled') {
                message = t('account.signIn.disabled');
            } else if (error.code === 'auth/network-request-failed') {
                message = t('account.signIn.network');
            }
            this.showAlert(message, 'error');
        }
    },

    signOut: async function () {
        if (!isInitialized) return;
        try {
            const { signOut } = await loadAuthModule();
            await signOut(auth);
            this.closeAuthModal();
            alert(t('account.signedOut'));
        } catch (error) {
            console.error('Signout error:', error);
        }
    },

    // « Mot de passe oublié ? » : lit l'adresse saisie dans le formulaire de connexion (spec 019).
    forgotPassword: async function () {
        const emailEl = /** @type {HTMLInputElement} */ (document.getElementById('login-email'));
        const email = emailEl ? emailEl.value.trim() : '';
        if (!email) {
            this.showAlert(t('account.reset.emailRequired'), 'error');
            return;
        }
        await this.resetPassword(email);
    },

    resetPassword: async function (email) {
        if (!isInitialized) return;
        if (!email) {
            return;
        }
        this.clearAlerts();

        try {
            const { sendPasswordResetEmail } = await loadAuthModule();
            await sendPasswordResetEmail(auth, email);
            this.showAlert(t('account.reset.sent'), 'success');
        } catch (error) {
            console.error('Forgot password error:', error);
            this.showAlert(t('account.reset.error'), 'error');
        }
    },

    // -----------------------------------------------------------------------
    // MÉTHODE CENTRALE : Synchro Cloud complète (toutes les données)
    // -----------------------------------------------------------------------
    syncDataWithCloud: function (silent = false) {
        if (!this.currentUser) return Promise.resolve({ success: false, data: null, error: 'Not logged in' });
        if (this._activeSyncPromise) {
            if (!silent && this._activeSyncSilent) {
                this._activeSyncSilent = false;
                this.showStatus(t('account.sync.inProgress'), 'info');
            }
            return this._activeSyncPromise;
        }

        this._activeSyncSilent = Boolean(silent);
        this._activeSyncPromise = this._runSyncDataWithCloud(silent).finally(() => {
            this._activeSyncPromise = null;
            this._activeSyncSilent = true;
        });
        return this._activeSyncPromise;
    },

    _runSyncDataWithCloud: async function (silent = false) {
        if (!this.currentUser) return { success: false, data: null, error: 'Not logged in' };

        // Toutes les modifications faites jusqu'ici partent avec cette synchro ; une modification
        // faite pendant qu'elle tourne (seq plus grand) restera à envoyer.
        const seqAtStart = this._changeSeq;
        this._syncsInFlight++;
        this._updateSyncStatus();
        if (!silent) {
            this.showStatus(t('account.sync.inProgress'), 'info');
        }

        try {
            const firestoreModule = await this._loadFirestore();
            const { doc, getDoc, setDoc, collection, getDocs, deleteDoc } = firestoreModule;
            const uid = this.currentUser.uid;

            // --- Sync Logbook ---
            // 0. Process Tombstones (Deleted items) FIRST
            const deletedFlights = readTombstoneIds('deleted_flights');

            if (deletedFlights.length > 0) {
                for (const delId of deletedFlights) {
                    // Guard : l'ID doit être une string non-vide pour Firestore
                    if (!delId || typeof delId !== 'string') {
                        console.warn('[Sync] Tombstone ignoré : ID invalide', delId);
                        continue;
                    }
                    const sRef = doc(db, 'users', uid, 'logbook', delId);
                    await setDoc(sRef, deletedFlightMarker(delId));
                    await this._deleteFlightTrace(firestoreModule, uid, delId);
                }
                const processedFlightIds = new Set(deletedFlights);
                const remainingFlightTombstones = readTombstoneIds('deleted_flights').filter(
                    (id) => !processedFlightIds.has(id),
                );
                localStorage.setItem('deleted_flights', JSON.stringify(remainingFlightTombstones));
                console.log(`Removed ${deletedFlights.length} deleted flights from Cloud.`);
            }

            let localLogbook = StorageService.get(StorageService.KEYS.LOGBOOK_DATA) || [];
            if (!Array.isArray(localLogbook)) localLogbook = [];

            // Sanitation : on retire tout enregistrement sans ID valide (données corrompues/anciennes)
            localLogbook = localLogbook.filter((s) => {
                if (!s || !s.id || typeof s.id !== 'string') {
                    console.warn('[Sync] Vol ignoré : ID invalide ou manquant', s);
                    return false;
                }
                return true;
            });

            const logbookColRef = collection(db, 'users', uid, 'logbook');
            const logbookSnap = await getDocs(logbookColRef);

            const cloudLogbook = [];
            const cloudLogbookById = new Map();
            // Vols supprimés sur un autre appareil : id -> date de suppression
            const cloudDeletedAt = new Map();
            // Traces restées dans d'anciens documents de vol (avant specs/037) : récupérées, puis jamais fusionnées
            // (elles gonfleraient le stockage local, limité à 5 Mo).
            const legacyTraces = new Map();
            logbookSnap.forEach((docSnap) => {
                const data = docSnap.data();
                // Guard : on n'accepte que les docs avec un ID string valide
                if (data && data.id && typeof data.id === 'string') {
                    if (data.deleted === true) cloudDeletedAt.set(data.id, data.deletedAt || 0);
                    else {
                        if (typeof data.rawIgc === 'string' && data.rawIgc) legacyTraces.set(data.id, data.rawIgc);
                        const stripped = stripTrace(data);
                        cloudLogbook.push(stripped);
                        cloudLogbookById.set(data.id, stripped);
                    }
                }
            });

            // 1. Process Pending Queue (Local -> Cloud) en respectant LWW et les tombstones cloud
            const pendingLogbook = localLogbook.filter((s) => s.syncPending);
            for (const session of pendingLogbook) {
                delete session.syncPending;
                if (cloudDeletedAt.has(session.id)) continue;
                const cloudExisting = cloudLogbookById.get(session.id);
                if (cloudExisting && (cloudExisting.updatedAt || 0) > (session.updatedAt || 0)) continue;
                const sRef = doc(db, 'users', uid, 'logbook', session.id);
                const stripped = stripTrace(session);
                await setDoc(sRef, stripped);
                if (!cloudExisting) cloudLogbook.push(stripped);
                cloudLogbookById.set(session.id, stripped);
            }
            if (pendingLogbook.length > 0) {
                StorageService.set(StorageService.KEYS.LOGBOOK_DATA, localLogbook);
            }

            // 2. Smart Merge: Compare updatedAt
            // Re-read tombstones here in case a deletion happened concurrently while this sync
            // was running (race condition: deleteLogbookEntry fires async, sync reads cloud
            // before the delete completes → cloud still has the doc → merge would re-add it).
            const newlyDeletedFlights = readTombstoneIds('deleted_flights');
            const deletedFlightsSet = new Set([...deletedFlights, ...newlyDeletedFlights]);

            // The local snapshot was read before this point too: a flight deleted meanwhile must
            // not come back from it either (it would then be re-uploaded on the next sync).
            const mergedLogbookMap = new Map();
            for (const session of localLogbook) {
                if (deletedFlightsSet.has(session.id)) continue;
                // Supprimé ailleurs : définitif, un appareil resté en retard ne le ressuscite pas.
                if (cloudDeletedAt.has(session.id)) {
                    if (IDBStorage.isSupported()) await IDBStorage.deleteFlight(session.id).catch(() => {});
                    continue;
                }
                mergedLogbookMap.set(session.id, session);
            }
            cloudLogbook.forEach((cloudSession) => {
                // Never re-insert a flight the user just deleted (tombstone guard)
                if (deletedFlightsSet.has(cloudSession.id)) return;

                const localSession = mergedLogbookMap.get(cloudSession.id);
                if (localSession) {
                    const localTime = localSession.updatedAt || 0;
                    const cloudTime = cloudSession.updatedAt || 0;
                    if (cloudTime > localTime) {
                        mergedLogbookMap.set(cloudSession.id, cloudSession);
                    }
                } else {
                    mergedLogbookMap.set(cloudSession.id, cloudSession);
                }
            });

            const mergedLogbook = Array.from(mergedLogbookMap.values());
            mergedLogbook.sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime());

            StorageService.set(StorageService.KEYS.LOGBOOK_DATA, mergedLogbook);

            // Upload missing ones to cloud
            for (const session of mergedLogbook) {
                // Guard : double vérification avant l'appel doc()
                if (!session.id || typeof session.id !== 'string') continue;
                const cloudSession = cloudLogbook.find((s) => s.id === session.id);
                if (!cloudSession) {
                    const sRef = doc(db, 'users', uid, 'logbook', session.id);
                    await setDoc(sRef, stripTrace(session));
                }
            }

            // Traces de vol : récupération des anciennes, puis envoi de quelques traces à chaque synchro.
            // Un échec ne bloque jamais la synchro des vols (specs/037, FR-4).
            try {
                if (await this._syncFlightTraces({ firestoreModule, uid, flights: mergedLogbook, legacyTraces })) {
                    StorageService.set(StorageService.KEYS.LOGBOOK_DATA, mergedLogbook);
                }
            } catch (traceError) {
                console.warn('[Sync] Synchro des traces de vol interrompue :', traceError);
            }

            // --- Sync Equipment ---
            // 0. Process Tombstones (Deleted items) FIRST, comme pour les vols (spec 015)
            const deletedEquip = readTombstoneIds('deleted_equipment');

            if (deletedEquip.length > 0) {
                for (const delId of deletedEquip) {
                    // Guard : l'ID doit être une string non-vide pour Firestore
                    if (!delId || typeof delId !== 'string') {
                        console.warn('[Sync] Tombstone équipement ignoré : ID invalide', delId);
                        continue;
                    }
                    const eRef = doc(db, 'users', uid, 'equipment', delId);
                    await deleteDoc(eRef);
                }
                const processedEquipIds = new Set(deletedEquip);
                const remainingEquipTombstones = readTombstoneIds('deleted_equipment').filter(
                    (id) => !processedEquipIds.has(id),
                );
                localStorage.setItem('deleted_equipment', JSON.stringify(remainingEquipTombstones));
                console.log(`Removed ${deletedEquip.length} deleted equipment items from Cloud.`);
            }

            let localEquip = StorageService.get(StorageService.KEYS.EQUIPMENT_DATA) || [];
            if (!Array.isArray(localEquip)) localEquip = [];

            // Sanitation : on retire tout élément sans ID valide, ainsi que les équipements supprimés
            // (ils ne doivent pas être renvoyés vers le cloud)
            localEquip = localEquip.filter((e) => {
                if (!e || !e.id || typeof e.id !== 'string') {
                    console.warn('[Sync] Équipement ignoré : ID invalide ou manquant', e);
                    return false;
                }
                return !deletedEquip.includes(e.id);
            });

            const equipColRef = collection(db, 'users', uid, 'equipment');
            const equipSnap = await getDocs(equipColRef);

            const cloudEquip = [];
            const cloudEquipById = new Map();
            equipSnap.forEach((docSnap) => {
                const data = docSnap.data();
                // Guard : on n'accepte que les docs avec un ID string valide
                if (data && data.id && typeof data.id === 'string') {
                    cloudEquip.push(data);
                    cloudEquipById.set(data.id, data);
                }
            });

            // 1. Process Pending Queue (Local -> Cloud) en respectant LWW
            const pendingEquip = localEquip.filter((e) => e.syncPending);
            for (const item of pendingEquip) {
                // Guard : ID obligatoire en string
                if (!item.id || typeof item.id !== 'string') continue;
                delete item.syncPending;
                const cloudExisting = cloudEquipById.get(item.id);
                if (cloudExisting && (cloudExisting.updatedAt || 0) > (item.updatedAt || 0)) continue;
                const eRef = doc(db, 'users', uid, 'equipment', item.id);
                await setDoc(eRef, item);
                if (!cloudExisting) cloudEquip.push(item);
                cloudEquipById.set(item.id, item);
            }
            if (pendingEquip.length > 0) {
                StorageService.set(StorageService.KEYS.EQUIPMENT_DATA, localEquip);
            }

            // 2. Smart Merge: Compare updatedAt
            // Re-read tombstones (same race-condition guard as logbook above).
            const newlyDeletedEquip = readTombstoneIds('deleted_equipment');
            const deletedEquipSet = new Set([...deletedEquip, ...newlyDeletedEquip]);

            const mergedEquipMap = new Map();
            localEquip.forEach((item) => {
                if (!deletedEquipSet.has(item.id)) mergedEquipMap.set(item.id, item);
            });
            cloudEquip.forEach((cloudItem) => {
                // Never re-insert equipment the user just deleted (tombstone guard)
                if (deletedEquipSet.has(cloudItem.id)) return;

                const localItem = mergedEquipMap.get(cloudItem.id);
                if (localItem) {
                    const localTime = localItem.updatedAt || 0;
                    const cloudTime = cloudItem.updatedAt || 0;
                    if (cloudTime > localTime) {
                        mergedEquipMap.set(cloudItem.id, cloudItem);
                    }
                } else {
                    mergedEquipMap.set(cloudItem.id, cloudItem);
                }
            });

            const mergedEquip = Array.from(mergedEquipMap.values());

            StorageService.set(StorageService.KEYS.EQUIPMENT_DATA, mergedEquip);

            // Upload missing ones to cloud
            for (const item of mergedEquip) {
                // Guard : double vérification avant l'appel doc()
                if (!item.id || typeof item.id !== 'string') continue;
                const cloudItem = cloudEquip.find((e) => e.id === item.id);
                if (!cloudItem) {
                    const eRef = doc(db, 'users', uid, 'equipment', item.id);
                    await setDoc(eRef, item);
                }
            }

            // Statistiques et historique d'examens : seulement avec le consentement « statistiques ».
            if (isStatsConsentGranted()) {
                // --- Sync QCM Stats ---
                const localQcmStats = this.getLocalQcmStats();
                const qcmDocRef = doc(db, 'users', uid, 'stats', 'qcm_stats');
                const qcmDocSnap = await getDoc(qcmDocRef);

                let finalQcmStats = localQcmStats;
                if (qcmDocSnap.exists()) {
                    const cloudQcmStats = qcmDocSnap.data();
                    finalQcmStats = this.mergeQcmStats(localQcmStats, cloudQcmStats);
                }

                // Save back merged stats to both LocalStorage and Cloud
                StorageService.set(StorageService.KEYS.QCM_STATS, finalQcmStats);
                await setDoc(qcmDocRef, finalQcmStats);

                // --- Sync Exam History ---
                const localExamHistory = this.getLocalExamHistory();
                const examDocRef = doc(db, 'users', uid, 'stats', 'exam_history');
                const examDocSnap = await getDoc(examDocRef);

                let finalExamHistory = localExamHistory;
                if (examDocSnap.exists()) {
                    const cloudExamHistory = examDocSnap.data();
                    finalExamHistory = this.mergeExamHistory(localExamHistory, cloudExamHistory);
                }

                StorageService.set(StorageService.KEYS.EXAM_HISTORY, finalExamHistory);
                await setDoc(examDocRef, finalExamHistory);
            }

            // --- Sync Preferences ---
            const localPrefs = this.getLocalPreferences();
            const prefsDocRef = doc(db, 'users', uid, 'preferences', 'user_prefs');
            const prefsDocSnap = await getDoc(prefsDocRef);

            let finalPrefs = localPrefs;
            if (prefsDocSnap.exists()) {
                const cloudPrefs = prefsDocSnap.data();
                finalPrefs = this.mergePreferences(localPrefs, cloudPrefs);
            }

            StorageService.set(StorageService.KEYS.USER_PREFS, finalPrefs);

            // Update global userLevel from merged preferences if it's different
            this.syncingData = true;
            if (finalPrefs.pilotLevel && finalPrefs.pilotLevel !== StorageService.get(StorageService.KEYS.USER_LEVEL)) {
                StorageService.set(StorageService.KEYS.USER_LEVEL, finalPrefs.pilotLevel);
                if (GlobalState) {
                    GlobalState.set('level', finalPrefs.pilotLevel);
                }
            }
            if (finalPrefs.themeMode && finalPrefs.themeMode !== StorageService.get(StorageService.KEYS.THEME_MODE)) {
                StorageService.set(StorageService.KEYS.THEME_MODE, finalPrefs.themeMode);
                if (GlobalState) {
                    GlobalState.set('themeMode', finalPrefs.themeMode);
                }
            }
            this.syncingData = false;

            await setDoc(prefsDocRef, finalPrefs);

            // Fiche d'urgence : seulement si le pilote a demandé la sauvegarde en ligne. Une erreur ici (règles pas
            // encore publiées, par exemple) ne doit pas faire échouer le reste de la synchro.
            try {
                await this._syncIceProfile(firestoreModule, uid);
            } catch (iceError) {
                console.warn('[ICE] Synchro de la fiche d’urgence impossible :', iceError);
            }

            // Maintien des données en mémoire des services (sans effet sur le DOM)
            SitesService.loadUserPreferences();
            LogbookService.loadData();
            await LogbookService.whenReady();

            // AUCUN rafraîchissement automatique de vue en tâche de fond (silent = true) :
            // l'utilisateur ne doit jamais voir son écran ou ses listes se réinitialiser
            // sans action explicite de sa part. Les vues se mettent à jour lors des navigations.
            const effectiveSilent = Boolean(silent && this._activeSyncSilent);
            if (!effectiveSilent) {
                const activeMode = GlobalState ? GlobalState.get('mode') : null;
                if (activeMode === 'STATS') {
                    AppRouter.getView('STATS')?.renderStats?.();
                } else if (activeMode === 'SITES') {
                    SitesService.renderList();
                } else if (activeMode === 'LOGBOOK') {
                    const logbookView = AppRouter.getView('LOGBOOK');
                    if (logbookView && logbookView.currentTab !== 'add') {
                        logbookView.switchTab(logbookView.currentTab);
                    }
                }
            }

            console.log('Sync complete!');

            // Persistance de l'heure dans le localStorage (survit au rechargement)
            this.lastSyncTime = new Date().toLocaleTimeString();

            // On rafraîchit TOUJOURS la modal après une synchro réussie,
            // y compris les synchros silencieuses, pour que l'heure soit à jour.
            this.updateModalUI();

            if (!effectiveSilent) {
                this.showStatus(t('account.sync.done'), 'success');
            }
            this._syncsInFlight--;
            this._syncedSeq = Math.max(this._syncedSeq, seqAtStart);
            this._updateSyncStatus();
            return { success: true, data: null, error: null };
        } catch (error) {
            console.error('Synchronization failed:', error);
            if (!silent) {
                const errorDetail = error.message ? ` : ${error.message}` : '';
                this.showAlert(t('account.sync.failed', { detail: errorDetail }), 'error');
            }
            this._syncsInFlight--;
            this._updateSyncStatus(); // les modifications restent « en attente » (orange)
            return { success: false, data: null, error: error.message };
        }
    },

    // -----------------------------------------------------------------------
    // DEBOUNCE SYNC — Regroupe les micro-modifications en une seule synchro
    // -----------------------------------------------------------------------
    /**
     * Déclenche une synchro cloud avec un délai de 2 secondes.
     * Chaque appel annule et repousse le timer précédent.
     * Appeler cette méthode après chaque modification utilisateur
     * (vol, équipement, préférences, niveau, thème…).
     */
    triggerDebouncedSync: function () {
        if (!this.currentUser || !this.enabled) return;

        // Annule la synchro en attente si elle existe
        if (this._debounceSyncTimer) {
            clearTimeout(this._debounceSyncTimer);
        }

        // Repousse de 2 secondes pour regrouper les changements rapides. Pendant ce délai le
        // voyant est bleu (getSyncStatus voit le timer), puis suit la vraie synchro.
        this._debounceSyncTimer = setTimeout(() => {
            this._debounceSyncTimer = null;
            if (this.currentUser && navigator.onLine) {
                console.log('[Firebase] Synchro debounced déclenchée après modification utilisateur.');
                this.syncDataWithCloud(true); // silent = true (pas d'alerte UI intrusive)
            } else {
                // Hors ligne : la modification reste à envoyer (voyant orange). La synchro de
                // rattrapage au retour du réseau (événement 'online') l'enverra.
                this._updateSyncStatus();
            }
        }, 2000);
        this.markUnsyncedChange();
    },

    // -----------------------------------------------------------------------
    // FICHE D'URGENCE (ICE) : données de santé, enregistrées en ligne seulement à la demande expresse du pilote
    // (voir js/services/ice_cloud_state.js). Un seul document, users/{uid}/ice/profile, lisible par lui seul.
    // -----------------------------------------------------------------------

    /** La fiche enregistrée en ligne, ou null. @returns {Promise<{ success: boolean, data: any, error: string | null }>} */
    fetchIceFromCloud: async function () {
        if (!this.currentUser || !this.enabled)
            return { success: false, data: null, error: 'Not enabled or logged in' };
        try {
            const { doc, getDoc } = await this._loadFirestore();
            const snap = await getDoc(doc(db, 'users', this.currentUser.uid, 'ice', 'profile'));
            return { success: true, data: snap.exists() ? snap.data() : null, error: null };
        } catch (error) {
            console.error('[ICE] Lecture de la fiche en ligne impossible :', error);
            return { success: false, data: null, error: error.message };
        }
    },

    /** Envoie la fiche de cet appareil, si le pilote a demandé la sauvegarde en ligne. */
    saveIceToCloud: async function () {
        if (!this.currentUser || !this.enabled)
            return { success: false, data: null, error: 'Not enabled or logged in' };
        const state = getIceCloudState();
        if (!state.enabled || !state.consentAt) return { success: false, data: null, error: 'ice-cloud-disabled' };
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            this.markUnsyncedChange(); // la synchro de rattrapage l'enverra
            return { success: false, data: null, error: 'Offline' };
        }
        try {
            const { doc, setDoc } = await this._loadFirestore();
            const { IceService } = await import('./ice_service.js');
            const body = {
                ...IceService.getProfile(),
                updatedAt: state.updatedAt || Date.now(),
                consentAt: state.consentAt,
            };
            await setDoc(doc(db, 'users', this.currentUser.uid, 'ice', 'profile'), body);
            setIceCloudState({ lastSyncedAt: Date.now() });
            return { success: true, data: null, error: null };
        } catch (error) {
            console.error('[ICE] Envoi de la fiche impossible :', error);
            this.markUnsyncedChange();
            return { success: false, data: null, error: error.message };
        }
    },

    /** Supprime la fiche enregistrée en ligne (droit à l'effacement). */
    deleteIceFromCloud: async function () {
        if (!this.currentUser || !this.enabled)
            return { success: false, data: null, error: 'Not enabled or logged in' };
        if (typeof navigator !== 'undefined' && navigator.onLine === false)
            return { success: false, data: null, error: 'Offline' };
        try {
            const { doc, deleteDoc } = await this._loadFirestore();
            await deleteDoc(doc(db, 'users', this.currentUser.uid, 'ice', 'profile'));
            return { success: true, data: null, error: null };
        } catch (error) {
            console.error('[ICE] Suppression de la fiche en ligne impossible :', error);
            return { success: false, data: null, error: error.message };
        }
    },

    /**
     * Synchro de la fiche entre les appareils (dernière modification gagnante), si le pilote l'a demandée.
     * Une fiche supprimée en ligne depuis un autre appareil n'est pas recréée : la sauvegarde est alors arrêtée ici.
     */
    _syncIceProfile: async function (firestoreModule, uid) {
        const state = getIceCloudState();
        const { doc, getDoc, setDoc } = firestoreModule;
        const ref = doc(db, 'users', uid, 'ice', 'profile');
        const snap = await getDoc(ref);
        const cloud = snap.exists() ? snap.data() : null;
        const { IceService } = await import('./ice_service.js');

        if (!state.enabled || !state.consentAt) {
            if (!cloud) return;
            // Le pilote a déjà consenti et enregistré sa fiche en ligne depuis un autre appareil :
            // on réactive la synchro sur cet appareil et on récupère la fiche (ou on envoie si local plus récent).
            const local = IceService.getProfile();
            const hasLocal = Boolean(local.nom || local.prenom || local.contact1Phone || local.contact2Phone);
            const consentAt = cloud.consentAt || new Date().toISOString();
            setIceCloudState({ enabled: true, consentAt, lastSyncedAt: Date.now() });
            if (!hasLocal || (cloud.updatedAt || 0) >= state.updatedAt) {
                IceService.saveProfile(cloud, { updatedAt: cloud.updatedAt || Date.now() });
                return;
            }
            const body = {
                ...local,
                updatedAt: state.updatedAt || Date.now(),
                consentAt,
            };
            await setDoc(ref, body);
            setIceCloudState({ lastSyncedAt: Date.now() });
            return;
        }

        if (!cloud) {
            if (state.lastSyncedAt) {
                // Elle était en ligne, elle n'y est plus : effacée depuis un autre appareil.
                disableIceCloud();
                return;
            }
        } else if ((cloud.updatedAt || 0) > state.updatedAt) {
            IceService.saveProfile(cloud, { updatedAt: cloud.updatedAt });
            setIceCloudState({ lastSyncedAt: Date.now() });
            return;
        } else if ((cloud.updatedAt || 0) === state.updatedAt) {
            setIceCloudState({ lastSyncedAt: Date.now() });
            return;
        }

        // Pas de fiche en ligne (première sauvegarde) ou fiche locale plus récente : on envoie.
        const body = {
            ...IceService.getProfile(),
            updatedAt: state.updatedAt || Date.now(),
            consentAt: state.consentAt,
        };
        await setDoc(ref, body);
        setIceCloudState({ lastSyncedAt: Date.now() });
    },

    // Write-through updates to Cloud when user makes progress
    saveStatsToCloud: async function () {
        if (!this.currentUser || !this.enabled)
            return { success: false, data: null, error: 'Not enabled or logged in' };
        // Les statistiques et l'historique QCM relèvent du consentement « statistiques », en plus de la synchro.
        if (!isStatsConsentGranted()) return { success: false, data: null, error: 'stats-consent-missing' };
        // Hors ligne, l'écriture Firestore ne répond qu'au retour du réseau : on le signale
        // tout de suite (voyant orange) et la synchro de rattrapage 'online' s'en chargera.
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            this.markUnsyncedChange();
            return { success: false, data: null, error: 'Offline' };
        }

        try {
            const { doc, setDoc } = await loadFirestoreModule();
            const uid = this.currentUser.uid;

            const qcmStats = this.getLocalQcmStats();
            const qcmDocRef = doc(db, 'users', uid, 'stats', 'qcm_stats');
            await setDoc(qcmDocRef, qcmStats);

            this.lastSyncTime = new Date().toLocaleTimeString();
            this.updateModalUI(); // Toujours rafraîchir l'UI après une synchro partielle
            console.log('Incremental QCM stats synced.');
            return { success: true, data: null, error: null };
        } catch (error) {
            console.error('Incremental QCM stats sync failed:', error);
            this.markUnsyncedChange(); // renvoyé par la prochaine synchro complète
            return { success: false, data: null, error: error.message };
        }
    },

    saveHistoryToCloud: async function () {
        if (!this.currentUser || !this.enabled)
            return { success: false, data: null, error: 'Not enabled or logged in' };
        // Les statistiques et l'historique QCM relèvent du consentement « statistiques », en plus de la synchro.
        if (!isStatsConsentGranted()) return { success: false, data: null, error: 'stats-consent-missing' };
        // Hors ligne, l'écriture Firestore ne répond qu'au retour du réseau : on le signale
        // tout de suite (voyant orange) et la synchro de rattrapage 'online' s'en chargera.
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            this.markUnsyncedChange();
            return { success: false, data: null, error: 'Offline' };
        }

        try {
            const { doc, setDoc } = await loadFirestoreModule();
            const uid = this.currentUser.uid;

            const examHistory = this.getLocalExamHistory();
            const examDocRef = doc(db, 'users', uid, 'stats', 'exam_history');
            await setDoc(examDocRef, examHistory);

            this.lastSyncTime = new Date().toLocaleTimeString();
            this.updateModalUI(); // Toujours rafraîchir l'UI après une synchro partielle
            console.log('Incremental exam history synced.');
            return { success: true, data: null, error: null };
        } catch (error) {
            console.error('Incremental exam history sync failed:', error);
            this.markUnsyncedChange(); // renvoyé par la prochaine synchro complète
            return { success: false, data: null, error: error.message };
        }
    },

    savePreferencesToCloud: async function () {
        if (!this.currentUser || !this.enabled || this.syncingData)
            return { success: false, data: null, error: 'Not enabled, syncing or not logged in' };

        try {
            const { doc, setDoc } = await loadFirestoreModule();
            const uid = this.currentUser.uid;

            const prefs = this.getLocalPreferences();
            const prefsDocRef = doc(db, 'users', uid, 'preferences', 'user_prefs');
            await setDoc(prefsDocRef, prefs);

            this.lastSyncTime = new Date().toLocaleTimeString();
            this.updateModalUI(); // Toujours rafraîchir l'UI après une synchro partielle
            console.log('Incremental preferences synced.');
            return { success: true, data: null, error: null };
        } catch (error) {
            console.error('Incremental preferences sync failed:', error);
            return { success: false, data: null, error: error.message };
        }
    },

    syncLogbookData: async function (data) {
        if (!this.currentUser || !this.enabled || this.syncingData || this._activeSyncPromise)
            return { success: false, data: null, error: 'Not enabled, syncing or not logged in' };

        try {
            const { doc, setDoc, collection, getDocs } = await this._loadFirestore();
            const uid = this.currentUser.uid;

            // Un vol supprimé est définitif : on n'écrase jamais son marqueur cloud ni un vol cloud plus récent (LWW)
            const deletedIds = new Set();
            const cloudUpdatedAt = new Map();
            (await getDocs(collection(db, 'users', uid, 'logbook'))).forEach((d) => {
                const docData = d.data();
                if (docData?.deleted === true && docData.id) deletedIds.add(docData.id);
                else if (docData?.id) cloudUpdatedAt.set(docData.id, Number(docData.updatedAt) || 0);
            });

            // Save all locally present to cloud
            for (const session of data) {
                if (deletedIds.has(session.id)) continue;
                if ((cloudUpdatedAt.get(session.id) || 0) > (Number(session.updatedAt) || 0)) continue;
                const docRef = doc(db, 'users', uid, 'logbook', session.id);
                await setDoc(docRef, stripTrace(session));
            }

            this.lastSyncTime = new Date().toLocaleTimeString();
            this.updateModalUI(); // Toujours rafraîchir l'UI après une synchro partielle
            console.log('Logbook data synced incrementally.');
            return { success: true, data: null, error: null };
        } catch (error) {
            console.error('Logbook incremental sync failed:', error);
            return { success: false, data: null, error: error.message };
        }
    },

    deleteLogbookEntry: async function (id) {
        if (!this.currentUser || !this.enabled)
            return { success: false, data: null, error: 'Not enabled or logged in' };

        try {
            const { doc, setDoc } = await this._loadFirestore();
            const uid = this.currentUser.uid;

            const docRef = doc(db, 'users', uid, 'logbook', id);
            await setDoc(docRef, deletedFlightMarker(id));
            await this._deleteFlightTrace(await this._loadFirestore(), uid, id);
            console.log(`Logbook entry ${id} deleted from cloud.`);
            return { success: true, data: null, error: null };
        } catch (error) {
            console.error('Logbook entry delete failed:', error);
            return { success: false, data: null, error: error.message };
        }
    },

    syncEquipmentData: async function (data) {
        if (!this.currentUser || !this.enabled || this.syncingData || this._activeSyncPromise)
            return { success: false, data: null, error: 'Not enabled, syncing or not logged in' };

        try {
            const { doc, setDoc } = await loadFirestoreModule();
            const uid = this.currentUser.uid;

            // Save all locally present to cloud
            for (const item of data) {
                const docRef = doc(db, 'users', uid, 'equipment', item.id);
                await setDoc(docRef, item);
            }

            this.lastSyncTime = new Date().toLocaleTimeString();
            this.updateModalUI(); // Toujours rafraîchir l'UI après une synchro partielle
            console.log('Equipment data synced incrementally.');
            return { success: true, data: null, error: null };
        } catch (error) {
            console.error('Equipment incremental sync failed:', error);
            return { success: false, data: null, error: error.message };
        }
    },

    deleteEquipmentEntry: async function (id) {
        if (!this.currentUser || !this.enabled)
            return { success: false, data: null, error: 'Not enabled or logged in' };

        try {
            const { doc, deleteDoc } = await loadFirestoreModule();
            const uid = this.currentUser.uid;

            const docRef = doc(db, 'users', uid, 'equipment', id);
            await deleteDoc(docRef);
            console.log(`Equipment entry ${id} deleted from cloud.`);
            return { success: true, data: null, error: null };
        } catch (error) {
            console.error('Equipment entry delete failed:', error);
            return { success: false, data: null, error: error.message };
        }
    },

    syncEquipmentEntry: async function (item) {
        if (!this.currentUser || !this.enabled || this.syncingData || this._activeSyncPromise)
            return { success: false, data: null, error: 'Not enabled, syncing or not logged in' };

        try {
            const { doc, setDoc } = await loadFirestoreModule();
            const uid = this.currentUser.uid;

            const docRef = doc(db, 'users', uid, 'equipment', item.id);
            await setDoc(docRef, item);

            this.lastSyncTime = new Date().toLocaleTimeString();
            this.updateModalUI(); // Toujours rafraîchir l'UI après une synchro partielle
            console.log('Equipment entry synced successfully:', item.id);
            return { success: true, data: null, error: null };
        } catch (error) {
            console.error('Equipment entry sync failed:', error);
            return { success: false, data: null, error: error.message };
        }
    },

    syncLogbookEntry: async function (session) {
        if (!this.currentUser || !this.enabled || this.syncingData || this._activeSyncPromise)
            return { success: false, data: null, error: 'Not enabled, syncing or not logged in' };

        try {
            const { doc, getDoc, setDoc } = await this._loadFirestore();
            const uid = this.currentUser.uid;

            const docRef = doc(db, 'users', uid, 'logbook', session.id);
            // Un vol supprimé est définitif : on n'écrase jamais son marqueur cloud
            const existing = await getDoc(docRef);
            if (existing.exists() && existing.data()?.deleted === true) {
                return { success: true, data: null, error: null };
            }
            await setDoc(docRef, stripTrace(session));

            this.lastSyncTime = new Date().toLocaleTimeString();
            this.updateModalUI(); // Toujours rafraîchir l'UI après une synchro partielle
            console.log('Logbook entry synced successfully:', session.id);
            return { success: true, data: null, error: null };
        } catch (error) {
            console.error('Logbook entry sync failed:', error);
            return { success: false, data: null, error: error.message };
        }
    },

    // -----------------------------------------------------------------------
    // TRACES DE VOL — synchro des fichiers IGC entre appareils (specs/037-sync-flight-traces)
    // -----------------------------------------------------------------------
    /**
     * Supprime les morceaux de trace d'un vol dans le cloud. Sans gravité en cas d'échec (hors ligne,
     * règles pas encore publiées) : la suppression du vol, elle, est déjà faite.
     */
    _deleteFlightTrace: async function (firestore, uid, flightId) {
        try {
            await deleteFlightTraceParts({ firestore, db, uid, flightId });
        } catch (error) {
            console.warn('[Sync] Morceaux de trace non supprimés du cloud :', flightId, error.message);
        }
    },

    /**
     * 1. Récupère les traces restées dans d'anciens documents de vol (elles sont alors enregistrées sur
     *    l'appareil si elles n'y sont pas) ; 2. envoie la trace de quelques vols (TRACE_UPLOADS_PER_SYNC).
     * Le vol n'annonce `traceCloud` qu'une fois TOUS les morceaux écrits (FR-3). Un échec laisse le vol
     * inchangé : il sera retenté à la synchro suivante.
     * @returns {Promise<boolean>} vrai si des vols ont été modifiés (à enregistrer)
     */
    _syncFlightTraces: async function ({ firestoreModule, uid, flights, legacyTraces }) {
        const { doc, setDoc } = firestoreModule;
        this._noTraceKeys ??= new Set();
        const flightIds = new Set(flights.map((f) => f.id));

        // 1. Anciennes traces : gardées sur l'appareil pour ne pas dépendre du document cloud.
        for (const [id, raw] of legacyTraces) {
            if (!flightIds.has(id)) continue;
            if (!(await LogbookService.getLocalFlightTrace(id))) await IDBStorage.saveTrace(id, raw);
        }

        // 2. Envois, quelques vols par synchro.
        let changed = false;
        let budget = TRACE_UPLOADS_PER_SYNC;
        for (const flight of flights) {
            if (budget <= 0) break;
            if (!needsTraceUpload(flight)) continue;
            // Un vol sans trace est revérifié seulement si sa trace a changé (traceUpdatedAt).
            const key = `${flight.id}:${flight.traceUpdatedAt || 0}`;
            if (this._noTraceKeys.has(key)) continue;
            const rawIgc = (await LogbookService.getLocalFlightTrace(flight.id)) ?? legacyTraces.get(flight.id);
            if (!rawIgc) {
                this._noTraceKeys.add(key);
                continue;
            }
            budget--;
            try {
                const traceCloud = await uploadFlightTrace({
                    firestore: firestoreModule,
                    db,
                    uid,
                    flightId: flight.id,
                    rawIgc,
                    previousParts: flight.traceCloud?.parts || 0,
                });
                flight.traceCloud = traceCloud;
                flight.updatedAt = Date.now();
                // setDoc remplace le document : une éventuelle ancienne trace (rawIgc) en disparaît.
                await setDoc(doc(db, 'users', uid, 'logbook', flight.id), stripTrace(flight));
                changed = true;
            } catch (error) {
                // Trop volumineuse : inutile de réessayer. Autre cause (hors ligne, règles absentes) : à la prochaine.
                if (error?.name === 'TraceTooLargeError') this._noTraceKeys.add(key);
                console.warn(
                    '[Sync] Trace de vol non envoyée, nouvel essai à la prochaine synchro :',
                    flight.id,
                    error.message,
                );
            }
        }
        return changed;
    },

    /**
     * Relit depuis le cloud la trace d'un vol qui n'est pas sur cet appareil. Appelée à la demande du pilote
     * (LogbookService.getFlightTrace), jamais à l'avance. Rend null si elle est introuvable ou illisible.
     * @param {string} flightId
     * @returns {Promise<string|null>}
     */
    fetchFlightTrace: async function (flightId) {
        if (!this.currentUser || !this.enabled) return null;
        const traceCloud = LogbookService.getFlightById(flightId)?.traceCloud;
        if (!traceCloud) return null;
        try {
            const firestore = await this._loadFirestore();
            return await downloadFlightTrace({ firestore, db, uid: this.currentUser.uid, flightId, traceCloud });
        } catch (error) {
            console.warn('[Sync] Trace de vol non récupérée depuis le cloud :', flightId, error.message);
            return null;
        }
    },

    // -----------------------------------------------------------------------
    // PUSH — Alertes météo en arrière-plan sur les sites favoris (FCM)
    // -----------------------------------------------------------------------
    /**
     * Demande la permission de notification au navigateur, récupère un token FCM et le
     * sauvegarde dans Firestore (users/{uid}, champ fcmToken). La Cloud Function planifiée
     * (functions/index.js) lit ce champ pour savoir où envoyer les alertes météo favoris.
     * Nécessite : un compte connecté, FCM_VAPID_KEY renseigné (js/firebase_config.js), et
     * que le Service Worker (sw.js) soit actif — c'est lui qui gère la réception en arrière-plan.
     */
    enablePushNotifications: async function () {
        if (!this.currentUser || !this.enabled) {
            this.showAlert(t('account.alerts.loginFirst'), 'error');
            return { success: false, error: 'Not logged in' };
        }
        if (typeof FCM_VAPID_KEY === 'undefined' || !FCM_VAPID_KEY) {
            this.showAlert(t('account.alerts.missingVapid'), 'error');
            return { success: false, error: 'Missing VAPID key' };
        }
        if (!('serviceWorker' in navigator) || !('Notification' in window)) {
            this.showAlert(t('account.alerts.unsupported'), 'error');
            return { success: false, error: 'Unsupported' };
        }

        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                this.showAlert(t('account.alerts.permissionDenied'), 'error');
                return { success: false, error: 'Permission denied' };
            }

            const swRegistration = await navigator.serviceWorker.ready;
            const { getMessaging, getToken } = await loadMessagingModule();
            const messaging = getMessaging(app);
            const token = await getToken(messaging, {
                vapidKey: FCM_VAPID_KEY,
                serviceWorkerRegistration: swRegistration,
            });

            if (!token) {
                this.showAlert(t('account.alerts.noToken'), 'error');
                return { success: false, error: 'No token' };
            }

            const { doc, setDoc } = await loadFirestoreModule();
            await setDoc(doc(db, 'users', this.currentUser.uid), { fcmToken: token }, { merge: true });

            this.showStatus(t('account.alerts.enabled'), 'success');
            return { success: true, data: token, error: null };
        } catch (error) {
            console.error("Échec de l'activation des notifications push:", error);
            this.showAlert(t('account.alerts.failed', { detail: error.message ? ` : ${error.message}` : '' }), 'error');
            return { success: false, data: null, error: error.message };
        }
    },

    // Merge algorithms

    _latestReviewState: latestReviewState,
    _mergeChoicePicks: mergeChoicePicks,
    _mergeChoiceMisses: mergeChoiceMisses,
    _mergeAnswers: mergeAnswers,
    mergeQcmStats: mergeQcmStats,
    mergeExamHistory: mergeExamHistory,
    mergePreferences: mergePreferences,
    getLocalQcmStats: getLocalQcmStats,
    getLocalExamHistory: getLocalExamHistory,
    getLocalPreferences: getLocalPreferences,

    // Alert UI management
    showAlert: function (message, type) {
        const alertEl = document.getElementById('auth-alert');
        if (alertEl) {
            alertEl.className = `auth-alert ${type}`;
            alertEl.textContent = message;
            alertEl.style.display = 'block';
        }
    },

    showStatus: function (message, type) {
        this.showAlert(message, type);
    },

    clearAlerts: function () {
        const alertEl = document.getElementById('auth-alert');
        if (alertEl) {
            alertEl.className = 'auth-alert';
            alertEl.style.display = 'none';
            alertEl.textContent = '';
        }
    },
};

// Bind to window immediately
window.FirebaseAuthEngine = FirebaseAuthEngine;

// Initialize on DOM load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => FirebaseAuthEngine.init());
} else {
    FirebaseAuthEngine.init();
}
export default FirebaseAuthEngine;
