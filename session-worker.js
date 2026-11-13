import { administrator } from './panel-auth.js';

export default {
  async fetch(request, env) {
    return Response.json({ authenticated: await administrator(request, env) }, {
      headers: { 'Cache-Control': 'no-store', 'Vary': 'Cookie' },
    });
  },
};
