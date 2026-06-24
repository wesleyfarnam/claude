/**
 * Format utilities for reporting / display surfaces.
 */

/**
 * Convert a millisecond duration into a compact human string like
 * `"1h 23m 45s"`. Zero-value segments are dropped, except that an
 * input of 0ms returns `"0s"`.
 *
 * Negative or non-finite inputs are clamped to 0.
 */
export function humanizeDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "0s";

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

  return parts.join(" ");
}

/**
 * Format an ISO date (YYYY-MM-DD) into a short, readable label,
 * e.g. `"Jun 24, 2026"`. Falls back to the raw input on parse failure.
 */
function formatDateLabel(iso: string): string {
  // Parse as a UTC midnight to avoid TZ drift when the input is YYYY-MM-DD.
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const yearStr = match[1];
  const monthStr = match[2];
  const dayStr = match[3];
  if (!yearStr || !monthStr || !dayStr) return iso;
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return iso;
  }
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Format an inclusive date range like `"Jun 17 – Jun 24, 2026"` (same
 * year) or `"Dec 30, 2025 – Jan 2, 2026"` (spans years). Accepts
 * `YYYY-MM-DD` strings; falls back to a simple dash-join otherwise.
 */
export function formatDateRange(from: string, to: string): string {
  const fromLabel = formatDateLabel(from);
  const toLabel = formatDateLabel(to);
  if (fromLabel === from || toLabel === to) {
    return `${fromLabel} – ${toLabel}`;
  }
  const fromYear = from.slice(0, 4);
  const toYear = to.slice(0, 4);
  if (fromYear === toYear) {
    // Drop the year from the "from" side to avoid repetition.
    const short = fromLabel.replace(`, ${fromYear}`, "");
    return `${short} – ${toLabel}`;
  }
  return `${fromLabel} – ${toLabel}`;
}
