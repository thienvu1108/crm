import {randomUUID} from 'node:crypto';
import {encrypt, decrypt} from './security.mjs';
import {fetchUserProfile, sendMetaText, secretsPayload as metaSecrets} from './meta.mjs';
import {sendZaloText, refreshZaloToken, secretsPayload as zaloSecrets} from './zalo.mjs';

const fail=(message,status=400)=>Object.assign(Error(message),{status});
const encKey=()=>process.env.ENCRYPTION_KEY;

export function publicChannel(row){
 if(!row)return null;
 return {
  id:row.id,
  provider:row.provider==='meta_page'?'facebook':row.provider==='zalo_oa'?'zalo':row.provider,
  channel_provider:row.provider,
  external_id:row.external_id,
  display_name:row.display_name,
  status:row.status,
  metadata:{
   webhook_ready:!!row.metadata?.webhook_ready,
   verify_token_hint:row.metadata?.verify_token_hint||null,
   connected_at:row.metadata?.connected_at||row.created_at
  }
 };
}

export async function listChannels(db, workspaceId){
 const rows=(await db.query(
  'SELECT id,provider,external_id,display_name,status,metadata,created_at FROM channel_connections WHERE workspace_id=$1 ORDER BY provider',
  [workspaceId]
 )).rows;
 return rows.map(publicChannel);
}

export async function resolveRoute(pool, provider, externalId){
 return (await pool.query(
  'SELECT workspace_id FROM channel_routes WHERE provider=$1 AND external_id=$2 LIMIT 1',
  [provider, String(externalId)]
 )).rows[0]||null;
}

export async function upsertChannel(db, pool, {workspaceId, userId, provider, externalId, displayName, secrets, metadata={}}){
 const id=randomUUID();
 const encrypted=encrypt(secrets, encKey());
 const meta={...metadata, connected_at:new Date().toISOString(), webhook_ready:true};
 if(provider==='meta_page'&&secrets.verify_token)meta.verify_token_hint=String(secrets.verify_token).slice(0,4)+'…';
 // Ensure external id is not claimed by another workspace.
 const claimed=(await pool.query(
  'SELECT workspace_id FROM channel_routes WHERE provider=$1 AND external_id=$2 AND workspace_id<>$3',
  [provider, String(externalId), workspaceId]
 )).rows[0];
 if(claimed)throw fail('Fanpage/OA này đã được gắn với không gian khác.',409);
 const r=await db.query(
  `INSERT INTO channel_connections(id,workspace_id,provider,external_id,display_name,encrypted_secrets,metadata,status,connected_by)
   VALUES($1,$2,$3,$4,$5,$6,$7,'connected',$8)
   ON CONFLICT(workspace_id,provider) DO UPDATE SET
    external_id=EXCLUDED.external_id,
    display_name=EXCLUDED.display_name,
    encrypted_secrets=EXCLUDED.encrypted_secrets,
    metadata=EXCLUDED.metadata,
    status='connected',
    connected_by=EXCLUDED.connected_by,
    updated_at=now()
   RETURNING id,provider,external_id,display_name,status,metadata,created_at`,
  [id, workspaceId, provider, String(externalId), displayName||'', encrypted, meta, userId]
 );
 await pool.query(
  `INSERT INTO channel_routes(provider,external_id,workspace_id) VALUES($1,$2,$3)
   ON CONFLICT(provider,external_id) DO UPDATE SET workspace_id=EXCLUDED.workspace_id`,
  [provider, String(externalId), workspaceId]
 );
 // Drop stale route if external_id changed for this workspace+provider.
 await pool.query(
  `DELETE FROM channel_routes WHERE workspace_id=$1 AND provider=$2 AND external_id<>$3`,
  [workspaceId, provider, String(externalId)]
 );
 return publicChannel(r.rows[0]);
}

export async function disconnectChannel(db, pool, workspaceId, provider){
 const existing=(await db.query(
  'SELECT external_id FROM channel_connections WHERE workspace_id=$1 AND provider=$2',
  [workspaceId, provider]
 )).rows[0];
 await db.query('DELETE FROM channel_connections WHERE workspace_id=$1 AND provider=$2',[workspaceId, provider]);
 if(existing)await pool.query('DELETE FROM channel_routes WHERE provider=$1 AND external_id=$2',[provider, existing.external_id]);
 return true;
}

