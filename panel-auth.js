const COOKIE = 'shy_admin';
const lifetime = 86400;
const encoder = new TextEncoder();

async function readJSON(env, key) {
  try {
    const raw = await env.KV?.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function privateCredentials(env) {
  let value = {};
  try {
    value = await readJSON(env, 'shy-private-auth.json') || {};
  } catch {}
  const online = await readJSON(env, 'admin-auth.json');
  const onlineValid = online && typeof online.username === 'string' &&
    /^[\w.@-]{1,64}$/.test(online.username) &&
    typeof online.salt === 'string' && online.salt.length >= 16 &&
    typeof online.passwordHash === 'string' && online.passwordHash.length >= 32;
  return {
    // When an online credential record exists, use its hash as the signing secret.
    // This makes every account/password change invalidate existing cookies.
    admin: String(onlineValid ? online.passwordHash : (env.ADMIN || value.ADMIN || '')),
    adminUser: String(onlineValid ? online.username : (env.ADMIN_USER || 'admin')),
    passwordHash: onlineValid ? online.passwordHash : '',
    passwordSalt: onlineValid ? online.salt : '',
    key: String(env.KEY || value.KEY || ''),
    uuid: String(env.UUID || value.UUID || ''),
    subToken: String(env.SUB_TOKEN || value.SUB_TOKEN || ''),
    legacySubToken: String(env.LEGACY_SUB_TOKEN || value.LEGACY_SUB_TOKEN || ''),
  };
}

function encode(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decode(text) {
  return Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0));
}

async function signingKey(env, credentials) {
  return crypto.subtle.importKey('raw', encoder.encode(`${credentials.key}:${credentials.admin}:${credentials.adminUser}`),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

function hex(bytes) {
  return Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(password, salt) {
  return hex(await crypto.subtle.digest('SHA-256', encoder.encode(`${salt}:${password}`)));
}

export function newPasswordSalt() {
  return crypto.randomUUID() + crypto.randomUUID();
}

export async function administrator(request, env) {
  const credentials = await privateCredentials(env);
  if (!credentials.admin) return false;
  try {
    const value = request.headers.get('Cookie')?.split(';').map(value => value.trim()).find(value => value.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
    const [payload, signature, extra] = (value || '').split('.');
    if (!payload || !signature || extra) return false;
    const valid = await crypto.subtle.verify('HMAC', await signingKey(env, credentials), decode(signature), encoder.encode(payload));
    if (!valid) return false;
    const claims = JSON.parse(new TextDecoder().decode(decode(payload)));
    return claims.user === credentials.adminUser && Number.isFinite(claims.expires) &&
      claims.expires > Date.now() && claims.expires <= Date.now() + lifetime * 1000;
  } catch {
    return false;
  }
}

export function privateJSON(value, status = 200, extra = {}) {
  return Response.json(value, { status, headers: { 'Cache-Control': 'no-store', 'Vary': 'Cookie',
    'X-Content-Type-Options': 'nosniff', ...extra } });
}

export function sameOrigin(request) {
  return request.headers.get('Origin') === new URL(request.url).origin;
}

export async function login(request, env) {
  const credentials = await privateCredentials(env);
  if (!credentials.admin) return privateJSON({ success: false, error: '管理员尚未配置' }, 503);
  if (!sameOrigin(request)) return privateJSON({ success: false, error: '请从本站登录' }, 403);
  let fields;
  try {
    fields = (request.headers.get('Content-Type') || '').includes('application/json') ?
      await request.json() : Object.fromEntries(new URLSearchParams(await request.text()));
  } catch {
    return privateJSON({ success: false, error: '登录信息格式错误' }, 400);
  }
  const usernameOk = fields.username === credentials.adminUser;
  const passwordOk = credentials.passwordHash ?
    fields.password && (await hashPassword(String(fields.password), credentials.passwordSalt)) === credentials.passwordHash :
    fields.password === credentials.admin;
  if (!usernameOk || !passwordOk) {
    return privateJSON({ success: false, error: '管理员账号或密码错误' }, 401);
  }
  const payload = encode(encoder.encode(JSON.stringify({ user: fields.username,
    expires: Date.now() + lifetime * 1000, nonce: crypto.randomUUID() })));
  const signature = encode(new Uint8Array(await crypto.subtle.sign('HMAC', await signingKey(env, credentials), encoder.encode(payload))));
  return privateJSON({ success: true }, 200, {
    'Set-Cookie': `${COOKIE}=${payload}.${signature}; Path=/; Max-Age=${lifetime}; HttpOnly; Secure; SameSite=Strict`,
  });
}

export function logout() {
  return new Response(null, { status: 302, headers: { Location: '/', 'Cache-Control': 'no-store',
    'Set-Cookie': `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict` } });
}
