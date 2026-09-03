/**
 * Seed (or reset) the demo account shown on the login screen.
 *
 *   NIC:      990740623V
 *   Password: kalai
 *
 * Run:  node src/seed-demo.js
 *
 * Uses the same bcrypt + nicHash(NIC_PEPPER) helpers as the live auth routes, so
 * the credentials are guaranteed to work against whatever .env this server uses.
 * Re-running updates the password and profile in place rather than duplicating.
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from './db.js';
import { nicHash, memberCode, referralCode } from './lib.js';

const NIC = '990740623V';
const PASSWORD = 'kalai';
const NAME = 'Kalai';

const SURVEY = {
  alcohol: 'no',
  betel: 'no',
  marital: 'single',
  blood_group: 'O+',
};

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Jaffna district + a real DS/GS division from the geo reference tables.
    //
    // The "d.geom IS NOT NULL" filter this once carried told the real district
    // apart from an orphan duplicate of the same name in the GIS database.
    // 0000_geo_reference imports neither the orphans nor any geometry, so the
    // name alone is now unambiguous — and the query works against a plain
    // Postgres with no PostGIS, which is what the deployment runs on.
    const { rows: geo } = await client.query(`
      SELECT d.district_code, ds.ds_code, g.gn_code
        FROM geo.district d
        JOIN geo.ds_division ds ON ds.district_code = d.district_code
        JOIN geo.gn_division g  ON g.ds_code = ds.ds_code
       WHERE d.name_en = 'Jaffna'
       ORDER BY ds.ds_code, g.gn_code
       LIMIT 1`);
    if (!geo.length) throw new Error('No Jaffna district/DS/GS found in the geo schema');
    const { district_code, ds_code, gn_code } = geo[0];

    const nh = nicHash(NIC);
    const pwHash = await bcrypt.hash(PASSWORD, 10);

    const existing = await client.query(
      `SELECT id FROM npm.member WHERE nic_hash = $1`, [nh],
    );

    let id;
    if (existing.rows.length) {
      id = existing.rows[0].id;
      await client.query(
        `UPDATE npm.member
            SET full_name=$2, password_hash=$3, nic_status='verified',
                district_code=$4, ds_code=$5, gs_code=$6, deleted_at=NULL
          WHERE id=$1`,
        [id, NAME, pwHash, district_code, ds_code, gn_code],
      );
      console.log(`Updated existing demo member ${id}`);
    } else {
      const ins = await client.query(
        `INSERT INTO npm.member
           (member_code, full_name, phone, nic_hash, nic_status, password_hash,
            dob, gender, district_code, ds_code, gs_code, referral_code, language)
         VALUES ($1,$2,NULL,$3,'verified',$4,$5,'male',$6,$7,$8,$9,'en')
         RETURNING id`,
        [memberCode(), NAME, nh, pwHash, '1999-03-15',
          district_code, ds_code, gn_code, referralCode(NAME)],
      );
      id = ins.rows[0].id;
      console.log(`Created demo member ${id}`);
    }

    for (const [qid, answer] of Object.entries(SURVEY)) {
      await client.query(
        `INSERT INTO npm.onboarding_answer (member_id, question_id, answer)
         VALUES ($1,$2,$3)
         ON CONFLICT (member_id, question_id) DO UPDATE SET answer = excluded.answer`,
        [id, qid, answer],
      );
    }

    await client.query('COMMIT');

    const { rows } = await pool.query(
      `SELECT member_code, full_name, district, ds_division, gs_division,
              alcohol, betel, marital_status, blood_group
         FROM npm.member_survey WHERE member_id = $1`, [id],
    );
    console.log('\nDemo account ready:');
    console.log(`  NIC      ${NIC}`);
    console.log(`  Password ${PASSWORD}`);
    console.table(rows);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

void main();
