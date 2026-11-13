// Use the current cmliu protocol engine with all upstream fallback paths disabled.
import { upstreamWebSocket } from './upstream/cmliu-worker.js';

export default {
  async fetch(request, env) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(env.UUID || '')) {
      return new Response('Node not configured', { status: 503 });
    }
    return upstreamWebSocket(request, env.UUID, new URL(request.url), {
      木马反代地址: null,
      反代IP: '',
      代理类型: null,
      代理账号: '',
      代理全局: false,
      代理参数: {},
      反代兜底: false,
    });
  },
};
