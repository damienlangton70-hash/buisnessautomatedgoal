/**
 * ISO 8601 week helpers.
 *
 * The previous implementation used a jan4/getDay() approximation that drifted
 * by a week around year boundaries, which meant the Saturday bundle could look
 * for a manifest the weekday runs never wrote.
 */

/**
 * @param {Date} [date] any date
 * @returns {{year:number, week:number, id:string}} ISO week-year, week number,
 *          and a sortable `YYYY-WW` identifier.
 */
export function isoWeek(date = new Date()) {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );

  // ISO weeks run Monday(1)..Sunday(7); the week's Thursday decides its year.
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);

  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);

  return {
    year: d.getUTCFullYear(),
    week,
    id: `${d.getUTCFullYear()}-${String(week).padStart(2, "0")}`,
  };
}

/** UTC date stamp, e.g. "2026-09-01". */
export function utcDateStamp(date = new Date()) {
  return date.toISOString().split("T")[0];
}
