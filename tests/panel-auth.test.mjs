import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import panel, { publicConfig } from '../panel-worker.js';
import gateway from '../gateway-worker.js';
import admin from '../admin-worker.js';
import { administrator } from '../panel-auth.js';
import loginWorker from '../login-worker.js';
import { renderSettingsPage } from '../settings-page.js';
import { upstreamPanelCookieHash } from '../upstream/cmliu-worker.js';

// Workers WebCrypto supports MD5; Node WebCrypto needs a real MD5 adapter for this upstream API.
const digest = crypto.subtle.digest.bind(crypto.subtle);
crypto.subtle.digest = async (algorithm, data) => String(algorithm).toUpperCase() === 'MD5' ?
  Uint8Array.from(createHash('md5').update(new Uint8Array(data)).digest()).buffer : digest(algorithm, data);

const origin = 'https://shw.us.ci';
const env = { ADMIN_USER: 'admin', ADMIN: 'fixture-admin-password', KEY: 'fixture-signing-key',
  UUID: '11111111-1111-4111-8111-111111111111', SUB_TOKEN: 'fixture-private-token',
  HOST: 'shw.us.ci', PROXY_HOST: 'shw.us.ci' };
const ctx = { waitUntil(promise) { promise.catch(() => {}); } };
const request = (path, options = {}) => new Request(origin + path, options);
async function signIn(overrides = {}, extraHeaders = {}) {
  return panel.fetch(request('/login', { method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify({ username: 'admin', password: env.ADMIN, ...overrides }) }), env, ctx);
}
const authenticated = await signIn();
const cookie = authenticated.headers.get('Set-Cookie').split(';')[0];
const legacyCookie = 'auth=' + await upstreamPanelCookieHash('null' + env.KEY + env.ADMIN);

