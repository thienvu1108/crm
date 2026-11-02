import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../dist/',import.meta.url));
http.createServer(async(req,res)=>{
  if(req.url.startsWith('/api/')){res.writeHead(404,{'Content-Type':'application/json'});return res.end(JSON.stringify({error:'Demo only'}));}
  try{let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(!['/','/index.html','/app.js','/style.css'].includes(name)){res.writeHead(404);return res.end();}const file=name==='/'?'index.html':name.slice(1);res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8');res.end(await readFile(path.join(root,file)));}catch{res.writeHead(404);res.end();}
}).listen(3000,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:3000'));
