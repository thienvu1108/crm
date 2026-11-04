import http from 'node:http';
import { resolveTxt } from 'node:dns/promises';
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import {
  randomToken, hash, encrypt, sameSecret, normalizePhone, allowed, assertId, text, email, isoDate,
} from './security.mjs';
import { exchange, uploadBackup, syncCalendar } from './services/google.mjs';
import { pool, tx, appOrigin } from './db/pool.mjs';

const env = process.env;
const origin = appOrigin;
export { pool };

const rootDist = fileURLToPath(new URL('../dist/', import.meta.url));
const rootWeb = fileURLToPath(new URL('../web/build/', import.meta.url));
const admins = new Set(
  (env.PLATFORM_ADMIN_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
);
const cookieSecure = origin.startsWith('https://') ? '; Secure' : '';
const fail = (message, status = 400) => Object.assign(Error(message), { status });
const json = (res, status, data) => {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(data));
};
const redirect = (res, url) => {
  res.writeHead(302, { Location: url });
  res.end();
};
const cookies = (req) =>
  Object.fromEntries(
    (req.headers.cookie || '')
      .split(';')
      .filter((x) => x.includes('='))
      .map((x) => {
        const i = x.indexOf('=');
        return [x.slice(0, i).trim(), x.slice(i + 1)];
      }),
  );

async function body(req) {
  let s = '';
  for await (const c of req) {
    s += c;
    if (Buffer.byteLength(s) > 1024 * 1024) throw fail('Dữ liệu vượt quá 1MB.', 413);
  }
  try {
    return s ? JSON.parse(s) : {};
  } catch {
    throw fail('JSON không hợp lệ.');
  }
}

async function user(req) {
  const token = cookies(req).mh_session;
  if (!token) throw fail('Vui lòng đăng nhập Google.', 401);
  const r = await pool.query(
    'SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()',
    [hash(token)],
  );
  if (!r.rows[0]) throw fail('Phiên đăng nhập hết hạn.', 401);
  return r.rows[0];
}

async function memberships(u) {
  const db = await pool.connect();
  try {
    await db.query("SELECT set_config('app.user_id',$1,true)", [u.id]);
    return (
      await db.query(
        `SELECT w.id,w.name,w.slug,w.owner_email,w.active,m.role
         FROM memberships m JOIN workspaces w ON w.id=m.workspace_id
         WHERE m.user_id=$1 ORDER BY w.created_at`,
        [u.id],
      )
    ).rows;
  } finally {
    db.release();
  }
}

async function context(req, u, forcedId) {
  let id = forcedId || req.headers['x-workspace-id'];
  const hostname = (req.headers.host || '').split(':')[0].toLowerCase();
  let d;
  {
    const db = await pool.connect();
    try {
      await db.query("SELECT set_config('app.platform_admin','true',true)");
      d = (await db.query('SELECT workspace_id FROM domains WHERE hostname=$1 AND verified=true', [hostname])).rows[0];
    } finally {
      db.release();
    }
  }
  if (d) {
    if (id && id !== d.workspace_id) throw fail('Tên miền không thuộc không gian này.', 403);
    id = d.workspace_id;
  }
  if (!id) {
    const ms = await memberships(u);
    id = ms.find((m) => m.active)?.id || ms[0]?.id;
  }
  if (!id) throw fail('Tài khoản chưa được cấp không gian CRM. Liên hệ quản trị viên.', 403);
  assertId(id);
  const db = await pool.connect();
  try {
    await db.query("SELECT set_config('app.user_id',$1,true)", [u.id]);
    await db.query("SELECT set_config('app.workspace_id',$1,true)", [id]);
    const m = (
      await db.query(
        'SELECT m.role,w.name,w.active FROM memberships m JOIN workspaces w ON w.id=m.workspace_id WHERE m.workspace_id=$1 AND m.user_id=$2',
        [id, u.id],
      )
    ).rows[0];
    if (!m) throw fail('Bạn không có quyền truy cập không gian này.', 403);
    return { id, role: m.role, name: m.name, active: m.active, user: u };
  } finally {
    db.release();
  }
}

function permit(ctx, action) {
  if (!allowed(ctx.role, action)) throw fail('Bạn không có quyền thực hiện thao tác này.', 403);
}

function requireActive(ctx) {
  if (!ctx.active) throw fail('Không gian đang tạm khóa. Chỉ xem được thông tin; không thể ghi dữ liệu.', 403);
}

