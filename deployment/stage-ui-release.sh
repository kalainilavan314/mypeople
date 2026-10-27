#!/usr/bin/env bash
set -euo pipefail
release=$1
[[ "$release" =~ ^civic-[0-9]{8}T[0-9]{6}Z$ ]]
base=/srv/secure/app/mypeople
old=$(readlink -f "$base/current")
stage="$base/releases/$release"
archive="/home/deploy/$release.tar.gz"
test -d "$old"
test -f "$archive"
test "$stage" != "$old"
if test -e "$stage"; then
  # Resume only our own staged release, never an unrelated directory.
  test -d "$stage"
  test -f "$stage/release-manifest.json"
  python3 - "$stage/release-manifest.json" "$release" <<'PY'
import json,sys
assert json.load(open(sys.argv[1]))['release']==sys.argv[2]
PY
else
  cp -a --reflink=auto "$old" "$stage"
  tar -xzf "$archive" -C "$stage"
  chown -hR app:app "$stage"
fi
python3 - "$stage" <<'PY'
import hashlib,json,pathlib,sys
p=pathlib.Path(sys.argv[1])
m=json.loads((p/'release-manifest.json').read_text())
for rel,digest in m['files'].items():
    assert hashlib.sha256((p/rel).read_bytes()).hexdigest()==digest,rel
print('Verified',len(m['files']),'release files')
PY
# Install the API's packages from this release's lockfile. The stage starts as
# a copy of the previous release, node_modules included, so without this a
# changed server/package-lock.json (a security patch, say) would never reach
# production. --ignore-scripts: none of these packages needs an install
# script, and this runs as root.
npm_cache=$(mktemp -d)
npm ci --prefix "$stage/server" --omit=dev --ignore-scripts --no-audit --no-fund --cache "$npm_cache" >/dev/null
rm -rf "$npm_cache"
npm ls --prefix "$stage/server" --omit=dev >/dev/null
chown -hR app:app "$stage/server/node_modules"
(cd "$stage/server" && node -p "'Installed ' + ['express','body-parser','proxy-addr','qs'].map((n) => n + '@' + require(n + '/package.json').version).join(' ')")
unit="mypeople-preflight-$release"
systemctl stop "$unit.service" >/dev/null 2>&1 || true
cp -p "$old/server/.env" "$stage/server/.env"
cleanup() {
  systemctl stop "$unit.service" >/dev/null 2>&1 || true
  cp -p "$old/server/.env" "$stage/server/.env"
}
trap cleanup EXIT
if grep -q '^PORT=' "$stage/server/.env"; then
  sed -i 's/^PORT=.*/PORT=3002/' "$stage/server/.env"
else
  printf '\nPORT=3002\n' >> "$stage/server/.env"
fi
systemd-run --quiet --collect --unit="$unit" --property=User=app --property=Group=app --property="WorkingDirectory=$stage" --property="EnvironmentFile=$stage/server/.env" /usr/local/bin/node server/src/index.js
for attempt in {1..10}; do
  if curl -fsS http://127.0.0.1:3002/api/health >/dev/null; then break; fi
  sleep 1
done
python3 - "$release" <<'PY'
import json,sys,urllib.request
base='http://127.0.0.1:3002'
def read(path): return urllib.request.urlopen(base+path).read()
health=json.loads(read('/api/health'))
assert health['ok'] and health['dbWrite']
assert sys.argv[1].encode() in read('/build-marker.txt')
albums=json.loads(read('/api/gallery/albums'))['albums']
assert albums
for album in albums:
    assert album['count']==len(album['photos'])
    for photo in album['photos']: assert len(read(photo['src']))>0
for asset in ['/member/coast-hero.webp','/member/community-hero-v1.webp','/member/home-ideas-v1.webp','/member/home-membership-v1.webp','/sw.js']:
    assert len(read(asset))>0
print('Preflight passed: health, database access, release, gallery, hero images, service worker')
PY
cleanup
trap - EXIT
cmp -s "$old/server/.env" "$stage/server/.env"
test "$(readlink "$stage/server/uploads")" = "$(readlink "$old/server/uploads")"
printf 'Staged %s. Environment and uploads preserved.\n' "$release"
