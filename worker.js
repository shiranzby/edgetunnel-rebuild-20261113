import { renderPage } from './page.js';
import panel from './panel-worker.js';
import node from './node-worker.js';
import snapshot from './data/snapshot.js';

const REBUILD_DEFAULT_DATA_URL = 'https://raw.githubusercontent.com/shiranzby/edgetunnel-rebuild-20261113/main/data/cfip.json';
const TEST_URL = 'https://www.gstatic.com/generate_204';
// Public data and subscriptions run separately from the VLESS/WS node and panel.
let rebuildDataCache = null;
let rebuildDataCacheAt = 0;
let rebuildDataRefresh = null;

function rebuildSafe(value) {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
}

function rebuildSpeed(node) {
  const value = rebuildSafe(node.speedText || node.speed || node.sourceSpeedText);
  return /^\d+(?:\.\d+)?\s*ms$/i.test(value) ? '' : value;
}

function rebuildCarrier(node) {
  const text = [node?.isp, node?.isps, node?.line, node?.lineName, node?.sourceName, node?.label].join(' ').toLowerCase();
  if (/cmcc|mobile|chinamobile|移动/.test(text)) return '移动';
  if (/ct|telecom|chinanet|chinatelecom|电信/.test(text)) return '电信';
  if (/cu|unicom|china169|联通/.test(text)) return '联通';
  if (/multi|all|多线|综合/.test(text)) return '多线';
  return '其他';
}

function rebuildRegion(node) {
  const text = [node?.displayRegion, node?.regionName, node?.colo, node?.country, node?.loc].join(' ').toLowerCase();
  if (/香港|hong kong|hkg|hkt/.test(text)) return '中国香港';
  if (/日本|japan|东京|大阪|nrt|kix/.test(text)) return '日本';
  if (/新加坡|singapore|sin/.test(text)) return '新加坡';
  if (/台湾|台北|taiwan|tpe/.test(text)) return '中国台湾';
  if (/韩国|korea|首尔|icn/.test(text)) return '韩国';
  if (/美国|united states|los angeles|san jose|seattle|denver|ashburn|lax|sjc|sea|den|iad/.test(text)) return '美国';
  if (/德国|germany|frankfurt|fra/.test(text)) return '德国';
  if (/荷兰|netherlands|amsterdam|ams/.test(text)) return '荷兰';
  return rebuildSafe(node?.colo) || '其他地区';
}

function rebuildFlag(region) {
  return ({ '中国香港': '🇭🇰', '日本': '🇯🇵', '新加坡': '🇸🇬', '中国台湾': '🇨🇳', '韩国': '🇰🇷', '美国': '🇺🇸', '德国': '🇩🇪', '荷兰': '🇳🇱' })[region] || '🌐';
}

