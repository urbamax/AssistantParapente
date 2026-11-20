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
function tryRecoverStaleModule(msg) {
    const isStaleBindingError =
        msg.indexOf('Importing binding name') !== -1 ||
        msg.indexOf('does not provide an export named') !== -1 ||
        msg.indexOf('import not found') !== -1;
    if (!isStaleBindingError) return false;
    let alreadyReloaded;
    try {
        alreadyReloaded =
            typeof sessionStorage !== 'undefined' && sessionStorage.getItem('ap_stale_module_reloaded') === '1';
    } catch {
        alreadyReloaded = true;
    }
    if (alreadyReloaded) return false;
    try {
        sessionStorage.setItem('ap_stale_module_reloaded', '1');
    } catch {
        // ignore
    }
    const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
    const clearCaches =
        typeof caches !== 'undefined' && isOnline
            ? caches.keys().then(function (keys) {
                  return Promise.all(
                      keys.map(function (k) {
                          return k.indexOf('parapente-app-') === 0 ? caches.delete(k) : null;
                      }),
                  );
              })
            : Promise.resolve();
    clearCaches
        .catch(function () {})
        .finally(function () {
            window.location.reload();
        });
    return true;
}
window.addEventListener('error', function (e) {
    const msg = e && typeof e.message === 'string' ? e.message : '';
    if (tryRecoverStaleModule(msg)) return;
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
    const reasonText = e && e.reason ? String(e.reason.message || e.reason.stack || e.reason) : '';
    if (tryRecoverStaleModule(reasonText)) return;
    if (!canSeeErrors()) return;
    const errDiv = document.createElement('div');
    errDiv.style.cssText =
        'position:fixed;top:10px;left:10px;z-index:99999;background:red;color:white;padding:10px;white-space:pre-wrap;font-family:monospace;';
    errDiv.textContent = 'UNHANDLED REJECTION: ' + (e.reason ? e.reason.stack || e.reason : 'Unknown reason');
    (document.body || document.documentElement).appendChild(errDiv);
});
