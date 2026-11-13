import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import gateway from '../gateway-worker.js';

// A malicious path must not activate an upstream's proxy-override parser.
const source = await readFile(new URL('../node-worker.js', import.meta.url), 'utf8');
const fixture = source.replace(
  "import { upstreamWebSocket } from './upstream/cmliu-worker.js';",
  'const upstreamWebSocket = async (request, uuid, url, context) => Response.json({context});',
);
const path = join(tmpdir(), `cf-direct-adapter-${process.pid}.mjs`);
try {
  await writeFile(path, fixture);
  const { default: node } = await import(`file:///${path.replace(/\\/g, '/')}`);
  const env = { UUID: '11111111-1111-4111-8111-111111111111' };
  const response = await node.fetch(new Request('https://example.test/proxyip=private-vps?globalproxy&socks5=private-vps:9504'), env);
  const { context } = await response.json();
  assert.equal(context.反代IP, '');
  assert.equal(context.代理类型, null);
  assert.equal(context.代理全局, false);
  assert.equal(context.反代兜底, false);
  assert.equal((await node.fetch(new Request('https://example.test/'), {})).status, 503);
} finally {
  await unlink(path);
}

const request = new Request('https://example.test/sub?token=fixture');
let forwarded;
const result = await gateway.fetch(request, {
  BACKEND: { fetch(value) { forwarded = value; return new Response('subscription'); } },
});
assert.equal(forwarded, request);
assert.equal(await result.text(), 'subscription');
const failure = await gateway.fetch(request, {
  BACKEND: { fetch() { throw new Error('test backend offline'); } },
});
assert.equal(failure.status, 503);
assert.doesNotMatch(await failure.text(), /token=fixture/);
console.log('direct-only context, override isolation and gateway forwarding passed');
