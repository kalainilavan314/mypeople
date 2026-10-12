"""Deploy an approved release with a strict host-key check and an encrypted SSH key.

Install paramiko in deployment/.ssh-runtime. Supply the key passphrase through
the process environment MY_PEOPLE_KEY_PASSPHRASE; it is never saved or printed.
"""
from pathlib import Path
import getpass, hashlib, os, re, sys, time

root=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(root/'deployment/.ssh-runtime'))
import paramiko

release=sys.argv[1]
if not re.fullmatch(r'civic-\d{8}T\d{6}Z',release):
    raise SystemExit('Invalid release name')
archive=root/'deployment/artifacts'/(release+'.tar.gz')
if not archive.is_file(): raise SystemExit('Release package missing')
passphrase=os.environ.pop('MY_PEOPLE_KEY_PASSPHRASE',None)
if not passphrase and sys.stdin.isatty():
    passphrase=getpass.getpass('Encrypted SSH key passphrase: ')
if not passphrase: raise SystemExit('Provide the encrypted-key passphrase in the process environment')
client=paramiko.SSHClient()
client.load_host_keys(str(Path.home()/'.ssh/known_hosts'))
client.set_missing_host_key_policy(paramiko.RejectPolicy())

def run(command):
    _,out,err=client.exec_command(command,timeout=240)
    result=out.read().decode('utf-8','replace')
    diagnostic=err.read().decode('utf-8','replace')
    status=out.channel.recv_exit_status()
    if result.strip(): print(result.strip(),flush=True)
    if status: raise RuntimeError(f'Command failed ({status}): {diagnostic.strip()}')
    return result.strip()

try:
    client.connect('178.128.126.35',username='deploy',key_filename=str(Path.home()/'Downloads/karan-server-handover/karan-server-admin'),passphrase=passphrase,allow_agent=False,look_for_keys=False,timeout=20,auth_timeout=30,banner_timeout=20)
    passphrase=None
    client.get_transport().set_keepalive(15)
    print('Connected; server host key verified.',flush=True)
    run('sudo -n systemctl start --no-block karan-backup.service')
    with client.open_sftp() as sftp:
        for local in [archive,root/'deployment/stage-ui-release.sh',root/'deployment/activate-ui-release.sh']:
            sftp.put(str(local),'/home/deploy/'+local.name)
    expected=hashlib.sha256(archive.read_bytes()).hexdigest()
    actual=run(f'sha256sum /home/deploy/{release}.tar.gz').split()[0]
    if actual!=expected: raise RuntimeError('Uploaded package checksum mismatch')
    print('Upload checksum verified.',flush=True)
    run(f'sudo -n bash /home/deploy/stage-ui-release.sh {release}')
    deadline=time.monotonic()+240
    while True:
        state=run('sudo -n systemctl show karan-backup.service --value -p ActiveState')
        if state not in ['active','activating','deactivating']: break
        if time.monotonic()>deadline: raise RuntimeError('Backup is still running; release remains staged')
        time.sleep(5)
    if run('sudo -n systemctl show karan-backup.service --value -p Result')!='success':
        raise RuntimeError('Backup did not complete successfully; release remains staged')
    run(f'sudo -n bash /home/deploy/activate-ui-release.sh {release}')
finally:
    passphrase=None
    client.close()
