import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { normalizeWeights, savageGrowthScore, decisionBand, evaluateCreative } = require('../social-metrics.js');

test('weights normalize to 1', () => {
  const w = normalizeWeights({ holdRate: 2, completionRate: 2 });
  const total = Object.values(w).reduce((a,b)=>a+b,0);
  assert.ok(Math.abs(total - 1) < 1e-9);
});

test('growth score is bounded and deterministic', () => {
  const input = { holdRate: .8, completionRate: .7, rewatchRate: .2, shareRate: .1, saveRate: .15, commentRate: .05, followRate: .04, clickRate: .08, revenueRate: .03 };
  const a = savageGrowthScore(input);
  const b = savageGrowthScore(input);
  assert.equal(a.score, b.score);
  assert.ok(a.score >= 0 && a.score <= 100);
});

test('decision bands reflect score thresholds', () => {
  assert.equal(decisionBand(75), 'scale');
  assert.equal(decisionBand(55), 'iterate');
  assert.equal(decisionBand(35), 'test');
  assert.equal(decisionBand(10), 'cut');
});

test('evaluation exposes depth, signal density and commercial components', () => {
  const out = evaluateCreative({ holdRate: .9, completionRate: .8, rewatchRate: .3, shareRate: .1, saveRate: .1, commentRate: .05, followRate: .04, clickRate: .2, revenueRate: .1 });
  assert.equal(typeof out.components.depth, 'number');
  assert.equal(typeof out.components.signalDensity, 'number');
  assert.equal(typeof out.components.commercial, 'number');
  assert.ok(['scale','iterate','test','cut'].includes(out.decision));
});
