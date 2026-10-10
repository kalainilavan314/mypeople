from pathlib import Path
import hashlib, json, sys, urllib.request, re, datetime

release=sys.argv[1]
base='https://178.128.126.35.nip.io'
root=Path(__file__).resolve().parent.parent
def read(path):
    with urllib.request.urlopen(base+path,timeout=25) as r:
        assert r.status==200
        return r.read()
health=json.loads(read('/api/health'))
assert health['ok'] and health['dbWrite']
assert release.encode() in read('/build-marker.txt')
html=read('/').decode()
assets=re.findall(r'(?:src|href)="(/assets/[^"]+)"',html)
assert assets
paths=assets+['/member/coast-hero.webp','/member/outfit-latin.woff2','/sw.js']
for path in paths:
    live=read(path)
    local=(root/'app/dist'/path.lstrip('/')).read_bytes()
    assert hashlib.sha256(live).digest()==hashlib.sha256(local).digest(),path
albums=json.loads(read('/api/gallery/albums'))['albums']
assert len(albums)==5
for album in albums:
    assert album['count']==len(album['photos'])
    for photo in album['photos']: assert len(read(photo['src']))>0
record={'release':release,'url':base,'verifiedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'health':health['ok'],'databaseAccess':health['dbWrite'],'publicAssetsMatchBuild':paths,'galleryAlbums':len(albums),'status':'live'}
(root/'deployment/artifacts'/(release+'-live.json')).write_text(json.dumps(record,indent=2)+'\n',encoding='utf-8')
print(json.dumps(record))
