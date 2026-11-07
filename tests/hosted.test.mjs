import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/sqlite.mjs';
import worker from '../dist/server/index.js';
import { ANCHORS } from '../src/domain.js';
test('bundled Worker serves the page and each image without leaking project files', async()=>{
 const response = await worker.fetch(new Request('https://ac.example/'), {}); assert.equal(response.status,200); assert.match(await response.text(),/滑动变猪器/);
 for(const { image: name } of ANCHORS) {
  const response=await worker.fetch(new Request(`https://ac.example/public/portraits/${name}.webp`),{});assert.equal(response.status,200);assert.equal(response.headers.get('Content-Type'),'image/webp');assert.ok((await response.arrayBuffer()).byteLength>10000);
 }
 for(const path of ['/.data/secret','/server/api.mjs','/.openai/hosting.json','/assets/imgs/test.png']) assert.equal((await worker.fetch(new Request('https://ac.example'+path),{})).status,404);
});
test('bundled Worker uses the same persistent voting API',async t=>{
 const DB=openDatabase();t.after(()=>DB.close());const env={DB,VOTER_HASH_SECRET:'test-secret-that-is-longer-than-thirty-two-bytes'};
 const request=new Request('https://ac.example/api/vote',{method:'POST',headers:{Origin:'https://ac.example','Content-Type':'application/json','CF-Connecting-IP':'203.0.113.9'},body:JSON.stringify({fingerprint:'browser-id-for-hosted-test',position:5})});
 const response=await worker.fetch(request,env);assert.equal(response.status,200);assert.equal((await response.json()).accepted,true);
 const score=await (await worker.fetch(new Request('https://ac.example/api/score'),env)).json();assert.equal(score.score,5);assert.equal(score.voterCount,1);
});

test('Rive runtime, model and speech are served with browser-compatible MIME types', async () => {
 for (const [path, type] of [
  ['/src/rive-character.js', 'text/javascript; charset=utf-8'],
  ['/public/rive/ac-mascot.riv', 'application/octet-stream'],
  ['/public/rive/speech.json', 'application/json'],
  ['/public/rive/line-4.m4a', 'audio/mp4'],
  ['/public/vendor/rive/rive.wasm', 'application/wasm'],
  ['/public/vendor/rive/rive_fallback.wasm', 'application/wasm'],
 ]) {
  const response = await worker.fetch(new Request(`https://ac.example${path}`), {});
  assert.equal(response.status, 200, path);
  assert.equal(response.headers.get('Content-Type'), type, path);
 }
 assert.equal((await worker.fetch(new Request('https://ac.example/rive/ac-mascot/scene.rml'), {})).status, 404);
});
