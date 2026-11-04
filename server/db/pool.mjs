import pg from 'pg';

const env = process.env;
for (const key of ['APP_ORIGIN', 'DATABASE_URL', 'ENCRYPTION_KEY', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']) {
  if (!env[key]) throw Error('Thiếu cấu hình ' + key + '. Xem .env.example.');
}
if (Buffer.from(env.ENCRYPTION_KEY, 'base64').length !== 32) {
  throw Error('ENCRYPTION_KEY phải gồm 32 bytes mã hóa base64.');
}
const origin = env.APP_ORIGIN.replace(/\/$/, '');
if (env.NODE_ENV === 'production' && !origin.startsWith('https://')) {
  throw Error('Production cần APP_ORIGIN sử dụng HTTPS.');
}

export const appOrigin = origin;
export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 3,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 5000,
  allowExitOnIdle: true,
});

export async function tx(ctx, fn) {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query("SELECT set_config('app.workspace_id',$1,true)", [ctx.id]);
    const out = await fn(db);
    await db.query('COMMIT');
    return out;
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  } finally {
    db.release();
  }
}
