#!/usr/bin/env bash
set -euo pipefail
release=$1
[[ "$release" =~ ^civic-[0-9]{8}T[0-9]{6}Z$ ]]
cd /srv/secure/app/mypeople
test -L current
test -d "releases/$release"
old=$(readlink current)
test ! -e "previous-$release"
ln -s "$old" "previous-$release"
ln -s "releases/$release" "next-$release"
rollback() {
  ln -s "$old" "rollback-$release"
  mv -Tf "rollback-$release" current
  systemctl restart mypeople.service
  printf 'Rolled back to %s\n' "$old"
}
trap rollback ERR
mv -Tf "next-$release" current
systemctl restart mypeople.service
sleep 2
systemctl is-active --quiet mypeople.service
curl -fsS http://127.0.0.1:3001/api/health >/dev/null
curl -fsS http://127.0.0.1:3001/build-marker.txt | grep -q "$release"
trap - ERR
printf 'Live: %s. Previous release: %s\n' "$release" "$old"
