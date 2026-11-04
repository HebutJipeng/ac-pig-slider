import { stageFor } from '../src/domain.js';
export const COOLDOWN = 3 * 60 * 60 * 1000;
const DAY = 86400000;
export const schema = `CREATE TABLE IF NOT EXISTS voters (
 voter_hash TEXT PRIMARY KEY NOT NULL, ip_hash TEXT NOT NULL,
 position INTEGER NOT NULL CHECK(position BETWEEN -15 AND 15),
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
) STRICT;
CREATE INDEX IF NOT EXISTS voters_ip_created ON voters(ip_hash, created_at);
CREATE TABLE IF NOT EXISTS daily_snapshots (
 date TEXT PRIMARY KEY NOT NULL, score REAL NOT NULL CHECK(score BETWEEN -15 AND 15),
 voter_count INTEGER NOT NULL CHECK(voter_count >= 0), created_at INTEGER NOT NULL
) STRICT;`;
export function beijingDate(now) { return new Date(now + 8 * 3600000).toISOString().slice(0, 10); }
export function dayStart(now) { return Math.floor((now + 8 * 3600000) / DAY) * DAY - 8 * 3600000; }
export async function hash(secret, value) {
 const encoder = new TextEncoder();
 const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
 return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value))), byte => byte.toString(16).padStart(2, '0')).join('');
}
export async function aggregate(db, now) {
 const row = await db.prepare(`SELECT COUNT(*) AS count, COALESCE(SUM(position),0) AS total,
 SUM(CASE WHEN updated_at >= ? THEN 1 ELSE 0 END) AS today,
 SUM(CASE WHEN position > 0 THEN 1 ELSE 0 END) AS positive,
 SUM(CASE WHEN position < 0 THEN 1 ELSE 0 END) AS negative,
 SUM(CASE WHEN position = 0 THEN 1 ELSE 0 END) AS neutral FROM voters`).bind(dayStart(now)).first();
 const score = row.count ? Math.sign(row.total) * Math.round(Math.abs(row.total) * 100 / row.count) / 100 : 0;
 return { score: score || 0, stage: stageFor(score).name, voterCount: row.count, todayVoterCount: row.today || 0, positiveCount: row.positive || 0, negativeCount: row.negative || 0, neutralCount: row.neutral || 0 };
}
export async function snapshot(db, now) {
 const value = await aggregate(db, now);
 await db.prepare(`INSERT INTO daily_snapshots(date,score,voter_count,created_at) VALUES(?,?,?,?)
 ON CONFLICT(date) DO UPDATE SET score=excluded.score,voter_count=excluded.voter_count,created_at=excluded.created_at`).bind(beijingDate(now), value.score, value.voterCount, now).run();
}
export async function handleApi(request, env, now = Date.now()) {
 const url = new URL(request.url), origin = request.headers.get('Origin');
 const allowed = new Set([url.origin, ...(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)]);
 const cors = { 'Vary': 'Origin', 'Cache-Control': 'no-store', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
 if (origin && allowed.has(origin)) cors['Access-Control-Allow-Origin'] = origin;
 const json = (body, status = 200) => Response.json(body, { status, headers: cors });
 if (origin && !allowed.has(origin)) return json({ error: 'origin_not_allowed' }, 403);
 if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
 try {
  if (url.pathname === '/api/score' && request.method === 'GET') return json(await aggregate(env.DB, now));
  if (url.pathname === '/api/timeline' && request.method === 'GET') {
   const validDate = value => { if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false; const date = new Date(value + 'T00:00:00Z'); return Number.isFinite(date.getTime()) && date.toISOString().startsWith(value); };
   const from = url.searchParams.get('from'), to = url.searchParams.get('to');
   if ((from && !validDate(from)) || (to && !validDate(to)) || (from && to && from > to)) return json({ error: 'invalid_dates' }, 400);
   const result = await env.DB.prepare('SELECT date,score,voter_count FROM daily_snapshots WHERE date >= ? AND date <= ? ORDER BY date DESC LIMIT 90').bind(from || '0000-01-01', to || '9999-12-31').all();
   const days = result.results.reverse().map(day => ({ date: day.date, score: day.score, stage: stageFor(day.score).name, voterCount: day.voter_count }));
   return json(days);
  }
  if (url.pathname !== '/api/vote') return json({ error: 'not_found' }, 404);
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!origin || !allowed.has(origin)) return json({ error: 'origin_required' }, 403);
  if (!(request.headers.get('Content-Type') || '').toLowerCase().startsWith('application/json')) return json({ error: 'json_required' }, 415);
  let body;
  try { const text = await request.text(); if (text.length > 4096) return json({ error: 'body_too_large' }, 413); body = JSON.parse(text); } catch { return json({ error: 'invalid_body' }, 400); }
  if (!Number.isInteger(body?.position) || body.position < -15 || body.position > 15) return json({ error: 'invalid_position' }, 400);
  if (typeof body.fingerprint !== 'string' || !/^[a-zA-Z0-9-]{16,128}$/.test(body.fingerprint)) return json({ error: 'invalid_identity' }, 400);
  if (typeof env.VOTER_HASH_SECRET !== 'string' || new TextEncoder().encode(env.VOTER_HASH_SECRET).length < 32) return json({ error: 'service_unavailable' }, 503);
  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip) return json({ error: 'missing_ip' }, 400);
  const [voterHash, ipHash] = await Promise.all([hash(env.VOTER_HASH_SECRET, 'voter:' + body.fingerprint), hash(env.VOTER_HASH_SECRET, 'ip:' + ip)]);
  const getVoter = () => env.DB.prepare('SELECT position,updated_at FROM voters WHERE voter_hash=?').bind(voterHash).first();
  const cooldown = async voter => json({ accepted: false, reason: 'cooldown', userPosition: voter.position, nextVoteAt: voter.updated_at + COOLDOWN, ...await aggregate(env.DB, now) }, 429);
  const existing = await getVoter();
  if (existing) {
   if (now < existing.updated_at + COOLDOWN) return cooldown(existing);
   const result = await env.DB.prepare('UPDATE voters SET position=?,updated_at=? WHERE voter_hash=? AND updated_at<=?').bind(body.position, now, voterHash, now - COOLDOWN).run();
   if (result.meta.changes !== 1) return cooldown(await getVoter());
  } else {
   const result = await env.DB.prepare(`INSERT INTO voters(voter_hash,ip_hash,position,created_at,updated_at)
   SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM voters WHERE ip_hash=? AND created_at>=?)<5
   ON CONFLICT(voter_hash) DO NOTHING`).bind(voterHash, ipHash, body.position, now, now, ipHash, now - DAY).run();
   if (result.meta.changes !== 1) { const concurrent = await getVoter(); if (concurrent) return cooldown(concurrent); return json({ accepted: false, reason: 'rate_limited' }, 429); }
  }
  // Snapshot failure must not turn a committed ballot into a reported vote failure.
  try { await snapshot(env.DB, now); } catch (error) { console.error('Daily snapshot failed:', error.message); }
  return json({ accepted: true, userPosition: body.position, nextVoteAt: now + COOLDOWN, ...await aggregate(env.DB, now) });
 } catch (error) { console.error('API failed:', error.message); return json({ error: 'internal_server_error' }, 500); }
}
