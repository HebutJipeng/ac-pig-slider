import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..'), dist = resolve(root, 'dist');
await rm(dist, { recursive: true, force: true }); await mkdir(dist, { recursive: true });
for (const path of ['index.html', 'src', 'public']) await cp(resolve(root, path), resolve(dist, path), { recursive: true });
// Optional separately hosted API. URL is serialized, never interpolated as executable code.
if (process.env.AC_API_BASE) {
 const url = new URL(process.env.AC_API_BASE);
 if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('AC_API_BASE must be a bare HTTPS origin');
 const { readFile } = await import('node:fs/promises');
 const index = await readFile(resolve(dist, 'index.html'), 'utf8');
 await writeFile(resolve(dist, 'public/config.js'), `window.AC_API_BASE = ${JSON.stringify(url.origin)};\n`);
 await writeFile(resolve(dist, 'index.html'), index.replace('<script type="module"', '<script src="./public/config.js"></script>\n  <script type="module"'));
}
console.log('Built dist/: static frontend, 7 portrait assets. No dependencies required.');
