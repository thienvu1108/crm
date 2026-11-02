import pg from 'pg';
import {readFile} from 'node:fs/promises';
if(!process.env.DATABASE_URL)throw Error('Cần cấu hình DATABASE_URL.');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
try{await pool.query(await readFile(new URL('../database/001_initial.sql',import.meta.url),'utf8'));console.log('Migration complete.');}finally{await pool.end();}
