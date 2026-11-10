import test from 'node:test';
import assert from 'node:assert/strict';
import { nicValues, nicPoint, effectiveCompensation, equilibriumAmplitude } from './nic-model.mjs';

function close(actual, expected, relative = 1e-10, absolute = 1e-12) {
  assert.ok(Math.abs(actual - expected) <= absolute + relative * Math.abs(expected),
    `${actual} does not match ${expected}`);
}

test('nominal component values give the required negative resistance and LC resonance', () => {
  const d = nicValues();
  close(d.kSmall, 2.01);
  close(d.rNeg, -8200 / 1.01);
  close(d.gSmall, 10100 / 8200);
  close(d.gLarge, 3300 / 8200);
  close(d.f0, 15915.494309189535);
  close(d.Q, 10);
  close(d.diodeOnset, 0.6 / 0.68);
});

test('small-signal KCL yields current opposite to port voltage and negative absorbed power', () => {
  const p = nicPoint(0.5);
  close(p.vOut, 1.005);
  close(p.i, (0.5 - 1.005) / 8200);
  close(p.i, 0.5 / nicValues().rNeg);
  close(p.rf2Voltage / 6800, 0.5 / 10000);
  close((p.vOut - p.v - p.rf2Voltage) / 3300, 0.5 / 10000);
  assert.ok(p.i < 0 && p.power < 0);
  assert.equal(p.diodesConducting, false);
});

test('clamp current satisfies KCL after one diode starts conducting', () => {
  const p = nicPoint(2);
  close(p.rf2Voltage, 0.6);
  close(p.vOut, 2 * 1.33 + 0.6);
  const seriesCurrent = p.v / 10000;
  const resistorCurrent = p.rf2Voltage / 6800;
  const diodeCurrent = seriesCurrent - resistorCurrent;
  assert.ok(diodeCurrent > 0);
  close((p.vOut - p.v - p.rf2Voltage) / 3300, seriesCurrent);
  assert.equal(p.diodesConducting, true);
});

test('the antiparallel network has odd voltage/current symmetry and even absorbed power', () => {
  for (const v of [0, 0.1, 0.7, 1, 2.5]) {
    const pos = nicPoint(v), neg = nicPoint(-v);
    close(neg.vOut, -pos.vOut);
    close(neg.i, -pos.i);
    close(neg.rf2Voltage, -pos.rf2Voltage);
    close(neg.power, pos.power);
    close(neg.kEffective, pos.kEffective);
  }
});

test('turn-on is continuous and headroom is flagged without imposing rail clipping', () => {
  const onset = nicValues().diodeOnset;
  const below = nicPoint(onset - 1e-8), above = nicPoint(onset + 1e-8);
  close(below.vOut, above.vOut, 1e-7);
  assert.equal(below.diodesConducting, false);
  assert.equal(above.diodesConducting, true);
  const large = nicPoint(4);
  assert.equal(large.withinLinearHeadroom, false);
  close(large.vOut, 5.92);
});

test('fundamental quadrature matches the analytic coefficient of a clipped sine', () => {
  const d = nicValues();
  for (const amplitude of [0, 0.5, d.diodeOnset, 1, 1.5, 2, 10, 1000]) {
    let expected = d.gSmall;
    if (amplitude > d.diodeOnset) {
      const ratio = d.diodeOnset / amplitude;
      const clippedFundamental = 2 / Math.PI * (Math.asin(ratio) + ratio * Math.sqrt(1 - ratio * ratio));
      expected = 10000 / 8200 * (0.33 + 0.68 * clippedFundamental);
    }
    close(effectiveCompensation(amplitude), expected, 3e-9);
  }
});

test('limiting reduces compensation monotonically to its large-amplitude limit', () => {
  const samples = [0, 0.5, 1, 1.5, 2, 4, 20, 1e7].map(a => effectiveCompensation(a));
  for (let n = 1; n < samples.length; n += 1) assert.ok(samples[n] <= samples[n - 1]);
  close(samples.at(-1), nicValues().gLarge, 3e-7);
});

test('harmonic balance has a stable finite equilibrium with nominal components', () => {
  const amplitude = equilibriumAmplitude();
  assert.ok(amplitude > 1.4 && amplitude < 1.6);
  close(effectiveCompensation(amplitude), 1, 1e-10);
  assert.ok(effectiveCompensation(amplitude * 0.95) > 1);
  assert.ok(effectiveCompensation(amplitude * 1.05) < 1);
  assert.equal(nicPoint(amplitude).withinLinearHeadroom, true);
});

test('startup and limiting conditions distinguish extinction from unbounded ideal growth', () => {
  assert.equal(equilibriumAmplitude({ rn: 15000 }), 0);
  assert.equal(equilibriumAmplitude({ rn: 10100 }), 0);
  assert.equal(equilibriumAmplitude({ limiter: false }), Infinity);
  assert.equal(equilibriumAmplitude({ rn: 3000 }), Infinity);
  close(effectiveCompensation(100, { limiter: false }), nicValues().gSmall);
  close(nicPoint(2, { limiter: false }).vOut, 4.02);
});

test('series winding resistance shifts resonance and adds the correct parallel conductance', () => {
  const d = nicValues({ rn: 6800, coilR: 20 });
  close(d.gConductance, 1 / 10000 + 20 * 1e-8 / 0.01);
  close(d.effectiveRp, 1 / 0.00012);
  close(d.gSmall, 1.01 / 6800 / 0.00012);
  close(d.gLarge, 0.33 / 6800 / 0.00012);
  close(d.Qapprox, 8.333333333333334);
  close(d.Q, d.Qapprox);
  close(d.f0, nicValues().f0 * Math.sqrt(1 - (20 / 1000) ** 2));
  const omega = 2 * Math.PI * d.f0;
  const denominator = 20 ** 2 + (omega * 0.01) ** 2;
  close(omega * 1e-8 - omega * 0.01 / denominator, 0);
  close(20 / denominator, d.gConductance - 1 / 10000);
});

test('winding loss reduces startup margin and crosses the expected 48.53-ohm threshold', () => {
  const threshold = (1.01 / 6800 - 1 / 10000) * 0.01 / 1e-8;
  close(threshold, 48.529411764705884);
  assert.ok(nicValues({ rn: 6800, coilR: 48 }).gSmall > 1);
  assert.ok(nicValues({ rn: 6800, coilR: 49 }).gSmall < 1);
  assert.equal(equilibriumAmplitude({ rn: 6800, coilR: 49 }), 0);
  const options = { rn: 6800, coilR: 20 };
  const amplitude = equilibriumAmplitude(options);
  assert.ok(amplitude > 0);
  close(effectiveCompensation(amplitude, options), 1);
  assert.ok(effectiveCompensation(2, options) < effectiveCompensation(2, { rn: 6800 }));
});

test('physical domains reject nonfinite and nonphysical component values', () => {
  assert.throws(() => nicValues({ rn: 0 }), RangeError);
  assert.throws(() => nicValues({ rf1: -1 }), RangeError);
  assert.throws(() => nicValues({ L: NaN }), RangeError);
  assert.throws(() => nicValues({ limiter: 'yes' }), TypeError);
  assert.throws(() => nicValues({ coilR: -1 }), RangeError);
  assert.throws(() => nicValues({ coilR: 1000 }), RangeError);
  assert.throws(() => nicPoint(Infinity), RangeError);
  assert.throws(() => effectiveCompensation(-0.5), RangeError);
});
