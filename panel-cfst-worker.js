import source from './upstream/panel-script1-lazy-module.js';

export default {
  async fetch() {
    return new Response(source, {
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  },
};
