import { administrator, logout } from './panel-auth.js';
import { renderPanel } from './panel-view-no-script1.js';

function addEnhancementScript(html) {
  const bootstrap = `<script data-cfasync="false">(()=>{const s=document.createElement('script');s.async=false;s.src='/__shy_'+'panel_cfst.js';(document.body||document.documentElement).appendChild(s)})();</script>`;
  const index = html.lastIndexOf('</body>');
  return index < 0 ? html + bootstrap : html.slice(0, index) + bootstrap + html.slice(index);
}

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname === '/logout') return logout();
    const authenticated = await administrator(request, env);
    return new Response(addEnhancementScript(renderPanel({
      authenticated,
      origin: `https://${env.PROXY_HOST || env.HOST || 'shw.us.ci'}`,
      preview: false,
    })), {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Vary': 'Cookie' },
    });
  },
};
