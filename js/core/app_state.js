/**
 * CORE - App State Manager
 * Centralizes the application state and provides reactivity (listeners)
 */

import StorageService from '../services/storage.js';

class AppState {
    constructor() {
        this.state = {
            level: 'ALL',        // BI, BP, BPC, ALL
            mode: 'MENU',
            themeMode: 'auto',
            currentCourseId: null,
            lastMode: 'MENU',
            isOnline: navigator.onLine,
            userPreferences: {}
        };
        this.listeners = new Map();
    }

    init() {
        // Load saved theme
        const savedTheme = StorageService.get(StorageService.KEYS.THEME_MODE);
        if (savedTheme) {
            this.set('themeMode', savedTheme);
        }

        // Listen for system theme changes and update if mode is 'auto'
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            if (this.state.themeMode === 'auto') {
                this.notify('themeMode', 'auto');
            }
        });

        // Load saved level
        const savedLevel = StorageService.get(StorageService.KEYS.USER_LEVEL);
        if (savedLevel) {
            this.set('level', savedLevel);
        }

        // Network status
        window.addEventListener('online', () => this.set('isOnline', true));
        window.addEventListener('offline', () => this.set('isOnline', false));
    }

    get(key) {
        return this.state[key];
    }

    set(key, value) {
        if (this.state[key] !== value) {
            this.state[key] = value;
            if (key === 'level') {
                StorageService.set(StorageService.KEYS.USER_LEVEL, value);
            } else if (key === 'themeMode') {
                StorageService.set(StorageService.KEYS.THEME_MODE, value);
            }
            this.notify(key, value);
        }
    }

    subscribe(key, callback) {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, new Set());
        }
        this.listeners.get(key).add(callback);
        
        // Immediate call with current value
        callback(this.state[key]);
        
        return () => this.unsubscribe(key, callback);
    }

    unsubscribe(key, callback) {
        if (this.listeners.has(key)) {
            this.listeners.get(key).delete(callback);
        }
    }

    notify(key, value) {
        if (this.listeners.has(key)) {
            this.listeners.get(key).forEach(cb => cb(value));
        }
    }
}

const GlobalState = new AppState();
export default GlobalState;