async function audit(db, ctx, action, id) {
  await db.query(
    'INSERT INTO audit_log(id,workspace_id,actor_id,action,entity_id) VALUES($1,$2,$3,$4,$5)',
    [randomUUID(), ctx.id, ctx.user.id, action, id || null],
  );
}

async function accessibleCustomer(db, ctx, customerId, write) {
  assertId(customerId);
  if (write) requireActive(ctx);
  permit(ctx, write ? 'write' : 'read');
  let c;
  try {
    c = (await db.query('SELECT * FROM customers WHERE id=$1 AND workspace_id=$2 AND (merged_into IS NULL)', [customerId, ctx.id])).rows[0];
  } catch {
    c = (await db.query('SELECT * FROM customers WHERE id=$1 AND workspace_id=$2', [customerId, ctx.id])).rows[0];
  }
  if (!c) {
    c = (await db.query('SELECT * FROM customers WHERE id=$1 AND workspace_id=$2', [customerId, ctx.id])).rows[0];
  }
  if (!c) throw fail('Không tìm thấy khách hàng.', 404);
  if (ctx.role !== 'owner' && c.assigned_to !== ctx.user.id) {
    throw fail('Bạn chỉ được truy cập khách được giao.', 403);
  }
  return c;
}

async function checkAssignment(db, ctx, b) {
  if ('assigned_to' in b) {
    permit(ctx, 'owner');
    if (b.assigned_to) {
      assertId(b.assigned_to);
      const m = (
        await db.query('SELECT 1 FROM memberships WHERE workspace_id=$1 AND user_id=$2', [ctx.id, b.assigned_to])
      ).rows[0];
      if (!m) throw fail('Người được giao không thuộc không gian này.');
    }
  }
}

function customerInput(b, partial = false) {
  const out = {};
  if (!partial || b.name !== undefined) out.name = text(b.name, 120, !partial);
  if (!partial || b.phone !== undefined) {
    out.phone = text(b.phone || '', 40);
    out.phone_normalized = normalizePhone(out.phone);
  }
  if (!partial || b.email !== undefined) out.email = text(b.email || '', 254);
  if (!partial || b.source !== undefined) out.source = text(b.source || 'Nhập tay', 80);
  if (!partial || b.interest !== undefined) {
    if (!['high', 'medium', 'low', 'unknown'].includes(b.interest || 'unknown')) throw fail('Mức quan tâm không hợp lệ.');
    out.interest = b.interest || 'unknown';
  }
  if (!partial || b.stage !== undefined) {
    if (!['new', 'consulting', 'viewing', 'negotiating', 'won', 'lost'].includes(b.stage || 'new')) {
      throw fail('Giai đoạn không hợp lệ.');
    }
    out.stage = b.stage || 'new';
  }
  if (!partial || b.budget !== undefined) {
    const n = Number(b.budget || 0);
    if (!Number.isFinite(n) || n < 0) throw fail('Ngân sách không hợp lệ.');
    out.budget = n;
  }
  if (!partial || b.area !== undefined) out.area = text(b.area || '', 120);
  if (!partial || b.need !== undefined) out.need = text(b.need || '', 2000);
  if (!partial || b.notes !== undefined) out.notes = text(b.notes || '', 5000);
  if (b.assigned_to !== undefined) out.assigned_to = b.assigned_to || null;
  return out;
}

async function dataFor(db, ctx) {
  const customers = (
    await db.query(
      'SELECT * FROM customers WHERE workspace_id=$1 AND ($2::boolean OR assigned_to=$3) ORDER BY created_at DESC',
      [ctx.id, ctx.role === 'owner', ctx.user.id],
    )
  ).rows;
  const ids = customers.map((c) => c.id);
  const tasks = (
    await db.query('SELECT * FROM tasks WHERE workspace_id=$1 AND customer_id=ANY($2::uuid[]) ORDER BY due_at', [
      ctx.id,
      ids,
    ])
  ).rows;
  const activities = (
    await db.query(
      'SELECT id,customer_id,kind,note,created_at FROM activities WHERE workspace_id=$1 AND customer_id=ANY($2::uuid[]) ORDER BY created_at DESC',
      [ctx.id, ids],
    )
  ).rows;
  const members =
    ctx.role === 'owner'
      ? (
          await db.query(
            'SELECT m.id,m.user_id,m.email,m.role,u.name FROM memberships m LEFT JOIN users u ON u.id=m.user_id WHERE workspace_id=$1',
            [ctx.id],
          )
        ).rows
      : [];
  const connections = (
    await db.query(
      "SELECT id,provider,email FROM connections WHERE workspace_id=$1 AND (user_id=$2 OR (provider='drive' AND $3::boolean))",
      [ctx.id, ctx.user.id, ctx.role === 'owner'],
    )
  ).rows;
  const w = (await db.query('SELECT name,settings FROM workspaces WHERE id=$1', [ctx.id])).rows[0];
  return {
    customers,
    tasks,
    activities,
    members,
    connections,
    settings: { ...(w?.settings || {}), name: w?.name },
    workspace: { id: ctx.id, name: ctx.name, active: ctx.active },
  };
}

