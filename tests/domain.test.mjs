import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ANCHORS, clamp, stageFor, framePair, signed, pigReport, defenseFor } from '../src/domain.js';
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
test('pig reports describe the chosen form with a bounded, monotonic pig percentage',()=>{
 assert.equal(pigReport(-15).pigPercent,0);
 assert.equal(pigReport(0).pigPercent,0);
 assert.equal(pigReport(7.5).pigPercent,50);
 assert.equal(pigReport(15).pigPercent,100);
 assert.equal(pigReport(200).pigPercent,100);
 assert.equal(pigReport('bad').pigPercent,0);
 let previous=0;
 for(let score=-15;score<=15;score++) {
  const report=pigReport(score);
  assert.ok(Number.isInteger(report.pigPercent)&&report.pigPercent>=previous&&report.pigPercent<=100);
  assert.ok(report.mood.length&&report.advice.length);
  previous=report.pigPercent;
 }
 assert.notEqual(pigReport(-15).mood,pigReport(0).mood);
 assert.notEqual(pigReport(0).advice,pigReport(15).advice);
});

test('defense escalates across forms and safely handles invalid levels', () => {
 assert.match(defenseFor(-15), /重新组织语言/);
 assert.match(defenseFor(0), /谣言不攻自破/);
 assert.match(defenseFor(5), /空气动力学/);
 assert.match(defenseFor(10), /没有任何实锤/);
 assert.match(defenseFor(15), /绝对不是/);
 assert.equal(defenseFor(200), defenseFor(15));
 assert.equal(defenseFor('bad'), defenseFor(0));
});
