import {
  administrator, hashPassword, newPasswordSalt, privateCredentials, privateJSON, sameOrigin,
} from './panel-auth.js';

const defaultSiteSettings = {
  pageTitle: 'ShyVPN EdgeTunnel',
  browserTitle: 'ShyVPN',
  logoUrl: '',
  faviconUrl: '',
  wallpaperUrl: '',
  wallpaperSize: 'cover',
};

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

function cleanText(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function cleanAssetUrl(value) {
  const text = cleanText(value, 2048);
  if (!text) return '';
  if (text.startsWith('/')) return /^[\w./?&#=%:+~-]+$/.test(text) ? text : null;
  try {
    const url = new URL(text);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function normalizeSiteSettings(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const pageTitle = cleanText(value.pageTitle, 80);
  const browserTitle = cleanText(value.browserTitle, 80);
  const logoUrl = cleanAssetUrl(value.logoUrl);
  const faviconUrl = cleanAssetUrl(value.faviconUrl);
  const wallpaperUrl = cleanAssetUrl(value.wallpaperUrl);
  if (!pageTitle || !browserTitle || logoUrl === null || faviconUrl === null || wallpaperUrl === null) return null;
  const wallpaperSize = ['cover', 'contain', 'auto'].includes(value.wallpaperSize) ? value.wallpaperSize : 'cover';
  return { pageTitle, browserTitle, logoUrl, faviconUrl, wallpaperUrl, wallpaperSize };
}

function clearCookie() {
  return 'shy_admin=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict';
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
      if (path === '/admin/site-settings.json' && request.method === 'GET') {
        const stored = await jsonValue(env, 'site-settings.json', {});
        const site = normalizeSiteSettings({ ...defaultSiteSettings, ...stored }) || defaultSiteSettings;
        return privateJSON({ site, adminUser: credentials.adminUser, updatedAt: stored.updatedAt || null });
      }
      if (path === '/admin/site-settings.json' && request.method === 'POST') {
        if (!env.KV?.put) return privateJSON({ error: '当前部署未绑定 KV，无法保存网站外观' }, 503);
        let value;
        try { value = await request.json(); } catch { return privateJSON({ error: '设置格式错误' }, 400); }
        const site = normalizeSiteSettings(value?.site);
        if (!site) return privateJSON({ error: '标题或图片地址无效，仅支持 http(s) 或安全相对路径' }, 400);
        await env.KV?.put('site-settings.json', JSON.stringify({ ...site, updatedAt: new Date().toISOString() }));
        return privateJSON({ success: true, site });
      }
      if (path === '/admin/credentials' && request.method === 'POST') {
        if (!env.KV?.put) return privateJSON({ error: '当前部署未绑定 KV，无法在线修改账号密码' }, 503);
        let value;
        try { value = await request.json(); } catch { return privateJSON({ error: '账号设置格式错误' }, 400); }
        const currentPassword = String(value?.currentPassword || '');
        const currentPasswordOk = credentials.passwordHash ?
          currentPassword && (await hashPassword(currentPassword, credentials.passwordSalt)) === credentials.passwordHash :
          currentPassword === credentials.admin;
        if (!currentPasswordOk) return privateJSON({ error: '当前密码错误' }, 401);
        const username = cleanText(value?.username, 64);
        const password = String(value?.password || '');
        const confirmPassword = String(value?.confirmPassword || '');
        if (!/^[\w.@-]{1,64}$/.test(username)) return privateJSON({ error: '新管理员账号格式无效' }, 400);
        if (password.length < 8) return privateJSON({ error: '新密码至少需要 8 个字符' }, 400);
        if (password !== confirmPassword) return privateJSON({ error: '两次输入的新密码不一致' }, 400);
        const salt = newPasswordSalt();
        const passwordHash = await hashPassword(password, salt);
        await env.KV.put('admin-auth.json', JSON.stringify({
          username, salt, passwordHash, updatedAt: new Date().toISOString(),
        }));
        return privateJSON({ success: true, adminUser: username }, 200, { 'Set-Cookie': clearCookie() });
      }
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
