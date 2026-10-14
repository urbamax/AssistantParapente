/**
 * SERVICE - Firebase Wrapper (ES6)
 * Wraps the legacy firebase_engine to preserve sync logic exactly as requested.
 */
import StorageService from './storage.js';
import GdprEngine from '../gdpr_engine.js';
import AppRouter from '../core/router.js';
import GlobalState from '../core/app_state.js';
import SitesService, { migrateSitePrefs } from './sites_service.js';
import LogbookService from './logbook_service.js';
import { t } from '../utils/i18n.js';

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
        GlobalState.subscribe('syncStatus', (status) => {
            const dot = document.getElementById('sync-active-dot');
            if (!dot) return;
            dot.classList.toggle('active', status === 'syncing' || status === 'pending');
            dot.classList.toggle('pending', status === 'pending');
            dot.title = SYNC_DOT_TITLES[status] || '';
        });

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
    },

    // UI Helpers
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
    syncDataWithCloud: async function (silent = false) {
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
            const { doc, getDoc, setDoc, collection, getDocs, deleteDoc } = await this._loadFirestore();
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
                }
                localStorage.setItem('deleted_flights', '[]');
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

            // 1. Process Pending Queue (Local -> Cloud)
            const pendingLogbook = localLogbook.filter((s) => s.syncPending);
            for (const session of pendingLogbook) {
                const sRef = doc(db, 'users', uid, 'logbook', session.id);
                delete session.syncPending;
                await setDoc(sRef, session);
            }
            if (pendingLogbook.length > 0) {
                StorageService.set(StorageService.KEYS.LOGBOOK_DATA, localLogbook);
            }

            const logbookColRef = collection(db, 'users', uid, 'logbook');
            const logbookSnap = await getDocs(logbookColRef);

            const cloudLogbook = [];
            // Vols supprimés sur un autre appareil : id -> date de suppression
            const cloudDeletedAt = new Map();
            logbookSnap.forEach((docSnap) => {
                const data = docSnap.data();
                // Guard : on n'accepte que les docs avec un ID string valide
                if (data && data.id && typeof data.id === 'string') {
                    if (data.deleted === true) cloudDeletedAt.set(data.id, data.deletedAt || 0);
                    else cloudLogbook.push(data);
                }
            });

            // 2. Smart Merge: Compare updatedAt
            // Re-read tombstones here in case a deletion happened concurrently while this sync
            // was running (race condition: deleteLogbookEntry fires async, sync reads cloud
            // before the delete completes → cloud still has the doc → merge would re-add it).
            const newlyDeletedFlights = readTombstoneIds('deleted_flights');
            const deletedFlightsSet = new Set([...deletedFlights, ...newlyDeletedFlights]);

            // The local snapshot was read before this point too: a flight deleted meanwhile must
            // not come back from it either (it would then be re-uploaded on the next sync).
            const mergedLogbookMap = new Map();
            localLogbook.forEach((session) => {
                if (deletedFlightsSet.has(session.id)) return;
                // Supprimé ailleurs : définitif, un appareil resté en retard ne le ressuscite pas.
                if (cloudDeletedAt.has(session.id)) return;
                mergedLogbookMap.set(session.id, session);
            });
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
                    await setDoc(sRef, session);
                }
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
                localStorage.setItem('deleted_equipment', '[]');
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

            // 1. Process Pending Queue (Local -> Cloud)
            const pendingEquip = localEquip.filter((e) => e.syncPending);
            for (const item of pendingEquip) {
                // Guard : ID obligatoire en string
                if (!item.id || typeof item.id !== 'string') continue;
                const eRef = doc(db, 'users', uid, 'equipment', item.id);
                delete item.syncPending;
                await setDoc(eRef, item);
            }
            if (pendingEquip.length > 0) {
                StorageService.set(StorageService.KEYS.EQUIPMENT_DATA, localEquip);
            }

            const equipColRef = collection(db, 'users', uid, 'equipment');
            const equipSnap = await getDocs(equipColRef);

            const cloudEquip = [];
            equipSnap.forEach((docSnap) => {
                const data = docSnap.data();
                // Guard : on n'accepte que les docs avec un ID string valide
                if (data && data.id && typeof data.id === 'string') {
                    cloudEquip.push(data);
                }
            });

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

            // Refresh UI if quiz stats are currently visible.
            // NB : ces trois blocs référençaient auparavant les anciens globals
            // QuizEngine/SitesEngine/LogbookEngine, qui n'existent plus depuis le passage à
            // l'architecture services/vues (js/core/main.js) — ce rafraîchissement post-sync
            // ne faisait donc plus jamais rien. Corrigé en important directement les modules
            // (SitesService/LogbookService/QuizView).
            // Les statistiques ne se rafraîchissent que si l'écran a déjà été chargé (sinon rien n'est affiché).
            AppRouter.getView('STATS')?.renderStats?.();

            // Refresh sites list so that limits, favorites and locations are re-applied
            SitesService.loadUserPreferences();
            SitesService.renderList();

            // Refresh logbook (flights + equipment) and re-render whichever tab is open.
            // On ne touche pas à l'onglet "add" : c'est un formulaire (vol ou gonflage), pas
            // une vue de données, et le re-render effacerait une saisie/modification en cours.
            // On attend whenReady() avant de rendre : sinon le rendu peut avoir lieu avant la
            // réhydratation de rawIgc depuis IndexedDB, cachant à tort le bouton "Voir la trace"
            // d'un vol dont la trace n'est stockée que là (cf. LogbookService.getFlightTrace()).
            // Rien de changé (cas le plus courant de la synchro toutes les 30 s) : pas de nouveau
            // rendu, qui refermait les traces et les encarts ouverts par le pilote.
            const shownBefore = LogbookService.dataSignature();
            LogbookService.loadData();
            await LogbookService.whenReady();
            const logbookView = AppRouter.getView('LOGBOOK');
            if (logbookView && logbookView.currentTab !== 'add' && LogbookService.dataSignature() !== shownBefore) {
                logbookView.switchTab(logbookView.currentTab);
            }

            console.log('Sync complete!');

            // Persistance de l'heure dans le localStorage (survit au rechargement)
            this.lastSyncTime = new Date().toLocaleTimeString();

            // On rafraîchit TOUJOURS la modal après une synchro réussie,
            // y compris les synchros silencieuses, pour que l'heure soit à jour.
            this.updateModalUI();

            if (!silent) {
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

    // Write-through updates to Cloud when user makes progress
    saveStatsToCloud: async function () {
        if (!this.currentUser || !this.enabled)
            return { success: false, data: null, error: 'Not enabled or logged in' };
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
        if (!this.currentUser || !this.enabled || this.syncingData)
            return { success: false, data: null, error: 'Not enabled, syncing or not logged in' };

        try {
            const { doc, setDoc, collection, getDocs } = await this._loadFirestore();
            const uid = this.currentUser.uid;

            // Un vol supprimé est définitif : on n'écrase jamais son marqueur cloud
            const deletedIds = new Set();
            (await getDocs(collection(db, 'users', uid, 'logbook'))).forEach((d) => {
                const data = d.data();
                if (data?.deleted === true && data.id) deletedIds.add(data.id);
            });

            // Save all locally present to cloud
            for (const session of data) {
                if (deletedIds.has(session.id)) continue;
                const docRef = doc(db, 'users', uid, 'logbook', session.id);
                await setDoc(docRef, session);
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
            console.log(`Logbook entry ${id} deleted from cloud.`);
            return { success: true, data: null, error: null };
        } catch (error) {
            console.error('Logbook entry delete failed:', error);
            return { success: false, data: null, error: error.message };
        }
    },

    syncEquipmentData: async function (data) {
        if (!this.currentUser || !this.enabled || this.syncingData)
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
        if (!this.currentUser || !this.enabled || this.syncingData)
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
        if (!this.currentUser || !this.enabled || this.syncingData)
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
            await setDoc(docRef, session);

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

    // -----------------------------------------------------------------------
    // EXPORT — Compile toutes les données locales en un fichier JSON
    // -----------------------------------------------------------------------
    /**
     * Exporte l'intégralité des données utilisateur (localStorage) en un fichier JSON.
     * Couvre toutes les clés de StorageService.KEYS + les clés système associées.
     * Le fichier est automatiquement téléchargé dans le navigateur.
     */
    exportAllData: function () {
        // Récupère toutes les données connues de l'application
        const exportPayload = {
            // Méta-données pour identifier et valider l'import
            _meta: {
                appName: 'AssistantParapente',
                exportVersion: '1.0',
                exportedAt: new Date().toISOString(),
                exportedBy: this.currentUser ? this.currentUser.email : 'anonymous',
            },
            // --- Données structurées via StorageService.KEYS ---
            [StorageService.KEYS.STATE]: StorageService.get(StorageService.KEYS.STATE),
            [StorageService.KEYS.USER_LEVEL]: StorageService.get(StorageService.KEYS.USER_LEVEL),
            [StorageService.KEYS.THEME_MODE]: StorageService.get(StorageService.KEYS.THEME_MODE),
            [StorageService.KEYS.USER_PREFS]: StorageService.get(StorageService.KEYS.USER_PREFS),
            [StorageService.KEYS.LOGBOOK_DATA]: StorageService.get(StorageService.KEYS.LOGBOOK_DATA),
            [StorageService.KEYS.EQUIPMENT_DATA]: StorageService.get(StorageService.KEYS.EQUIPMENT_DATA),
            [StorageService.KEYS.QCM_STATS]: StorageService.get(StorageService.KEYS.QCM_STATS),
            [StorageService.KEYS.EXAM_HISTORY]: StorageService.get(StorageService.KEYS.EXAM_HISTORY),
            [StorageService.KEYS.PENDING_QUIZ]: StorageService.get(StorageService.KEYS.PENDING_QUIZ),
            // --- Clés système supplémentaires ---
            deleted_flights: readTombstoneIds('deleted_flights'),
            deleted_equipment: readTombstoneIds('deleted_equipment'),
            LAST_ACTIVE_ROUTE: localStorage.getItem('LAST_ACTIVE_ROUTE'),
            firebase_last_sync: localStorage.getItem(LAST_SYNC_STORAGE_KEY),
        };

        // Sérialise en JSON lisible
        const jsonString = JSON.stringify(exportPayload, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        // Génère un nom de fichier avec date pour faciliter l'archivage
        const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const filename = `parapente_backup_${date}.json`;

        // Déclenche le téléchargement
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log(`[Firebase] Export réussi : ${filename}`);
        this.showAlert(t('account.backup.downloaded', { filename }), 'success');
    },

    // -----------------------------------------------------------------------
    // IMPORT — Restaure toutes les données depuis un fichier JSON exporté
    // -----------------------------------------------------------------------
    /**
     * Importe toutes les données depuis un fichier JSON généré par exportAllData().
     * Valide la structure avant d'écraser les données locales.
     * Déclenche une synchro cloud immédiate après restauration.
     * @param {File} file - Le fichier .json sélectionné par l'utilisateur.
     */
    importAllData: function (file) {
        if (!file) {
            this.showAlert(t('account.backup.noFile'), 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(String(event.target.result));

                // Validation minimale : vérifie la présence des méta-données
                if (!data._meta || data._meta.appName !== 'AssistantParapente') {
                    this.showAlert(t('account.backup.invalidFile'), 'error');
                    return;
                }

                const confirm = window.confirm(
                    t('account.backup.confirmImport', { date: new Date(data._meta.exportedAt).toLocaleString() }),
                );
                if (!confirm) return;

                this.showStatus(t('account.backup.restoring'), 'info');

                // --- Restauration de toutes les clés StorageService.KEYS ---
                const keysToRestore = [
                    StorageService.KEYS.STATE,
                    StorageService.KEYS.USER_LEVEL,
                    StorageService.KEYS.THEME_MODE,
                    StorageService.KEYS.USER_PREFS,
                    StorageService.KEYS.LOGBOOK_DATA,
                    StorageService.KEYS.EQUIPMENT_DATA,
                    StorageService.KEYS.QCM_STATS,
                    StorageService.KEYS.EXAM_HISTORY,
                    StorageService.KEYS.PENDING_QUIZ,
                ];

                keysToRestore.forEach((key) => {
                    if (data[key] !== undefined && data[key] !== null) {
                        StorageService.set(key, data[key]);
                    }
                });

                // --- Restauration des clés système ---
                if (Array.isArray(data.deleted_flights)) {
                    localStorage.setItem('deleted_flights', JSON.stringify(data.deleted_flights));
                }
                if (Array.isArray(data.deleted_equipment)) {
                    localStorage.setItem('deleted_equipment', JSON.stringify(data.deleted_equipment));
                }
                if (data.LAST_ACTIVE_ROUTE) {
                    localStorage.setItem('LAST_ACTIVE_ROUTE', data.LAST_ACTIVE_ROUTE);
                }
                if (data.firebase_last_sync) {
                    localStorage.setItem(LAST_SYNC_STORAGE_KEY, data.firebase_last_sync);
                }

                console.log('[Firebase] Import local réussi. Déclenchement de la synchro cloud...');

                // Synchro cloud complète pour envoyer les données restaurées vers le cloud
                if (this.currentUser && this.enabled) {
                    await this.syncDataWithCloud(false); // visible = non-silencieux
                } else {
                    this.showAlert(t('account.backup.restored'), 'success');
                }

                // Recharge l'UI pour refléter les nouvelles données
                const mode = GlobalState.state.mode;
                if (mode === 'STATS') {
                    AppRouter.getView('STATS')?.renderStats?.();
                } else if (mode === 'LOGBOOK') {
                    LogbookService.loadData();
                    await LogbookService.whenReady();
                    const logbookView = AppRouter.getView('LOGBOOK');
                    logbookView?.switchTab(logbookView.currentTab);
                }
            } catch (parseError) {
                console.error("[Firebase] Erreur lors de l'import :", parseError);
                this.showAlert(t('account.backup.readError'), 'error');
            }
        };
        reader.readAsText(file);
    },

    // Merge algorithms

    // État de révision espacée (streak + lastSeen) d'une question : on garde celui de l'appareil
    // qui a vu la question le plus récemment. Prendre le max des streaks effacerait une erreur
    // récente (streak remis à 0 sur le téléphone, 4 dans le cloud), et ne pas recopier lastSeen
    // faisait retomber le mode Révision sur l'ancien critère de ratio après chaque synchro.
    _latestReviewState: function (a, b) {
        const aSeen = a.lastSeen || 0;
        const bSeen = b.lastSeen || 0;
        if (!aSeen && !bSeen) return { streak: Math.max(a.streak || 0, b.streak || 0) };
        if (aSeen === bSeen) return { streak: Math.max(a.streak || 0, b.streak || 0), lastSeen: aSeen };
        const latest = aSeen > bSeen ? a : b;
        return { streak: latest.streak || 0, lastSeen: latest.lastSeen };
    },

    mergeQcmStats: function (local, cloud) {
        const merged = {
            totalQuestions: 0,
            totalCorrect: 0,
            themes: {},
            questions: {},
        };

        // Combine all question keys
        const allQuestions = new Set([...Object.keys(local.questions || {}), ...Object.keys(cloud.questions || {})]);

        allQuestions.forEach((qCode) => {
            const lQ = (local.questions || {})[qCode] || { total: 0, correct: 0, streak: 0 };
            const cQ = (cloud.questions || {})[qCode] || { total: 0, correct: 0, streak: 0 };

            merged.questions[qCode] = {
                total: Math.max(lQ.total, cQ.total),
                correct: Math.max(lQ.correct, cQ.correct),
                ...this._latestReviewState(lQ, cQ),
            };
        });

        // Combine themes keys
        const allThemes = new Set([...Object.keys(local.themes || {}), ...Object.keys(cloud.themes || {})]);

        allThemes.forEach((theme) => {
            const lT = (local.themes || {})[theme] || { total: 0, correct: 0 };
            const cT = (cloud.themes || {})[theme] || { total: 0, correct: 0 };

            merged.themes[theme] = {
                total: Math.max(lT.total, cT.total),
                correct: Math.max(lT.correct, cT.correct),
            };
        });

        // Global metrics
        merged.totalQuestions = Math.max(local.totalQuestions || 0, cloud.totalQuestions || 0);
        merged.totalCorrect = Math.max(local.totalCorrect || 0, cloud.totalCorrect || 0);

        return merged;
    },

    mergeExamHistory: function (local, cloud) {
        const localExams = local.exams || [];
        const cloudExams = cloud.exams || [];

        // Use a Map keyed by exam ID or ISO string date to remove duplicates
        const examMap = new Map();

        localExams.forEach((exam) => {
            const key = exam.id || exam.date;
            examMap.set(key, exam);
        });

        cloudExams.forEach((exam) => {
            const key = exam.id || exam.date;
            // In case of conflict, we keep the one already present or cloud.
            // Since exam logs are read-only historic records, duplicates are identical.
            examMap.set(key, exam);
        });

        // Convert map back to list, sort descending by date (newest first), and limit to 10
        const mergedExams = Array.from(examMap.values());
        mergedExams.sort((a, b) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            return dateB - dateA;
        });

        return {
            exams: mergedExams.slice(0, 10),
        };
    },

    mergePreferences: function (local, cloud) {
        if (!cloud) return local;
        if (!local) return cloud;

        // 1. Le Cloud est la source de vérité absolue (recharge à la connexion)
        const merged = { ...cloud };

        // 2. On récupère les valeurs locales qui n'existent pas du tout dans le cloud
        // (Utile pour rétrocompatibilité lors de l'ajout d'une nouvelle option locale)
        for (const key in local) {
            if (merged[key] === undefined) {
                merged[key] = local[key];
            }
        }

        // 3. Cas spécifiques : Fusion intelligente des tableaux pour ne pas perdre les données des deux côtés
        const localFavs = local.favoriteSites || [];
        const cloudFavs = cloud.favoriteSites || [];
        merged.favoriteSites = Array.from(new Set([...localFavs, ...cloudFavs]));

        const localMin = local.minimizedSites || [];
        const cloudMin = cloud.minimizedSites || [];
        merged.minimizedSites = Array.from(new Set([...localMin, ...cloudMin]));

        const mergedLocsMap = new Map();
        (cloud.savedLocations || []).forEach((loc) => mergedLocsMap.set(loc.name, loc));
        (local.savedLocations || []).forEach((loc) => mergedLocsMap.set(loc.name, loc));
        merged.savedLocations = Array.from(mergedLocsMap.values());

        // Réglages retirés ou renommés (spec 002) : rayon « Illimité », modèle « meteoblue ».
        return migrateSitePrefs(merged);
    },

    // LocalStorage Getters
    getLocalQcmStats: function () {
        const saved = StorageService.get(StorageService.KEYS.QCM_STATS);
        if (saved && typeof saved === 'object') return saved;
        return { totalQuestions: 0, totalCorrect: 0, themes: {}, questions: {} };
    },

    getLocalExamHistory: function () {
        const saved = StorageService.get(StorageService.KEYS.EXAM_HISTORY);
        if (Array.isArray(saved)) return { exams: saved };
        if (saved && typeof saved === 'object' && saved.exams) return saved;
        return { exams: [] };
    },

    getLocalPreferences: function () {
        const defaults = {
            pilotLevel: 'ALL',
            themeMode: 'auto',
            favoriteSites: [],
            minimizedSites: [],
            savedLocations: [],
            activeMapLayers: ['leaflet', 'windy', 'meteoparapente', 'paraglidingearth', 'paraglidable', 'isofronts'],
            limitWindMin: 0,
            limitWindMax: 25,
            limitGustDelta: 10,
            hideUnflyable: false,
            radiusLimit: 50,
            sortMode: 'CONDITIONS',
            conditionsStrategy: 'CONSECUTIVE',
            weatherModel: 'meteofrance',
        };
        let prefs = { ...defaults };
        const saved = StorageService.get(StorageService.KEYS.USER_PREFS);
        if (saved && typeof saved === 'object') {
            prefs = { ...prefs, ...saved };
            // Ensure arrays exist
            if (!prefs.favoriteSites) prefs.favoriteSites = [];
            if (!prefs.minimizedSites) prefs.minimizedSites = [];
            if (!prefs.savedLocations) prefs.savedLocations = [];
            if (!prefs.activeMapLayers) prefs.activeMapLayers = [...defaults.activeMapLayers];
        }

        // Always read latest pilot level from main app logic (userLevel)
        const globalLevel = StorageService.get(StorageService.KEYS.USER_LEVEL);
        if (globalLevel) {
            prefs.pilotLevel = globalLevel;
        }

        const themeMode = StorageService.get(StorageService.KEYS.THEME_MODE);
        if (themeMode) {
            prefs.themeMode = themeMode;
        }

        // Réglages retirés ou renommés (spec 002) : rayon « Illimité », modèle « meteoblue ».
        return migrateSitePrefs(prefs);
    },

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
