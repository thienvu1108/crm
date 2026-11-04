// Vercel adapter. Production configuration is kept in project environment variables.
import {attachDatabasePool} from '@vercel/functions';

const required=['APP_ORIGIN','DATABASE_URL','ENCRYPTION_KEY','GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET'];
let backend;
export default async function handler(req,res){
 const url=new URL(req.url,'http://localhost');
 const route=url.searchParams.get('__route');
 url.searchParams.delete('__route');
 if(route){
  if(!/^\/(api|auth|webhooks)\//.test(route)||route.includes('..')){
   res.statusCode=400;res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({error:'Đường dẫn không hợp lệ.'}));
  }
  req.url=route+(url.search?'?'+url.searchParams.toString():'');
 }
 const path=new URL(req.url,'http://localhost').pathname;
 const missing=required.filter(key=>!process.env[key]);
 if(missing.length){
  res.statusCode=path==='/api/config'?200:503;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  return res.end(JSON.stringify(path==='/api/config'?{server:false,googleReady:false,mode:'demo'}:{error:'Máy chủ chưa cấu hình đầy đủ. Vui lòng dùng bản trải nghiệm hoặc liên hệ quản trị.'}));
 }
 try{
  backend ||= import('../server/index.mjs').then(module=>{attachDatabasePool(module.pool);return module;}).catch(error=>{backend=undefined;throw error;});
  const module=await backend;
  return await module.handler(req,res);
 }catch{
  res.statusCode=503;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');
  return res.end(JSON.stringify({error:'Không khởi tạo được máy chủ. Kiểm tra cấu hình môi trường và triển khai lại.'}));
 }
}
