import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac, createHash, randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {encrypt, decrypt} from '../server/security.mjs';
import {verifyMetaSignature, verifyMetaChallenge, parseMetaWebhook, secretsPayload as metaSecrets} from '../server/meta.mjs';
import {verifyZaloMac, parseZaloWebhook, zaloCodeVerifier, zaloCodeChallenge, secretsPayload as zaloSecrets} from '../server/zalo.mjs';

test('Meta webhook signature verifies raw body and rejects tampering', () => {
  const secret='test-app-secret';
  const raw=Buffer.from('{"object":"page","entry":[]}','utf8');
  const sig='sha256='+createHmac('sha256',secret).update(raw).digest('hex');
  assert.equal(verifyMetaSignature(raw,sig,secret),true);
  assert.equal(verifyMetaSignature(raw,'sha256=deadbeef',secret),false);
  assert.equal(verifyMetaSignature(Buffer.from('{"object":"page"}'),sig,secret),false);
});

test('Meta verify challenge requires matching verify token', () => {
  const q=new URLSearchParams({
    'hub.mode':'subscribe',
    'hub.verify_token':'crm-verify',
    'hub.challenge':'12345'
  });
  assert.equal(verifyMetaChallenge(q,'crm-verify'),'12345');
  assert.equal(verifyMetaChallenge(q,'other'),null);
});

test('Meta webhook parser skips echoes and maps Instagram object', () => {
  const events=parseMetaWebhook({
    object:'page',
    entry:[{id:'PAGE1',messaging:[
      {sender:{id:'PSID1'},recipient:{id:'PAGE1'},timestamp:1_700_000_000_000,message:{mid:'m1',text:'Xin chào'}},
      {sender:{id:'PAGE1'},recipient:{id:'PSID1'},message:{mid:'m2',text:'echo',is_echo:true}}
    ]}]
  });
  assert.equal(events.length,1);
  assert.equal(events[0].sender_id,'PSID1');
  assert.equal(events[0].text,'Xin chào');
  const ig=parseMetaWebhook({object:'instagram',entry:[{id:'IG1',messaging:[{sender:{id:'U1'},message:{mid:'m3',text:'hi'}}]}]});
  assert.equal(ig[0].provider,'instagram');
});

test('Zalo webhook MAC uses appId + rawBody + timestamp + OA secret', () => {
  const appId='123', oaSecret='oa-secret', timestamp='1700000000000';
  const raw='{"event_name":"user_send_text","message":{"text":"hi","msg_id":"1"},"sender":{"id":"u1"},"recipient":{"id":"oa1"},"timestamp":"1700000000000"}';
  const mac=createHash('sha256').update(appId+raw+timestamp+oaSecret).digest('hex');
  assert.equal(verifyZaloMac({appId,rawBody:raw,timestamp,oaSecret,signatureHeader:'mac='+mac}),true);
  assert.equal(verifyZaloMac({appId,rawBody:raw,timestamp,oaSecret,signatureHeader:'mac=00'}),false);
});

test('Zalo parser only accepts user_send_* events', () => {
  const ok=parseZaloWebhook({event_name:'user_send_text',sender:{id:'u1'},recipient:{id:'oa1'},message:{text:'Chào OA',msg_id:'msg1'},timestamp:'1'});
  assert.equal(ok.length,1);
  assert.equal(ok[0].oa_id,'oa1');
  assert.equal(parseZaloWebhook({event_name:'oa_send_text',sender:{id:'oa1'},recipient:{id:'u1'},message:{text:'x'}}).length,0);
});

test('Zalo PKCE verifier length and challenge are deterministic for a verifier', () => {
  const v=zaloCodeVerifier();
  assert.equal(v.length,43);
  assert.match(v,/^[A-Za-z0-9]+$/);
  assert.equal(zaloCodeChallenge(v), createHash('sha256').update(v,'ascii').digest('base64url'));
});

