import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { defenseFor, mouthPose, characterForm, speechEnvelope, audioOutputTime } from '../src/domain.js';

test('every defense line has a playable audio file', async () => {
  const speech = JSON.parse(await readFile(new URL('../public/rive/speech.json', import.meta.url), 'utf8'));
  const required = [...new Set([-15, 0, 5, 10, 15].map(defenseFor)), '哼唧。', '那是椅子响。', '本娘申请换一个问题。'];
  assert.equal(Object.keys(speech).length, required.length);
  for (const text of required) {
    const clip = speech[text];
    assert.ok(clip, text);
    assert.match(clip.file, /^line-\d+\.m4a$/);
    const audio = await readFile(new URL(`../public/rive/${clip.file}`, import.meta.url));
    assert.equal(audio.toString('ascii', 4, 8), 'ftyp');
    assert.ok(audio.length > 5000);
  }
});

test('the exported Rive and editable source contain the character contract', async () => {
  const riv = await readFile(new URL('../public/rive/ac-mascot.riv', import.meta.url));
  assert.equal(riv.toString('ascii', 0, 4), 'RIVE');
  for (const name of ['Character', 'reborn', 'mouthOpen', 'mouthWide', 'embarrassed', 'ready', 'talking', 'mouthClosed', 'mouthSmall', 'mouthFull', 'mouthRound']) assert.ok(riv.includes(Buffer.from(name)), name);
  const source = await readFile(new URL('../rive/ac-mascot/scene.rml', import.meta.url), 'utf8');
  assert.match(source, /<LinearAnimation[^>]*loopValue="loop"/);
  assert.match(source, /file="\.\.\/\.\.\/public\/portraits\/pig\.webp"/);
  assert.match(source, /file="\.\.\/\.\.\/public\/portraits\/original\.webp"/);
  assert.ok(source.includes('../../public/portraits/reborn.webp'));
  assert.match(source, /name="Arrogant reborn"/);
  assert.match(source, /<ClippingShape/);
  assert.match(source, /name="Left eye"/);
  assert.doesNotMatch(source, /ScriptAsset|Mouth silhouette|Closed smile/);
  for (const form of ['cute', 'pig', 'reborn']) {
    const file = `assets/${form}-mouths-${form === 'reborn' ? 'v4' : 'v3'}.webp`;
    assert.ok(source.includes(file));
    const sheet = await readFile(new URL(`../rive/ac-mascot/${file}`, import.meta.url));
    assert.equal(sheet.toString('ascii', 0, 4), 'RIFF');
    assert.equal(sheet.toString('ascii', 8, 12), 'WEBP');
  }
});

test('speech selects matching sprites and preserves a closed snort pause', () => {
  assert.equal(mouthPose(0), 'mouthClosed');
  assert.equal(mouthPose(.099), 'mouthClosed');
  assert.equal(mouthPose(.10), 'mouthSmall');
  assert.equal(mouthPose(.49), 'mouthSmall');
  assert.equal(mouthPose(.50), 'mouthFull');
  assert.equal(mouthPose(1), 'mouthFull');
  assert.equal(mouthPose(.7, true), 'mouthRound');
  assert.equal(mouthPose(0, true), 'mouthClosed');
});

test('arrogant defense uses its own Rive form at the correct boundary', () => {
  assert.equal(characterForm(-15), 'reborn');
  assert.equal(characterForm(-10), 'reborn');
  assert.equal(characterForm(-7.51), 'reborn');
  assert.equal(characterForm(-7.5), 'human');
  assert.equal(characterForm(0), 'human');
  assert.equal(characterForm(2.49), 'human');
  assert.equal(characterForm(2.5), 'pig');
  assert.equal(characterForm(15), 'pig');
  assert.equal(characterForm('bad'), 'human');
  assert.match(defenseFor(-15), /重新组织语言/);
});

test('decoded speech envelope preserves dynamics rather than saturating voiced samples', () => {
  const samples = Float32Array.from([0, .02, .05, .1, .2, .4, .8, 0, 0, 0]);
  const track = speechEnvelope(samples, 50);
  assert.equal(track.step, .02);
  assert.equal(track.levels.length, samples.length);
  assert.equal(track.levels[0], 0);
  assert.equal(track.levels[9], 0);
  assert.ok(track.levels[3] < track.levels[4]);
  assert.ok(track.levels.filter(value => value === 1).length <= 2);
  assert.ok(track.levels.every(value => value >= 0 && value <= 1));
  assert.deepEqual(speechEnvelope(new Float32Array(10), 50).levels, Array(10).fill(0));
});

test('lipsync follows audible output time and accounts for hardware latency', () => {
  const context = { currentTime: 10, getOutputTimestamp: () => ({ contextTime: 9.8, performanceTime: 1000 }) };
  assert.ok(Math.abs(audioOutputTime(context, 1050) - 9.85) < 1e-9);
  assert.equal(audioOutputTime(context, 1400), 10);
  assert.equal(audioOutputTime({ currentTime: 10, baseLatency: .01, outputLatency: .09 }, 1000), 9.9);
  assert.equal(audioOutputTime({ currentTime: .01, baseLatency: .1 }, 1000), 0);
  assert.equal(audioOutputTime({ currentTime: 3, getOutputTimestamp: () => ({ contextTime: 0, performanceTime: 0 }) }, 1000), 3);
});