function rebuildUsable(data) {
  const input = Array.isArray(data?.clientNodes) && data.clientNodes.length ? data.clientNodes : (data?.nodes || []);
  const seen = new Set();
  return input.filter(node => {
    const ip = rebuildSafe(node?.ip);
    if (!ip || node?.published === false || (node?.downloadStatus != null && Number(node.downloadStatus) !== 200)) return false;
    const key = `${ip}:${Number(node?.port || 443)}:${rebuildCarrier(node)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function rebuildLoadData(env, ctx) {
  const url = env.CFIP_DATA_URL || REBUILD_DEFAULT_DATA_URL;
  if (rebuildDataCache && rebuildDataCache.url === url && Date.now() - rebuildDataCacheAt < 120000) return rebuildDataCache.data;
  const previous = rebuildDataCache?.url === url ? rebuildDataCache.data : snapshot;
  const fallback = { ...previous, runtimeSnapshot: true };
  if (!rebuildDataRefresh || rebuildDataRefresh.url !== url) {
    const state = { url };
    state.promise = (async () => {
      const response = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'EdgeTunnel-Rebuild/1.0' }, cf: { cacheTtl: 120 } });
      if (!response.ok) throw new Error(`data source ${response.status}`);
      const data = await response.json();
      if (!data || (!Array.isArray(data.clientNodes) && !Array.isArray(data.nodes))) throw new Error('invalid data source');
      rebuildDataCache = { url, data };
      rebuildDataCacheAt = Date.now();
      return data;
    })().catch(() => fallback).finally(() => {
      if (rebuildDataRefresh === state) rebuildDataRefresh = null;
    });
    rebuildDataRefresh = state;
    ctx?.waitUntil?.(state.promise);
  }
  if (rebuildDataCache?.url === url) return fallback;
  let timer;
  try {
    return await Promise.race([rebuildDataRefresh.promise, new Promise(resolve => {
      timer = setTimeout(() => resolve(fallback), 800);
    })]);
  } finally {
    clearTimeout(timer);
  }
}

function rebuildEndpoint(node, index, env, requestHost) {
  const rawIP = rebuildSafe(node.ip);
  const displayIP = rawIP.includes(':') && !rawIP.startsWith('[') ? `[${rawIP}]` : rawIP;
  const region = rebuildRegion(node);
  const carrier = rebuildCarrier(node);
  const colo = rebuildSafe(node.colo) || 'CF';
  const name = `${rebuildFlag(region)} ${carrier} | ${region} | ${colo} | ${String(index + 1).padStart(3, '0')}`;
  const host = rebuildSafe(env.PROXY_HOST || env.HOST || requestHost);
  const sni = rebuildSafe(env.PROXY_SNI || host);
  return { rawIP, displayIP, port: Number(node.port || 443), region, carrier, colo, name: env.NODE_PATH === '/compat' ? `${name} | 公共兼容` : name, host, sni, path: env.NODE_PATH || '/', speed: rebuildSpeed(node), source: rebuildSafe(node.sourceName || node.source || '') };
}

function rebuildYaml(value) {
  return JSON.stringify(String(value));
}

function rebuildClash(nodes, env, requestHost, data) {
  const items = nodes.map((node, index) => rebuildEndpoint(node, index, env, requestHost));
  const proxies = items.map(item => `  - ${JSON.stringify({ name: item.name, server: item.rawIP, port: item.port, type: 'vless', uuid: env.UUID, tls: true, udp: false, 'skip-cert-verify': false, servername: item.sni, 'client-fingerprint': 'chrome', network: 'ws', 'ws-opts': { path: item.path, headers: { Host: item.host } } })}`).join('\n');
  const byCarrier = new Map(), byRegion = new Map();
  for (const item of items) {
    if (!byCarrier.has(item.carrier)) byCarrier.set(item.carrier, []);
    if (!byRegion.has(item.region)) byRegion.set(item.region, []);
    byCarrier.get(item.carrier).push(item.name);
    byRegion.get(item.region).push(item.name);
  }
  const group = (name, values, type = 'select') => `  - name: ${rebuildYaml(name)}\n    type: ${type}\n    url: ${TEST_URL}\n    expected-status: 204\n    timeout: 12000\n    proxies:\n${(values.length ? values : ['DIRECT']).map(value => `      - ${rebuildYaml(value)}`).join('\n')}`;
  const all = items.map(item => item.name);
  const preferredIPs = new Set(String(env.PREFERRED_ENTRY_IPS || '104.18.39.37,104.18.32.198').split(',').map(value => value.trim()));
  const preferred = items.filter(item => preferredIPs.has(item.rawIP)).map(item => item.name);
  const mainChoices = [...new Set([...preferred, '运营商 | 移动', '运营商 | 电信', '运营商 | 联通', ...all])];
  const carrierGroups = ['移动', '电信', '联通', '多线', '其他'].map(name => group(`运营商 | ${name}`, byCarrier.get(name) || [])).join('\n');
  const regionGroups = [...byRegion.keys()].map(name => group(`地区 | ${name}`, byRegion.get(name) || [])).join('\n');
  const host = rebuildSafe(env.PROXY_HOST || env.HOST || requestHost);
  const familyGroups = [4, 6].map(family => group(`地址 | IPv${family}`, items.filter(item => item.rawIP.includes(':') === (family === 6)).map(item => item.name))).join('\n');
  return `mixed-port: 7890\nallow-lan: false\nmode: rule\nlog-level: warning\ncfw-latency-url: ${TEST_URL}\nproxies:\n${proxies || '  - {"name":"DIRECT","type":"direct"}'}\nproxy-groups:\n${group('🚀 节点选择', mainChoices)}\n${carrierGroups}\n${regionGroups}\n${familyGroups}\nrules:\n  - DOMAIN-SUFFIX,${host},DIRECT\n  - MATCH,🚀 节点选择\n# source_updated: ${rebuildSafe(data.generatedAt)}\n# node_count: ${items.length}\n`;
}

function rebuildVlessLinks(nodes, env, requestHost) {
  const links = nodes.map((node, index) => {
    const item = rebuildEndpoint(node, index, env, requestHost);
    const query = new URLSearchParams({ encryption: 'none', security: 'tls', type: 'ws', host: item.host, sni: item.sni, path: item.path });
    return `vless://${env.UUID}@${item.displayIP}:${item.port}?${query.toString()}#${encodeURIComponent(item.name)}`;
  });
  return links.join('\n');
}

function rebuildSingbox(nodes, env, requestHost) {
  const items = nodes.map((node, index) => rebuildEndpoint(node, index, env, requestHost));
  return JSON.stringify({ log: { level: 'warn' }, outbounds: items.map(item => ({ type: 'vless', tag: item.name, server: item.rawIP, server_port: item.port, uuid: env.UUID, tls: { enabled: true, server_name: item.sni }, transport: { type: 'ws', path: item.path, headers: { Host: item.host } } })).concat([{ type: 'selector', tag: '节点选择', outbounds: items.map(item => item.name), default: items[0]?.name || 'direct' }, { type: 'direct', tag: 'direct' }]), route: { final: '节点选择' } }, null, 2);
}

function rebuildAuthorized(request, env, url = new URL(request.url)) {
  const queryToken = url.searchParams.get('token') || '';
  const keyPath = url.pathname.replace(/^\/+/, '');
  const allowedTokens = [env.SUB_TOKEN, env.KEY, env.LEGACY_SUB_TOKEN].map(rebuildSafe).filter(Boolean);
  return allowedTokens.some(token => queryToken === token || keyPath === token);
}

function rebuildRows(data) {
  const records = Array.isArray(data.records) && data.records.length ? data.records : rebuildUsable(data);
  return records.map((node, index) => ({
    rank: index + 1, sourceRank: node.rank ?? index + 1,
    ip: rebuildSafe(node.ip), port: Number(node.port || 443),
    family: node.family || (String(node.ip).includes(':') ? 6 : 4),
    carrier: rebuildCarrier(node), region: rebuildRegion(node), colo: rebuildSafe(node.colo) || 'CF',
    speed: rebuildSpeed(node),
    latency: node.latencyMs == null ? (node.medianMs ?? null) : Number(node.latencyMs),
    latencyText: rebuildSafe(node.latency),
    score: node.score == null ? null : Number(node.score),
    source: rebuildSafe(node.sourceName || node.source || ''),
    sourceUpdated: node.sourceUpdated || '',
    measurementKind: node.measurementKind || '',
    published: node.published !== false && (node.downloadStatus == null || node.downloadStatus === 200),
  }));
}

async function handleRebuildRequest(request, env, ctx) {
  const upgrade = (request.headers.get('Upgrade') || '').toLowerCase();
  if (upgrade === 'websocket') return null;
  const url = new URL(request.url);
  const path = url.pathname.toLowerCase();
  if (!['/', '/best', '/rankings.json', '/cfip.json', '/sub', '/clash', '/v2ray', '/singbox'].includes(path) && !rebuildAuthorized(request, env)) return null;
  let data;
  try { data = await rebuildLoadData(env, ctx); } catch (error) {
    if (['/', '/best', '/rankings.json', '/cfip.json', '/sub', '/clash', '/v2ray', '/singbox'].includes(path)) return new Response(`data source unavailable: ${error?.message || error}`, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    return null;
  }
  const requestHost = url.hostname;
  if (path === '/' || path === '/best') {
    const subscriptionOrigin = env.PROXY_HOST ? `https://${rebuildSafe(env.PROXY_HOST)}` : url.origin;
    return new Response(renderPage({ ...data, rows: rebuildRows(data), candidateCount: rebuildUsable(data).length, publicFallback: env.ENABLE_PUBLIC_FALLBACK === 'true' }, subscriptionOrigin, url.origin), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
  }
  if (path === '/rankings.json') return new Response(JSON.stringify({ generatedAt: data.generatedAt, runtimeSnapshot: data.runtimeSnapshot === true, sources: data.sources, publicFallback: env.ENABLE_PUBLIC_FALLBACK === 'true', rows: rebuildRows(data), clientNodes: rebuildUsable(data).map(node => ({ ...node, carrier: rebuildCarrier(node), region: rebuildRegion(node) })) }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' } });
  if (path === '/cfip.json') return Response.json(data, { headers: { 'Cache-Control': 'no-store' } });
  if (path === '/sub' || path === '/clash' || path === '/v2ray' || path === '/singbox' || rebuildAuthorized(request, env)) {
    if (!rebuildAuthorized(request, env)) return new Response('invalid subscription token', { status: 401, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    if (url.searchParams.get('compat') === '1') {
      if (env.ENABLE_PUBLIC_FALLBACK !== 'true') return new Response('Public compatibility is disabled', { status: 403 });
      env = { ...env, NODE_PATH: '/compat' };
    }
    const carrier = url.searchParams.get('carrier') || '全部';
    let nodes = rebuildUsable(data);
    if (carrier !== '全部') {
      const filtered = nodes.filter(node => rebuildCarrier(node) === carrier);
      if (filtered.length) nodes = filtered;
    }
    const headers = { 'Cache-Control': 'no-store', 'Profile-Update-Interval': '1', 'Profile-Web-Page-Url': url.origin, 'Content-Disposition': "inline; filename=ShyVPN" };
    if (path === '/singbox' || url.searchParams.has('singbox')) return new Response(rebuildSingbox(nodes, env, requestHost), { headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' } });
    const ua = request.headers.get('User-Agent') || '';
    if (path === '/v2ray' || url.searchParams.has('v2ray') || (path === '/sub' && /v2rayn|v2rayng/i.test(ua) && !url.searchParams.has('clash'))) return new Response(btoa(unescape(encodeURIComponent(rebuildVlessLinks(nodes, env, requestHost)))), { headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8' } });
    return new Response(rebuildClash(nodes, env, requestHost, data), { headers: { ...headers, 'Content-Type': 'application/yaml; charset=utf-8' } });
  }
  return null;
}


export default {
  async fetch(request, env, ctx) {
    try {
      if ((request.headers.get('Upgrade') || '').toLowerCase() === 'websocket') {
        return node.fetch(request, env, ctx);
      }
      const path = new URL(request.url).pathname;
      if (/^\/(?:login|logout|admin(?:\/.*)?)$/.test(path)) {
        return panel.fetch(request, env, ctx);
      }
      const response = await handleRebuildRequest(request, env, ctx);
      return response || new Response('Not Found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    } catch (error) {
      console.error('subscription worker failed', error?.stack || error);
      return new Response('Worker error', { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  }
};
