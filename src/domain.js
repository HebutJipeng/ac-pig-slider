export const ANCHORS = [
  { value: -15, image: 'reborn', name: '嚣张重生', line: '本娘重生归来，谁还敢说我是猪？', tag: '重生归来 · 蕉气冲天', color: '#b97919', wash: '#fff0ce' },
  { value: -10, image: 'minus10-v2', name: '蕉气十足', line: '手里有蕉，心里不慌。', tag: '蕉气渐退 · 笑容渐甜', color: '#b97919', wash: '#fff4df' },
  { value: -5, image: 'minus5-v2', name: '有点小得意', line: '本娘可爱，也是理所当然的。', tag: '一点得意 · 一点元气', color: '#d6803b', wash: '#fff3e9' },
  { value: 0, image: 'original', name: '元气 AC 娘', line: '本娘天下第一可爱！', tag: '原装可爱 · 甜度刚好', color: '#e65368', wash: '#fff0f1' },
  { value: 5, image: 'plus5-v2', name: '有点猪意', line: '本娘不是猪，这只是鼻部装饰。', tag: '猪意萌芽 · 可爱加倍', color: '#dc708b', wash: '#fff0f5' },
  { value: 10, image: 'plus10-v2', name: '猪里猪气', line: '你见过这么可爱的猪……不，AC 娘吗？', tag: '软乎乎的 · 懒洋洋的', color: '#d46487', wash: '#ffeef4' },
  { value: 15, image: 'pig', name: '软萌小猪', line: '哼唧。……刚才那句不算。', tag: '小猪模式 · 快乐满格', color: '#cb587f', wash: '#ffeaf2' },
];
export function clamp(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(-15, Math.min(15, number)) : 0;
}
export function stageFor(value) {
  const score = clamp(value);
  return ANCHORS.reduce((best, stage) => Math.abs(score - stage.value) < Math.abs(score - best.value) ? stage : best);
}
export function framePair(value) {
  const score = clamp(value);
  const index = Math.min(5, Math.floor((score + 15) / 5));
  return { index, mix: (score - ANCHORS[index].value) / 5 };
}
export function signed(value, decimals = 0) {
  const n = clamp(value);
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(decimals)}`;
}
export function pigReport(value) {
  const score = clamp(value);
  const mood = score < -7.5 ? '气场两米八' : score < 0 ? '有一点小得意' : score === 0 ? '元气满格' : score < 7.5 ? '努力保持嘴硬' : score < 12.5 ? '逐渐放弃解释' : '只想快乐哼唧';
  const advice = score < 0 ? '建议先投蕉，再讲道理。' : score === 0 ? '可爱检验合格，建议继续保持。' : score < 7.5 ? '猪意已萌芽，建议减少狡辩。' : '建议投喂，暂停催更。';
  return { pigPercent: Math.round(Math.max(0, score) / 15 * 100), mood, advice };
}

export function defenseFor(value) {
  const level = clamp(value);
  if (level < -7.5) return '谁说我是猪？站出来。本娘允许你重新组织语言。';
  if (level < 2.5) return '你看，本娘这么可爱，谣言不攻自破。';
  if (level < 7.5) return '这是鼻部空气动力学套件，请不要过度解读。';
  if (level < 12.5) return '关于本人涉嫌猪化一事，目前没有任何实锤。';
  return '本娘最后强调一次，我绝对不是——';
}

export function mouthPose(volume, snort = false) {
  if (volume < .10) return 'mouthClosed';
  if (snort) return 'mouthRound';
  return volume < .50 ? 'mouthSmall' : 'mouthFull';
}

export function characterForm(value) {
  const level = clamp(value);
  return level < -7.5 ? 'reborn' : level >= 2.5 ? 'pig' : 'human';
}

export function speechEnvelope(samples, sampleRate, step = .02) {
  const size = Math.max(1, Math.round(sampleRate * step));
  const levels = [];
  for (let start = 0; start < samples.length; start += size) {
    const end = Math.min(samples.length, start + size);
    let energy = 0;
    for (let i = start; i < end; i++) energy += samples[i] * samples[i];
    levels.push(Math.sqrt(energy / (end - start)));
  }
  const sorted = [...levels].sort((a, b) => a - b);
  const peak = sorted[Math.floor((sorted.length - 1) * .95)] || sorted.at(-1) || 1;
  const floor = peak * .035;
  return { step, levels: levels.map(level => Math.max(0, Math.min(1, (level - floor) / (peak - floor)))) };
}

export function audioOutputTime(context, now) {
  const timestamp = context.getOutputTimestamp?.();
  if (timestamp?.performanceTime > 0 && timestamp.contextTime > 0) {
    return Math.min(context.currentTime, timestamp.contextTime + Math.max(0, now - timestamp.performanceTime) / 1000);
  }
  return Math.max(0, context.currentTime - (context.baseLatency || 0) - (context.outputLatency || 0));
}
