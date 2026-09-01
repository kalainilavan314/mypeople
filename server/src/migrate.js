// Migration runner. Applies migrations/*.sql in filename order, exactly once
// each, tracked in the public.schema_migrations ledger.
//
//   npm run migrate              apply everything outstanding
//   npm run migrate -- --status  list applied / pending, apply nothing
//   npm run migrate -- --baseline
//                                record every migration as applied WITHOUT
//                                running it — for an existing database whose
//                                schema predates this runner (e.g. the local
//                                dev DB). 0001_init.sql is not idempotent, so
//                                re-running it against a live database fails.
//
// Each file is executed inside one transaction together with its ledger row, so
// a failure leaves neither a half-applied schema nor a false ledger entry. Files
// that open their own transaction (0000, 0001) have that outer begin/commit
// stripped first — nesting them would make the ledger insert non-atomic.
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { poolConfig } from './db.js';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

const LEDGER = `
  create table if not exists public.schema_migrations (
    filename   text primary key,
    checksum   text not null,
    applied_at timestamptz not null default now()
  )`;

/** Remove a leading "begin;" / trailing "commit;" so we own the transaction. */
function unwrap(sql) {
  return sql.replace(/^\s*begin\s*;/i, '').replace(/commit\s*;\s*$/i, '');
}

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set — nothing to migrate against.');
    process.exit(1);
  }
  const mode = process.argv.includes('--baseline')
    ? 'baseline'
    : process.argv.includes('--status')
      ? 'status'
      : 'apply';

  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
  // One connection: migrations are strictly sequential, and free-tier Postgres
  // plans have a small connection budget worth not spending here.
  const pool = new pg.Pool(poolConfig({ max: 1 }));

  try {
    await pool.query(LEDGER);
    const done = new Map(
      (await pool.query('select filename, checksum from public.schema_migrations')).rows.map((r) => [
        r.filename,
        r.checksum,
      ]),
    );

    let applied = 0;
    for (const file of files) {
      const sql = fs.readFileSync(path.join(DIR, file), 'utf8');
      const sum = sha(sql);

      if (done.has(file)) {
        // A changed checksum means the file was edited after it was applied.
        // Editing history is a legitimate move on a database you can recreate,
        // so this warns rather than fails — but it is worth seeing.
        const drift = done.get(file) !== sum ? '  ** file changed since it was applied **' : '';
        if (mode === 'status') console.log(`  applied  ${file}${drift}`);
        else if (drift) console.warn(`  warn     ${file}${drift}`);
        continue;
      }

      if (mode === 'status') {
        console.log(`  PENDING  ${file}`);
        continue;
      }

      const client = await pool.connect();
      try {
        await client.query('begin');
        if (mode === 'apply') await client.query(unwrap(sql));
        await client.query('insert into public.schema_migrations (filename, checksum) values ($1, $2)', [file, sum]);
        await client.query('commit');
        console.log(`  ${mode === 'baseline' ? 'baselined' : 'applied  '} ${file}`);
        applied++;
      } catch (e) {
        await client.query('rollback').catch(() => {});
        console.error(`\nFAILED on ${file}\n  ${e.message}`);
        process.exitCode = 1;
        return;
      } finally {
        client.release();
      }
    }

    if (mode === 'status') console.log('\nStatus only — nothing was applied.');
    else if (applied === 0) console.log('  Already up to date.');
    else console.log(`\n${applied} migration(s) ${mode === 'baseline' ? 'baselined' : 'applied'}.`);
  } finally {
    await pool.end();
  }
}

main();
