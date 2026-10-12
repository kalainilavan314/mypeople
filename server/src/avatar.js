import crypto from 'node:crypto';
import { pool } from './db.js';
import { putObject, deleteObject } from './storage.js';

export async function replaceAvatar(memberId, { buf, ext }, services = { pool, putObject, deleteObject }) {
  const filename = `${crypto.randomUUID()}.${ext}`;
  let client;
  let previous;
  let committed = false;
  let commitAttempted = false;
  try {
    await services.putObject('avatars', filename, buf);
    client = await services.pool.connect();
    await client.query('BEGIN');
    const result = await client.query(
      'SELECT avatar_path FROM npm.member WHERE id=$1 AND deleted_at IS NULL FOR UPDATE',
      [memberId],
    );
    if (!result.rows[0]) {
      throw Object.assign(new Error('unauthorized'), { status: 401, publicMessage: 'unauthorized' });
    }
    previous = result.rows[0].avatar_path;
    await client.query('UPDATE npm.member SET avatar_path=$1 WHERE id=$2', [filename, memberId]);
    commitAttempted = true;
    await client.query('COMMIT');
    committed = true;
  } catch (error) {
    if (client && !committed) {
      await client.query('ROLLBACK').catch(() => {});
    }
    // A disconnected COMMIT can have succeeded. Retain the new object when
    // its result is unknown so a committed avatar never points to deleted bytes.
    if (!commitAttempted) await services.deleteObject('avatars', filename);
    throw error;
  } finally {
    client?.release();
  }
  // The row lock serializes replacements; the previous image stays available
  // until its replacement is stored and the database points to it.
  if (previous && previous !== filename) await services.deleteObject('avatars', previous);
  return filename;
}
