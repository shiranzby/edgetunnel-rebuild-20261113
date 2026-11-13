import { administrator, privateCredentials, privateJSON, sameOrigin } from './panel-auth.js';

async function text(env, key, fallback = '') {
  try {
    return await env.KV?.get(key) ?? fallback;
  } catch {
    return fallback;
  }
}

async function jsonValue(env, key, fallback = {}) {
  try {
    const value = await text(env, key, '');
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function hostOf(env) {
  return String(env.PROXY_HOST || env.HOST || 'shw.us.ci');
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const path = url.pathname.replace(/^\/__shy_admin/, '/admin');
      if (!(await administrator(request, env))) return privateJSON({ error: '请先登录管理员账号和密码' }, 401);
      if (request.method !== 'GET' && !sameOrigin(request)) {
        return privateJSON({ error: '请从本站提交操作' }, 403);
      }
      const credentials = await privateCredentials(env);
      if (path === '/admin/config.json' && request.method === 'GET') {
        const stored = await jsonValue(env, 'config.json', {});
        const config = { ...stored, HOST: hostOf(env), HOSTS: [hostOf(env)], UUID: credentials.uuid,
          PATH: stored.PATH || '/ws',
          优选订阅生成: { ...(stored.优选订阅生成 || {}), SUBNAME: stored.优选订阅生成?.SUBNAME || 'ShyVPN',
            TOKEN: credentials.subToken, local: true } };
        return privateJSON(config);
      }
      if (path === '/admin/config.json' && request.method === 'POST') {
        let value;
        try { value = await request.json(); } catch { return privateJSON({ error: '配置格式错误' }, 400); }
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
          return privateJSON({ error: '配置必须是 JSON 对象' }, 400);
        }
        await env.KV?.put('config.json', JSON.stringify({
          ...value, HOST: hostOf(env), HOSTS: [hostOf(env)], UUID: credentials.uuid,
          优选订阅生成: { ...(value.优选订阅生成 || {}), TOKEN: credentials.subToken, local: true },
        }));
        return privateJSON({ success: true });
      }
      if (path === '/admin/log.json' && request.method === 'GET') {
        return new Response(await text(env, 'log.json', '[]'), {
          headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
        });
      }
      if (path === '/admin/cf.json' && request.method === 'GET') return privateJSON(await jsonValue(env, 'cf.json', {}));
      if (path === '/admin/tg.json' && request.method === 'GET') return privateJSON(await jsonValue(env, 'tg.json', {}));
      if (path === '/admin/ADD.txt' && request.method === 'GET') {
        return new Response(await text(env, 'ADD.txt', ''), {
          headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
        });
      }
      if (path === '/admin/ADD.txt' && request.method === 'POST') {
        await env.KV?.put('ADD.txt', await request.text());
        return new Response('保存成功', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
      if (path === '/admin/init' && request.method === 'POST') {
        await env.KV?.put('config.json', JSON.stringify({ HOST: hostOf(env), HOSTS: [hostOf(env)],
          UUID: credentials.uuid, PATH: '/ws', 协议类型: 'vless', 传输协议: 'ws',
          优选订阅生成: { SUBNAME: 'ShyVPN', TOKEN: credentials.subToken, local: true } }));
        return privateJSON({ success: true });
      }
      return new Response('Not Found', { status: 404 });
    } catch (error) {
      console.error('admin failed', error?.stack || error);
      return privateJSON({ error: '管理接口暂时不可用' }, 503);
    }
  },
};
