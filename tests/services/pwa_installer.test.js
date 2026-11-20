import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    isStandalone,
    isIos,
    canPromptInstall,
    canInstall,
    setDeferredPrompt,
    getDeferredPrompt,
    updateInstallUI,
    openInstallModal,
    closeInstallModal,
    promptInstall,
    initPwaInstaller,
    resetPwaInstallerForTests,
} from '../../js/services/pwa_installer.js';

describe('PwaInstaller Service (spec 051)', () => {
    beforeEach(() => {
        resetPwaInstallerForTests();
        document.body.innerHTML = `
            <button id="pwa-install-btn" style="display: none;"></button>
            <span id="footer-pwa-install-separator" style="display: none;">•</span>
            <a id="footer-pwa-install-link" style="display: none;">Installer</a>
            <dialog id="pwa-install-modal" style="display: none;">
                <div id="pwa-install-ios-instructions" style="display: none;"></div>
                <div id="pwa-install-generic-instructions" style="display: none;"></div>
            </dialog>
        `;
    });

    describe('isStandalone', () => {
        it('returns false when running in standard browser tab', () => {
            const fakeWin = {
                matchMedia: vi.fn().mockReturnValue({ matches: false }),
                navigator: { standalone: false },
                document: { referrer: '' },
            };
            expect(isStandalone(fakeWin)).toBe(false);
        });

        it('returns true when display-mode: standalone matches', () => {
            const fakeWin = {
                matchMedia: vi.fn().mockReturnValue({ matches: true }),
                navigator: { standalone: false },
                document: { referrer: '' },
            };
            expect(isStandalone(fakeWin)).toBe(true);
        });

        it('returns true on iOS Safari when navigator.standalone is true', () => {
            const fakeWin = {
                matchMedia: vi.fn().mockReturnValue({ matches: false }),
                navigator: { standalone: true },
                document: { referrer: '' },
            };
            expect(isStandalone(fakeWin)).toBe(true);
        });

        it('returns true when referrer is android-app:// (TWA)', () => {
            const fakeWin = {
                matchMedia: vi.fn().mockReturnValue({ matches: false }),
                navigator: {},
                document: { referrer: 'android-app://fr.assistantparapente' },
            };
            expect(isStandalone(fakeWin)).toBe(true);
        });
    });

    describe('isIos', () => {
        it('detects iPhone User-Agent', () => {
            const fakeWin = {
                navigator: {
                    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
                    platform: 'iPhone',
                    maxTouchPoints: 5,
                },
            };
            expect(isIos(fakeWin)).toBe(true);
        });

        it('detects iPadOS with MacIntel and multi-touch', () => {
            const fakeWin = {
                navigator: {
                    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
                    platform: 'MacIntel',
                    maxTouchPoints: 5,
                },
            };
            expect(isIos(fakeWin)).toBe(true);
        });

        it('returns false for macOS desktop without touch', () => {
            const fakeWin = {
                navigator: {
                    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    platform: 'MacIntel',
                    maxTouchPoints: 0,
                },
            };
            expect(isIos(fakeWin)).toBe(false);
        });

        it('returns false for Android mobile', () => {
            const fakeWin = {
                navigator: {
                    userAgent:
                        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
                    platform: 'Linux armv8l',
                    maxTouchPoints: 5,
                },
            };
            expect(isIos(fakeWin)).toBe(false);
        });
    });

    describe('canInstall and canPromptInstall', () => {
        it('canPromptInstall returns true only when deferredPrompt is set', () => {
            expect(canPromptInstall()).toBe(false);
            setDeferredPrompt({ prompt: vi.fn() });
            expect(canPromptInstall()).toBe(true);
        });

        it('canInstall returns false if app is already standalone', () => {
            const fakeWin = {
                matchMedia: vi.fn().mockReturnValue({ matches: true }),
                navigator: { standalone: true },
            };
            setDeferredPrompt({ prompt: vi.fn() });
            expect(canInstall(fakeWin)).toBe(false);
        });

        it('canInstall returns true when deferredPrompt exists on non-standalone', () => {
            const fakeWin = {
                matchMedia: vi.fn().mockReturnValue({ matches: false }),
                navigator: { userAgent: 'Chrome', platform: 'Win32', maxTouchPoints: 0 },
            };
            setDeferredPrompt({ prompt: vi.fn() });
            expect(canInstall(fakeWin)).toBe(true);
        });

        it('canInstall returns true on iOS even without deferredPrompt', () => {
            const fakeWin = {
                matchMedia: vi.fn().mockReturnValue({ matches: false }),
                navigator: {
                    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
                    platform: 'iPhone',
                    maxTouchPoints: 5,
                },
            };
            expect(canInstall(fakeWin)).toBe(true);
        });
    });

    describe('updateInstallUI', () => {
        it('shows buttons and separator when install is available', () => {
            setDeferredPrompt({ prompt: vi.fn() });
            updateInstallUI(document);

            const btn = document.getElementById('pwa-install-btn');
            const link = document.getElementById('footer-pwa-install-link');
            const sep = document.getElementById('footer-pwa-install-separator');

            expect(btn?.style.display).toBe('inline-flex');
            expect(btn?.classList.contains('highlight')).toBe(true);
            expect(link?.style.display).toBe('inline');
            expect(sep?.style.display).toBe('inline');
        });

        it('hides buttons when standalone', () => {
            // Mock window.matchMedia
            const origMatchMedia = window.matchMedia;
            window.matchMedia = vi.fn().mockReturnValue({ matches: true });

            updateInstallUI(document);

            const btn = document.getElementById('pwa-install-btn');
            const link = document.getElementById('footer-pwa-install-link');
            const sep = document.getElementById('footer-pwa-install-separator');

            expect(btn?.style.display).toBe('none');
            expect(link?.style.display).toBe('none');
            expect(sep?.style.display).toBe('none');

            window.matchMedia = origMatchMedia;
        });
    });

    describe('promptInstall', () => {
        it('triggers native prompt when deferredPrompt is available', async () => {
            const fakePrompt = {
                prompt: vi.fn().mockResolvedValue(undefined),
                userChoice: Promise.resolve({ outcome: 'accepted' }),
            };
            setDeferredPrompt(fakePrompt);

            const result = await promptInstall();
            expect(fakePrompt.prompt).toHaveBeenCalled();
            expect(result.success).toBe(true);
            expect(result.outcome).toBe('accepted');
            expect(result.platform).toBe('native');
            expect(getDeferredPrompt()).toBeNull();
        });

        it('handles dismissed choice from user', async () => {
            const fakePrompt = {
                prompt: vi.fn().mockResolvedValue(undefined),
                userChoice: Promise.resolve({ outcome: 'dismissed' }),
            };
            setDeferredPrompt(fakePrompt);

            const result = await promptInstall();
            expect(result.success).toBe(false);
            expect(result.outcome).toBe('dismissed');
            expect(result.platform).toBe('native');
        });

        it('opens modal with instructions when no prompt is available', async () => {
            const result = await promptInstall();
            expect(result.success).toBe(true);
            expect(result.outcome).toBe('instructions');

            const modal = document.getElementById('pwa-install-modal');
            expect(modal?.classList.contains('active')).toBe(true);
        });
    });

    describe('openInstallModal & closeInstallModal', () => {
        it('opens and closes dialog cleanly', () => {
            const modal = document.getElementById('pwa-install-modal');
            openInstallModal(document);
            expect(modal?.style.display).toBe('flex');
            expect(modal?.classList.contains('active')).toBe(true);

            closeInstallModal(document);
            expect(modal?.classList.contains('active')).toBe(false);
        });
    });

    describe('initPwaInstaller', () => {
        it('attaches event listeners to window and updates UI', () => {
            const fakeWin = {
                addEventListener: vi.fn(),
                matchMedia: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn() }),
                document: document,
            };

            initPwaInstaller(fakeWin);
            expect(fakeWin.addEventListener).toHaveBeenCalledWith('beforeinstallprompt', expect.any(Function));
            expect(fakeWin.addEventListener).toHaveBeenCalledWith('appinstalled', expect.any(Function));
        });
    });
});
