import { administrator, logout } from './panel-auth.js';
import { renderPanel } from './panel-view-no-script1.js';

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname === '/logout') return logout();
    const authenticated = await administrator(request, env);
    return new Response(renderPanel({
      authenticated,
      origin: `https://${env.PROXY_HOST || env.HOST || 'shw.us.ci'}`,
      preview: false,
    }), {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Vary': 'Cookie' },
    });
  },
};
