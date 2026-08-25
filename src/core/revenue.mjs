export function summariseRevenue(transactions = []) {
  return transactions.reduce(
    (summary, tx) => {
      const gross = Number(tx.gross_gbp || 0);
      const fees = Number(tx.fees_gbp || 0);
      summary.gross += gross;
      summary.fees += fees;
      summary.net += gross - fees;
      return summary;
    },
    { gross: 0, fees: 0, net: 0 },
  );
}

export function targetProgress(netRevenue, target = 10_000) {
  if (!Number.isFinite(netRevenue) || netRevenue < 0 || !Number.isFinite(target) || target <= 0) {
    throw new Error('Revenue and target must be valid non-negative values');
  }
  return Math.min(100, Math.round((netRevenue / target) * 10000) / 100);
}