async function backup(db, ctx) {
  permit(ctx, 'owner');
  requireActive(ctx);
  const data = await dataFor(db, ctx);
  await audit(db, ctx, 'backup.export', null);
  return { exported_at: new Date().toISOString(), workspace_id: ctx.id, ...data };
}

async function backupDrive(db, ctx) {
  permit(ctx, 'owner');
  requireActive(ctx);
  const c = (
    await db.query(
      "SELECT * FROM connections WHERE workspace_id=$1 AND user_id=$2 AND provider='drive' FOR UPDATE",
      [ctx.id, ctx.user.id],
    )
  ).rows[0];
  if (!c) throw fail('Hãy kết nối Google Drive trước.');
  const payload = await backup(db, ctx);
  await uploadBackup(db, c, payload);
  await audit(db, ctx, 'backup.drive', null);
  return { ok: true };
}

const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const row = hits.get(ip) || { n: 0, t: now };
  if (now - row.t > 60000) {
    row.n = 0;
    row.t = now;
  }
  row.n += 1;
  hits.set(ip, row);
  return row.n > 120;
}

function requestOrigin(req) {
  const incoming = req.headers.origin || req.headers.referer;
  try {
    if (incoming) return new URL(incoming).origin;
  } catch {
    /* ignore */
  }
  return origin;
}

async function oauthStart(req, res, url) {
  const u = url.pathname.endsWith('/connect') ? await user(req) : null;
  const provider = url.pathname.endsWith('/connect') ? text(url.searchParams.get('provider') || '', 20, true) : 'login';
  if (provider !== 'login' && !['drive', 'calendar'].includes(provider)) throw fail('Nhà cung cấp không hợp lệ.');
  const request_origin = requestOrigin(req);
  const state = randomToken();
  const verifier = randomToken();
  const browser = randomToken();
  let workspace_id = null;
  if (u) {
    const ctx = await context(req, u);
    if (provider === 'drive') permit(ctx, 'owner');
    workspace_id = ctx.id;
  }
  await pool.query('DELETE FROM oauth_states WHERE expires_at<now()');
  await pool.query(
    'INSERT INTO oauth_states(state_hash,browser_hash,verifier,user_id,workspace_id,provider,request_origin,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,now()+interval \'10 minutes\')',
    [hash(state), hash(browser), verifier, u?.id || null, workspace_id, provider, request_origin],
  );
  const scope =
    provider === 'login'
      ? 'openid email profile'
      : provider === 'drive'
        ? 'https://www.googleapis.com/auth/drive.file'
        : 'https://www.googleapis.com/auth/calendar.app.created';
  const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  auth.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: request_origin + '/auth/google/callback',
    response_type: 'code',
    scope,
    state,
    code_challenge: Buffer.from(hash(verifier), 'hex').toString('base64url'),
    code_challenge_method: 'S256',
    access_type: 'offline',
    ...(provider !== 'login' ? { prompt: 'consent', include_granted_scopes: 'true' } : {}),
  }).toString();
  res.setHeader(
    'Set-Cookie',
    'mh_oauth=' + browser + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=600' + cookieSecure,
  );
  redirect(res, auth.toString());
}

