set -euo pipefail
cd /tmp
W=/var/www/mypeople-staging
SITE=/etc/nginx/sites-available/mypeople-staging
CERT=staging-app.178.128.126.35.nip.io
test "$(sha256sum /home/deploy/$REL.tar.gz | cut -c1-64)" = "$SUM" || { echo "CHECKSUM MISMATCH: stopping"; exit 1; }; echo "checksum ok"

echo "== web apps"
sudo install -d -m 0755 $W $W/releases
sudo tar -xzf /home/deploy/$REL.tar.gz -C $W/releases
sudo chown -R root:root $W/releases/$REL
sudo find $W/releases/$REL -type d -exec chmod 755 {} + ; sudo find $W/releases/$REL -type f -exec chmod 644 {} +
test -f $W/releases/$REL/app/index.html && test -f $W/releases/$REL/staff/index.html
sudo ln -sfn releases/$REL $W/current
echo "current: $(readlink $W/current)"

reload_or_undo() {  # $1 describes the step; on a failed check the staging site is taken out again
  if sudo nginx -t 2>/tmp/staging-nginx-test.log; then sudo systemctl reload nginx && echo "nginx reloaded ($1)"; else
    tail -3 /tmp/staging-nginx-test.log; sudo rm -f /etc/nginx/sites-enabled/mypeople-staging; sudo nginx -t 2>/dev/null && sudo systemctl reload nginx
    echo "nginx -t failed at '$1': staging site disabled, production untouched"; exit 1; fi
}

echo "== web server"
sudo install -m 0644 /home/deploy/mypeople-staging-v1.conf /etc/nginx/snippets/mypeople-staging-v1.conf
if ! sudo test -e /etc/letsencrypt/live/$CERT/fullchain.pem; then
  sudo install -m 0644 /home/deploy/mypeople-staging.http.conf $SITE
  sudo ln -sfn $SITE /etc/nginx/sites-enabled/mypeople-staging
  reload_or_undo "http only, for the certificate"
  sleep 2
  sudo certbot certonly --webroot -w /var/www/letsencrypt --cert-name $CERT \
    -d staging-app.178.128.126.35.nip.io -d staging-staff.178.128.126.35.nip.io -d staging-admin.178.128.126.35.nip.io \
    --non-interactive --keep-until-expiring 2>&1 | grep -E "Successfully|expires|error|Error|failed" | head -4 || true
fi
sudo test -e /etc/letsencrypt/live/$CERT/fullchain.pem || { echo "NO CERTIFICATE: staging stays on http only"; exit 1; }
sudo install -m 0644 /home/deploy/mypeople-staging.conf $SITE
sudo ln -sfn $SITE /etc/nginx/sites-enabled/mypeople-staging
reload_or_undo "https"
code() { curl -s -o /dev/null -w "%{http_code}" -m 10 --resolve "$1:443:127.0.0.1" "https://$1$2" || true; }
for h in staging-app staging-staff; do echo "$h / $(code $h.178.128.126.35.nip.io /) /v1/health/db $(code $h.178.128.126.35.nip.io /v1/health/db)"; done
echo "staging-admin /sign-in $(code staging-admin.178.128.126.35.nip.io /sign-in)"
echo "production app / $(code app.178.128.126.35.nip.io /) admin /sign-in $(code admin.178.128.126.35.nip.io /sign-in)"
rm -f /home/deploy/$REL.tar.gz /home/deploy/mypeople-staging.conf /home/deploy/mypeople-staging.http.conf /home/deploy/mypeople-staging-v1.conf
