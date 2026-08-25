import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreOpportunity, decideOpportunity } from '../src/core/scoring.mjs';
import { evaluateExperiment } from '../src/core/experiments.mjs';

test('scores and accepts a strong opportunity', () => {
  const score = scoreOpportunity({
    demand: 90,
    competition: 30,
    productionCost: 10,
    pricePotential: 90,
    distribution: 80,
  });
  assert.equal(score, 82);
  assert.equal(decideOpportunity(score), 'build');
});

test('rejects a weak opportunity', () => {
  const score = scoreOpportunity({
    demand: 30,
    competition: 90,
    productionCost: 80,
    pricePotential: 30,
    distribution: 20,
  });
  assert.equal(decideOpportunity(score), 'discard');
});

test('kills stale experiments', () => {
  assert.equal(evaluateExperiment({ impressions: 600, days: 3, conversionRatePercent: 0, revenue: 0 }), 'kill');
});

test('keeps inconclusive experiments running', () => {
  assert.equal(evaluateExperiment({ impressions: 100, days: 2, conversionRatePercent: 0, revenue: 0 }), 'continue');
});

test('promotes revenue-producing winners', () => {
  assert.equal(evaluateExperiment({ impressions: 100, days: 2, conversionRatePercent: 4, revenue: 25 }), 'winner');
});
