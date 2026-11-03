import pg from 'pg';
import {readdir, readFile} from 'node:fs/promises';
if(!process.env.DATABASE_URL)throw Error('Cần cấu hình DATABASE_URL.');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
const dir=new URL('../database/',import.meta.url);
try{
 const files=(await readdir(dir)).filter(f=>/^\d+.*\.sql$/i.test(f)).sort();
 for(const file of files){
  await pool.query(await readFile(new URL(file,dir),'utf8'));
  console.log('Applied',file);
 }
 console.log('Migration complete.');
}finally{await pool.end();}
