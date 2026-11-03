import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
test('actual PostgreSQL engine isolates tenant rows and rejects cross-tenant writes',async()=>{
 const db=new PGlite();
 try{
  await db.exec(await readFile(new URL('../database/001_initial.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../database/002_channels.sql',import.meta.url),'utf8'));
  // Run twice to verify a fresh install can safely rerun these migrations.
  await db.exec(await readFile(new URL('../database/001_initial.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../database/002_channels.sql',import.meta.url),'utf8'));
  await db.query('INSERT INTO workspaces(id,slug,name,owner_email) VALUES($1,$2,$3,$4),($5,$6,$7,$8)',[A,'sale-a','A','a@example.com',B,'sale-b','B','b@example.com']);
  await db.exec('CREATE ROLE crm_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS; GRANT USAGE ON SCHEMA public TO crm_runtime; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO crm_runtime; SET ROLE crm_runtime;');
  async function scoped(id,fn){await db.exec('BEGIN');try{await db.query("SELECT set_config('app.workspace_id',$1,true)",[id]);const out=await fn();await db.exec('COMMIT');return out}catch(e){await db.exec('ROLLBACK');throw e}}
  await scoped(A,()=>db.query('INSERT INTO customers(id,workspace_id,name,phone,phone_normalized) VALUES($1,$2,$3,$4,$4)',['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',A,'Khách A','0901234567']));
  await scoped(B,()=>db.query('INSERT INTO customers(id,workspace_id,name,phone,phone_normalized) VALUES($1,$2,$3,$4,$4)',['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',B,'Khách B','0901234567']));
  const a=await scoped(A,()=>db.query('SELECT * FROM customers'));
  assert.equal(a.rows.length,1);assert.equal(a.rows[0].name,'Khách A');
  const b=await scoped(B,()=>db.query('SELECT * FROM customers'));
  assert.equal(b.rows.length,1);assert.equal(b.rows[0].name,'Khách B');
  const noScope=await db.query('SELECT * FROM customers');assert.equal(noScope.rows.length,0);
  await assert.rejects(()=>scoped(A,()=>db.query('INSERT INTO customers(id,workspace_id,name) VALUES($1,$2,$3)',['cccccccc-cccc-4ccc-8ccc-cccccccccccc',B,'Cross tenant'])));
  await assert.rejects(()=>scoped(A,()=>db.query('INSERT INTO tasks(id,workspace_id,customer_id,title,due_at,kind) VALUES($1,$2,$3,$4,now(),$5)',['dddddddd-dddd-4ddd-8ddd-dddddddddddd',A,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Cross customer','call'])));
  await assert.rejects(()=>scoped(A,()=>db.query('INSERT INTO customers(id,workspace_id,name,phone_normalized) VALUES($1,$2,$3,$4)',['eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',A,'Trùng số','0901234567'])));
  const updated=await scoped(A,()=>db.query("UPDATE customers SET name='Hacked' WHERE workspace_id=$1 RETURNING id",[B]));assert.equal(updated.rows.length,0);
 }finally{await db.close()}
});
