import {createHmac, timingSafeEqual, randomBytes} from 'node:crypto';

const GRAPH='https://graph.facebook.com/v21.0';
const fail=(message,status=400)=>Object.assign(Error(message),{status});

export function metaConfigured(){
 return !!(process.env.META_APP_ID&&process.env.META_APP_SECRET);
}

export function metaVerifyToken(){
 return process.env.META_WEBHOOK_VERIFY_TOKEN||'';
}

export function verifyMetaSignature(rawBody, signatureHeader, appSecret){
 if(!appSecret||!signatureHeader)return false;
 const expected='sha256='+createHmac('sha256',appSecret).update(rawBody).digest('hex');
 const a=Buffer.from(expected),b=Buffer.from(String(signatureHeader));
 return a.length===b.length&&timingSafeEqual(a,b);
}

export function verifyMetaChallenge(query, verifyToken){
 const mode=query.get('hub.mode'), token=query.get('hub.verify_token'), challenge=query.get('hub.challenge');
 if(mode==='subscribe'&&token&&verifyToken&&token===verifyToken&&challenge)return challenge;
 return null;
}

export function oauthAuthorizeUrl({state, redirectUri}){
 if(!metaConfigured())throw fail('Chưa cấu hình META_APP_ID / META_APP_SECRET.',503);
 const scope=['pages_show_list','pages_messaging','pages_manage_metadata','pages_read_engagement'].join(',');
 const p=new URLSearchParams({
  client_id:process.env.META_APP_ID,
  redirect_uri:redirectUri,
  state,
  response_type:'code',
  scope
 });
 return 'https://www.facebook.com/v21.0/dialog/oauth?'+p;
}

async function graphGet(path, accessToken){
 const sep=path.includes('?')?'&':'?';
 const url=GRAPH+path+sep+'access_token='+encodeURIComponent(accessToken);
 const r=await fetch(url);
 const body=await r.json().catch(()=>({}));
 if(!r.ok||body.error)throw fail(body.error?.message||('Meta API lỗi '+r.status), r.status>=400&&r.status<500?400:502);
 return body;
}

async function graphPost(path, accessToken, payload){
 const sep=path.includes('?')?'&':'?';
 const url=GRAPH+path+sep+'access_token='+encodeURIComponent(accessToken);
 const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
 const body=await r.json().catch(()=>({}));
 if(!r.ok||body.error)throw fail(body.error?.message||('Meta API lỗi '+r.status), r.status>=400&&r.status<500?400:502);
 return body;
}

async function oauthToken(params){
 const r=await fetch(GRAPH+'/oauth/access_token?'+new URLSearchParams(params));
 const body=await r.json().catch(()=>({}));
 if(!r.ok||!body.access_token)throw fail(body.error?.message||'Meta không cấp access token.',400);
 return body;
}

export async function exchangeMetaCode(code, redirectUri){
 if(!metaConfigured())throw fail('Chưa cấu hình Meta App.',503);
 const short=await oauthToken({
  client_id:process.env.META_APP_ID,
  client_secret:process.env.META_APP_SECRET,
  redirect_uri:redirectUri,
  code
 });
 const longLived=await oauthToken({
  grant_type:'fb_exchange_token',
  client_id:process.env.META_APP_ID,
  client_secret:process.env.META_APP_SECRET,
  fb_exchange_token:short.access_token
 });
 const pages=await graphGet('/me/accounts?fields=id,name,access_token,tasks', longLived.access_token);
 return {userToken:longLived, pages:(pages.data||[]).filter(p=>p.access_token)};
}

export async function subscribePage(pageId, pageAccessToken){
 return graphPost('/'+encodeURIComponent(pageId)+'/subscribed_apps', pageAccessToken, {
  subscribed_fields:['messages','messaging_postbacks','message_deliveries','message_reads']
 });
}

export async function fetchUserProfile(psid, pageAccessToken){
 try{
  const p=await graphGet('/'+encodeURIComponent(psid)+'?fields=first_name,last_name,name,profile_pic', pageAccessToken);
  const name=[p.first_name,p.last_name].filter(Boolean).join(' ')||p.name||'';
  return {name:name||'Khách Messenger', picture:p.profile_pic||''};
 }catch{
  return {name:'Khách Messenger', picture:''};
 }
}

export async function sendMetaText({pageAccessToken, recipientId, text}){
 const body=text.trim();
 if(!body||body.length>2000)throw fail('Nội dung tin nhắn trống hoặc vượt 2000 ký tự.');
 const result=await graphPost('/me/messages', pageAccessToken, {
  recipient:{id:recipientId},
  messaging_type:'RESPONSE',
  message:{text:body}
 });
 return {message_id:result.message_id||result.id||null};
}

export function parseMetaWebhook(payload){
 const events=[];
 if(!payload||!Array.isArray(payload.entry))return events;
 const object=payload.object;
 for(const entry of payload.entry){
  const pageId=String(entry.id||'');
  for(const m of entry.messaging||[]){
   if(!m.message||m.message.is_echo)continue;
   const text=m.message.text||(m.message.attachments?.length?'[Đính kèm]':'');
   if(!text&&!m.message.mid)continue;
   events.push({
    provider:object==='instagram'?'instagram':'meta_page',
    page_id:pageId,
    sender_id:String(m.sender?.id||''),
    recipient_id:String(m.recipient?.id||''),
    message_id:String(m.message.mid||''),
    text:text||'[Tin nhắn]',
    timestamp:m.timestamp?new Date(Number(m.timestamp)):new Date(),
    raw:m
   });
  }
 }
 return events;
}

export function secretsPayload({page_access_token, page_id, verify_token}){
 return {
  page_access_token,
  page_id,
  verify_token:verify_token||metaVerifyToken()||randomBytes(16).toString('hex')
 };
}
