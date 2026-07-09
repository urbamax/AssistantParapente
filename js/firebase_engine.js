// --- FIREBASE AUTHENTICATION & SYNC ENGINE ---

let app, auth, db;
let isInitialized = false;

// We will expose this engine to the window object so it can be called from non-module scripts
const FirebaseAuthEngine = {
    enabled: false,
    currentUser: null,
    lastSyncTime: null,

    // Initialize Firebase
    init: async function() {
        if (typeof IS_FIREBASE_ENABLED === 'undefined' || !IS_FIREBASE_ENABLED) {
            console.log("Firebase sync is disabled (IS_FIREBASE_ENABLED is false).");
            this.updateHeaderUI();
            return;
        }

        // GDPR (RGPD) consent guard
        if (window.GdprEngine && !window.GdprEngine.isConsentGranted('firebase')) {
            console.log("Firebase initialization bypassed: waiting for user GDPR consent.");
            this.enabled = false;
            this.updateHeaderUI();
            return;
        }

        try {
            // Import Firebase SDKs dynamically from CDN
            const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
            const { getAuth, onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
            const { getFirestore } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");

            app = initializeApp(FIREBASE_CONFIG);
            auth = getAuth(app);
            db = getFirestore(app);
            this.enabled = true;
            isInitialized = true;
            console.log("Firebase successfully initialized.");

            // Listen to auth state changes
            onAuthStateChanged(auth, async (user) => {
                if (user) {
                    console.log("User logged in:", user.email);
                    this.currentUser = user;
                    this.updateHeaderUI();
                    this.updateModalUI();
                    
                    // Sync stats
                    await this.syncDataWithCloud();
                } else {
                    console.log("User logged out");
                    this.currentUser = null;
                    this.lastSyncTime = null;
                    this.updateHeaderUI();
                    this.updateModalUI();
                }
            });

        } catch (error) {
            console.error("Error initializing Firebase:", error);
            this.enabled = false;
        }
    },

    // UI Helpers
    openAuthModal: function() {
        const overlay = document.getElementById('auth-modal-overlay');
        if (overlay) {
            overlay.classList.add('active');
            this.clearAlerts();
            this.updateModalUI();
        }
    },

    closeAuthModal: function() {
        const overlay = document.getElementById('auth-modal-overlay');
        if (overlay) {
            overlay.classList.remove('active');
        }
    },

    switchTab: function(tabName) {
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
    updateHeaderUI: function() {
        const activeDot = document.getElementById('auth-active-dot');
        const authBtn = document.getElementById('auth-btn');
        
        if (activeDot && authBtn) {
            if (this.currentUser) {
                activeDot.classList.add('active');
                authBtn.title = `Connecté (${this.currentUser.email})`;
            } else {
                activeDot.classList.remove('active');
                authBtn.title = this.enabled ? "Se connecter / S'enregistrer" : "Synchronisation désactivée (Cliquez pour configurer)";
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
    updateModalUI: function() {
        const setupRequiredView = document.getElementById('auth-setup-required-view');
        const anonymousView = document.getElementById('auth-anonymous-view');
        const loggedInView = document.getElementById('auth-logged-in-view');
        
        if (!setupRequiredView || !anonymousView || !loggedInView) return;

        // Hide all first
        setupRequiredView.style.display = 'none';
        anonymousView.style.display = 'none';
        loggedInView.style.display = 'none';

        if (!this.enabled) {
            setupRequiredView.style.display = 'block';
            const devDesc = document.getElementById('auth-setup-required-desc');
            const gdprDesc = document.getElementById('auth-gdpr-required-desc');
            
            if (typeof IS_FIREBASE_ENABLED === 'undefined' || !IS_FIREBASE_ENABLED) {
                if (devDesc) devDesc.style.display = 'block';
                if (gdprDesc) gdprDesc.style.display = 'none';
            } else {
                if (devDesc) devDesc.style.display = 'none';
                if (gdprDesc) gdprDesc.style.display = 'block';
            }
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

            // Set sync time
            const syncTimeEl = document.getElementById('auth-sync-time');
            if (syncTimeEl) {
                syncTimeEl.textContent = this.lastSyncTime || "Jamais";
            }
        } else {
            anonymousView.style.display = 'block';
        }
    },

    // Auth actions
    signUp: async function(email, password, confirmPassword) {
        if (!isInitialized) return;
        this.clearAlerts();
        
        if (password !== confirmPassword) {
            this.showAlert("Les mots de passe ne correspondent pas.", "error");
            return;
        }

        try {
            const { createUserWithEmailAndPassword, setPersistence, indexedDBLocalPersistence, browserSessionPersistence } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
            this.showStatus("Création du compte...", "info");
            
            // Set persistence dynamically
            const rememberMeEl = document.getElementById('register-remember-me');
            const rememberMe = rememberMeEl ? rememberMeEl.checked : true;
            await setPersistence(auth, rememberMe ? indexedDBLocalPersistence : browserSessionPersistence);

            await createUserWithEmailAndPassword(auth, email, password);
            this.showAlert("Compte créé avec succès !", "success");
        } catch (error) {
            console.error("Signup error:", error);
            let message = "Erreur lors de la création du compte.";
            if (error.code === 'auth/email-already-in-use') {
                message = "Cet email est déjà utilisé.";
            } else if (error.code === 'auth/invalid-email') {
                message = "Format d'adresse email invalide.";
            } else if (error.code === 'auth/weak-password') {
                message = "Le mot de passe doit contenir au moins 6 caractères.";
            }
            this.showAlert(message, "error");
        }
    },

    signIn: async function(email, password) {
        if (!isInitialized) return;
        this.clearAlerts();

        try {
            const { signInWithEmailAndPassword, setPersistence, indexedDBLocalPersistence, browserSessionPersistence } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
            this.showStatus("Connexion...", "info");
            
            // Set persistence dynamically
            const rememberMeEl = document.getElementById('login-remember-me');
            const rememberMe = rememberMeEl ? rememberMeEl.checked : true;
            await setPersistence(auth, rememberMe ? indexedDBLocalPersistence : browserSessionPersistence);

            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            console.error("Signin error:", error);
            let message = "Identifiants incorrects ou compte inexistant.";
            if (error.code === 'auth/invalid-email') {
                message = "Format d'adresse email invalide.";
            } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                message = "Email ou mot de passe incorrect.";
            }
            this.showAlert(message, "error");
        }
    },

    signOut: async function() {
        if (!isInitialized) return;
        try {
            const { signOut } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
            await signOut(auth);
            this.closeAuthModal();
            alert("Vous avez été déconnecté.");
        } catch (error) {
            console.error("Signout error:", error);
        }
    },

    forgotPassword: async function(email) {
        if (!isInitialized) return;
        if (!email) {
            this.showAlert("Veuillez saisir votre email.", "error");
            return;
        }
        this.clearAlerts();

        try {
            const { sendPasswordResetEmail } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
            await sendPasswordResetEmail(auth, email);
            this.showAlert("Email de réinitialisation envoyé !", "success");
        } catch (error) {
            console.error("Forgot password error:", error);
            this.showAlert("Erreur lors de l'envoi de l'email.", "error");
        }
    },

    // Stats Cloud Synchronization Logic
    syncDataWithCloud: async function(silent = false) {
        if (!this.currentUser) return;
        
        if (!silent) {
            this.showStatus("Synchronisation en cours...", "info");
        }
        
        try {
            const { doc, getDoc, setDoc, collection, getDocs, deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
            const uid = this.currentUser.uid;
            
            // --- Sync Logbook ---
            const localLogbookStr = localStorage.getItem('tp_logbook_data');
            let localLogbook = [];
            if (localLogbookStr) {
                try { localLogbook = JSON.parse(localLogbookStr); } catch(e){}
            }
            
            const logbookColRef = collection(db, "users", uid, "logbook");
            const logbookSnap = await getDocs(logbookColRef);
            
            let cloudLogbook = [];
            logbookSnap.forEach(docSnap => {
                cloudLogbook.push(docSnap.data());
            });
            
            // Merge: Cloud wins on conflict
            let mergedLogbookMap = new Map();
            localLogbook.forEach(session => mergedLogbookMap.set(session.id, session));
            cloudLogbook.forEach(session => mergedLogbookMap.set(session.id, session));
            
            let mergedLogbook = Array.from(mergedLogbookMap.values());
            mergedLogbook.sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
            
            localStorage.setItem('tp_logbook_data', JSON.stringify(mergedLogbook));
            
            // Upload missing ones to cloud
            for (const session of mergedLogbook) {
                const sRef = doc(db, "users", uid, "logbook", session.id);
                await setDoc(sRef, session);
            }
            
            // --- Sync Equipment ---
            const localEquipStr = localStorage.getItem('tp_equipment_data');
            let localEquip = [];
            if (localEquipStr) {
                try { localEquip = JSON.parse(localEquipStr); } catch(e){}
            }
            
            const equipColRef = collection(db, "users", uid, "equipment");
            const equipSnap = await getDocs(equipColRef);
            
            let cloudEquip = [];
            equipSnap.forEach(docSnap => {
                cloudEquip.push(docSnap.data());
            });
            
            // Merge: Cloud wins on conflict
            let mergedEquipMap = new Map();
            localEquip.forEach(item => mergedEquipMap.set(item.id, item));
            cloudEquip.forEach(item => mergedEquipMap.set(item.id, item));
            
            let mergedEquip = Array.from(mergedEquipMap.values());
            
            localStorage.setItem('tp_equipment_data', JSON.stringify(mergedEquip));
            
            // Upload missing ones to cloud
            for (const item of mergedEquip) {
                const eRef = doc(db, "users", uid, "equipment", item.id);
                await setDoc(eRef, item);
            }
            
            // --- Sync QCM Stats ---
            const localQcmStats = this.getLocalQcmStats();
            const qcmDocRef = doc(db, "users", uid, "stats", "qcm_stats");
            const qcmDocSnap = await getDoc(qcmDocRef);
            
            let finalQcmStats = localQcmStats;
            if (qcmDocSnap.exists()) {
                const cloudQcmStats = qcmDocSnap.data();
                finalQcmStats = this.mergeQcmStats(localQcmStats, cloudQcmStats);
            }
            
            // Save back merged stats to both LocalStorage and Cloud
            localStorage.setItem('parapente_qcm_stats', JSON.stringify(finalQcmStats));
            await setDoc(qcmDocRef, finalQcmStats);

            // --- Sync Exam History ---
            const localExamHistory = this.getLocalExamHistory();
            const examDocRef = doc(db, "users", uid, "stats", "exam_history");
            const examDocSnap = await getDoc(examDocRef);
            
            let finalExamHistory = localExamHistory;
            if (examDocSnap.exists()) {
                const cloudExamHistory = examDocSnap.data();
                finalExamHistory = this.mergeExamHistory(localExamHistory, cloudExamHistory);
            }
            
            localStorage.setItem('parapente_exam_history', JSON.stringify(finalExamHistory));
            await setDoc(examDocRef, finalExamHistory);

            // --- Sync Preferences ---
            const localPrefs = this.getLocalPreferences();
            const prefsDocRef = doc(db, "users", uid, "preferences", "user_prefs");
            const prefsDocSnap = await getDoc(prefsDocRef);
            
            let finalPrefs = localPrefs;
            if (prefsDocSnap.exists()) {
                const cloudPrefs = prefsDocSnap.data();
                finalPrefs = this.mergePreferences(localPrefs, cloudPrefs);
            }
            
            localStorage.setItem('parapente_user_prefs', JSON.stringify(finalPrefs));
            
            // Update global userLevel from merged preferences if it's different
            this.syncingData = true;
            if (finalPrefs.pilotLevel && finalPrefs.pilotLevel !== localStorage.getItem('userLevel')) {
                if (window.Engine) {
                    window.Engine.changeLevel(finalPrefs.pilotLevel);
                } else {
                    localStorage.setItem('userLevel', finalPrefs.pilotLevel);
                }
            }
            if (finalPrefs.themeMode && finalPrefs.themeMode !== localStorage.getItem('themeMode')) {
                if (window.Engine) {
                    window.Engine.state.themeMode = finalPrefs.themeMode;
                    localStorage.setItem('themeMode', finalPrefs.themeMode);
                    window.Engine.applyThemeMode();
                } else {
                    localStorage.setItem('themeMode', finalPrefs.themeMode);
                }
            }
            this.syncingData = false;
            
            await setDoc(prefsDocRef, finalPrefs);

            // Refresh UI if QuizEngine stats are currently visible
            if (typeof QuizEngine !== 'undefined' && typeof QuizEngine.renderStats === 'function') {
                QuizEngine.renderStats();
            }

            // Refresh SitesEngine if it exists so that limits, favorites and locations are re-applied
            if (typeof SitesEngine !== 'undefined' && typeof SitesEngine.loadUserPreferences === 'function') {
                SitesEngine.loadUserPreferences();
                if (typeof SitesEngine.renderList === 'function') {
                    SitesEngine.renderList();
                }
            }

            // Refresh LogbookEngine if it exists
            if (typeof LogbookEngine !== 'undefined' && typeof LogbookEngine.loadData === 'function') {
                LogbookEngine.loadData();
                if (typeof LogbookEngine.loadEquipmentData === 'function') {
                    LogbookEngine.loadEquipmentData();
                }
                LogbookEngine.switchTab(LogbookEngine.currentTab);
            }

            console.log("Sync complete!");
            
            this.lastSyncTime = new Date().toLocaleTimeString();
            if (!silent) {
                this.showStatus("Synchronisé avec le cloud !", "success");
                this.updateModalUI();
            }
        } catch (error) {
            console.error("Synchronization failed:", error);
            if (!silent) {
                const errorDetail = error.message ? ` : ${error.message}` : '';
                this.showAlert(`La synchronisation a échoué${errorDetail}. Les données restent stockées localement.`, "error");
            }
        }
    },

    // Write-through updates to Cloud when user makes progress
    saveStatsToCloud: async function() {
        if (!this.currentUser || !this.enabled) return;
        
        try {
            const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
            const uid = this.currentUser.uid;
            
            const qcmStats = this.getLocalQcmStats();
            const qcmDocRef = doc(db, "users", uid, "stats", "qcm_stats");
            await setDoc(qcmDocRef, qcmStats);
            
            this.lastSyncTime = new Date().toLocaleTimeString();
            console.log("Incremental QCM stats synced.");
        } catch (error) {
            console.error("Incremental QCM stats sync failed:", error);
        }
    },

    saveHistoryToCloud: async function() {
        if (!this.currentUser || !this.enabled) return;
        
        try {
            const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
            const uid = this.currentUser.uid;
            
            const examHistory = this.getLocalExamHistory();
            const examDocRef = doc(db, "users", uid, "stats", "exam_history");
            await setDoc(examDocRef, examHistory);
            
            this.lastSyncTime = new Date().toLocaleTimeString();
            console.log("Incremental exam history synced.");
        } catch (error) {
            console.error("Incremental exam history sync failed:", error);
        }
    },

    savePreferencesToCloud: async function() {
        if (!this.currentUser || !this.enabled || this.syncingData) return;
        
        try {
            const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
            const uid = this.currentUser.uid;
            
            const prefs = this.getLocalPreferences();
            const prefsDocRef = doc(db, "users", uid, "preferences", "user_prefs");
            await setDoc(prefsDocRef, prefs);
            
            this.lastSyncTime = new Date().toLocaleTimeString();
            console.log("Incremental preferences synced.");
        } catch (error) {
            console.error("Incremental preferences sync failed:", error);
        }
    },

    syncLogbookData: async function(data) {
        if (!this.currentUser || !this.enabled || this.syncingData) return;
        
        try {
            const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
            const uid = this.currentUser.uid;
            
            // Save all locally present to cloud
            for (const session of data) {
                const docRef = doc(db, "users", uid, "logbook", session.id);
                await setDoc(docRef, session);
            }
            
            this.lastSyncTime = new Date().toLocaleTimeString();
            console.log("Logbook data synced incrementally.");
        } catch (error) {
            console.error("Logbook incremental sync failed:", error);
        }
    },

    deleteLogbookEntry: async function(id) {
        if (!this.currentUser || !this.enabled) return;
        
        try {
            const { doc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
            const uid = this.currentUser.uid;
            
            const docRef = doc(db, "users", uid, "logbook", id);
            await deleteDoc(docRef);
            console.log(`Logbook entry ${id} deleted from cloud.`);
        } catch (error) {
            console.error("Logbook entry delete failed:", error);
        }
    },

    syncEquipmentData: async function(data) {
        if (!this.currentUser || !this.enabled || this.syncingData) return;
        
        try {
            const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
            const uid = this.currentUser.uid;
            
            // Save all locally present to cloud
            for (const item of data) {
                const docRef = doc(db, "users", uid, "equipment", item.id);
                await setDoc(docRef, item);
            }
            
            this.lastSyncTime = new Date().toLocaleTimeString();
            console.log("Equipment data synced incrementally.");
        } catch (error) {
            console.error("Equipment incremental sync failed:", error);
        }
    },

    deleteEquipmentEntry: async function(id) {
        if (!this.currentUser || !this.enabled) return;
        
        try {
            const { doc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
            const uid = this.currentUser.uid;
            
            const docRef = doc(db, "users", uid, "equipment", id);
            await deleteDoc(docRef);
            console.log(`Equipment entry ${id} deleted from cloud.`);
        } catch (error) {
            console.error("Equipment entry delete failed:", error);
        }
    },

    syncEquipmentEntry: async function(item) {
        if (!this.currentUser || !this.enabled || this.syncingData) return;
        
        try {
            const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
            const uid = this.currentUser.uid;
            
            const docRef = doc(db, "users", uid, "equipment", item.id);
            await setDoc(docRef, item);
            
            this.lastSyncTime = new Date().toLocaleTimeString();
            console.log("Equipment entry synced successfully:", item.id);
        } catch (error) {
            console.error("Equipment entry sync failed:", error);
        }
    },

    syncLogbookEntry: async function(session) {
        if (!this.currentUser || !this.enabled || this.syncingData) return;
        
        try {
            const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
            const uid = this.currentUser.uid;
            
            const docRef = doc(db, "users", uid, "logbook", session.id);
            await setDoc(docRef, session);
            
            this.lastSyncTime = new Date().toLocaleTimeString();
            console.log("Logbook entry synced successfully:", session.id);
        } catch (error) {
            console.error("Logbook entry sync failed:", error);
        }
    },

    // Merge algorithms
    mergeQcmStats: function(local, cloud) {
        const merged = {
            totalQuestions: 0,
            totalCorrect: 0,
            themes: {},
            questions: {}
        };

        // Combine all question keys
        const allQuestions = new Set([
            ...Object.keys(local.questions || {}),
            ...Object.keys(cloud.questions || {})
        ]);

        allQuestions.forEach(qCode => {
            const lQ = (local.questions || {})[qCode] || { total: 0, correct: 0, streak: 0 };
            const cQ = (cloud.questions || {})[qCode] || { total: 0, correct: 0, streak: 0 };

            merged.questions[qCode] = {
                total: Math.max(lQ.total, cQ.total),
                correct: Math.max(lQ.correct, cQ.correct),
                streak: Math.max(lQ.streak || 0, cQ.streak || 0)
            };
        });

        // Combine themes keys
        const allThemes = new Set([
            ...Object.keys(local.themes || {}),
            ...Object.keys(cloud.themes || {})
        ]);

        allThemes.forEach(theme => {
            const lT = (local.themes || {})[theme] || { total: 0, correct: 0 };
            const cT = (cloud.themes || {})[theme] || { total: 0, correct: 0 };

            merged.themes[theme] = {
                total: Math.max(lT.total, cT.total),
                correct: Math.max(lT.correct, cT.correct)
            };
        });

        // Global metrics
        merged.totalQuestions = Math.max(local.totalQuestions || 0, cloud.totalQuestions || 0);
        merged.totalCorrect = Math.max(local.totalCorrect || 0, cloud.totalCorrect || 0);

        return merged;
    },

    mergeExamHistory: function(local, cloud) {
        const localExams = local.exams || [];
        const cloudExams = cloud.exams || [];
        
        // Use a Map keyed by exam ID or ISO string date to remove duplicates
        const examMap = new Map();
        
        localExams.forEach(exam => {
            const key = exam.id || exam.date;
            examMap.set(key, exam);
        });
        
        cloudExams.forEach(exam => {
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
            exams: mergedExams.slice(0, 10)
        };
    },

    mergePreferences: function(local, cloud) {
        if (!cloud) return local;
        if (!local) return cloud;
        
        // 1. Le Cloud est la source de vérité absolue (recharge à la connexion)
        let merged = { ...cloud };
        
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
        (cloud.savedLocations || []).forEach(loc => mergedLocsMap.set(loc.name, loc));
        (local.savedLocations || []).forEach(loc => mergedLocsMap.set(loc.name, loc));
        merged.savedLocations = Array.from(mergedLocsMap.values());
        
        return merged;
    },

    // LocalStorage Getters
    getLocalQcmStats: function() {
        try {
            const saved = localStorage.getItem('parapente_qcm_stats');
            return saved ? JSON.parse(saved) : { totalQuestions: 0, totalCorrect: 0, themes: {}, questions: {} };
        } catch(e) {
            return { totalQuestions: 0, totalCorrect: 0, themes: {}, questions: {} };
        }
    },

    getLocalExamHistory: function() {
        try {
            const saved = localStorage.getItem('parapente_exam_history');
            return saved ? JSON.parse(saved) : { exams: [] };
        } catch(e) {
            return { exams: [] };
        }
    },

    getLocalPreferences: function() {
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
            radiusLimit: 210,
            sortMode: 'CONDITIONS',
            conditionsStrategy: 'CONSECUTIVE',
            weatherModel: 'meteofrance'
        };
        let prefs = { ...defaults };
        try {
            const saved = localStorage.getItem('parapente_user_prefs');
            if (saved) {
                const parsed = JSON.parse(saved);
                prefs = { ...prefs, ...parsed };
                // Ensure arrays exist
                if (!prefs.favoriteSites) prefs.favoriteSites = [];
                if (!prefs.minimizedSites) prefs.minimizedSites = [];
                if (!prefs.savedLocations) prefs.savedLocations = [];
                if (!prefs.activeMapLayers) prefs.activeMapLayers = [...defaults.activeMapLayers];
            }
        } catch(e) {}
        
        // Always read latest pilot level from main app logic (userLevel)
        const globalLevel = localStorage.getItem('userLevel');
        if (globalLevel) {
            prefs.pilotLevel = globalLevel;
        }
        
        const themeMode = localStorage.getItem('themeMode');
        if (themeMode) {
            prefs.themeMode = themeMode;
        }

        return prefs;
    },

    // Alert UI management
    showAlert: function(message, type) {
        const alertEl = document.getElementById('auth-alert');
        if (alertEl) {
            alertEl.className = `auth-alert ${type}`;
            alertEl.textContent = message;
            alertEl.style.display = 'block';
        }
    },

    showStatus: function(message, type) {
        this.showAlert(message, type);
    },

    clearAlerts: function() {
        const alertEl = document.getElementById('auth-alert');
        if (alertEl) {
            alertEl.className = 'auth-alert';
            alertEl.style.display = 'none';
            alertEl.textContent = '';
        }
    }
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
