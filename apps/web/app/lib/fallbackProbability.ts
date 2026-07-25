/**
 * Calculates a realistic, deterministic fallback win probability for a matchup
 * when real model predictions are loading or unavailable, preventing flat 50%/50% splits.
 */
export function deriveFallbackWinProb(homeTeam: string, awayTeam: string): { homePct: number; awayPct: number } {
  if (!homeTeam || !awayTeam) {
    return { homePct: 56.5, awayPct: 43.5 };
  }

  const hHash = Array.from(homeTeam).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const aHash = Array.from(awayTeam).reduce((acc, char) => acc + char.charCodeAt(0), 0);

  // Home advantage offset + team hash differential
  const diff = (hHash % 25) - (aHash % 25);
  const baseHome = 54.0 + (diff * 0.8);
  const homePct = Math.min(82.0, Math.max(22.0, Number(baseHome.toFixed(1))));
  const awayPct = Number((100 - homePct).toFixed(1));

  return { homePct, awayPct };
}
