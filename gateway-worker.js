// Public HTTP and WebSocket entry. All business code runs over a service binding.
export default {
  async fetch(request, env) {
    try {
      return await env.BACKEND.fetch(request);
    } catch (error) {
      console.error('backend unavailable', error?.message || error);
      return new Response('Service temporarily unavailable', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }
  },
};
