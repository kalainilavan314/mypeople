// Uploaded-image storage (avatars, donation slips) behind one small interface,
// with two backends chosen by environment:
//
//   local     (default)  files under server/uploads/<area>/ — dev, and any host
//                        with a real persistent disk.
//   supabase             Supabase Storage, used when SUPABASE_URL and
//                        SUPABASE_SERVICE_KEY are set. Required on hosts with an
//                        ephemeral filesystem (Render free, Fly, most PaaS free
//                        tiers), where local files vanish on every deploy and
//                        every sleep/wake cycle.
//
// The bucket stays PRIVATE. Nothing here hands out public or signed URLs: the
// API keeps serving the bytes through its own /api/avatars/:id and
// /api/donations/:id/slip endpoints, so the existing access rules (unguessable
// UUID for avatars, admin-only for slips) continue to apply unchanged.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LOCAL_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'uploads');

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const BUCKET = process.env.SUPABASE_BUCKET || 'npm-uploads';

export const backend = SUPABASE_URL && SUPABASE_KEY ? 'supabase' : 'local';

const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
export const mimeFor = (name) => MIME[path.extname(name).replace('.', '').toLowerCase()] || 'application/octet-stream';

/** Area is a fixed prefix, never user input: 'avatars' | 'donations'. */
const localPath = (area, name) => path.join(LOCAL_ROOT, area, path.basename(name));
const remoteUrl = (area, name) =>
  `${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(BUCKET)}/${area}/${encodeURIComponent(path.basename(name))}`;
const authHeaders = () => ({ authorization: `Bearer ${SUPABASE_KEY}`, apikey: SUPABASE_KEY });

if (backend === 'local') {
  for (const area of ['avatars', 'donations']) fs.mkdirSync(path.join(LOCAL_ROOT, area), { recursive: true });
}

export async function putObject(area, name, buf) {
  if (backend === 'local') {
    fs.writeFileSync(localPath(area, name), buf);
    return;
  }
  const res = await fetch(remoteUrl(area, name), {
    method: 'POST',
    headers: { ...authHeaders(), 'content-type': mimeFor(name), 'cache-control': '31536000', 'x-upsert': 'true' },
    body: buf,
  });
  if (!res.ok) throw new Error(`storage_put_failed ${res.status} ${await res.text().catch(() => '')}`);
}

/** Returns the bytes, or null when the object does not exist. */
export async function getObject(area, name) {
  if (backend === 'local') {
    const full = localPath(area, name);
    return fs.existsSync(full) ? fs.readFileSync(full) : null;
  }
  const res = await fetch(remoteUrl(area, name), { headers: authHeaders() });
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) throw new Error(`storage_get_failed ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Best-effort: a failed delete must never fail the request that triggered it. */
export async function deleteObject(area, name) {
  try {
    if (backend === 'local') {
      const full = localPath(area, name);
      if (fs.existsSync(full)) fs.unlinkSync(full);
      return;
    }
    await fetch(remoteUrl(area, name), { method: 'DELETE', headers: authHeaders() });
  } catch (e) {
    console.warn(`storage: could not delete ${area}/${name} — ${e.message}`);
  }
}
