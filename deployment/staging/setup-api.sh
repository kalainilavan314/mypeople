set -euo pipefail
cd /tmp
# Staging API: its own database, role, secrets, storage and service. Production's are only read
# (constraints.txt, the Express migration runner), never changed.
B=/srv/secure/app/mypeople-staging-api
DATA=/srv/secure/app/mypeople-staging-data
PROD=/srv/secure/app/mypeople-api
EXP=/srv/secure/app/mypeople/current/server
test "$(sha256sum /home/deploy/$REL.tar.gz | cut -c1-64)" = "$SUM" || { echo "CHECKSUM MISMATCH: stopping"; exit 1; }; echo "checksum ok"

sudo install -d -o app -g app -m 0750 $B $B/releases $DATA
sudo install -d -o app -g app -m 0700 $B/shared $DATA/evidence
sudo install -d -o app -g app -m 0755 $DATA/media

role_exists=$(sudo -u postgres psql -At -c "select count(*) from pg_roles where rolname = 'mypeople_staging'")
if sudo test -e $B/shared/.env; then
  echo "staging .env exists: kept"
else
  [ "$role_exists" = 0 ] || { echo "role mypeople_staging exists without a staging .env: stopping"; exit 1; }
  PW=$(openssl rand -hex 24)
  sudo -u postgres psql -v ON_ERROR_STOP=1 -q -c "CREATE ROLE mypeople_staging LOGIN PASSWORD '$PW'"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -q -c "CREATE DATABASE mypeople_staging OWNER mypeople_staging"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -q -c "REVOKE ALL ON DATABASE mypeople_staging FROM PUBLIC"
  { echo "APP_ENV=staging"
    echo "DATABASE_URL=postgres://mypeople_staging:$PW@localhost:5432/mypeople_staging"
    echo "JWT_SECRET=$(openssl rand -hex 32)"
    echo "NIC_PEPPER=$(openssl rand -hex 32)"
    echo "SMS_PROVIDER=none"
    echo "PUSH_PROVIDER=none"
    echo "EVIDENCE_STORAGE_DIR=$DATA/evidence"
    echo "EVIDENCE_ENCRYPTION_KEY=$(openssl rand -base64 32)"
    echo "MEDIA_STORAGE_DIR=$DATA/media"
  } | sudo -u app bash -c "umask 077; cat > $B/shared/.env"
  unset PW
  echo "created role, database and .env"
fi
sudo sed -n 's/^\([A-Z_]*\)=.*/\1/p' $B/shared/.env | tr '\n' ' '; echo

echo "== Express migrations (geography and the shared tables)"
sudo bash -c "set -a; . $B/shared/.env; set +a; cd $EXP && node src/migrate.js" 2>&1 | grep -vE "^\s*$" | tail -16

echo "== API release"
if sudo test -d $B/releases/$REL; then echo "release exists: kept"; else
  sudo tar -xzf /home/deploy/$REL.tar.gz -C $B/releases
  sudo cp $PROD/current/constraints.txt $B/releases/$REL/constraints.txt
  sudo chown -R app:app $B/releases/$REL
  sudo -u app env HOME=/tmp bash -c "set -e; cd $B/releases/$REL; python3 -m venv .venv; .venv/bin/pip install -q --no-cache-dir --upgrade pip; .venv/bin/pip install -q --no-cache-dir -c constraints.txt . && echo 'pip install ok'"
fi
echo "== Alembic"
sudo -u app bash -c "cd $B/releases/$REL && set -a && . $B/shared/.env && set +a && .venv/bin/alembic upgrade head 2>&1 | grep -c 'Running upgrade' | sed 's/^/alembic upgrades run: /' && .venv/bin/alembic current 2>&1 | tail -1"

echo "== service"
sudo ln -sfn releases/$REL $B/current
sudo tee /etc/systemd/system/mypeople-staging-api.service >/dev/null <<'UNIT'
[Unit]
Description=My People FastAPI service (/v1), STAGING copy for user acceptance testing
After=network.target postgresql.service

[Service]
Type=simple
User=app
Group=app
WorkingDirectory=/srv/secure/app/mypeople-staging-api/current
EnvironmentFile=/srv/secure/app/mypeople-staging-api/shared/.env
ExecStart=/srv/secure/app/mypeople-staging-api/current/.venv/bin/uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8001 --proxy-headers --forwarded-allow-ips=127.0.0.1
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=full
UMask=0077

[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload
sudo systemctl enable --now mypeople-staging-api.service >/dev/null 2>&1
sudo systemctl restart mypeople-staging-api.service
code() { curl -s -o /dev/null -w "%{http_code}" -m 5 "$1" || true; }
ok=0; for i in $(seq 1 30); do [ "$(code http://127.0.0.1:8001/v1/health/db)" = 200 ] && { ok=1; break; }; sleep 1; done
[ $ok = 1 ] || { echo "STAGING API HEALTH FAILED"; sudo journalctl -u mypeople-staging-api --since "-2min" --no-pager -o cat | tail -15; exit 1; }
echo "staging /v1/health $(code http://127.0.0.1:8001/v1/health) /v1/health/db $(code http://127.0.0.1:8001/v1/health/db)"
echo "production /v1/health/db $(code http://127.0.0.1:8000/v1/health/db)"

echo "== synthetic accounts"
if sudo test -e $B/shared/uat-accounts.tsv; then echo "accounts file exists: seed run skipped"; else
  sudo -u app bash -c "cd $B/current && set -a && . $B/shared/.env && set +a && PYTHONPATH=. .venv/bin/python scripts/seed_staging.py --credentials $B/shared/uat-accounts.tsv"
fi
sudo ls -l $B/shared/uat-accounts.tsv | awk '{print $1, $3, $NF}'
rm -f /home/deploy/$REL.tar.gz
free -m | sed -n 2p
