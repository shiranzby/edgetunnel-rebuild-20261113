import { mkdir, readFile, writeFile } from 'node:fs/promises';
import worker from '../worker.js';

const snapshot = JSON.parse(await readFile(new URL('../data/cfip.json', import.meta.url), 'utf8'));
globalThis.fetch = async () => Response.json(snapshot);
const origin = process.env.PUBLIC_WORKER_ORIGIN || 'https://cf-sub.shw.de5.net';
const response = await worker.fetch(new Request(origin + '/'), {});
if (!response.ok) throw new Error(`Page generation failed: ${response.status}`);
await mkdir(new URL('../pages/', import.meta.url), { recursive: true });
await writeFile(new URL('../pages/index.html', import.meta.url), await response.text());
await writeFile(new URL('../pages/_headers', import.meta.url), '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: same-origin\n');
console.log('Built Pages from the same Worker page and public dataset.');
