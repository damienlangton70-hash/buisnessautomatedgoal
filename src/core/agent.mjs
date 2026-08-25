import { DEFAULT_THRESHOLDS } from './config.mjs';
import { scoreOpportunity, decideOpportunity } from './scoring.mjs';
import { evaluateExperiment } from './experiments.mjs';

export function evaluateOpportunity(input) {
  const score = scoreOpportunity(input);
  return { score, decision: decideOpportunity(score, DEFAULT_THRESHOLDS.minimumOpportunityScore) };
}

export function evaluateProductExperiment(metrics) {
  return evaluateExperiment(metrics, DEFAULT_THRESHOLDS);
}

export function nextAction({ opportunity, experiment }) {
  if (opportunity?.decision === 'build') return 'build_product';
  if (experiment === 'winner') return 'expand_winner';
  if (experiment === 'kill') return 'kill_experiment';
  return 'research';
}
