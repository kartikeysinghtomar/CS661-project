export function formatPct(v: number | null | undefined, digits = 1): string {
  if (v == null || Number.isNaN(v)) return "—";
  return `${v.toFixed(digits)}%`;
}

export function perfColor(normalized: number): string {
  if (normalized > 0.8) return "#10b981";
  if (normalized > 0.6) return "#34d399";
  if (normalized > 0.4) return "#fbbf24";
  if (normalized > 0.2) return "#f97316";
  return "#ef4444";
}

/** Relative-to-average color (diff in %). */
export function relColor(diff: number): string {
  if (diff > 15) return "#10b981";
  if (diff > 5) return "#34d399";
  if (diff > -5) return "#fbbf24";
  if (diff > -15) return "#f97316";
  return "#ef4444";
}

/** Palette for multi-series charts (radar, comparison bars). */
export const SERIES_COLORS = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6"];

export function normalize(values: number[]): (v: number) => number {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  return (v: number) => (range > 0 ? (v - min) / range : 0.5);
}
