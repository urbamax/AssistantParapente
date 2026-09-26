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
    if (!minutes || isNaN(minutes)) return '0min';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}min`;
    return `${h}h ${m.toString().padStart(2, '0')}min`;
}

// Memoized Intl formatters for performance and lower memory allocation
const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
});

const timeFormatter = new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
});

const relativeTimeFormatter = new Intl.RelativeTimeFormat('fr-FR', {
    numeric: 'auto',
});

/**
 * Format a date string into a localized short date (DD/MM/YYYY).
 * @param {string|Date} dateStr
 * @returns {string}
 */
export function formatDateOnly(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return dateFormatter.format(d);
}

/**
 * Format a date string into a localized date and time (DD/MM/YYYY à HH:MM).
 * @param {string|Date} dateStr
 * @returns {string}
 */
export function formatDateTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return `${dateFormatter.format(d)} à ${timeFormatter.format(d)}`;
}

/**
 * Format a date string into a relative time description (e.g. "à l'instant", "il y a 2 jours", "hier").
 * @param {string|Date} dateStr
 * @param {Date} [baseDate=new Date()]
 * @returns {string}
 */
export function formatRelativeTime(dateStr, baseDate = new Date()) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';

    const diffInSeconds = Math.round((d.getTime() - baseDate.getTime()) / 1000);
    const diffInMinutes = Math.round(diffInSeconds / 60);
    const diffInHours = Math.round(diffInMinutes / 60);
    const diffInDays = Math.round(diffInHours / 24);

    if (Math.abs(diffInSeconds) < 45) return "à l'instant";
    if (Math.abs(diffInMinutes) < 60) return relativeTimeFormatter.format(diffInMinutes, 'minute');
    if (Math.abs(diffInHours) < 24) return relativeTimeFormatter.format(diffInHours, 'hour');
    if (Math.abs(diffInDays) < 30) return relativeTimeFormatter.format(diffInDays, 'day');
    const diffInMonths = Math.round(diffInDays / 30);
    if (Math.abs(diffInMonths) < 12) return relativeTimeFormatter.format(diffInMonths, 'month');
    const diffInYears = Math.round(diffInDays / 365);
    return relativeTimeFormatter.format(diffInYears, 'year');
}

/**
 * Add a duration to a `datetime-local` input value (e.g. "2026-09-17T14:30")
 * and return the result in the same format, for use as a landing time computed
 * from a flight's takeoff time + duration.
 * @param {string} datetimeStr - "YYYY-MM-DDTHH:mm"
 * @param {number} minutes
 * @returns {string|null}
 */
export function addMinutesToDatetimeLocal(datetimeStr, minutes) {
    if (!datetimeStr || !minutes) return datetimeStr || null;
    const d = new Date(datetimeStr);
    if (isNaN(d.getTime())) return null;
    d.setMinutes(d.getMinutes() + minutes);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