test('homepage is the original full page with three account gates and no outer panel frame', async () => {
  const response = await panel.fetch(request('/'), env, ctx);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /class="shy-guest"/);
  assert.equal((html.match(/data-protected="/g) || []).length, 3);
  assert.equal((html.match(/class="shy-login-prompt"/g) || []).length, 3);
  assert.match(html, /id="modeToggleBtn"[\s\S]*?<\/button><a[^>]*id="shy-rankings"/);
  assert.doesNotMatch(html, /id="panel"/);
  assert.match(html, /name="username"[^>]*value=""/);
  assert.doesNotMatch(html, /name="username"[^>]*value="shiran"/);
  for (const secret of [env.ADMIN, env.KEY, env.UUID, env.SUB_TOKEN]) assert.ok(!html.includes(secret));
});

test('guest JSON is an explicit public projection, including when KV contains nested credentials', async () => {
  const sensitive = { UUID: env.UUID, LINK: 'vless://' + env.UUID,
    优选订阅生成: { TOKEN: env.SUB_TOKEN, SUBNAME: 'ShyVPN' },
    TG: { BotToken: 'fixture-bot-token' }, CF: { GlobalAPIKey: 'fixture-cf-key' },
    反代: { SOCKS5: { 账号: 'private-proxy-password' } } };
  const data = await publicConfig({ ...env, KV: { get: async () => JSON.stringify(sensitive) } });
  const rendered = JSON.stringify(data);
  for (const value of [env.UUID, env.SUB_TOKEN, 'fixture-bot-token', 'fixture-cf-key', 'private-proxy-password']) assert.ok(!rendered.includes(value));
  assert.equal(data.HOST, env.HOST);
  assert.equal(data.优选订阅生成.TOKEN, undefined);
});

test('both the administrator username and password are required', async () => {
  assert.equal((await signIn({ username: 'someone-else' })).status, 401);
  assert.equal((await signIn({ password: 'wrong' })).status, 401);
  assert.equal((await signIn({ username: undefined })).status, 401);
  assert.equal((await signIn({}, { Origin: 'https://other.example' })).status, 403);
  assert.equal(authenticated.status, 200);
  assert.match(authenticated.headers.get('Set-Cookie'), /HttpOnly; Secure; SameSite=Strict/);
});

test('all private endpoints reject guests, subscription tokens and old upstream cookies', async () => {
  for (const path of ['/admin/config.json', '/admin/log.json', '/admin/cf.json', '/admin/tg.json', '/admin/ADD.txt', '/admin/init', '/admin/getCloudflareUsage']) {
    for (const extra of [{}, { Cookie: legacyCookie }]) {
      const response = await panel.fetch(request(path + '?token=' + env.SUB_TOKEN, { headers: extra }), env, ctx);
      assert.equal(response.status, 401, path);
      assert.equal(response.headers.get('Location'), null);
    }
  }
});

test('signed account sessions reject tampering and rotated credentials', async () => {
  assert.equal(await administrator(request('/', { headers: { Cookie: cookie } }), env), true);
  assert.equal(await administrator(request('/', { headers: { Cookie: cookie + 'x' } }), env), false);
  assert.equal(await administrator(request('/', { headers: { Cookie: cookie } }), { ...env, ADMIN: 'rotated' }), false);
  const expired = btoa(JSON.stringify({ user: 'admin', expires: 1 }));
  assert.equal(await administrator(request('/', { headers: { Cookie: 'shy_admin=' + expired + '.invalid' } }), env), false);
});

test('authenticated private config uses the project token and state-changing calls require same-origin POST', async () => {
  const storage = new Map();
  const privateEnv = { ...env, KV: { get: async key => storage.get(key) || null,
    put: async (key, value) => { storage.set(key, value); } } };
  const response = await panel.fetch(request('/admin/config.json', { headers: { Cookie: cookie } }), privateEnv, ctx);
  assert.equal(response.status, 200);
  const config = await response.json();
  assert.equal(config.UUID, env.UUID);
  assert.equal(config.优选订阅生成.TOKEN, env.SUB_TOKEN);
  assert.equal((await panel.fetch(request('/admin/init', { headers: { Cookie: cookie, Origin: origin } }), privateEnv, ctx)).status, 405);
  const foreign = await panel.fetch(request('/admin/config.json', { method: 'POST',
    headers: { Cookie: cookie, Origin: 'https://other.example', 'Content-Type': 'application/json' }, body: '{}' }), privateEnv, ctx);
  assert.equal(foreign.status, 403);
  const html = await (await panel.fetch(request('/'), privateEnv, ctx)).text();
  assert.ok(!html.includes(env.UUID));
});

test('logout clears the account cookie and returns to the public homepage', async () => {
  const response = await panel.fetch(request('/logout', { headers: { Cookie: cookie } }), env, ctx);
  assert.equal(response.status, 302);
  assert.match(response.headers.get('Set-Cookie'), /Max-Age=0/);
  assert.equal(response.headers.get('Location'), '/');
});

test('legacy browser pages redirect without redirecting subscriptions or WebSocket nodes', async () => {
  let calls = 0;
  const binding = { BACKEND: { async fetch() { calls++; return new Response('backend'); } } };
  for (const path of ['/', '/admin', '/login', '/best?q=mobile']) {
    const response = await gateway.fetch(new Request('https://shyvpn.cc.cd' + path), binding);
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('Location'), origin + path);
  }
  assert.equal(calls, 0);
  for (const path of ['/sub?token=keep&clash', '/v2ray?token=keep']) {
    assert.equal((await gateway.fetch(new Request('https://shyvpn.cc.cd' + path), binding)).status, 200);
  }
  assert.equal((await gateway.fetch(new Request('https://shyvpn.cc.cd/', { headers: { Upgrade: 'websocket' } }), binding)).status, 200);
  assert.equal(calls, 3);
});

test('online settings are protected, branding is public-safe, and credential rotation invalidates old sessions', async () => {
  const storage = new Map();
  const mutableEnv = { ...env, KV: {
    get: async key => storage.get(key) || null,
    put: async (key, value) => { storage.set(key, value); },
  } };
  const initialLogin = await loginWorker.fetch(request('/login', {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: env.ADMIN }),
  }), mutableEnv, ctx);
  const initialCookie = initialLogin.headers.get('Set-Cookie').split(';')[0];
  assert.equal((await admin.fetch(request('/__shy_admin/site-settings.json', {
    headers: { Cookie: initialCookie },
  }), mutableEnv, ctx)).status, 200);
  const invalid = await admin.fetch(request('/__shy_admin/site-settings.json', {
    method: 'POST', headers: { Cookie: initialCookie, Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ site: { pageTitle: 'x', browserTitle: 'x', logoUrl: 'javascript:alert(1)' } }),
  }), mutableEnv, ctx);
  assert.equal(invalid.status, 400);
  const valid = await admin.fetch(request('/__shy_admin/site-settings.json', {
    method: 'POST', headers: { Cookie: initialCookie, Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ site: { pageTitle: '测试标题', browserTitle: '测试标签', logoUrl: 'https://example.com/logo.png',
      faviconUrl: '/favicon.ico', wallpaperUrl: 'https://example.com/wallpaper.jpg', wallpaperSize: 'contain' } }),
  }), mutableEnv, ctx);
  assert.equal(valid.status, 200);
  const settings = await valid.json();
  assert.equal(settings.site.pageTitle, '测试标题');
  assert.equal(settings.site.logoUrl, 'https://example.com/logo.png');
  assert.doesNotMatch(JSON.stringify(settings), /fixture-admin-password|fixture-signing-key/);
  const rotated = await admin.fetch(request('/__shy_admin/credentials', {
    method: 'POST', headers: { Cookie: initialCookie, Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword: env.ADMIN, username: 'new-admin',
      password: 'new-password-8', confirmPassword: 'new-password-8' }),
  }), mutableEnv, ctx);
  assert.equal(rotated.status, 200);
  assert.match(rotated.headers.get('Set-Cookie'), /Max-Age=0/);
  assert.equal(await administrator(request('/', { headers: { Cookie: initialCookie } }), mutableEnv), false);
  const newLogin = await loginWorker.fetch(request('/login', {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'new-admin', password: 'new-password-8' }),
  }), mutableEnv, ctx);
  assert.equal(newLogin.status, 200);
  const rendered = renderSettingsPage({ site: settings.site, adminUser: 'new-admin' });
  assert.ok(!rendered.includes('new-password-8'));
  assert.ok(rendered.includes('当前管理员账号'));
});
