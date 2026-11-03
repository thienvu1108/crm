import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {extractPhones, normalizePhone} from '../server/security.mjs';
import {encrypt} from '../server/security.mjs';

const A='11111111-1111-4111-8111-111111111111';
const U='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const C1='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const C2='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const I1='dddddddd-dddd-4ddd-8ddd-dddddddddddd';

test('extractPhones finds +84 and 0-prefixed Vietnamese numbers in chat text', () => {
  assert.deepEqual(extractPhones('Alo anh, SĐT em là 0901.234.567 nhé'), ['0901234567']);
  assert.deepEqual(extractPhones('Gọi +84 912 345 678 hoặc 0912345678'), ['0912345678']);
  assert.equal(normalizePhone('84901234567'), '0901234567');
  assert.deepEqual(extractPhones('không có số'), []);
});

test('inbound phone match links identity to existing customer and soft-merges empty channel lead', async () => {
  process.env.ENCRYPTION_KEY=randomBytes(32).toString('base64');
  const {ingestInbound, mergeCustomers, linkIdentityToCustomer, listIdentities}=await import('../server/channels.mjs');
  const db=new PGlite();
  try{
    await db.exec(await readFile(new URL('../database/001_initial.sql',import.meta.url),'utf8'));
    await db.exec(await readFile(new URL('../database/002_channels.sql',import.meta.url),'utf8'));
    await db.exec(await readFile(new URL('../database/003_identity_enrichment.sql',import.meta.url),'utf8'));
    await db.query('INSERT INTO workspaces(id,slug,name,owner_email) VALUES($1,$2,$3,$4)',[A,'a','A','a@example.com']);
    await db.query('INSERT INTO users(id,google_sub,email,name) VALUES($1,$2,$3,$4)',[U,'sub','a@example.com','Owner']);
    await db.exec("SELECT set_config('app.workspace_id','"+A+"',false)");
    // Existing CRM customer with phone
    await db.query(
      `INSERT INTO customers(id,workspace_id,name,phone,phone_normalized,source) VALUES($1,$2,$3,$4,$4,$5)`,
      [C1,A,'Nguyễn Có Sẵn','0901234567','Nhập tay']
    );
    // Simulate first inbound without phone -> creates auto lead, then second with phone should match
    const first=await ingestInbound(db,{
      workspaceId:A, actorUserId:U,
      event:{provider:'meta_page',sender_id:'PSID99',message_id:'m1',text:'Chào page',timestamp:new Date()},
      pageAccessToken:null
    });
    assert.ok(first.customer_id);
    assert.notEqual(first.customer_id, C1);
    const second=await ingestInbound(db,{
      workspaceId:A, actorUserId:U,
      event:{provider:'meta_page',sender_id:'PSID99',message_id:'m2',text:'SĐT của em 0901234567',timestamp:new Date()},
      pageAccessToken:null
    });
    assert.equal(second.customer_id, C1);
    const lead=(await db.query('SELECT merged_into,phone_normalized FROM customers WHERE id=$1',[first.customer_id])).rows[0];
    assert.equal(lead.merged_into, C1);
    assert.equal(lead.phone_normalized, null);
    const ids=await listIdentities(db,A,C1);
    assert.equal(ids.length,1);
    assert.equal(ids[0].external_user_id,'PSID99');
  }finally{await db.close()}
});

