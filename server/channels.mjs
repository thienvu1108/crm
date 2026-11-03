import {randomUUID} from 'node:crypto';
import {encrypt, decrypt, normalizePhone, extractPhones} from './security.mjs';
import {fetchUserProfile, sendMetaText, secretsPayload as metaSecrets} from './meta.mjs';
import {sendZaloText, refreshZaloToken, fetchZaloUserDetail, secretsPayload as zaloSecrets} from './zalo.mjs';

const fail=(message,status=400)=>Object.assign(Error(message),{status});
const encKey=()=>process.env.ENCRYPTION_KEY;
const channelLabel=p=>p==='zalo_oa'?'Zalo OA':p==='instagram'?'Instagram':'Facebook Page';
const sourceOf=p=>channelLabel(p);

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

export function publicIdentity(row){
 return {
  id:row.id,
  provider:row.provider,
  external_user_id:row.external_user_id,
  profile_name:row.profile_name||'',
  avatar_url:row.avatar_url||'',
  last_inbound_at:row.last_inbound_at,
  customer_id:row.customer_id,
  label:channelLabel(row.provider)
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

function isAutoChannelLead(customer){
 if(!customer||customer.merged_into)return false;
 const sources=new Set(['Facebook Page','Zalo OA','Instagram']);
 if(!sources.has(customer.source))return false;
 const notes=String(customer.notes||'');
 const looksSynced=!notes||notes.startsWith('Đồng bộ từ kênh');
 const noBudget=!Number(customer.budget);
 const earlyStage=['new','consulting'].includes(customer.stage);
 return looksSynced&&noBudget&&earlyStage;
}

async function findCustomerByPhone(db, workspaceId, phoneNormalized){
 if(!phoneNormalized)return null;
 return (await db.query(
  'SELECT * FROM customers WHERE workspace_id=$1 AND phone_normalized=$2 AND merged_into IS NULL LIMIT 1 FOR UPDATE',
  [workspaceId, phoneNormalized]
 )).rows[0]||null;
}

async function enrichCustomerProfile(db, customer, {name, avatar, phoneNormalized, phoneDisplay}){
 const patch=[];
 const vals=[customer.id, customer.workspace_id];
 let i=3;
 if(name&&(!customer.name||/^Khách (Messenger|Zalo OA|Instagram)$/.test(customer.name))){
  patch.push('name=$'+i++); vals.push(name.slice(0,120));
 }
 if(avatar&&!customer.avatar_url){
  patch.push('avatar_url=$'+i++); vals.push(String(avatar).slice(0,2000));
 }
 if(phoneNormalized&&!customer.phone_normalized){
  patch.push('phone=$'+i++); vals.push((phoneDisplay||phoneNormalized).slice(0,24));
  patch.push('phone_normalized=$'+i++); vals.push(phoneNormalized);
 }
 if(!patch.length)return customer;
 const r=await db.query(
  'UPDATE customers SET '+patch.join(',')+', updated_at=now() WHERE id=$1 AND workspace_id=$2 RETURNING *',
  vals
 );
 return r.rows[0]||customer;
}

async function createMergeSuggestion(db, {workspaceId, sourceId, targetId, identityId, reason, detail, actorUserId}){
 if(sourceId===targetId)return null;
 const existing=(await db.query(
  `SELECT id FROM merge_suggestions
   WHERE workspace_id=$1 AND source_customer_id=$2 AND target_customer_id=$3
     AND COALESCE(identity_id,'00000000-0000-0000-0000-000000000000')=COALESCE($4::uuid,'00000000-0000-0000-0000-000000000000')
     AND status='pending'`,
  [workspaceId, sourceId, targetId, identityId||null]
 )).rows[0];
 if(existing)return existing;
 const id=randomUUID();
 await db.query(
  `INSERT INTO merge_suggestions(id,workspace_id,source_customer_id,target_customer_id,identity_id,reason,detail)
   VALUES($1,$2,$3,$4,$5,$6,$7)`,
  [id, workspaceId, sourceId, targetId, identityId||null, reason||'phone_match', (detail||'').slice(0,500)]
 );
 await db.query(
  'INSERT INTO activities(id,workspace_id,customer_id,user_id,kind,note) VALUES($1,$2,$3,$4,$5,$6)',
  [randomUUID(), workspaceId, sourceId, actorUserId, 'message',
   '[Gợi ý gộp] Khớp số điện thoại với hồ sơ khác. Kiểm tra và gộp thủ công nếu đúng cùng khách.']
 );
 await db.query(
  'INSERT INTO activities(id,workspace_id,customer_id,user_id,kind,note) VALUES($1,$2,$3,$4,$5,$6)',
  [randomUUID(), workspaceId, targetId, actorUserId, 'message',
   '[Gợi ý gộp] Có hội thoại kênh mới khớp SĐT với hồ sơ này.']
 );
 return {id};
}

async function reassignIdentity(db, identity, targetCustomerId, actorUserId, note){
 const fromId=identity.customer_id;
 if(fromId===targetCustomerId)return identity;
 await db.query(
  'UPDATE channel_identities SET customer_id=$1 WHERE id=$2 AND workspace_id=$3',
  [targetCustomerId, identity.id, identity.workspace_id]
 );
 await db.query(
  'UPDATE channel_messages SET customer_id=$1 WHERE workspace_id=$2 AND identity_id=$3',
  [targetCustomerId, identity.workspace_id, identity.id]
 );
 if(actorUserId){
  await db.query(
   'INSERT INTO activities(id,workspace_id,customer_id,user_id,kind,note) VALUES($1,$2,$3,$4,$5,$6)',
   [randomUUID(), identity.workspace_id, targetCustomerId, actorUserId, 'message',
    note||('[Gắn kênh] Đã gắn hội thoại '+channelLabel(identity.provider)+' vào hồ sơ này.')]
  );
 }
 return {...identity, customer_id:targetCustomerId};
}

async function softMergeEmptyLead(db, {workspaceId, sourceId, targetId, actorUserId}){
 // Move remaining artifacts then mark source as merged.
 await db.query('UPDATE channel_identities SET customer_id=$1 WHERE workspace_id=$2 AND customer_id=$3',[targetId, workspaceId, sourceId]);
 await db.query('UPDATE channel_messages SET customer_id=$1 WHERE workspace_id=$2 AND customer_id=$3',[targetId, workspaceId, sourceId]);
 await db.query('UPDATE activities SET customer_id=$1 WHERE workspace_id=$2 AND customer_id=$3',[targetId, workspaceId, sourceId]);
 await db.query('UPDATE tasks SET customer_id=$1 WHERE workspace_id=$2 AND customer_id=$3',[targetId, workspaceId, sourceId]);
 await db.query(
  "UPDATE customers SET merged_into=$1, phone='', phone_normalized=NULL, assigned_to=NULL, updated_at=now() WHERE id=$2 AND workspace_id=$3",
  [targetId, sourceId, workspaceId]
 );
 await db.query(
  'INSERT INTO activities(id,workspace_id,customer_id,user_id,kind,note) VALUES($1,$2,$3,$4,$5,$6)',
  [randomUUID(), workspaceId, targetId, actorUserId, 'message',
   '[Tự khớp SĐT] Đã gắn hội thoại từ lead kênh và gộp hồ sơ trống vào khách có sẵn.']
 );
}

async function findOrCreateCustomer(db, {
  workspaceId, provider, senderId, profileName, avatarUrl, phones=[], source, actorUserId
}){
 const identityProvider=provider==='instagram'?'instagram':provider;
 let identity=(await db.query(
  'SELECT * FROM channel_identities WHERE workspace_id=$1 AND provider=$2 AND external_user_id=$3 FOR UPDATE',
  [workspaceId, identityProvider, senderId]
 )).rows[0];

 const primaryPhone=phones[0]||null;

 if(identity){
  await db.query(
   `UPDATE channel_identities SET last_inbound_at=now(),
     profile_name=COALESCE(NULLIF($1,''), profile_name),
     avatar_url=COALESCE(NULLIF($2,''), avatar_url)
    WHERE id=$3`,
   [profileName||'', avatarUrl||'', identity.id]
  );
  identity={...identity, profile_name:profileName||identity.profile_name, avatar_url:avatarUrl||identity.avatar_url};

  let customer=(await db.query(
   'SELECT * FROM customers WHERE id=$1 AND workspace_id=$2 FOR UPDATE',
   [identity.customer_id, workspaceId]
  )).rows[0];
  if(customer?.merged_into){
   // Follow merge chain to active profile.
   customer=(await db.query(
    'SELECT * FROM customers WHERE id=$1 AND workspace_id=$2 FOR UPDATE',
    [customer.merged_into, workspaceId]
   )).rows[0]||customer;
   if(customer&&customer.id!==identity.customer_id){
    identity=await reassignIdentity(db, identity, customer.id, actorUserId, '[Gắn kênh] Hồ sơ cũ đã gộp; chuyển hội thoại sang hồ sơ còn hiệu lực.');
   }
  }
  if(customer){
   // Enrich name/avatar first; phone only if no other active customer owns it.
   customer=await enrichCustomerProfile(db, customer, {
    name:profileName, avatar:avatarUrl
   });
  }
  if(primaryPhone&&customer){
   const match=await findCustomerByPhone(db, workspaceId, primaryPhone);
   if(match&&match.id!==customer.id){
    if(isAutoChannelLead(customer)){
      await reassignIdentity(db, identity, match.id, actorUserId,
       '[Tự khớp SĐT] Gắn hội thoại '+channelLabel(identityProvider)+' vào khách có SĐT '+primaryPhone+'.');
      await softMergeEmptyLead(db,{workspaceId, sourceId:customer.id, targetId:match.id, actorUserId});
      identity={...identity, customer_id:match.id};
      await enrichCustomerProfile(db, match, {name:profileName, avatar:avatarUrl});
    }else{
      await createMergeSuggestion(db,{
        workspaceId, sourceId:customer.id, targetId:match.id, identityId:identity.id,
        reason:'phone_match', detail:'SĐT trong tin nhắn: '+primaryPhone, actorUserId
      });
    }
   }else if(!match){
    customer=await enrichCustomerProfile(db, customer, {
      phoneNormalized:primaryPhone, phoneDisplay:primaryPhone
    });
   }
  }
  return identity;
 }

 // New identity: prefer phone match over creating a lead.
 let target=null;
 if(primaryPhone)target=await findCustomerByPhone(db, workspaceId, primaryPhone);
 if(target){
  const identityId=randomUUID();
  const name=(profileName||target.name||'').trim()||('Khách '+channelLabel(identityProvider));
  identity=(await db.query(
   `INSERT INTO channel_identities(id,workspace_id,customer_id,provider,external_user_id,profile_name,avatar_url,last_inbound_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,now()) RETURNING *`,
   [identityId, workspaceId, target.id, identityProvider, senderId, name.slice(0,200), (avatarUrl||'').slice(0,2000)]
  )).rows[0];
  await enrichCustomerProfile(db, target, {name:profileName, avatar:avatarUrl});
  await db.query(
   'INSERT INTO activities(id,workspace_id,customer_id,user_id,kind,note) VALUES($1,$2,$3,$4,$5,$6)',
   [randomUUID(), workspaceId, target.id, actorUserId, 'message',
    '[Tự khớp SĐT] Gắn '+channelLabel(identityProvider)+' vào hồ sơ có sẵn (SĐT '+primaryPhone+').']
  );
  return identity;
 }

 const customerId=randomUUID();
 const name=(profileName||'').trim()||(provider==='zalo_oa'?'Khách Zalo OA':provider==='instagram'?'Khách Instagram':'Khách Messenger');
 await db.query(
  `INSERT INTO customers(id,workspace_id,name,phone,phone_normalized,email,source,interest,stage,budget,area,need,notes,avatar_url)
   VALUES($1,$2,$3,$4,$5,'',$6,'unknown','new',0,'','',$7,$8)`,
  [customerId, workspaceId, name.slice(0,120),
   primaryPhone||'', primaryPhone, source, 'Đồng bộ từ kênh '+source, (avatarUrl||'').slice(0,2000)]
 );
 const identityId=randomUUID();
 identity=(await db.query(
  `INSERT INTO channel_identities(id,workspace_id,customer_id,provider,external_user_id,profile_name,avatar_url,last_inbound_at)
   VALUES($1,$2,$3,$4,$5,$6,$7,now()) RETURNING *`,
  [identityId, workspaceId, customerId, identityProvider, senderId, name.slice(0,200), (avatarUrl||'').slice(0,2000)]
 )).rows[0];
 return identity;
}

export async function ingestInbound(db, {workspaceId, actorUserId, event, pageAccessToken, zaloAccessToken}){
 if(!event.sender_id)return null;
 let profileName='', avatarUrl='';
 const phones=new Set(extractPhones(event.text||''));

 if((event.provider==='meta_page'||event.provider==='instagram')&&pageAccessToken){
  const profile=await fetchUserProfile(event.sender_id, pageAccessToken);
  profileName=profile.name;
  avatarUrl=profile.avatar||profile.picture||'';
 }
 if(event.provider==='zalo_oa'&&zaloAccessToken){
  const profile=await fetchZaloUserDetail(zaloAccessToken, event.sender_id);
  profileName=profile.name||profileName;
  avatarUrl=profile.avatar||avatarUrl;
  if(profile.phone){
   const n=normalizePhone(String(profile.phone));
   if(n)phones.add(n);
  }
 }

 const source=sourceOf(event.provider==='instagram'?'instagram':event.provider);
 const provider=event.provider==='instagram'?'instagram':event.provider;
 const identity=await findOrCreateCustomer(db,{
  workspaceId, provider, senderId:event.sender_id, profileName, avatarUrl,
  phones:[...phones], source, actorUserId
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
 return {customer_id:identity.customer_id, message_id:messageId, phones:[...phones]};
}

export async function listMessages(db, workspaceId, customerId, limit=100){
 return (await db.query(
  `SELECT id,provider,direction,body,external_message_id,sent_by,created_at,identity_id
   FROM channel_messages WHERE workspace_id=$1 AND customer_id=$2
   ORDER BY created_at ASC LIMIT $3`,
  [workspaceId, customerId, limit]
 )).rows;
}

export async function listIdentities(db, workspaceId, customerId){
 const rows=(await db.query(
  `SELECT * FROM channel_identities WHERE workspace_id=$1 AND customer_id=$2
   ORDER BY last_inbound_at DESC NULLS LAST, created_at`,
  [workspaceId, customerId]
 )).rows;
 return rows.map(publicIdentity);
}

export async function listMergeSuggestions(db, workspaceId, customerId=null){
 const rows=customerId
  ?(await db.query(
    `SELECT * FROM merge_suggestions WHERE workspace_id=$1 AND status='pending'
      AND (source_customer_id=$2 OR target_customer_id=$2) ORDER BY created_at DESC`,
    [workspaceId, customerId]
   )).rows
  :(await db.query(
    `SELECT * FROM merge_suggestions WHERE workspace_id=$1 AND status='pending' ORDER BY created_at DESC LIMIT 50`,
    [workspaceId]
   )).rows;
 return rows;
}

export async function customerChannelBundle(db, workspaceId, customerId){
 const [messages, identities, suggestions]=await Promise.all([
  listMessages(db, workspaceId, customerId),
  listIdentities(db, workspaceId, customerId),
  listMergeSuggestions(db, workspaceId, customerId)
 ]);
 return {messages, identities, merge_suggestions:suggestions};
}

/** Move one identity (and its messages) onto target customer. Optionally soft-merge empty source lead. */
export async function linkIdentityToCustomer(db, {
  workspaceId, userId, targetCustomerId, identityId, fromCustomerId
}){
 const target=(await db.query(
  'SELECT * FROM customers WHERE id=$1 AND workspace_id=$2 AND merged_into IS NULL FOR UPDATE',
  [targetCustomerId, workspaceId]
 )).rows[0];
 if(!target)throw fail('Không tìm thấy khách đích.',404);

 let identity;
 if(identityId){
  identity=(await db.query(
   'SELECT * FROM channel_identities WHERE id=$1 AND workspace_id=$2 FOR UPDATE',[identityId, workspaceId]
  )).rows[0];
 }else if(fromCustomerId){
  identity=(await db.query(
   `SELECT * FROM channel_identities WHERE workspace_id=$1 AND customer_id=$2
    ORDER BY last_inbound_at DESC NULLS LAST LIMIT 1 FOR UPDATE`,
   [workspaceId, fromCustomerId]
  )).rows[0];
 }
 if(!identity)throw fail('Không tìm thấy hội thoại kênh để gắn.',404);
 if(identity.customer_id===targetCustomerId)return {ok:true, identity:publicIdentity(identity)};

 const sourceId=identity.customer_id;
 const source=(await db.query(
  'SELECT * FROM customers WHERE id=$1 AND workspace_id=$2 FOR UPDATE',[sourceId, workspaceId]
 )).rows[0];

 identity=await reassignIdentity(db, identity, targetCustomerId, userId,
  '[Gắn thủ công] Đã gắn hội thoại '+channelLabel(identity.provider)+' vào hồ sơ này.');

 // Prefer filling empty fields on target from source identity/profile.
 await enrichCustomerProfile(db, target, {
  name:identity.profile_name, avatar:identity.avatar_url,
  phoneNormalized:source?.phone_normalized||null, phoneDisplay:source?.phone||null
 });

 if(source&&isAutoChannelLead(source)){
  const leftover=(await db.query(
   'SELECT 1 FROM channel_identities WHERE workspace_id=$1 AND customer_id=$2 LIMIT 1',
   [workspaceId, sourceId]
  )).rowCount;
  if(!leftover)await softMergeEmptyLead(db,{workspaceId, sourceId, targetId:targetCustomerId, actorUserId:userId});
 }

 await db.query(
  `UPDATE merge_suggestions SET status='accepted', resolved_at=now(), resolved_by=$1
   WHERE workspace_id=$2 AND status='pending' AND identity_id=$3`,
  [userId, workspaceId, identity.id]
 );
 return {ok:true, identity:publicIdentity(identity), merged_source:source&&isAutoChannelLead(source)?sourceId:null};
}

/** Merge mergeId into keepId: move identities, messages, activities, tasks; soft-delete mergeId. */
export async function mergeCustomers(db, {workspaceId, userId, keepId, mergeId}){
 if(keepId===mergeId)throw fail('Hai hồ sơ trùng nhau.',400);
 const keep=(await db.query(
  'SELECT * FROM customers WHERE id=$1 AND workspace_id=$2 AND merged_into IS NULL FOR UPDATE',[keepId, workspaceId]
 )).rows[0];
 const other=(await db.query(
  'SELECT * FROM customers WHERE id=$1 AND workspace_id=$2 AND merged_into IS NULL FOR UPDATE',[mergeId, workspaceId]
 )).rows[0];
 if(!keep||!other)throw fail('Không tìm thấy một trong hai hồ sơ (hoặc đã gộp).',404);

 // Phone unique: if both have different phones, keep keep's; if keep empty take other's.
 if(!keep.phone_normalized&&other.phone_normalized){
  await db.query(
   'UPDATE customers SET phone=$1, phone_normalized=$2, updated_at=now() WHERE id=$3 AND workspace_id=$4',
   [other.phone, other.phone_normalized, keepId, workspaceId]
  );
 }
 if((!keep.name||/^Khách /.test(keep.name))&&other.name){
  await db.query('UPDATE customers SET name=$1 WHERE id=$2 AND workspace_id=$3',[other.name.slice(0,120), keepId, workspaceId]);
 }
 if(!keep.avatar_url&&other.avatar_url){
  await db.query('UPDATE customers SET avatar_url=$1 WHERE id=$2 AND workspace_id=$3',[other.avatar_url, keepId, workspaceId]);
 }
 // Merge notes
 if(other.notes&&other.notes!==keep.notes){
  const notes=((keep.notes||'')+'\n---\n'+(other.notes||'')).trim().slice(0,5000);
  await db.query('UPDATE customers SET notes=$1 WHERE id=$2 AND workspace_id=$3',[notes, keepId, workspaceId]);
 }

 await db.query('UPDATE channel_identities SET customer_id=$1 WHERE workspace_id=$2 AND customer_id=$3',[keepId, workspaceId, mergeId]);
 await db.query('UPDATE channel_messages SET customer_id=$1 WHERE workspace_id=$2 AND customer_id=$3',[keepId, workspaceId, mergeId]);
 await db.query('UPDATE activities SET customer_id=$1 WHERE workspace_id=$2 AND customer_id=$3',[keepId, workspaceId, mergeId]);
 await db.query('UPDATE tasks SET customer_id=$1 WHERE workspace_id=$2 AND customer_id=$3',[keepId, workspaceId, mergeId]);
 await db.query(
  `UPDATE merge_suggestions SET status='accepted', resolved_at=now(), resolved_by=$1
   WHERE workspace_id=$2 AND status='pending'
     AND ((source_customer_id=$3 AND target_customer_id=$4) OR (source_customer_id=$4 AND target_customer_id=$3))`,
  [userId, workspaceId, mergeId, keepId]
 );
 await db.query(
  "UPDATE customers SET merged_into=$1, phone='', phone_normalized=NULL, assigned_to=NULL, updated_at=now() WHERE id=$2 AND workspace_id=$3",
  [keepId, mergeId, workspaceId]
 );
 await db.query(
  'INSERT INTO activities(id,workspace_id,customer_id,user_id,kind,note) VALUES($1,$2,$3,$4,$5,$6)',
  [randomUUID(), workspaceId, keepId, userId, 'meeting',
   '[Gộp hồ sơ] Đã gộp "'+(other.name||mergeId)+'" vào hồ sơ này. Lịch sử tin nhắn, kênh và chăm sóc được giữ lại.']
 );
 return {ok:true, keep_id:keepId, merged_id:mergeId};
}

export async function resolveMergeSuggestion(db, {workspaceId, userId, suggestionId, accept}){
 const s=(await db.query(
  'SELECT * FROM merge_suggestions WHERE id=$1 AND workspace_id=$2 AND status=$3 FOR UPDATE',
  [suggestionId, workspaceId, 'pending']
 )).rows[0];
 if(!s)throw fail('Gợi ý gộp không còn hiệu lực.',404);
 if(!accept){
  await db.query(
   `UPDATE merge_suggestions SET status='dismissed', resolved_at=now(), resolved_by=$1 WHERE id=$2`,
   [userId, suggestionId]
  );
  return {ok:true, status:'dismissed'};
 }
 // Prefer keep = target (existing phone match), merge = source (channel lead)
 const result=await mergeCustomers(db,{
  workspaceId, userId, keepId:s.target_customer_id, mergeId:s.source_customer_id
 });
 return {...result, status:'accepted'};
}

export async function sendReply(db, {workspaceId, userId, customerId, text, identityId}){
 let identities;
 if(identityId){
  identities=(await db.query(
   'SELECT * FROM channel_identities WHERE workspace_id=$1 AND customer_id=$2 AND id=$3',
   [workspaceId, customerId, identityId]
  )).rows;
 }else{
  identities=(await db.query(
   'SELECT * FROM channel_identities WHERE workspace_id=$1 AND customer_id=$2 ORDER BY last_inbound_at DESC NULLS LAST',
   [workspaceId, customerId]
  )).rows;
 }
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
 const label=channelLabel(provider);
 await db.query(
  'INSERT INTO activities(id,workspace_id,customer_id,user_id,kind,note) VALUES($1,$2,$3,$4,$5,$6)',
  [randomUUID(), workspaceId, customerId, userId, 'message', '['+label+' · gửi] '+text.trim().slice(0,450)]
 );
 await db.query(
  'UPDATE customers SET last_contact=now(), updated_at=now() WHERE id=$1 AND workspace_id=$2',
  [customerId, workspaceId]
 );
 return {id:messageId, external_message_id:externalMessageId, provider, identity_id:identity.id};
}

export {metaSecrets, zaloSecrets, extractPhones, isAutoChannelLead};
