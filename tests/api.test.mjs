import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleApi, COOLDOWN, beijingDate, dayStart } from '../server/api.mjs';
import { openDatabase } from '../server/sqlite.mjs';
const NOW = Date.UTC(2026, 10, 3, 4), origin = 'https://ac.example';
function setup(t) { const DB = openDatabase(); t.after(() => DB.close()); return { DB, VOTER_HASH_SECRET: 'test-only-secret-at-least-thirty-two-characters', ALLOWED_ORIGINS: origin }; }
function req(path, body, extras = {}) { return new Request(origin + '/api/' + path, { method: body === undefined ? 'GET' : 'POST', headers: { Origin: origin, 'CF-Connecting-IP': '203.0.113.4', 'Content-Type': 'application/json', ...extras }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); }
const ballot = (id, position = 15) => ({ fingerprint: `test-browser-identity-${id}`, position });
test('empty score and first vote are real aggregates; identifiers are HMAC hashed', async t => {
 const env = setup(t); let r = await handleApi(req('score'), env, NOW); assert.equal((await r.json()).voterCount, 0);
 r = await handleApi(req('vote', ballot(1)), env, NOW); assert.equal(r.status, 200); const vote = await r.json(); assert.equal(vote.score, 15); assert.equal(vote.voterCount, 1); assert.equal(vote.nextVoteAt, NOW + COOLDOWN);
 const row = await env.DB.prepare('SELECT * FROM voters').first(); assert.match(row.voter_hash, /^[a-f0-9]{64}$/); assert.match(row.ip_hash, /^[a-f0-9]{64}$/); assert.ok(!JSON.stringify(row).includes('test-browser'));
});
test('three-hour cooldown is server enforced; editing replaces a ballot', async t => {
 const env = setup(t); await handleApi(req('vote', ballot(1, -15)), env, NOW);
 let response = await handleApi(req('vote', ballot(1, 15)), env, NOW + COOLDOWN - 1); assert.equal(response.status, 429); assert.equal((await response.json()).userPosition, -15);
 response = await handleApi(req('vote', ballot(1, 15)), env, NOW + COOLDOWN); const data = await response.json(); assert.equal(data.accepted, true); assert.equal(data.voterCount, 1); assert.equal(data.score, 15);
});
test('concurrent new requests cannot duplicate a voter', async t => {
 const env = setup(t); const responses = await Promise.all([handleApi(req('vote', ballot(1, 10)), env, NOW), handleApi(req('vote', ballot(1, 15)), env, NOW)]);
 assert.deepEqual(responses.map(r => r.status).sort(), [200, 429]); assert.equal((await env.DB.prepare('SELECT COUNT(*) AS count FROM voters').first()).count, 1);
});
test('one IP can create five new identities per rolling 24 hours', async t => {
 const env = setup(t); for (let i=0;i<5;i++) assert.equal((await handleApi(req('vote', ballot(i)), env, NOW)).status, 200);
 let r = await handleApi(req('vote', ballot(6)), env, NOW); assert.equal(r.status, 429); assert.equal((await r.json()).reason, 'rate_limited');
 r = await handleApi(req('vote', ballot(6)), env, NOW + 86400001); assert.equal(r.status, 200);
});
test('rejects invalid votes, bad origins, content types, and missing secret/IP', async t => {
 const env = setup(t);
 for(const value of [16, -16, 0.5, '5', null]) assert.equal((await handleApi(req('vote', ballot(1,value)), env, NOW)).status, 400);
 assert.equal((await handleApi(req('vote', {fingerprint: 'bad',position:0}), env, NOW)).status,400);
 assert.equal((await handleApi(req('vote', ballot(1),{Origin:'https://evil.example'}), env,NOW)).status,403);
 assert.equal((await handleApi(req('vote', ballot(1),{'Content-Type':'text/plain'}), env,NOW)).status,415);
 assert.equal((await handleApi(req('vote', ballot(1),{'CF-Connecting-IP':''}), env,NOW)).status,400);
 assert.equal((await handleApi(req('vote', ballot(1)), {...env,VOTER_HASH_SECRET:''},NOW)).status,503);
 const noOrigin = req('vote',ballot(1)); noOrigin.headers.delete('Origin'); assert.equal((await handleApi(noOrigin,env,NOW)).status,403);
});
test('rounds community mean symmetrically and counts neutral voters', async t => {
 const env=setup(t); await handleApi(req('vote',ballot(1,-1)),env,NOW); await handleApi(req('vote',ballot(2,0)),env,NOW); await handleApi(req('vote',ballot(3,0)),env,NOW);
 const data=await (await handleApi(req('score'),env,NOW)).json(); assert.equal(data.score,-0.33); assert.equal(data.voterCount,3); assert.equal(data.neutralCount,2); assert.equal(data.negativeCount,1); assert.equal(data.todayVoterCount,3);
});
test('snapshots upsert same day, retain previous days, and validate date filters', async t => {
 const env=setup(t); await handleApi(req('vote',ballot(1,-15)),env,NOW); await handleApi(req('vote',ballot(2,15)),env,NOW+100);
 let days=await (await handleApi(req('timeline'),env,NOW)).json(); assert.equal(days.length,1); assert.equal(days[0].score,0); assert.equal(days[0].date,'2026-11-03');
 await handleApi(req('vote',ballot(1,15)),env,NOW+86400000); days=await (await handleApi(req('timeline'),env,NOW+86400000)).json(); assert.equal(days.length,2); assert.equal(days[0].score,0); assert.equal(days[1].score,15);
 assert.equal((await handleApi(req('timeline?from=2026-02-30'),env,NOW)).status,400);
 assert.equal((await handleApi(req('timeline?from=2026-11-04&to=2026-11-03'),env,NOW)).status,400);
 days=await (await handleApi(req('timeline?from=2026-11-04'),env,NOW)).json(); assert.equal(days.length,1);
});
test('Beijing day boundary and CORS preflight',async t=>{
 assert.equal(beijingDate(Date.UTC(2026,10,3,15,59)),'2026-11-03'); assert.equal(beijingDate(Date.UTC(2026,10,3,16)),'2026-11-04'); assert.equal(dayStart(NOW),Date.UTC(2026,10,2,16));
 const env=setup(t);const request=new Request(origin+'/api/vote',{method:'OPTIONS',headers:{Origin:origin}});const r=await handleApi(request,env,NOW);assert.equal(r.status,204);assert.equal(r.headers.get('Access-Control-Allow-Origin'),origin);
});
