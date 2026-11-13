// Preserve the real cmliu panel and its KV APIs; never expose its proxy fallback.
import upstream from './upstream/cmliu-worker.js';

export default {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;
    if (!/^\/(?:login|logout|admin(?:\/.*)?)$/.test(path) ||
        (request.headers.get('Upgrade') || '').toLowerCase() === 'websocket') {
      return new Response('Not Found', { status: 404 });
    }
    // The public subscription layer owns /sub; this Worker only serves the panel.
    try {
      const response = await upstream.fetch(request, env, ctx);
      if (path === '/admin/config.json' && request.method === 'GET' && response.status === 200) {
        const config = await response.json();
        config.优选订阅生成.TOKEN = env.SUB_TOKEN;
        return Response.json(config, { headers: { 'Cache-Control': 'no-store' } });
      }
      return response;
    } catch (error) {
      console.error('panel failed', error?.stack || error);
      return Response.json({ error: 'panel unavailable', detail: String(error?.message || error) },
                           { status: 503 });
    }
  },
};
