import test from 'node:test';
import assert from 'node:assert/strict';
import { cornerFactors } from './corner-model.mjs';
import { phaseNoiseDb } from './model.mjs';

test('normalized factors recover the existing physical spectrum for either corner order', () => {
  for (const ratio of [0, 1e-5, .01, 1, 100]) {
    const p = { fMHz:2400, Q:10, noiseFloor:-170, flickerHz:120e6*ratio };
    for (const x of [1e-6, .01, 1, 10, 1e4]) {
      assert.ok(Math.abs(cornerFactors(x,{ratio}).totalDb - (phaseNoiseDb(x*120e6,p)+170)) < 1e-10);
    }
  }
});
test('local slope agrees with a finite difference of the combined spectrum', () => {
  for (const ratio of [.001, 1, 1000]) for (const x of [.001, 1, 1000]) {
    const h=1e-5, derivative=(cornerFactors(x*10**h,{ratio}).totalDb-cornerFactors(x/10**h,{ratio}).totalDb)/(2*h);
    assert.ok(Math.abs(cornerFactors(x,{ratio}).slope-derivative)<1e-6);
  }
});
test('both possible intermediate regimes have the appropriate asymptotic slope', () => {
  assert.ok(Math.abs(cornerFactors(1e-3,{ratio:1e-6}).slope+20)<.011);
  assert.ok(Math.abs(cornerFactors(1e3,{ratio:1e6}).slope+10)<.011);
  assert.ok(Math.abs(cornerFactors(1e-8,{ratio:1}).slope+30)<1e-5);
  assert.ok(Math.abs(cornerFactors(1e8,{ratio:1}).slope)<1e-5);
});
test('coincident corners add two 3 dB factors and have a smooth local slope', () => {
  const p=cornerFactors(1,{ratio:1});
  assert.ok(Math.abs(p.totalDb-20*Math.log10(2))<1e-12);
  assert.equal(p.slope,-15);
});
test('switching off a mechanism removes its factor and zero flicker is finite', () => {
  assert.equal(cornerFactors(.01,{ratio:0}).flickerDb,0);
  assert.equal(cornerFactors(.01,{ratio:2,leeson:false,flicker:false}).totalDb,0);
  assert.equal(cornerFactors(1,{ratio:2,leeson:false}).leesonDb,0);
  assert.equal(cornerFactors(1,{ratio:2,flicker:false}).flickerDb,0);
  assert.throws(()=>cornerFactors(0),RangeError);
  assert.throws(()=>cornerFactors(1,{ratio:-1}),RangeError);
});
