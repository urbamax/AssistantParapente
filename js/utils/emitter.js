/**
 * UTILS - Event emitter
 * Émetteur d'événements minimal et synchrone : un module annonce « quelque chose a changé »
 * sans savoir qui l'écoute (par exemple un service et l'écran qui l'affiche).
 *
 * Synchrone volontairement : l'ordre des mises à jour reste celui des anciens appels directs.
 * @template [T=any]
 */
export function createEmitter() {
    /** @type {Map<string, Set<(payload?: any) => void>>} */
    const handlers = new Map();

    return {
        /**
         * @param {string} event
         * @param {(payload?: any) => void} handler
         * @returns {() => void} fonction de désabonnement
         */
        on(event, handler) {
            if (!handlers.has(event)) handlers.set(event, new Set());
            handlers.get(event).add(handler);
            return () => this.off(event, handler);
        },
        /** @param {string} event @param {(payload?: any) => void} handler */
        off(event, handler) {
            handlers.get(event)?.delete(handler);
        },
        /** @param {string} event @param {any} [payload] */
        emit(event, payload) {
            // Copie : un abonné peut se désabonner pendant l'émission sans perturber les autres.
            for (const handler of [...(handlers.get(event) ?? [])]) handler(payload);
        },
        /** @param {string} [event] Un événement, ou tous si omis. */
        clear(event) {
            if (event) handlers.delete(event);
            else handlers.clear();
        },
        /** @param {string} event */
        listenerCount(event) {
            return handlers.get(event)?.size ?? 0;
        },
    };
}
