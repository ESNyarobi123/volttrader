/** Chart palette + shared types (no recharts — safe for analytics/utils). */

export const CHART_COLORS = [
  "hsl(350 73% 44%)", // brand crimson
  "hsl(351 77% 61%)", // crimson light
  "hsl(142 65% 29%)", // success green
  "hsl(43 90% 61%)", // gold accent
  "hsl(0 100% 45%)", // danger red
  "hsl(0 0% 11%)", // near-black
];

export const MIX_PAIRS: Array<[string, string]> = [
  ["hsl(350 73% 44%)", "hsl(349 74% 32%)"],
  ["hsl(0 0% 10%)", "hsl(351 77% 61%)"],
  ["hsl(142 65% 32%)", "hsl(142 65% 29%)"],
  ["hsl(0 100% 45%)", "hsl(350 73% 44%)"],
];

export interface Series {
  key: string;
  label: string;
  color: string;
  /** Optional second stop for gradient mixers. */
  colorTo?: string;
}

export interface DonutDatum {
  name: string;
  value: number;
  color: string;
  colorTo?: string;
}
