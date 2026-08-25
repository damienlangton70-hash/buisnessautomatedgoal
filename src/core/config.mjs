export const TARGET_REVENUE_GBP = 10_000;
export const TARGET_DAYS = 90;

export const DEFAULT_THRESHOLDS = Object.freeze({
  minimumOpportunityScore: 70,
  minimumMarginPercent: 80,
  killAfterImpressions: 500,
  killAfterDays: 14,
  winnerConversionRatePercent: 3,
});

export const STAGES = Object.freeze([
  'research',
  'validate',
  'build',
  'qa',
  'publish',
  'measure',
  'optimise',
  'expand',
]);
