/**
 * Deterministic opportunity scoring. The agent can replace individual inputs
 * with researched evidence, but the decision rule stays auditable.
 */
export function scoreOpportunity({
  demand = 0,
  competition = 0,
  productionCost = 0,
  pricePotential = 0,
  distribution = 0,
}) {
  const values = [demand, competition, productionCost, pricePotential, distribution];
  if (values.some((v) => !Number.isFinite(v) || v < 0 || v > 100)) {
    throw new Error('Opportunity inputs must be numbers between 0 and 100');
  }

  return Math.round(
    demand * 0.30 +
    competition * 0.20 +
    (100 - productionCost) * 0.10 +
    pricePotential * 0.20 +
    distribution * 0.20,
  );
}

export function decideOpportunity(score, minimumScore = 70) {
  if (!Number.isFinite(score)) throw new Error('Score must be numeric');
  return score >= minimumScore ? 'build' : 'discard';
}
