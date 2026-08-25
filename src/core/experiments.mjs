import { DEFAULT_THRESHOLDS } from './config.mjs';

export function evaluateExperiment(metrics, thresholds = DEFAULT_THRESHOLDS) {
  const { impressions = 0, days = 0, conversionRatePercent = 0, revenue = 0 } = metrics;

  if ([impressions, days, conversionRatePercent, revenue].some((v) => !Number.isFinite(v) || v < 0)) {
    throw new Error('Experiment metrics must be non-negative numbers');
  }

  if (conversionRatePercent >= thresholds.winnerConversionRatePercent && revenue > 0) {
    return 'winner';
  }

  if (impressions >= thresholds.killAfterImpressions || days >= thresholds.killAfterDays) {
    return 'kill';
  }

  return 'continue';
}
