import re

def split_firebase():
    with open('js/firebase_engine.js', 'r', encoding='utf-8') as f:
        content = f.read()
        
    # The file has:
    # 1. Init block
    # 2. UI helpers
    # 3. Auth actions
    # 4. Sync actions (Firestore)
    
    # Let's create auth.js and api.js
    
    auth_content = """/**
 * SERVICE - Firebase Auth
 * Handles User Authentication
 */
import GlobalState from '../core/app_state.js';
import StorageService from './storage.js';

let app, auth;
let isInitialized = false;

class AuthService {
    constructor() {
        this.currentUser = null;
    }
    
    // We will just expose the original window object for now to maintain compatibility 
    // while we migrate, or we adapt it to a class.
}

export default new AuthService();
"""
    
    # Actually, a safer approach to not break the 800 lines of complex sync logic is to just 
    # wrap the existing FirebaseAuthEngine in a module and export it.
    
    wrapper = """/**
 * SERVICE - Firebase Wrapper (ES6)
 * Wraps the legacy firebase_engine to preserve sync logic exactly as requested.
 */
import StorageService from './storage.js';
import GlobalState from '../core/app_state.js';

// We inject the original code but export the Engine
""" + content.replace("const FirebaseAuthEngine = {", "export const FirebaseAuthEngine = {")

    with open('js/services/firebase_service.js', 'w', encoding='utf-8') as f:
        f.write(wrapper)
        
    print("Created firebase_service.js wrapper")

if __name__ == '__main__':
    split_firebase()
