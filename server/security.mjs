import {randomBytes,createHash,createCipheriv,createDecipheriv,timingSafeEqual} from 'node:crypto';
export const randomToken=()=>randomBytes(32).toString('base64url');
export const hash=v=>createHash('sha256').update(v).digest('hex');
export function encrypt(value,key){const k=Buffer.from(key||'','base64');if(k.length!==32)throw Error('ENCRYPTION_KEY phải là 32 bytes mã hóa base64.');const iv=randomBytes(12);const c=createCipheriv('aes-256-gcm',k,iv);const out=Buffer.concat([c.update(JSON.stringify(value),'utf8'),c.final()]);return [iv,c.getAuthTag(),out].map(v=>v.toString('base64')).join('.');}
export function decrypt(value,key){const [iv,tag,body]=value.split('.').map(v=>Buffer.from(v,'base64'));const c=createDecipheriv('aes-256-gcm',Buffer.from(key,'base64'),iv);c.setAuthTag(tag);return JSON.parse(Buffer.concat([c.update(body),c.final()]).toString('utf8'));}
export function sameSecret(a,b){if(!a||!b)return false;const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
export function normalizePhone(v){let n=String(v||'').replace(/[^\d+]/g,'');if(n.startsWith('+84'))n='0'+n.slice(3);else if(n.startsWith('84')&&(n.length===11||n.length===12))n='0'+n.slice(2);return n||null;}
/** Detect Vietnamese mobile/landline-looking numbers in free text; returns unique normalized 0xxxxxxxxx keys. */
export function extractPhones(text){const raw=String(text||'');const found=new Set();
 const re=/(?:\+?84|0)\s*(?:\d[\s.\-]*){8,10}\d/g;
 let m;while((m=re.exec(raw))){const n=normalizePhone(m[0]);if(n&&/^0\d{8,10}$/.test(n))found.add(n);}
 return [...found];}
export function allowed(role,action){return role==='owner'||role==='assistant'&&['read','write'].includes(action)||role==='viewer'&&action==='read';}
export const uuidRE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function assertId(id){if(!uuidRE.test(id||''))throw Object.assign(Error('Mã dữ liệu không hợp lệ.'),{status:400});return id;}
export function text(v,max=250,required=false){if(typeof v!=='string'||v.length>max||required&&!v.trim())throw Object.assign(Error('Thông tin nhập thiếu hoặc vượt độ dài cho phép.'),{status:400});return v.trim();}
export function isoDate(v){const d=new Date(v);if(!v||!Number.isFinite(d.getTime()))throw Object.assign(Error('Ngày giờ không hợp lệ.'),{status:400});return d.toISOString();}
export function email(v){const s=text(v,254,true).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))throw Object.assign(Error('Email không hợp lệ.'),{status:400});return s;}
