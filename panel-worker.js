import { administrator, privateJSON, login, logout, sameOrigin } from './panel-auth.js';
import { privateCredentials } from './panel-auth.js';
import { renderPanel } from './panel-view.js';

async function readKVJSON(env, key, fallback = {}) {
  try {
    const raw = await env.KV?.get(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

async function readKVText(env, key, fallback = '') {
  try {
    return await env.KV?.get(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function baseConfig(env, credentials) {
  const host = String(env.PROXY_HOST || env.HOST || 'shw.us.ci');
  return {
    HOST: host,
    HOSTS: [host],
    UUID: credentials.uuid,
    LINK: '',
    PATH: '/ws',
    协议类型: 'vless',
    传输协议: 'ws',
    指纹: 'chrome',
    Fingerprint: 'chrome',
    跳过证书验证: false,
    优选订阅生成: {
      SUBNAME: 'ShyVPN',
      TOKEN: credentials.subToken,
      local: true,
      本地IP库: { 随机IP: true, 随机数量: 16, 指定端口: 443 },
    },
    订阅转换配置: { SUBAPI: '', SUBCONFIG: '', SUBEMOJI: false },
    反代: { PROXYIP: '', SOCKS5: { 启用: null, 全局: false, 账号: '', 白名单: [] } },
    TG: {},
    CF: {},
  };
}

async function privateConfig(env, credentials) {
  const stored = await readKVJSON(env, 'config.json', {});
  const defaults = baseConfig(env, credentials);
  const config = { ...defaults, ...stored };
  config.HOST = String(env.PROXY_HOST || env.HOST || config.HOST || defaults.HOST);
  config.HOSTS = Array.isArray(stored.HOSTS) && stored.HOSTS.length ? stored.HOSTS : [config.HOST];
  config.UUID = credentials.uuid || stored.UUID || defaults.UUID;
  config.PATH = stored.PATH || defaults.PATH;
  config.优选订阅生成 = { ...defaults.优选订阅生成, ...(stored.优选订阅生成 || {}) };
  config.优选订阅生成.TOKEN = credentials.subToken;
  config.优选订阅生成.local = true;
  config.优选订阅生成.本地IP库 = {
    ...defaults.优选订阅生成.本地IP库,
    ...(stored.优选订阅生成?.本地IP库 || {}),
  };
  return config;
}

export async function publicConfig(env) {
  let stored = {};
  try { stored = JSON.parse(await env.KV?.get('config.json') || '{}'); } catch {}
  const sub = stored.优选订阅生成 || {};
  const host = env.PROXY_HOST || env.HOST || 'shw.us.ci';
  // Explicit projection: never spread the private configuration into a guest response.
  return {
    HOST: host, HOSTS: [host], UUID: '', LINK: '', PATH: '/',
    协议类型: 'vless', 传输协议: 'ws', 指纹: 'chrome',
    优选订阅生成: { SUBNAME: typeof sub.SUBNAME === 'string' ? sub.SUBNAME : 'ShyVPN',
      local: true, 本地IP库: { 随机IP: true, 随机数量: 16, 指定端口: 443 } },
    订阅转换配置: { SUBAPI: '', SUBCONFIG: '', SUBEMOJI: false },
    反代: { PROXYIP: '', SOCKS5: { 启用: null, 全局: false, 账号: '', 白名单: [] } },
    TG: {}, CF: {}, 加载时间: new Date().toISOString(), publicReadOnly: true,
  };
}

export default {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;
    if ((request.headers.get('Upgrade') || '').toLowerCase() === 'websocket') {
      return new Response('Not Found', { status: 404 });
    }
    try {
      if (path === '/login' && request.method === 'POST') return login(request, env);
      if (path === '/logout') return logout();
      if (path === '/public/config.json' && request.method === 'GET') {
        return privateJSON(await publicConfig(env), 200, { 'Access-Control-Allow-Origin': '*' });
      }
      const authenticated = await administrator(request, env);
      if (path === '/session') return privateJSON({ authenticated });
      if (['/', '/admin', '/login'].includes(path) && ['GET', 'HEAD'].includes(request.method)) {
        return new Response(request.method === 'HEAD' ? null : renderPanel({
          authenticated, origin: 'https://' + (env.PROXY_HOST || env.HOST || 'shw.us.ci'),
          preview: env.STATIC_PREVIEW === 'true',
        }), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
          'Vary': 'Cookie', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin' } });
      }
      if (!path.startsWith('/admin/')) return new Response('Not Found', { status: 404 });
      if (!authenticated) return privateJSON({ error: '请先登录管理员账号和密码' }, 401);
      if ((request.method !== 'GET' && request.method !== 'HEAD') || path === '/admin/init') {
        if (!sameOrigin(request)) return privateJSON({ error: '请从本站提交操作' }, 403);
        if (path === '/admin/init' && request.method !== 'POST') {
          return privateJSON({ error: '重置配置需要 POST 请求' }, 405, { Allow: 'POST' });
        }
      }
      // Only a verified account session can obtain an internal upstream cookie.
      const credentials = await privateCredentials(env);
      const headers = new Headers(request.headers);
      if (path === '/admin/config.json' && request.method === 'GET') {
        return privateJSON(await privateConfig(env, credentials));
      }
      if (path === '/admin/config.json' && request.method === 'POST') {
        let value;
        try { value = await request.json(); } catch { return privateJSON({ error: '配置格式错误' }, 400); }
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
          return privateJSON({ error: '配置必须是 JSON 对象' }, 400);
        }
        await env.KV?.put('config.json', JSON.stringify({
          ...value,
          UUID: credentials.uuid,
          HOST: env.PROXY_HOST || env.HOST || value.HOST,
          HOSTS: Array.isArray(value.HOSTS) && value.HOSTS.length ? value.HOSTS : [env.PROXY_HOST || env.HOST],
          优选订阅生成: { ...(value.优选订阅生成 || {}), TOKEN: credentials.subToken, local: true },
        }));
        return privateJSON(await privateConfig(env, credentials));
      }
      if (path === '/admin/log.json' && request.method === 'GET') {
        return new Response(await readKVText(env, 'log.json', '[]'), {
          status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
        });
      }
      if (path === '/admin/cf.json' && request.method === 'GET') {
        return privateJSON(await readKVJSON(env, 'cf.json', {}));
      }
      if (path === '/admin/tg.json' && request.method === 'GET') {
        return privateJSON(await readKVJSON(env, 'tg.json', {}));
      }
      if (path === '/admin/ADD.txt' && request.method === 'GET') {
        return new Response(await readKVText(env, 'ADD.txt', ''), {
          status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
        });
      }
      if (path === '/admin/ADD.txt' && request.method === 'POST') {
        await env.KV?.put('ADD.txt', await request.text());
        return new Response('保存成功', { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
      if (path === '/admin/init' && request.method === 'POST') {
        await env.KV?.put('config.json', JSON.stringify(baseConfig(env, credentials)));
        return privateJSON({ success: true });
      }
      if (path === '/admin/init') return privateJSON({ error: '重置配置需要 POST 请求' }, 405, { Allow: 'POST' });
      if (path === '/admin/getCloudflareUsage' || path === '/admin/getADDAPI' || path === '/admin/check') {
        return privateJSON({ error: '此独立面板不启用个人代理或 Cloudflare 私钥查询' }, 501);
      }
      return new Response('Not Found', { status: 404 });
    } catch (error) {
      console.error('panel failed', error?.stack || error);
      return privateJSON({ error: '面板暂时不可用' }, 503);
    }
  },
};
