import test from 'node:test';
import assert from 'node:assert/strict';
import adapter from '../api/index.mjs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomBytes} from 'node:crypto';

function response(){return {statusCode:0,headers:{},setHeader(key,value){this.headers[key]=value},end(body){this.body=JSON.parse(body)}};}
test('Vercel demo stays available and production writes fail closed without secrets',async()=>{
 const keys=['APP_ORIGIN','DATABASE_URL','ENCRYPTION_KEY','GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET'];
 const before=keys.map(key=>process.env[key]);keys.forEach(key=>delete process.env[key]);
 try{
  const req={url:'/api/index?__route=/api/config',headers:{},method:'GET'},res=response();
  await adapter(req,res);assert.equal(req.url,'/api/config');assert.equal(res.statusCode,200);assert.equal(res.body.server,false);assert.equal(res.body.googleReady,false);
  const write=response();await adapter({url:'/api/index?__route=/api/customers',method:'POST'},write);assert.equal(write.statusCode,503);
  const invalid=response();await adapter({url:'/api/index?__route=https://attacker.example/',method:'GET'},invalid);assert.equal(invalid.statusCode,400);
  const oauth=response(),oauthReq={url:'/api/index?__route=/auth/google/callback&state=test-state&code=test-code',method:'GET'};
  await adapter(oauthReq,oauth);assert.equal(oauthReq.url,'/auth/google/callback?state=test-state&code=test-code');assert.equal(oauth.statusCode,503);
 }finally{keys.forEach((key,i)=>before[i]===undefined?delete process.env[key]:process.env[key]=before[i]);}
});
test('importing the backend for Vercel exports a handler without starting a server',async()=>{
 const {stdout}=await promisify(execFile)(process.execPath,['--input-type=module','-e',"const m=await import('./server/index.mjs'); console.log(typeof m.handler); await m.pool.end();"],{
  cwd:new URL('../',import.meta.url),timeout:8000,
  env:{...process.env,APP_ORIGIN:'https://crm.example.com',DATABASE_URL:'postgres://fake:fake@127.0.0.1:1/test',ENCRYPTION_KEY:randomBytes(32).toString('base64'),GOOGLE_CLIENT_ID:'fake-client',GOOGLE_CLIENT_SECRET:'fake-secret',NODE_ENV:'production'}
 });
 assert.equal(stdout.trim(),'function');
});