test('manual merge moves identities messages activities and keeps audit trail on keep profile', async () => {
  process.env.ENCRYPTION_KEY=randomBytes(32).toString('base64');
  const {mergeCustomers, listIdentities, listMessages}=await import('../server/channels.mjs');
  const db=new PGlite();
  try{
    await db.exec(await readFile(new URL('../database/001_initial.sql',import.meta.url),'utf8'));
    await db.exec(await readFile(new URL('../database/002_channels.sql',import.meta.url),'utf8'));
    await db.exec(await readFile(new URL('../database/003_identity_enrichment.sql',import.meta.url),'utf8'));
    await db.query('INSERT INTO workspaces(id,slug,name,owner_email) VALUES($1,$2,$3,$4)',[A,'a','A','a@example.com']);
    await db.query('INSERT INTO users(id,google_sub,email,name) VALUES($1,$2,$3,$4)',[U,'sub','a@example.com','Owner']);
    await db.exec("SELECT set_config('app.workspace_id','"+A+"',false)");
    await db.query(`INSERT INTO customers(id,workspace_id,name,phone,phone_normalized,source,avatar_url) VALUES
      ($1,$2,'Giữ lại','0901111111','0901111111','Nhập tay',''),
      ($3,$2,'Trùng','','','Facebook Page','https://example.com/a.jpg')`,[C1,A,C2]);
    await db.query(`INSERT INTO channel_identities(id,workspace_id,customer_id,provider,external_user_id,profile_name,avatar_url)
      VALUES($1,$2,$3,'zalo_oa','ZUID1','Zalo User','https://example.com/z.jpg')`,[I1,A,C2]);
    await db.query(`INSERT INTO channel_messages(id,workspace_id,customer_id,identity_id,provider,direction,body)
      VALUES($1,$2,$3,$4,'zalo_oa','inbound','Xin chào OA')`,
      ['eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',A,C2,I1]);
    await db.query(`INSERT INTO activities(id,workspace_id,customer_id,user_id,kind,note)
      VALUES($1,$2,$3,$4,'message','cũ')`,
      ['ffffffff-ffff-4fff-8fff-ffffffffffff',A,C2,U]);
    await mergeCustomers(db,{workspaceId:A,userId:U,keepId:C1,mergeId:C2});
    const ids=await listIdentities(db,A,C1);
    assert.equal(ids.length,1);
    assert.equal(ids[0].provider,'zalo_oa');
    const msgs=await listMessages(db,A,C1);
    assert.equal(msgs.length,1);
    const keep=(await db.query('SELECT avatar_url,name FROM customers WHERE id=$1',[C1])).rows[0];
    assert.equal(keep.avatar_url,'https://example.com/a.jpg');
    const merged=(await db.query('SELECT merged_into,phone_normalized FROM customers WHERE id=$1',[C2])).rows[0];
    assert.equal(merged.merged_into,C1);
    assert.equal(merged.phone_normalized,null);
    const acts=(await db.query('SELECT note FROM activities WHERE customer_id=$1 ORDER BY created_at',[C1])).rows;
    assert.ok(acts.some(a=>a.note.includes('Gộp hồ sơ')||a.note==='cũ'));
  }finally{await db.close()}
});

test('linkIdentityToCustomer moves conversation and soft-merges empty channel lead', async () => {
  process.env.ENCRYPTION_KEY=randomBytes(32).toString('base64');
  const {linkIdentityToCustomer, listIdentities}=await import('../server/channels.mjs');
  const db=new PGlite();
  try{
    await db.exec(await readFile(new URL('../database/001_initial.sql',import.meta.url),'utf8'));
    await db.exec(await readFile(new URL('../database/002_channels.sql',import.meta.url),'utf8'));
    await db.exec(await readFile(new URL('../database/003_identity_enrichment.sql',import.meta.url),'utf8'));
    await db.query('INSERT INTO workspaces(id,slug,name,owner_email) VALUES($1,$2,$3,$4)',[A,'a','A','a@example.com']);
    await db.query('INSERT INTO users(id,google_sub,email,name) VALUES($1,$2,$3,$4)',[U,'sub','a@example.com','Owner']);
    await db.exec("SELECT set_config('app.workspace_id','"+A+"',false)");
    await db.query(`INSERT INTO customers(id,workspace_id,name,phone,phone_normalized,source,notes) VALUES
      ($1,$2,'Khách thật','0912222333','0912222333','Giới thiệu',''),
      ($3,$2,'Khách Messenger','','','Facebook Page','Đồng bộ từ kênh Facebook Page')`,[C1,A,C2]);
    await db.query(`INSERT INTO channel_identities(id,workspace_id,customer_id,provider,external_user_id,profile_name)
      VALUES($1,$2,$3,'meta_page','PSID1','Lead FB')`,[I1,A,C2]);
    const out=await linkIdentityToCustomer(db,{workspaceId:A,userId:U,targetCustomerId:C1,fromCustomerId:C2});
    assert.equal(out.identity.customer_id,C1);
    assert.equal((await listIdentities(db,A,C1)).length,1);
    assert.equal((await db.query('SELECT merged_into FROM customers WHERE id=$1',[C2])).rows[0].merged_into,C1);
  }finally{await db.close()}
});
