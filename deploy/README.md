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
