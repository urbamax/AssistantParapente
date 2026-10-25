/**
 * Global error banner: shows an uncaught error or an unhandled promise rejection on the page.
 * Classic script loaded in <head> of index.html (spec 036: no inline script).
 */
window.addEventListener('error', function (e) {
    // Les erreurs de scripts d'une autre origine (extension du navigateur, script Google chargé par
    // le SDK Firebase sans attribut crossorigin) sont expurgées par le navigateur : message
    // « Script error. », pas de fichier ni de ligne. Aucune information exploitable et aucun
    // moyen d'agir dessus : on les trace dans la console sans afficher le bandeau.
    if (!e.filename && !e.lineno && !e.colno && !e.error) {
        console.warn('Erreur de script d’une autre origine ignorée :', e.message);
        return;
    }
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
    const errDiv = document.createElement('div');
    errDiv.style.cssText =
        'position:fixed;top:10px;left:10px;z-index:99999;background:red;color:white;padding:10px;white-space:pre-wrap;font-family:monospace;';
    errDiv.textContent = 'UNHANDLED REJECTION: ' + (e.reason ? e.reason.stack || e.reason : 'Unknown reason');
    (document.body || document.documentElement).appendChild(errDiv);
});
