const defaults = {
  pageTitle: 'ShyVPN EdgeTunnel',
  browserTitle: 'ShyVPN',
  logoUrl: '',
  faviconUrl: '',
  wallpaperUrl: '',
  wallpaperSize: 'cover',
};

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));
}

function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function renderSettingsPage({ origin = 'https://shw.us.ci', site = defaults, adminUser = '' } = {}) {
  const current = { ...defaults, ...(site || {}) };
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>站点设置 · ${escapeHTML(current.browserTitle)}</title>
<style>
:root{color-scheme:light;--bg:#f5f7fb;--card:#fff;--text:#18212f;--muted:#64748b;--line:#d9e0ea;--accent:#f58220;--danger:#c83b30}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.55 system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif}
main{width:min(980px,calc(100% - 32px));margin:32px auto 64px}.top{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:20px}
h1{font-size:26px;margin:0}.sub{color:var(--muted);margin:4px 0 0}.actions{display:flex;gap:8px;flex-wrap:wrap}
a,button{font:inherit}a,.button{display:inline-flex;align-items:center;min-height:44px;padding:9px 14px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--text);text-decoration:none;cursor:pointer}
button.primary,.button.primary{background:var(--accent);border-color:var(--accent);color:#fff}.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:22px;margin-top:16px}
h2{font-size:19px;margin:0 0 6px}.hint{color:var(--muted);margin:0 0 18px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
label{display:grid;gap:6px;font-weight:600}label span{font-size:14px}input,select{width:100%;min-height:44px;padding:9px 11px;border:1px solid var(--line);border-radius:7px;background:#fff;color:var(--text);font:inherit}
input:focus,select:focus{outline:2px solid #f8b477;outline-offset:1px}.row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:18px}.status{min-height:24px;color:var(--muted)}.status.error{color:var(--danger)}.status.ok{color:#16834b}
.current{padding:10px 12px;background:#f8fafc;border:1px solid var(--line);border-radius:7px;color:var(--muted);margin:12px 0 0}.preview{display:flex;align-items:center;gap:12px;margin-top:16px;padding:12px;border:1px dashed var(--line);border-radius:8px;min-height:72px;background-size:cover;background-position:center}.preview img{width:48px;height:48px;object-fit:contain;border-radius:8px;background:#fff}
@media(max-width:700px){main{width:min(100% - 20px,980px);margin-top:16px}.top{align-items:flex-start;flex-direction:column}.grid{grid-template-columns:1fr}.row{align-items:stretch;flex-direction:column}.row button{width:100%;justify-content:center}}
</style></head><body><main>
<div class="top"><div><h1>站点设置</h1><p class="sub">在线修改登录凭据和公开页面外观</p></div><div class="actions"><a href="${escapeHTML(origin)}">返回面板</a><a href="${escapeHTML(origin)}/best">节点排名</a><a href="${escapeHTML(origin)}/logout">退出登录</a></div></div>
<section class="card"><h2>账号安全</h2><p class="hint">保存后当前会话立即失效，需要使用新账号和新密码重新登录。新密码至少 8 个字符。</p>
<div class="current">当前管理员账号：<strong>${escapeHTML(adminUser || '未读取')}</strong></div>
<form id="credentials-form"><div class="grid">
<label><span>当前密码</span><input name="currentPassword" type="password" autocomplete="current-password" required></label>
<label><span>新管理员账号</span><input name="username" autocomplete="username" placeholder="请输入新账号" required></label>
<label><span>新密码</span><input name="password" type="password" autocomplete="new-password" placeholder="至少 8 个字符" required></label>
<label><span>确认新密码</span><input name="confirmPassword" type="password" autocomplete="new-password" placeholder="再次输入新密码" required></label>
</div><div class="row"><span class="status" id="credential-status"></span><button class="primary" type="submit">保存账号密码</button></div></form></section>
<section class="card"><h2>网站外观</h2><p class="hint">图片使用公开的 http(s) 地址或本站安全相对路径。这里不上传文件，也不会把管理员凭据写进页面。</p>
<form id="site-form"><div class="grid">
<label><span>页面标题</span><input name="pageTitle" maxlength="80" value="${escapeHTML(current.pageTitle)}" required></label>
<label><span>浏览器标签标题</span><input name="browserTitle" maxlength="80" value="${escapeHTML(current.browserTitle)}" required></label>
<label><span>Logo 图片地址</span><input name="logoUrl" type="text" value="${escapeHTML(current.logoUrl)}" placeholder="https://..."></label>
<label><span>Favicon 图标地址</span><input name="faviconUrl" type="text" value="${escapeHTML(current.faviconUrl)}" placeholder="https://..."></label>
<label><span>壁纸地址</span><input name="wallpaperUrl" type="text" value="${escapeHTML(current.wallpaperUrl)}" placeholder="https://..."></label>
<label><span>壁纸显示方式</span><select name="wallpaperSize"><option value="cover"${current.wallpaperSize === 'cover' ? ' selected' : ''}>覆盖</option><option value="contain"${current.wallpaperSize === 'contain' ? ' selected' : ''}>完整显示</option><option value="auto"${current.wallpaperSize === 'auto' ? ' selected' : ''}>原始大小</option></select></label>
</div><div class="preview" id="preview"><img id="preview-logo" alt="" hidden><span id="preview-title"></span></div><div class="row"><span class="status" id="site-status"></span><button class="primary" type="submit">保存网站外观</button></div></form></section>
</main><script>
const origin=${JSON.stringify(origin)}, initial=${jsonForScript(current)};
const siteForm=document.getElementById('site-form'), preview=document.getElementById('preview'), previewLogo=document.getElementById('preview-logo'), previewTitle=document.getElementById('preview-title');
function updatePreview(){const data=Object.fromEntries(new FormData(siteForm));previewTitle.textContent=data.pageTitle;preview.style.backgroundImage=data.wallpaperUrl?'url('+JSON.stringify(data.wallpaperUrl)+')':'';preview.style.backgroundSize=data.wallpaperSize||'cover';if(data.logoUrl){previewLogo.src=data.logoUrl;previewLogo.hidden=false}else{previewLogo.hidden=true}}
updatePreview();siteForm.addEventListener('input',updatePreview);
async function send(form,event,path,statusId){event.preventDefault();const status=document.getElementById(statusId),button=form.querySelector('button');button.disabled=true;status.className='status';status.textContent='正在保存…';try{const value=Object.fromEntries(new FormData(form));const response=await fetch(path,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(path.includes('credentials')?value:{site:value})});const data=await response.json();if(!response.ok||!data.success)throw new Error(data.error||'保存失败');status.className='status ok';status.textContent='保存成功';if(path.includes('credentials')){status.textContent='账号密码已更新，正在返回登录页…';setTimeout(()=>{location.href='/login?next=%2Fsettings'},500)}}catch(error){status.className='status error';status.textContent=error.message}finally{button.disabled=false}}
document.getElementById('credentials-form').addEventListener('submit',(event)=>send(event.currentTarget,event,'/__shy_admin/credentials','credential-status'));
siteForm.addEventListener('submit',(event)=>send(event.currentTarget,event,'/__shy_admin/site-settings.json','site-status'));
</script></body></html>`;
}