async function oauthCallback(req, res, url) {
  const state = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  const browser = cookies(req).mh_oauth;
  if (!state || !code || !browser) throw fail('Phiên OAuth không hợp lệ.');
  const result = await pool.query(
    'DELETE FROM oauth_states WHERE state_hash=$1 AND browser_hash=$2 AND expires_at>now() RETURNING *',
    [hash(state), hash(browser)],
  );
  const saved = result.rows[0];
  if (!saved) throw fail('Phiên OAuth hết hạn. Hãy thử lại.');
  const { token, profile } = await exchange(code, saved.verifier, saved.request_origin);
  const googleEmail = String(profile.email).toLowerCase();
  if (saved.provider === 'login') {
    let u = (await pool.query('SELECT * FROM users WHERE google_sub=$1', [profile.sub])).rows[0];
    if (!u) {
      const id = randomUUID();
      await pool.query('INSERT INTO users(id,google_sub,email,name) VALUES($1,$2,$3,$4)', [
        id,
        profile.sub,
        googleEmail,
        profile.name || googleEmail,
      ]);
      u = { id };
      const dbm = await pool.connect();
      try {
        await dbm.query("SELECT set_config('app.platform_admin','true',true)");
        await dbm.query('UPDATE memberships SET user_id=$1 WHERE lower(email)=$2 AND user_id IS NULL', [
          id,
          googleEmail,
        ]);
      } finally {
        dbm.release();
      }
    } else {
      await pool.query('UPDATE users SET email=$1,name=$2 WHERE id=$3', [
        googleEmail,
        profile.name || googleEmail,
        u.id,
      ]);
    }
    const session = randomToken();
    await pool.query('DELETE FROM sessions WHERE expires_at<now()');
    await pool.query('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval \'7 days\')', [
      hash(session),
      u.id,
    ]);
    res.setHeader(
      'Set-Cookie',
      [
        'mh_session=' + session + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800' + cookieSecure,
        'mh_oauth=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' + cookieSecure,
      ],
    );
    return redirect(res, saved.request_origin + '/');
  }
  const u = await user(req);
  if (u.id !== saved.user_id || u.google_sub !== profile.sub) {
    throw fail('Hãy cấp quyền bằng đúng tài khoản Google đang đăng nhập CRM.', 403);
  }
  const expected =
    saved.provider === 'drive'
      ? 'https://www.googleapis.com/auth/drive.file'
      : 'https://www.googleapis.com/auth/calendar.app.created';
  if (!String(token.scope || '').split(' ').includes(expected)) {
    throw fail('Bạn chưa cấp đủ quyền cho chức năng đã chọn.');
  }
  const ctx = await context(req, u, saved.workspace_id);
  if (saved.provider === 'drive') permit(ctx, 'owner');
  await tx(ctx, async (db) => {
    await db.query(
      'INSERT INTO connections(id,workspace_id,user_id,provider,email,encrypted_token) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(workspace_id,user_id,provider) DO UPDATE SET email=EXCLUDED.email,encrypted_token=EXCLUDED.encrypted_token',
      [randomUUID(), ctx.id, u.id, saved.provider, googleEmail, encrypt(token, env.ENCRYPTION_KEY)],
    );
    await audit(db, ctx, 'connect.' + saved.provider, null);
  });
  redirect(res, saved.request_origin + '/#connections');
}

