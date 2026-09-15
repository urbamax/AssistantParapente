/**
 * UTILS - Date Utilities
 * Pure functions for formatting dates and durations across the application.
 */

/**
 * Format a duration in minutes into a human readable string.
 * @param {number} minutes 
 * @returns {string} (e.g. "1h 30min", "45min")
 */
export function formatDuration(minutes) {
    if (!minutes || isNaN(minutes)) return "0min";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}min`;
    return `${h}h ${m.toString().padStart(2, '0')}min`;
}

/**
 * Format a date string into a localized short date (DD/MM/YYYY).
 * @param {string|Date} dateStr 
 * @returns {string}
 */
export function formatDateOnly(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Format a date string into a localized date and time (DD/MM/YYYY à HH:MM).
 * @param {string|Date} dateStr 
 * @returns {string}
 */
export function formatDateTime(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
        ' à ' +
        d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Generate a timestamp string suitable for filenames (e.g. 2026-07-18_14-30).
 * @param {Date} date 
 * @returns {string}
 */
export function getFileTimestamp(date = new Date()) {
    const dateStr = date.toISOString().split('T')[0];
    const timeStr = date.getHours().toString().padStart(2, '0') + '-' + date.getMinutes().toString().padStart(2, '0');
    return `${dateStr}_${timeStr}`;
}