test('channel secrets round-trip through AES encryption helpers', () => {
  const key=randomBytes(32).toString('base64');
  const meta=metaSecrets({page_access_token:'PAT',page_id:'1',verify_token:'vt'});
  const enc=encrypt(meta,key);
  assert.deepEqual(decrypt(enc,key),meta);
  const zalo=zaloSecrets({access_token:'a',refresh_token:'r',expires_at:123,oa_secret:'s',oa_id:'9'});
  assert.equal(decrypt(encrypt(zalo,key),key).refresh_token,'r');
});

test('channel tables honor workspace RLS and route map is globally readable for webhooks', async () => {
  const db=new PGlite();
  const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
  const U='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  try{
    await db.exec(await readFile(new URL('../database/001_initial.sql',import.meta.url),'utf8'));
    await db.exec(await readFile(new URL('../database/002_channels.sql',import.meta.url),'utf8'));
    await db.exec(await readFile(new URL('../database/002_channels.sql',import.meta.url),'utf8')); // idempotent
    await db.query('INSERT INTO workspaces(id,slug,name,owner_email) VALUES($1,$2,$3,$4),($5,$6,$7,$8)',[A,'a','A','a@example.com',B,'b','B','b@example.com']);
    await db.query('INSERT INTO users(id,google_sub,email,name) VALUES($1,$2,$3,$4)',[U,'sub','a@example.com','A']);
    await db.exec('CREATE ROLE crm_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS; GRANT USAGE ON SCHEMA public TO crm_runtime; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO crm_runtime; SET ROLE crm_runtime;');
    async function scoped(id,fn){await db.exec('BEGIN');try{await db.query("SELECT set_config('app.workspace_id',$1,true)",[id]);const out=await fn();await db.exec('COMMIT');return out}catch(e){await db.exec('ROLLBACK');throw e}}
    const key=randomBytes(32).toString('base64');
    const secrets=encrypt(metaSecrets({page_access_token:'t',page_id:'PAGE_A',verify_token:'v'}),key);
    await scoped(A,()=>db.query(
      `INSERT INTO channel_connections(id,workspace_id,provider,external_id,display_name,encrypted_secrets,connected_by)
       VALUES($1,$2,'meta_page','PAGE_A','Page A',$3,$4)`,
      ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',A,secrets,U]
    ));
    await db.query(`INSERT INTO channel_routes(provider,external_id,workspace_id) VALUES('meta_page','PAGE_A',$1)`,[A]);
    const visible=await scoped(A,()=>db.query('SELECT external_id FROM channel_connections'));
    assert.equal(visible.rows.length,1);
    const hidden=await scoped(B,()=>db.query('SELECT external_id FROM channel_connections'));
    assert.equal(hidden.rows.length,0);
    // Routes remain visible without workspace GUC for webhook routing.
    const route=await db.query(`SELECT workspace_id FROM channel_routes WHERE provider='meta_page' AND external_id='PAGE_A'`);
    assert.equal(route.rows[0].workspace_id,A);
    await scoped(A,async()=>{
      await db.query(`INSERT INTO customers(id,workspace_id,name,source) VALUES($1,$2,$3,$4)`,['cccccccc-cccc-4ccc-8ccc-cccccccccccc',A,'Khách FB','Facebook Page']);
      await db.query(`INSERT INTO channel_identities(id,workspace_id,customer_id,provider,external_user_id,profile_name) VALUES($1,$2,$3,'meta_page',$4,$5)`,
        ['dddddddd-dddd-4ddd-8ddd-dddddddddddd',A,'cccccccc-cccc-4ccc-8ccc-cccccccccccc','PSID1','Khách FB']);
      await db.query(`INSERT INTO channel_messages(id,workspace_id,customer_id,provider,direction,body) VALUES($1,$2,$3,'meta_page','inbound',$4)`,
        ['eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',A,'cccccccc-cccc-4ccc-8ccc-cccccccccccc','Xin chào']);
    });
    const msgsB=await scoped(B,()=>db.query('SELECT * FROM channel_messages'));
    assert.equal(msgsB.rows.length,0);
  }finally{await db.close()}
});