async function api(req, res, url) {
  const p = url.pathname.slice(4);
  const method = req.method;
  if (p === '/config') {
    return json(res, 200, {
      server: true,
      googleReady: true,
      mode: 'server',
      vapidPublicKey: env.VAPID_PUBLIC_KEY || null,
    });
  }
  if (p === '/jobs/backups' && method === 'POST') {
    if (!sameSecret(req.headers.authorization, 'Bearer ' + env.JOB_SECRET) || !env.JOB_SECRET) {
      throw fail('Không có quyền chạy lịch nền.', 401);
    }
    const owners = (
      await pool.query(
        "SELECT m.workspace_id,u.id AS user_id FROM memberships m JOIN users u ON u.id=m.user_id JOIN workspaces w ON w.id=m.workspace_id WHERE m.role='owner' AND w.active=true",
      )
    ).rows;
    const results = [];
    for (const o of owners) {
      const ctx = { id: o.workspace_id, role: 'owner', active: true, user: { id: o.user_id } };
      try {
        await tx(ctx, (db) => backupDrive(db, ctx));
        results.push({ workspace_id: ctx.id, status: 'success' });
      } catch {
        results.push({ workspace_id: ctx.id, status: 'failed' });
      }
    }
    return json(res, 200, { results });
  }

  const u = await user(req);
  const platformAdmin = admins.has(u.email.toLowerCase());

  if (p === '/logout' && method === 'POST') {
    await pool.query('DELETE FROM sessions WHERE token_hash=$1', [hash(cookies(req).mh_session || '')]);
    res.setHeader(
      'Set-Cookie',
      'mh_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' + cookieSecure,
    );
    return json(res, 200, { ok: true });
  }

  if (p === '/platform/workspaces') {
    if (!platformAdmin) throw fail('Chỉ quản trị nền tảng được truy cập.', 403);
    if (method === 'GET') {
      return json(
        res,
        200,
        (
          await pool.query(
            'SELECT w.id,w.name,w.slug,w.owner_email,w.active,(SELECT hostname FROM domains d WHERE d.workspace_id=w.id AND d.verified=true LIMIT 1) AS domain FROM workspaces w ORDER BY w.created_at DESC',
          )
        ).rows,
      );
    }
    if (method === 'POST') {
      const b = await body(req);
      const name = text(b.name, 100, true);
      const owner = email(b.owner_email);
      const slug = text(b.slug, 50, true);
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw fail('Mã không gian chỉ dùng chữ thường, số và gạch nối.');
      const id = randomUUID();
      const db = await pool.connect();
      try {
        await db.query('BEGIN');
        await db.query("SELECT set_config('app.platform_admin','true',true)");
        await db.query("SELECT set_config('app.workspace_id',$1,true)", [id]);
        await db.query('INSERT INTO workspaces(id,name,slug,owner_email) VALUES($1,$2,$3,$4)', [id, name, slug, owner]);
        const existing = (await db.query('SELECT id FROM users WHERE lower(email)=$1', [owner])).rows[0];
        await db.query(
          "INSERT INTO memberships(id,workspace_id,user_id,email,role) VALUES($1,$2,$3,$4,'owner')",
          [randomUUID(), id, existing?.id || null, owner],
        );
        await db.query(
          'INSERT INTO audit_log(id,workspace_id,actor_id,action,entity_id) VALUES($1,$2,$3,$4,$5)',
          [randomUUID(), id, u.id, 'workspace.create', id],
        );
        await db.query('COMMIT');
      } catch (e) {
        await db.query('ROLLBACK');
        throw e;
      } finally {
        db.release();
      }
      return json(res, 201, { id });
    }
  }

  const platformWs = p.match(/^\/platform\/workspaces\/([0-9a-f-]{36})$/i);
  if (platformWs && method === 'PATCH') {
    if (!platformAdmin) throw fail('Chỉ quản trị nền tảng được truy cập.', 403);
    const id = assertId(platformWs[1]);
    const b = await body(req);
    if (typeof b.active !== 'boolean') throw fail('Cần trường active (true/false).');
    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      await db.query("SELECT set_config('app.platform_admin','true',true)");
      await db.query("SELECT set_config('app.workspace_id',$1,true)", [id]);
      const updated = (
        await db.query('UPDATE workspaces SET active=$1 WHERE id=$2 RETURNING id,active', [b.active, id])
      ).rows[0];
      if (!updated) throw fail('Không tìm thấy không gian.', 404);
      await db.query(
        'INSERT INTO audit_log(id,workspace_id,actor_id,action,entity_id) VALUES($1,$2,$3,$4,$5)',
        [randomUUID(), id, u.id, b.active ? 'workspace.unlock' : 'workspace.lock', id],
      );
      await db.query('COMMIT');
      return json(res, 200, updated);
    } catch (e) {
      await db.query('ROLLBACK');
      throw e;
    } finally {
      db.release();
    }
  }

  if (p === '/platform/domains') {
    if (!platformAdmin) throw fail('Chỉ quản trị nền tảng được truy cập.', 403);
    if (method === 'GET') {
      const db = await pool.connect();
      try {
        await db.query("SELECT set_config('app.platform_admin','true',true)");
        return json(
          res,
          200,
          (await db.query('SELECT hostname,workspace_id,verified,verification_token FROM domains ORDER BY created_at DESC')).rows,
        );
      } finally {
        db.release();
      }
    }
    if (method === 'POST') {
      const b = await body(req);
      const hostname = text(b.hostname, 253, true).toLowerCase();
      if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(hostname)) {
        throw fail('Hostname không hợp lệ.');
      }
      assertId(b.workspace_id);
      const token = randomToken();
      const db = await pool.connect();
      try {
        await db.query('BEGIN');
        await db.query("SELECT set_config('app.platform_admin','true',true)");
        await db.query("SELECT set_config('app.workspace_id',$1,true)", [b.workspace_id]);
        await db.query('INSERT INTO domains(hostname,workspace_id,verification_token) VALUES($1,$2,$3)', [
          hostname,
          b.workspace_id,
          token,
        ]);
        await db.query('COMMIT');
      } catch (e) {
        await db.query('ROLLBACK');
        throw e;
      } finally {
        db.release();
      }
      return json(res, 201, {
        hostname,
        record: '_mayhomes-verification.' + hostname,
        type: 'TXT',
        value: token,
      });
    }
  }

  if (p === '/platform/domains/verify' && method === 'POST') {
    if (!platformAdmin) throw fail('Không có quyền.', 403);
    const b = await body(req);
    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      await db.query("SELECT set_config('app.platform_admin','true',true)");
      const d = (await db.query('SELECT * FROM domains WHERE hostname=$1', [String(b.hostname).toLowerCase()])).rows[0];
      if (!d) throw fail('Tên miền chưa được đăng ký.');
      await db.query("SELECT set_config('app.workspace_id',$1,true)", [d.workspace_id]);
      let records;
      try {
        records = await resolveTxt('_mayhomes-verification.' + d.hostname);
      } catch {
        throw fail('Chưa tìm thấy TXT xác minh trên DNS.');
      }
      if (!records.some((r) => r.join('') === d.verification_token)) throw fail('TXT xác minh chưa khớp.');
      await db.query('UPDATE domains SET verified=true WHERE hostname=$1', [d.hostname]);
      await db.query('COMMIT');
      return json(res, 200, { ok: true, hostname: d.hostname });
    } catch (e) {
      await db.query('ROLLBACK');
      throw e;
    } finally {
      db.release();
    }
  }

  if (p === '/me') {
    const ms = await memberships(u);
    let ctx = null;
    try {
      ctx = await context(req, u);
    } catch (e) {
      if (!platformAdmin) throw e;
    }
    return json(res, 200, {
      user: {
        id: u.id,
        name: u.name,
        email: u.email,
        role: ctx?.role || 'platform',
        platformAdmin,
        workspaceName: ctx?.name,
      },
      workspaceId: ctx?.id || '',
      workspaceActive: ctx?.active ?? null,
      workspaces: ms,
    });
  }

  const ctx = await context(req, u);
  permit(ctx, 'read');
  const out = await tx(ctx, async (db) => {
    if (p === '/data' && method === 'GET') return dataFor(db, ctx);

    if (p === '/customers' && method === 'POST') {
      permit(ctx, 'write');
      requireActive(ctx);
      const b = customerInput(await body(req));
      await checkAssignment(db, ctx, b);
      if (ctx.role !== 'owner') b.assigned_to = u.id;
      const id = randomUUID();
      const keys = Object.keys(b);
      await db.query(
        'INSERT INTO customers(id,workspace_id,' + keys.join(',') + ') VALUES($1,$2,' + keys.map((_, i) => '$' + (i + 3)).join(',') + ')',
        [id, ctx.id, ...Object.values(b)],
      );
      await audit(db, ctx, 'customer.create', id);
      return { id };
    }

    if (p.startsWith('/customers/') && method === 'PATCH') {
      const id = p.split('/')[2];
      await accessibleCustomer(db, ctx, id, true);
      const b = customerInput(await body(req), true);
      await checkAssignment(db, ctx, b);
      const keys = Object.keys(b);
      if (!keys.length) throw fail('Không có trường để cập nhật.');
      await db.query(
        'UPDATE customers SET ' + keys.map((k, i) => k + '=$' + (i + 3)).join(',') + ',updated_at=now() WHERE id=$1 AND workspace_id=$2',
        [id, ctx.id, ...Object.values(b)],
      );
      await audit(db, ctx, 'customer.update', id);
      return { ok: true };
    }

    if (p === '/tasks' && method === 'POST') {
      requireActive(ctx);
      const b = await body(req);
      await accessibleCustomer(db, ctx, b.customer_id, true);
      if (!['call', 'message', 'viewing'].includes(b.kind)) throw fail('Hình thức không hợp lệ.');
      const id = randomUUID();
      await db.query(
        'INSERT INTO tasks(id,workspace_id,customer_id,title,due_at,kind) VALUES($1,$2,$3,$4,$5,$6)',
        [id, ctx.id, b.customer_id, text(b.title, 250, true), isoDate(b.due_at), b.kind],
      );
      await audit(db, ctx, 'task.create', id);
      return { id };
    }

    if (p.startsWith('/tasks/') && method === 'PATCH') {
      requireActive(ctx);
      const id = assertId(p.split('/')[2]);
      const b = await body(req);
      const t = (await db.query('SELECT * FROM tasks WHERE id=$1 AND workspace_id=$2', [id, ctx.id])).rows[0];
      if (!t) throw fail('Không tìm thấy công việc.', 404);
      await accessibleCustomer(db, ctx, t.customer_id, true);
      if (b.status && ['pending', 'done', 'cancelled'].includes(b.status)) {
        await db.query('UPDATE tasks SET status=$1,updated_at=now() WHERE id=$2 AND workspace_id=$3', [
          b.status,
          id,
          ctx.id,
        ]);
        return { ok: true };
      }
      if (t.status !== 'pending') throw fail('Chỉ có thể dời công việc chưa hoàn tất.');
      await db.query('UPDATE tasks SET due_at=$1,updated_at=now() WHERE id=$2 AND workspace_id=$3', [
        isoDate(b.due_at),
        id,
        ctx.id,
      ]);
      return { ok: true };
    }

    if (p === '/activities' && method === 'POST') {
      requireActive(ctx);
      const b = await body(req);
      await accessibleCustomer(db, ctx, b.customer_id, true);
      if (!['call', 'message', 'meeting'].includes(b.kind)) throw fail('Hình thức không hợp lệ.');
      if (b.task_id) {
        assertId(b.task_id);
        const t = (
          await db.query(
            'SELECT * FROM tasks WHERE id=$1 AND workspace_id=$2 AND customer_id=$3 FOR UPDATE',
            [b.task_id, ctx.id, b.customer_id],
          )
        ).rows[0];
        if (!t || t.status !== 'pending') throw fail('Công việc không hợp lệ hoặc đã hoàn tất.');
        await db.query("UPDATE tasks SET status='done',updated_at=now() WHERE id=$1 AND workspace_id=$2", [
          b.task_id,
          ctx.id,
        ]);
      }
      await db.query(
        'INSERT INTO activities(id,workspace_id,customer_id,user_id,kind,note) VALUES($1,$2,$3,$4,$5,$6)',
        [randomUUID(), ctx.id, b.customer_id, u.id, b.kind, text(b.note, 5000, true)],
      );
      await db.query('UPDATE customers SET last_contact=now(),updated_at=now() WHERE id=$1 AND workspace_id=$2', [
        b.customer_id,
        ctx.id,
      ]);
      if (b.next_due) {
        await db.query(
          "INSERT INTO tasks(id,workspace_id,customer_id,title,due_at,kind) VALUES($1,$2,$3,$4,$5,'call')",
          [randomUUID(), ctx.id, b.customer_id, text(b.next_title, 250, true), isoDate(b.next_due)],
        );
      }
      await audit(db, ctx, 'activity.create', b.customer_id);
      return { ok: true };
    }

    if (p === '/settings' && method === 'PATCH') {
      permit(ctx, 'owner');
      requireActive(ctx);
      const b = await body(req);
      await db.query('UPDATE workspaces SET name=$1 WHERE id=$2', [text(b.name, 100, true), ctx.id]);
      return { ok: true };
    }

    if (p === '/members' && method === 'POST') {
      permit(ctx, 'owner');
      requireActive(ctx);
      const b = await body(req);
      const mail = email(b.email);
      if (!['assistant', 'viewer'].includes(b.role)) throw fail('Vai trò không hợp lệ.');
      const existing = (await db.query('SELECT id FROM users WHERE lower(email)=$1', [mail])).rows[0];
      await db.query('INSERT INTO memberships(id,workspace_id,user_id,email,role) VALUES($1,$2,$3,$4,$5)', [
        randomUUID(),
        ctx.id,
        existing?.id || null,
        mail,
        b.role,
      ]);
      await audit(db, ctx, 'membership.create', mail);
      return { ok: true };
    }

    if (p.startsWith('/members/') && method === 'DELETE') {
      permit(ctx, 'owner');
      requireActive(ctx);
      const id = assertId(p.split('/')[2]);
      const m = (
        await db.query(
          "DELETE FROM memberships WHERE id=$1 AND workspace_id=$2 AND role<>'owner' RETURNING user_id",
          [id, ctx.id],
        )
      ).rows[0];
      if (!m) throw fail('Không thể thu hồi tài khoản chủ hoặc không tìm thấy thành viên.');
      if (m.user_id) {
        await db.query('UPDATE customers SET assigned_to=NULL WHERE workspace_id=$1 AND assigned_to=$2', [
          ctx.id,
          m.user_id,
        ]);
        await db.query('DELETE FROM connections WHERE workspace_id=$1 AND user_id=$2', [ctx.id, m.user_id]);
      }
      await audit(db, ctx, 'membership.remove', id);
      return { ok: true };
    }

    if (p.startsWith('/connections/') && method === 'DELETE') {
      const provider = p.split('/')[2];
      if (provider === 'drive') permit(ctx, 'owner');
      await db.query('DELETE FROM connections WHERE workspace_id=$1 AND user_id=$2 AND provider=$3', [
        ctx.id,
        u.id,
        provider,
      ]);
      await audit(db, ctx, 'disconnect.' + provider, null);
      return { ok: true };
    }

    if (p === '/backup/export' && method === 'GET') return backup(db, ctx);
    if (p === '/backup/drive' && method === 'POST') return backupDrive(db, ctx);
    if (p === '/calendar/sync' && method === 'POST') {
      permit(ctx, 'write');
      requireActive(ctx);
      const c = (
        await db.query(
          "SELECT * FROM connections WHERE workspace_id=$1 AND user_id=$2 AND provider='calendar' FOR UPDATE",
          [ctx.id, u.id],
        )
      ).rows[0];
      if (!c) throw fail('Hãy kết nối Google Calendar trước.');
      const tasks = (await dataFor(db, ctx)).tasks;
      const count = await syncCalendar(db, c, tasks, origin);
      await audit(db, ctx, 'calendar.sync', null);
      return { count };
    }

    throw fail('Không tìm thấy chức năng.', 404);
  });
  json(res, 200, out);
}

