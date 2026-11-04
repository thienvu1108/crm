import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const UA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const UB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

async function migrate(db) {
  for (const f of ['001_initial.sql', '007_rls_hardening.sql']) {
    await db.exec(await readFile(new URL('../database/' + f, import.meta.url), 'utf8'));
  }
}

test('RLS hardening isolates memberships, domains, audit_log by workspace', async () => {
  const db = new PGlite();
  try {
    await migrate(db);
    await db.query(
      'INSERT INTO workspaces(id,slug,name,owner_email) VALUES($1,$2,$3,$4),($5,$6,$7,$8)',
      [A, 'sale-a', 'A', 'a@example.com', B, 'sale-b', 'B', 'b@example.com'],
    );
    await db.query('INSERT INTO users(id,google_sub,email,name) VALUES($1,$2,$3,$4),($5,$6,$7,$8)', [
      UA, 'sub-a', 'a@example.com', 'A', UB, 'sub-b', 'b@example.com', 'B',
    ]);
    await db.exec(
      "SELECT set_config('app.platform_admin','true',false);",
    );
    await db.query(
      "INSERT INTO memberships(id,workspace_id,user_id,email,role) VALUES($1,$2,$3,$4,'owner'),($5,$6,$7,$8,'owner')",
      [
        'c1111111-1111-4111-8111-111111111111', A, UA, 'a@example.com',
        'c2222222-2222-4222-8222-222222222222', B, UB, 'b@example.com',
      ],
    );
    await db.query(
      'INSERT INTO domains(hostname,workspace_id,verification_token,verified) VALUES($1,$2,$3,true),($4,$5,$6,true)',
      ['a.example.com', A, 'tok-a', 'b.example.com', B, 'tok-b'],
    );
    await db.query(
      'INSERT INTO audit_log(id,workspace_id,actor_id,action) VALUES($1,$2,$3,$4),($5,$6,$7,$8)',
      [
        'd1111111-1111-4111-8111-111111111111', A, UA, 'workspace.create',
        'd2222222-2222-4222-8222-222222222222', B, UB, 'workspace.create',
      ],
    );

    await db.exec(
      'CREATE ROLE crm_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS; GRANT USAGE ON SCHEMA public TO crm_runtime; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO crm_runtime; SET ROLE crm_runtime;',
    );

    async function scoped(id, fn) {
      await db.exec('BEGIN');
      try {
        await db.query("SELECT set_config('app.workspace_id',$1,true)", [id]);
        await db.query("SELECT set_config('app.platform_admin','',true)");
        const out = await fn();
        await db.exec('COMMIT');
        return out;
      } catch (e) {
        await db.exec('ROLLBACK');
        throw e;
      }
    }

    const memA = await scoped(A, () => db.query('SELECT * FROM memberships'));
    assert.equal(memA.rows.length, 1);
    assert.equal(memA.rows[0].workspace_id, A);

    const domA = await scoped(A, () => db.query('SELECT * FROM domains'));
    assert.equal(domA.rows.length, 1);
    assert.equal(domA.rows[0].hostname, 'a.example.com');

    const audA = await scoped(A, () => db.query('SELECT * FROM audit_log'));
    assert.equal(audA.rows.length, 1);

    const cross = await scoped(A, () =>
      db.query('UPDATE domains SET verified=false WHERE workspace_id=$1 RETURNING hostname', [B]),
    );
    assert.equal(cross.rows.length, 0);

    await assert.rejects(() =>
      scoped(A, () =>
        db.query('INSERT INTO domains(hostname,workspace_id,verification_token) VALUES($1,$2,$3)', [
          'evil.example.com',
          B,
          'x',
        ]),
      ),
    );
  } finally {
    await db.close();
  }
});