export function readSecrets(row){
 return decrypt(row.encrypted_secrets, encKey());
}

export async function loadChannel(db, workspaceId, provider){
 return (await db.query(
  'SELECT * FROM channel_connections WHERE workspace_id=$1 AND provider=$2 AND status=$3',
  [workspaceId, provider, 'connected']
 )).rows[0]||null;
}

export async function ensureZaloAccessToken(db, row){
 let secrets=readSecrets(row);
 if(secrets.expires_at&&secrets.expires_at>Date.now()+120000)return secrets.access_token;
 if(!secrets.refresh_token)throw fail('Token Zalo đã hết hạn. Hãy kết nối lại OA.',401);
 const next=await refreshZaloToken(secrets.refresh_token);
 secrets={...secrets, ...next};
 await db.query(
  'UPDATE channel_connections SET encrypted_secrets=$1, updated_at=now() WHERE id=$2',
  [encrypt(secrets, encKey()), row.id]
 );
 return secrets.access_token;
}

async function findOrCreateCustomer(db, {workspaceId, provider, senderId, profileName, source}){
 const identityProvider=provider==='instagram'?'instagram':provider;
 let identity=(await db.query(
  'SELECT * FROM channel_identities WHERE workspace_id=$1 AND provider=$2 AND external_user_id=$3 FOR UPDATE',
  [workspaceId, identityProvider, senderId]
 )).rows[0];
 if(identity){
  await db.query(
   "UPDATE channel_identities SET last_inbound_at=now(), profile_name=COALESCE(NULLIF($1,''), profile_name) WHERE id=$2",
   [profileName||'', identity.id]
  );
  return identity;
 }
 const customerId=randomUUID();
 const name=(profileName||'').trim()||(provider==='zalo_oa'?'Khách Zalo OA':provider==='instagram'?'Khách Instagram':'Khách Messenger');
 await db.query(
  `INSERT INTO customers(id,workspace_id,name,phone,phone_normalized,email,source,interest,stage,budget,area,need,notes)
   VALUES($1,$2,$3,'',NULL,'',$4,'unknown','new',0,'','',$5)`,
  [customerId, workspaceId, name.slice(0,120), source, 'Đồng bộ từ kênh '+source]
 );
 const identityId=randomUUID();
 identity=(await db.query(
  `INSERT INTO channel_identities(id,workspace_id,customer_id,provider,external_user_id,profile_name,last_inbound_at)
   VALUES($1,$2,$3,$4,$5,$6,now()) RETURNING *`,
  [identityId, workspaceId, customerId, identityProvider, senderId, name.slice(0,200)]
 )).rows[0];
 return identity;
}

export async function ingestInbound(db, {workspaceId, actorUserId, event, pageAccessToken}){
 if(!event.sender_id)return null;
 let profileName='';
 if((event.provider==='meta_page'||event.provider==='instagram')&&pageAccessToken){
  const profile=await fetchUserProfile(event.sender_id, pageAccessToken);
  profileName=profile.name;
 }
 const source=event.provider==='zalo_oa'?'Zalo OA':event.provider==='instagram'?'Instagram':'Facebook Page';
 const provider=event.provider==='instagram'?'instagram':event.provider;
 const identity=await findOrCreateCustomer(db,{
  workspaceId, provider, senderId:event.sender_id, profileName, source
 });
 if(event.message_id){
  const exists=(await db.query(
   'SELECT 1 FROM channel_messages WHERE workspace_id=$1 AND provider=$2 AND external_message_id=$3',
   [workspaceId, provider, event.message_id]
  )).rowCount;
  if(exists)return {duplicate:true, customer_id:identity.customer_id};
 }
 const messageId=randomUUID();
 await db.query(
  `INSERT INTO channel_messages(id,workspace_id,customer_id,identity_id,provider,direction,external_message_id,body,payload,created_at)
   VALUES($1,$2,$3,$4,$5,'inbound',$6,$7,$8,$9)`,
  [messageId, workspaceId, identity.customer_id, identity.id, provider, event.message_id||null,
   String(event.text||'').slice(0,5000), event.raw||{}, event.timestamp||new Date()]
 );
 const note='['+source+'] '+String(event.text||'').slice(0,480);
 await db.query(
  'INSERT INTO activities(id,workspace_id,customer_id,user_id,kind,note) VALUES($1,$2,$3,$4,$5,$6)',
  [randomUUID(), workspaceId, identity.customer_id, actorUserId, 'message', note]
 );
 await db.query(
  'UPDATE customers SET last_contact=$1, updated_at=now() WHERE id=$2 AND workspace_id=$3',
  [event.timestamp||new Date(), identity.customer_id, workspaceId]
 );
 return {customer_id:identity.customer_id, message_id:messageId};
}

