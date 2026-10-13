/**
 * Applies the saved theme before the first paint, to avoid a dark background flash while the
 * application's module scripts (loaded at the end of the body) boot up.
 * Classic, blocking script loaded first in <head> of index.html (spec 036: no inline script).
 */
(function () {
    try {
        const saved = localStorage.getItem('themeMode') || 'auto';
        let effective = saved;
        if (effective === 'auto') {
            effective =
                window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        if (effective === 'light') {
            document.documentElement.classList.add('light-mode');
            document.documentElement.style.colorScheme = 'light';
        } else {
            document.documentElement.classList.add('dark-theme');
            document.documentElement.style.colorScheme = 'dark';
        }
    } catch {
        // localStorage unavailable (private mode): keep the default theme
    }
})();
