export const ANCHORS = [
  { value: -15, image: 'reborn', name: '嚣张重生', line: '又活了，你气不气？', tag: '重生归来 · 蕉气冲天', color: '#b97919', wash: '#fff0ce' },
  { value: -10, image: 'minus10', name: '蕉气十足', line: '手里有蕉，心里不慌。', tag: '蕉气渐退 · 笑容渐甜', color: '#b97919', wash: '#fff4df' },
  { value: -5, image: 'minus5', name: '有点小得意', line: '本娘可爱，也是理所当然的。', tag: '一点得意 · 一点元气', color: '#d6803b', wash: '#fff3e9' },
  { value: 0, image: 'original', name: '元气 AC 娘', line: '今天，也要和你一起开开心心！', tag: '原装可爱 · 甜度刚好', color: '#e65368', wash: '#fff0f1' },
  { value: 5, image: 'plus5', name: '有点猪意', line: '嗯？鼻子好像有自己的想法。', tag: '猪意萌芽 · 可爱加倍', color: '#dc708b', wash: '#fff0f5' },
  { value: 10, image: 'plus10', name: '猪里猪气', line: '再睡五分钟，就五分钟。', tag: '软乎乎的 · 懒洋洋的', color: '#d46487', wash: '#ffeef4' },
  { value: 15, image: 'pig', name: '软萌小猪', line: '哼唧。今天的努力到此为止。', tag: '小猪模式 · 快乐满格', color: '#cb587f', wash: '#ffeaf2' },
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
