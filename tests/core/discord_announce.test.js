import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    DISCORD_ANNOUNCE_ID,
    DISCORD_ANNOUNCE_URL,
    _resetDiscordAnnounceForTesting,
    initDiscordAnnounce,
    isDiscordAnnounceDismissed,
    tryShowDiscordAnnounce,
} from '../../js/core/discord_announce.js';

const FLAG = 'ap_discord_banner_dismissed_v1';
const card = () => document.getElementById(DISCORD_ANNOUNCE_ID);

describe('Discord announcement', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        document.body.className = '';
        localStorage.clear();
        _resetDiscordAnnounceForTesting();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('shows the title, text and a "Rejoindre" link opening the invite in a new tab', () => {
        expect(tryShowDiscordAnnounce()).toBe(true);
        const el = card();
        expect(el.textContent).toContain('Assistant Parapente a son Discord');
        expect(el.textContent).toContain('Le lien reste aussi accessible en haut à droite');
        const join = el.querySelector('a.discord-announce-join');
        expect(join.textContent).toBe('Rejoindre');
        expect(join.getAttribute('href')).toBe(DISCORD_ANNOUNCE_URL);
        expect(join.target).toBe('_blank');
        expect(join.rel).toBe('noopener noreferrer');
        expect(el.querySelector('button.discord-announce-close').getAttribute('aria-label')).toBe("Fermer l'annonce");
    });

    it('closing it removes the card and records the flag so it never comes back', () => {
        tryShowDiscordAnnounce();
        card().querySelector('button.discord-announce-close').click();
        expect(card()).toBeNull();
        expect(localStorage.getItem(FLAG)).toBe('true');
        _resetDiscordAnnounceForTesting();
        expect(tryShowDiscordAnnounce()).toBe(true);
        expect(card()).toBeNull();
    });

    it('joining also removes the card and records the flag', () => {
        tryShowDiscordAnnounce();
        const join = card().querySelector('a.discord-announce-join');
        join.addEventListener('click', (e) => e.preventDefault()); // jsdom: no navigation
        join.click();
        expect(card()).toBeNull();
        expect(localStorage.getItem(FLAG)).toBe('true');
    });

    it.each([
        ['a question series or exam', () => (document.body.innerHTML = '<div id="qcm-screen" class="active"></div>')],
        ['an open dialog', () => (document.body.innerHTML = '<dialog open></dialog>')],
        ['the consent banner', () => (document.body.innerHTML = '<div class="gdpr-banner active"></div>')],
        ['the course viewer', () => document.body.classList.add('course-open')],
    ])('waits while %s is on screen', (_label, setup) => {
        setup();
        expect(tryShowDiscordAnnounce()).toBe(false);
        expect(card()).toBeNull();
    });

    it('appears once the blocking screen is gone', () => {
        vi.useFakeTimers();
        document.body.innerHTML = '<dialog open></dialog>';
        initDiscordAnnounce({ delayMs: 1000, recheckMs: 5000 });
        vi.advanceTimersByTime(1000);
        expect(card()).toBeNull();
        document.querySelector('dialog').removeAttribute('open');
        vi.advanceTimersByTime(5000);
        expect(card()).not.toBeNull();
    });

    it('still works when localStorage is blocked (shown, then closed for this session)', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('SecurityError');
        });
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('SecurityError');
        });
        vi.spyOn(console, 'error').mockImplementation(() => {});
        expect(isDiscordAnnounceDismissed()).toBe(false);
        tryShowDiscordAnnounce();
        expect(() => card().querySelector('button.discord-announce-close').click()).not.toThrow();
        expect(card()).toBeNull();
        expect(tryShowDiscordAnnounce()).toBe(true);
        expect(card()).toBeNull();
    });
});
