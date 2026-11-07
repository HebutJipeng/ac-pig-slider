import { ANCHORS, clamp, stageFor, framePair, signed, pigReport, defenseFor } from './domain.js';
import { loadCharacter, unlockVoice } from './rive-character.js';
let character, characterLoading;
function prepareCharacter() {
  characterLoading ??= loadCharacter(document.querySelector('#rive-portrait')).then(value => character = value).catch(error => { characterLoading = null; throw error; });
  return characterLoading;
}
const $ = (selector) => document.querySelector(selector);
const canvas = $('#portrait');
const context = canvas.getContext('2d');
const slider = $('#level');
const images = [];
let score = 0, ready = false, animation = 0, animationStart = null, toastTimer, historyMode = false;
let community = null, voting = false, nextVoteAt = 0, timer;
let ownPosition = null, historyReturn = 0;
let revealTimer = null, receiptFilename = '';
let defenseRun = 0, defenseTimer, defenseActive = false, defenseResult = null;
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
  cancelDefense();
  defenseResult = null;
  resetDefense();
  cancelReveal();
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
function cancelReveal() {
  if (revealTimer === null) return;
  clearTimeout(revealTimer); revealTimer = null;
  $('#reaction-bubble').hidden = true;
  $('#portrait-frame').classList.remove('is-revealed');
  $('#frame-label').textContent = stageFor(score).tag;
  canvas.setAttribute('aria-label', `${stageFor(score).name}，${stageFor(score).line}`);
  $('#reveal').disabled = !ready || historyMode;
  if (ready) draw();
}
function resetDefense() {
  $('#defense-status').textContent = '尚未开庭';
  $('#defense-caption').textContent = '形态可以变，口供不能改。';
  $('#defend').textContent = '请解释一下 ↗';
  $('#defense-card').hidden = true;
  $('#defend').disabled = !ready || historyMode;
}
function cancelDefense() {
  defenseRun++;
  clearTimeout(defenseTimer);
  if (defenseActive) {
    defenseResult = null;
    $('#defend').textContent = '请解释一下 ↗';
    $('#defense-card').hidden = true;

  }
  character?.hide();
  defenseActive = false;
  $('#portrait-frame').classList.remove('is-defending', 'is-caught');
  $('#defense-stop').hidden = true;
  $('#defend').disabled = !ready || historyMode;
  if (['正在答辩', '正在加载 Rive 角色', 'Rive 角色入场中'].includes($('#defense-status').textContent)) {
    $('#defense-status').textContent = '答辩已暂停';
    $('#defense-caption').textContent = '本娘申请休庭。';
  }
}
function speakLine(text, run, done) {
  $('#defense-caption').textContent = text;
  let finished = false;
  const finish = () => {
    if (finished || run !== defenseRun) return;
    finished = true; clearTimeout(defenseTimer); done();
  };
  const failed = () => {
    if (run !== defenseRun) return;
    $('#voice-note').textContent = '音频未能播放，继续字幕；可再次点击重播';
    defenseTimer = setTimeout(finish, Math.max(1800, text.length * 130));
  };
  character.speak(text, !$('#defense-voice').checked, finish, failed);
  defenseTimer = setTimeout(() => {
    if (run !== defenseRun) return;
    character.stop(); finish();
  }, 15000);
}
$('#defense-stop').addEventListener('click', cancelDefense);
$('#defense-voice').addEventListener('change', () => { if (defenseActive) cancelDefense(); });
$('#defend').addEventListener('click', async () => {
  if (!ready || historyMode || defenseActive) return;
  void unlockVoice().catch(() => {});
  stop(); cancelReveal(); cancelDefense();
  const run = defenseRun;
  const followup = defenseResult !== null;
  defenseActive = true;
  $('#defend').disabled = true;
  $('#defense-card').hidden = true;
  $('#defense-stop').hidden = false;
  $('#defense-status').textContent = '正在加载 Rive 角色';
  try { await prepareCharacter(); } catch {
    if (run !== defenseRun) return;
    cancelDefense();
    $('#defense-status').textContent = '角色加载失败';
    $('#defense-caption').textContent = '请检查网络后再点一次，原来的滑杆仍可使用。';
    return;
  }
  if (run !== defenseRun) return;
  $('#defense-status').textContent = 'Rive 角色入场中';
  try { await character.show(score); } catch {
    if (run !== defenseRun) return;
    cancelDefense(); $('#defense-status').textContent = '角色启动失败，请重试'; return;
  }
  if (run !== defenseRun) return;
  if (followup && score >= 12.5) character.caught();
  $('#defense-status').textContent = '正在答辩';
  $('#portrait-frame').classList.add('is-defending');
  const finish = () => {
    if (run !== defenseRun) return;
    defenseActive = false;
    $('#portrait-frame').classList.remove('is-defending');
    $('#defense-stop').hidden = true;
    $('#defend').disabled = historyMode;
    $('#defend').textContent = score >= 12.5 ? '你刚才哼了吧？' : '你确定吗？';
    $('#defense-card').hidden = false;
    $('#defense-status').textContent = score >= 12.5 ? '本次答辩新增实锤 1 项' : '口供已记录 · 拒不承认';
  };
  if (followup) {
    const statement = score >= 12.5 ? '那是椅子响。' : '本娘申请换一个问题。';
    defenseResult = { statement };
    speakLine(statement, run, finish);
  } else {
    defenseResult = { statement: '本娘不是猪。' };
    speakLine(defenseFor(score), run, () => {
      if (score < 12.5) { finish(); return; }
      $('#portrait-frame').classList.add('is-caught');
      character.caught();
      defenseResult = { statement: '哼唧。' };
      speakLine('哼唧。', run, () => {
        $('#defense-caption').textContent = '……（眨眼，假装无事发生）';
        defenseTimer = setTimeout(finish, 900);
      });
    });
  }
});
window.addEventListener('resize', () => character?.resize());
$('#reveal').addEventListener('click', () => {
  if (!ready || historyMode) return;
  stop(); cancelDefense(); cancelReveal();
  draw(canvas, 15);
  canvas.setAttribute('aria-label', '掉马彩蛋：临时露出小猪形态，滑杆选择未改变');
  $('#portrait-frame').classList.add('is-revealed');
  $('#frame-label').textContent = '临时掉马 · 选择没有改变';
  $('#reaction-bubble').textContent = score >= 12.5 ? '都这样了，本娘也要嘴硬：不是猪！' : '哼唧！……被发现了。';
  $('#reaction-bubble').hidden = false;
  $('#reveal').disabled = true;
  revealTimer = setTimeout(() => {
    setScore(score);
    $('#stage-line').textContent = score >= 12.5 ? '鼻子是猪鼻，嘴还得是硬的。' : '刚才网络卡了，你什么都没看见。';
  }, 1800);
});
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
document.addEventListener('visibilitychange', () => { if (document.hidden) { stop(); cancelReveal(); cancelDefense(); } else if (community) void loadCommunity(); });
function makeReceipt(isDefense = false) {
  if (!ready) return;
  stop(); cancelReveal(); cancelDefense();
  const report = pigReport(score);
  const output = document.createElement('canvas'); output.width = 1080; output.height = 1550;
  const ctx = output.getContext('2d'); ctx.fillStyle = '#faf8f3'; ctx.fillRect(0, 0, output.width, output.height);
  const portrait = document.createElement('canvas'); portrait.width = 1000; portrait.height = 1000; draw(portrait);
  ctx.drawImage(portrait, 40, 40);
  ctx.fillStyle = '#35332e'; ctx.font = 'bold 42px sans-serif'; ctx.fillText(isDefense ? 'AC 娘嘴硬鉴定书' : '今日猪况证明', 42, 1110);
  ctx.textAlign = 'right'; ctx.font = '21px sans-serif'; ctx.fillStyle = '#a39786';
  ctx.fillText(new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()), 1038, 1106);
  ctx.strokeStyle = '#ddd1c4'; ctx.lineWidth = 2; ctx.setLineDash([8, 7]); ctx.beginPath(); ctx.moveTo(42, 1140); ctx.lineTo(1038, 1140); ctx.stroke(); ctx.setLineDash([]);
  const rows = [['当前形态', `${stageFor(score).name} · LEVEL ${signed(Math.round(score))}`], ['猪化程度', `${report.pigPercent}%`], [isDefense ? '本人态度' : '精神状态', isDefense ? '拒不承认' : report.mood], [isDefense ? '最后陈述' : '鉴定意见', isDefense ? defenseResult.statement : report.advice]];
  ctx.font = '25px sans-serif';
  rows.forEach(([label, value], index) => {
    const y = 1196 + index * 57;
    ctx.textAlign = 'left'; ctx.fillStyle = '#a39786'; ctx.fillText(label, 44, y);
    ctx.textAlign = 'right'; ctx.fillStyle = index === 1 ? '#d47089' : '#514a40'; ctx.fillText(value, 1036, y);
  });
  ctx.fillStyle = '#d47089'; ctx.textAlign = 'left'; ctx.font = 'bold 24px sans-serif'; ctx.fillText('AC 娘小剧场 · 滑动变猪器', 44, 1470);
  ctx.fillStyle = '#a39786'; ctx.font = '19px sans-serif'; ctx.fillText('仅供娱乐，鉴定的是当前形态，哼唧也不会自动投票。', 44, 1508);
  $('#receipt-preview').src = output.toDataURL('image/png');
  $('#receipt-title').textContent = isDefense ? 'AC 娘嘴硬鉴定书' : '今日猪况证明';
  $('#receipt-preview').alt = isDefense ? '嘴硬鉴定书：当前形态、猪化程度、本人态度和最后陈述' : '当前形态的今日猪况证明';
  receiptFilename = `AC娘-${isDefense ? '嘴硬鉴定书' : '今日猪况证明'}-${Math.round(score)}.png`;
  $('#receipt-dialog').showModal();
}
$('#download').addEventListener('click', () => makeReceipt());
$('#defense-card').addEventListener('click', () => { if (defenseResult) makeReceipt(true); });
$('#receipt-save').addEventListener('click', () => {
  const link = document.createElement('a'); link.href = $('#receipt-preview').src; link.download = receiptFilename; link.click();
});
$('#receipt-close').addEventListener('click', () => $('#receipt-dialog').close());
$('#receipt-dialog').addEventListener('click', event => { if (event.target === $('#receipt-dialog')) $('#receipt-dialog').close(); });
$('#receipt-dialog').addEventListener('close', () => $('#receipt-preview').removeAttribute('src'));
$('#share').addEventListener('click', async () => {
  const link = new URL(location.href); link.searchParams.set('level', String(Math.round(score))); link.hash = '';
  try {
    if (navigator.share) await navigator.share({ title: `AC娘 · ${stageFor(score).name}`, text: stageFor(score).line, url: link.href });
    else { await navigator.clipboard.writeText(link.href); toast('链接已复制，分享这一刻的 AC 娘吧'); }
  } catch (error) { if (error.name !== 'AbortError') { history.replaceState(null, '', link); toast('分享地址已放到浏览器地址栏，可以复制发送'); } }
});
async function loadImages() {
  cancelReveal(); ready = false; slider.disabled = true; $('#play').disabled = true; $('#download').disabled = true; $('#reveal').disabled = true; $('#media-error').hidden = true;
  try {
    if (!context) throw new Error('Canvas unavailable');
    await Promise.all(ANCHORS.map(async (stage, index) => {
      const img = new Image(); img.src = new URL(`../public/portraits/${stage.image}.webp`, import.meta.url).href; await img.decode(); images[index] = img;
    }));
    ready = true; canvas.hidden = false; $('#poster').hidden = true; slider.disabled = false; $('#play').disabled = false; $('#download').disabled = false; $('#reveal').disabled = historyMode; setScore(score);
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
  $('#reveal').disabled = !ready || historyMode || revealTimer !== null;
  $('#defend').disabled = !ready || historyMode || defenseActive;
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
  stop(); cancelReveal(); voting = true; const position = Math.round(score); updateVoteButton(); $('#vote-feedback').textContent = '正在提交你的选择…';
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
