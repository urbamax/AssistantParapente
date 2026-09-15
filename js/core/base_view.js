/**
 * CORE - BaseView
 * Abstract class for all application views.
 * Provides standard lifecycle methods and error handling.
 */

class BaseView {
    constructor() {
        this._isMounted = false;
        this.containerId = null; // Will be set by child classes if needed
    }

    /**
     * Standard mount lifecycle hook.
     * @param {Object} params - Routing parameters
     */
    async mount(params) {
        console.log(`[BaseView] Mounting view with params:`, params);
        this._isMounted = true;
    }

    /**
     * Standard unmount lifecycle hook.
     */
    async unmount() {
        console.log(`[BaseView] Unmounting view`);
        this._isMounted = false;
        // Child classes should clean up event listeners, charts, map instances here
    }

    /**
     * Standard UI fallback for critical view errors.
     * @param {string} errorMsg - The error detail to display
     * @param {string} viewContainerId - The DOM ID of the container to hide/replace
     */
    renderErrorState(errorMsg, viewContainerId) {
        console.error(`[BaseView] Error state triggered:`, errorMsg);
        
        // Hide the main view container if provided
        if (viewContainerId) {
            const screen = document.getElementById(viewContainerId);
            if (screen) screen.style.display = 'none';
        }

        // Create or get the global error container
        let errorContainer = document.getElementById('global-view-error');
        if (!errorContainer) {
            errorContainer = document.createElement('div');
            errorContainer.id = 'global-view-error';
            errorContainer.className = 'container';
            
            // Try to append it next to the failing screen, or body fallback
            const screen = viewContainerId ? document.getElementById(viewContainerId) : null;
            if (screen && screen.parentNode) {
                screen.parentNode.appendChild(errorContainer);
            } else {
                document.body.appendChild(errorContainer);
            }
        }

        errorContainer.style.display = 'block';
        
        // Secure error message
        const safeError = (typeof Security !== 'undefined' && Security.escapeHTML) 
            ? Security.escapeHTML(errorMsg) 
            : errorMsg;

        errorContainer.innerHTML = `
            <div class="empty-state" style="margin-top: 2rem;">
                <div class="empty-icon" style="color: var(--danger-color); font-size: 3rem;">⚠️</div>
                <h3 style="margin-bottom: 1rem;">Erreur de chargement</h3>
                <p style="margin-bottom: 2rem; color: var(--text-muted);">${safeError}</p>
                <button class="btn btn-primary" onclick="window.location.reload()">Réessayer</button>
            </div>
        `;
    }
}

export default BaseView;
