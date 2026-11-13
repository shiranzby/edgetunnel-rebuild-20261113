import { login } from './panel-auth.js';

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return new Response('', { status: 405, headers: { Allow: 'POST' } });
    return login(request, env);
  },
};
