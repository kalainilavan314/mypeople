from pathlib import Path
import subprocess, tarfile, hashlib, json, datetime
root=Path.cwd()
git=r'C:\Users\HP\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\git\cmd\git.exe'
def readgit(*args): return subprocess.check_output([git,'-C',str(root),*args],text=True).strip()
release='civic-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
base=readgit('rev-parse','HEAD')
paths=set()
for command in [('ls-files','app','server'),('ls-files','--others','--exclude-standard')]:
 for rel in readgit(*command).splitlines():
  if rel.startswith(('app/','server/')) and not any(part in rel.split('/') for part in ['node_modules','uploads']):
   p=root/rel
   if p.is_file() and not p.name.startswith('.env'): paths.add(rel)
for p in (root/'app/dist').rglob('*'):
 if p.is_file(): paths.add(p.relative_to(root).as_posix())
marker=f'release={release}\nbase_commit={base}\n'
for rel in ['app/public/build-marker.txt','app/dist/build-marker.txt']:
 (root/rel).write_text(marker,encoding='utf-8'); paths.add(rel)
files={rel:hashlib.sha256((root/rel).read_bytes()).hexdigest() for rel in sorted(paths)}
manifest={'release':release,'baseCommit':base,'files':files,'databaseMigrationsRequired':False}
out=root/'deployment/artifacts';out.mkdir(parents=True,exist_ok=True)
m=out/(release+'.json');m.write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
archive=out/(release+'.tar.gz')
with tarfile.open(archive,'w:gz') as t:
 for rel in sorted(paths): t.add(root/rel,arcname=rel,recursive=False)
 t.add(m,arcname='release-manifest.json',recursive=False)
print(json.dumps({'release':release,'archive':str(archive),'manifest':str(m),'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'files':len(files)}))
