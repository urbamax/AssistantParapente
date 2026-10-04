import { describe, it, expect, vi } from 'vitest';
import { FirebaseAuthEngine } from '../../js/services/firebase_service.js';

// Safari affichait des erreurs « access control checks » quand il coupait lui-même, au rechargement,
// les connexions Firestore encore ouvertes : l'app les ferme avant que la page parte.
describe('Firestore connections are closed when the page goes away', () => {
    const pageHide = (persisted) => {
        const event = new Event('pagehide');
        Object.defineProperty(event, 'persisted', { value: persisted });
        window.dispatchEvent(event);
    };

    it('closes them on reload or close', () => {
        const db = {};
        const terminate = vi.fn(() => Promise.resolve());
        FirebaseAuthEngine._closeFirestoreOnPageHide(db, terminate);
        pageHide(false);
        expect(terminate).toHaveBeenCalledWith(db);
    });

    it('keeps them when the page is only kept for the back button', () => {
        const terminate = vi.fn(() => Promise.resolve());
        FirebaseAuthEngine._closeFirestoreOnPageHide({}, terminate);
        pageHide(true);
        expect(terminate).not.toHaveBeenCalled();
    });

    it('a failed close does not raise an error', async () => {
        const terminate = vi.fn(() => Promise.reject(new Error('already closed')));
        FirebaseAuthEngine._closeFirestoreOnPageHide({}, terminate);
        expect(() => pageHide(false)).not.toThrow();
        await Promise.resolve();
    });
});
