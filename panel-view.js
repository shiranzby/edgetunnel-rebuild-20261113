import template from './upstream/panel-template.js';

const protectedTitles = [
  ['获取节点链接', 'links'],
  ['详细配置信息', 'configuration'],
  ['查看操作日志', 'logs'],
];

function loginForm() {
  return `<form class="shy-login-form"><label>管理员账号<input name="username" autocomplete="username" value="admin" required></label>
<label>管理员密码<input name="password" type="password" autocomplete="current-password" placeholder="请输入管理员密码" required></label>
<button class="btn btn-primary" type="submit">登录并查看</button><p class="shy-login-status" role="status"></p></form>`;
}

function enhancePanel(meta) {
  const originalFetch = window.fetch.bind(window);
  const showLogin = () => {
    if (meta.preview) { location.href = meta.origin + '/login'; return; }
    document.getElementById('shy-login-dialog').showModal();
  };
  window.shyOpenLogin = showLogin;
  window.fetch = async (input, options) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    const method = (options?.method || input?.method || 'GET').toUpperCase();
    if (url.origin === location.origin && url.pathname === '/admin/config.json' && !meta.authenticated && method === 'GET') {
      return originalFetch(meta.preview ? meta.origin + '/public/config.json' : '/public/config.json',
        { ...options, credentials: meta.preview ? 'omit' : 'same-origin' });
    }
    if (url.origin === location.origin && url.pathname.startsWith('/admin/') && !meta.authenticated) {
      showLogin();
      return new Response(JSON.stringify({ error: '请先登录管理员账号' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.origin === location.origin && url.pathname.startsWith('/admin/')) {
      url.pathname = '/__shy_admin' + url.pathname.slice('/admin'.length);
      const rewritten = typeof input === 'string' ? new Request(url, options) : new Request(url, input);
      const response = await originalFetch(rewritten);
      if (response.status === 401) location.reload();
      return response;
    }
    const response = await originalFetch(input, options);
    if (url.origin === location.origin && url.pathname.startsWith('/admin/') && response.status === 401) location.reload();
    return response;
  };
  // The presentation domain is intentionally independent of the node's Host.
  checkHostsMismatch = () => {};
  const upstreamRender = renderUI;
  renderUI = function () {
    upstreamRender();
    document.title = (currentConfig.优选订阅生成?.SUBNAME || 'ShyVPN') + ' 设置页面';
    if (meta.authenticated) {
      const token = encodeURIComponent(currentConfig.优选订阅生成.TOKEN);
      const base = meta.origin + '/sub?token=' + token;
      const links = { subLink: base, base64Link: base + '&v2ray', clashLink: base + '&clash',
        singboxLink: base + '&singbox', compatClashLink: base + '&clash&compat=1' };
      for (const [id, value] of Object.entries(links)) document.getElementById(id).value = value;
      document.getElementById('shy-import-sparkle').href = 'clash://install-config?url=' +
        encodeURIComponent(links.compatClashLink) + '&name=ShyVPN-Compat';
    } else {
      for (const input of document.querySelectorAll('.module input, .module textarea, .module select')) {
        if (!input.closest('.shy-login-prompt')) input.disabled = true;
      }
    }
  };
  const onReady = () => {
    const authButton = document.querySelector('[onclick="logout()"]');
    const applyAuthenticatedUI = () => {
      meta.authenticated = true;
      document.body.classList.remove('shy-guest');
      document.body.classList.add('shy-admin');
      document.querySelectorAll('.shy-login-prompt').forEach(element => element.remove());
      document.querySelectorAll('.module input, .module textarea, .module select').forEach(input => {
        input.disabled = false;
      });
      if (authButton) {
        authButton.textContent = '👋退出登录';
        authButton.onclick = () => { location.href = '/logout'; };
      }
      renderUI();
    };
    if (authButton) {
      authButton.textContent = meta.authenticated ? '👋退出登录' : '管理员登录';
      if (!meta.authenticated) authButton.onclick = showLogin;
    }
    document.querySelectorAll('.shy-login-form').forEach(form => {
      form.addEventListener('submit', async event => {
        event.preventDefault();
        if (meta.preview) { showLogin(); return; }
        const status = form.querySelector('.shy-login-status');
        const button = form.querySelector('button');
        button.disabled = true;
        status.textContent = '正在登录…';
        try {
          const data = Object.fromEntries(new FormData(form));
          const response = await originalFetch('/__shy_auth', { method: 'POST', credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
          const result = await response.json();
          if (!response.ok || !result.success) throw new Error(result.error || '登录失败');
          form.reset();
          location.href = '/';
        } catch (error) { status.textContent = error.message; }
        finally { button.disabled = false; }
      });
    });
    if (!meta.authenticated) document.addEventListener('click', event => {
      if (event.target.closest('[onclick="resetConfigWithConfirm()"]')) {
        event.preventDefault(); event.stopImmediatePropagation(); showLogin();
      }
    }, true);
    if (!meta.authenticated && !meta.preview) {
      originalFetch('/session', { credentials: 'same-origin', cache: 'no-store' })
        .then(response => response.ok ? response.json() : null)
        .then(data => { if (data?.authenticated) applyAuthenticatedUI(); })
        .catch(() => {});
    }
    if (location.pathname === '/login') showLogin();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onReady);
  else onReady();
  window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
}

export function renderPanel({ authenticated = false, origin = 'https://shw.us.ci', preview = false } = {}) {
  let html = template.replace('<body>', `<body class="${authenticated ? 'shy-admin' : 'shy-guest'}">`)
    .replace(' 设置页面 - 管理后台', ' 设置页面');
  for (const [title, id] of protectedTitles) {
    const pattern = new RegExp('(<div class="module[^"]*)(">\\s*<div class="module-title"[^>]*>\\s*[^<]*' + title + '[\\s\\S]*?</div>)');
    html = html.replace(pattern, `$1 shy-sensitive" data-protected="${id}$2` +
      (authenticated ? '' : `<div class="shy-login-prompt"><p>此部分仅管理员可查看，请输入管理员账号和密码。</p>${loginForm()}</div>`));
  }
  html = html.replace(/(id="modeToggleBtn"[\s\S]*?<\/button>)/,
    '$1<a class="btn btn-primary" id="shy-rankings" href="/best">节点排名</a>');
  const compat = `<div class="form-group"><label for="compatClashLink">公共兼容订阅</label><div class="input-wrapper subscription-link-wrapper">
<input type="text" id="compatClashLink" readonly><div class="btn-container"><button type="button" class="btn btn-primary" onclick="copySubscription('compatClashLink')">复制订阅</button>
<a class="btn btn-primary" id="shy-import-sparkle">导入 Sparkle</a></div></div></div>`;
  html = html.replace(/(\s*<\/div>\s*)(<!-- 模块2:)/, compat + '$1$2');
  // The reset endpoint changes state and must use a same-origin POST.
  html = html.replace("fetch('/admin/init')", "fetch('/admin/init', { method: 'POST' })");
  const css = `<style>
body.shy-guest .module.shy-sensitive{display:block!important}
body.shy-guest .shy-sensitive>:not(.module-title):not(.shy-login-prompt){display:none!important}
.shy-login-prompt{display:block!important;padding:20px 0}
.shy-login-form{display:flex;gap:14px;flex-wrap:wrap;align-items:end}
.shy-login-form label{display:flex;flex-direction:column;gap:8px;flex:1;min-width:190px}
.shy-login-form input{min-height:44px;width:100%;box-sizing:border-box;padding:10px 12px;border:2px solid var(--input-border,#e5e7eb);border-radius:12px;background:var(--input-bg,#f3f4f6);color:var(--text-primary,#1f2937);font:inherit}
.shy-login-form input:focus-visible{outline:2px solid #ff9500;outline-offset:2px}
.shy-login-status{width:100%;color:#d84432;margin:0}
#shy-login-dialog{border:0;border-top:4px solid #ff9500;border-radius:20px;padding:28px;margin:auto;box-sizing:border-box;max-width:620px;width:calc(100% - 40px);max-height:calc(100dvh - 40px);overflow:auto;background:var(--bg-primary,#fff);color:var(--text-primary,#1f2937)}
#shy-login-dialog::backdrop{background:rgba(0,0,0,.6)}
#shy-login-dialog .shy-login-form{display:block}
#shy-login-dialog label{margin:16px 0}
#shy-login-dialog .shy-close{float:right;border:0;background:none;font-size:24px;color:inherit;cursor:pointer}
.header-buttons a.btn{text-decoration:none;display:inline-flex;align-items:center;justify-content:center}
@media(max-width:600px){.shy-login-form{display:block}.shy-login-form label{margin-bottom:14px}.shy-login-form button{width:100%}}
</style>`;
  const meta = JSON.stringify({ authenticated, origin, preview }).replace(/</g, '\\u003c');
  const dialog = `<dialog id="shy-login-dialog"><button class="shy-close" aria-label="关闭登录" onclick="this.closest('dialog').close()">×</button><h2>管理员登录</h2>${loginForm()}</dialog>`;
  html = html.replace('</head>', css + '</head>');
  // The upstream includes nested document templates; append to the outer body.
  const end = html.lastIndexOf('</body>');
  html = html.slice(0, end) + dialog + `<script>(${enhancePanel.toString()})(${meta});</script>` + html.slice(end);
  return html;
}
