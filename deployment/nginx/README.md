# Nginx (production)

`my-people.conf` is a reference copy of the live My People site on the DigitalOcean server (`/etc/nginx/sites-available/default`). The server file is the source of truth; this copy exists so changes can be reviewed and the setup rebuilt. The same server also hosts IBC Facts in its own site file, which is not ours to change.

## What it does

- Serves `178.128.126.35.nip.io` (and the bare IP, as the default server) over HTTPS with the Certbot certificate, and redirects HTTP to HTTPS.
- Proxies everything to the Express API on `127.0.0.1:3001`, which also serves the PWA. Uploads up to 12 MB.
- Sends `X-Forwarded-For $remote_addr`, overwriting whatever the client sent, so the API's sign-in limits count the real client address. This changed on 24 October 2026 from `$proxy_add_x_forwarded_for`, which let clients choose their own address; the server keeps the old file as `default.bak-20261024T170517Z` in `sites-available`.

## Changing it

1. Edit the file on the server and run `sudo nginx -t`. Reload only if the test passes: `sudo systemctl reload nginx`.
2. Check the site still answers: `https://178.128.126.35.nip.io/api/health`.
3. Update `my-people.conf` here with the new server file and its sha256.

When FastAPI is deployed, `/v1/` gets its own `location` block proxying to uvicorn, and uvicorn must run with `--proxy-headers --forwarded-allow-ips=127.0.0.1` (see `services/api/README.md`).
