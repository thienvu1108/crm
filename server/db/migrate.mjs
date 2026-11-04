import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

if (!process.env.DATABASE_URL) throw Error('Cần cấu hình DATABASE_URL.');
const dir = join(dirname(fileURLToPath(import.meta.url)), '../../database');
const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  for (const file of files) {
    const sql = await readFile(join(dir, file), 'utf8');
    await pool.query(sql);
    console.log('Applied', file);
  }
  console.log('Migration complete (' + files.length + ' files).');
} finally {
  await pool.end();
}
