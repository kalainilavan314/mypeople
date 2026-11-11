set -euo pipefail
cd /tmp
# Staging dashboard: built on the server like production's, talking only to the staging API (8001).
B=/srv/secure/app/mypeople-staging-admin
test "$(sha256sum /home/deploy/$REL.tar.gz | cut -c1-64)" = "$SUM" || { echo "CHECKSUM MISMATCH: stopping"; exit 1; }; echo "checksum ok"
sudo install -d -o app -g app -m 0750 $B $B/releases
sudo install -d -o app -g app -m 0700 $B/shared
if sudo test -e $B/shared/.env; then echo "staging dashboard .env exists: kept"; else
  { echo "NODE_ENV=production"; echo "API_URL=http://127.0.0.1:8001"; echo "NEXT_TELEMETRY_DISABLED=1"
    echo "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=$(openssl rand -base64 32)"; } | sudo -u app bash -c "umask 077; cat > $B/shared/.env"
fi
sudo grep -c '^API_URL=http://127.0.0.1:8001$' $B/shared/.env | sed 's/^/points at the staging API: /'
sudo install -d -o app -g app -m 0750 $B/releases/$REL
sudo tar -xzf /home/deploy/$REL.tar.gz -C $B/releases/$REL && sudo chown -R app:app $B/releases/$REL
sudo -u app env HOME=/tmp npm_config_cache=/tmp/mp-npm-cache bash -s -- "$REL" "$B" < /home/deploy/build-dashboard.sh
sudo ln -sfn releases/$REL $B/current
sudo tee /etc/systemd/system/mypeople-staging-admin.service >/dev/null <<'UNIT'
[Unit]
Description=My People admin dashboard, STAGING copy for user acceptance testing
After=network.target mypeople-staging-api.service
Wants=mypeople-staging-api.service

[Service]
Type=simple
User=app
Group=app
WorkingDirectory=/srv/secure/app/mypeople-staging-admin/current/apps/admin-web
EnvironmentFile=/srv/secure/app/mypeople-staging-admin/shared/.env
# One process: the dashboard shares refresh-token renewals in memory (deployment/README.md).
ExecStart=/usr/local/bin/node /srv/secure/app/mypeople-staging-admin/current/node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3005
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
sudo systemctl enable --now mypeople-staging-admin.service >/dev/null 2>&1
sudo systemctl restart mypeople-staging-admin.service
code() { curl -s -o /dev/null -w "%{http_code}" -m 5 "$1" || true; }
ok=0; for i in $(seq 1 40); do [ "$(code http://127.0.0.1:3005/sign-in)" = 200 ] && { ok=1; break; }; sleep 1; done
[ $ok = 1 ] || { echo "STAGING DASHBOARD FAILED"; sudo journalctl -u mypeople-staging-admin --since "-2min" --no-pager -o cat | tail -15; exit 1; }
echo "staging dashboard /sign-in $(code http://127.0.0.1:3005/sign-in); production dashboard /sign-in $(code http://127.0.0.1:3003/sign-in)"
rm -f /home/deploy/$REL.tar.gz /home/deploy/build-dashboard.sh
free -m | sed -n 2p
