# Nginx (Production Reverse-Proxy Configuration)

`my-people.conf` is a reference copy of the current live My People site on the DigitalOcean production server (`/etc/nginx/sites-available/default`). The server file is the source of truth; this copy exists so changes can be reviewed and the setup rebuilt. The same server also hosts IBC Facts in its own site file, which is not ours to change.

The other site files are copied the same way: `mypeople-mobile.conf` (the member and staff apps at `app.tmk.lk` and `staff.tmk.lk`, with their old nip.io names kept for `/v1` and redirects), `mypeople-admin.conf` (the dashboard at `admin.tmk.lk`) and `mypeople-www.conf` (the member PWA at `www.tmk.lk`). Staging has its own files in `deployment/staging/`.

---

## 1. Strangler Route Ownership (`/v1/` beside `/api/`)

During the Phase 1 strangler migration, both backends run simultaneously:

| Route Prefix | Backend Service | Upstream / Port | Function | Max Body Size |
|---|---|---|---|---|
| `/v1/health` | FastAPI | `127.0.0.1:8000` | Fast health & readiness probe (2s/3s timeout) | 2 MB |
| `/v1/identity/me/documents/{kind}` (uploads) | FastAPI | `127.0.0.1:8000` | Encrypted document upload, including selfie kind | 15 MB proxy ceiling |
| `/v1/content/albums/{id}/photos` | FastAPI | `127.0.0.1:8000` | Album photo upload | 15 MB proxy ceiling |
| `/v1/` | FastAPI | `127.0.0.1:8000` | Strangler API (Auth, Household, Verification, etc.) | 2 MB |
| `/api/` | Express | `127.0.0.1:3001` | Legacy Express API endpoints | 12 MB |
| `/` | Express | `127.0.0.1:3001` | Member PWA & static assets | 12 MB |
| `/evidence/` | **Blocked** | None | Private identity storage. Direct web access denied (403). | N/A |
| `/private/` | **Blocked** | None | Private files never served directly. | N/A |

---

## 2. Trusted Proxy Headers & Security Controls

- **Overwriting Client Forwarding Headers:**
  ```nginx
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $remote_addr;
  proxy_set_header X-Forwarded-Proto $scheme;
  ```
  `X-Forwarded-For` is unconditionally set to `$remote_addr`. Clients cannot spoof their source IP to bypass lockout counters, sign-in rate limits, or audit log records.
- **Uvicorn Configuration:**
  FastAPI must be launched with:
  ```bash
  uvicorn app.main:create_app --factory --proxy-headers --forwarded-allow-ips=127.0.0.1 --host 127.0.0.1 --port 8000
  ```
- **Evidence Storage Isolation:**
  Static location `/evidence/` returns `403 Forbidden`. Evidence images (NIC photos, passports, selfie biometrics) are stored under encrypted directory mode 700 and streamed exclusively via authorized `/v1/identity/evidence/...` endpoints after verifying the requesting staff member's active assignment and tier.

---

## 3. Activation & Staging Verification

1. Install the snippet onto the host:
   ```bash
   sudo cp deployment/nginx/fastapi-v1-snippet.conf.example /etc/nginx/snippets/mypeople-fastapi-v1.conf
   ```
2. Include the snippet in `/etc/nginx/sites-available/default` within the SSL server block:
   ```nginx
   include /etc/nginx/snippets/mypeople-fastapi-v1.conf;
   ```
3. Test Nginx syntax:
   ```bash
   sudo nginx -t
   ```
4. Reload Nginx without dropping active connections:
   ```bash
   sudo systemctl reload nginx
   ```
5. Run smoke checks:
   ```bash
   curl -fsS https://178.128.126.35.nip.io/api/health
   curl -fsS https://178.128.126.35.nip.io/v1/health
   curl -sS -o /dev/null -w '%{http_code}\n' https://178.128.126.35.nip.io/evidence/test.jpg # Must return 403
   ```

---

## 4. Instant Rollback Procedure

If any issue occurs with `/v1/` routes during staging or the pilot:

1. Comment out the snippet line in `/etc/nginx/sites-available/default`:
   ```nginx
   # include /etc/nginx/snippets/mypeople-fastapi-v1.conf;
   ```
2. Test configuration:
   ```bash
   sudo nginx -t
   ```
3. Reload Nginx:
   ```bash
   sudo systemctl reload nginx
   ```
4. Confirm rollback:
   - `/api/health` and the member PWA on `/` remain 100% operational on Express.
   - `/v1/` requests return 404 or fallback to Express without impacting active member sessions.
