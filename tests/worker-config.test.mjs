import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const source = await readFile(new URL('../worker.js', import.meta.url), 'utf8');
assert.match(source, /handleRebuildRequest/);
assert.match(source, /REBUILD_DEFAULT_DATA_URL/);
assert.match(source, /PROXY_SNI/);
assert.match(source, /运营商 \|/);
assert.match(source, /地区 \| /);

const sanitizedSource = source
  .replace("import { connect } from 'cloudflare:sockets';", 'const connect = () => { throw new Error("socket unavailable in tests"); };')
  .replace('export default {', 'const workerDefault = {');
const modulePath = join(tmpdir(), `edgetunnel-rebuild-worker-${Date.now()}.mjs`);
await writeFile(modulePath, `${sanitizedSource}\nexport { workerDefault };\n`, 'utf8');
const { workerDefault } = await import(`file:///${modulePath.replace(/\\/g, '/')}`);

const originalFetch = globalThis.fetch;
globalThis.fetch = async (input) => {
  const url = String(input?.url ?? input);
  if (url.includes('edgetunnel-rebuild-20261113/main/data/cfip.json')) {
    return new Response(JSON.stringify({
      generatedAt: '2026-11-13T00:00:00.000Z',
      source: 'fixture',
      clientNodes: [
        { ip: '172.64.229.7', port: 443, lineName: '移动', regionName: '日本东京', colo: 'NRT', speedText: '2.59m/s', latencyMs: 252, published: true, downloadStatus: 200 },
        { ip: '104.18.39.37', port: 443, lineName: '电信', regionName: '新加坡', colo: 'SIN', speedText: '1.20m/s', latencyMs: 220, published: true, downloadStatus: 200 },
        { ip: '2606:4700::1111', port: 443, lineName: '联通', regionName: '中国香港', colo: 'HKG', speedText: '0.80m/s', latencyMs: 180, published: true, downloadStatus: 200 },
      ],
      records: [],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  return new Response('unexpected fetch: ' + url, { status: 500 });
};

const env = {
  UUID: '11111111-1111-4111-8111-111111111111',
  ADMIN: 'test-admin',
  KEY: 'test-key',
  SUB_TOKEN: 'test-token',
  CFIP_DATA_URL: 'https://raw.githubusercontent.com/shiranzby/edgetunnel-rebuild-20261113/main/data/cfip.json',
};
const ctx = { waitUntil() {} };

const home = await workerDefault.fetch(new Request('https://edgetunnel-rebuild-20261113.example.workers.dev/'), env, ctx);
assert.equal(home.status, 200);
const homeBody = await home.text();
assert.match(homeBody, /原版面板/);
assert.match(homeBody, /节点排名/);
assert.match(homeBody, /运营商/);

const ranking = await workerDefault.fetch(new Request('https://edgetunnel-rebuild-20261113.example.workers.dev/rankings.json'), env, ctx);
assert.equal(ranking.status, 200);
const rankingBody = await ranking.json();
assert.equal(rankingBody.clientNodes.length, 3);
assert.equal(rankingBody.clientNodes[0].carrier, '移动');
assert.equal(rankingBody.clientNodes[1].region, '新加坡');

const invalid = await workerDefault.fetch(new Request('https://edgetunnel-rebuild-20261113.example.workers.dev/clash?token=wrong'), env, ctx);
assert.equal(invalid.status, 401);

const clash = await workerDefault.fetch(new Request('https://edgetunnel-rebuild-20261113.example.workers.dev/clash?token=test-token'), env, ctx);
assert.equal(clash.status, 200);
assert.match(clash.headers.get('content-type'), /application\/yaml/);
const clashBody = await clash.text();
assert.match(clashBody, /(?:type: vless|\"type\":\"vless\")/);
assert.match(clashBody, /(?:servername: edgetunnel-rebuild-20261113\.example\.workers\.dev|\"servername\":\"edgetunnel-rebuild-20261113\.example\.workers\.dev\")/);
assert.match(clashBody, /"Host":"edgetunnel-rebuild-20261113\.example\.workers\.dev/);
assert.match(clashBody, /运营商 \| 移动/);
assert.match(clashBody, /地区 \| 日本/);
assert.match(clashBody, /172\.64\.229\.7/);
assert.match(clashBody, /2606:4700::1111/);

const v2ray = await workerDefault.fetch(new Request('https://edgetunnel-rebuild-20261113.example.workers.dev/v2ray?token=test-token'), env, ctx);
assert.equal(v2ray.status, 200);
const decoded = Buffer.from(await v2ray.text(), 'base64').toString('utf8');
assert.match(decoded, /^vless:\/\/11111111-1111-4111-8111-111111111111@/);
assert.match(decoded, /sni=edgetunnel-rebuild-20261113\.example\.workers\.dev/);

const quick = await workerDefault.fetch(new Request('https://edgetunnel-rebuild-20261113.example.workers.dev/test-key?clash'), env, ctx);
assert.equal(quick.status, 200);
assert.match(await quick.text(), /172\.64\.229\.7/);

globalThis.fetch = originalFetch;
console.log('isolated worker tests passed');
