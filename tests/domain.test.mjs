import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ANCHORS, clamp, stageFor, framePair, signed } from '../src/domain.js';
import { access, readFile } from 'node:fs/promises';
test('all 31 positions interpolate between valid adjacent frames',()=>{
 for(let value=-15;value<=15;value++){const {index,mix}=framePair(value); assert.ok(index>=0&&index<6);assert.ok(mix>=0&&mix<=1);assert.equal(ANCHORS[index].value+mix*5,value);}
 assert.deepEqual(framePair(-15),{index:0,mix:0});assert.deepEqual(framePair(0),{index:3,mix:0});assert.deepEqual(framePair(15),{index:5,mix:1});
});
test('clamp unsafe links and preserve the three approved anchor identities',()=>{
 assert.equal(clamp('not-a-number'),0);assert.equal(clamp(Infinity),0);assert.equal(clamp(123),15);assert.equal(clamp(-123),-15);
 assert.equal(stageFor(-15).image,'reborn');assert.equal(stageFor(0).image,'original');assert.equal(stageFor(15).image,'pig');assert.equal(signed(-15),'−15');
});
test('every declared portrait exists and production HTML has metadata',async()=>{
 for(const anchor of ANCHORS) await access(new URL(`../public/portraits/${anchor.image}.webp`,import.meta.url));
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');assert.match(html,/<html lang="zh-CN">/);assert.match(html,/name="viewport"/);assert.ok(!html.includes('liang-slider'));
});
