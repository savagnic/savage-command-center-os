'use strict';

const DEFAULT_WEIGHTS = Object.freeze({
  holdRate: 0.16,
  completionRate: 0.16,
  rewatchRate: 0.10,
  shareRate: 0.14,
  saveRate: 0.12,
  commentRate: 0.08,
  followRate: 0.10,
  clickRate: 0.08,
  revenueRate: 0.06
});

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function normalizeMetrics(raw = {}) {
  return {
    holdRate: clamp01(raw.holdRate),
    completionRate: clamp01(raw.completionRate),
    rewatchRate: clamp01(raw.rewatchRate),
    shareRate: clamp01(raw.shareRate),
    saveRate: clamp01(raw.saveRate),
    commentRate: clamp01(raw.commentRate),
    followRate: clamp01(raw.followRate),
    clickRate: clamp01(raw.clickRate),
    revenueRate: clamp01(raw.revenueRate)
  };
}

function normalizeWeights(weights = DEFAULT_WEIGHTS) {
  const merged = { ...DEFAULT_WEIGHTS, ...weights };
  const positive = Object.fromEntries(Object.entries(merged).map(([k,v]) => [k, Math.max(0, Number(v) || 0)]));
  const total = Object.values(positive).reduce((a,b) => a+b, 0) || 1;
  return Object.fromEntries(Object.entries(positive).map(([k,v]) => [k, v / total]));
}

function savageGrowthScore(raw, weights = DEFAULT_WEIGHTS) {
  const metrics = normalizeMetrics(raw);
  const w = normalizeWeights(weights);
  const weighted = Object.entries(w).reduce((sum, [key, weight]) => sum + metrics[key] * weight, 0);

  const signalDensity = (
    metrics.shareRate +
    metrics.saveRate +
    metrics.commentRate +
    metrics.followRate +
    metrics.clickRate
  ) / 5;

  const depth = (metrics.holdRate + metrics.completionRate + metrics.rewatchRate) / 3;
  const commercial = (metrics.clickRate + metrics.revenueRate) / 2;

  return {
    score: Math.round(weighted * 10000) / 100,
    components: {
      weighted: Math.round(weighted * 10000) / 100,
      depth: Math.round(depth * 10000) / 100,
      signalDensity: Math.round(signalDensity * 10000) / 100,
      commercial: Math.round(commercial * 10000) / 100
    },
    metrics,
    weights: w
  };
}

function decisionBand(score) {
  if (score >= 70) return 'scale';
  if (score >= 50) return 'iterate';
  if (score >= 30) return 'test';
  return 'cut';
}

function evaluateCreative(raw, weights) {
  const result = savageGrowthScore(raw, weights);
  return { ...result, decision: decisionBand(result.score) };
}

module.exports = {
  DEFAULT_WEIGHTS,
  clamp01,
  normalizeMetrics,
  normalizeWeights,
  savageGrowthScore,
  decisionBand,
  evaluateCreative
};
