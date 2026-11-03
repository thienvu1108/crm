import {createHash, timingSafeEqual, randomBytes} from 'node:crypto';

const fail=(message,status=400)=>Object.assign(Error(message),{status});

export function zaloConfigured(){
 return !!(process.env.ZALO_APP_ID&&process.env.ZALO_APP_SECRET);
}

/** PKCE verifier: 43 chars of [A-Za-z0-9] as Zalo requires. */
export function zaloCodeVerifier(){
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
 const bytes=randomBytes(43);
 let out='';
 for(let i=0;i<43;i++)out+=alphabet[bytes[i]%alphabet.length];
 return out;
}

export function zaloCodeChallenge(verifier){
 return createHash('sha256').update(verifier,'ascii').digest('base64url');
}

export function zaloAuthorizeUrl({codeChallenge, redirectUri, state}){
 if(!zaloConfigured())throw fail('Chưa cấu hình ZALO_APP_ID / ZALO_APP_SECRET.',503);
 // Zalo OA OAuth requires the auth URL to be built in Developer Console with code_challenge.
 // We still expose a helper URL pattern for documentation / when console supports query params.
 const p=new URLSearchParams({
  app_id:process.env.ZALO_APP_ID,
  redirect_uri:redirectUri,
  state:state||'',
  code_challenge:codeChallenge,
  code_challenge_method:'S256'
 });
 return 'https://oauth.zaloapp.com/v4/oa/permission?'+p;
}

export function verifyZaloMac({appId, rawBody, timestamp, oaSecret, signatureHeader}){
 if(!appId||!oaSecret||!timestamp||!signatureHeader)return false;
 const macMatch=String(signatureHeader).match(/mac\s*=\s*([a-f0-9]+)/i);
 const mac=macMatch?macMatch[1]:String(signatureHeader).replace(/^mac=/i,'').trim();
 if(!mac)return false;
 const expected=createHash('sha256').update(String(appId)+rawBody+String(timestamp)+String(oaSecret)).digest('hex');
 try{
  const a=Buffer.from(expected,'hex'), b=Buffer.from(mac,'hex');
  return a.length===b.length&&timingSafeEqual(a,b);
 }catch{return false;}
}

async function tokenRequest(body){
 if(!zaloConfigured())throw fail('Chưa cấu hình Zalo App.',503);
 const r=await fetch('https://oauth.zaloapp.com/v4/oa/access_token',{
  method:'POST',
  headers:{
   'Content-Type':'application/x-www-form-urlencoded',
   secret_key:process.env.ZALO_APP_SECRET
  },
  body:new URLSearchParams(body)
 });
 const data=await r.json().catch(()=>({}));
 if(!r.ok||!data.access_token){
  throw fail(data.error_description||data.message||'Zalo không cấp access token.',400);
 }
 const expiresIn=Number(data.expires_in||90000);
 return {
  access_token:data.access_token,
  refresh_token:data.refresh_token,
  expires_at:Date.now()+expiresIn*1000
 };
}

export async function exchangeZaloCode(code, codeVerifier){
 return tokenRequest({
  code,
  app_id:process.env.ZALO_APP_ID,
  grant_type:'authorization_code',
  code_verifier:codeVerifier
 });
}

export async function refreshZaloToken(refreshToken){
 return tokenRequest({
  refresh_token:refreshToken,
  app_id:process.env.ZALO_APP_ID,
  grant_type:'refresh_token'
 });
}


export async function fetchZaloUserDetail(accessToken, userId){
 try{
  const q=new URLSearchParams({data:JSON.stringify({user_id:String(userId)})});
  const r=await fetch('https://openapi.zalo.me/v3.0/oa/user/detail?'+q,{headers:{access_token:accessToken}});
  const body=await r.json().catch(()=>({}));
  if(!r.ok||body.error)return {name:'', avatar:'', phone:null, shared:{}};
  const d=body.data||{};
  const shared=d.shared_info||{};
  const phoneRaw=shared.phone!=null?String(shared.phone):'';
  return {
   name:String(shared.name||d.display_name||d.user_alias||'').trim(),
   avatar:String(d.avatar||d.avatars?.['240']||d.avatars?.['120']||''),
   phone:phoneRaw||null,
   shared
  };
 }catch{
  return {name:'', avatar:'', phone:null, shared:{}};
 }
}

export async function sendZaloText({accessToken, userId, text}){
 const body=text.trim();
 if(!body||body.length>2000)throw fail('Nội dung tin nhắn trống hoặc vượt 2000 ký tự.');
 const r=await fetch('https://openapi.zalo.me/v3.0/oa/message/cs',{
  method:'POST',
  headers:{
   'Content-Type':'application/json',
   access_token:accessToken
  },
  body:JSON.stringify({recipient:{user_id:String(userId)}, message:{text:body}})
 });
 const data=await r.json().catch(()=>({}));
 if(!r.ok||data.error){
  const msg=data.message||('Zalo API lỗi '+(data.error||r.status));
  throw fail(msg,400);
 }
 return {message_id:data.data?.message_id||null, quota:data.data?.quota||null};
}

export function parseZaloWebhook(payload){
 const events=[];
 if(!payload||!payload.event_name)return events;
 const name=String(payload.event_name);
 if(!name.startsWith('user_send_'))return events;
 const text=payload.message?.text
  ||(payload.message?.attachments?.length?'[Đính kèm]':'')
  ||'[Tin nhắn]';
 events.push({
  provider:'zalo_oa',
  oa_id:String(payload.recipient?.id||payload.oa_id||''),
  sender_id:String(payload.sender?.id||''),
  message_id:String(payload.message?.msg_id||''),
  text,
  timestamp:payload.timestamp?new Date(Number(payload.timestamp)):new Date(),
  raw:payload
 });
 return events;
}

export function secretsPayload({access_token, refresh_token, expires_at, oa_secret, oa_id}){
 return {
  access_token,
  refresh_token:refresh_token||'',
  expires_at:expires_at||Date.now()+90000*1000,
  oa_secret:oa_secret||'',
  oa_id
 };
}
