import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const files = ['index.html', 'src/main.js', 'src/domain.js', 'src/styles.css', 'public/favicon.svg', ...(await readdir(resolve(root,'public/portraits'))).map(name=>'public/portraits/'+name)];
const assets = {};
for(const file of files) assets['/'+file] = { type: mime[extname(file)], data: (await readFile(resolve(root,file))).toString('base64') };
const domain = (await readFile(resolve(root,'src/domain.js'),'utf8')).replace(/^export /gm,'');
const api = (await readFile(resolve(root,'server/api.mjs'),'utf8')).replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
const entry = `${domain}\n${api}\nconst assets=${JSON.stringify(assets)};\nexport default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname.startsWith('/api/'))return handleApi(request,env);
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
  const asset=assets[url.pathname==='/'?'/index.html':url.pathname];
  if(!asset)return new Response('Not found',{status:404});
  return new Response(request.method==='HEAD'?null:Uint8Array.from(atob(asset.data),c=>c.charCodeAt(0)),{headers:{'Content-Type':asset.type,'X-Content-Type-Options':'nosniff','Cache-Control':url.pathname.endsWith('.webp')?'public,max-age=3600':'no-cache'}});
 },
 async scheduled(event,env){await snapshot(env.DB,event.scheduledTime);}
};\n`;
await rm(resolve(root,'dist'),{recursive:true,force:true});
await mkdir(resolve(root,'dist/server'),{recursive:true});await mkdir(resolve(root,'dist/.openai'),{recursive:true});
await writeFile(resolve(root,'dist/server/index.js'),entry);
await writeFile(resolve(root,'dist/.openai/hosting.json'),await readFile(resolve(root,'.openai/hosting.json')));
console.log(`Built hosted Worker: ${(Buffer.byteLength(entry)/1024/1024).toFixed(2)} MiB, ${files.length} embedded assets, same-origin community API.`);
