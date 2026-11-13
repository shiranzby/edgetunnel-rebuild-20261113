const COOKIE = 'shy_admin';
const lifetime = 86400;
const encoder = new TextEncoder();

export async function privateCredentials(env) {
  if (env.ADMIN && env.KEY && env.UUID && env.SUB_TOKEN) {
    return {
      admin: String(env.ADMIN),
      key: String(env.KEY),
      uuid: String(env.UUID),
      subToken: String(env.SUB_TOKEN),
      legacySubToken: String(env.LEGACY_SUB_TOKEN || ''),
    };
  }
  try {
    const raw = await env.KV?.get('shy-private-auth.json');
    const value = raw ? JSON.parse(raw) : {};
    return {
      admin: String(env.ADMIN || value.ADMIN || ''),
      key: String(env.KEY || value.KEY || ''),
      uuid: String(env.UUID || value.UUID || ''),
      subToken: String(env.SUB_TOKEN || value.SUB_TOKEN || ''),
      legacySubToken: String(env.LEGACY_SUB_TOKEN || value.LEGACY_SUB_TOKEN || ''),
    };
  } catch {
    return {
      admin: String(env.ADMIN || ''),
      key: String(env.KEY || ''),
      uuid: String(env.UUID || ''),
      subToken: String(env.SUB_TOKEN || ''),
      legacySubToken: String(env.LEGACY_SUB_TOKEN || ''),
    };
  }
}

function encode(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decode(text) {
  return Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0));
}

async function signingKey(env, credentials) {
  return crypto.subtle.importKey('raw', encoder.encode(`${credentials.key}:${credentials.admin}:${env.ADMIN_USER || 'admin'}`),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
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
    return claims.user === (env.ADMIN_USER || 'admin') && Number.isFinite(claims.expires) &&
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
  if (fields.username !== (env.ADMIN_USER || 'admin') || fields.password !== credentials.admin) {
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
