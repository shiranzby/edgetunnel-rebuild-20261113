import { administrator, logout, privateCredentials } from './panel-auth.js';
import { renderPanel } from './panel-view-no-script1.js';
import { renderSettingsPage } from './settings-page.js';

const defaultSiteSettings = {
  pageTitle: 'ShyVPN EdgeTunnel',
  browserTitle: 'ShyVPN',
  logoUrl: '',
  faviconUrl: '',
  wallpaperUrl: '',
  wallpaperSize: 'cover',
};

async function siteSettings(env) {
  try {
    const stored = JSON.parse(await env.KV?.get('site-settings.json') || '{}');
    return { ...defaultSiteSettings, ...stored };
  } catch {
    return defaultSiteSettings;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/logout') return logout();
    const authenticated = await administrator(request, env);
    const origin = `https://${env.PROXY_HOST || env.HOST || 'shw.us.ci'}`;
    if (url.pathname === '/settings') {
      if (!authenticated) return Response.redirect(`${origin}/login?next=%2Fsettings`, 302);
      const credentials = await privateCredentials(env);
      return new Response(renderSettingsPage({
        origin, site: await siteSettings(env), adminUser: credentials.adminUser,
      }), {
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Vary': 'Cookie' },
      });
    }
    return new Response(renderPanel({
      authenticated, origin, branding: await siteSettings(env),
      preview: false,
    }), {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Vary': 'Cookie' },
    });
  },
};
