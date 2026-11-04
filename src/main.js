import { ANCHORS, clamp, stageFor, framePair, signed } from './domain.js';
const $ = (selector) => document.querySelector(selector);
const canvas = $('#portrait');
const context = canvas.getContext('2d');
const slider = $('#level');
const images = [];
let score = 0, ready = false, animation = 0, animationStart = null, toastTimer, historyMode = false;
let community = null, voting = false, nextVoteAt = 0, timer;
let ownPosition = null, historyReturn = 0;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const storage = {
  get(key) { try { return localStorage.getItem(`ac-pig:${key}`); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(`ac-pig:${key}`, value); } catch { /* Private mode still supports the toy. */ } },
};
let identity = storage.get('identity');
if (!identity || !/^[a-zA-Z0-9-]{16,128}$/.test(identity)) { identity = crypto.randomUUID(); storage.set('identity', identity); }
try {
  const saved = JSON.parse(storage.get('vote') || 'null');
  if (saved && Number.isInteger(saved.position) && Math.abs(saved.position) <= 15 && Number.isFinite(saved.nextVoteAt)) {
    ownPosition = saved.position; nextVoteAt = saved.nextVoteAt;
  }
} catch { /* Ignore invalid local preferences. */ }
const url = new URL(location.href);
const initial = url.searchParams.has('level') ? clamp(url.searchParams.get('level')) : ownPosition ?? 0;
const apiBase = window.AC_API_BASE || '';
for (let i = 0; i < 31; i++) { const tick = document.createElement('i'); tick.className = 'tick'; $('#ticks').append(tick); }
function toast(message) { clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').hidden = false; toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 2700); }
function draw(target = canvas, value = score) {
  const ctx = target.getContext('2d');
  const { index, mix } = framePair(value);
  ctx.clearRect(0, 0, target.width, target.height);
  ctx.globalAlpha = 1;
  ctx.drawImage(images[index], 0, 0, target.width, target.height);
  if (mix > 0) { ctx.globalAlpha = mix; ctx.drawImage(images[index + 1], 0, 0, target.width, target.height); }
  ctx.globalAlpha = 1;
}
function setScore(value) {
  score = clamp(value);
  const stage = stageFor(score);
  slider.value = String(score);
  $('#level-value').textContent = signed(Math.round(score)).padStart(2, '0');
  $('#stage-name').textContent = stage.name;
  $('#stage-line').textContent = stage.line;
  $('#frame-label').textContent = stage.tag;
  $('#frame-count').replaceChildren(document.createTextNode(String(Math.round(score) + 16).padStart(2, '0') + ' '));
  const total = document.createElement('i'); total.textContent = '/ 31'; $('#frame-count').append(total);
  slider.setAttribute('aria-valuetext', `${stage.name}，强度 ${signed(Math.round(score))}`);
  canvas.setAttribute('aria-label', `${stage.name}，${stage.line}`);
  document.documentElement.style.setProperty('--accent', stage.color);
  document.documentElement.style.setProperty('--wash', stage.wash);
  document.querySelectorAll('[data-level]').forEach((button) => {
    const active = Number(button.dataset.level) === Math.round(score);
    button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', String(active));
  });
  if (ready) draw();
}
function stop() { cancelAnimationFrame(animation); animation = 0; animationStart = null; $('#play-label').textContent = '看她变一遍'; $('#play-icon').textContent = '▷'; $('#play').setAttribute('aria-pressed', 'false'); }
function exitHistory() { if (!historyMode) return; historyMode = false; document.body.classList.remove('is-history'); $('#exit-history').hidden = true; $('#portrait-caption').textContent = '今天的 AC 娘，也有一点不一样。'; document.querySelectorAll('.timeline-item').forEach(el => el.classList.remove('is-selected')); updateVoteButton(); }
function choose(value) { stop(); exitHistory(); setScore(value); }
slider.addEventListener('input', () => choose(slider.value));
slider.addEventListener('change', () => { const u = new URL(location.href); u.searchParams.set('level', String(Math.round(score))); history.replaceState(null, '', u); });
document.querySelectorAll('[data-level]').forEach(button => button.addEventListener('click', () => choose(Number(button.dataset.level))));
$('#reset').addEventListener('click', () => { choose(0); const u = new URL(location.href); u.searchParams.delete('level'); history.replaceState(null, '', u); });
$('#play').addEventListener('click', () => {
  if (animation) { stop(); return; }
  exitHistory(); $('#play-label').textContent = '暂停一下'; $('#play-icon').textContent = 'Ⅱ'; $('#play').setAttribute('aria-pressed', 'true');
  const duration = reducedMotion ? 18000 : 12000;
  function step(now) {
    animationStart ??= now;
    const progress = (now - animationStart) / duration;
    if (progress >= 1) { setScore(0); stop(); return; }
    let value = progress < .5 ? -15 + progress * 60 : 45 - progress * 60;
    if (reducedMotion) value = Math.round(value / 5) * 5;
    setScore(value); animation = requestAnimationFrame(step);
  }
  animation = requestAnimationFrame(step);
});
document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else if (community) void loadCommunity(); });
$('#download').addEventListener('click', () => {
  if (!ready) return;
  const output = document.createElement('canvas'); output.width = 1080; output.height = 1230;
  const ctx = output.getContext('2d'); ctx.fillStyle = '#faf8f3'; ctx.fillRect(0, 0, 1080, 1230);
  const portrait = document.createElement('canvas'); portrait.width = 1000; portrait.height = 1000; draw(portrait);
  ctx.drawImage(portrait, 40, 40); ctx.fillStyle = '#35332e'; ctx.font = 'bold 36px sans-serif'; ctx.fillText(stageFor(score).name, 42, 1105);
  ctx.fillStyle = '#a39786'; ctx.font = '22px sans-serif'; ctx.fillText(`滑动变猪器 · LEVEL ${signed(Math.round(score))}`, 42, 1150);
  ctx.fillStyle = '#d47089'; ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'right'; ctx.fillText('AC 娘小剧场', 1038, 1150);
  output.toBlob(blob => { if (!blob) { toast('图片保存失败，请重试'); return; } const link = document.createElement('a'); const objectUrl = URL.createObjectURL(blob); link.href = objectUrl; link.download = `AC娘-${stageFor(score).name}-${Math.round(score)}.png`; link.click(); setTimeout(() => URL.revokeObjectURL(objectUrl), 5000); }, 'image/png');
});
$('#share').addEventListener('click', async () => {
  const link = new URL(location.href); link.searchParams.set('level', String(Math.round(score))); link.hash = '';
  try {
    if (navigator.share) await navigator.share({ title: `AC娘 · ${stageFor(score).name}`, text: stageFor(score).line, url: link.href });
    else { await navigator.clipboard.writeText(link.href); toast('链接已复制，分享这一刻的 AC 娘吧'); }
  } catch (error) { if (error.name !== 'AbortError') { history.replaceState(null, '', link); toast('分享地址已放到浏览器地址栏，可以复制发送'); } }
});
async function loadImages() {
  ready = false; slider.disabled = true; $('#play').disabled = true; $('#download').disabled = true; $('#media-error').hidden = true;
  try {
    if (!context) throw new Error('Canvas unavailable');
    await Promise.all(ANCHORS.map(async (stage, index) => {
      const img = new Image(); img.src = new URL(`../public/portraits/${stage.image}.webp`, import.meta.url).href; await img.decode(); images[index] = img;
    }));
    ready = true; canvas.hidden = false; $('#poster').hidden = true; slider.disabled = false; $('#play').disabled = false; $('#download').disabled = false; setScore(score);
  } catch { $('#media-error').hidden = false; }
}
$('#retry').addEventListener('click', loadImages);
async function api(path, options = {}) {
  const response = await fetch(`${apiBase}/api/${path}`, { ...options, signal: AbortSignal.timeout(10000) });
  const data = await response.json();
  if (!response.ok && !(response.status === 429 && data.reason)) throw new Error(data.error || '服务暂时不可用');
  return data;
}
function isCommunity(data) { return data && Number.isFinite(data.score) && Math.abs(data.score) <= 15 && Number.isSafeInteger(data.voterCount) && data.voterCount >= 0 && Number.isSafeInteger(data.todayVoterCount) && data.todayVoterCount >= 0; }
function applyCommunity(data) {
  if (!isCommunity(data)) throw new Error('无效的社区数据');
  community = data; $('#connection-dot').classList.add('is-online'); $('#community-total').textContent = `${data.voterCount} 人参与`;
  $('#community-copy').textContent = `社区平均 ${signed(data.score, 2)} · ${stageFor(data.score).name}　今日 ${data.todayVoterCount} 人投票`;
  const marker = $('#community-marker'); marker.hidden = data.voterCount === 0; marker.style.left = `${4 + ((data.score + 15) / 30) * 92}%`; marker.title = `社区平均 ${signed(data.score, 2)}`;
  updateVoteButton();
}
function updateVoteButton() {
  clearTimeout(timer);
  const remaining = nextVoteAt - Date.now();
  $('#vote').disabled = !community || voting || remaining > 0 || historyMode;
  if (remaining > 0) {
    const minutes = Math.ceil(remaining / 60000); $('#vote').textContent = `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分后可修改`;
    timer = setTimeout(updateVoteButton, Math.min(remaining, 30000));
  } else $('#vote').textContent = ownPosition === null ? '就投这一票 ↗' : '修改我的选择 ↗';
}
async function loadCommunity() {
  try { applyCommunity(await api('score')); }
  catch { community = null; $('#connection-dot').classList.remove('is-online'); $('#community-total').textContent = '暂未连接'; $('#community-copy').textContent = '社区暂未连接，仍可自由变换和保存图片。'; $('#community-marker').hidden = true; updateVoteButton(); }
  try {
    const days = await api('timeline');
    if (!Array.isArray(days)) throw new Error('无效时间线');
    const track = $('#timeline'); track.replaceChildren();
    if (!days.length) { const empty = document.createElement('p'); empty.className = 'timeline-empty'; empty.textContent = '还没有社区记忆。投出第一票，留下今天的 AC 娘。'; track.append(empty); return; }
    for (const day of days) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date) || !Number.isFinite(day.score) || Math.abs(day.score) > 15 || !Number.isSafeInteger(day.voterCount) || day.voterCount < 0) continue;
      const button = document.createElement('button'); button.type = 'button'; button.className = 'timeline-item';
      const date = document.createElement('time'); date.dateTime = day.date; date.textContent = day.date.slice(5);
      const title = document.createElement('strong'); title.textContent = `${stageFor(day.score).name} ${signed(day.score, 1)}`;
      const count = document.createElement('small'); count.textContent = `${day.voterCount} 人的共同选择`;
      button.append(date, title, count); button.addEventListener('click', () => {
        stop(); if (!historyMode) historyReturn = score; historyMode = true; document.body.classList.add('is-history'); setScore(day.score);
        $('#frame-label').textContent = `${day.date} · 社区记忆`; $('#portrait-caption').textContent = '正在回看那一天的 AC 娘'; $('#exit-history').hidden = false;
        track.querySelectorAll('button').forEach(b => b.classList.toggle('is-selected', b === button)); updateVoteButton();
      }); track.append(button);
    }
  } catch { $('#timeline-note').textContent = '等待社区连接'; }
}
$('#exit-history').addEventListener('click', () => { exitHistory(); setScore(historyReturn); });
$('#vote').addEventListener('click', async () => {
  if (!community || voting || nextVoteAt > Date.now() || historyMode) return;
  stop(); voting = true; const position = Math.round(score); updateVoteButton(); $('#vote-feedback').textContent = '正在提交你的选择…';
  try {
    const data = await api('vote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fingerprint: identity, position }) });
    if (data.accepted || data.reason === 'cooldown') {
      if (!isCommunity(data) || !Number.isInteger(data.userPosition) || Math.abs(data.userPosition) > 15 || !Number.isFinite(data.nextVoteAt)) throw new Error('投票响应无效');
      ownPosition = data.userPosition; nextVoteAt = data.nextVoteAt; storage.set('vote', JSON.stringify({ position: ownPosition, nextVoteAt })); applyCommunity(data);
      $('#vote-feedback').textContent = data.accepted ? `已记下你的选择：${stageFor(position).name}，每 3 小时可修改一次。` : '还在冷却中，原来的选择已保留。';
      void loadCommunity();
    } else if (data.reason === 'rate_limited') $('#vote-feedback').textContent = '这个网络今天新增的投票身份较多，请明天再试。';
    else throw new Error('投票未被接受');
  } catch { $('#vote-feedback').textContent = '这次没投成功，稍后再试。你的预览不会受影响。'; }
  finally { voting = false; updateVoteButton(); }
});
window.addEventListener('focus', updateVoteButton);
setScore(initial); void loadImages(); void loadCommunity();
