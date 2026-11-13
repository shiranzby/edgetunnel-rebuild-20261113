// Public entry point. Keep panel, subscription, and WebSocket protocol engines
// in separate Workers so a browser request cannot initialize the protocol
// engine by accident.
function isNodeWebSocket(request, url) {
  const upgrade = (request.headers.get('Upgrade') || '').toLowerCase() === 'websocket';
  const key = request.headers.get('Sec-WebSocket-Key') || '';
  const path = url.pathname.replace(/\/+$/, '') || '/';
  return upgrade && key && (path === '/ws' || path === '/compat');
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const legacyBackend = env.BACKEND && !env.NODE && !env.PANEL && !env.SUB;
      const websocketUpgrade = (request.headers.get('Upgrade') || '').toLowerCase() === 'websocket';
      if (url.hostname === 'shyvpn.cc.cd' &&
          ['GET', 'HEAD'].includes(request.method) &&
          ['/', '/admin', '/login', '/best'].includes(url.pathname) &&
          !isNodeWebSocket(request, url) && !(legacyBackend && websocketUpgrade)) {
        url.hostname = 'shw.us.ci';
        return new Response(null, {
          status: 302,
          headers: { Location: url.href, 'Cache-Control': 'no-store' },
        });
      }

      if (legacyBackend) {
        return env.BACKEND.fetch(request);
      }
      if (isNodeWebSocket(request, url)) return env.NODE.fetch(request);
      if (url.pathname === '/' ||
          /^\/(?:login|logout|session|public\/config\.json|admin(?:\/.*)?)$/.test(url.pathname)) {
        return env.PANEL.fetch(request);
      }
      return env.SUB.fetch(request);
    } catch (error) {
      console.error('gateway unavailable', error?.stack || error);
      return new Response('Service temporarily unavailable', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }
  },
};
