export function renderPage(data, origin, panelOrigin = origin) {
  const initial = JSON.stringify({
    generatedAt: data.generatedAt, sources: data.sources || [],
    candidateCount: data.candidateCount ?? data.clientNodes?.length ?? 0,
    rows: data.rows || [], origin, panelOrigin, publicFallback: data.publicFallback === true, runtimeSnapshot: data.runtimeSnapshot === true,
  }).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ShyVPN · EdgeTunnel</title><style>
:root{color-scheme:light dark;--bg:#fff;--fg:#191919;--muted:#626262;--line:#dedede;--soft:#f5f5f5}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
header{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px;padding:16px 28px;border-bottom:1px solid var(--line)}
h1{font-size:21px;margin:0}header small{color:var(--muted)}nav{display:flex;gap:8px}
button,a,input,select{font:inherit}button,.button{min-height:44px;padding:9px 14px;border:1px solid var(--line);border-radius:5px;background:var(--bg);color:var(--fg);cursor:pointer;text-decoration:none}
button[aria-selected=true],.primary{background:var(--fg);color:var(--bg);border-color:var(--fg)}button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--fg);outline-offset:3px}
main{padding:20px 28px}section[hidden]{display:none}h2{font-size:18px;margin:0 0 8px}p{margin:6px 0}.muted{color:var(--muted)}
.intro{display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;padding-bottom:16px;border-bottom:1px solid var(--line)}
.actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.note{font-size:14px;color:var(--muted);margin:12px 0}
.sources{display:flex;flex-wrap:wrap;gap:8px 24px;padding:12px 0;font-size:14px}.sources span{overflow-wrap:anywhere}
.toolbar{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:end;margin:12px 0}.toolbar label{display:grid;gap:4px;font-size:13px;color:var(--muted)}
input,select{min-height:44px;border:1px solid var(--line);border-radius:5px;background:var(--bg);color:var(--fg);padding:8px;max-width:100%}#q{width:270px}#subkey{width:300px}
.tablebox{overflow:auto;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
table{width:100%;border-collapse:collapse;min-width:1160px}th,td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--line);white-space:nowrap;font-size:15px}th{background:var(--soft);font-size:13px;font-weight:600}
td:nth-child(5){font:14px ui-monospace,Consolas,monospace}td:last-child{font-size:13px;color:var(--muted)}.pager{display:flex;justify-content:space-between;flex-wrap:wrap;align-items:center;gap:8px;padding-top:12px}
iframe{width:100%;height:calc(100dvh - 245px);min-height:580px;border:1px solid var(--line);background:white;margin-top:16px}
details{border-bottom:1px solid var(--line);padding:12px 0}summary{min-height:44px;cursor:pointer;display:flex;align-items:center}#feedback{min-height:22px;font-size:14px}
@media(prefers-color-scheme:dark){:root{--bg:#191919;--fg:#ededed;--muted:#b3b3b3;--line:#414141;--soft:#252525}}
@media(max-width:640px){header{padding:14px 16px}main{padding:16px}nav{width:100%}nav button{flex:1}.toolbar label:first-child{width:100%}#q,#subkey{width:100%}.toolbar label{flex:1;min-width:125px}iframe{min-height:650px}.actions{width:100%}.intro{gap:8px}}
</style></head><body>
<header><div><h1>ShyVPN <small>EdgeTunnel</small></h1><small>公开优选数据 · Cloudflare 直出</small></div>
<nav role="tablist" aria-label="首页栏目"><button id="tab-original" role="tab" aria-selected="true" aria-controls="original" data-tab="original">原版面板</button><button id="tab-ranking" role="tab" aria-selected="false" aria-controls="ranking" data-tab="ranking">节点排名</button></nav></header>
<main><section id="original" role="tabpanel" aria-labelledby="tab-original">
<div class="intro"><div><h2>EdgeTunnel 原版管理面板</h2><p class="muted">管理员在下方登录；订阅链接可直接分享，使用订阅无需登录 Cloudflare。</p></div><a class="button" id="open-panel" target="_blank" rel="noopener">独立打开面板</a></div>
<details><summary>生成一键订阅链接</summary><p class="note">输入管理员提供的订阅密钥。密钥仅用于生成此页面上的订阅链接，不保存在浏览器。</p><div class="toolbar"><label>订阅密钥<input id="subkey" type="password" autocomplete="off"></label><button id="make-links">生成链接</button></div>
<div id="sub-links" class="actions" hidden></div><p id="feedback" role="status"></p></details>
<iframe id="panel" title="EdgeTunnel 原版管理面板" referrerpolicy="same-origin"></iframe>
</section>
<section id="ranking" role="tabpanel" aria-labelledby="tab-ranking" hidden>
<div class="intro"><div><h2>完整优选结果</h2><p id="counts"></p><p class="muted" id="updated"></p></div><div class="actions"><a class="button" id="raw-data">下载完整 JSON</a></div></div>
<p class="note">合并微测网三网、cfhub 全部分类及已保存的测速快照。保留未发布和历史失败记录；不同来源的延迟、速度和检测方式不可直接等同。地区为来源标注的入口信息，不保证出口地区。</p>
<div id="sources" class="sources"></div>
<div class="toolbar">
<label>搜索<input id="q" type="search" placeholder="IP、地区、Colo 或来源"></label>
<label>运营商<select id="carrier"><option value="">全部运营商</option><option>移动</option><option>电信</option><option>联通</option><option>多线</option><option>其他</option></select></label>
<label>地区<select id="region"><option value="">全部地区</option></select></label>
<label>地址族<select id="family"><option value="">IPv4 + IPv6</option><option value="4">IPv4</option><option value="6">IPv6</option></select></label>
<label>状态<select id="status"><option value="">全部记录</option><option value="yes">已发布</option><option value="no">未发布 / 历史失败</option></select></label>
<label>排序<select id="sort"><option value="rank">来源顺序</option><option value="latency">延迟升序</option><option value="speed">速度降序</option></select></label>
</div><div class="tablebox" tabindex="0" aria-label="优选结果，可横向滚动"><table><thead><tr><th>序号</th><th>运营商</th><th>入口地区</th><th>Colo</th><th>入口 IP : 端口</th><th>延迟</th><th>速度</th><th>来源 / 检测方式</th><th>状态</th><th>来源时间</th></tr></thead><tbody id="rows"></tbody></table></div>
<div class="pager"><span id="shown" role="status"></span><div class="actions"><label>每页 <select id="size"><option>50</option><option>100</option><option value="99999">全部</option></select></label><button id="prev">上一页</button><button id="next">下一页</button></div></div>
</section></main><script>
const initial=${initial};
const $=id=>document.getElementById(id),rows=initial.rows;let page=0;
const base=initial.origin.replace(/\\/$/,'');
$('panel').src=initial.panelOrigin+'/login';$('open-panel').href=initial.panelOrigin+'/admin';$('raw-data').href=base+'/cfip.json';
function show(name){document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===name)));['original','ranking'].forEach(id=>$(id).hidden=id!==name);history.replaceState(null,'','#'+name)}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>show(b.dataset.tab));
if(location.hash==='#ranking'||location.pathname==='/best')show('ranking');
$('counts').textContent=rows.length+' 条完整来源记录 · '+initial.candidateCount+' 个订阅候选';
$('updated').textContent='合并时间：'+(initial.generatedAt||'未提供')+(initial.runtimeSnapshot?' · 内置 / 上次成功快照，后台刷新中':' · 不依赖天翼云电脑');
for(const source of initial.sources){const span=document.createElement('span');span.textContent=source.name+'：'+source.count+' 条 · '+(source.localOnly?'历史快照':source.cached?'沿用上次成功数据':'公开源已同步')+' · '+(source.fetchedAt||'未提供');$('sources').append(span)}
for(const region of [...new Set(rows.map(x=>x.region))].sort()){const o=document.createElement('option');o.textContent=region;$('region').append(o)}
function latency(x){if(x.latency!=null)return Number(x.latency);return parseFloat(x.latencyText)||Infinity}
function speed(x){const v=parseFloat(x.speed)||0;return /k/i.test(x.speed)?v/1024:v}
function render(){const q=$('q').value.trim().toLowerCase(),carrier=$('carrier').value,region=$('region').value,family=$('family').value,status=$('status').value,sort=$('sort').value,size=Number($('size').value);
const found=rows.filter(x=>(!q||[x.ip,x.region,x.colo,x.source].join(' ').toLowerCase().includes(q))&&(!carrier||x.carrier===carrier)&&(!region||x.region===region)&&(!family||String(x.family)===family)&&(!status||x.published===(status==='yes')));
if(sort==='latency')found.sort((a,b)=>latency(a)-latency(b));if(sort==='speed')found.sort((a,b)=>speed(b)-speed(a));
page=Math.min(page,Math.max(0,Math.ceil(found.length/size)-1));$('rows').replaceChildren();
for(const row of found.slice(page*size,(page+1)*size)){const tr=document.createElement('tr');const fields=[row.rank,row.carrier,row.region,row.colo,(row.family===6?'['+row.ip+']':row.ip)+':'+row.port,row.latency==null?(row.latencyText||'—'):row.latency+' ms',row.speed||'—',row.source+' / '+(row.measurementKind==='ech-tls-trace'?'ECH / TLS':row.measurementKind==='download-test'?'下载测速':'历史实测'),row.published?'已发布':'未发布 / 失败',row.sourceUpdated||'未提供'];for(const field of fields){const td=document.createElement('td');td.textContent=field;tr.append(td)}$('rows').append(tr)}
if(!found.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=10;td.textContent='没有匹配记录，请调整筛选。';tr.append(td);$('rows').append(tr)}
$('shown').textContent='共 '+found.length+' 条 · 第 '+(page+1)+' / '+Math.max(1,Math.ceil(found.length/size))+' 页';$('prev').disabled=page===0;$('next').disabled=(page+1)*size>=found.length}
for(const id of ['q','carrier','region','family','status','sort','size'])$(id).addEventListener(id==='q'?'input':'change',()=>{page=0;render()});
$('prev').onclick=()=>{page--;render()};$('next').onclick=()=>{page++;render()};render();
$('make-links').onclick=()=>{const key=$('subkey').value.trim(),out=$('sub-links');out.replaceChildren();if(!key){$('feedback').textContent='请输入订阅密钥。';return}const clash=base+'/sub?token='+encodeURIComponent(key)+'&clash',v2ray=base+'/sub?token='+encodeURIComponent(key)+'&v2ray';
for(const [name,href] of [['导入 Sparkle / Clash','clash://install-config?url='+encodeURIComponent(clash)+'&name=ShyVPN'],['下载 Clash 配置',clash],['下载 VLESS 订阅',v2ray]]){const a=document.createElement('a');a.className='button';a.textContent=name;a.href=href;out.append(a)}
const copyV2=document.createElement('button');copyV2.textContent='复制 v2rayN 订阅链接';copyV2.onclick=async()=>{try{await navigator.clipboard.writeText(v2ray);$('feedback').textContent='已复制，可在 v2rayN 中添加订阅。'}catch{$('feedback').textContent='请打开 VLESS 订阅后复制地址。'}};out.append(copyV2);
if(initial.publicFallback){const compatible=clash+'&compat=1';for(const [name,href] of [['导入兼容订阅（公共回退）','clash://install-config?url='+encodeURIComponent(compatible)+'&name=ShyVPN-Compat'],['下载兼容配置（公共回退）',compatible]]){const a=document.createElement('a');a.className='button';a.textContent=name;a.href=href;out.append(a)}const note=document.createElement('p');note.className='note';note.textContent='兼容订阅在 CF 直出失败时使用上游公共回退；不经过你的个人 VPS。上面的默认链接保持仅直出。';out.append(note)}
const copy=document.createElement('button');copy.textContent='复制 Clash 订阅链接';copy.onclick=async()=>{try{await navigator.clipboard.writeText(clash);$('feedback').textContent='已复制订阅链接。'}catch{$('feedback').textContent='无法访问剪贴板，请打开下载链接后复制地址。'}};out.append(copy);out.hidden=false;$('feedback').textContent='已生成。订阅可直接下载，客户端无需登录 Cloudflare。'};
if(location.origin!==base){fetch(base+'/rankings.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error();return r.json()}).then(fresh=>{rows.splice(0,rows.length,...fresh.rows);initial.publicFallback=fresh.publicFallback===true;$('counts').textContent=rows.length+' 条完整来源记录 · '+fresh.clientNodes.length+' 个订阅候选';$('updated').textContent='合并时间：'+fresh.generatedAt+(fresh.runtimeSnapshot?' · 内置 / 上次成功快照，后台刷新中':' · 已从 Worker 更新');$('sources').replaceChildren();for(const source of fresh.sources||[]){const span=document.createElement('span');span.textContent=source.name+'：'+source.count+' 条 · '+(source.cached?'沿用快照':'已同步')+' · '+source.fetchedAt;$('sources').append(span)}render()}).catch(()=>{$('updated').textContent+=' · 在线刷新暂不可用，显示构建时快照'})}
</script></body></html>`;
}
