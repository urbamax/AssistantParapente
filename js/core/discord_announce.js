/**
 * CORE - Discord announcement (spec 054)
 * Small card telling pilots the community Discord server is open. Shown once per device: joining
 * or closing it records a flag in localStorage. It never opens over something the pilot is doing
 * (question series or exam, flight form, open dialog, consent banner, course viewer), and
 * css/components.css hides it again if one of those opens while it is on screen.
 */
import { t } from '../utils/i18n.js';
import StorageService from '../services/storage.js';
import { isUserBusy } from './app_update.js';

export const DISCORD_ANNOUNCE_URL = 'https://discord.gg/z6vc8ARNk';
export const DISCORD_ANNOUNCE_ID = 'discord-announce';

const FIRST_SHOW_DELAY_MS = 4000;
const BUSY_RECHECK_MS = 10 * 1000;

let pendingTimer = null;
let dismissedThisSession = false;

/** True once the pilot joined or closed the announcement on this device. */
export function isDiscordAnnounceDismissed() {
    if (dismissedThisSession) return true;
    return StorageService.get(StorageService.KEYS.DISCORD_ANNOUNCE_DISMISSED) === true;
}

function markDismissed() {
    dismissedThisSession = true;
    StorageService.set(StorageService.KEYS.DISCORD_ANNOUNCE_DISMISSED, true);
}

/** True while something else holds the pilot's attention: the card waits. */
export function isAnnounceBlocked(doc = document) {
    if (isUserBusy()) return true;
    if (doc.body?.classList.contains('course-open')) return true;
    if (doc.querySelector('dialog[open], .gdpr-banner.active, #app-update-banner')) return true;
    return typeof navigator !== 'undefined' && navigator.onLine === false;
}

function stopWaiting() {
    if (pendingTimer) clearInterval(pendingTimer);
    pendingTimer = null;
}

/** Removes the card and records that it must not come back. */
export function dismissDiscordAnnounce(doc = document) {
    stopWaiting();
    markDismissed();
    doc.getElementById(DISCORD_ANNOUNCE_ID)?.remove();
}

function buildCard(doc) {
    const card = doc.createElement('aside');
    card.id = DISCORD_ANNOUNCE_ID;
    card.className = 'discord-announce';
    card.setAttribute('aria-labelledby', 'discord-announce-title');

    const icon = doc.createElement('i');
    icon.className = 'ri-discord-fill discord-announce-icon';
    icon.setAttribute('aria-hidden', 'true');

    const body = doc.createElement('div');
    body.className = 'discord-announce-body';

    const title = doc.createElement('p');
    title.id = 'discord-announce-title';
    title.className = 'discord-announce-title';
    title.textContent = t('discordAnnounce.title');

    const text = doc.createElement('p');
    text.className = 'discord-announce-text';
    text.textContent = t('discordAnnounce.text');

    const join = doc.createElement('a');
    join.className = 'discord-announce-join';
    join.href = DISCORD_ANNOUNCE_URL;
    join.target = '_blank';
    join.rel = 'noopener noreferrer';
    join.textContent = t('discordAnnounce.join');
    // The link opens on its own; removing the card right away is safe since the click has started.
    join.addEventListener('click', () => dismissDiscordAnnounce(doc));

    body.append(title, text, join);

    const close = doc.createElement('button');
    close.type = 'button';
    close.className = 'discord-announce-close';
    close.setAttribute('aria-label', t('discordAnnounce.close'));
    close.title = t('discordAnnounce.close');
    const closeIcon = doc.createElement('i');
    closeIcon.className = 'ri-close-line';
    closeIcon.setAttribute('aria-hidden', 'true');
    close.appendChild(closeIcon);
    close.addEventListener('click', () => dismissDiscordAnnounce(doc));

    card.append(icon, body, close);
    return card;
}

/**
 * Shows the card now if nothing blocks it.
 * @returns {boolean} true when the card is (already) on screen or no longer needed
 */
export function tryShowDiscordAnnounce(doc = document) {
    if (isDiscordAnnounceDismissed() || doc.getElementById(DISCORD_ANNOUNCE_ID)) {
        stopWaiting();
        return true;
    }
    if (!doc.body || isAnnounceBlocked(doc)) return false;
    stopWaiting();
    doc.body.appendChild(buildCard(doc));
    return true;
}

/** Shows the card a few seconds after boot, or as soon as the pilot is free. */
export function initDiscordAnnounce({ delayMs = FIRST_SHOW_DELAY_MS, recheckMs = BUSY_RECHECK_MS } = {}) {
    if (typeof document === 'undefined' || isDiscordAnnounceDismissed()) return;
    setTimeout(() => {
        if (tryShowDiscordAnnounce()) return;
        pendingTimer = setInterval(() => tryShowDiscordAnnounce(), recheckMs);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && pendingTimer) tryShowDiscordAnnounce();
        });
    }, delayMs);
}

/** Resets the module state (tests). */
export function _resetDiscordAnnounceForTesting() {
    stopWaiting();
    dismissedThisSession = false;
}
