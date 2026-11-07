/**
 * Global error banner: shows an uncaught error or an unhandled promise rejection on the page,
 * but only to the roles that may see technical errors (beta, owner: see js/services/access_service.js).
 * Everyone else gets nothing on screen; the error still goes to the console.
 * Classic script loaded in <head> of index.html (spec 036: no inline script), so it cannot import
 * AccessService: it reads the roles that service keeps in localStorage ('parapente_access').
 */
function canSeeErrors() {
    try {
        const saved = JSON.parse(localStorage.getItem('parapente_access') || 'null');
        return Boolean(
            saved && Array.isArray(saved.roles) && (saved.roles.includes('beta') || saved.roles.includes('owner')),
        );
    } catch {
        return false;
    }
}
window.addEventListener('error', function (e) {
    if (
        e &&
        typeof e.message === 'string' &&
        e.message.indexOf('Importing binding name') !== -1 &&
        typeof sessionStorage !== 'undefined' &&
        sessionStorage.getItem('ap_stale_module_reloaded') !== '1'
    ) {
        sessionStorage.setItem('ap_stale_module_reloaded', '1');
        Promise.all([
            fetch('./js/utils/text_utils.js', { cache: 'reload' }).catch(function () {}),
            fetch('./js/services/quiz_service.js', { cache: 'reload' }).catch(function () {}),
            fetch('./js/views/quiz.js', { cache: 'reload' }).catch(function () {}),
            fetch('./js/views/quiz_stats.js', { cache: 'reload' }).catch(function () {}),
            typeof caches !== 'undefined'
                ? caches.keys().then(function (keys) {
                      return Promise.all(
                          keys.map(function (k) {
                              return k.indexOf('parapente-app-') === 0 ? caches.delete(k) : null;
                          }),
                      );
                  })
                : Promise.resolve(),
        ]).finally(function () {
            window.location.reload();
        });
        return;
    }
    if (!canSeeErrors()) return;
    const errDiv = document.createElement('div');
    errDiv.style.cssText =
        'position:fixed;top:10px;left:10px;z-index:99999;background:red;color:white;padding:10px;white-space:pre-wrap;font-family:monospace;';
    errDiv.textContent =
        'GLOBAL ERROR: ' +
        e.message +
        '\n' +
        e.filename +
        ':' +
        e.lineno +
        ':' +
        e.colno +
        '\n' +
        (e.error ? e.error.stack : '');
    (document.body || document.documentElement).appendChild(errDiv);
});
window.addEventListener('unhandledrejection', function (e) {
    if (!canSeeErrors()) return;
    const errDiv = document.createElement('div');
    errDiv.style.cssText =
        'position:fixed;top:10px;left:10px;z-index:99999;background:red;color:white;padding:10px;white-space:pre-wrap;font-family:monospace;';
    errDiv.textContent = 'UNHANDLED REJECTION: ' + (e.reason ? e.reason.stack || e.reason : 'Unknown reason');
    (document.body || document.documentElement).appendChild(errDiv);
});
