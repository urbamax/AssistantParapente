/**
 * SERVICE - IDBStorageService
 * Stockage persistant haute capacité via IndexedDB natif pour les données volumineuses
 * (traces IGC, télémétrie GPS, historique étendu des vols).
 * Fallback gracieux et transparent si IndexedDB est indisponible (ex: happy-dom / webviews privées).
 */

const DB_NAME = 'AssistantParapente_IDB';
const DB_VERSION = 1;
export const STORE_FLIGHTS = 'flights';
export const STORE_TRACES = 'traces';
export const STORE_KEYVAL = 'keyval';

export class IDBStorageService {
    constructor() {
        this._db = null;
        this._openPromise = null;
    }

    /**
     * Vérifie la disponibilité d'IndexedDB dans l'environnement d'exécution.
     * @returns {boolean}
     */
    isSupported() {
        try {
            return (
                typeof window !== 'undefined' &&
                'indexedDB' in window &&
                window.indexedDB !== null &&
                typeof window.indexedDB.open === 'function'
            );
        } catch {
            return false;
        }
    }

    /**
     * Ouvre la connexion IndexedDB (singleton Promise).
     * Crée les object stores au premier lancement via onupgradeneeded.
     * @returns {Promise<IDBDatabase|null>}
     */
    async open() {
        if (!this.isSupported()) return null;
        if (this._db) return this._db;
        if (this._openPromise) return this._openPromise;

        this._openPromise = new Promise((resolve) => {
            try {
                const request = window.indexedDB.open(DB_NAME, DB_VERSION);

                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains(STORE_FLIGHTS)) {
                        db.createObjectStore(STORE_FLIGHTS, { keyPath: 'id' });
                    }
                    if (!db.objectStoreNames.contains(STORE_TRACES)) {
                        db.createObjectStore(STORE_TRACES, { keyPath: 'id' });
                    }
                    if (!db.objectStoreNames.contains(STORE_KEYVAL)) {
                        db.createObjectStore(STORE_KEYVAL, { keyPath: 'key' });
                    }
                };

                request.onsuccess = (event) => {
                    this._db = event.target.result;
                    resolve(this._db);
                };

                request.onerror = (event) => {
                    console.warn('[IDBStorage] Échec ouverture base :', event.target?.error);
                    this._openPromise = null;
                    resolve(null);
                };

                request.onblocked = () => {
                    console.warn('[IDBStorage] Ouverture bloquée par une autre instance');
                };
            } catch (err) {
                console.warn('[IDBStorage] Exception ouverture DB :', err);
                this._openPromise = null;
                resolve(null);
            }
        });

        return this._openPromise;
    }

    // --- FLIGHTS CRUD ---

    /**
     * Récupère tous les enregistrements de vols stockés dans IndexedDB.
     * @returns {Promise<Array>}
     */
    async getAllFlights() {
        if (!this.isSupported()) return [];
        const db = await this.open();
        if (!db) return [];

        return new Promise((resolve) => {
            try {
                const tx = db.transaction(STORE_FLIGHTS, 'readonly');
                const store = tx.objectStore(STORE_FLIGHTS);
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => resolve([]);
            } catch {
                resolve([]);
            }
        });
    }

    /**
     * Récupère un vol par son identifiant unique.
     * @param {string} id
     * @returns {Promise<Object|null>}
     */
    async getFlight(id) {
        if (!this.isSupported() || !id) return null;
        const db = await this.open();
        if (!db) return null;

        return new Promise((resolve) => {
            try {
                const tx = db.transaction(STORE_FLIGHTS, 'readonly');
                const store = tx.objectStore(STORE_FLIGHTS);
                const request = store.get(id);
                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => resolve(null);
            } catch {
                resolve(null);
            }
        });
    }

    /**
     * Enregistre ou met à jour un vol.
     * @param {Object} flight
     * @returns {Promise<boolean>}
     */
    async saveFlight(flight) {
        if (!this.isSupported() || !flight || !flight.id) return false;
        const db = await this.open();
        if (!db) return false;

        return new Promise((resolve) => {
            try {
                const tx = db.transaction(STORE_FLIGHTS, 'readwrite');
                const store = tx.objectStore(STORE_FLIGHTS);
                store.put(flight);
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => resolve(false);
                tx.onabort = () => resolve(false);
            } catch {
                resolve(false);
            }
        });
    }

    /**
     * Sauvegarde un lot complet de vols dans une transaction unique optimisée.
     * @param {Array} flights
     * @returns {Promise<boolean>}
     */
    async saveFlights(flights) {
        if (!this.isSupported() || !Array.isArray(flights)) return false;
        const db = await this.open();
        if (!db) return false;

        return new Promise((resolve) => {
            try {
                const tx = db.transaction(STORE_FLIGHTS, 'readwrite');
                const store = tx.objectStore(STORE_FLIGHTS);
                flights.forEach((flight) => {
                    if (flight && flight.id) store.put(flight);
                });
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => resolve(false);
                tx.onabort = () => resolve(false);
            } catch {
                resolve(false);
            }
        });
    }

    /**
     * Supprime un vol et sa trace associée.
     * @param {string} id
     * @returns {Promise<boolean>}
     */
    async deleteFlight(id) {
        if (!this.isSupported() || !id) return false;
        const db = await this.open();
        if (!db) return false;

        return new Promise((resolve) => {
            try {
                const tx = db.transaction([STORE_FLIGHTS, STORE_TRACES], 'readwrite');
                tx.objectStore(STORE_FLIGHTS).delete(id);
                tx.objectStore(STORE_TRACES).delete(id);
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => resolve(false);
                tx.onabort = () => resolve(false);
            } catch {
                resolve(false);
            }
        });
    }

    // --- TRACES IGC ---

    /**
     * Récupère le contenu brut d'un fichier IGC par ID de vol.
     * @param {string} flightId
     * @returns {Promise<string|null>}
     */
    async getTrace(flightId) {
        if (!this.isSupported() || !flightId) return null;
        const db = await this.open();
        if (!db) return null;

        return new Promise((resolve) => {
            try {
                const tx = db.transaction(STORE_TRACES, 'readonly');
                const store = tx.objectStore(STORE_TRACES);
                const request = store.get(flightId);
                request.onsuccess = () => resolve(request.result?.rawIgc || null);
                request.onerror = () => resolve(null);
            } catch {
                resolve(null);
            }
        });
    }

    /**
     * Sauvegarde la trace IGC brute d'un vol.
     * @param {string} flightId
     * @param {string} rawIgc
     * @returns {Promise<boolean>}
     */
    async saveTrace(flightId, rawIgc) {
        if (!this.isSupported() || !flightId || !rawIgc) return false;
        const db = await this.open();
        if (!db) return false;

        return new Promise((resolve) => {
            try {
                const tx = db.transaction(STORE_TRACES, 'readwrite');
                const store = tx.objectStore(STORE_TRACES);
                store.put({ id: flightId, rawIgc, updatedAt: Date.now() });
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => resolve(false);
                tx.onabort = () => resolve(false);
            } catch {
                resolve(false);
            }
        });
    }

    /**
     * Supprime la trace IGC d'un vol.
     * @param {string} flightId
     * @returns {Promise<boolean>}
     */
    async deleteTrace(flightId) {
        if (!this.isSupported() || !flightId) return false;
        const db = await this.open();
        if (!db) return false;

        return new Promise((resolve) => {
            try {
                const tx = db.transaction(STORE_TRACES, 'readwrite');
                const store = tx.objectStore(STORE_TRACES);
                store.delete(flightId);
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => resolve(false);
                tx.onabort = () => resolve(false);
            } catch {
                resolve(false);
            }
        });
    }

    // --- MIGRATION TRANSPARENTE DEPUIS LOCALSTORAGE ---

    /**
     * Migre les vols et traces depuis LocalStorage vers IndexedDB.
     * Déporte les `rawIgc` volumineux dans le store dédié `traces`.
     * @param {Array} localStorageFlights - Liste des vols extraits de LocalStorage
     * @returns {Promise<{ migrated: number, tracesMigrated: number }>}
     */
    async migrateFromLocalStorage(localStorageFlights) {
        if (!this.isSupported() || !Array.isArray(localStorageFlights) || localStorageFlights.length === 0) {
            return { migrated: 0, tracesMigrated: 0 };
        }

        const db = await this.open();
        if (!db) return { migrated: 0, tracesMigrated: 0 };

        return new Promise((resolve) => {
            try {
                const tx = db.transaction([STORE_FLIGHTS, STORE_TRACES], 'readwrite');
                const flightsStore = tx.objectStore(STORE_FLIGHTS);
                const tracesStore = tx.objectStore(STORE_TRACES);

                let migrated = 0;
                let tracesMigrated = 0;

                for (const flight of localStorageFlights) {
                    if (!flight || !flight.id) continue;

                    // Si le vol contient une trace IGC brute, la stocker dans le store traces
                    if (flight.rawIgc && typeof flight.rawIgc === 'string') {
                        tracesStore.put({ id: flight.id, rawIgc: flight.rawIgc, updatedAt: Date.now() });
                        tracesMigrated++;
                    }

                    flightsStore.put(flight);
                    migrated++;
                }

                tx.oncomplete = () => {
                    console.log(`[IDBStorage] Migration réussie : ${migrated} vols, ${tracesMigrated} traces IGC`);
                    resolve({ migrated, tracesMigrated });
                };
                tx.onerror = (e) => {
                    console.warn('[IDBStorage] Échec migration :', e.target?.error);
                    resolve({ migrated: 0, tracesMigrated: 0 });
                };
            } catch (err) {
                console.warn('[IDBStorage] Exception migration :', err);
                resolve({ migrated: 0, tracesMigrated: 0 });
            }
        });
    }
}

export const IDBStorage = new IDBStorageService();
export default IDBStorage;
