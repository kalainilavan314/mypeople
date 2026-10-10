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
test ! -e "$stage"
cp -a --reflink=auto "$old" "$stage"
tar -xzf "$archive" -C "$stage"
chown -hR app:app "$stage"
python3 - "$stage" <<'PY'
import hashlib,json,pathlib,sys
p=pathlib.Path(sys.argv[1])
m=json.loads((p/'release-manifest.json').read_text())
for rel,digest in m['files'].items():
    assert hashlib.sha256((p/rel).read_bytes()).hexdigest()==digest,rel
print('Verified',len(m['files']),'release files')
PY
unit="mypeople-preflight-$release"
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
for asset in ['/member/coast-hero.webp','/member/outfit-latin.woff2','/sw.js']:
    assert len(read(asset))>0
print('Preflight passed: health, database access, release, gallery, hero, font, service worker')
PY
cleanup
trap - EXIT
cmp -s "$old/server/.env" "$stage/server/.env"
test "$(readlink "$stage/server/uploads")" = "$(readlink "$old/server/uploads")"
printf 'Staged %s. Environment and uploads preserved.\n' "$release"
