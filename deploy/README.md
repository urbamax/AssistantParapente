# Deployment notes (self-hosted)

The site is served as static files by an nginx container (`assistant-parapente`) on a Raspberry Pi.
`nginx/assistant-parapente.conf` is the reference configuration of that container. It is blocked from the
web by the configuration itself (`/deploy` returns 404).

`courses/` (FFVL and author documents) is **not** in this repository; it is copied to the server separately.

## Apply a new nginx configuration

On the server, from the site folder (the file is bind-mounted into the container):

1. Test the new file without touching production (the container is created, checks the syntax, and is removed):
   `docker run --rm -v "$PWD/deploy/nginx/assistant-parapente.conf:/etc/nginx/conf.d/default.conf:ro" nginx nginx -t`
2. Back up the current file, then replace it:
   `cp ~/assistant-parapente-nginx.conf ~/assistant-parapente-nginx.conf.bak && cp deploy/nginx/assistant-parapente.conf ~/assistant-parapente-nginx.conf`
3. Reload only this container's nginx (no downtime):
   `docker exec assistant-parapente nginx -t && docker exec assistant-parapente nginx -s reload`
4. Roll back if needed: `cp ~/assistant-parapente-nginx.conf.bak ~/assistant-parapente-nginx.conf` then reload as above.

## Move to assistantparapente.fr (2026-11)

The app moves from `https://assistantparapente.noisecontrol.live` to `https://assistantparapente.fr`. Both
hostnames reach the same container through the Cloudflare tunnel; the app itself tells them apart
(`js/core/domain_migration.js`): the old address packs the device's local data into the URL fragment and
replaces the page with the new domain, which restores it once. Order matters:

1. Serve `assistantparapente.fr` from the same container and check it loads over HTTPS.
2. Add `assistantparapente.fr` to the Firebase Authentication authorized domains.
3. Only then `git pull` the version that redirects: from that moment the old address sends everyone away.

Keep the old hostname in the tunnel for months: people who have not opened the app since still need it to
carry their data. `?rester` keeps the old address open (to export a backup file by hand). Do not let the
old hostname redirect at the HTTP level (Cloudflare redirect rule, nginx `return 301`): the data would stay
behind, since only the app can read it.