export async function listMessages(db, workspaceId, customerId, limit=100){
 return (await db.query(
  `SELECT id,provider,direction,body,external_message_id,sent_by,created_at
   FROM channel_messages WHERE workspace_id=$1 AND customer_id=$2
   ORDER BY created_at ASC LIMIT $3`,
  [workspaceId, customerId, limit]
 )).rows;
}

export async function sendReply(db, {workspaceId, userId, customerId, text}){
 const identities=(await db.query(
  'SELECT * FROM channel_identities WHERE workspace_id=$1 AND customer_id=$2 ORDER BY last_inbound_at DESC NULLS LAST',
  [workspaceId, customerId]
 )).rows;
 if(!identities.length)throw fail('Khách này chưa có hội thoại Fanpage/Zalo OA.',404);
 const identity=identities[0];
 const channelProvider=identity.provider==='instagram'?'meta_page':identity.provider;
 const channel=(await db.query(
  'SELECT * FROM channel_connections WHERE workspace_id=$1 AND provider=$2 AND status=$3 FOR UPDATE',
  [workspaceId, channelProvider, 'connected']
 )).rows[0];
 if(!channel)throw fail('Chưa kết nối kênh tương ứng. Hãy mở Kết nối kênh.',400);

 const lastIn=identity.last_inbound_at?new Date(identity.last_inbound_at).getTime():0;
 const ageMs=Date.now()-lastIn;
 if(channelProvider==='meta_page'&&lastIn&&ageMs>24*3600*1000){
  throw fail('Đã quá khung 24 giờ Messenger. Chỉ trả lời được khi khách nhắn lại.',400);
 }
 if(channelProvider==='zalo_oa'&&lastIn&&ageMs>7*24*3600*1000){
  throw fail('Đã quá khung 7 ngày Zalo OA OpenAPI. Chỉ trả lời được khi khách nhắn lại.',400);
 }

 let externalMessageId=null;
 const secrets=readSecrets(channel);
 if(channelProvider==='meta_page'){
  const sent=await sendMetaText({
   pageAccessToken:secrets.page_access_token,
   recipientId:identity.external_user_id,
   text
  });
  externalMessageId=sent.message_id;
 }else{
  const token=await ensureZaloAccessToken(db, channel);
  const sent=await sendZaloText({accessToken:token, userId:identity.external_user_id, text});
  externalMessageId=sent.message_id;
 }

 const messageId=randomUUID();
 const provider=identity.provider;
 await db.query(
  `INSERT INTO channel_messages(id,workspace_id,customer_id,identity_id,provider,direction,external_message_id,body,sent_by)
   VALUES($1,$2,$3,$4,$5,'outbound',$6,$7,$8)`,
  [messageId, workspaceId, customerId, identity.id, provider, externalMessageId, text.trim().slice(0,5000), userId]
 );
 const label=provider==='zalo_oa'?'Zalo OA':provider==='instagram'?'Instagram':'Facebook Page';
 await db.query(
  'INSERT INTO activities(id,workspace_id,customer_id,user_id,kind,note) VALUES($1,$2,$3,$4,$5,$6)',
  [randomUUID(), workspaceId, customerId, userId, 'message', '['+label+' · gửi] '+text.trim().slice(0,450)]
 );
 await db.query(
  'UPDATE customers SET last_contact=now(), updated_at=now() WHERE id=$1 AND workspace_id=$2',
  [customerId, workspaceId]
 );
 return {id:messageId, external_message_id:externalMessageId, provider};
}

export {metaSecrets, zaloSecrets};
