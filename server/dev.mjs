import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { randomBytes } from 'node:crypto';
import { handleApi } from './api.mjs';
import { openDatabase } from './sqlite.mjs';
const root = resolve(import.meta.dirname, '..');
await mkdir(resolve(root, '.data'), { recursive: true });
const secretFile = resolve(root, '.data/secret');
let secret = process.env.VOTER_HASH_SECRET;
if (!secret) { try { secret = await readFile(secretFile, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; secret = randomBytes(32).toString('hex'); await writeFile(secretFile, secret, { mode: 0o600 }); } }
const DB = openDatabase(resolve(root, '.data/votes.sqlite'));
const port = Number(process.env.PORT || 5173);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.wasm': 'application/wasm', '.m4a': 'audio/mp4', '.riv': 'application/octet-stream' };
const server = createServer(async (incoming, outgoing) => {
 try {
  const origin = `http://127.0.0.1:${port}`;
  const url = new URL(incoming.url, origin);
  if (url.pathname.startsWith('/api/')) {
   if (!['GET', 'POST', 'OPTIONS'].includes(incoming.method)) { outgoing.writeHead(405); outgoing.end(); return; }
   const chunks = []; let size = 0;
   for await (const chunk of incoming) { size += chunk.length; if (size > 8192) { outgoing.writeHead(413); outgoing.end(); return; } chunks.push(chunk); }
   const headers = new Headers(incoming.headers);
   // Ignore any client-supplied CF header in the local server.
   headers.set('CF-Connecting-IP', incoming.socket.remoteAddress || '127.0.0.1');
   const request = new Request(url, { method: incoming.method, headers, ...(incoming.method === 'POST' ? { body: Buffer.concat(chunks) } : {}) });
   const response = await handleApi(request, { DB, VOTER_HASH_SECRET: secret, ALLOWED_ORIGINS: `http://localhost:${port},${origin}` });
   outgoing.writeHead(response.status, Object.fromEntries(response.headers)); outgoing.end(Buffer.from(await response.arrayBuffer())); return;
  }
  if (!['GET', 'HEAD'].includes(incoming.method)) { outgoing.writeHead(405); outgoing.end(); return; }
  let relative;
  try { relative = decodeURIComponent(url.pathname).replace(/^\/+/, ''); } catch { outgoing.writeHead(400); outgoing.end(); return; }
  if (!relative) relative = 'index.html';
  // Serve only the frontend and its public assets, never local data or source credentials.
  if (!(relative === 'index.html' || /^(src\/(main\.js|domain\.js|rive-character\.js|styles\.css)|public\/[a-zA-Z0-9_./-]+)$/.test(relative))) { outgoing.writeHead(404); outgoing.end('Not found'); return; }
  const path = resolve(root, relative);
  if (!path.startsWith(root + sep) || relative.split('/').some(part => part === '..' || part.startsWith('.'))) { outgoing.writeHead(403); outgoing.end(); return; }
  try { const data = await readFile(path); outgoing.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' }); outgoing.end(incoming.method === 'HEAD' ? undefined : data); }
  catch (error) { if (error.code !== 'ENOENT' && error.code !== 'EISDIR') throw error; outgoing.writeHead(404); outgoing.end('Not found'); }
 } catch (error) { console.error(error.message); if (!outgoing.headersSent) outgoing.writeHead(500); outgoing.end('Server error'); }
});
server.listen(port, '127.0.0.1', () => console.log(`AC娘 · 滑动变猪器\nLocal: http://127.0.0.1:${port}\n社区投票已启用，数据保存在 .data/`));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => { DB.close(); process.exit(0); }));
