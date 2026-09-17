/**
 * StorageService
 * Service dédié à la persistance locale (LocalStorage).
 * Centralise et sécurise les accès aux données utilisateur locales pour toute l'application.
 */

const StorageService = {
    /**
     * Dictionnaire des clés officielles utilisées dans l'application.
     * DOCUMENTATION : Ces clés NE DOIVENT JAMAIS être modifiées pour préserver
     * les données existantes des utilisateurs et la synchronisation Firebase.
     */
    KEYS: {
        STATE: 'parapente_state',
        USER_LEVEL: 'userLevel',
        THEME_MODE: 'themeMode',
        USER_PREFS: 'parapente_user_prefs',
        LOGBOOK_DATA: 'tp_logbook_data',
        EQUIPMENT_DATA: 'tp_equipment_data',
        QCM_STATS: 'parapente_qcm_stats',
        EXAM_HISTORY: 'parapente_exam_history',
        PENDING_QUIZ: 'pending_quiz',
    },

    /**
     * Récupère une valeur depuis le LocalStorage en gérant automatiquement le JSON.
     * @param {string} key - La clé de stockage.
     * @param {*} defaultValue - Valeur par défaut si la clé n'existe pas ou en cas d'erreur.
     * @returns {*} - L'objet parsé ou la chaîne brute.
     */
    get: function (key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);

            // Si la clé n'existe pas, on retourne la valeur par défaut
            if (item === null) return defaultValue;

            try {
                // Tente de parser en JSON (valable pour les objets, tableaux, booléens, etc.)
                return JSON.parse(item);
            } catch (parseError) {
                // Si le parse échoue, c'est qu'il s'agit d'une chaîne brute (ex: 'dark', 'ALL', 'BI')
                // On la retourne donc telle quelle pour respecter l'ancien format.
                return item;
            }
        } catch (error) {
            console.error(`[StorageService] Erreur critique lors de la lecture de la clé "${key}":`, error);
            return defaultValue;
        }
    },

    /**
     * Sauvegarde une valeur dans le LocalStorage de façon sécurisée.
     * @param {string} key - La clé de stockage.
     * @param {*} value - La valeur à sauvegarder (objet, tableau, chaîne, etc.).
     * @returns {boolean} - true si l'écriture a réussi, false sinon.
     */
    set: function (key, value) {
        try {
            // Pour ne pas corrompre les données existantes lues en chaîne brute (ex: themeMode),
            // on ne stringify que ce qui n'est pas déjà une chaîne de caractères.
            const valueToStore = typeof value === 'string' ? value : JSON.stringify(value);

            localStorage.setItem(key, valueToStore);
            return true;
        } catch (error) {
            console.error(`[StorageService] Erreur lors de l'écriture de la clé "${key}":`, error);

            // Gestion d'erreur spécifique si le cache du navigateur est plein
            if (error.name === 'QuotaExceededError') {
                console.warn("[StorageService] Le quota de stockage local est dépassé ! L'enregistrement a échoué.");
            }
            return false;
        }
    },

    /**
     * Supprime une clé spécifique du LocalStorage.
     * @param {string} key - La clé à supprimer.
     * @returns {boolean} - true si la suppression a réussi, false sinon.
     */
    remove: function (key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error(`[StorageService] Erreur lors de la suppression de la clé "${key}":`, error);
            return false;
        }
    },

    /**
     * Vide intégralement le LocalStorage.
     * @returns {boolean} - true en cas de succès, false sinon.
     */
    clear: function () {
        try {
            localStorage.clear();
            return true;
        } catch (error) {
            console.error('[StorageService] Erreur lors du nettoyage total du LocalStorage:', error);
            return false;
        }
    },
};

// Exposition du service sur l'objet global (window) pour une utilisation partout dans l'application Vanilla JS
if (typeof window !== 'undefined') {
    window.StorageService = StorageService;
}

export default StorageService;