async function staticFile(pathname) {
  const map = {
    '/': 'index.html',
    '/index.html': 'index.html',
    '/app.js': 'app.js',
    '/style.css': 'style.css',
  };
  if (map[pathname]) {
    try {
      await access(rootWeb + 'index.html');
      // Prefer SvelteKit build if present — SPA fallback
      if (pathname === '/' || pathname === '/index.html') {
        return { path: rootWeb + 'index.html', type: 'text/html; charset=utf-8' };
      }
    } catch {
      /* use dist */
    }
    const file = map[pathname];
    return {
      path: rootDist + file,
      type: file.endsWith('.js')
        ? 'text/javascript; charset=utf-8'
        : file.endsWith('.css')
          ? 'text/css; charset=utf-8'
          : 'text/html; charset=utf-8',
    };
  }
  // SvelteKit assets under /_app
  if (pathname.startsWith('/_app/') || pathname.startsWith('/icons/')) {
    return { path: rootWeb + pathname.slice(1), type: null };
  }
  try {
    await access(rootWeb + 'index.html');
    return { path: rootWeb + 'index.html', type: 'text/html; charset=utf-8' };
  } catch {
    throw fail('Không tìm thấy trang.', 404);
  }
}

export const handler = async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  );
  try {
    const url = new URL(req.url, origin);
    const hostname = (req.headers.host || '').split(':')[0].toLowerCase();
    const baseHostname = new URL(origin).hostname;
    let approved = hostname === baseHostname;
    if (!approved) {
      const db = await pool.connect();
      try {
        await db.query("SELECT set_config('app.platform_admin','true',true)");
        approved = !!(await db.query('SELECT 1 FROM domains WHERE hostname=$1 AND verified=true', [hostname])).rowCount;
      } finally {
        db.release();
      }
    }
    if (!approved) throw fail('Tên miền chưa được đăng ký hoặc xác minh.', 421);
    if (limited(req.socket.remoteAddress || 'unknown')) throw fail('Quá nhiều yêu cầu. Hãy thử lại sau một phút.', 429);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && url.pathname !== '/api/jobs/backups') {
      const incoming = req.headers.origin;
      if (!incoming || new URL(incoming).host !== req.headers.host) throw fail('Yêu cầu không cùng nguồn.', 403);
    }
    if (url.pathname === '/auth/google/start' || url.pathname === '/auth/google/connect') {
      return await oauthStart(req, res, url);
    }
    if (url.pathname === '/auth/google/callback') {
      try {
        return await oauthCallback(req, res, url);
      } catch (e) {
        return redirect(
          res,
          requestOrigin(req) + '/?error=' + encodeURIComponent(e.status ? e.message : 'Kết nối Google chưa thành công. Hãy thử lại.'),
        );
      }
    }
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    const file = await staticFile(url.pathname);
    if (file.type) res.setHeader('Content-Type', file.type);
    res.setHeader('Cache-Control', 'no-cache');
    res.end(await readFile(file.path));
  } catch (e) {
    const status = e.code === '23505' ? 409 : e.status || 500;
    const message =
      e.code === '23505'
        ? 'Dữ liệu trùng. Hãy kiểm tra số điện thoại, Gmail hoặc mã không gian.'
        : status === 500
          ? 'Máy chủ chưa xử lý được yêu cầu. Kiểm tra cấu hình và thử lại.'
          : e.message;
    if (status === 500) console.error('Request failed:', e.code || e.name, e.message);
    json(res, status, { error: message });
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = http.createServer(handler);
  server.listen(Number(env.PORT || 3000), '0.0.0.0', () =>
    console.log('Mayhomes CRM listening on port ' + (env.PORT || 3000)),
  );
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => server.close(() => pool.end().finally(() => process.exit(0))));
  }
}
